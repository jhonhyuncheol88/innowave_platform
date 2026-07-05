/**
 * ProgressController — 발주처 실시간 진행 현황 (REQ-12~14, 4.2)
 */
import { orderBy, type DocumentData } from 'firebase/firestore';
import { eventRepository, type EventRepository } from '../repositories/EventRepository.js';
import { ProgressStage, STAGE_NAMES, StageStatus } from '../models/ProgressStage.js';
import type { ProgressSummary } from '../models/Event.js';

export class ProgressController {
  private events: EventRepository;

  constructor(events: EventRepository = eventRepository) {
    this.events = events;
  }

  /** 프로젝트 착수 시 5단계 초기화 */
  async initStages(eventId: string): Promise<ProgressStage[]> {
    const repo = this.events.progressRepo(eventId);
    return Promise.all(STAGE_NAMES.map((name, i) => repo.create(
      new ProgressStage({
        stageName: name,
        stageOrder: i + 1,
        status: i === 0 ? StageStatus.ACTIVE : StageStatus.PENDING,
      }),
    )));
  }

  /** 실시간 구독 — 대시보드가 unmount될 때 반환된 unsubscribe 호출 */
  subscribe(
    eventId: string,
    onChange: (stages: ProgressStage[], summary: ProgressSummary) => void,
  ) {
    const repo = this.events.progressRepo(eventId);
    return repo.subscribe(
      (stages) => onChange(stages, ProgressStage.summarize(stages)),
      orderBy('stageOrder'),
    );
  }

  /**
   * 운영자: 단계 상태 갱신 + 상위 event에 요약 비정규화 + (서버) 알림 발송 트리거
   * 알림(REQ-14)은 Cloud Functions onDocumentWritten 트리거로 생성 — 클라이언트가 직접 쓰지 않음
   */
  async updateStage(eventId: string, stageId: string, patch: DocumentData): Promise<void> {
    const repo = this.events.progressRepo(eventId);
    await repo.patch(stageId, patch);
    const stages = await repo.findAll(orderBy('stageOrder'));
    await this.events.patch(eventId, {
      progressSummary: ProgressStage.summarize(stages),
    });
  }
}

export const progressController = new ProgressController();
