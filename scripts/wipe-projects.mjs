/**
 * 프로젝트(events) 전체 삭제 — 서브컬렉션(programs/matches/quotes/supplies/instructions/progress/documents) 포함
 * 실행: node scripts/wipe-projects.mjs
 * 자격증명: service-account.json 또는 gcloud ADC (seed 스크립트와 동일)
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'innowave-platform';

const saPath = resolve(process.cwd(), 'service-account.json');
if (existsSync(saPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID });
} else {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();
const snap = await db.collection('events').get();
console.log(`events ${snap.size}건 삭제 시작...`);
for (const d of snap.docs) {
  await db.recursiveDelete(d.ref);
  console.log('  ✓ 삭제:', d.id, '|', d.data().basicInfo?.name ?? '(무명)');
}
const after = await db.collection('events').get();
console.log(`완료 — 남은 events: ${after.size}건`);
