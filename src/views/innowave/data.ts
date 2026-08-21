/** INNOWAVE.dc.html 프로토타입 데모 데이터 */
import type { MatchPerson, Milestone, PoolPerson, ProgramItem, RateItem } from './types.js';

export const PROCESS_CARDS = [
  { num: '01', title: '행사 정보 입력', desc: '기본 정보를 입력하거나 과업지시서를 올리면 AI가 항목을 자동으로 채웁니다.' },
  { num: '02', title: '프로그램 구성', desc: '행사 유형에 맞는 세부 프로그램을 AI가 제안하고, 자유롭게 수정할 수 있습니다.' },
  { num: '03', title: '전문가 매칭', desc: '강사·멘토·심사위원·운영인력을 적합도 점수 기준으로 추천받습니다.' },
  { num: '04', title: '견적·기획안 생성', desc: '표준 레이트카드 기반의 3가지 예산 옵션과 통합 기획안을 받아 봅니다.' },
];

export const INITIAL_PROGRAMS: ProgramItem[] = [
  { time: '09:00', name: '개회식 및 등록', dur: 60, ai: true },
  { time: '10:00', name: '오프닝 키노트', dur: 45, ai: true },
  { time: '10:45', name: '팀 빌딩 세션', dur: 75, ai: true },
  { time: '12:00', name: '중식 및 네트워킹', dur: 60, ai: false },
  { time: '13:00', name: '해커톤 본선 & 멘토링 라운드', dur: 240, ai: true },
  { time: '17:00', name: '심사 및 시상', dur: 60, ai: true },
  { time: '18:00', name: '네트워킹 리셉션', dur: 90, ai: true },
];

/** 행사 유형별 1일차 프로그램 AI 초안 — 저장본이 없는 프로젝트의 시작점 (REQ-05) */
export const PROGRAM_DRAFTS: Record<string, ProgramItem[]> = {
  '해커톤·아이디어톤': INITIAL_PROGRAMS,
  '부트캠프·창업캠프': [
    { time: '09:30', name: '오리엔테이션 및 팀 배정', dur: 60, ai: true },
    { time: '10:30', name: '커리큘럼 소개 및 목표 설정', dur: 45, ai: true },
    { time: '11:15', name: '주제 강의 1 — 문제 정의', dur: 90, ai: true },
    { time: '12:45', name: '중식', dur: 60, ai: true },
    { time: '13:45', name: '실습 워크숍', dur: 150, ai: true },
    { time: '16:15', name: '멘토 코칭 세션', dur: 90, ai: true },
    { time: '17:45', name: '일일 회고 및 과제 안내', dur: 45, ai: true },
  ],
  '데모데이·IR피칭': [
    { time: '13:00', name: '등록 및 리허설', dur: 60, ai: true },
    { time: '14:00', name: '개회 및 축사', dur: 30, ai: true },
    { time: '14:30', name: 'IR 피칭 1부', dur: 90, ai: true },
    { time: '16:00', name: '휴식 및 네트워킹', dur: 30, ai: true },
    { time: '16:30', name: 'IR 피칭 2부', dur: 90, ai: true },
    { time: '18:00', name: '심사 결과 발표 및 시상', dur: 40, ai: true },
    { time: '18:40', name: '투자자 네트워킹 리셉션', dur: 80, ai: true },
  ],
  '경진대회': [
    { time: '09:00', name: '참가자 등록 및 개회식', dur: 60, ai: true },
    { time: '10:00', name: '과제 공개 및 규정 안내', dur: 30, ai: true },
    { time: '10:30', name: '본선 경연 1부', dur: 150, ai: true },
    { time: '13:00', name: '중식', dur: 60, ai: true },
    { time: '14:00', name: '본선 경연 2부', dur: 150, ai: true },
    { time: '16:30', name: '심사 및 집계', dur: 60, ai: true },
    { time: '17:30', name: '시상식 및 폐회', dur: 60, ai: true },
  ],
  '네트워킹': [
    { time: '18:00', name: '등록 및 웰컴 드링크', dur: 30, ai: true },
    { time: '18:30', name: '오프닝 및 참가자 소개', dur: 30, ai: true },
    { time: '19:00', name: '라운드테이블 네트워킹 1부', dur: 60, ai: true },
    { time: '20:00', name: '스탠딩 디너', dur: 45, ai: true },
    { time: '20:45', name: '자유 네트워킹 2부', dur: 60, ai: true },
    { time: '21:45', name: '클로징 및 경품 추첨', dur: 15, ai: true },
  ],
  '포럼·컨퍼런스': [
    { time: '09:00', name: '등록 및 개회', dur: 60, ai: true },
    { time: '10:00', name: '기조연설', dur: 50, ai: true },
    { time: '10:50', name: '세션 1 — 주제 발표', dur: 80, ai: true },
    { time: '12:10', name: '오찬', dur: 80, ai: true },
    { time: '13:30', name: '세션 2 — 사례 발표', dur: 90, ai: true },
    { time: '15:00', name: '패널 토론', dur: 80, ai: true },
    { time: '16:20', name: '폐회 및 네트워킹', dur: 60, ai: true },
  ],
  '특강·세미나': [
    { time: '13:30', name: '등록 및 안내', dur: 30, ai: true },
    { time: '14:00', name: '개회 및 연사 소개', dur: 15, ai: true },
    { time: '14:15', name: '특강 1부', dur: 75, ai: true },
    { time: '15:30', name: '휴식', dur: 15, ai: true },
    { time: '15:45', name: '특강 2부', dur: 75, ai: true },
    { time: '17:00', name: '질의응답', dur: 30, ai: true },
    { time: '17:30', name: '폐회 및 개별 상담', dur: 30, ai: true },
  ],
  '박람회·전시': [
    { time: '09:00', name: '부스 최종 점검', dur: 60, ai: true },
    { time: '10:00', name: '개장 및 개막식', dur: 40, ai: true },
    { time: '10:40', name: '전시 관람 및 부스 운영', dur: 140, ai: true },
    { time: '13:00', name: '바이어 상담회', dur: 120, ai: true },
    { time: '15:00', name: '무대 이벤트 — 신제품 발표', dur: 60, ai: true },
    { time: '16:00', name: '전시 관람 2부', dur: 90, ai: true },
    { time: '17:30', name: '일일 결산 및 폐장', dur: 30, ai: true },
  ],
};

