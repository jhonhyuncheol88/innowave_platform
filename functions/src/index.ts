/**
 * INNOWAVE Cloud Functions — 문서 분석 파이프라인 (Phase 1, REQ-03/04)
 *
 * 흐름:
 *  1) 클라이언트가 docParses/{docId} 문서를 status 'pending'으로 만들고
 *     Storage uploads/{uid}/{docId}/{fileName} 에 파일 업로드
 *  2) onObjectFinalized 트리거 → 포맷 정규화(PDF 직접 / DOCX·PPTX 텍스트 추출 / HWPX XML 파싱)
 *  3) Vertex AI Gemini 구조화 추출(responseSchema) → docParses/{docId} 에 결과 기록
 *  4) 클라이언트(1단계 화면)가 onSnapshot으로 구독해 폼 프리필
 */
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { GoogleGenAI, Type } from '@google/genai';
import { parseOfficeAsync } from 'officeparser';
import JSZip from 'jszip';

initializeApp();

const PROJECT_ID = 'innowave-platform';
const VERTEX_LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';
/** 이 크기 이하 PDF는 base64 inline으로 전달 (GCS URI 접근 변수 제거) */
const INLINE_LIMIT = 10 * 1024 * 1024;

const EVENT_TYPES = [
  '해커톤·아이디어톤', '부트캠프·창업캠프', '데모데이·IR피칭', '경진대회',
  '네트워킹', '포럼·컨퍼런스', '특강·세미나', '박람회·전시',
];

/** 필드별 {value, confidence, evidence} 스키마 생성 */
function fieldSchema(valueType: Type, extra: Record<string, unknown> = {}) {
  return {
    type: Type.OBJECT,
    properties: {
      value: { type: valueType, ...extra },
      confidence: { type: Type.NUMBER, description: '0~1. 문서에 명시적 근거가 있으면 0.8 이상, 추정이면 0.5 이하, 못 찾으면 0' },
      evidence: { type: Type.STRING, description: '근거가 된 원문 구절(30자 내외). 없으면 빈 문자열' },
    },
    required: ['value', 'confidence', 'evidence'],
  };
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: fieldSchema(Type.STRING, { description: '행사명' }),
    organizer: fieldSchema(Type.STRING, { description: '주관/발주 기관명' }),
    eventType: fieldSchema(Type.STRING, { enum: [...EVENT_TYPES, ''], description: '행사 유형 (목록 중 가장 가까운 것)' }),
    periodStart: fieldSchema(Type.STRING, { description: '행사 시작일 YYYY-MM-DD, 없으면 빈 문자열' }),
    periodEnd: fieldSchema(Type.STRING, { description: '행사 종료일 YYYY-MM-DD, 없으면 빈 문자열' }),
    region: fieldSchema(Type.STRING, { description: '개최 지역 (예: 서울)' }),
    operationType: fieldSchema(Type.STRING, { enum: ['오프라인', '온라인', '하이브리드', ''], description: '운영 형태' }),
    participantScale: fieldSchema(Type.INTEGER, { description: '참가 인원 수 (숫자만, 없으면 0)' }),
    budgetLimit: fieldSchema(Type.INTEGER, { description: '사업 예산 총액, 원 단위 정수 (없으면 0)' }),
    purpose: fieldSchema(Type.STRING, { description: '행사 목적 요약 (2문장 이내)' }),
  },
  required: ['name', 'organizer', 'eventType', 'periodStart', 'periodEnd', 'region', 'operationType', 'participantScale', 'budgetLimit', 'purpose'],
};

const PROMPT = `당신은 MICE 행사 용역 문서 분석 전문가다. 첨부된 과업지시서/제안요청서에서 행사 기본 정보를 추출하라.

규칙:
- budgetLimit(예산)은 반드시 원 단위 정수로 정규화한다. 예: "6,000만 원" → 60000000, "60,000천원" → 60000000, "1.2억" → 120000000. 부가세 포함 총액을 우선한다.
- 날짜는 YYYY-MM-DD. "2026. 9. 12."처럼 표기돼 있어도 변환한다. 연도가 없으면 문서의 사업연도를 참고한다.
- participantScale은 목표 참가 인원 숫자만. "300여 명" → 300.
- eventType은 주어진 목록 중 가장 가까운 하나를 고른다. 애매하면 confidence를 낮춘다.
- 문서에서 찾지 못한 항목은 value를 빈 문자열(숫자는 0)로 두고 confidence 0으로 표시한다. 지어내지 마라.
- evidence에는 판단 근거가 된 문서 원문 구절을 30자 내외로 인용한다.`;

