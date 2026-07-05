import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/** 워크플로우 진입 전용 플레이스홀더 — 4단계 UI 구현 전 로그인 검증용 */
export function WorkflowPlaceholderPage() {
  const { user, role, signOut } = useAuth();

  return (
    <main className="container" style={{ padding: '4rem 0' }}>
      <h1>워크플로우</h1>
      <p style={{ marginTop: '1rem', color: 'var(--iw-ink-soft)' }}>
        {user?.displayName ?? user?.email}님으로 로그인되었습니다. (역할: {role})
      </p>
      <p style={{ marginTop: '0.5rem' }}>
        4단계 기획 UI는 준비 중입니다.
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <Link className="btn btn-primary" to="/">홈</Link>
        <button type="button" className="btn btn-primary" onClick={() => signOut()}>
          로그아웃
        </button>
      </div>
    </main>
  );
}