/** 행사 유형에 맞는 프로그램 초안 복사본 (없으면 해커톤 초안) */
export function programDraftFor(eventType: string): ProgramItem[] {
  const draft = PROGRAM_DRAFTS[eventType] ?? PROGRAM_DRAFTS['해커톤·아이디어톤'];
  return draft.map((p) => ({ ...p }));
}

export const EXTRACTED_FIELDS = [
  { label: '행사명', value: '2026 청년 창업 해커톤' },
  { label: '주관기관', value: '창업진흥원' },
  { label: '행사 유형', value: '해커톤·아이디어톤' },
  { label: '기간', value: '2026. 9. 12. ~ 9. 13.' },
  { label: '참가 규모', value: '300명' },
  { label: '예산 한도', value: '6,000만 원' },
];

export const UPLOADED_FORM = {
  name: '2026 청년 창업 해커톤',
  org: '창업진흥원',
  type: '해커톤·아이디어톤',
  start: '2026-09-12',
  end: '2026-09-13',
  region: '서울',
  scale: '300명',
  budget: '6,000만 원',
  purpose: '청년 예비 창업가의 아이디어 발굴과 초기 팀 빌딩을 지원하고, 우수 팀에 후속 사업화 기회를 연계한다.',
};

export const EVENT_TYPES = [
  '해커톤·아이디어톤', '부트캠프·창업캠프', '데모데이·IR피칭', '경진대회',
  '네트워킹', '포럼·컨퍼런스', '특강·세미나', '박람회·전시',
];

export const OP_MODES = ['오프라인', '온라인', '하이브리드'];