/** HWPX(zip/XML)에서 본문 텍스트 추출 */
async function extractHwpxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sections = Object.keys(zip.files)
    .filter((p) => /^Contents\/section\d+\.xml$/i.test(p))
    .sort();
  if (sections.length === 0) throw new Error('HWPX 본문(section*.xml)을 찾지 못했습니다');
  const parts: string[] = [];
  for (const path of sections) {
    const xml = await zip.files[path].async('string');
    // 텍스트 노드만 남기고 태그 제거 (표 셀 사이에 공백 유지)
    parts.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return parts.join('\n\n');
}

interface ExtractedInput {
  kind: 'inline' | 'file' | 'text';
  data?: string;
  fileUri?: string;
  mimeType?: string;
  text?: string;
}

/** 포맷 정규화 — Gemini 입력 형태 결정 */
async function normalizeDocument(bucketName: string, objectName: string, fileName: string): Promise<ExtractedInput> {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();

  if (ext === 'pdf') {
    // Gemini는 PDF를 네이티브로 읽는다. 소형 파일은 inline(base64)으로 전달해
    // GCS URI 접근 이슈(리전·권한)를 원천 차단하고, 대형 파일만 URI를 쓴다.
    const [meta] = await getStorage().bucket(bucketName).file(objectName).getMetadata();
    const size = Number(meta.size ?? 0);
    if (size > 0 && size <= INLINE_LIMIT) {
      const [pdf] = await getStorage().bucket(bucketName).file(objectName).download();
      return { kind: 'inline', data: pdf.toString('base64'), mimeType: 'application/pdf' };
    }
    return { kind: 'file', fileUri: `gs://${bucketName}/${objectName}`, mimeType: 'application/pdf' };
  }

  const [buffer] = await getStorage().bucket(bucketName).file(objectName).download();

  if (ext === 'docx' || ext === 'pptx' || ext === 'xlsx') {
    const text = await parseOfficeAsync(buffer);
    if (!text || text.trim().length < 30) throw new Error('문서에서 텍스트를 추출하지 못했습니다');
    return { kind: 'text', text };
  }

  if (ext === 'hwpx') {
    const text = await extractHwpxText(buffer);
    if (text.trim().length < 30) throw new Error('HWPX 문서에서 텍스트를 추출하지 못했습니다');
    return { kind: 'text', text };
  }

  if (ext === 'hwp') {
    throw new Error('HWP(구버전 한글) 형식은 아직 지원하지 않습니다. HWPX 또는 PDF로 저장해 다시 올려 주세요.');
  }

  throw new Error(`지원하지 않는 형식입니다: .${ext} (PDF, DOCX, PPTX, HWPX 지원)`);
}

/* ── 단계별 AI 지침 반영 (REQ: 워크플로우 지침) ─────────────────────────
 * 각 단계 화면에서 입력한 지침을 다음 단계 초안 생성에 반영한다.
 *  - programs: 기본 프로그램 초안을 지침에 맞게 수정
 *  - matching: 후보 인력 중 지침에 부합하는 인력 추천
 *  - quote:    견적 항목의 수량만 지침에 맞게 조정 (단가·항목은 레이트카드 고정)
 */

const PROGRAM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    programs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: '시작 시간, 24시간 HH:MM' },
          name: { type: Type.STRING, description: '프로그램명' },
          dur: { type: Type.INTEGER, description: '소요 시간(분), 5 이상' },
        },
        required: ['time', 'name', 'dur'],
      },
    },
    note: { type: Type.STRING, description: '지침을 어떻게 반영했는지 1~2문장 요약' },
  },
  required: ['programs', 'note'],
};

const MATCHING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recommendedIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: '추천 인력 id 목록 (후보 id 중에서만)' },
    note: { type: Type.STRING, description: '추천 이유 1~2문장 요약' },
  },
  required: ['recommendedIds', 'note'],
};

