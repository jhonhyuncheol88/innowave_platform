import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './hooks/useAuth.js';
import { LoginPage } from './views/pages/LoginPage.js';
import { WorkflowPlaceholderPage } from './views/pages/WorkflowPlaceholderPage.js';
import { ProtectedRoute } from './views/components/auth/ProtectedRoute.js';
import { InnowaveApp } from './views/innowave/InnowaveApp.js';

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/workflow"
              element={(
                <ProtectedRoute>
                  <WorkflowPlaceholderPage />
                </ProtectedRoute>
              )}
            />
            {/* INNOWAVE 앱 전체 — 단일 catch-all 라우트라 화면 전환 시 리마운트되지 않는다
                (IwProvider 상태·데이터 캐시가 내비게이션 간 유지됨) */}
            <Route path="*" element={<InnowaveApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}
