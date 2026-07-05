import { useState } from 'react';
import { Logo, Notice } from '../components.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useIw } from '../state.js';

export function AuthScreen() {
  const { go, set } = useIw();
  const { user, signInWithGoogle, signOut } = useAuth();

  const handleSignOut = () => {
    set({ currentEventId: null, guestInfo: null, selected: {} });
    void signOut();
  };
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogle = () => {
    setBusy(true);
    setGoogleError(null);
    signInWithGoogle()
      .then(() => go('projects'))
      .catch((e) => setGoogleError((e as Error).message))
      .finally(() => setBusy(false));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px 100px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '920px', background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 16px 48px rgba(20,99,243,0.12)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', overflow: 'hidden' }}>
        <div style={{ background: '#071A3E', padding: '48px clamp(24px,6vw,40px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '48px', minHeight: '360px', boxSizing: 'border-box' }}>
          <div>
            <div style={{ marginBottom: '24px' }}><Logo size={24} /></div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.78)', fontSize: '16.5px', lineHeight: 1.65, textWrap: 'pretty' }}>
              행사 기획부터 견적까지,<br />AI가 함께하는 MICE 워크플로우.
            </p>
          </div>
          <svg viewBox="0 0 400 60" preserveAspectRatio="none" style={{ width: '100%', height: '46px' }}>
            <defs>
              <linearGradient id="iwAuthWave" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#4FD8EB" /><stop offset="0.55" stopColor="#1463F3" /><stop offset="1" stopColor="#0D3B8F" />
              </linearGradient>
            </defs>
            <path d="M0,36 C70,10 130,54 200,30 C270,6 330,48 400,26" fill="none" stroke="url(#iwAuthWave)" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ padding: '44px clamp(24px,6vw,40px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Notice tone="success">{user.email} 계정으로 로그인되어 있습니다.</Notice>
              <button onClick={() => go('projects')} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '14px 0', fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)' }}>내 프로젝트로 이동</button>
              <button onClick={handleSignOut} style={{ background: 'transparent', color: '#9AA3B8', border: 'none', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>로그아웃</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>Google 계정으로 시작하기</h1>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#5A6478' }}>별도 회원가입 없이 Google 계정 하나로 바로 시작합니다.<br />첫 로그인 시 프로필이 자동으로 생성돼요.</p>
              </div>

              {googleError && <Notice tone="error">{googleError}</Notice>}

              <button onClick={handleGoogle} disabled={busy} className="iw-btn-soft" style={{ background: '#FFFFFF', color: '#3A4358', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '15px 0', fontSize: '15.5px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: busy ? 0.7 : 1, boxShadow: '0 4px 14px rgba(7,26,62,0.08)' }}>
                <svg width="19" height="19" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
                  <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
                  <path fill="#EA4335" d="M12 4.6c2.2 0 3.7 1 4.5 1.8l3.3-3.2C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-5 6.8-5z" />
                </svg>
                {busy ? '로그인 중…' : 'Google로 계속하기'}
              </button>

              <div style={{ background: '#F0F7FF', border: '1px solid rgba(20,99,243,0.16)', borderRadius: '12px', padding: '13px 15px', fontSize: '13px', lineHeight: 1.55, color: '#3A4358' }}>
                가입 시 기본 권한은 <strong style={{ color: '#0D3B8F' }}>일반 이용자</strong>입니다. 발주처(기관)·관리자 권한은 관리자 승인 후 부여됩니다.
              </div>

              <button onClick={() => go('step1')} style={{ background: 'transparent', color: '#5A6478', border: 'none', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>로그인 없이 둘러보기 — 기획 시작</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
