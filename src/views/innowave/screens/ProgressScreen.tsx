import { useEffect, useState } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { CARD_SHADOW, GROTESK, INPUT_STYLE, Loading, Notice, RequireAuth } from '../components.js';
import { TEMPLATE_DEFS, type TemplateDef } from '../data.js';
import { errMessage, replaceStages, useEvent, useMyEvents, type StageSeed } from '../hooks.js';
import { useIw } from '../state.js';
import { useAuth } from '../../../hooks/useAuth.js';
import { useProgress } from '../../../hooks/useProgress.js';
import { progressController } from '../../../controllers/ProgressController.js';
import { eventRepository } from '../../../repositories/EventRepository.js';
import { ProgressStage, type StageStatusValue } from '../../../models/ProgressStage.js';

const ST_OPTS: [StageStatusValue, string][] = [['done', '완료'], ['active', '진행 중'], ['pending', '예정']];
const ST_ACTIVE_BG: Record<StageStatusValue, string> = { done: '#1B8A4B', active: '#1463F3', pending: '#5A6478' };
const ST_RATE: Record<StageStatusValue, number> = { done: 100, active: 50, pending: 0 };

interface StageCardProps {
  stage: ProgressStage;
  index: number;
  eventId: string;
  onError: (e: unknown) => void;
  onChanged: () => void;
}

