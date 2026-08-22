import { useEffect, useMemo, useRef, useState } from 'react';
import { CARD_SHADOW, GROTESK, InstructionBox, Loading, Notice, Stepper } from '../components.js';
import { INSTRUCTION_EXAMPLES, INSTRUCTION_TIPS, PEOPLE_DATA } from '../data.js';
import {
  applyStepInstruction, errMessage, loadStepInstruction, loadWorkflowDocument, markInstructionApplied,
  pendingDocumentGeneration, saveMatches, saveStepInstruction, saveWorkflowStep, startDocumentPregeneration,
  useEvent, useMatches, usePersonnel,
  type MatchSelection, type MatchingInstructionResult,
} from '../hooks.js';
import { fmt, selectionSummary, useIw } from '../state.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { Event } from '../../../models/Event.js';
import { Personnel } from '../../../models/Personnel.js';

const ROLES = ['강사', '멘토', '심사위원', '운영인력'];
const AVATAR_COLORS = ['#0D3B8F', '#1463F3', '#26B8CE', '#3A4358'];

/** 선택 시점의 매칭 정보 스냅샷 — 화면 재마운트에도 유지되도록 모듈 수준에 보관 */
const selectionInfo = new Map<string, MatchSelection>();

function Step4Body() {
  const { s, set, go } = useIw();
  const { user } = useAuth();
  const { event: loadedEvent } = useEvent(s.currentEventId);
  const { people, loading, error } = usePersonnel(s.roleTab, 60, !!user);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 5단계 입장 게이트 — 제안서·과업지시서 생성 대기 팝업 상태
  const [docGenState, setDocGenState] = useState<'idle' | 'running' | 'failed'>('idle');

  // ── 기존 프로젝트 수정: 저장된 인력 선택(events/{id}/matches) 복원 ──
  const { matches: savedMatches, loading: matchesLoading } = useMatches(user ? s.currentEventId : null);
  useEffect(() => {
    if (!user || !s.currentEventId || s.matchesEventId === s.currentEventId || matchesLoading) return;
    const selected: Record<string, boolean> = {};
    savedMatches.forEach((m) => {
      const key = `${m.role}:${m.personnelId}`;
      selected[key] = true;
      selectionInfo.set(key, m);
    });
    set({ selected, matchesEventId: s.currentEventId });
  }, [user, s.currentEventId, s.matchesEventId, matchesLoading, savedMatches, set]);

  // 매칭 점수 산정 대상 — 이벤트가 없으면 게스트 입력값 → 기본 조건 순으로 채점
  const event = useMemo(
    () => loadedEvent
      ?? new Event({ ownerUid: '', basicInfo: s.guestInfo ?? { region: '서울', operationType: '오프라인' } }),
    [loadedEvent, s.guestInfo],
  );

  const ranked = useMemo(() => {
    // 비로그인 게스트: rules상 인력풀 조회가 불가하므로 데모 인력으로 추천 흐름 제공
    if (!user) {
      return (PEOPLE_DATA[s.roleTab] ?? []).map((d, i) => ({
        p: new Personnel({
          id: `demo-${s.roleTab}-${i}`,
          name: d.name,
          role: s.roleTab,
          expertiseField: d.tags,
          careerSummary: d.summary,
          rating: Number(d.rating),
          activityRegion: d.region,
          unitRate: d.rate,
        }),
        fit: d.fit,
      }));
    }
    return people
      .map((p) => ({ p, fit: Math.round(p.matchScoreFor(event)) }))
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 8);
  }, [user, s.roleTab, people, event]);

  const selSummary = selectionSummary(s.selected);
  /** 선택 인력의 계약 단가 합계 (1일 기준) — 선택 시점 스냅샷 기준 */
  const selectedRateTotal = Object.keys(s.selected)
    .reduce((a, k) => a + (selectionInfo.get(k)?.unitRateSnapshot || 0), 0);

  // ── 단계별 AI 지침 ──
  const [instr5, setInstr5] = useState('');            // 5단계(견적)용 지침 입력
  const instrHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !loadedEvent?.id || instrHydratedRef.current === loadedEvent.id) return;
    instrHydratedRef.current = loadedEvent.id;
    void loadStepInstruction(loadedEvent.id, 'toStep5').then(setInstr5).catch(() => {});
  }, [user, loadedEvent]);

  // 3단계에서 입력한 지침 문서(events/{id}/instructions/toStep4)를 반영해 현재 역할 탭의 추천 인력 산출
  const [matchInstruction, setMatchInstruction] = useState('');
  const matchInstrLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !loadedEvent?.id || matchInstrLoadedRef.current === loadedEvent.id) return;
    matchInstrLoadedRef.current = loadedEvent.id;
    void loadStepInstruction(loadedEvent.id, 'toStep4').then(setMatchInstruction).catch(() => {});
  }, [user, loadedEvent]);
  const [recs, setRecs] = useState<Record<string, MatchingInstructionResult>>({});
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const recRequestedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !matchInstruction || loading || ranked.length === 0) return;
    const key = `${loadedEvent?.id ?? ''}:${s.roleTab}`;
    if (recRequestedRef.current.has(key)) return;
    recRequestedRef.current.add(key);
    setRecLoading(true);
    setRecError(null);
    applyStepInstruction<MatchingInstructionResult>(
      'matching', matchInstruction, event.basicInfo,
      ranked.map(({ p, fit }) => ({
        id: p.id ?? '', name: p.name, role: s.roleTab, field: p.expertiseField,
        career: p.careerSummary, region: p.activityRegion, rating: p.rating, fit,
      })),
    )
      .then((r) => {
        setRecs((m) => ({ ...m, [s.roleTab]: r }));
        if (loadedEvent?.id) void markInstructionApplied(loadedEvent.id, 'toStep4', r.note || '').catch(() => {});
      })
      .catch((e) => setRecError(errMessage(e)))
      .finally(() => setRecLoading(false));
  }, [user, matchInstruction, loading, ranked, s.roleTab, loadedEvent?.id, event]);

  const roleRec = recs[s.roleTab];

  const goNext = async () => {
    setSaveError(null);
    // 프로젝트가 없거나 로그아웃 상태면 저장 없이 게스트로 진행
    if (!s.currentEventId || !user) { go('step5'); return; }
    setBusy(true);
    try {
      const selections: MatchSelection[] = Object.keys(s.selected).map((key) => {
        const stashed = selectionInfo.get(key);
        if (stashed) return stashed;
        const [role, ...rest] = key.split(':');
        return { personnelId: rest.join(':'), role, matchScore: 0, unitRateSnapshot: 0 };
      });
      await saveMatches(s.currentEventId, selections);
      // 상태·currentStep은 앞으로만 — 진행 중 프로젝트 수정 시 회귀 방지
      await saveWorkflowStep(s.currentEventId, 'matching', 5);
      await saveStepInstruction(s.currentEventId, 'toStep5', instr5);
      // 5단계 입장 게이트 — 제안서·과업지시서가 만들어진 후에만 이동
      if (loadedEvent) {
        const eventId = s.currentEventId;
        const [hasProposal, hasWorkorder] = await Promise.all([
          loadWorkflowDocument(eventId, 'proposal'),
          loadWorkflowDocument(eventId, 'workorder'),
        ]);
        if (!hasProposal || !hasWorkorder) {
          const roleCounts = selections.reduce<Record<string, number>>((a, m) => ({ ...a, [m.role]: (a[m.role] || 0) + 1 }), {});
          startDocumentPregeneration(eventId, {
            eventInfo: loadedEvent.basicInfo,
            programs: s.programs.map((p) => ({ time: p.time, name: p.name, dur: p.dur })),
            supplies: s.supplies.map((it) => ({ name: it.name, cat: it.cat, qty: it.qty, unit: it.unit })),
            personnel: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
            quote: { total: loadedEvent.basicInfo.budgetLimit || null, note: '예산 한도 기준 (상세 예산안 별첨)' },
            instruction: instr5 || null,
          });
          setDocGenState('running');
          await pendingDocumentGeneration(eventId);
          const [p1, p2] = await Promise.all([
            loadWorkflowDocument(eventId, 'proposal'),
            loadWorkflowDocument(eventId, 'workorder'),
          ]);
          if (!p1 || !p2) {
            setDocGenState('failed');
            return;
          }
          setDocGenState('idle');
        }
      }
      go('step5');
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
      <Stepper current={4} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>전문가·운영 인력을 선택하세요</h1>
          <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>
            {loadedEvent ? `‘${loadedEvent.basicInfo.name}’에 맞춰 ` : '행사 목적과 프로그램에 맞춰 '}적합도가 높은 순으로 추천해 드립니다.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#5A6478' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M10 18h4" /></svg>
          적합도 높은 순
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {ROLES.map((r) => {
          const active = s.roleTab === r;
          return (
            <button key={r} onClick={() => set({ roleTab: r })} style={{ border: `1px solid ${active ? '#1463F3' : 'rgba(112,115,124,0.28)'}`, cursor: 'pointer', borderRadius: '999px', padding: '10px 22px', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', transition: 'all .16s', background: active ? '#1463F3' : '#FFFFFF', color: active ? '#FFFFFF' : '#3A4358' }}>{r}</button>
          );
        })}
      </div>

      {!user && (
        <Notice tone="info">지금은 데모 추천입니다. 로그인하면 검증된 인력풀 500명을 행사 조건에 맞춰 추천해 드려요.</Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {recLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E5F0FF', borderRadius: '14px', padding: '13px 18px', marginBottom: '14px' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '999px', border: '3px solid #FFFFFF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0D3B8F' }}>AI가 3단계 지침을 반영해 추천 인력을 고르고 있어요…</span>
        </div>
      )}
      {roleRec && !recLoading && <Notice tone="success">AI 지침 반영 추천 — {roleRec.note}</Notice>}
      {recError && !recLoading && <Notice tone="error">지침 반영 추천에 실패했습니다 (적합도순 기본 추천 표시): {recError}</Notice>}
      {user && loading ? (
        <Loading label="인력풀을 불러오는 중…" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: '18px' }}>
          {ranked.map(({ p, fit }, i) => {
            const key = `${s.roleTab}:${p.id}`;
            const sel = !!s.selected[key];
            const toggle = () => {
              const next = { ...s.selected };
              if (next[key]) {
                delete next[key];
                selectionInfo.delete(key);
              } else {
                next[key] = true;
                selectionInfo.set(key, {
                  personnelId: p.id ?? '',
                  role: s.roleTab,
                  matchScore: fit,
                  unitRateSnapshot: p.unitRate,
                });
              }
              set({ selected: next });
            };
            const aiPick = !!roleRec?.recommendedIds?.includes(p.id ?? '');
            return (
              <div key={p.id ?? p.name} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: aiPick ? '2px solid rgba(20,99,243,0.55)' : i === 0 ? '2px solid rgba(79,216,235,0.6)' : '2px solid transparent', boxShadow: CARD_SHADOW, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '999px', background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{p.name[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>{p.name}</span>
                      <span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>적합도 <span style={{ fontFamily: GROTESK }}>{fit}</span>점</span>
                      {aiPick && <span style={{ background: '#1463F3', color: '#FFFFFF', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>지침 추천</span>}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#5A6478', marginTop: '2px' }}>{p.expertiseField}</div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: '#3A4358' }}>{p.careerSummary || p.affiliation || '경력 정보 준비 중'}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#5A6478' }}>
                  <span style={{ color: '#F5A623', fontWeight: 700 }}>★ <span style={{ fontFamily: GROTESK }}>{p.rating.toFixed(1)}</span></span>
                  <span>{p.activityRegion}</span>
                </div>
                {p.unitRate > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', background: '#F6F9FF', borderRadius: '11px', padding: '9px 13px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#5A6478' }}>계약 단가</span>
                    <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0D3B8F', fontFamily: GROTESK }}>₩{fmt(p.unitRate)}<span style={{ fontSize: '11.5px', fontFamily: "'Pretendard Variable',Pretendard,sans-serif", fontWeight: 600, color: '#9AA3B8' }}> /일</span></span>
                  </div>
                )}
                <button onClick={toggle} className="iw-press" style={{ border: `1px solid ${sel ? '#1463F3' : 'rgba(20,99,243,0.4)'}`, background: sel ? '#1463F3' : '#FFFFFF', color: sel ? '#FFFFFF' : '#1463F3', borderRadius: '999px', padding: '10px 0', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .16s' }}>{sel ? '선택됨 ✓' : '선택'}</button>
              </div>
            );
          })}
        </div>
      )}

      {selSummary.length > 0 && (
        <div style={{ marginTop: '24px', background: '#071A3E', borderRadius: '20px', padding: '16px 26px', display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13.5px', fontWeight: 600 }}>선택된 인력</span>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {selSummary.map((ss) => (
              <span key={ss.role} style={{ background: 'rgba(79,216,235,0.14)', border: '1px solid rgba(79,216,235,0.35)', color: '#4FD8EB', borderRadius: '999px', padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>
                {ss.role} <span style={{ fontFamily: GROTESK }}>{ss.count}</span>명
              </span>
            ))}
          </div>
          {selectedRateTotal > 0 && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)' }}>예상 인건비 (1일 기준)</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#4FD8EB', fontFamily: GROTESK }}>₩{fmt(selectedRateTotal)}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '24px' }}>
        <InstructionBox
          title="다음 단계 AI 지침"
          description="5단계 견적 옵션을 산출할 때 AI가 이 지침을 참고합니다."
          value={instr5}
          onChange={setInstr5}
          examples={INSTRUCTION_EXAMPLES.toStep5}
          tips={INSTRUCTION_TIPS}
          disabled={!user}
        />
      </div>

      {saveError && <Notice tone="error">{saveError}</Notice>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => go('step3')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
        <button onClick={goNext} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '저장 중…' : '다음 단계로'}</button>
      </div>

      {/* 5단계 입장 게이트 팝업 — 제안서·과업지시서 생성 대기 */}
      {docGenState !== 'idle' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.55)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div role="dialog" aria-modal="true" style={{ background: '#FFFFFF', borderRadius: '22px', boxShadow: '0 24px 64px rgba(7,26,62,0.28)', padding: '36px clamp(22px,5vw,40px)', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
            {docGenState === 'running' ? (
              <>
                <span style={{ width: '44px', height: '44px', borderRadius: '999px', border: '5px solid #E5F0FF', borderTopColor: '#1463F3', animation: 'iwSpin .8s linear infinite', display: 'inline-block', marginBottom: '18px' }} />
                <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#071A3E' }}>현재 정보를 바탕으로<br />과업지시서·제안서가 작성되고 있어요</h2>
                <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.65, color: '#5A6478' }}>
                  1~4단계 데이터와 지침을 반영해 AI가 두 문서를 작성 중입니다.<br />
                  최대 1분 정도 걸리며, 완료되면 자동으로 이동합니다.
                </p>
              </>
            ) : (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#071A3E' }}>문서 작성에 실패했어요</h2>
                <p style={{ margin: '0 0 20px', fontSize: '13.5px', lineHeight: 1.65, color: '#5A6478' }}>일시적인 오류일 수 있어요. 다시 시도해 주세요.</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => setDocGenState('idle')} style={{ background: 'transparent', color: '#5A6478', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
                  <button onClick={() => { setDocGenState('idle'); void goNext(); }} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 26px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)' }}>다시 시도</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
