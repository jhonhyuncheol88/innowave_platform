import { useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, RequireAuth } from '../components.js';
import { PROJ_FILTERS, PROJ_STATUS_MAP } from '../data.js';
import { tsLabel, useMyEvents } from '../hooks.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useIw, WORKFLOW_RESET } from '../state.js';
import type { Event } from '../../../models/Event.js';

function matchFilter(filter: string, st: string): boolean {
  if (filter === '전체') return true;
  if (filter === '작성 중') return ['draft', 'composing', 'matching'].includes(st);
  if (filter === '진행 중') return ['quoted', 'confirmed', 'in_progress'].includes(st);
  return st === 'done';
}

export function ProjectsScreen() {
  return (
    <RequireAuth>
      <ProjectsInner />
    </RequireAuth>
  );
}

function ProjectsInner() {
  const { s, set, go } = useIw();
  const { user, role, approval } = useAuth();
  const { events, loading, error } = useMyEvents();
  const [search, setSearch] = useState('');
  const canOperate = role === 'admin' || approval === 'approved';

  const q = search.trim().toLowerCase();
  const filtered = events.filter((ev) =>
    matchFilter(s.projFilter, ev.status) && (!q || ev.basicInfo.name.toLowerCase().includes(q)));

  const openEvent = (ev: Event) => {
    set({ currentEventId: ev.id });
    go('project');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '26px' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>내 프로젝트</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => { if (canOperate) { set(WORKFLOW_RESET); go('step1'); } }}
              disabled={!canOperate}
              title={canOperate ? undefined : '관리자 승인 후 이용할 수 있습니다'}
              className={canOperate ? 'iw-btn-primary' : undefined}
              style={{ background: canOperate ? '#1463F3' : '#B9C6E4', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '12px 26px', fontSize: '14.5px', fontWeight: 700, cursor: canOperate ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: canOperate ? '0 6px 18px rgba(20,99,243,0.3)' : 'none' }}
            >＋ 새 기획 시작</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PROJ_FILTERS.map((f) => {
              const active = s.projFilter === f;
              return (
                <button key={f} onClick={() => set({ projFilter: f })} style={{ border: `1px solid ${active ? '#071A3E' : 'rgba(112,115,124,0.28)'}`, cursor: 'pointer', borderRadius: '999px', padding: '9px 18px', fontSize: '13.5px', fontWeight: 700, fontFamily: 'inherit', transition: 'all .16s', background: active ? '#071A3E' : '#FFFFFF', color: active ? '#FFFFFF' : '#3A4358' }}>{f}</button>
              );
            })}
          </div>
          <div style={{ flex: 1, minWidth: '200px', maxWidth: '320px', marginLeft: 'auto', position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9AA3B8" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" placeholder="행사명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="iw-input" style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 38px', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', fontSize: '14px', fontFamily: 'inherit', background: '#FFFFFF', color: '#1B2437', outline: 'none' }} />
          </div>
        </div>

        {!canOperate && approval === 'pending' && (
          <Notice tone="info">
            관리자 승인 대기 중입니다. 승인이 완료되면 프로젝트를 만들고 운영할 수 있어요. 그동안 빠른 견적 확인은 자유롭게 이용하실 수 있습니다.
          </Notice>
        )}
        {!canOperate && approval === 'rejected' && (
          <Notice tone="error">
            계정 이용이 제한되었습니다. 문의: sohee.yoon@innowave.kr
          </Notice>
        )}

        {loading && <Loading label="프로젝트를 불러오는 중…" />}
        {!loading && error && <Notice tone="error">{error}</Notice>}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: '18px' }}>
            {filtered.map((ev) => {
              const [status, stBg, stColor] = PROJ_STATUS_MAP[ev.status] ?? PROJ_STATUS_MAP.draft;
              const prog = ev.progressSummary?.rate ?? 0;
              return (
                <div key={ev.id} onClick={() => openEvent(ev)} className="iw-project-card" style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', transition: 'all .16s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ background: '#EEF1F6', color: '#5A6478', borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700 }}>{ev.basicInfo.eventType || '미분류'}</span>
                    <span style={{ background: stBg, color: stColor, borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>{status}</span>
                  </div>
                  <div style={{ fontSize: '16.5px', fontWeight: 700, color: '#071A3E', lineHeight: 1.4 }}>{ev.basicInfo.name}</div>
                  {ev.status === 'in_progress' && ev.progressSummary && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#5A6478', marginBottom: '5px' }}>
                        <span>진행률</span>
                        <span style={{ fontFamily: GROTESK, fontWeight: 700, color: '#1463F3' }}>{prog}%</span>
                      </div>
                      <div style={{ height: '6px', background: '#EEF1F6', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${prog}%`, height: '100%', borderRadius: '999px', background: '#1463F3' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: '12.5px', color: '#9AA3B8', marginTop: 'auto' }}>최종 수정 {tsLabel(ev.updatedAt)}</div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '80px clamp(16px,5vw,32px)', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>첫 기획을 시작해 보세요</h2>
              <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#5A6478' }}>행사 정보만 입력하면 AI가 기획안과 견적까지 만들어 드립니다.</p>
              <button
                onClick={() => { if (canOperate) { set(WORKFLOW_RESET); go('step1'); } }}
                disabled={!canOperate}
                className={canOperate ? 'iw-btn-primary' : undefined}
                style={{ background: canOperate ? '#1463F3' : '#B9C6E4', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '14px 34px', fontSize: '15.5px', fontWeight: 700, cursor: canOperate ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: canOperate ? '0 8px 24px rgba(20,99,243,0.35)' : 'none' }}
              >{canOperate ? '새 기획 시작' : '관리자 승인 대기 중'}</button>
            </div>
            {events.length === 0 && role !== 'admin' && (
              <Notice tone="info">
                시드 데이터의 프로젝트(events)는 ownerUid가 &lsquo;seed-demo-owner&rsquo;라 일반 계정에는 보이지 않습니다.
                Firestore 콘솔에서 users/{user?.uid} 문서의 role을 &ldquo;admin&rdquo;으로 바꾸면 전체 프로젝트가 보입니다.
              </Notice>
            )}
          </>
        )}
      </div>
    </div>
  );
}
