import { useEffect, useState } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Notice, RequireAuth } from '../components.js';
import { PROJ_STATUS_MAP } from '../data.js';
import { deleteEvent, errMessage, loadWorkflowDocument, tsLabel, useEvent, useLatestQuote, wonLabel } from '../hooks.js';
import { fmt, useIw } from '../state.js';
import type { ScreenId } from '../types.js';

const STEP_DEFS: { n: number; label: string; screen: ScreenId }[] = [
  { n: 1, label: '행사 정보', screen: 'step1' },
  { n: 2, label: '프로그램 구성', screen: 'step2' },
  { n: 3, label: '비품 선택', screen: 'step3' },
  { n: 4, label: '인력 매칭', screen: 'step4' },
  { n: 5, label: '제안서·과업지시서', screen: 'step5' },
];

const OPTION_LABEL: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };

/** '2026-09-12' → '2026. 9. 12.' */
function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${y}. ${m}. ${d}.`;
}

export function ProjectHubScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <RequireAuth>
        <ProjectHubBody />
      </RequireAuth>
    </div>
  );
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}>
      <Notice tone="info">선택된 프로젝트가 없습니다. 내 프로젝트에서 선택해 주세요.</Notice>
      <button onClick={onBack} className="iw-btn-primary" style={{ marginTop: '12px', background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '12px 26px', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)' }}>내 프로젝트로</button>
    </div>
  );
}

function ProjectHubBody() {
  const { s, set, go } = useIw();
  const { event, loading } = useEvent(s.currentEventId);
  const { quote, loading: quoteLoading } = useLatestQuote(s.currentEventId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 산출 문서(제안서·과업지시서) 생성 여부
  const [docStatus, setDocStatus] = useState<{ proposal: boolean; workorder: boolean }>({ proposal: false, workorder: false });
  useEffect(() => {
    if (!s.currentEventId) return;
    void Promise.all([
      loadWorkflowDocument(s.currentEventId, 'proposal'),
      loadWorkflowDocument(s.currentEventId, 'workorder'),
    ]).then(([p, w]) => setDocStatus({ proposal: !!p, workorder: !!w })).catch(() => {});
  }, [s.currentEventId]);

  if (!s.currentEventId) return <EmptyState onBack={() => go('projects')} />;
  if (loading) return <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}><Loading label="프로젝트를 불러오는 중…" /></div>;
  if (!event) return <EmptyState onBack={() => go('projects')} />;

  const b = event.basicInfo;
  const [statusLabel, stBg, stColor] = PROJ_STATUS_MAP[event.status] ?? PROJ_STATUS_MAP.draft;
  const currentStep = Math.min(Math.max(event.currentStep || 1, 1), 5);
  const summary = event.progressSummary;

  const removeProject = async () => {
    if (!event.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(event.id);
      set({ currentEventId: null });
      go('projects');
    } catch (e) {
      setDeleteError(errMessage(e));
      setDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}>

      <button onClick={() => go('projects')} className="iw-text-link" style={{ background: 'transparent', border: 'none', color: '#5A6478', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '14px' }}>← 내 프로젝트</button>

      {/* 헤더 카드 */}
      <div style={{ background: '#071A3E', borderRadius: '20px', padding: '36px', marginBottom: '20px' }}>
        <span style={{ display: 'inline-block', background: stBg, color: stColor, borderRadius: '999px', padding: '4px 14px', fontSize: '11.5px', fontWeight: 700, marginBottom: '12px' }}>{statusLabel}</span>
        <h1 style={{ margin: '0 0 6px', color: '#FFFFFF', fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.01em' }}>{b.name || '(행사명 미입력)'}</h1>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px' }}>주관 {b.organizer || '-'}</div>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', marginTop: '24px' }}>
          <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>기간</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', fontFamily: GROTESK }}>{dateLabel(b.periodStart)} – {dateLabel(b.periodEnd)}</div></div>
          <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>장소</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>{b.region || '-'} · {b.operationType || '-'}</div></div>
          <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>참가 규모</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}><span style={{ fontFamily: GROTESK }}>{(b.participantScale || 0).toLocaleString('ko-KR')}</span>명</div></div>
          <div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>예산 한도</div><div style={{ fontSize: '14.5px', fontWeight: 700, color: '#4FD8EB' }}>{wonLabel(b.budgetLimit)}</div></div>
        </div>
      </div>

      {/* 워크플로우 진행 */}
      <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '28px clamp(16px,5vw,32px)', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>워크플로우 진행</h2>
        <p style={{ margin: '0 0 20px', fontSize: '12.5px', color: '#9AA3B8' }}>완료된 단계도 언제든 수정할 수 있습니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: '14px' }}>
          {STEP_DEFS.map(({ n, label, screen }) => {
            const done = n < currentStep;
            const current = n === currentStep;
            return (
              <div key={n} style={{ border: current ? '2px solid #1463F3' : '1px solid rgba(112,115,124,0.18)', borderRadius: '16px', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: current ? '#F7FAFF' : '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '999px',
                    background: current ? '#1463F3' : done ? '#E5F0FF' : '#E8ECF4',
                    color: current ? '#FFFFFF' : done ? '#1463F3' : '#9AA3B8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: GROTESK, fontWeight: 600, fontSize: '14px', flexShrink: 0,
                  }}>{done ? '✓' : n}</div>
                  <span style={{ fontSize: '14px', fontWeight: current ? 700 : done ? 600 : 500, color: current ? '#071A3E' : done ? '#5A6478' : '#9AA3B8' }}>{label}</span>
                </div>
                {current ? (
                  <button onClick={() => go(screen)} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '9px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>이어가기</button>
                ) : done ? (
                  <button onClick={() => go(screen)} className="iw-btn-outline-blue" style={{ border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '9px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                ) : (
                  <button onClick={() => go(screen)} style={{ border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', color: '#9AA3B8', borderRadius: '999px', padding: '9px 0', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>바로가기</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: '20px', alignItems: 'stretch' }}>

        {/* 산출 문서 카드 — 제안서·과업지시서 중심 */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '28px clamp(16px,5vw,32px)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>산출 문서</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {([['proposal', '운영사업 제안서'], ['workorder', '과업지시서']] as const).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(112,115,124,0.18)', borderRadius: '14px', padding: '13px 16px' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: key === 'proposal' ? '#E5F0FF' : '#DCF3F8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={key === 'proposal' ? '#1463F3' : '#0C7A93'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </span>
                <span style={{ flex: 1, fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>{label}</span>
                {docStatus[key] ? (
                  <span style={{ background: '#F0FBF4', color: '#1B8A4B', borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700 }}>생성됨</span>
                ) : (
                  <span style={{ background: '#EEF1F6', color: '#9AA3B8', borderRadius: '999px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700 }}>미생성</span>
                )}
              </div>
            ))}
          </div>
          {quoteLoading ? (
            <Loading label="예산 정보를 불러오는 중…" />
          ) : quote ? (
            <div style={{ fontSize: '12.5px', color: '#9AA3B8' }}>
              소요예산(별첨) <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '15px', color: '#1463F3' }}>₩{fmt(quote.total)}</span>
              {' '}· {OPTION_LABEL[quote.optionType] ?? quote.optionType} 옵션 · 저장일 {tsLabel(quote.createdAt)}
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: 'auto' }}>
            <button onClick={() => go('step5')} className="iw-btn-outline-blue" style={{ flex: 1, border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '11px 0', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {docStatus.proposal || docStatus.workorder ? '제안서·과업지시서 수정' : '문서 만들기'}
            </button>
            <button onClick={() => go('proposal')} className="iw-btn-primary" style={{ flex: 1, background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 0', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>발주처 공유 문서 보기</button>
          </div>
        </div>

        {/* 진행 현황 카드 */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '28px clamp(16px,5vw,32px)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>진행 현황</h2>
          {summary ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '40px', letterSpacing: '-0.03em', color: '#071A3E', lineHeight: 1.05 }}>{summary.rate}<span style={{ fontSize: '0.5em', color: '#1463F3' }}>%</span></span>
                <span style={{ fontSize: '13.5px', color: '#5A6478' }}>전체 진행률</span>
              </div>
              <div style={{ height: '10px', background: '#EEF1F6', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${summary.rate}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#4FD8EB,#1463F3,#0D3B8F)', transition: 'width .4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#9AA3B8', marginBottom: '3px' }}>현재 단계</div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>{summary.currentStage}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#9AA3B8', marginBottom: '3px' }}>다음 마일스톤</div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0D3B8F' }}>{summary.nextMilestone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: 'auto' }}>
                <button onClick={() => go('dashboard')} className="iw-btn-outline-navy" style={{ flex: 1, background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '11px 0', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>발주처 대시보드</button>
                <button onClick={() => go('progress')} className="iw-btn-primary" style={{ flex: 1, background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 0', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>진행 입력</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '14px', color: '#5A6478' }}>진행 현황이 아직 게시되지 않았습니다.</p>
              <button onClick={() => go('progress')} className="iw-btn-primary" style={{ marginTop: 'auto', background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '11px 0', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>진행 입력 시작</button>
            </>
          )}
        </div>
      </div>

      {/* 위험 구역 */}
      {deleteError && <div style={{ marginTop: '18px' }}><Notice tone="error">{deleteError}</Notice></div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '22px' }}>
        {confirmDelete ? (
          <>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#B3261E' }}>정말 삭제할까요? 되돌릴 수 없습니다.</span>
            <button onClick={() => void removeProject()} disabled={deleting} style={{ background: '#E5484D', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.7 : 1 }}>{deleting ? '삭제 중…' : '삭제 확정'}</button>
            <button onClick={() => setConfirmDelete(false)} disabled={deleting} className="iw-btn-soft" style={{ background: 'transparent', color: '#5A6478', border: '1px solid rgba(112,115,124,0.28)', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="iw-text-delete" style={{ background: 'transparent', border: 'none', color: '#9AA3B8', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>프로젝트 삭제</button>
        )}
      </div>
    </div>
  );
}
