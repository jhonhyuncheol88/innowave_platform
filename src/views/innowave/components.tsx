import { useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useIw } from './state.js';
import type { ScreenId } from './types.js';

/* ── 공용 스타일 상수 ─────────────────────────────── */

export const CARD_SHADOW = '0 8px 24px rgba(20,99,243,0.08)';

export const LABEL_STYLE: CSSProperties = {
  display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#3A4358', marginBottom: '7px',
};

export const INPUT_STYLE: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px',
  border: '1px solid rgba(112,115,124,0.28)', borderRadius: '12px',
  fontSize: '14.5px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437',
  outline: 'none', transition: 'all .16s',
};

export const ADMIN_LABEL_STYLE: CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#3A4358', marginBottom: '7px',
};

export const ADMIN_INPUT_STYLE: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px',
  border: '1px solid rgba(112,115,124,0.28)', borderRadius: '10px',
  fontSize: '14px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437',
  outline: 'none', transition: 'all .16s',
};

export const GROTESK = "'Space Grotesk',sans-serif";

/* ── 로고 ─────────────────────────────────────────── */

export function Logo({ dark = false, size = 21, suffix }: { dark?: boolean; size?: number; suffix?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: GROTESK, fontWeight: 700, fontSize: size, letterSpacing: '-0.01em' }}>
      <span style={{ color: dark ? '#071A3E' : '#FFFFFF' }}>INNO</span>
      <span style={{
        background: dark ? 'linear-gradient(90deg,#26B8CE,#1463F3)' : 'linear-gradient(90deg,#4FD8EB,#6FA5FF)',
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      }}>WAVE</span>
      {suffix && (
        <span style={{ fontFamily: "'Pretendard Variable',Pretendard,sans-serif", fontSize: '11px', fontWeight: 700, color: '#9AA3B8', marginLeft: '7px' }}>{suffix}</span>
      )}
    </div>
  );
}

/* ── 워크플로우 스텝퍼 ────────────────────────────── */

const STEP_LABELS = ['행사 정보', '프로그램 구성', '비품 선택', '인력 매칭', '제안서·과업지시서'];

