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

const EVENT_STATUS_MAP = {
  draft: 'draft',
  in_progress: 'in_progress',
  quoted: 'quoted',
  confirmed: 'confirmed',
};

const STAGE_STATUS_MAP = {
  '완료': 'done',
  '진행중': 'active',
  '예정': 'pending',
};

function eventCurrentStep(status) {
  if (status === 'draft') return 1;
  if (status === 'in_progress') return 4;
  if (status === 'quoted') return 4;
  if (status === 'confirmed') return 4;
  return 1;
}

function summarizeStages(stages) {
  const sorted = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
  const rate = Math.round(sorted.reduce((s, st) => s + st.progressRate, 0) / (sorted.length || 1));
  const active = sorted.find((s) => s.status === 'active');
  const next = sorted.find((s) => s.status === 'pending');
  return {
    rate,
    currentStage: active?.stageName ?? (rate === 100 ? '완료' : sorted[0]?.stageName ?? '-'),
    nextMilestone: next?.stageName ?? '-',
  };
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

function mapEvent(row, progressSummary = null) {
  const status = EVENT_STATUS_MAP[row.status] ?? 'draft';
  const hasProgress = progressSummary !== null;
  return {
    ownerUid: DEMO_OWNER_UID,
    clientOrgId: hasProgress ? DEMO_CLIENT_ORG : null,
    basicInfo: {
      name: row.event_name,
      organizer: row.organizer,
      eventType: row.event_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      region: row.region,
      operationType: row.operation_type,
      participantScale: row.participant_scale,
      budgetLimit: row.budget_limit,
      purpose: row.purpose,
    },
    parsedFromDoc: Boolean(row.uploaded_document_name),
    status,
    currentStep: eventCurrentStep(row.status),
    progressSummary,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function mapProgress(row) {
  return {
    stageName: row.stage_name,
    stageOrder: row.stage_order,
    status: STAGE_STATUS_MAP[row.status] ?? 'pending',
    progressRate: row.progress_rate,
    note: row.updated_note || '',
    deliverablePath: row.deliverable_name || null,
    updatedAt: parseTs(row.updated_at),
    updatedBy: DEMO_OWNER_UID,
  };
}

async function commitBatches(db, writes) {
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = db.batch();
    for (const { ref, data } of writes.slice(i, i + CHUNK)) {
      batch.set(ref, data, { merge: false });
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
  const sampleEvents = loadJson('sample_events.json');
  const projectProgress = loadJson('project_progress.json');

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

  // 진행 현황을 이벤트별로 그룹핑
  const progressByEvent = new Map();
  for (const row of projectProgress) {
    const eventId = row.sample_event_id;
    if (!progressByEvent.has(eventId)) progressByEvent.set(eventId, []);
    progressByEvent.get(eventId).push(mapProgress(row));
  }

  for (const row of sampleEvents) {
    const evtId = `evt-${row.id}`;
    const stages = progressByEvent.get(row.id);
    let summary = null;
    if (stages) {
      summary = summarizeStages(stages);
      for (const stage of stages) {
        writes.push({
          ref: db.collection('events').doc(evtId).collection('progress').doc(`stage-${stage.stageOrder}`),
          data: stage,
        });
      }
    }
    writes.push({
      ref: db.collection('events').doc(evtId),
      data: mapEvent(row, summary),
    });
  }

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
  console.log(`   events:         ${sampleEvents.length}건`);
  console.log(`   progress:       ${projectProgress.length}건 (서브컬렉션)`);
  console.log(`   users:          2건 (데모 owner/client)`);
  console.log(`   quoteParams:    ${quoteParams.length}건`);
}

main().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
