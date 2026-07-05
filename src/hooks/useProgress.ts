/**
 * useProgress — View와 Controller를 잇는 브릿지 훅
 * 컴포넌트는 Firestore를 모르고, 이 훅과 컨트롤러만 사용한다.
 * 마지막 스냅샷을 모듈 캐시에 보관해 재방문 시 스피너 없이 즉시 그린다.
 */
import { useEffect, useState } from 'react';
import { progressController } from '../controllers/ProgressController.js';
import type { ProgressStage } from '../models/ProgressStage.js';
import type { ProgressSummary } from '../models/Event.js';

const EMPTY_SUMMARY: ProgressSummary = {
  rate: 0,
  currentStage: '-',
  nextMilestone: '-',
};

interface ProgressSnapshot {
  stages: ProgressStage[];
  summary: ProgressSummary;
}

/** eventId → 마지막 실시간 스냅샷 (stale-while-revalidate) */
const snapshotCache = new Map<string, ProgressSnapshot>();

export function useProgress(eventId: string | undefined) {
  const cached = eventId ? snapshotCache.get(eventId) : undefined;
  const [stages, setStages] = useState<ProgressStage[]>(cached?.stages ?? []);
  const [summary, setSummary] = useState<ProgressSummary>(cached?.summary ?? EMPTY_SUMMARY);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (!eventId) return undefined;
    const hit = snapshotCache.get(eventId);
    if (hit) {
      setStages(hit.stages);
      setSummary(hit.summary);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const unsubscribe = progressController.subscribe(eventId, (s, sum) => {
      snapshotCache.set(eventId, { stages: s, summary: sum });
      setStages(s);
      setSummary(sum);
      setLoading(false);
    });
    return unsubscribe;
  }, [eventId]);

  return { stages, summary, loading };
}