export function Stepper({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '32px' }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '999px',
                background: active ? '#1463F3' : done ? '#E5F0FF' : '#E8ECF4',
                color: active ? '#FFFFFF' : done ? '#1463F3' : '#9AA3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: GROTESK, fontWeight: 600, fontSize: '14px',
              }}>{done ? '✓' : String(n)}</div>
              <span style={{
                fontSize: '14px',
                fontWeight: active ? 700 : done ? 600 : 500,
                color: active ? '#071A3E' : done ? '#5A6478' : '#9AA3B8',
              }}>{label}</span>
            </div>
            {n < STEP_LABELS.length && (
              <div style={{
                flex: 1, minWidth: '16px', height: '2px', borderRadius: '2px',
                background: n < current ? '#1463F3' : 'rgba(13,59,143,0.12)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 전역 헤더 (GNB) ──────────────────────────────── */

/** 자체 상단 바를 가진 화면 — 랜딩(다크 헤더), 발주처 공유 문서/대시보드(조회 전용 바) */
const HEADERLESS_SCREENS: ScreenId[] = ['landing', 'proposal', 'dashboard'];

function GnbLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="iw-gnb-link"
      style={{ border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '8px 16px', fontSize: '13.5px', fontWeight: active ? 700 : 600, fontFamily: 'inherit', background: active ? '#E5F0FF' : 'transparent', color: active ? '#1463F3' : '#3A4358', transition: 'background .16s' }}
    >{children}</button>
  );
}

export function AppHeader() {
  const { go, set } = useIw();
  const { user, role, signOut } = useAuth();

  const handleSignOut = () => {
    // 로그아웃 후 게스트가 이전 세션의 프로젝트 ID로 쓰기를 시도하지 않게 정리
    set({ currentEventId: null, guestInfo: null, selected: {} });
    void signOut();
  };
  const { pathname } = useLocation();
  const current = screenFromPath(pathname);

  if (HEADERLESS_SCREENS.includes(current)) return null;

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 900, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(112,115,124,0.18)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '12px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div onClick={() => go('landing')} style={{ cursor: 'pointer', display: 'flex' }} title="홈으로">
          <Logo dark size={17} />
        </div>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {user && (
            <GnbLink active={current === 'projects' || current === 'project'} onClick={() => go('projects')}>내 프로젝트</GnbLink>
          )}
          {role === 'admin' && (
            <GnbLink active={current === 'admin'} onClick={() => go('admin')}>관리자</GnbLink>
          )}
          {user ? (
            <div
              onClick={handleSignOut}
              title={`${user.displayName ?? user.email ?? ''} · 클릭하면 로그아웃`}
              style={{ width: '34px', height: '34px', borderRadius: '999px', background: '#0D3B8F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginLeft: '6px', flexShrink: 0 }}
            >{(user.displayName ?? user.email ?? '유').charAt(0)}</div>
          ) : (
            <button onClick={() => go('auth')} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '9px 20px', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginLeft: '6px' }}>로그인</button>
          )}
        </nav>
      </div>
    </header>
  );
}

/* ── 화면 전환 바 (개발 모드 전용 데모 내비게이션) ─── */

const NAV_SCREENS: [ScreenId, string][] = [
  ['landing', '랜딩'], ['auth', '로그인'], ['step1', '① 정보'], ['step2', '② 프로그램'],
  ['step3', '③ 비품'], ['step4', '④ 매칭'], ['step5', '⑤ 문서'], ['proposal', '기획안 확인'], ['progress', '진행 입력'],
  ['dashboard', '발주처 현황'], ['projects', '내 프로젝트'], ['admin', '관리자'],
];

/** 라우트로는 존재하지만 하단 데모 내비게이션에는 노출하지 않는 화면 */
const HIDDEN_SCREENS: ScreenId[] = ['project'];

export function screenFromPath(pathname: string): ScreenId {
  const seg = pathname.replace(/^\/+|\/+$/g, '');
  const hidden = HIDDEN_SCREENS.find((id) => id === seg);
  if (hidden) return hidden;
  const found = NAV_SCREENS.find(([id]) => id === seg);
  return found ? found[0] : 'landing';
}

/* ── 로딩 / 안내 / 로그인 가드 ─────────────────────── */

export function Loading({ label = '데이터를 불러오는 중…' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '64px 20px', color: '#5A6478', fontSize: '14.5px', fontWeight: 600 }}>
      <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '3px solid #E5F0FF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block' }} />
      {label}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const palette = {
    info: { bg: '#F0F7FF', border: 'rgba(20,99,243,0.2)', color: '#0D3B8F' },
    error: { bg: '#FFF1F1', border: 'rgba(229,72,77,0.35)', color: '#B3261E' },
    success: { bg: '#E6F7EC', border: 'rgba(43,182,115,0.4)', color: '#1B8A4B' },
  }[tone];
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: '14px', padding: '14px 18px', fontSize: '13.5px', lineHeight: 1.6, color: palette.color, fontWeight: 600, margin: '8px 0' }}>
      {children}
    </div>
  );
}

