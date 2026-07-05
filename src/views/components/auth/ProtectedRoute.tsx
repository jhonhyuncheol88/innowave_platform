import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** 로그인 필요 페이지 래퍼 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="container" style={{ padding: '4rem 0' }}>로딩 중…</div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
