/**
 * 발주처 실시간 진행 현황 대시보드 (REQ-12, 13) — 4.2 요구사항 구현
 * 데이터는 useProgress 훅(→ ProgressController → Repository)에서만 받는다.
 */
import { useProgress } from '../../../hooks/useProgress.js';
import { StageStatus, type StageStatusValue } from '../../../models/ProgressStage.js';
import './progress.css';

const STATUS_LABEL: Record<StageStatusValue, string> = {
  [StageStatus.DONE]: '완료',
  [StageStatus.ACTIVE]: '진행 중',
  [StageStatus.PENDING]: '예정',
};

export interface ProgressDashboardProps {
  eventId: string;
  eventName: string;
}

export function ProgressDashboard({ eventId, eventName }: ProgressDashboardProps) {
  const { stages, summary, loading } = useProgress(eventId);

  if (loading) {
    return <div className="card progress-card" aria-busy="true">진행 현황을 불러오는 중…</div>;
  }

  return (
    <section className="card progress-card" aria-label="프로젝트 진행 현황">
      <header className="progress-head">
        <div>
          <p className="progress-eyebrow">실시간 진행 현황</p>
          <h2>{eventName}</h2>
        </div>
        <div className="progress-rate" role="status">
          <span className="progress-rate-num">{summary.rate}</span>
          <span className="progress-rate-unit">%</span>
        </div>
      </header>

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={summary.rate}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar-fill" style={{ width: `${summary.rate}%` }} />
      </div>

      <dl className="progress-meta">
        <div><dt>현재 단계</dt><dd>{summary.currentStage}</dd></div>
        <div><dt>다음 마일스톤</dt><dd>{summary.nextMilestone}</dd></div>
      </dl>

      <ol className="stage-list">
        {stages.map((s) => (
          <li key={s.id} className={`stage stage-${s.status}`}>
            <span className="stage-dot" aria-hidden="true" />
            <div className="stage-body">
              <div className="stage-title-row">
                <strong>{s.stageName}</strong>
                <span className="stage-status">{STATUS_LABEL[s.status]}</span>
              </div>
              {s.note && <p className="stage-note">{s.note}</p>}
              {s.hasDeliverable && s.deliverablePath && (
                <a className="stage-deliverable" href={s.deliverablePath} download>
                  중간 산출물 내려받기
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