/** 로그인이 필요한 화면 래퍼 — Firestore rules상 모든 읽기는 로그인 필수 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div style={{ minHeight: '60vh' }}><Loading label="로그인 상태 확인 중…" /></div>;
  if (user) return <>{children}</>;

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '36px clamp(16px,5vw,32px)', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Logo dark size={20} /></div>
        <h2 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: '#071A3E' }}>로그인이 필요한 화면입니다</h2>
        <p style={{ margin: '0 0 20px', fontSize: '13.5px', lineHeight: 1.6, color: '#5A6478' }}>Firestore 데이터 조회는 로그인 후 가능합니다.<br />Google 계정으로 계속해 주세요.</p>
        {error && <Notice tone="error">{error}</Notice>}
        <button
          onClick={() => {
            setBusy(true);
            setError(null);
            signInWithGoogle().catch((e) => setError((e as Error).message)).finally(() => setBusy(false));
          }}
          disabled={busy}
          className="iw-btn-primary"
          style={{ width: '100%', background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px 0', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.7 : 1 }}
        >{busy ? '로그인 중…' : 'Google로 로그인'}</button>
      </div>
    </div>
  );
}

/** 개발 모드 전용 — 접힌 칩을 눌러야 펼쳐지는 화면 점프 바 (프로덕션 빌드에서는 렌더되지 않음) */
export function ScreenNav() {
  const { go } = useIw();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const current = screenFromPath(pathname);

  if (!import.meta.env.DEV) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="개발용 화면 이동"
        style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 1000, border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '9px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'inherit', background: 'rgba(7,26,62,0.85)', color: 'rgba(255,255,255,0.85)', boxShadow: '0 8px 24px rgba(7,26,62,0.3)', backdropFilter: 'blur(8px)' }}
      >🧭 DEV</button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
      display: 'flex', gap: '3px', alignItems: 'center',
      background: 'rgba(7,26,62,0.92)', backdropFilter: 'blur(12px)', borderRadius: '999px', padding: '5px',
      boxShadow: '0 12px 32px rgba(7,26,62,0.35)', maxWidth: 'calc(100vw - 20px)', overflowX: 'auto',
    }}>
      {NAV_SCREENS.map(([id, label]) => (
        <button
          key={id}
          onClick={() => go(id)}
          style={{
            border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '8px 12px',
            fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit',
            background: current === id ? '#1463F3' : 'transparent',
            color: current === id ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
            transition: 'background .16s',
          }}
        >{label}</button>
      ))}
      <button onClick={() => setOpen(false)} title="접기" style={{ border: 'none', cursor: 'pointer', borderRadius: '999px', width: '28px', height: '28px', fontSize: '12px', fontFamily: 'inherit', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>✕</button>
    </div>
  );
}

/* ── 단계별 AI 채팅 어시스턴트 ─────────────────────── */

import {
  loadStepChat, saveStepChat, saveStepInstruction,
  type ChatMessage, type InstructionKey, type StepChatKey,
} from './hooks.js';
import { useEffect, useRef } from 'react';

