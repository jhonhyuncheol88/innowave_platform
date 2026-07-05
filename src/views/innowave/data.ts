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
    { name: '박서연', tags: 'AI 서비스 기획 · 창업 교육', summary: '스타트업 액셀러레이터 출신, 공공 해커톤 기조강연 32회.', fit: 94, rating: '4.9', region: '서울', c: '#0D3B8F' },
    { name: '이준호', tags: '프로덕트 전략 · 린 스타트업', summary: '대기업 사내벤처 프로그램 총괄, 실습형 워크숍 전문.', fit: 89, rating: '4.8', region: '서울·경기', c: '#1463F3' },
    { name: '최민아', tags: 'UX 리서치 · 디자인 씽킹', summary: '디자인 씽킹 퍼실리테이션 8년, 청년 대상 강의 다수.', fit: 85, rating: '4.7', region: '전국', c: '#26B8CE' },
    { name: '정태윤', tags: '데이터 분석 · 그로스', summary: '공공데이터 활용 교육 파트너, 실전 데이터 커리큘럼 보유.', fit: 81, rating: '4.6', region: '대전', c: '#3A4358' },
  ],
  '멘토': [
    { name: '한지원', tags: '초기 투자 · 사업화 전략', summary: 'VC 심사역 6년, 시드 단계 멘토링 140팀 이상.', fit: 92, rating: '4.9', region: '서울', c: '#0D3B8F' },
    { name: '오세훈', tags: '기술 창업 · MVP 개발', summary: 'CTO 출신 기술 멘토, 해커톤 팀별 코칭 경험 풍부.', fit: 88, rating: '4.8', region: '서울·인천', c: '#1463F3' },
    { name: '김다혜', tags: '마케팅 · 브랜딩', summary: '스타트업 CMO 출신, 피칭 스토리라인 코칭 전문.', fit: 84, rating: '4.7', region: '전국', c: '#26B8CE' },
    { name: '유현석', tags: '법무 · 지식재산', summary: '창업 법률 자문 변호사, 공공사업 규정 검토 경험.', fit: 78, rating: '4.5', region: '서울', c: '#3A4358' },
  ],
  '심사위원': [
    { name: '서정민', tags: '공공혁신 · 정책 평가', summary: '정부 R&D 과제 평가위원, 공정성 기준 수립 경험.', fit: 93, rating: '4.9', region: '세종·서울', c: '#0D3B8F' },
    { name: '임수진', tags: '투자 심사 · IR 평가', summary: '액셀러레이터 파트너, 데모데이 심사 60회 이상.', fit: 87, rating: '4.8', region: '서울', c: '#1463F3' },
    { name: '황보람', tags: '기술 평가 · 특허', summary: '기술보증기금 출신, 기술성 평가 전문.', fit: 82, rating: '4.6', region: '부산', c: '#26B8CE' },
  ],
  '운영인력': [
    { name: '노아윤', tags: '행사 총괄 · 무대 운영', summary: '500명 규모 컨퍼런스 현장 총괄 12회, 안전 관리 자격 보유.', fit: 95, rating: '4.9', region: '서울·경기', c: '#0D3B8F' },
    { name: '배성우', tags: '등록·안내 데스크', summary: '대형 박람회 등록 운영 리드, 다국어 응대 가능.', fit: 90, rating: '4.8', region: '서울', c: '#1463F3' },
    { name: '문채린', tags: '영상·중계 오퍼레이터', summary: '하이브리드 행사 실시간 중계 운영 전문.', fit: 86, rating: '4.7', region: '전국', c: '#26B8CE' },
    { name: '권도현', tags: '케이터링 · 물류', summary: '식음·물류 동선 설계, 공공 행사 정산 서류 경험.', fit: 80, rating: '4.6', region: '경기', c: '#3A4358' },
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

export const PROJ_DATA = [
  { name: '2026 청년 창업 해커톤', type: '해커톤', st: 'in_progress', prog: 62, updated: '2026. 7. 3.' },
  { name: '지역혁신 데모데이 IR 피칭', type: '데모데이', st: 'quoted', prog: 0, updated: '2026. 7. 1.' },
  { name: '스마트시티 포럼 2026', type: '포럼·컨퍼런스', st: 'matching', prog: 0, updated: '2026. 6. 28.' },
  { name: '글로벌 창업 부트캠프 3기', type: '부트캠프', st: 'confirmed', prog: 0, updated: '2026. 6. 24.' },
  { name: '공공데이터 활용 경진대회', type: '경진대회', st: 'draft', prog: 0, updated: '2026. 6. 19.' },
  { name: '2025 산학협력 네트워킹 데이', type: '네트워킹', st: 'done', prog: 100, updated: '2025. 12. 12.' },
];

export const PROJ_FILTERS = ['전체', '작성 중', '진행 중', '완료'];

export const ADMIN_MENU = ['사용자 관리', '고객문의', '레이트카드', '인력풀', '케이스 데이터', '진행현황 관리', '견적 파라미터'];

export const RATE_CATEGORIES = [
  '장소·공간', '케이터링', '인쇄·디자인', '장비·시스템', '인력',
  '마케팅', '굿즈', '운영', '안전', '온라인',
];

export const INITIAL_RATE_LIST: RateItem[] = [
  { name: '대관료 (메인홀, 500석)', cat: '장소·공간', unit: '일', price: 1800000, margin: 10, active: true },
  { name: '대관료 (세미나실)', cat: '장소·공간', unit: '일', price: 450000, margin: 10, active: true },
  { name: '중식 도시락 (프리미엄)', cat: '케이터링', unit: '인', price: 18000, margin: 12, active: true },
  { name: '커피 브레이크 세트', cat: '케이터링', unit: '인', price: 6500, margin: 12, active: true },
  { name: '현수막 (대형)', cat: '인쇄·디자인', unit: '개', price: 150000, margin: 15, active: true },
  { name: '리플렛 (4p, 풀컬러)', cat: '인쇄·디자인', unit: '부', price: 1200, margin: 15, active: true },
  { name: '무대·음향 기본 패키지', cat: '장비·시스템', unit: '식', price: 4200000, margin: 10, active: true },
  { name: 'LED 스크린 (P3)', cat: '장비·시스템', unit: '㎡', price: 90000, margin: 10, active: false },
  { name: '행사 운영 요원', cat: '인력', unit: '인/일', price: 180000, margin: 8, active: true },
  { name: '동시통역사 (영어)', cat: '인력', unit: '인/일', price: 900000, margin: 8, active: true },
  { name: 'SNS 광고 집행', cat: '마케팅', unit: '식', price: 1500000, margin: 12, active: true },
  { name: '기념품 키트 (기본)', cat: '굿즈', unit: '개', price: 22000, margin: 15, active: true },
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

export const PR_STAFF_DEFAULT: [string, number][] = [
  ['강사', 2], ['멘토', 4], ['심사위원', 3], ['운영인력', 16],
];
