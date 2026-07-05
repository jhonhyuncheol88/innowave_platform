import { useEffect, useMemo, useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, Stepper } from '../components.js';
import { PEOPLE_DATA } from '../data.js';
import { errMessage, invalidateEvent, saveMatches, useEvent, useMatches, usePersonnel, type MatchSelection } from '../hooks.js';
import { selectionSummary, useIw } from '../state.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { Event } from '../../../models/Event.js';
import { Personnel } from '../../../models/Personnel.js';
import { eventRepository } from '../../../repositories/EventRepository.js';

const ROLES = ['강사', '멘토', '심사위원', '운영인력'];
const AVATAR_COLORS = ['#0D3B8F', '#1463F3', '#26B8CE', '#3A4358'];

/** 선택 시점의 매칭 정보 스냅샷 — 화면 재마운트에도 유지되도록 모듈 수준에 보관 */
const selectionInfo = new Map<string, MatchSelection>();

function Step3Body() {
  const { s, set, go } = useIw();
  const { user } = useAuth();
  const { event: loadedEvent } = useEvent(s.currentEventId);
  const { people, loading, error } = usePersonnel(s.roleTab, 60, !!user);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const goNext = async () => {
    setSaveError(null);
    // 프로젝트가 없거나 로그아웃 상태면 저장 없이 게스트로 진행
    if (!s.currentEventId || !user) { go('step4'); return; }
    setBusy(true);
    try {
      const selections: MatchSelection[] = Object.keys(s.selected).map((key) => {
        const stashed = selectionInfo.get(key);
        if (stashed) return stashed;
        const [role, ...rest] = key.split(':');
        return { personnelId: rest.join(':'), role, matchScore: 0, unitRateSnapshot: 0 };
      });
      await saveMatches(s.currentEventId, selections);
      await eventRepository.patch(s.currentEventId, { currentStep: 4 });
      invalidateEvent(s.currentEventId);
      go('step4');
    } catch (e) {
      setSaveError(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px clamp(16px,5vw,32px) 0' }}>
      <Stepper current={3} />

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
            return (
              <div key={p.id ?? p.name} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '22px', border: i === 0 ? '2px solid rgba(79,216,235,0.6)' : '2px solid transparent', boxShadow: CARD_SHADOW, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '999px', background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{p.name[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E' }}>{p.name}</span>
                      <span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>적합도 <span style={{ fontFamily: GROTESK }}>{fit}</span>점</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#5A6478', marginTop: '2px' }}>{p.expertiseField}</div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: '#3A4358' }}>{p.careerSummary || p.affiliation || '경력 정보 준비 중'}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13px', color: '#5A6478' }}>
                  <span style={{ color: '#F5A623', fontWeight: 700 }}>★ <span style={{ fontFamily: GROTESK }}>{p.rating.toFixed(1)}</span></span>
                  <span>{p.activityRegion}</span>
                </div>
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
        </div>
      )}

      {saveError && <Notice tone="error">{saveError}</Notice>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => go('step2')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '13px 30px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>이전</button>
        <button onClick={goNext} disabled={busy} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px clamp(16px,5vw,32px)', fontSize: '15px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)', opacity: busy ? 0.7 : 1 }}>{busy ? '저장 중…' : '다음 단계로'}</button>
      </div>
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