export const PEOPLE_DATA: Record<string, MatchPerson[]> = {
  '강사': [
    { name: '박서연', tags: 'AI 서비스 기획 · 창업 교육', summary: '스타트업 액셀러레이터 출신, 공공 해커톤 기조강연 32회.', fit: 94, rating: '4.9', region: '서울', c: '#0D3B8F', rate: 800000 },
    { name: '이준호', tags: '프로덕트 전략 · 린 스타트업', summary: '대기업 사내벤처 프로그램 총괄, 실습형 워크숍 전문.', fit: 89, rating: '4.8', region: '서울·경기', c: '#1463F3', rate: 600000 },
    { name: '최민아', tags: 'UX 리서치 · 디자인 씽킹', summary: '디자인 씽킹 퍼실리테이션 8년, 청년 대상 강의 다수.', fit: 85, rating: '4.7', region: '전국', c: '#26B8CE', rate: 480000 },
    { name: '정태윤', tags: '데이터 분석 · 그로스', summary: '공공데이터 활용 교육 파트너, 실전 데이터 커리큘럼 보유.', fit: 81, rating: '4.6', region: '대전', c: '#3A4358', rate: 480000 },
  ],
  '멘토': [
    { name: '한지원', tags: '초기 투자 · 사업화 전략', summary: 'VC 심사역 6년, 시드 단계 멘토링 140팀 이상.', fit: 92, rating: '4.9', region: '서울', c: '#0D3B8F', rate: 600000 },
    { name: '오세훈', tags: '기술 창업 · MVP 개발', summary: 'CTO 출신 기술 멘토, 해커톤 팀별 코칭 경험 풍부.', fit: 88, rating: '4.8', region: '서울·인천', c: '#1463F3', rate: 600000 },
    { name: '김다혜', tags: '마케팅 · 브랜딩', summary: '스타트업 CMO 출신, 피칭 스토리라인 코칭 전문.', fit: 84, rating: '4.7', region: '전국', c: '#26B8CE', rate: 480000 },
    { name: '유현석', tags: '법무 · 지식재산', summary: '창업 법률 자문 변호사, 공공사업 규정 검토 경험.', fit: 78, rating: '4.5', region: '서울', c: '#3A4358', rate: 480000 },
  ],
  '심사위원': [
    { name: '서정민', tags: '공공혁신 · 정책 평가', summary: '정부 R&D 과제 평가위원, 공정성 기준 수립 경험.', fit: 93, rating: '4.9', region: '세종·서울', c: '#0D3B8F', rate: 200000 },
    { name: '임수진', tags: '투자 심사 · IR 평가', summary: '액셀러레이터 파트너, 데모데이 심사 60회 이상.', fit: 87, rating: '4.8', region: '서울', c: '#1463F3', rate: 200000 },
    { name: '황보람', tags: '기술 평가 · 특허', summary: '기술보증기금 출신, 기술성 평가 전문.', fit: 82, rating: '4.6', region: '부산', c: '#26B8CE', rate: 200000 },
  ],
  '운영인력': [
    { name: '노아윤', tags: '행사 총괄 · 무대 운영', summary: '500명 규모 컨퍼런스 현장 총괄 12회, 안전 관리 자격 보유.', fit: 95, rating: '4.9', region: '서울·경기', c: '#0D3B8F', rate: 150000 },
    { name: '배성우', tags: '등록·안내 데스크', summary: '대형 박람회 등록 운영 리드, 다국어 응대 가능.', fit: 90, rating: '4.8', region: '서울', c: '#1463F3', rate: 150000 },
    { name: '문채린', tags: '영상·중계 오퍼레이터', summary: '하이브리드 행사 실시간 중계 운영 전문.', fit: 86, rating: '4.7', region: '전국', c: '#26B8CE', rate: 150000 },
    { name: '권도현', tags: '케이터링 · 물류', summary: '식음·물류 동선 설계, 공공 행사 정산 서류 경험.', fit: 80, rating: '4.6', region: '경기', c: '#3A4358', rate: 150000 },
  ],
};

