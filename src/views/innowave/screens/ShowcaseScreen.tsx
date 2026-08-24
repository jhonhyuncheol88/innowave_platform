/**
 * /showcase — 김유환 교수 시연 전용 페이지 (숨김 라우트, 로그인·내비 미노출)
 * 전화·미팅 메모 → (AI 생성 애니메이션) → 과업지시서 → (AI 생성 애니메이션) → 운영제안서·견적서
 * 세 산출물은 고정 상수(showcaseDocs.tsx)로, 실제 AI 호출·Firebase 저장은 하지 않는 결정적 데모다.
 */
import { useEffect, useRef, useState } from 'react';
import { CARD_SHADOW, GROTESK } from '../components.js';
import { BudgetDocument, DocBadge, ProposalDocument, SowDocument } from './showcaseDocs.js';

const MEMO_TEXT = `2026년 SNU-SH DEMO DAY 프로그램 과업지시서 (요약)

■ 발주 개요
발주기관: 서울대학교 시흥캠퍼스본부 (전략기획실)
담당자: 심정은 (Tel. 031-5176-2240 / sje0408@snu.ac.kr)
사업명: 2026년 예비창업패키지 투자 프로그램 (SNU-SH DEMO DAY)
계약방식: 여성기업과의 수의계약 추진 (계약금액 2,000만원 이상으로 일반기업은 입찰 필요)
총 용역예산: 23,700,000원 (VAT 포함)
※ 전년도 대비 사업 규모 축소로 예산이 다소 제한적임

■ 지원 대상
2026년 프로그램 지원 개사: 6개사

■ 주요 과업 내용
투자유치 교육 및 피칭 교육 각 1회 (총 2회)
- 교육 강사비는 전문가활용비로 주관기관에서 직접 지출 예정
- 해당 비용은 IR 피치덱 제작 지원 비용 등으로 활용 요청
2. IR 피치덱 제작 지원
3. SNU-SH DEMO DAY 운영
※ 지난해 운영한 IR Deck 전략 컨설팅(IR 컨설팅) 과정은 올해 별도 운영하지 않음

■ 다과 및 케이터링
교육 프로그램 운영 시 다과는 주관기관에서 직접 준비
- IR 행사 당일 식사는 진행하지 않으며, 행사장 내 다과만 준비 요청
- 세부 사항은 추후 미팅 시 협의하여 조정

■ 계약 관련 확인 사항
본 용역은 계약금액 2,000만원 이상으로 여성기업과의 수의계약 검토 중
- 여성기업 사업자등록증 보유 여부 확인 요청

■ 운영 일정
2026년 9월 모집 시작, 12월 초 내 운영 예정
- 예비창업패키지 사업 일정에 따라 변동 가능
- 참고: 7월 21일(화)~22일(수) 담당자 기초교육 일정으로 사무실 부재 가능 (방문 시 심정은 010-6695-8573로 연락)`;

/** 생성까지 걸리는 연출 시간(ms) — 실제 AI 호출 없이 타이머로만 흉내낸다 */
const GEN_DELAY_MS = 2500;

type GenState = 'idle' | 'generating' | 'done';

/* ── 3단계 진행 표시 ──────────────────────────────────────── */

const STAGE_LABELS: [string, string][] = [
  ['①', '미팅 메모'],
  ['②', '과업지시서'],
  ['③', '운영제안서'],
];

function StageIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {STAGE_LABELS.map(([mark, label], i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'active' : 'todo';
        return (
          <div key={label} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '13px', color: state === 'todo' ? '#B9C6E4' : '#1463F3' }}>{mark}</span>
              <span style={{ fontSize: '13.5px', fontWeight: state === 'active' ? 700 : 600, color: state === 'todo' ? '#9AA3B8' : '#071A3E' }}>{label}</span>
            </div>
            {n < STAGE_LABELS.length && <span style={{ color: '#B9C6E4', fontSize: '13px' }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── AI 생성 중 연출 카드 ─────────────────────────────────── */

function GeneratingCard({ label }: { label: string }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '56px clamp(16px,5vw,32px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
      <span style={{ width: '34px', height: '34px', borderRadius: '999px', border: '3px solid #E5F0FF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block' }} />
      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0D3B8F', textAlign: 'center', lineHeight: 1.6 }}>{label}</p>
    </div>
  );
}

/* ── 메모 카드 ────────────────────────────────────────────── */

function MemoCard({ value, onChange, editable }: { value: string; onChange: (v: string) => void; editable: boolean }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px clamp(16px,5vw,32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '10px', background: '#F0F2F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>📞</span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#071A3E' }}>미팅 메모</span>
        </div>
        <DocBadge tone="memo">전화·미팅 메모</DocBadge>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        rows={20}
        className="iw-input"
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid rgba(112,115,124,0.28)',
          borderRadius: '14px', padding: '16px 18px', fontSize: '13.5px', lineHeight: 1.75, color: '#1B2437',
          fontFamily: 'inherit', background: editable ? '#FFFFFF' : '#F6F8FB', outline: 'none', minHeight: '360px',
        }}
      />
      <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#9AA3B8' }}>
        {editable ? '실제 통화·미팅 내용을 그대로 옮긴 메모입니다. 자유롭게 수정한 뒤 아래 버튼을 눌러 보세요.' : '생성이 시작되어 메모는 더 이상 수정할 수 없습니다. 처음부터 다시 시작하면 다시 편집할 수 있어요.'}
      </p>
    </div>
  );
}

