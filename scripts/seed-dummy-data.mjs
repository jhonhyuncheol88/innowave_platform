/**
 * dumy_data/*.json → Firestore 시드
 * 실행: npm run seed
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'innowave-platform';
const DATA_DIR = resolve(__dirname, '../dumy_data');
const DEMO_OWNER_UID = 'seed-demo-owner';
const DEMO_CLIENT_ORG = 'org-demo-client';

function initAdmin() {
  const saPath = resolve(process.cwd(), 'service-account.json');
  if (existsSync(saPath)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID });
    return;
  }
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

function loadJson(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8'));
}

function parseTs(value) {
  if (!value) return FieldValue.serverTimestamp();
  return Timestamp.fromDate(new Date(value.replace(' ', 'T') + '+09:00'));
}

function mapRateCard(row) {
  return {
    category: row.category,
    subcategory: row.subcategory,
    itemName: row.item_name,
    spec: row.spec,
    unit: row.unit,
    unitPrice: row.unit_price,
    marginRate: row.margin_rate,
    regionVariable: Boolean(row.region_variable),
    supplierType: row.supplier_type,
    isActive: Boolean(row.is_active),
    notes: row.notes || '',
    createdAt: parseTs(row.created_at),
    updatedAt: parseTs(row.updated_at),
  };
}

function mapPersonnel(row) {
  return {
    name: row.name,
    role: row.role,
    expertiseField: row.expertise_field,
    affiliation: row.affiliation || '',
    careerYears: row.career_years,
    careerSummary: row.career_summary,
    eventExperienceCount: row.event_experience_count,
    rating: row.rating,
    activityRegion: row.activity_region,
    availableType: row.available_type,
    unitRate: row.unit_rate,
    contactEmail: row.contact_email,
    isActive: Boolean(row.is_active),
    createdAt: parseTs(row.created_at),
    updatedAt: parseTs(row.created_at),
  };
}

function mapCaseData(row) {
  let personnelUsed = row.personnel_used_json;
  if (typeof personnelUsed === 'string') {
    try { personnelUsed = JSON.stringify(JSON.parse(personnelUsed)); } catch { /* keep string */ }
  }
  return {
    eventName: row.event_name,
    eventType: row.event_type,
    organizer: row.organizer,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    region: row.region,
    operationType: row.operation_type,
    participantScale: row.participant_scale ?? 0,
    budgetTotal: row.budget_total,
    programSummary: row.program_summary,
    personnelUsed,
    outcomeSummary: row.outcome_summary,
    satisfactionScore: row.satisfaction_score,
    createdAt: parseTs(row.created_at),
    updatedAt: parseTs(row.created_at),
  };
}

async function commitBatches(db, writes) {
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = db.batch();
    for (const { ref, data, delete: del } of writes.slice(i, i + CHUNK)) {
      if (del) batch.delete(ref);
      else batch.set(ref, data, { merge: false });
    }
    await batch.commit();
  }
}

async function main() {
  initAdmin();
  const db = getFirestore();
  const writes = [];

  console.log('📂 dumy_data 로드 중...');
  const rateCards = loadJson('rate_cards.json');
  const personnelPool = loadJson('personnel_pool.json');
  const caseData = loadJson('case_data.json');

  // 기존 rateCards 중 새 데이터에 없는 문서 삭제 (목업 120건 → 실데이터 교체 시 잔여분 정리)
  const newRateIds = new Set(rateCards.map((row) => `rc-${row.id}`));
  const existingRates = await db.collection('rateCards').get();
  let staleCount = 0;
  for (const docSnap of existingRates.docs) {
    if (!newRateIds.has(docSnap.id)) {
      writes.push({ ref: docSnap.ref, delete: true });
      staleCount += 1;
    }
  }
  if (staleCount) console.log(`🧹 기존 rateCards ${staleCount}건 삭제 예정 (새 데이터에 없음)`);

  for (const row of rateCards) {
    writes.push({ ref: db.collection('rateCards').doc(`rc-${row.id}`), data: mapRateCard(row) });
  }
  for (const row of personnelPool) {
    writes.push({ ref: db.collection('personnelPool').doc(`p-${row.id}`), data: mapPersonnel(row) });
  }
  for (const row of caseData) {
    writes.push({ ref: db.collection('caseData').doc(`case-${row.id}`), data: mapCaseData(row) });
  }

  // 데모 사용자 (권한 테스트용)
  writes.push({
    ref: db.collection('users').doc(DEMO_OWNER_UID),
    data: {
      role: 'user',
      displayName: '데모 기획자',
      email: 'demo-owner@innowave.ai',
      organization: 'INNOWAVE 데모',
      clientOrgId: null,
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: null,
    },
  });
  writes.push({
    ref: db.collection('users').doc('seed-demo-client'),
    data: {
      role: 'client',
      displayName: '데모 발주처',
      email: 'demo-client@innowave.ai',
      organization: 'OO발주기관',
      clientOrgId: DEMO_CLIENT_ORG,
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: null,
    },
  });

  // 목업 프로젝트 제거: 과거 시드로 올라간 데모 이벤트(evt-*, ownerUid=seed-demo-owner) 삭제
  // 서브컬렉션(progress)은 부모 삭제로 지워지지 않으므로 먼저 삭제
  const seededEvents = await db.collection('events').where('ownerUid', '==', DEMO_OWNER_UID).get();
  for (const evtSnap of seededEvents.docs) {
    const progress = await evtSnap.ref.collection('progress').get();
    for (const stageSnap of progress.docs) writes.push({ ref: stageSnap.ref, delete: true });
    writes.push({ ref: evtSnap.ref, delete: true });
  }
  if (seededEvents.size) console.log(`🧹 데모 프로젝트 ${seededEvents.size}건 삭제 예정 (목업 이벤트 제거)`);

  // 견적 파라미터 (기존 유지)
  const quoteParams = [
    { id: 'qp-default-margin', key: 'default_margin', value: 20 },
    { id: 'qp-vat-rate', key: 'vat_rate', value: 0.1 },
    { id: 'qp-option-multipliers', key: 'option_multipliers', value: { basic: 0.8, standard: 1.0, premium: 1.3 } },
  ];
  for (const { id, ...data } of quoteParams) {
    writes.push({
      ref: db.collection('quoteParams').doc(id),
      data: { ...data, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'seed-dummy-data' },
    });
  }

  console.log(`🌱 Firestore 업로드 시작 (${writes.length}건)...`);
  await commitBatches(db, writes);

  console.log('✅ 완료');
  console.log(`   rateCards:      ${rateCards.length}건`);
  console.log(`   personnelPool:  ${personnelPool.length}건`);
  console.log(`   caseData:       ${caseData.length}건`);
  console.log(`   users:          2건 (데모 owner/client)`);
  console.log(`   quoteParams:    ${quoteParams.length}건`);
}

main().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
