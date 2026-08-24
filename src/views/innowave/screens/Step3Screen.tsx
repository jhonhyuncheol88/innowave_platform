import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, StepChat, Stepper } from '../components.js';
import { INITIAL_RATE_LIST, INSTRUCTION_TIPS, RATE_CATEGORIES, composeEventSupplies, spanDays, type SupplyPoolItem } from '../data.js';
import {
  applyStepInstruction, errMessage, loadStepInstruction, markInstructionApplied,
  saveSupplies, saveWorkflowStep, useEvent, useRateCards, useSupplies,
  type QuoteInstructionResult,
} from '../hooks.js';
import { fmt, useIw } from '../state.js';
import { useAuth } from '../../../hooks/useAuth.js';
import type { SupplyItem } from '../types.js';

/** 인원 기반 항목(1인당 산정) — 예산 스케일 시 수량을 인원수 그대로 고정한다 */
function isPerPerson(it: SupplyItem): boolean {
  return it.unit.includes('인') || it.unit === '명'
    || ['명찰', '기념품', '리플렛 제작', '교재 및 워크시트 제작'].some((n) => it.name.includes(n));
}

/** 비품 구성의 최종 견적(공급가+마진+부가세)이 예산에 근접하도록 수량을 비례 조정
 *  — 인원 기반 항목은 고정하고, 장비·인쇄·홍보 등 나머지 항목이 예산을 흡수한다 */
function scaleSuppliesToBudget(items: SupplyItem[], budgetWon: number): SupplyItem[] {
  if (budgetWon <= 0 || items.length === 0) return items;
  const gross = (it: SupplyItem) => it.unitPrice * it.qty * (1 + (it.marginRate || 0)) * 1.1;
  const fixedTotal = items.filter(isPerPerson).reduce((sum, it) => sum + gross(it), 0);
  const scalableTotal = items.filter((it) => !isPerPerson(it)).reduce((sum, it) => sum + gross(it), 0);
  if (scalableTotal <= 0) {
    // 전부 인원 기반이면 전체 비례 조정으로 폴백
    const all = fixedTotal;
    if (all <= 0) return items;
    const r = budgetWon / all;
    return items.map((it) => ({ ...it, qty: Math.max(1, Math.round(it.qty * r)) }));
  }
  const ratio = Math.max(0.2, (budgetWon - fixedTotal) / scalableTotal);
  return items.map((it) => (isPerPerson(it) ? it : { ...it, qty: Math.max(1, Math.round(it.qty * ratio)) }));
}

/** 게스트 데모용 풀 — INITIAL_RATE_LIST를 공용 풀 형태로 변환 */
const DEMO_POOL: SupplyPoolItem[] = INITIAL_RATE_LIST
  .filter((r) => r.active)
  .map((r) => ({
    rateCardId: '', name: r.name, cat: r.cat, unit: r.unit,
    unitPrice: r.price, marginRate: (r.margin || 0) / 100,
  }));

