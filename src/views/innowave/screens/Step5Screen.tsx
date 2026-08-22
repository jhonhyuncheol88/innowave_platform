import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, Stepper } from '../components.js';
import {
  applyStepInstruction, buildOptionQuote, buildQuoteItems, errMessage, invalidateCache, loadStepInstruction,
  markInstructionApplied, saveWorkflowStep, useEvent, useLatestQuote, useQuoteParams, useRateCards, useSupplies,
  type QuoteInstructionResult,
} from '../hooks.js';
import { fmt, mkQuote, useIw } from '../state.js';
import type { PlanId } from '../types.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { Event } from '../../../models/Event.js';
import { QuoteItem, type QuoteOptionValue } from '../../../models/Quote.js';
import { WorkflowDocsSection } from './WorkflowDocs.js';
import { eventRepository } from '../../../repositories/EventRepository.js';

const TH_STYLE = {
  padding: '10px 8px', fontWeight: 700, color: '#5A6478',
  borderBottom: '1px solid rgba(112,115,124,0.22)', fontSize: '12.5px',
} as const;

const BUDGET_MIN = 1000;
const BUDGET_MAX = 20000;

function Step5Body() {
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

  // ── 기존 프로젝트 수정: 저장된 최신 견적의 옵션(Basic/Standard/Premium) 복원 ──
  const { quote: savedQuote, loading: savedQuoteLoading } = useLatestQuote(user ? s.currentEventId : null);
  useEffect(() => {
    if (!user || !s.currentEventId || s.planEventId === s.currentEventId || savedQuoteLoading) return;
    set({
      ...(savedQuote ? { plan: savedQuote.optionType as PlanId } : {}),
      planEventId: s.currentEventId,
    });
  }, [user, s.currentEventId, s.planEventId, savedQuoteLoading, savedQuote, set]);

  const signIn = () => {
    setSigningIn(true);
    setShareError(null);
    signInWithGoogle()
      .catch((e) => setShareError((e as Error).message))
      .finally(() => setSigningIn(false));
  };

  // 3단계에서 확정한 비품 선택이 있으면 그 구성으로 견적 산출, 없으면 카테고리 휴리스틱 폴백
  const { supplies: savedSupplies } = useSupplies(user ? s.currentEventId : null);
  const items = useMemo(() => {
    if (savedSupplies.length > 0) {
      return savedSupplies
        .filter((it) => it.qty > 0)
        .map((it) => new QuoteItem({
          rateCardId: it.rateCardId, itemName: it.name, unit: it.unit,
          qty: it.qty, unitPrice: it.unitPrice, marginRate: it.marginRate,
        }));
    }
    return buildQuoteItems(cards, event);
  }, [savedSupplies, cards, event]);

  // ── 4단계에서 입력한 지침 문서(events/{id}/instructions/toStep5)를 반영해 견적 수량 조정 ──
  const [quoteInstruction, setQuoteInstruction] = useState('');
  const quoteInstrLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !event?.id || quoteInstrLoadedRef.current === event.id) return;
    quoteInstrLoadedRef.current = event.id;
    void loadStepInstruction(event.id, 'toStep5').then(setQuoteInstruction).catch(() => {});
  }, [user, event]);
  const [aiQty, setAiQty] = useState<Record<string, number> | null>(null);
  const [aiQuoteNote, setAiQuoteNote] = useState<string | null>(null);
  const [aiQuoteLoading, setAiQuoteLoading] = useState(false);
  const [aiQuoteError, setAiQuoteError] = useState<string | null>(null);
  const aiQuoteFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !quoteInstruction || !event?.id || items.length === 0) return;
    if (aiQuoteFor.current === event.id) return;
    aiQuoteFor.current = event.id;
    setAiQuoteLoading(true);
    setAiQuoteError(null);
    applyStepInstruction<QuoteInstructionResult>(
      'quote', quoteInstruction, event.basicInfo,
      items.map((i) => ({ rateCardId: i.rateCardId, itemName: i.itemName, unit: i.unit, qty: i.qty, unitPrice: i.unitPrice })),
    )
      .then((r) => {
        if (!r.items?.length) return;
        setAiQty(Object.fromEntries(r.items.map((it) => [it.rateCardId, it.qty])));
        setAiQuoteNote(r.note || null);
        if (event?.id) void markInstructionApplied(event.id, 'toStep5', r.note || '').catch(() => {});
      })
      .catch((e) => setAiQuoteError(errMessage(e)))
      .finally(() => setAiQuoteLoading(false));
  }, [user, quoteInstruction, event, items]);

  /** 지침 반영 수량이 있으면 적용 (qty 0은 제외 처리) — 단가·항목은 레이트카드 기준 유지 */
  const effectiveItems = useMemo(() => {
    if (!aiQty) return items;
    return items
      .map((i) => {
        const q = aiQty[i.rateCardId];
        return q === undefined ? i : new QuoteItem({ ...i, qty: q });
      })
      .filter((i) => i.qty > 0);
  }, [items, aiQty]);
  const cardCategory = useMemo(() => {
    const m = new Map<string, string>();
    cards.forEach((c) => { if (c.id) m.set(c.id, c.category); });
    return m;
  }, [cards]);

  // 최종 견적 — 3단계 비품 구성 그대로 (옵션 배율 없음), 예산 한도 반영
  const budgetWon = s.budget * 10000;
  const selectedQuote = useMemo(
    () => buildOptionQuote(effectiveItems, 'standard' as QuoteOptionValue, 1.0, budgetWon),
    [effectiveItems, budgetWon],
  );

  // 게스트: 실제 레이트카드 없이 예산 기반 데모 수치를 만들어 블러 처리로만 노출
  const figures = user
    ? { supply: selectedQuote.subtotal, margin: selectedQuote.marginTotal, vat: selectedQuote.vat, total: selectedQuote.total }
    : mkQuote(s.budget, 1.0, s.qpMargin, s.qpVat);
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
          currentStep: 5,
        }));
        eventId = created.id;
        set({ currentEventId: eventId });
      }
      await eventRepository.quoteRepo(eventId!).create(selectedQuote);
      // 상태·currentStep은 앞으로만 — confirmed/in_progress 프로젝트의 재견적 시 회귀 방지
      await saveWorkflowStep(eventId!, 'quoted', 5);
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
      <Stepper current={5} />

      <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>최종 견적을 확인하세요</h1>
      <p style={{ margin: '0 0 26px', fontSize: '15px', color: '#5A6478' }}>
        {savedSupplies.length > 0
          ? `3단계에서 선택한 비품 ${savedSupplies.length}개 항목을 기준으로 산출한 최종 견적입니다.`
          : `표준 레이트카드 ${cards.length > 0 ? `${cards.length}개 ` : ''}항목을 기준으로 산출한 최종 견적입니다.`}
        {event ? ` — ${event.basicInfo.name}` : ''}
      </p>

      {cardsError && <Notice tone="error">{cardsError}</Notice>}
      {aiQuoteLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E5F0FF', borderRadius: '14px', padding: '13px 18px', marginBottom: '14px' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '3px solid #FFFFFF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0D3B8F' }}>AI가 4단계 지침을 반영해 견적 수량을 조정하고 있어요…</span>
        </div>
      )}
      {aiQuoteNote && !aiQuoteLoading && <Notice tone="success">AI 지침 반영 — {aiQuoteNote}</Notice>}
      {aiQuoteError && !aiQuoteLoading && <Notice tone="error">지침 반영에 실패해 기본 수량으로 산출합니다: {aiQuoteError}</Notice>}
      {user && cardsLoading ? (
        <Loading label="레이트카드를 불러오는 중…" />
      ) : (
        <>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '30px clamp(18px,4vw,34px)', border: '2px solid #1463F3', boxShadow: CARD_SHADOW }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#5A6478', marginBottom: '6px' }}>최종 견적 (부가세 포함)</div>
                <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 'clamp(34px,4vw,44px)', letterSpacing: '-0.02em', color: '#1463F3', lineHeight: 1.05 }}>
                  ₩<span style={amountStyle}>{fmt(figures.total)}</span>
                </div>
                {!user && <div style={{ fontSize: '12.5px', color: '#9AA3B8', marginTop: '4px' }}>로그인 후 확인 가능</div>}
              </div>
              <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '12.5px', color: '#5A6478', marginBottom: '3px' }}>공급가</div><div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '17px', color: '#071A3E', ...amountStyle }}>₩{fmt(figures.supply)}</div></div>
                <div><div style={{ fontSize: '12.5px', color: '#5A6478', marginBottom: '3px' }}>마진</div><div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '17px', color: '#071A3E', ...amountStyle }}>₩{fmt(figures.margin)}</div></div>
                <div><div style={{ fontSize: '12.5px', color: '#5A6478', marginBottom: '3px' }}>부가세 (10%)</div><div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '17px', color: '#071A3E', ...amountStyle }}>₩{fmt(figures.vat)}</div></div>
              </div>
            </div>
          </div>

          {/* 게스트: 최종 견적 로그인 게이트 */}
          {!user && (
            <div style={{ marginTop: '24px', background: '#071A3E', borderRadius: '20px', padding: '30px clamp(16px,5vw,32px)', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(79,216,235,0.14)', border: '1px solid rgba(79,216,235,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4FD8EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>최종 견적은 로그인 후 확인할 수 있어요</div>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)' }}>로그인하면 실제 수행 견적 기반 표준 레이트카드 기준의 실제 견적과 상세 내역, 통합 기획안까지 바로 받아볼 수 있습니다. 입력하신 내용은 그대로 유지돼요.</p>
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
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>최종 견적 상세 내역</span>
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

          {/* 산출 문서 — 운영사업 제안서 · 과업지시서 (프로젝트 저장된 로그인 사용자 전용) */}
          {user && event && s.currentEventId && (
            <WorkflowDocsSection
              eventId={s.currentEventId}
              event={event}
              quote={selectedQuote}
              planName="최종"
              instruction={quoteInstruction}
            />
          )}
          {user && !s.currentEventId && (
            <div style={{ marginTop: '24px' }}>
              <Notice tone="info">제안서·과업지시서 생성은 프로젝트 저장 후 가능합니다. 1단계부터 &lsquo;다음 단계로&rsquo;를 눌러 프로젝트를 만들어 주세요.</Notice>
            </div>
          )}
        </>
      )}

      {shareError && <Notice tone="error">{shareError}</Notice>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => go('step4')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>공유 문서에서 제안서·과업지시서 열람과 PDF 다운로드가 가능합니다</span>
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

export function Step5Screen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <Step5Body />
    </div>
  );
}
