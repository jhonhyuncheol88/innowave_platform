import { useEffect, useState, createContext, useContext, useMemo, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import {
  ensureUserProfile,
  signInWithGoogle,
  signOut,
  type ApprovalStatus,
  type UserRole,
} from '../services/authService.js';

export type { ApprovalStatus, UserRole };

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  /** 관리자 사용허가 상태 — 프로젝트 생성 등 운영 기능의 게이트 */
  approval: ApprovalStatus | null;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, approval: null, loading: true });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setState({ user: null, role: null, approval: null, loading: false });
      const profile = await ensureUserProfile(user);
      // 시연 모드: 로그인만 하면 승인 절차 없이 바로 사용 가능 (승인 게이트 복원 시 profile.approval로 되돌릴 것)
      setState({ user, role: profile.role, approval: 'approved', loading: false });
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signInWithGoogle,
    signOut,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