function Step3Body() {
  const { s, set, go } = useIw();
  const { user } = useAuth();
  const { event } = useEvent(user ? s.currentEventId : null);
  const { cards, loading: cardsLoading, error: cardsError } = useRateCards(!!user);
  const { supplies: savedSupplies, loading: savedLoading } = useSupplies(user ? s.currentEventId : null);

  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── 하이드레이션: 저장본 복원 → 없으면 AI 추천 초안 (2단계 지침 반영) ──
  const needsHydration = !!user && !!s.currentEventId && s.suppliesEventId !== s.currentEventId;
  useEffect(() => {
    if (!needsHydration || savedLoading || cardsLoading) return;
    // 예산(basicInfo.budgetLimit)이 필요하므로 이벤트 로드까지 대기 — 저장본/초안 모두 예산에 맞춰 채운다
    if (!event) return;
    const budgetWon = event.basicInfo.budgetLimit || 0;
    if (savedSupplies.length > 0) {
      // 저장된 비품도 최초 진입 시 예산에 맞춰 스케일 → 3단계 비품 = 견적서 = 문서(≈예산) 일치
      set({ supplies: scaleSuppliesToBudget(savedSupplies, budgetWon), suppliesEventId: s.currentEventId });
      setIsDraft(false);
      return;
    }
    if (cards.length === 0) return;
    // 행사 유형·규모·일수·운영형태에 맞는 비품 구성 → 예산에 맞춰 수량 스케일
    const b = event.basicInfo;
    const pool: SupplyPoolItem[] = cards
      .filter((c) => c.isActive)
      .map((c) => ({
        rateCardId: c.id ?? '', name: c.itemName, cat: c.category,
        unit: c.unit, unitPrice: c.unitPrice, marginRate: c.marginRate,
      }));
    const composed = composeEventSupplies(
      pool, b.eventType, b.participantScale || 100, spanDays(b.periodStart, b.periodEnd), b.operationType,
    );
    const draft: SupplyItem[] = scaleSuppliesToBudget(composed, budgetWon);
    set({ supplies: draft, suppliesEventId: s.currentEventId });
    setIsDraft(true);
    // 2단계에서 입력한 지침 문서(events/{id}/instructions/toStep3)가 있으면 추천 수량 조정
    const eventId = s.currentEventId!;
    void loadStepInstruction(eventId, 'toStep3')
      .then((instruction) => {
        if (!instruction) return;
        setAiApplying(true);
        setAiError(null);
        applyStepInstruction<QuoteInstructionResult>(
          'quote', instruction, event.basicInfo,
          draft.map((d) => ({ rateCardId: d.rateCardId, itemName: d.name, unit: d.unit, qty: d.qty, unitPrice: d.unitPrice })),
        )
          .then((r) => {
            if (!r.items?.length) return;
            const qtyMap = new Map(r.items.map((it) => [it.rateCardId, it.qty]));
            set({
              supplies: draft
                .map((d) => (qtyMap.has(d.rateCardId) ? { ...d, qty: qtyMap.get(d.rateCardId)! } : d))
                .filter((d) => d.qty > 0),
            });
            setAiNote(r.note || null);
            void markInstructionApplied(eventId, 'toStep3', r.note || '').catch(() => {});
          })
          .catch((e) => setAiError(errMessage(e)))
          .finally(() => setAiApplying(false));
      })
      .catch(() => {});
  }, [needsHydration, savedLoading, cardsLoading, savedSupplies, event, cards, s.currentEventId, set]);

  // 게스트: 행사 유형에 맞는 데모 추천 구성 (예산 스케일 포함)
  useEffect(() => {
    if (user || s.supplies.length > 0) return;
    const g = s.guestInfo;
    const composed = composeEventSupplies(
      DEMO_POOL, g?.eventType || '포럼·컨퍼런스', g?.participantScale || 100,
      spanDays(g?.periodStart, g?.periodEnd), g?.operationType || '오프라인',
    );
    set({ supplies: scaleSuppliesToBudget(composed, g?.budgetLimit || 0) });
  }, [user, s.supplies.length, s.guestInfo, set]);

  const patchItem = (idx: number, qty: number) => {
    set({ supplies: s.supplies.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, qty) } : it)) });
  };
  const removeItem = (idx: number) => {
    set({ supplies: s.supplies.filter((_, i) => i !== idx) });
  };

  /** AI 어시스턴트: 대화로 비품 구성을 즉시 수정 (수량 조정·제외) */
  const chatApply = async (message: string) => {
    const r = await applyStepInstruction<QuoteInstructionResult>(
      'quote', message, event?.basicInfo ?? s.guestInfo ?? {},
      s.supplies.map((d) => ({ rateCardId: d.rateCardId || d.name, itemName: d.name, unit: d.unit, qty: d.qty, unitPrice: d.unitPrice })),
    );
    if (r.items?.length) {
      const qtyMap = new Map(r.items.map((it) => [it.rateCardId, it.qty]));
      set({
        supplies: s.supplies
          .map((d) => {
            const key = d.rateCardId || d.name;
            return qtyMap.has(key) ? { ...d, qty: qtyMap.get(key)! } : d;
          })
          .filter((d) => d.qty > 0),
      });
    }
    return r.note;
  };

  // ── 비품 추가 모달 ──
  const [addOpen, setAddOpen] = useState(false);
  const [addCat, setAddCat] = useState('전체');
  const [addQuery, setAddQuery] = useState('');

  /** 추가 후보 목록 — 로그인: 레이트카드, 게스트: 데모 목록 */
  const candidates: SupplyItem[] = useMemo(() => {
    if (user) {
      return cards
        .filter((c) => c.isActive)
        .map((c) => ({
          rateCardId: c.id ?? '', name: c.itemName, cat: c.category, unit: c.unit,
          unitPrice: c.unitPrice, marginRate: c.marginRate, qty: 1, source: 'user' as const,
        }));
    }
    return INITIAL_RATE_LIST.filter((r) => r.active).map((r) => ({
      rateCardId: '', name: r.name, cat: r.cat, unit: r.unit,
      unitPrice: r.price, marginRate: (r.margin || 0) / 100, qty: 1, source: 'user' as const,
    }));
  }, [user, cards]);

  const addCats = useMemo(
    () => ['전체', ...(candidates.length ? Array.from(new Set(candidates.map((c) => c.cat))).sort((a, b) => a.localeCompare(b, 'ko')) : [...RATE_CATEGORIES])],
    [candidates],
  );
  const usedKeys = useMemo(() => new Set(s.supplies.map((it) => it.rateCardId || it.name)), [s.supplies]);
  const q = addQuery.trim().toLowerCase();
  const addRows = candidates.filter((c) =>
    !usedKeys.has(c.rateCardId || c.name)
    && (addCat === '전체' || c.cat === addCat)
    && (!q || c.name.toLowerCase().includes(q)));

  // ── 합계 · 예산 게이지 ──
  const supplyTotal = s.supplies.reduce((a, it) => a + it.unitPrice * it.qty, 0);
  const budgetWon = event?.basicInfo.budgetLimit || s.guestInfo?.budgetLimit || 0;
  const budgetRatio = budgetWon > 0 ? supplyTotal / budgetWon : 0;
  const overBudget = budgetWon > 0 && budgetRatio > 1;

  const goNext = async () => {
    setSaveError(null);
    if (!s.currentEventId || !user) { go('step4'); return; }
    setBusy(true);
    try {
      await saveSupplies(s.currentEventId, s.supplies);
      // 비품 확정 → 인력 매칭 단계로 (상태·currentStep은 앞으로만)
      await saveWorkflowStep(s.currentEventId, 'matching', 4);
      setIsDraft(false);
      go('step4');
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const loadingList = !!user && !!s.currentEventId && (savedLoading || cardsLoading) && s.supplies.length === 0;

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
      <Stepper current={3} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>행사 비품을 확인하세요</h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>AI가 행사 유형·규모·예산에 맞춰 추천한 구성입니다. 수량을 조정하거나 항목을 추가·삭제하세요.</p>
        </div>
        <div style={{ display: 'flex', gap: '20px', background: '#FFFFFF', borderRadius: '16px', boxShadow: CARD_SHADOW, padding: '13px 22px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#5A6478' }}>선택 항목</div>
            <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '20px', color: '#071A3E' }}>
              {s.supplies.length}
              <span style={{ fontSize: '13px', fontFamily: "'Pretendard Variable',Pretendard,sans-serif", fontWeight: 600, color: '#5A6478' }}> 개</span>
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(112,115,124,0.22)' }} />
          <div>
            <div style={{ fontSize: '12px', color: '#5A6478' }}>공급가 합계</div>
            <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '20px', color: overBudget ? '#E5484D' : '#1463F3' }}>₩{fmt(supplyTotal)}</div>
          </div>
        </div>
      </div>

      <div className="iw-chat-layout">
        <div className="iw-chat-side">
          <StepChat
            title="AI 어시스턴트"
            description="대화로 비품 구성을 바로 수정하세요. 보내는 즉시 위 목록에 반영되고, 4단계 인력 추천에도 참고됩니다."
            eventId={user ? s.currentEventId : null}
            stepKey="step3"
            instructionKey="toStep4"
            examples={[
              '홍보물 비중을 줄이고 전문가 섭외 비중을 늘려줘.',
              '케이터링은 참가 인원의 80% 기준으로 잡아줘.',
              '무대·음향 장비는 최소 구성으로 잡아줘.',
            ]}
            tips={INSTRUCTION_TIPS}
            disabled={!user}
            onApply={chatApply}
          />
        </div>
        <div style={{ minWidth: 0 }}>
      {!user && (
        <Notice tone="info">지금은 데모 추천 구성입니다. 로그인하면 실측 견적·시장조사 기반 레이트카드로 실제 추천을 받아요.</Notice>
      )}
      {cardsError && <Notice tone="error">{cardsError}</Notice>}
      {isDraft && s.currentEventId && !aiApplying && (
        <Notice tone="info">아직 저장된 비품 구성이 없어 AI 추천 초안을 보여드립니다. &lsquo;다음 단계로&rsquo;를 누르면 프로젝트에 저장됩니다.</Notice>
      )}
      {aiApplying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E5F0FF', borderRadius: '14px', padding: '13px 18px', marginBottom: '14px' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '3px solid #FFFFFF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0D3B8F' }}>AI가 2단계 지침을 반영해 비품 구성을 조정하고 있어요…</span>
        </div>
      )}
      {aiNote && !aiApplying && <Notice tone="success">AI 지침 반영 — {aiNote}</Notice>}
      {aiError && !aiApplying && <Notice tone="error">지침 반영에 실패해 기본 추천을 표시합니다: {aiError}</Notice>}

      {/* 예산 게이지 */}
      {budgetWon > 0 && (
        <div style={{ background: '#FFFFFF', borderRadius: '16px', boxShadow: CARD_SHADOW, padding: '16px 22px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: overBudget ? '#B3261E' : '#0D3B8F' }}>
              예산 한도 대비 {Math.round(budgetRatio * 100)}%{overBudget ? ' — 예산을 초과했습니다' : ''}
            </span>
            <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>한도 ₩{fmt(budgetWon)} · 공급가 기준(마진·부가세 제외)</span>
          </div>
          <div style={{ height: '8px', borderRadius: '999px', background: '#EEF1F6', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, budgetRatio * 100)}%`, height: '100%', borderRadius: '999px', background: overBudget ? '#E5484D' : budgetRatio > 0.85 ? '#F5A623' : '#1463F3', transition: 'width .3s' }} />
          </div>
        </div>
      )}

      {loadingList ? (
        <Loading label="비품 구성을 불러오는 중…" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {s.supplies.map((it, i) => (
            <div key={`${it.rateCardId || it.name}-${i}`} className="iw-program-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#FFFFFF', borderRadius: '18px', boxShadow: CARD_SHADOW, padding: '14px 20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#071A3E' }}>{it.name}</span>
                  <span style={{ background: it.source === 'ai' ? '#E5F0FF' : '#EEF1F6', color: it.source === 'ai' ? '#1463F3' : '#5A6478', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{it.source === 'ai' ? 'AI 추천' : '직접 추가'}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#9AA3B8', marginTop: '3px' }}>{it.cat} · 단가 ₩{fmt(it.unitPrice)}/{it.unit}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => patchItem(i, it.qty - 1)} title="수량 줄이기" style={{ width: '30px', height: '30px', borderRadius: '9px', border: '1px solid rgba(112,115,124,0.25)', background: '#FFFFFF', cursor: 'pointer', fontSize: '15px', color: '#5A6478', fontFamily: 'inherit' }}>−</button>
                <input
                  type="number" min={1} value={it.qty}
                  onChange={(e) => patchItem(i, Number(e.target.value) || 1)}
                  style={{ width: '64px', textAlign: 'center', border: '1px solid rgba(112,115,124,0.25)', borderRadius: '9px', padding: '6px 4px', fontSize: '14px', fontFamily: GROTESK, fontWeight: 600, color: '#071A3E' }}
                />
                <button onClick={() => patchItem(i, it.qty + 1)} title="수량 늘리기" style={{ width: '30px', height: '30px', borderRadius: '9px', border: '1px solid rgba(112,115,124,0.25)', background: '#FFFFFF', cursor: 'pointer', fontSize: '15px', color: '#5A6478', fontFamily: 'inherit' }}>＋</button>
              </div>
              <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '15px', color: '#0D3B8F', width: '110px', textAlign: 'right', flexShrink: 0 }}>₩{fmt(it.unitPrice * it.qty)}</div>
              <button
                onClick={() => removeItem(i)} title="삭제" className="iw-icon-delete"
                style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6478', flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          ))}
          <button
            onClick={() => { setAddOpen(true); setAddCat('전체'); setAddQuery(''); }}
            className="iw-btn-dashed"
            style={{ border: '2px dashed rgba(20,99,243,0.35)', background: 'transparent', borderRadius: '18px', padding: '15px', fontSize: '14.5px', fontWeight: 700, color: '#1463F3', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .16s' }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>＋</span> 비품 추가
          </button>
        </div>
      )}


      {saveError && <div style={{ marginTop: '18px' }}><Notice tone="error">{saveError}</Notice></div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => go('step2')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
        <button onClick={goNext} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '저장 중…' : '다음 단계로'}</button>
      </div>
        </div>
      </div>

      {/* 비품 추가 모달 */}
      {addOpen && (
        <div
          onClick={() => setAddOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.45)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRadius: '20px', boxShadow: '0 24px 64px rgba(7,26,62,0.35)', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#071A3E' }}>비품 추가</h2>
              <button onClick={() => setAddOpen(false)} title="닫기" className="iw-btn-close" style={{ width: '32px', height: '32px', borderRadius: '999px', border: 'none', background: '#EEF1F6', color: '#5A6478', cursor: 'pointer', fontSize: '14px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
            </div>
            <input
              type="text" value={addQuery} onChange={(e) => setAddQuery(e.target.value)}
              placeholder="항목명 검색" className="iw-input"
              style={{ width: '100%', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '12px', padding: '11px 14px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {addCats.map((c) => (
                <button key={c} onClick={() => setAddCat(c)} style={{ border: `1px solid ${addCat === c ? '#1463F3' : 'rgba(112,115,124,0.25)'}`, background: addCat === c ? '#1463F3' : '#FFFFFF', color: addCat === c ? '#FFFFFF' : '#3A4358', borderRadius: '999px', padding: '6px 13px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{c}</button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {addRows.length === 0 && (
                <p style={{ margin: '18px 0', textAlign: 'center', fontSize: '13.5px', color: '#9AA3B8' }}>추가할 수 있는 항목이 없습니다.</p>
              )}
              {addRows.map((c) => (
                <div key={c.rateCardId || c.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(112,115,124,0.18)', borderRadius: '14px', padding: '11px 14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#071A3E' }}>{c.name}</div>
                    <div style={{ fontSize: '12px', color: '#9AA3B8', marginTop: '2px' }}>{c.cat} · ₩{fmt(c.unitPrice)}/{c.unit}</div>
                  </div>
                  <button
                    onClick={() => { set({ supplies: [...s.supplies, { ...c }] }); }}
                    className="iw-btn-outline-blue"
                    style={{ border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '7px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >추가</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Step3Screen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <Step3Body />
    </div>
  );
}