const QUOTE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rateCardId: { type: Type.STRING, description: 'base에 있던 rateCardId 그대로' },
          qty: { type: Type.INTEGER, description: '조정된 수량. 제외할 항목은 0' },
        },
        required: ['rateCardId', 'qty'],
      },
    },
    note: { type: Type.STRING, description: '수량을 어떻게 조정했는지 1~2문장 요약' },
  },
  required: ['items', 'note'],
};

const BASICINFO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fields: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: '행사명' },
        organizer: { type: Type.STRING, description: '주관기관' },
        eventType: { type: Type.STRING, enum: [...EVENT_TYPES, ''], description: '행사 유형' },
        periodStart: { type: Type.STRING, description: '시작일 YYYY-MM-DD, 없으면 빈 문자열' },
        periodEnd: { type: Type.STRING, description: '종료일 YYYY-MM-DD, 없으면 빈 문자열' },
        region: { type: Type.STRING, description: '개최 지역' },
        operationType: { type: Type.STRING, enum: ['오프라인', '온라인', '하이브리드', ''], description: '운영 형태' },
        participantScale: { type: Type.INTEGER, description: '참가 인원 수 (숫자만, 미변경 시 기존 값)' },
        budgetLimit: { type: Type.INTEGER, description: '예산 총액 원 단위 정수 (미변경 시 기존 값)' },
        purpose: { type: Type.STRING, description: '행사 목적' },
      },
      required: ['name', 'organizer', 'eventType', 'periodStart', 'periodEnd', 'region', 'operationType', 'participantScale', 'budgetLimit', 'purpose'],
    },
    note: { type: Type.STRING, description: '무엇을 어떻게 바꿨는지 1~2문장 요약 (대화체)' },
  },
  required: ['fields', 'note'],
};

const INSTRUCTION_PROMPTS: Record<string, string> = {
  basicInfo: `당신은 행사 기획 어시스턴트다. 아래 행사 기본 정보(base)를 사용자 요청에 맞게 수정하라.
규칙:
- 요청된 항목만 바꾸고 나머지는 base 값을 그대로 유지한다.
- 날짜는 YYYY-MM-DD. "27년 3월"처럼 기간이 모호하면 해당 월의 1일~말일로 설정한다.
- 예산은 원 단위 정수, 인원은 숫자만.
- note는 사용자에게 답하는 대화체 1~2문장으로 쓴다. 예: "지역을 강화군으로, 기간을 2027년 3월로 변경했어요."`,
  programs: `당신은 MICE 행사 프로그램 기획 전문가다. 아래 기본 프로그램 초안을 사용자 지침에 맞게 수정하라.
규칙:
- 지침에 없는 부분은 초안을 최대한 유지한다.
- time은 24시간 HH:MM 형식, 시간 순서대로 정렬하고 프로그램이 서로 겹치지 않게 한다.
- dur(분)은 5 이상. 전체 구성은 행사 기간·규모에 비추어 상식적이어야 한다.
- 지침이 특정 연도를 지시하면 프로그램명·구성에 반영한다.`,
  matching: `당신은 행사 인력 매칭 전문가다. 아래 후보 목록에서 사용자 지침에 가장 부합하는 인력을 추천하라.
규칙:
- recommendedIds에는 반드시 후보 목록의 id만 넣는다. 새로운 id를 만들지 마라.
- 지침과 행사 정보(지역·유형·규모)를 함께 고려한다.
- 후보 중 지침에 맞는 인력이 없으면 빈 배열을 반환하고 note에 이유를 적는다.`,
  quote: `당신은 행사 견적 전문가다. 아래 견적 항목의 수량(qty)을 사용자 지침에 맞게 조정하라.
규칙:
- base에 있는 rateCardId만 사용한다. 항목을 새로 만들지 마라. 단가는 바꿀 수 없다.
- 지침상 불필요한 항목은 qty 0으로 제외한다. 언급 없는 항목은 기존 수량을 유지한다.
- 행사 예산 한도(budgetLimit)를 초과하지 않는 방향으로 조정한다.`,
};

