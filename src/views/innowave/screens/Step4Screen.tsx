import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, Stepper } from '../components.js';
import { buildOptionQuote, buildQuoteItems, errMessage, invalidateCache, invalidateEvent, useEvent, useQuoteParams, useRateCards } from '../hooks.js';
import { fmt, mkQuote, useIw } from '../state.js';
import type { PlanId } from '../types.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { Event } from '../../../models/Event.js';
import type { QuoteOptionValue } from '../../../models/Quote.js';
import { eventRepository } from '../../../repositories/EventRepository.js';

const TH_STYLE = {
  padding: '10px 8px', fontWeight: 700, color: '#5A6478',
  borderBottom: '1px solid rgba(112,115,124,0.22)', fontSize: '12.5px',
} as const;

const BUDGET_MIN = 1000;
const BUDGET_MAX = 20000;

function Step4Body() {
  const { s, set, go } = useIw();
  const { user, role, approval, signInWithGoogle } = useAuth();
  const canOperate = role === 'admin' || approval === 'approved';
  const { cards, loading: cardsLoading, error: cardsError } = useRateCards(!!user);
  const { event } = useEvent(s.currentEventId);
  const { params } = useQuoteParams();
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // 이벤트(또는 게스트 입력) 예산 한도로 슬라이더 1회 초기화
  const budgetInitFor = useRef<string | null>(null);
  useEffect(() => {
    const src = event?.id ?? (s.guestInfo ? 'guest' : null);
    const limit = event?.basicInfo.budgetLimit ?? s.guestInfo?.budgetLimit ?? 0;
    if (!src || budgetInitFor.current === src) return;
    budgetInitFor.current = src;
    if (limit > 0) {
      const man = Math.round(limit / 10000 / 500) * 500;
      set({ budget: Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, man)) });
    }
  }, [event, s.guestInfo, set]);

  const signIn = () => {
    setSigningIn(true);
    setShareError(null);
    signInWithGoogle()
      .catch((e) => setShareError((e as Error).message))
      .finally(() => setSigningIn(false));
  };

  const items = useMemo(() => buildQuoteItems(cards, event), [cards, event]);
  const cardCategory = useMemo(() => {
    const m = new Map<string, string>();
    cards.forEach((c) => { if (c.id) m.set(c.id, c.category); });
    return m;
  }, [cards]);

  const planDefs: { id: PlanId; name: string; desc: string; mult: number }[] = [
    { id: 'basic', name: 'Basic', desc: '핵심 프로그램 중심의 실속 구성', mult: params.multBasic },
    { id: 'standard', name: 'Standard', desc: '권장 구성 — 예산 한도 기준 최적화', mult: 1.0 },
    { id: 'premium', name: 'Premium', desc: '브랜딩·중계까지 포함한 확장 구성', mult: params.multPremium },
  ];
  const budgetWon = s.budget * 10000;
  const quotes = useMemo(
    () => Object.fromEntries(planDefs.map((d) => [d.id, buildOptionQuote(items, d.id as QuoteOptionValue, d.mult, budgetWon)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, budgetWon, params.multBasic, params.multPremium],
  );
  const selectedQuote = quotes[s.plan];

  // 게스트: 실제 레이트카드 없이 예산 기반 데모 수치를 만들어 블러 처리로만 노출
  const figuresFor = (id: PlanId, mult: number) => {
    if (user) {
      const q = quotes[id];
      return { supply: q.subtotal, margin: q.marginTotal, vat: q.vat, total: q.total };
    }
    return mkQuote(s.budget, mult, s.qpMargin, s.qpVat);
  };
  const amountStyle = user ? {} : { filter: 'blur(9px)', userSelect: 'none' as const };

  /** 견적 확정 → (프로젝트 없으면 생성) → 견적 저장 → 발주처 공유 문서로 이동 */
  const share = async () => {
    setShareError(null);
    if (!user) { go('proposal'); return; }
    if (!canOperate) {
      setShareError('관리자 승인 후 프로젝트를 만들 수 있습니다. 승인 전에는 견적 확인만 가능해요.');
      return;
    }
    setSharing(true);
    try {
      let eventId = s.currentEventId;
      // 1~3단계를 게스트/미저장 상태로 지나온 경우 — 입력값으로 프로젝트를 먼저 생성
      if (!eventId) {
        if (!s.guestInfo?.name) {
          setShareError('행사 정보가 없습니다. 1단계에서 행사명과 유형을 입력해 주세요.');
          setSharing(false);
          return;
        }
        const created = await eventRepository.create(new Event({
          ownerUid: user.uid,
          basicInfo: s.guestInfo,
          status: 'quoted',
          currentStep: 4,
        }));
        eventId = created.id;
        set({ currentEventId: eventId });
      }
      await eventRepository.quoteRepo(eventId!).create(selectedQuote);
      await eventRepository.patch(eventId!, { status: 'quoted', currentStep: 4 });
      invalidateEvent(eventId);
      invalidateCache(`quote:${eventId}`);
      go('proposal');
    } catch (e) {
      setShareError(errMessage(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
      <Stepper current={4} />

      <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>견적 옵션을 비교해 보세요</h1>
      <p style={{ margin: '0 0 26px', fontSize: '15px', color: '#5A6478' }}>
        표준 레이트카드 {cards.length > 0 ? `${cards.length}개` : ''} 항목을 기준으로 산출한 3가지 예산 옵션입니다.
        {event ? ` — ${event.basicInfo.name}` : ''}
      </p>

      {cardsError && <Notice tone="error">{cardsError}</Notice>}
      {user && cardsLoading ? (
        <Loading label="레이트카드를 불러오는 중…" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,270px),1fr))', gap: '18px', alignItems: 'stretch' }}>
            {planDefs.map((d) => {
              const f = figuresFor(d.id, d.mult);
              const sel = s.plan === d.id;
              const rec = d.id === 'standard';
              return (
                <div key={d.id} style={{ position: 'relative', background: '#FFFFFF', borderRadius: '20px', padding: '28px 26px', border: rec ? '2px solid #1463F3' : '2px solid transparent', boxShadow: CARD_SHADOW, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {rec && (
                    <span style={{ position: 'absolute', top: '-11px', left: '26px', background: '#1463F3', color: '#FFFFFF', borderRadius: '999px', padding: '4px 14px', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.02em' }}>권장</span>
                  )}
                  <div>
                    <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '17px', color: '#071A3E' }}>{d.name}</div>
                    <div style={{ fontSize: '13.5px', color: '#5A6478', marginTop: '3px' }}>{d.desc}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '34px', letterSpacing: '-0.02em', color: rec ? '#1463F3' : '#071A3E' }}>
                      ₩<span style={amountStyle}>{fmt(f.total)}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#9AA3B8', marginTop: '2px' }}>{user ? '부가세 포함' : '로그인 후 확인 가능'}</div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(112,115,124,0.22)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>공급가</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358', ...amountStyle }}>₩{fmt(f.supply)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>마진</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358', ...amountStyle }}>₩{fmt(f.margin)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5A6478' }}>부가세 (10%)</span><span style={{ fontFamily: GROTESK, fontWeight: 600, color: '#3A4358', ...amountStyle }}>₩{fmt(f.vat)}</span></div>
                  </div>
                  <button onClick={() => set({ plan: d.id })} className="iw-press" style={{ marginTop: 'auto', border: `1px solid ${sel ? '#1463F3' : 'rgba(20,99,243,0.4)'}`, background: sel ? '#1463F3' : '#FFFFFF', color: sel ? '#FFFFFF' : '#1463F3', borderRadius: '999px', padding: '12px 0', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .16s' }}>{sel ? '선택된 옵션 ✓' : '이 옵션으로 진행'}</button>
                </div>
              );
            })}
          </div>

          {/* 예산 시뮬레이션 */}
          <div style={{ marginTop: '24px', background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>예산 시뮬레이션</div>
              <div style={{ fontSize: '13.5px', color: '#5A6478' }}>
                예산 한도 <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '19px', color: '#1463F3' }}>{s.budget.toLocaleString('ko-KR')}</span> 만 원
              </div>
            </div>
            <input type="range" min={BUDGET_MIN} max={BUDGET_MAX} step={500} value={s.budget} onChange={(e) => set({ budget: Number(e.target.value) })} style={{ width: '100%', accentColor: '#1463F3', cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9AA3B8', marginTop: '6px', fontFamily: GROTESK }}>
              <span>{BUDGET_MIN.toLocaleString('ko-KR')}</span><span>{BUDGET_MAX.toLocaleString('ko-KR')}</span>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#5A6478' }}>한도를 조정하면 세 옵션의 구성 수량이 예산 안으로 실시간 재계산됩니다.</p>
          </div>

          {/* 게스트: 최종 견적 로그인 게이트 */}
          {!user && (
            <div style={{ marginTop: '24px', background: '#071A3E', borderRadius: '20px', padding: '30px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(79,216,235,0.14)', border: '1px solid rgba(79,216,235,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FD8EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>최종 견적은 로그인 후 확인할 수 있어요</div>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)' }}>로그인하면 표준 레이트카드 120개 항목 기준의 실제 견적과 상세 내역, 통합 기획안까지 바로 받아볼 수 있습니다. 입력하신 내용은 그대로 유지돼요.</p>
              </div>
              <button onClick={signIn} disabled={signingIn} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '14px 30px', fontSize: '15px', fontWeight: 700, cursor: signingIn ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(20,99,243,0.4)', flexShrink: 0, opacity: signingIn ? 0.7 : 1 }}>
                {signingIn ? '로그인 중…' : 'Google로 로그인하고 견적 보기'}
              </button>
            </div>
          )}

          {/* 상세 내역 (로그인 전용) */}
          {user && (
          <div style={{ marginTop: '24px', background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
            <button onClick={() => set({ detailOpen: !s.detailOpen })} className="iw-accordion-head" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '20px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>{planDefs.find((d) => d.id === s.plan)?.name} 상세 내역</span>
              <span style={{ color: '#5A6478', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                레이트카드 기준 {selectedQuote.items.length}개 항목
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: s.detailOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .18s' }}><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </button>
            {s.detailOpen && (
              <div style={{ padding: '0 26px 22px', overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.7fr 1fr 1fr', gap: 0, minWidth: '560px', fontSize: '13.5px' }}>
                  <div style={TH_STYLE}>항목</div>
                  <div style={TH_STYLE}>카테고리</div>
                  <div style={{ ...TH_STYLE, textAlign: 'right' }}>수량</div>
                  <div style={{ ...TH_STYLE, textAlign: 'right' }}>단가</div>
                  <div style={{ ...TH_STYLE, textAlign: 'right' }}>금액</div>
                  {selectedQuote.items.map((it) => (
                    <div key={it.rateCardId || it.itemName} style={{ display: 'contents' }}>
                      <div style={{ padding: '11px 8px', color: '#071A3E', fontWeight: 600, borderBottom: '1px solid rgba(112,115,124,0.12)' }}>{it.itemName}</div>
                      <div style={{ padding: '11px 8px', color: '#5A6478', borderBottom: '1px solid rgba(112,115,124,0.12)' }}>{cardCategory.get(it.rateCardId) ?? '-'}</div>
                      <div style={{ padding: '11px 8px', color: '#3A4358', borderBottom: '1px solid rgba(112,115,124,0.12)', textAlign: 'right', fontFamily: GROTESK }}>{it.qty.toLocaleString('ko-KR')} {it.unit}</div>
                      <div style={{ padding: '11px 8px', color: '#3A4358', borderBottom: '1px solid rgba(112,115,124,0.12)', textAlign: 'right', fontFamily: GROTESK }}>{fmt(it.unitPrice)}</div>
                      <div style={{ padding: '11px 8px', color: '#071A3E', fontWeight: 700, borderBottom: '1px solid rgba(112,115,124,0.12)', textAlign: 'right', fontFamily: GROTESK }}>{fmt(it.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
        </>
      )}

      {shareError && <Notice tone="error">{shareError}</Notice>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => go('step3')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>공유 문서에서 링크 복사·견적서 PDF 다운로드가 가능합니다</span>
            <button onClick={share} disabled={sharing || cardsLoading} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: sharing ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', display: 'flex', alignItems: 'center', gap: '9px', opacity: sharing ? 0.7 : 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
              {sharing ? '저장 중…' : s.currentEventId ? '발주처에 공유' : '프로젝트로 생성하고 발주처에 공유'}
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>공유·PDF 다운로드는 로그인 후 이용할 수 있습니다</span>
        )}
      </div>
    </div>
  );
}

export function Step4Screen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <Step4Body />
    </div>
  );
}
