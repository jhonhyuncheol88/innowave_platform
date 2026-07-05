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