const INSTRUCTION_SCHEMAS: Record<string, object> = {
  basicInfo: BASICINFO_SCHEMA,
  programs: PROGRAM_SCHEMA,
  matching: MATCHING_SCHEMA,
  quote: QUOTE_SCHEMA,
};

export const applyStepInstruction = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요한 기능입니다.');

    const { target, instruction, eventInfo, base } = (request.data ?? {}) as {
      target?: string; instruction?: string; eventInfo?: unknown; base?: unknown;
    };
    if (!target || !INSTRUCTION_PROMPTS[target]) throw new HttpsError('invalid-argument', '알 수 없는 target입니다.');
    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      throw new HttpsError('invalid-argument', '지침이 비어 있습니다.');
    }
    if (instruction.length > 1000) throw new HttpsError('invalid-argument', '지침은 1,000자 이내로 작성해 주세요.');

    const prompt = [
      INSTRUCTION_PROMPTS[target],
      '\n----- 행사 정보 -----',
      JSON.stringify(eventInfo ?? {}, null, 2).slice(0, 4000),
      target === 'basicInfo' ? '\n----- 행사 기본 정보 (base) -----'
        : target === 'programs' ? '\n----- 기본 프로그램 초안 -----'
          : target === 'matching' ? '\n----- 후보 인력 목록 -----' : '\n----- 견적 항목 (기본 수량) -----',
      JSON.stringify(base ?? [], null, 2).slice(0, 20000),
      '\n----- 사용자 지침 -----',
      instruction.trim(),
    ].join('\n');

    const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION });
    const req = {
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: INSTRUCTION_SCHEMAS[target],
        temperature: 0.2,
      },
    };

    try {
      let response;
      try {
        response = await ai.models.generateContent(req);
      } catch (first) {
        const msg = first instanceof Error ? first.message : String(first);
        if (!/INTERNAL|UNAVAILABLE|"code":5\d\d|429/.test(msg)) throw first;
        logger.warn('Vertex 일시 오류 — 재시도', { target, msg });
        await new Promise((r) => setTimeout(r, 2000));
        response = await ai.models.generateContent(req);
      }
      const raw = response.text;
      if (!raw) throw new Error('모델이 빈 응답을 반환했습니다');
      logger.info('지침 반영 완료', { target, uid: request.auth.uid });
      return JSON.parse(raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('지침 반영 실패', { target, message });
      throw new HttpsError('internal', `AI 지침 반영에 실패했습니다: ${message}`);
    }
  },
);

/* ── 5단계 산출 문서 생성 (운영사업 제안서 · 과업지시서) ─────────────────
 * 워크플로우 전체 데이터(행사·프로그램·비품·인력·견적)를 받아
 * 서술 섹션을 구조화 JSON으로 생성한다. 표 데이터는 클라이언트가 실데이터로 배치한다.
 */

const DOC_ROW = {
  type: Type.OBJECT,
  properties: { label: { type: Type.STRING }, value: { type: Type.STRING } },
  required: ['label', 'value'],
};
const STR_ARR = { type: Type.ARRAY, items: { type: Type.STRING } };