export const DETAIL_ITEMS = [
  { item: '대관료 (메인홀)', cat: '장소·공간', qty: 2, unit: 1800000 },
  { item: '무대·음향 시스템', cat: '장비·시스템', qty: 1, unit: 4200000 },
  { item: '중식 케이터링', cat: '케이터링', qty: 300, unit: 18000 },
  { item: '현수막·배너 제작', cat: '인쇄·디자인', qty: 12, unit: 150000 },
  { item: '운영 인력 (일)', cat: '인력', qty: 16, unit: 180000 },
  { item: '기념품 키트', cat: '굿즈', qty: 300, unit: 22000 },
  { item: '온라인 중계 패키지', cat: '온라인', qty: 1, unit: 2600000 },
  { item: '행사 보험·안전 관리', cat: '안전', qty: 1, unit: 900000 },
];

export const INITIAL_MILESTONES: Milestone[] = [
  { title: '기획 확정', st: 'done', note: '통합 기획안 발주처 승인 완료. 세부 운영계획 확정.', file: '운영계획서_v2.pdf' },
  { title: '섭외·계약', st: 'done', note: '장소·강사·심사위원 계약 완료. 케이터링 업체 선정.', file: '계약현황표.xlsx' },
  { title: '홍보·참가자 모집', st: 'active', note: '모집 218/300명 진행 중. SNS 광고 2차 집행 중입니다.', file: '' },
  { title: '현장 준비·리허설', st: 'todo', note: '9. 10. 현장 셋업, 9. 11. 전체 리허설 예정.', file: '' },
  { title: '행사 운영', st: 'todo', note: '9. 12.–13. 본 행사 운영.', file: '' },
  { title: '정산·결과보고', st: 'todo', note: '행사 종료 후 14일 내 결과보고서·정산서 제출.', file: '' },
];

export interface TemplateDef {
  name: string;
  desc: string;
  stages: [string, string][];
}

export const TEMPLATE_DEFS: TemplateDef[] = [
  {
    name: '해커톤·경진대회',
    desc: '모집과 심사가 중심인 대회형 행사',
    stages: [
      ['기획 확정', '통합 기획안 발주처 승인 및 세부 운영계획 확정.'],
      ['섭외·계약', '장소·강사·심사위원 계약, 협력 업체 선정.'],
      ['홍보·참가자 모집', '모집 공고 게시, 참가 신청 접수 및 광고 집행.'],
      ['현장 준비·리허설', '현장 셋업, 장비 점검, 전체 리허설.'],
      ['행사 운영', '본 행사 진행 — 예선·본선·심사·시상.'],
      ['정산·결과보고', '결과보고서·정산서 작성 및 제출.'],
    ],
  },
  {
    name: '포럼·컨퍼런스',
    desc: '연사와 청중 등록이 중심인 강연형 행사',
    stages: [
      ['기획 확정', '프로그램·세션 구성 확정, 발주처 승인.'],
      ['연사 섭외', '기조연설·패널 연사 컨택 및 계약.'],
      ['등록·홍보', '사전 등록 오픈, 초청장 발송, 홍보 집행.'],
      ['현장 준비', '무대·음향·동시통역 셋업, 리허설.'],
      ['행사 운영', '본 행사 진행 — 세션 운영·네트워킹.'],
      ['정산·결과보고', '결과보고서·정산서 작성 및 제출.'],
    ],
  },
  {
    name: '부트캠프·교육',
    desc: '수 주간 커리큘럼으로 운영되는 교육형 프로그램',
    stages: [
      ['커리큘럼 확정', '교육 과정·평가 기준 확정, 발주처 승인.'],
      ['강사 계약', '주강사·멘토 계약 및 일정 확정.'],
      ['교육생 모집', '모집 공고, 선발 평가, 최종 합격자 발표.'],
      ['교육 운영', '주차별 교육 진행, 출결·과제 관리.'],
      ['수료·데모데이', '최종 발표회, 수료식, 우수팀 시상.'],
      ['정산·결과보고', '결과보고서·정산서 작성 및 제출.'],
    ],
  },
  {
    name: '박람회·전시',
    desc: '부스 시공과 참가사 관리가 중심인 전시형 행사',
    stages: [
      ['기획 확정', '전시 구성·부스 배치도 확정, 발주처 승인.'],
      ['부스·참가사 모집', '참가사 모집, 부스 배정, 계약 체결.'],
      ['시공·설치', '부스 시공, 전기·통신 설비, 안전 점검.'],
      ['행사 운영', '개장 운영, 관람객 안내, 참가사 지원.'],
      ['철거·원상복구', '부스 철거, 시설 원상복구, 반출 관리.'],
      ['정산·결과보고', '결과보고서·정산서 작성 및 제출.'],
    ],
  },
];

