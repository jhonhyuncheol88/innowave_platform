import type { DocumentData, FieldValue, Timestamp } from 'firebase/firestore';
import { BaseModel } from './BaseModel.js';
import type { ProgressSummary } from './Event.js';

export const STAGE_NAMES = Object.freeze([
  '요구사항 분석', '화면설계', '핵심 개발', '통합 테스트', '최종 검수',
] as const);

export type StageName = (typeof STAGE_NAMES)[number];

export const StageStatus = Object.freeze({
  DONE: 'done',
  ACTIVE: 'active',
  PENDING: 'pending',
} as const);

export type StageStatusValue = (typeof StageStatus)[keyof typeof StageStatus];

export interface ProgressStageInit {
  id?: string | null;
  stageName: string;
  stageOrder: number;
  status?: StageStatusValue;
  progressRate?: number;
  note?: string;
  deliverablePath?: string | null;
  updatedAt?: Timestamp | FieldValue | null;
  updatedBy?: string | null;
}

/** 발주처 실시간 진행 현황의 단일 단계 (REQ-12, 13) */
export class ProgressStage extends BaseModel {
  stageName: string;
  stageOrder: number;
  status: StageStatusValue;
  progressRate: number;
  note: string;
  deliverablePath: string | null;
  updatedAt: Timestamp | FieldValue | null;
  updatedBy: string | null;

  constructor({
    id = null,
    stageName,
    stageOrder,
    status = StageStatus.PENDING,
    progressRate = 0,
    note = '',
    deliverablePath = null,
    updatedAt = null,
    updatedBy = null,
  }: ProgressStageInit) {
    super(id);
    this.stageName = stageName;
    this.stageOrder = stageOrder;
    this.status = status;
    this.progressRate = progressRate;
    this.note = note;
    this.deliverablePath = deliverablePath;
    this.updatedAt = updatedAt;
    this.updatedBy = updatedBy;
  }

  get hasDeliverable(): boolean {
    return Boolean(this.deliverablePath);
  }

  toFirestore(): DocumentData {
    const { id: _id, ...rest } = this;
    return rest;
  }

  static fromFirestore(id: string, data: DocumentData): ProgressStage {
    return new ProgressStage({ id, ...data } as ProgressStageInit);
  }

  /** 단계 배열에서 전체 진행률/현재 단계 요약 산출 → events.progressSummary 비정규화용 */
  static summarize(stages: ProgressStage[]): ProgressSummary {
    const sorted = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
    const rate = Math.round(sorted.reduce((s, st) => s + st.progressRate, 0) / (sorted.length || 1));
    const active = sorted.find((s) => s.status === StageStatus.ACTIVE);
    const next = sorted.find((s) => s.status === StageStatus.PENDING);
    return {
      rate,
      currentStage: active?.stageName ?? (rate === 100 ? '완료' : sorted[0]?.stageName ?? '-'),
      nextMilestone: next?.stageName ?? '-',
    };
  }
}
