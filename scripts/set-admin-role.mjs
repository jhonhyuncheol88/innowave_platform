/**
 * 지정한 이메일의 Firebase Auth 사용자를 admin 권한으로 등록
 * 실행: node scripts/set-admin-role.mjs <email>
 * (해당 이메일로 앱에서 최소 1회 Google 로그인이 되어 있어야 UID를 찾을 수 있다)
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'innowave-platform';
const email = process.argv[2];

if (!email) {
  console.error('사용법: node scripts/set-admin-role.mjs <email>');
  process.exit(1);
}

const saPath = resolve(process.cwd(), 'service-account.json');
if (existsSync(saPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: PROJECT_ID });
} else {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const db = getFirestore();

let authUser;
try {
  authUser = await getAuth().getUserByEmail(email);
} catch (e) {
  if (e.code === 'auth/user-not-found') {
    console.error(`❌ Auth 사용자를 찾을 수 없습니다: ${email}`);
    console.error('   앱에서 해당 계정으로 Google 로그인을 한 번 한 뒤 다시 실행해 주세요.');
    process.exit(2);
  }
  throw e;
}

console.log(`🔎 uid=${authUser.uid} (${authUser.providerData.map((p) => p.providerId).join(', ') || 'no-provider'})`);

const ref = db.collection('users').doc(authUser.uid);
const snap = await ref.get();
await ref.set({
  role: 'admin',
  email,
  displayName: snap.exists ? (snap.data().displayName ?? authUser.displayName ?? '') : (authUser.displayName ?? ''),
  organization: snap.exists ? (snap.data().organization ?? '') : '',
  clientOrgId: snap.exists ? (snap.data().clientOrgId ?? null) : null,
  ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

const after = await ref.get();
console.log(`✅ users/${authUser.uid} → role=${after.data().role}`);