const PROPOSAL_DOC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overviewRows: { type: Type.ARRAY, items: DOC_ROW, description: '사업 개요 표 — 사업명·주관·기간·장소·규모·총사업비 등 (제공된 값만 사용)' },
    backgroundPolicy: { ...STR_ARR, description: '정책적 배경 문단 2~3개' },
    backgroundEnvironment: { ...STR_ARR, description: '환경적 배경 문단 2~3개' },
    necessity: { ...STR_ARR, description: '사업 필요성 개조식 3~4개' },
    goals: { ...STR_ARR, description: '사업 목표 개조식 3개 내외' },
    effects: { ...STR_ARR, description: '기대 효과 개조식 3개 내외' },
    programDirection: { ...STR_ARR, description: '프로그램 구성 방향 서술 3~4개 (세부 표는 별도 배치됨)' },
    differentiation: { ...STR_ARR, description: '차별성 개조식 4개 내외' },
    recruitment: { ...STR_ARR, description: '참가자 모집 계획 개조식' },
    promotion: { ...STR_ARR, description: '홍보 계획 개조식 (제공된 비품 목록의 홍보물 항목 근거)' },
    aftercare: { ...STR_ARR, description: '사후관리 운영 방안 개조식' },
    contentAssets: { ...STR_ARR, description: '콘텐츠 자산화 방안 개조식' },
    kpi: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, target: { type: Type.STRING }, note: { type: Type.STRING } }, required: ['name', 'target', 'note'] },
      description: '정량 성과지표 4~6개',
    },
    schedule: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { period: { type: Type.STRING }, activity: { type: Type.STRING } }, required: ['period', 'activity'] },
      description: '추진일정 (행사 기간 내 월/주 단위)',
    },
    team: { ...STR_ARR, description: '수행체계 개조식 (제공된 선택 인력 구성 근거)' },
    risks: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { risk: { type: Type.STRING }, mitigation: { type: Type.STRING } }, required: ['risk', 'mitigation'] },
      description: '위험관리 3~4개',
    },
    budgetSummary: { type: Type.STRING, description: '소요예산 요약 1~2문장 (제공된 견적 총액만 사용, 별첨 예산안 언급)' },
  },
  required: ['overviewRows', 'backgroundPolicy', 'backgroundEnvironment', 'necessity', 'goals', 'effects', 'programDirection', 'differentiation', 'recruitment', 'promotion', 'aftercare', 'contentAssets', 'kpi', 'schedule', 'team', 'risks', 'budgetSummary'],
};

const WORKORDER_DOC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overviewRows: { type: Type.ARRAY, items: DOC_ROW, description: '사업개요 표 — 사업명·사업기간·예정인원·추진방법·총사업비·계약방법 (제공된 값만 사용)' },
    purpose: { ...STR_ARR, description: '사업 목적 개조식 3개 내외' },
    scopePre: { ...STR_ARR, description: '사업범위 — 사전 기획·준비 단계 과업 개조식' },
    scopeRun: { ...STR_ARR, description: '사업범위 — 진행·운영 단계 과업 개조식' },
    scopePost: { ...STR_ARR, description: '사업범위 — 종료 후 결과보고 단계 과업 개조식' },
    taskRows: { type: Type.ARRAY, items: DOC_ROW, description: '과업 개요 표 — 과업대상·과업장소·운영기간 등' },
    direction: { ...STR_ARR, description: '교육(운영) 방향 개조식' },
    notes: { ...STR_ARR, description: '다과·케이터링, 계약 관련 확인사항 등 협의 사항' },
    schedule: { ...STR_ARR, description: '운영 일정 개조식' },
  },
  required: ['overviewRows', 'purpose', 'scopePre', 'scopeRun', 'scopePost', 'taskRows', 'direction', 'notes', 'schedule'],
};

const DOC_PROMPTS: Record<string, string> = {
  proposal: `당신은 MICE·창업지원 행사 전문 기획사의 제안서 작성 전문가다. 아래 워크플로우 데이터를 바탕으로 공공기관 제출용 '운영사업 제안서'의 서술 섹션을 작성하라.
규칙:
- 금액·기간·인원·기관명 등 사실 데이터는 제공된 값만 사용한다. 제공되지 않은 수치는 지어내지 말고 "협약 시 확정" 등으로 표기한다.
- 공공사업 제안서 톤의 개조식(음슴체)으로 작성한다. 예: "충남 창업기업의 디지털 전환 및 비즈니스 효율성 극대화"
- 금액 숫자는 반드시 천 단위 콤마로 표기한다. 예: 60,000,000원
- KPI 목표값은 참가 규모·프로그램 수 등 제공된 데이터에서 합리적으로 도출한다.
- 홍보 계획은 제공된 비품 목록의 홍보물 항목을, 수행체계는 선택 인력 구성을 근거로 쓴다.
- 사용자 지침이 있으면 반영한다.`,
  workorder: `당신은 공공기관 용역 발주 문서 전문가다. 아래 워크플로우 데이터를 바탕으로 발주처가 사용할 '과업지시서' 초안의 서술 섹션을 작성하라.
규칙:
- 금액·기간·인원·기관명 등 사실 데이터는 제공된 값만 사용한다. 제공되지 않은 것은 "추후 협의" 등으로 표기한다.
- 공공 과업지시서 톤의 개조식으로 작성한다. 사업범위는 사전 기획·준비 / 진행·운영 / 종료 후 결과보고 3단계로 나눠 쓴다.
- 금액 숫자는 반드시 천 단위 콤마로 표기한다. 예: 63,000,000원
- 계약방법 등 확정 불가 항목은 "협의 후 확정"으로 둔다.
- 사용자 지침이 있으면 반영한다.`,
};