function StageCard({ stage, index, eventId, onError, onChanged }: StageCardProps) {
  const [title, setTitle] = useState(stage.stageName);
  const [note, setNote] = useState(stage.note);

  const commit = (patch: DocumentData) => {
    progressController.updateStage(eventId, stage.id ?? '', patch).then(onChanged).catch(onError);
  };

  const removeStage = () => {
    eventRepository.progressRepo(eventId).remove(stage.id ?? '')
      .then(async () => {
        // 삭제 후 요약 재계산 — 남은 단계 기준으로 상위 event 비정규화 갱신
        const remaining = await eventRepository.progressRepo(eventId).findAll();
        const sorted = remaining.sort((a, b) => a.stageOrder - b.stageOrder);
        if (sorted[0]?.id) {
          await progressController.updateStage(eventId, sorted[0].id, {});
        } else {
          await eventRepository.patch(eventId, { progressSummary: { rate: 0, currentStage: '-', nextMilestone: '-' } });
        }
        onChanged();
      })
      .catch(onError);
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '22px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '13px', color: '#4FD8EB' }}>{String(index + 1).padStart(2, '0')}</span>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== stage.stageName) commit({ stageName: title.trim() }); }}
          title="단계명 수정"
          className="iw-stage-title"
          style={{ flex: 1, minWidth: '140px', fontSize: '16px', fontWeight: 700, color: '#071A3E', fontFamily: 'inherit', border: '1px solid transparent', borderRadius: '10px', padding: '6px 10px', marginLeft: '-10px', background: 'transparent', outline: 'none', transition: 'all .16s' }}
        />
        <div style={{ display: 'inline-flex', gap: '3px', background: '#EEF1F6', borderRadius: '999px', padding: '3px' }}>
          {ST_OPTS.map(([id, label]) => (
            <button key={id} onClick={() => commit({ status: id, progressRate: ST_RATE[id] })} style={{ border: 'none', cursor: 'pointer', borderRadius: '999px', padding: '7px 15px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', transition: 'all .16s', background: stage.status === id ? ST_ACTIVE_BG[id] : 'transparent', color: stage.status === id ? '#FFFFFF' : '#5A6478' }}>{label}</button>
          ))}
        </div>
        <button
          onClick={removeStage}
          title="단계 삭제" className="iw-icon-delete-stage"
          style={{ width: '30px', height: '30px', borderRadius: '10px', border: '1px solid rgba(112,115,124,0.22)', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA3B8', flexShrink: 0 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </div>
      <textarea
        rows={2} value={note} onChange={(e) => setNote(e.target.value)}
        onBlur={() => { if (note !== stage.note) commit({ note }); }}
        placeholder="발주처에 공유할 업데이트 메모를 입력하세요"
        className="iw-input" style={{ ...INPUT_STYLE, fontSize: '14px', resize: 'vertical', lineHeight: 1.55 }}
      />
      <div style={{ marginTop: '12px' }}>
        {!stage.deliverablePath ? (
          <button
            onClick={() => commit({ deliverablePath: `산출물_${stage.stageName.replace(/\s/g, '')}_v1.pdf` })}
            className="iw-btn-dashed"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1.5px dashed rgba(20,99,243,0.4)', background: 'transparent', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, color: '#1463F3', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .16s' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            산출물 첨부
          </button>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#F0F7FF', border: '1px solid rgba(20,99,243,0.2)', borderRadius: '999px', padding: '8px 10px 8px 16px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1463F3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0D3B8F' }}>{stage.deliverablePath}</span>
            <button onClick={() => commit({ deliverablePath: null })} title="첨부 삭제" className="iw-detach" style={{ width: '22px', height: '22px', borderRadius: '999px', border: 'none', background: 'rgba(13,59,143,0.1)', color: '#0D3B8F', cursor: 'pointer', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBody() {
  const { s, set, go } = useIw();
  const { user } = useAuth();
  const { events, loading: eventsLoading, error: eventsError } = useMyEvents();
  const fallbackId = events.find((e) => e.progressSummary != null)?.id ?? null;
  const eventId = s.currentEventId ?? fallbackId;

  useEffect(() => {
    if (!s.currentEventId && fallbackId) set({ currentEventId: fallbackId });
  }, [s.currentEventId, fallbackId, set]);

  const { event } = useEvent(eventId);
  const { stages, summary, loading: stagesLoading } = useProgress(eventId ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onError = (e: unknown) => setError(errMessage(e));
  const clearOnChange = () => { setError(null); set({ pubDone: false }); };

  if (!eventId && eventsLoading) {
    return <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}><Loading /></div>;
  }
  if (!eventId) {
    return (
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}>
        {eventsError && <Notice tone="error">{eventsError}</Notice>}
        <Notice tone="info">진행 중인 프로젝트가 없습니다. 내 프로젝트에서 진행 중 프로젝트를 선택해 주세요.</Notice>
      </div>
    );
  }

  const projectLabel = event ? `${event.basicInfo.name} 운영 용역` : '프로젝트';

  const pickTemplate = (t: TemplateDef) => {
    setBusy(true);
    setError(null);
    const seeds: StageSeed[] = t.stages.map(([title, note], i) => ({
      stageName: title,
      status: i < 2 ? 'done' : i === 2 ? 'active' : 'pending',
      progressRate: i < 2 ? 100 : i === 2 ? 50 : 0,
      note,
      deliverablePath: i === 0 ? '기획확정_승인본.pdf' : null,
    }));
    replaceStages(eventId, seeds, user?.uid ?? '')
      .then(() => { set({ msTemplate: t.name, pubDone: false }); window.scrollTo(0, 0); })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  const addStage = () => {
    eventRepository.progressRepo(eventId)
      .create(new ProgressStage({
        stageName: '새 단계',
        stageOrder: stages.length + 1,
        status: 'pending',
        progressRate: 0,
        updatedBy: user?.uid ?? null,
      }))
      .then(clearOnChange)
      .catch(onError);
  };

  const sortedStages = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px clamp(16px,5vw,32px) 0' }}>

      {stagesLoading ? (
        <Loading label="진행 단계를 불러오는 중…" />
      ) : sortedStages.length === 0 ? (
        /* ── 템플릿 선택 ─────────────────────────── */
        <>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ background: '#071A3E', color: '#4FD8EB', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>수행사 전용</span>
              <span style={{ fontSize: '13px', color: '#9AA3B8' }}>{projectLabel}</span>
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>진행 단계 템플릿을 선택하세요</h1>
            <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>프로그램 성격에 따라 관리해야 할 단계가 다릅니다. 선택 후에도 단계별 내용은 자유롭게 수정할 수 있어요.</p>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: '18px' }}>
            {TEMPLATE_DEFS.map((tc) => (
              <div key={tc.name} className="iw-tmpl-card" style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px', display: 'flex', flexDirection: 'column', gap: '14px', border: '2px solid transparent', transition: 'all .16s' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: '#071A3E' }}>{tc.name}</div>
                  <div style={{ fontSize: '13.5px', color: '#5A6478', marginTop: '3px' }}>{tc.desc}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {tc.stages.map(([title], i) => (
                    <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '999px', background: '#EEF1F6', color: '#5A6478', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: GROTESK, fontWeight: 600, fontSize: '11px', flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#3A4358' }}>{title}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => pickTemplate(tc)} disabled={busy} className="iw-tmpl-pick iw-press" style={{ marginTop: 'auto', border: '1px solid rgba(20,99,243,0.4)', background: '#FFFFFF', color: '#1463F3', borderRadius: '999px', padding: '11px 0', fontSize: '14px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all .16s', opacity: busy ? 0.7 : 1 }}>{busy ? '생성 중…' : '이 템플릿으로 시작'}</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ── 진행 입력 에디터 (실데이터) ────────────── */
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ background: '#071A3E', color: '#4FD8EB', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>수행사 전용</span>
                <span style={{ fontSize: '13px', color: '#9AA3B8' }}>{projectLabel}</span>
                {s.msTemplate && (
                  <span style={{ background: '#E5F0FF', color: '#1463F3', borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>{s.msTemplate} 템플릿</span>
                )}
              </div>
              <h1 style={{ margin: '0 0 6px', fontSize: '26px', fontWeight: 800, color: '#071A3E', letterSpacing: '-0.01em' }}>진행 상황 입력</h1>
              <p style={{ margin: 0, fontSize: '15px', color: '#5A6478' }}>단계 상태와 업데이트 메모, 산출물을 입력하면 발주처 대시보드에 그대로 반영됩니다.</p>
            </div>
            <div style={{ background: '#FFFFFF', borderRadius: '16px', boxShadow: CARD_SHADOW, padding: '14px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#5A6478' }}>자동 계산 진행률</div>
              <div style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '26px', color: '#1463F3' }}>{summary.rate}<span style={{ fontSize: '0.55em' }}>%</span></div>
            </div>
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sortedStages.map((stage, i) => (
              <StageCard
                key={stage.id ?? `stage-${i}`}
                stage={stage}
                index={i}
                eventId={eventId}
                onError={onError}
                onChanged={clearOnChange}
              />
            ))}
          </div>

          <button
            onClick={addStage}
            className="iw-btn-dashed"
            style={{ width: '100%', marginTop: '14px', border: '2px dashed rgba(20,99,243,0.35)', background: 'transparent', borderRadius: '20px', padding: '15px', fontSize: '14px', fontWeight: 700, color: '#1463F3', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all .16s', boxSizing: 'border-box' }}
          >
            <span style={{ fontSize: '17px', lineHeight: 1 }}>＋</span> 단계 추가
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', marginTop: '26px', flexWrap: 'wrap' }}>
            {s.pubDone ? (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13.5px', fontWeight: 700, color: '#1B8A4B' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  발주처 대시보드에 게시되었습니다
                </span>
                <button onClick={() => go('dashboard')} className="iw-btn-outline-navy" style={{ background: 'transparent', color: '#0D3B8F', border: '1px solid rgba(13,59,143,0.25)', borderRadius: '999px', padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>발주처 화면 미리보기</button>
              </>
            ) : (
              <span style={{ fontSize: '12.5px', color: '#9AA3B8' }}>단계 변경은 저장 즉시 발주처 대시보드에 반영됩니다</span>
            )}
            <button onClick={() => set({ pubDone: true })} className="iw-btn-primary" style={{ background: '#1463F3', color: '#FFFFFF', border: 'none', borderRadius: '999px', padding: '13px 30px', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 18px rgba(20,99,243,0.3)' }}>발주처 대시보드에 게시</button>
          </div>
        </>
      )}
    </div>
  );
}

export function ProgressScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <RequireAuth>
        <ProgressBody />
      </RequireAuth>
    </div>
  );
}
