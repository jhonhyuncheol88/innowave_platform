import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';

export type UserRole = 'user' | 'client' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  role: UserRole;
  approval: ApprovalStatus;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const { user } = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(user);
  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** 최초 로그인 시 Firestore users 문서 생성 (rules: role='user', approvalStatus='pending' 고정)
 *  기존 계정에 approvalStatus 필드가 없으면 승인된 것으로 간주한다 (소급 차단 없음). */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      role: 'user',
      approvalStatus: 'pending',
      displayName: (user.displayName ?? '').slice(0, 50),
      email: (user.email ?? '').slice(0, 120),
      organization: '',
      clientOrgId: null,
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
    return { role: 'user', approval: 'pending' };
  }

  await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  const data = snap.data();
  return {
    role: (data.role as UserRole | undefined) ?? 'user',
    approval: (data.approvalStatus as ApprovalStatus | undefined) ?? 'approved',
  };
}