export const PROJ_STATUS_MAP: Record<string, [string, string, string]> = {
  draft: ['작성 중', '#EEF1F6', '#5A6478'],
  composing: ['프로그램 구성 중', '#E8F4F8', '#0C7A93'],
  matching: ['인력 매칭 중', '#DCF3F8', '#0C7A93'],
  quoted: ['견적 완료', '#E5F0FF', '#1463F3'],
  confirmed: ['확정', '#DBE7FF', '#0D3B8F'],
  in_progress: ['진행 중', '#1463F3', '#FFFFFF'],
  done: ['완료', '#071A3E', '#FFFFFF'],
};

export const PROJ_FILTERS = ['전체', '작성 중', '진행 중', '완료'];

/* ── 단계별 AI 지침 가이드 ─────────────────────────── */

/** 지침 작성 공통 요령 */
export const INSTRUCTION_TIPS = [
  '한 문장에 하나의 요청만 담아 주세요. 여러 요청은 줄을 바꿔 나열하면 반영 정확도가 올라갑니다.',
  '"많이", "적당히" 대신 숫자·날짜·이름을 구체적으로 적어 주세요.',
  '바꾸지 말아야 할 항목이 있다면 "○○은 그대로 유지"라고 명시해 주세요.',
];

/** 대상 단계별 지침 예시 — toStep2: 프로그램, toStep3: 비품, toStep4: 인력, toStep5: 견적 */
export const INSTRUCTION_EXAMPLES: Record<'toStep2' | 'toStep3' | 'toStep4' | 'toStep5', string[]> = {
  toStep2: [
    '지금 이 문서는 2025년 문서입니다. 2026년도에 맞게 작성해 주세요.',
    '점심 시간은 12시부터 1시간으로 고정하고, 네트워킹 세션을 마지막에 넣어 주세요.',
    '개회식은 30분 이내로 짧게, 멘토링 시간을 2시간 이상 확보해 주세요.',
  ],
  toStep3: [
    '홍보물 비중을 줄이고 전문가 섭외 비중을 늘려 주세요.',
    '케이터링은 참가 인원의 80% 기준으로 잡아 주세요.',
    '무대·음향 장비는 최소 구성으로 잡아 주세요.',
  ],
  toStep4: [
    '멘토링 경험이 많은 인력을 우선 추천해 주세요.',
    'AI·데이터 분야 전문가 위주로 구성해 주세요.',
    '행사 개최 지역에서 활동 가능한 인력을 우선해 주세요.',
  ],
  toStep5: [
    'Premium 옵션도 예산 한도를 넘지 않게 구성해 주세요.',
    '예비비 5%를 고려해 수량을 보수적으로 잡아 주세요.',
    '홍보물 수량은 그대로 유지해 주세요.',
  ],
};

export const ADMIN_MENU = ['사용자 관리', '고객문의', '레이트카드', '인력풀', '케이스 데이터', '진행현황 관리', '견적 파라미터'];

export const RATE_CATEGORIES = [
  '장소·공간', '케이터링·다과', '인쇄·디자인', '장비·시스템', '인력',
  '마케팅·홍보', '기념품·굿즈', '운영·행정', '안전·보험',
];

