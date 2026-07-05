/**
 * INNOWAVE 마스터 데이터 시드 — rateCards, personnelPool, caseData, quoteParams
 * Admin SDK로 rules 우회. 실행: npm run seed
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'innowave-platform';

function initAdmin() {
  const saPath = resolve(process.cwd(), 'service-account.json');
  if (existsSync(saPath)) {
    const sa = JSON.parse(readFileSync(saPath, 'utf8'));
    initializeApp({ credential: cert(sa), projectId: PROJECT_ID });
    return;
  }
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

initAdmin();
const db = getFirestore();
const now = FieldValue.serverTimestamp();

const rateCards = [
  { id: 'rc-venue-main', category: '장소', subcategory: '대관', itemName: '컨벤션홀 메인홀', spec: '500석', unit: '일', unitPrice: 2500000, marginRate: 15, regionVariable: true, supplierType: '외주' },
  { id: 'rc-venue-sub', category: '장소', subcategory: '대관', itemName: '세미나룸 A', spec: '80석', unit: '일', unitPrice: 450000, marginRate: 15, regionVariable: true, supplierType: '외주' },
  { id: 'rc-av-led', category: '장비', subcategory: '영상', itemName: 'LED 월 설치', spec: 'P2.5 6x3m', unit: '일', unitPrice: 800000, marginRate: 20, regionVariable: false, supplierType: '외주' },
  { id: 'rc-av-sound', category: '장비', subcategory: '음향', itemName: '음향 시스템', spec: '500인 기준', unit: '일', unitPrice: 350000, marginRate: 18, regionVariable: false, supplierType: '외주' },
  { id: 'rc-av-live', category: '장비', subcategory: '영상', itemName: '라이브 스트리밍', spec: '2채널 HD', unit: '일', unitPrice: 600000, marginRate: 20, regionVariable: false, supplierType: '외주' },
  { id: 'rc-staff-mc', category: '인력', subcategory: '운영', itemName: '사회자(MC)', spec: '4시간', unit: '인', unitPrice: 500000, marginRate: 25, regionVariable: false, supplierType: '자체' },
  { id: 'rc-staff-ops', category: '인력', subcategory: '운영', itemName: '현장 운영 스태프', spec: '8시간', unit: '인', unitPrice: 180000, marginRate: 20, regionVariable: false, supplierType: '자체' },
  { id: 'rc-staff-photo', category: '인력', subcategory: '기록', itemName: '행사 촬영', spec: '풀데이', unit: '인', unitPrice: 400000, marginRate: 20, regionVariable: false, supplierType: '외주' },
  { id: 'rc-catering-coffee', category: '케이터링', subcategory: '다과', itemName: '커피브레이크', spec: '100인 기준', unit: '회', unitPrice: 150000, marginRate: 15, regionVariable: true, supplierType: '외주' },
  { id: 'rc-catering-lunch', category: '케이터링', subcategory: '식사', itemName: '도시락/뷔페', spec: '100인 기준', unit: '회', unitPrice: 800000, marginRate: 12, regionVariable: true, supplierType: '외주' },
  { id: 'rc-design-banner', category: '디자인', subcategory: '인쇄물', itemName: '현수막/배너', spec: 'A0 5종', unit: '세트', unitPrice: 200000, marginRate: 30, regionVariable: false, supplierType: '외주' },
  { id: 'rc-design-kit', category: '디자인', subcategory: '브랜딩', itemName: '행사 키트 디자인', spec: '로고+CI', unit: '건', unitPrice: 1500000, marginRate: 35, regionVariable: false, supplierType: '자체' },
  { id: 'rc-program-workshop', category: '프로그램', subcategory: '워크숍', itemName: '아이디어 워크숍', spec: '2시간', unit: '회', unitPrice: 300000, marginRate: 25, regionVariable: false, supplierType: '자체' },
  { id: 'rc-program-pitch', category: '프로그램', subcategory: '피칭', itemName: 'IR 피칭 세션', spec: '10팀', unit: '회', unitPrice: 500000, marginRate: 25, regionVariable: false, supplierType: '자체' },
  { id: 'rc-transport-shuttle', category: '운송', subcategory: '셔틀', itemName: '셔틀버스', spec: '45인승 왕복', unit: '대', unitPrice: 350000, marginRate: 10, regionVariable: true, supplierType: '외주' },
];

const personnelPool = [
  { id: 'p-lect-01', name: '김민수', role: '강사', expertiseField: '스타트업/창업', affiliation: '서울창업허브', careerYears: 12, careerSummary: '전 스타트업 CEO, 액셀러레이터 멘토 50회+', eventExperienceCount: 45, rating: 4.8, activityRegion: '서울', availableType: '온오프라인', unitRate: 800000 },
  { id: 'p-lect-02', name: '이지현', role: '강사', expertiseField: 'AI/데이터', affiliation: 'KAIST', careerYears: 15, careerSummary: 'AI 스타트업 공동창업, 해커톤 멘토 다수', eventExperienceCount: 38, rating: 4.9, activityRegion: '전국', availableType: '온오프라인', unitRate: 1000000 },
  { id: 'p-ment-01', name: '박준영', role: '멘토', expertiseField: 'B2B SaaS', affiliation: '전 네이버 PM', careerYears: 10, careerSummary: 'SaaS PM 8년, 엑셀러레이팅 멘토', eventExperienceCount: 28, rating: 4.7, activityRegion: '서울', availableType: '온라인', unitRate: 500000 },
  { id: 'p-ment-02', name: '최서연', role: '멘토', expertiseField: '마케팅/GTM', affiliation: '마케팅 컨설턴트', careerYears: 8, careerSummary: '스타트업 GTM 전략, 30+ 멘토링', eventExperienceCount: 22, rating: 4.6, activityRegion: '전국', availableType: '온오프라인', unitRate: 400000 },
  { id: 'p-judge-01', name: '정대호', role: '심사위원', expertiseField: 'VC/투자', affiliation: '○○벤처스 파트너', careerYears: 18, careerSummary: 'VC 심사 100회+, 데모데이 패널 다수', eventExperienceCount: 55, rating: 4.9, activityRegion: '서울', availableType: '오프라인', unitRate: 600000 },
  { id: 'p-judge-02', name: '한소희', role: '심사위원', expertiseField: '공공혁신', affiliation: '행정안전부 자문위원', careerYears: 20, careerSummary: '공공 창업 경진대회 심사 40회+', eventExperienceCount: 40, rating: 4.8, activityRegion: '전국', availableType: '오프라인', unitRate: 700000 },
  { id: 'p-staff-01', name: '윤태민', role: '운영인력', expertiseField: '행사 운영', affiliation: 'INNOWAVE 파트너', careerYears: 6, careerSummary: 'MICE 행사 현장 PM 30건+', eventExperienceCount: 30, rating: 4.5, activityRegion: '서울', availableType: '오프라인', unitRate: 250000 },
  { id: 'p-staff-02', name: '강예린', role: '운영인력', expertiseField: '등록/안내', affiliation: '프리랜서', careerYears: 4, careerSummary: '대형 컨퍼런스 등록 데스크 운영', eventExperienceCount: 18, rating: 4.4, activityRegion: '경기', availableType: '오프라인', unitRate: 180000 },
  { id: 'p-lect-03', name: '오현석', role: '강사', expertiseField: '핀테크', affiliation: '금융공학 박사', careerYears: 14, careerSummary: '핀테크 해커톤 강의 20회+', eventExperienceCount: 20, rating: 4.7, activityRegion: '서울', availableType: '온라인', unitRate: 900000 },
  { id: 'p-ment-03', name: '송미래', role: '멘토', expertiseField: 'UX/디자인', affiliation: '디자인 스튜디오 대표', careerYears: 9, careerSummary: '해커톤 UX 멘토, 프로토타이핑 코치', eventExperienceCount: 25, rating: 4.8, activityRegion: '전국', availableType: '온오프라인', unitRate: 450000 },
];

const caseData = [
  {
    id: 'case-01',
    eventName: '2025 서울 스타트업 해커톤',
    eventType: '해커톤·아이디어톤',
    organizer: '서울시 경제진흥과',
    periodStart: '2025-06-15',
    periodEnd: '2025-06-17',
    region: '서울',
    operationType: '오프라인',
    participantScale: 200,
    budgetTotal: 45000000,
    programSummary: '2박3일 해커톤, 멘토링 4회, IR 피칭, 시상식',
    personnelUsed: '강사 3, 멘토 8, 심사위원 5, 운영 12',
    outcomeSummary: '참가팀 40팀, 수상 6팀, 만족도 4.6/5',
    satisfactionScore: 4.6,
  },
  {
    id: 'case-02',
    eventName: '청년 창업 부트캠프 4기',
    eventType: '부트캠프·창업캠프',
    organizer: '중소벤처기업부',
    periodStart: '2025-03-01',
    periodEnd: '2025-05-31',
    region: '전국',
    operationType: '온오프라인',
    participantScale: 50,
    budgetTotal: 120000000,
    programSummary: '12주 부트캠프, 주 2회 멘토링, 데모데이',
    personnelUsed: '강사 5, 멘토 10, 심사위원 3',
    outcomeSummary: '수료 42명, 투자 유치 8팀',
    satisfactionScore: 4.8,
  },
  {
    id: 'case-03',
    eventName: '공공혁신 아이디어톤',
    eventType: '해커톤·아이디어톤',
    organizer: '행정안전부',
    periodStart: '2024-11-20',
    periodEnd: '2024-11-21',
    region: '세종',
    operationType: '오프라인',
    participantScale: 120,
    budgetTotal: 28000000,
    programSummary: '1박2일, 공공데이터 활용 과제, 시상',
    personnelUsed: '강사 2, 멘토 6, 심사위원 4, 운영 8',
    outcomeSummary: '아이디어 24건, 우수상 3건 채택',
    satisfactionScore: 4.5,
  },
  {
    id: 'case-04',
    eventName: '지역 스타트업 데모데이',
    eventType: '데모데이·IR피칭',
    organizer: '경기도경제과학진흥원',
    periodStart: '2025-09-10',
    periodEnd: '2025-09-10',
    region: '경기',
    operationType: '오프라인',
    participantScale: 300,
    budgetTotal: 35000000,
    programSummary: 'IR 피칭 15팀, VC 패널, 네트워킹',
    personnelUsed: '심사위원 5, 운영 6',
    outcomeSummary: '투자 관심 LOI 4건',
    satisfactionScore: 4.7,
  },
  {
    id: 'case-05',
    eventName: '대학 연합 창업 경진대회',
    eventType: '경진대회',
    organizer: '한국대학창업협회',
    periodStart: '2025-04-05',
    periodEnd: '2025-04-06',
    region: '대전',
    operationType: '오프라인',
    participantScale: 150,
    budgetTotal: 22000000,
    programSummary: '예선 서류+본선 피칭, 시상 5개 부문',
    personnelUsed: '심사위원 7, 운영 5',
    outcomeSummary: '참가 45팀, 대상 1팀 액셀러레이터 연계',
    satisfactionScore: 4.4,
  },
];

const quoteParams = [
  { id: 'qp-default-margin', key: 'default_margin', value: 20 },
  { id: 'qp-vat-rate', key: 'vat_rate', value: 0.1 },
  {
    id: 'qp-option-multipliers',
    key: 'option_multipliers',
    value: { basic: 0.8, standard: 1.0, premium: 1.3 },
  },
];

async function seedCollection(collection, items, extra = {}) {
  const batch = db.batch();
  for (const { id, ...data } of items) {
    batch.set(db.collection(collection).doc(id), {
      ...data,
      isActive: data.isActive ?? true,
      ...extra,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  console.log(`✅ ${collection}: ${items.length}건`);
}

async function main() {
  console.log(`🌱 Seeding ${PROJECT_ID}...`);
  await seedCollection('rateCards', rateCards);
  await seedCollection('personnelPool', personnelPool);
  await seedCollection('caseData', caseData);
  const qpBatch = db.batch();
  for (const { id, ...data } of quoteParams) {
    qpBatch.set(db.collection('quoteParams').doc(id), {
      ...data,
      updatedAt: now,
      updatedBy: 'seed-script',
    });
  }
  await qpBatch.commit();
  console.log(`✅ quoteParams: ${quoteParams.length}건`);
  console.log('🎉 시드 완료');
}

main().catch((err) => {
  console.error('❌ 시드 실패:', err.message);
  process.exit(1);
});
