import { useEffect } from 'react';
import { CARD_SHADOW, GROTESK, Loading, Logo, Notice, RequireAuth } from '../components.js';
import { useEvent, useMyEvents } from '../hooks.js';
import { useProgress } from '../../../hooks/useProgress.js';
import { useIw } from '../state.js';

const STATUS_LABEL = { done: '완료', active: '진행 중', pending: '예정' } as const;
const STATUS_BADGE = {
  done: { bg: '#E6F7EC', color: '#1B8A4B' },
  active: { bg: '#E5F0FF', color: '#1463F3' },
  pending: { bg: '#EEF1F6', color: '#9AA3B8' },
} as const;
const STATUS_DOT = { done: '#2BB673', active: '#1463F3', pending: '#D5DAE4' } as const;

function DashboardBody() {
  const { s, set } = useIw();
  const { events, loading: eventsLoading, error: eventsError } = useMyEvents();
  const fallbackId = events.find((e) => e.progressSummary != null)?.id ?? null;
  const eventId = s.currentEventId ?? fallbackId;

  useEffect(() => {
    if (!s.currentEventId && fallbackId) set({ currentEventId: fallbackId });
  }, [s.currentEventId, fallbackId, set]);

  const { event } = useEvent(eventId);
  const { stages, summary, loading: stagesLoading } = useProgress(eventId ?? undefined);

  if (!eventId && eventsLoading) {
    return <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px clamp(16px,5vw,32px) 0' }}><Loading /></div>;
  }
  if (!eventId) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px clamp(16px,5vw,32px) 0' }}>
        {eventsError && <Notice tone="error">{eventsError}</Notice>}
        <Notice tone="info">진행 중인 프로젝트가 없습니다. 내 프로젝트에서 진행 중 프로젝트를 선택해 주세요.</Notice>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px clamp(16px,5vw,32px) 0' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '26px' }}>
        <Logo dark size={18} />
        <span style={{ background: '#E5F0FF', color: '#0D3B8F', borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700 }}>발주처 전용 조회 화면</span>
      </div>

      {/* 상단 진행률 카드 */}
      <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '36px', marginBottom: '24px' }}>
        <div style={{ fontSize: '13.5px', color: '#5A6478', fontWeight: 600, marginBottom: '4px' }}>{event?.basicInfo.name ?? '프로젝트'} 운영 용역</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: '62px', letterSpacing: '-0.03em', color: '#071A3E', lineHeight: 1.05 }}>
            {summary.rate}<span style={{ fontSize: '0.45em', color: '#1463F3' }}>%</span>
          </span>
          <span style={{ fontSize: '14.5px', color: '#5A6478' }}>전체 진행률</span>
        </div>
        <div style={{ marginTop: '18px', height: '12px', background: '#EEF1F6', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${summary.rate}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#4FD8EB,#1463F3,#0D3B8F)', transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginTop: '18px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#9AA3B8', marginBottom: '3px' }}>현재 단계</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#071A3E' }}>{summary.currentStage}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#9AA3B8', marginBottom: '3px' }}>다음 마일스톤</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0D3B8F' }}>{summary.nextMilestone}</div>
          </div>
        </div>
      </div>

      {/* 담당자 */}
      <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '22px 28px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '999px', background: '#0D3B8F', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>윤</div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#071A3E' }}>윤소희 <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#5A6478' }}>담당 PM · (주)이노웨이브 파트너스</span></div>
          <div style={{ fontSize: '12.5px', color: '#9AA3B8', marginTop: '2px' }}>진행 상황 관련 문의 창구</div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', fontWeight: 700 }}>
          <a href="tel:02-6203-1140" style={{ color: '#0D3B8F', textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: GROTESK }}>02-6203-1140</a>
          <a href="mailto:sohee.yoon@innowave.kr" style={{ color: '#1463F3', textDecoration: 'none', whiteSpace: 'nowrap' }}>sohee.yoon@innowave.kr</a>
        </div>
      </div>

      {/* 타임라인 */}
      <div style={{ background: '#FFFFFF', borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '32px 36px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#071A3E', marginBottom: '24px' }}>단계별 진행 현황</div>
        {stagesLoading ? (
          <Loading label="진행 현황을 불러오는 중…" />
        ) : stages.length === 0 ? (
          <Notice tone="info">아직 게시된 진행 현황이 없습니다.</Notice>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stages.map((ms, i) => {
              const isLast = i === stages.length - 1;
              const badge = STATUS_BADGE[ms.status];
              return (
                <div key={ms.id ?? `${ms.stageName}-${i}`} style={{ display: 'flex', gap: '18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '20px', flexShrink: 0 }}>
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '999px', marginTop: '3px',
                      background: STATUS_DOT[ms.status],
                      border: 'none', boxSizing: 'border-box',
                      animation: ms.status === 'active' ? 'iwPulse 2s ease-in-out infinite' : 'none',
                    }} />
                    {!isLast && <div style={{ width: '2px', flex: 1, background: ms.status === 'done' ? '#BFE8D2' : 'rgba(112,115,124,0.18)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: isLast ? '4px' : '26px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: ms.status === 'pending' ? '#9AA3B8' : '#071A3E' }}>{ms.stageName}</span>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>{STATUS_LABEL[ms.status]}</span>
                    </div>
                    <p style={{ margin: '5px 0 0', fontSize: '13.5px', lineHeight: 1.55, color: '#5A6478' }}>{ms.note}</p>
                    {!!ms.deliverablePath && (
                      <a href="#" onClick={(e) => e.preventDefault()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '13px', fontWeight: 700, color: '#1463F3', textDecoration: 'none' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        {ms.deliverablePath} 다운로드
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F9FF', paddingBottom: '100px' }}>
      <RequireAuth>
        <DashboardBody />
      </RequireAuth>
    </div>
  );
}