export function StepChat({
  title, description, eventId, stepKey, instructionKey, examples, tips, disabled = false, disabledHint, onApply, onHistoryChange,
}: {
  title: string;
  description: string;
  /** null이면(게스트·프로젝트 미생성) 기록 저장 생략 — AI 반영은 로그인 시 동작 */
  eventId: string | null;
  stepKey: StepChatKey;
  instructionKey: InstructionKey;
  examples: string[];
  tips: string[];
  disabled?: boolean;
  disabledHint?: string;
  /** 사용자 메시지를 현재 단계 데이터에 반영하고 AI 응답(요약)을 돌려준다 */
  onApply: (message: string) => Promise<string>;
  /** 프로젝트 생성 전 대화를 화면이 백업해 두었다가 생성 후 저장할 수 있게 전달 */
  onHistoryChange?: (messages: ChatMessage[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const hydratedFor = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eventId || hydratedFor.current === eventId) return;
    hydratedFor.current = eventId;
    void loadStepChat(eventId, stepKey).then((m) => { if (m.length) setMessages(m); }).catch(() => {});
  }, [eventId, stepKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const persist = (msgs: ChatMessage[]) => {
    onHistoryChange?.(msgs);
    if (!eventId) return;
    void saveStepChat(eventId, stepKey, msgs).catch(() => {});
    const joined = msgs.filter((m) => m.role === 'user').map((m) => m.text).join('\n');
    void saveStepInstruction(eventId, instructionKey, joined.slice(-1000)).catch(() => {});
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || disabled) return;
    setInput('');
    setBusy(true);
    const withUser = [...messages, { role: 'user' as const, text, at: Date.now() }];
    setMessages(withUser);
    try {
      const note = await onApply(text);
      const next = [...withUser, { role: 'ai' as const, text: note || '반영했어요.', at: Date.now() }];
      setMessages(next);
      persist(next);
    } catch (e) {
      const next = [...withUser, { role: 'ai' as const, text: `반영에 실패했어요: ${e instanceof Error ? e.message : String(e)}`, at: Date.now() }];
      setMessages(next);
      persist(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '22px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '9px', background: '#E5F0FF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1463F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
          </span>
          <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#071A3E' }}>{title}</span>
        </div>
        <button
          onClick={() => setGuideOpen((o) => !o)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, color: '#1463F3', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          요청 가이드
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: guideOpen ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }}><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#5A6478', lineHeight: 1.55 }}>{description}</p>

      {guideOpen && (
        <div style={{ background: '#F6F9FF', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0D3B8F', marginBottom: '6px' }}>요청 요령</div>
          <ul style={{ margin: '0 0 12px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {tips.map((t) => <li key={t} style={{ fontSize: '12.5px', color: '#3A4358', lineHeight: 1.55 }}>{t}</li>)}
          </ul>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0D3B8F', marginBottom: '6px' }}>예시 — 클릭하면 바로 전송됩니다</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => { if (!disabled && !busy) void send(ex); }}
                disabled={disabled || busy}
                style={{ textAlign: 'left', background: '#FFFFFF', border: '1px solid rgba(20,99,243,0.22)', borderRadius: '10px', padding: '8px 12px', fontSize: '12.5px', color: '#3A4358', cursor: disabled || busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', lineHeight: 1.5 }}
              >“{ex}”</button>
            ))}
          </div>
        </div>
      )}

      {/* 대화 영역 */}
      <div ref={listRef} style={{ background: '#F6F9FF', borderRadius: '14px', padding: '14px', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
        {messages.length === 0 && !busy && (
          <p style={{ margin: '6px 2px', fontSize: '12.5px', color: '#9AA3B8', lineHeight: 1.6 }}>
            {disabled
              ? (disabledHint ?? '로그인하면 AI 어시스턴트를 사용할 수 있어요.')
              : '예: "강화군에서 진행하는 것으로 바꿔줘, 시기는 27년 3월" — 보내는 즉시 이 단계 내용에 반영됩니다.'}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={`${m.at}-${i}`} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: m.role === 'user' ? '#1463F3' : '#FFFFFF',
              color: m.role === 'user' ? '#FFFFFF' : '#1B2437',
              border: m.role === 'user' ? 'none' : '1px solid rgba(112,115,124,0.18)',
              padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ borderRadius: '14px 14px 14px 4px', background: '#FFFFFF', border: '1px solid rgba(112,115,124,0.18)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '999px', border: '2.5px solid #E5F0FF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block' }} />
              <span style={{ fontSize: '12.5px', color: '#5A6478' }}>반영하는 중…</span>
            </div>
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
          disabled={disabled || busy}
          rows={1}
          placeholder={disabled ? (disabledHint ?? '로그인하면 사용할 수 있어요.') : '변경하고 싶은 내용을 입력하세요 (Enter 전송)'}
          className="iw-input"
          style={{ flex: 1, resize: 'none', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '12px', padding: '11px 14px', fontSize: '13.5px', lineHeight: 1.5, color: '#071A3E', fontFamily: 'inherit', background: disabled ? '#F6F8FB' : '#FFFFFF', boxSizing: 'border-box', minHeight: '44px', maxHeight: '120px' }}
        />
        <button
          onClick={() => void send()}
          disabled={disabled || busy || !input.trim()}
          className="iw-btn-primary"
          style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '12px', width: '44px', height: '44px', cursor: disabled || busy || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: disabled || busy || !input.trim() ? 0.5 : 1 }}
          title="전송"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
        </button>
      </div>
      <div style={{ fontSize: '11.5px', color: '#9AA3B8', marginTop: '6px' }}>대화는 프로젝트에 저장되며, 다음 단계 AI 초안에도 반영됩니다.</div>
    </div>
  );
}