export const generateDocument = onCall(
  {
    region: 'asia-northeast3',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요한 기능입니다.');
    const { docType, context } = (request.data ?? {}) as { docType?: string; context?: unknown };
    if (!docType || !DOC_PROMPTS[docType]) throw new HttpsError('invalid-argument', '알 수 없는 docType입니다.');

    const prompt = [
      DOC_PROMPTS[docType],
      '\n----- 워크플로우 데이터 (행사·프로그램·비품·인력·견적·지침) -----',
      JSON.stringify(context ?? {}, null, 2).slice(0, 40000),
    ].join('\n');

    const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION });
    const req = {
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: docType === 'proposal' ? PROPOSAL_DOC_SCHEMA : WORKORDER_DOC_SCHEMA,
        temperature: 0.4,
      },
    };

    try {
      let response;
      try {
        response = await ai.models.generateContent(req);
      } catch (first) {
        const msg = first instanceof Error ? first.message : String(first);
        if (!/INTERNAL|UNAVAILABLE|"code":5\d\d|429/.test(msg)) throw first;
        logger.warn('Vertex 일시 오류 — 재시도', { docType, msg });
        await new Promise((r) => setTimeout(r, 2000));
        response = await ai.models.generateContent(req);
      }
      const raw = response.text;
      if (!raw) throw new Error('모델이 빈 응답을 반환했습니다');
      logger.info('문서 생성 완료', { docType, uid: request.auth.uid });
      return JSON.parse(raw);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('문서 생성 실패', { docType, message });
      throw new HttpsError('internal', `문서 생성에 실패했습니다: ${message}`);
    }
  },
);

export const parseUploadedDocument = onObjectFinalized(
  {
    region: 'asia-northeast3',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 5,
  },
  async (event) => {
    const objectName = event.data.name ?? '';
    const match = objectName.match(/^uploads\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) return; // 분석 대상 경로가 아님

    const [, uid, docId, fileName] = match;
    const db = getFirestore();
    const docRef = db.collection('docParses').doc(docId);

    logger.info('문서 분석 시작', { uid, docId, fileName, size: event.data.size });
    await docRef.set({
      uid,
      fileName,
      storagePath: objectName,
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    try {
      const input = await normalizeDocument(event.data.bucket, objectName, fileName);

      const ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: VERTEX_LOCATION });
      const parts = input.kind === 'inline'
        ? [{ inlineData: { data: input.data!, mimeType: input.mimeType! } }, { text: PROMPT }]
        : input.kind === 'file'
          ? [{ fileData: { fileUri: input.fileUri!, mimeType: input.mimeType! } }, { text: PROMPT }]
          : [{ text: `${PROMPT}\n\n----- 문서 본문 -----\n${input.text!.slice(0, 300000)}` }];

      const request = {
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      };

      // 일시적 5xx는 1회 재시도
      let response;
      try {
        response = await ai.models.generateContent(request);
      } catch (first) {
        const msg = first instanceof Error ? first.message : String(first);
        if (!/INTERNAL|UNAVAILABLE|"code":5\d\d|429/.test(msg)) throw first;
        logger.warn('Vertex 일시 오류 — 재시도', { docId, msg });
        await new Promise((r) => setTimeout(r, 2000));
        response = await ai.models.generateContent(request);
      }

      const raw = response.text;
      if (!raw) throw new Error('모델이 빈 응답을 반환했습니다');
      const fields = JSON.parse(raw);

      await docRef.set({
        status: 'done',
        fields,
        model: MODEL,
        inputKind: input.kind,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      logger.info('문서 분석 완료', { docId });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('문서 분석 실패', { docId, message });
      await docRef.set({
        status: 'failed',
        error: message,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  },
);