/** 레이트카드 — 실측 견적(건국대 IR 피칭 2026-08 · 아산 CEO아카데미 2026-07) + 시장조사 단가 + 인건비는 전문가활용기준표(강사료·자문료 등 기준) 적용. dumy_data/rate_cards.json과 동일 원천 */
export const INITIAL_RATE_LIST: RateItem[] = [
  { name: '키비주얼 제작 및 디자인', cat: '인쇄·디자인', unit: '식', price: 1000000, margin: 10, active: true },
  { name: '홍보용 포스터 제작 및 SNS 홍보', cat: '마케팅·홍보', unit: '회', price: 500000, margin: 10, active: true },
  { name: '리플렛 제작', cat: '인쇄·디자인', unit: '개', price: 10000, margin: 10, active: true },
  { name: '행사용 백그라운드 화면 제작', cat: '인쇄·디자인', unit: '식', price: 500000, margin: 10, active: true },
  { name: '현수막', cat: '인쇄·디자인', unit: '개', price: 120000, margin: 10, active: true },
  { name: '배너', cat: '인쇄·디자인', unit: '개', price: 80000, margin: 10, active: true },
  { name: '포디움 타이틀', cat: '인쇄·디자인', unit: '개', price: 25000, margin: 10, active: true },
  { name: '참가기업 A0 현황판(제작 및 수정)', cat: '인쇄·디자인', unit: '개', price: 100000, margin: 10, active: true },
  { name: '기념품', cat: '기념품·굿즈', unit: '개', price: 20000, margin: 10, active: true },
  { name: '명찰', cat: '인쇄·디자인', unit: '개', price: 2500, margin: 10, active: true },
  { name: '시상식 폼보드', cat: '인쇄·디자인', unit: '개', price: 30000, margin: 10, active: true },
  { name: '포토존 설치', cat: '장비·시스템', unit: '식', price: 2000000, margin: 10, active: true },
  { name: '스카시', cat: '장비·시스템', unit: '개', price: 1300000, margin: 10, active: true },
  { name: '무대 임대', cat: '장비·시스템', unit: '식', price: 3000000, margin: 10, active: true },
  { name: '프린터 임대 및 로비 구성비 및 명찰 제작 시스템', cat: '장비·시스템', unit: '식', price: 500000, margin: 10, active: true },
  { name: '영상 스위칭 시스템', cat: '장비·시스템', unit: '식', price: 1000000, margin: 10, active: true },
  { name: '음향 시스템', cat: '장비·시스템', unit: '식', price: 1000000, margin: 10, active: true },
  { name: '사무용 비품 구입비', cat: '운영·행정', unit: '식', price: 300000, margin: 10, active: true },
  { name: '촬영·기록 장비 및 촬영기사', cat: '장비·시스템', unit: '식', price: 500000, margin: 10, active: true },
  { name: '스케치영상 제작', cat: '마케팅·홍보', unit: '회', price: 1500000, margin: 10, active: true },
  { name: '케이터링', cat: '케이터링·다과', unit: '인', price: 20000, margin: 10, active: true },
  { name: '아나운서', cat: '인력', unit: '명', price: 800000, margin: 10, active: true },
  { name: 'PM', cat: '인력', unit: '인·일', price: 200000, margin: 10, active: true },
  { name: '운영요원', cat: '인력', unit: '인·일', price: 150000, margin: 10, active: true },
  { name: '다과 및 푸드(석식)', cat: '케이터링·다과', unit: '회', price: 1000000, margin: 6, active: true },
  { name: '디자인 비용(메인 키비주얼)', cat: '인쇄·디자인', unit: '식', price: 1500000, margin: 6, active: true },
  { name: '인쇄비', cat: '인쇄·디자인', unit: '식', price: 3400000, margin: 6, active: true },
  { name: '운영인건비', cat: '인력', unit: '개월', price: 2000000, margin: 6, active: true },
  { name: '교재 및 워크시트 제작', cat: '인쇄·디자인', unit: '식', price: 660000, margin: 6, active: true },
  { name: '대관료(교육장)', cat: '장소·공간', unit: '일', price: 800000, margin: 6, active: true },
  { name: '숙박', cat: '장소·공간', unit: '박', price: 150000, margin: 6, active: true },
  { name: '다과', cat: '케이터링·다과', unit: '인·일', price: 5000, margin: 6, active: true },
  { name: '식대', cat: '케이터링·다과', unit: '식', price: 20000, margin: 6, active: true },
  { name: '여행자보험·안전관리비', cat: '안전·보험', unit: '인', price: 18000, margin: 6, active: true },
  { name: 'AX Discovery 2급 과정', cat: '운영·행정', unit: '인', price: 600000, margin: 6, active: true },
  { name: '버스 임차 및 운행 제반경비(45인승)', cat: '운영·행정', unit: '회', price: 1475977, margin: 6, active: true },
  { name: '버스 임차 및 운행 제반경비(25인승)', cat: '운영·행정', unit: '회', price: 867318, margin: 6, active: true },
  { name: '인건비(현장 운영)', cat: '인력', unit: '인·일', price: 100000, margin: 6, active: true },
  { name: '강사료·자문료(1급 기관장·저명인사)', cat: '인력', unit: '시간', price: 200000, margin: 10, active: true },
  { name: '강사료·자문료(2급 책임급)', cat: '인력', unit: '시간', price: 150000, margin: 10, active: true },
  { name: '강사료·자문료(3급 선임급)', cat: '인력', unit: '시간', price: 120000, margin: 10, active: true },
  { name: '강사료·자문료(4급 원급·내부강사)', cat: '인력', unit: '시간', price: 100000, margin: 10, active: true },
  { name: '원고료', cat: '인력', unit: '매', price: 20000, margin: 10, active: true },
  { name: '번역료(한국어↔외국어)', cat: '인력', unit: '매', price: 50000, margin: 10, active: true },
  { name: '수행통역', cat: '인력', unit: '인·일', price: 300000, margin: 10, active: true },
  { name: '국제회의 통역', cat: '인력', unit: '인·일', price: 300000, margin: 10, active: true },
  { name: '위원수당(외부위원)', cat: '인력', unit: '인·일', price: 200000, margin: 10, active: true },
  { name: '세미나실 대관(100~200인)', cat: '장소·공간', unit: '일', price: 1500000, margin: 10, active: true },
  { name: '컨벤션홀 대관(300~500인)', cat: '장소·공간', unit: '일', price: 3500000, margin: 10, active: true },
  { name: 'LED 스크린 임대(200인치)', cat: '장비·시스템', unit: '일', price: 1500000, margin: 10, active: true },
  { name: '동시통역 부스·장비', cat: '장비·시스템', unit: '식', price: 700000, margin: 10, active: true },
  { name: '온라인 생중계(유튜브 라이브)', cat: '온라인·플랫폼', unit: '회', price: 1000000, margin: 10, active: true },
  { name: '하이브리드 웨비나 운영', cat: '온라인·플랫폼', unit: '회', price: 500000, margin: 10, active: true },
  { name: '행사배상책임보험', cat: '안전·보험', unit: '인', price: 2000, margin: 10, active: true },
  { name: '행사장 안전관리 요원', cat: '안전·보험', unit: '인·일', price: 150000, margin: 10, active: true },
  { name: '커피브레이크 세트', cat: '케이터링·다과', unit: '인', price: 10000, margin: 10, active: true },
  { name: '출장 뷔페', cat: '케이터링·다과', unit: '인', price: 30000, margin: 10, active: true },
];