/* ── 문서 래퍼 (흰 카드) ──────────────────────────────────── */

function DocCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '30px clamp(16px,5vw,32px)' }}>
      {children}
    </div>
  );
}

/* ── 메인 화면 ────────────────────────────────────────────── */

export function ShowcaseScreen() {
  const [memoText, setMemoText] = useState(MEMO_TEXT);
  const [sowState, setSowState] = useState<GenState>('idle');
  const [proposalState, setProposalState] = useState<GenState>('idle');
  const sowRef = useRef<HTMLDivElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    // 카드가 렌더될 다음 프레임에 스크롤 — 생성 애니메이션이 화면에 들어오는 순간부터 보이게 한다
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const generateSow = () => {
    if (sowState !== 'idle') return;
    setSowState('generating');
    scrollTo(sowRef);
    timerRef.current = window.setTimeout(() => setSowState('done'), GEN_DELAY_MS);
  };

  const generateProposal = () => {
    if (sowState !== 'done' || proposalState !== 'idle') return;
    setProposalState('generating');
    scrollTo(proposalRef);
    timerRef.current = window.setTimeout(() => setProposalState('done'), GEN_DELAY_MS);
  };

  const reset = () => {
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setMemoText(MEMO_TEXT);
    setSowState('idle');
    setProposalState('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const step: 1 | 2 | 3 = proposalState !== 'idle' ? 3 : sowState !== 'idle' ? 2 : 1;
  const pastStage1 = sowState !== 'idle';

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '120px' }}>
      {/* 상단 바 — 로그인 불필요, 내비 미노출 (숨김 시연 전용 페이지) */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(112,115,124,0.22)' }}>
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '14px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: GROTESK, fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
            <span style={{ color: '#071A3E' }}>INNO</span>
            <span style={{ background: 'linear-gradient(90deg,#26B8CE,#1463F3)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>WAVE</span>
          </div>
          <span style={{ background: '#F0F2F6', color: '#5A6478', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>시연 전용 데모</span>
          {pastStage1 && (
            <button
              onClick={reset}
              className="iw-btn-outline-navy"
              style={{ marginLeft: 'auto', background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '7px' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
              처음부터 다시
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px clamp(16px,5vw,32px) 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <StageIndicator step={step} />

        <MemoCard value={memoText} onChange={setMemoText} editable={sowState === 'idle'} />

        {sowState === 'idle' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={generateSow}
              className="iw-btn-primary"
              style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '15px 34px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(20,99,243,0.3)', display: 'inline-flex', alignItems: 'center', gap: '9px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
              과업지시서 생성
            </button>
          </div>
        )}

        {sowState !== 'idle' && (
          <div ref={sowRef}>
            {sowState === 'generating' && <GeneratingCard label={'AI가 메모를 분석해 과업지시서를 작성하고 있어요…'} />}
            {sowState === 'done' && <DocCard><SowDocument /></DocCard>}
          </div>
        )}

        {sowState === 'done' && proposalState === 'idle' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={generateProposal}
              className="iw-btn-primary"
              style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '15px 34px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(20,99,243,0.3)', display: 'inline-flex', alignItems: 'center', gap: '9px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" /></svg>
              운영제안서 생성
            </button>
          </div>
        )}

        {proposalState !== 'idle' && (
          <div ref={proposalRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {proposalState === 'generating' && <GeneratingCard label={'AI가 과업지시서를 분석해 운영제안서를 작성하고 있어요…'} />}
            {proposalState === 'done' && (
              <>
                <DocCard><ProposalDocument /></DocCard>
                <DocCard><BudgetDocument /></DocCard>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
