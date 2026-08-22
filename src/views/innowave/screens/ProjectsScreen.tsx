import { useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, RequireAuth } from '../components.js';
import { PROJ_FILTERS, PROJ_STATUS_MAP } from '../data.js';
import { deleteEvent, errMessage, restoreEvent, trashEvent, tsLabel, useMyEvents } from '../hooks.js';
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
  const { role, approval } = useAuth();
  const { events, loading, error, reload } = useMyEvents();
  const [search, setSearch] = useState('');
  const canOperate = role === 'admin' || approval === 'approved';

  const q = search.trim().toLowerCase();
  const activeEvents = events.filter((ev) => !ev.deletedAt);
  const trashedEvents = events.filter((ev) => !!ev.deletedAt);
  const [viewTrash, setViewTrash] = useState(false);
  const filtered = (viewTrash ? trashedEvents : activeEvents).filter((ev) =>
    (viewTrash || matchFilter(s.projFilter, ev.status)) && (!q || ev.basicInfo.name.toLowerCase().includes(q)));

  const openEvent = (ev: Event) => {
    set({ currentEventId: ev.id });
    go('project');
  };

  // ── 휴지통: 이동(즉시·복원 가능) / 복원 / 완전 삭제(확인 팝업) ──
  const [confirmDel, setConfirmDel] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const moveToTrash = async (ev: Event) => {
    if (!ev.id || rowBusy) return;
    setRowBusy(ev.id);
    setDelError(null);
    try {
      await trashEvent(ev.id);
      if (s.currentEventId === ev.id) set({ currentEventId: null });
      reload();
    } catch (e) {
      setDelError(errMessage(e));
    } finally {
      setRowBusy(null);
    }
  };

  const restore = async (ev: Event) => {
    if (!ev.id || rowBusy) return;
    setRowBusy(ev.id);
    setDelError(null);
    try {
      await restoreEvent(ev.id);
      reload();
    } catch (e) {
      setDelError(errMessage(e));
    } finally {
      setRowBusy(null);
    }
  };

  const removeForever = async () => {
    if (!confirmDel?.id || deleting) return;
    setDeleting(true);
    setDelError(null);
    try {
      await deleteEvent(confirmDel.id);
      if (s.currentEventId === confirmDel.id) set({ currentEventId: null });
      setConfirmDel(null);
      reload();
    } catch (e) {
      setDelError(errMessage(e));
    } finally {
      setDeleting(false);
    }
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
          <button
            onClick={() => setViewTrash((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: `1px solid ${viewTrash ? '#E5484D' : 'rgba(112,115,124,0.28)'}`, cursor: 'pointer', borderRadius: '999px', padding: '9px 18px', fontSize: '13.5px', fontWeight: 700, fontFamily: 'inherit', transition: 'all .16s', background: viewTrash ? '#E5484D' : '#FFFFFF', color: viewTrash ? '#FFFFFF' : '#3A4358' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
            휴지통{trashedEvents.length > 0 ? ` ${trashedEvents.length}` : ''}
          </button>
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

        {viewTrash && <Notice tone="info">휴지통의 프로젝트는 복원하거나 완전 삭제할 수 있습니다. 완전 삭제하면 복구할 수 없습니다.</Notice>}
        {delError && !confirmDel && <Notice tone="error">{delError}</Notice>}

        {loading && <Loading label="프로젝트를 불러오는 중…" />}
        {!loading && error && <Notice tone="error">{error}</Notice>}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: '18px' }}>
            {filtered.map((ev) => {
              const [status, stBg, stColor] = PROJ_STATUS_MAP[ev.status] ?? PROJ_STATUS_MAP.draft;
              const prog = ev.progressSummary?.rate ?? 0;
              return (
                <div key={ev.id} onClick={() => { if (!viewTrash) openEvent(ev); }} className={viewTrash ? undefined : 'iw-project-card'} style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: viewTrash ? 'default' : 'pointer', transition: 'all .16s', opacity: rowBusy === ev.id ? 0.55 : 1 }}>
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
                  {viewTrash ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
                      <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>휴지통 이동 {tsLabel(ev.deletedAt)}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); void restore(ev); }}
                          disabled={rowBusy !== null}
                          className="iw-btn-outline-blue"
                          style={{ flex: 1, border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '9px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >복원</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDel(ev); setDelError(null); }}
                          disabled={rowBusy !== null}
                          style={{ flex: 1, border: '1px solid rgba(229,72,77,0.45)', background: '#FFFFFF', color: '#E5484D', borderRadius: '999px', padding: '9px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >완전 삭제</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
                      <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>최종 수정 {tsLabel(ev.updatedAt)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); void moveToTrash(ev); }}
                        disabled={rowBusy !== null}
                        title="휴지통으로 이동" className="iw-icon-delete"
                        style={{ width: '30px', height: '30px', borderRadius: '9px', border: '1px solid rgba(112,115,124,0.2)', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA3B8', flexShrink: 0 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 삭제 확인 팝업 */}
        {confirmDel && (
          <div
            onClick={() => { if (!deleting) setConfirmDel(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(7,26,62,0.45)', backdropFilter: 'blur(3px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: '#FFFFFF', borderRadius: '22px', boxShadow: '0 24px 64px rgba(7,26,62,0.28)', padding: '32px clamp(22px,5vw,36px)', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#071A3E' }}>완전히 삭제할까요?</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13.5px', lineHeight: 1.65, color: '#5A6478' }}>
                &lsquo;{confirmDel.basicInfo.name || '(무명 프로젝트)'}&rsquo;<br />
                완전 삭제하면 프로그램·비품·인력·문서 데이터를 복구할 수 없습니다.
              </p>
              {delError && <div style={{ marginBottom: '14px', textAlign: 'left' }}><Notice tone="error">{delError}</Notice></div>}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => setConfirmDel(null)} disabled={deleting} style={{ background: 'transparent', color: '#5A6478', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '11px 26px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                <button onClick={() => void removeForever()} disabled={deleting} style={{ background: '#E5484D', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 28px', fontSize: '14px', fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.7 : 1 }}>{deleting ? '삭제 중…' : '완전 삭제'}</button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && viewTrash && filtered.length === 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '60px clamp(16px,5vw,32px)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>휴지통이 비어 있습니다.</p>
          </div>
        )}

        {!loading && !error && !viewTrash && filtered.length === 0 && (
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
          </>
        )}
      </div>
    </div>
  );
}