export const INITIAL_POOL_LIST: PoolPerson[] = [
  { name: '박서연', role: '강사', field: 'AI 서비스 기획 · 창업 교육', region: '서울', rating: 4.9, count: 32, active: true },
  { name: '이준호', role: '강사', field: '프로덕트 전략 · 린 스타트업', region: '서울·경기', rating: 4.8, count: 21, active: true },
  { name: '한지원', role: '멘토', field: '초기 투자 · 사업화 전략', region: '서울', rating: 4.9, count: 140, active: true },
  { name: '오세훈', role: '멘토', field: '기술 창업 · MVP 개발', region: '서울·인천', rating: 4.8, count: 87, active: true },
  { name: '서정민', role: '심사위원', field: '공공혁신 · 정책 평가', region: '세종·서울', rating: 4.9, count: 45, active: true },
  { name: '임수진', role: '심사위원', field: '투자 심사 · IR 평가', region: '서울', rating: 4.8, count: 60, active: false },
  { name: '노아윤', role: '운영인력', field: '행사 총괄 · 무대 운영', region: '서울·경기', rating: 4.9, count: 12, active: true },
  { name: '배성우', role: '운영인력', field: '등록·안내 데스크', region: '서울', rating: 4.8, count: 28, active: true },
];

export const CASE_ROWS = [
  { name: '2025 산학협력 네트워킹 데이', type: '네트워킹', scale: '250명', budget: '4,200만 원', year: '2025', org: '한국산업기술진흥원' },
  { name: '제4회 공공데이터 해커톤', type: '해커톤', scale: '320명', budget: '7,800만 원', year: '2025', org: '행정안전부' },
  { name: '청년정책 아이디어톤', type: '해커톤', scale: '180명', budget: '3,500만 원', year: '2025', org: '서울특별시' },
  { name: '스타트업 IR 데모데이 vol.7', type: '데모데이', scale: '400명', budget: '9,100만 원', year: '2024', org: '창업진흥원' },
  { name: '디지털 헬스케어 포럼', type: '포럼·컨퍼런스', scale: '500명', budget: '1억 2,000만 원', year: '2024', org: '보건산업진흥원' },
  { name: 'AI 융합 부트캠프 2기', type: '부트캠프', scale: '80명', budget: '2억 4,000만 원', year: '2024', org: '정보통신산업진흥원' },
  { name: '중소기업 수출 박람회', type: '박람회·전시', scale: '3,000명', budget: '3억 8,000만 원', year: '2024', org: '중소벤처기업부' },
];

/** 랜딩 운영 사례 섹션 — caseData 80건 중 유형별 대표 사례 발췌 (비로그인 노출용 정적 큐레이션) */
export const SHOWCASE_CASES = [
  { type: '포럼·컨퍼런스', name: '2026 포럼 데이', org: 'OO디자인진흥원', scale: 500, rating: 4.8, outcome: '언론 노출 12건, SNS 도달 5만 회 이상' },
  { type: '해커톤·아이디어톤', name: '2026 해커톤 데이', org: 'OO문화재단', scale: 50, rating: 4.9, outcome: '예산 대비 3% 절감하여 종료' },
  { type: '부트캠프·창업캠프', name: '2026 부트캠프 페스타', org: 'OO청년정책네트워크', scale: 500, rating: 4.7, outcome: '후속 창업·투자 연계 3건 발생' },
  { type: '네트워킹', name: '2026 네트워킹 데이', org: 'OO대학교 산학협력단', scale: 500, rating: 4.8, outcome: '예산 대비 3% 절감하여 종료' },
  { type: '특강·세미나', name: '2026 특강 캠프', org: 'OO창조경제혁신센터', scale: 300, rating: 4.8, outcome: '목표 참가 인원 대비 105% 달성' },
  { type: '박람회·전시', name: '2026 박람회 페스타', org: 'OO여성기업종합지원센터', scale: 300, rating: 4.8, outcome: '언론 노출 12건, SNS 도달 5만 회 이상' },
];

/** 랜딩 서비스 소개 섹션 — 실제 구현된 3대 가치 */
export const ABOUT_FEATURES = [
  {
    title: 'AI 과업지시서 분석',
    desc: 'PDF·DOCX·HWPX 과업지시서를 올리면 행사명·기간·규모·예산을 AI가 자동으로 추출해 입력란을 채웁니다. 신뢰도가 낮은 항목은 검토 표시로 알려드려요.',
    icon: 'doc',
  },
  {
    title: '표준 레이트카드 견적',
    desc: '실제 수행 견적과 시장조사 단가를 기준으로 Basic·Standard·Premium 3가지 예산 옵션을 실시간 산출하고, 예산 한도에 맞춰 구성을 자동 조정합니다.',
    icon: 'calc',
  },
  {
    title: '발주처 공유·실시간 진행',
    desc: '링크 하나로 기획안·견적서를 발주처와 공유하고, 진행 단계는 대시보드로 실시간 확인됩니다. 견적서는 PDF로 바로 내려받을 수 있어요.',
    icon: 'share',
  },
];

export const PR_STAFF_DEFAULT: [string, number][] = [
  ['강사', 2], ['멘토', 4], ['심사위원', 3], ['운영인력', 16],
];
