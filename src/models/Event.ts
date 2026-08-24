import type { DocumentData, FieldValue, Timestamp } from 'firebase/firestore';
import { BaseModel } from './BaseModel.js';

/** 행사 상태 머신 — 워크플로우 4단계(REQ-01~11)와 진행(REQ-12) 상태 */
export const EventStatus = Object.freeze({
  DRAFT: 'draft',            // 1단계 작성 중
  COMPOSING: 'composing',    // 2단계 프로그램 구성
  MATCHING: 'matching',      // 3단계 인력 매칭
  QUOTED: 'quoted',          // 4단계 견적 산출 완료
  CONFIRMED: 'confirmed',    // 발주 확정
  IN_PROGRESS: 'in_progress',// 용역 수행 중 (진행 현황 조회 대상)
  DONE: 'done',
} as const);

export type EventStatusValue = (typeof EventStatus)[keyof typeof EventStatus];

export const EVENT_TYPES = Object.freeze([
  '해커톤·아이디어톤', '부트캠프·창업캠프', '데모데이·IR피칭', '경진대회',
  '네트워킹', '포럼·컨퍼런스', '특강·세미나', '박람회·전시',
] as const);

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventBasicInfo {
  name: string;
  organizer: string;
  eventType: string;
  periodStart: string | null;
  periodEnd: string | null;
  region: string;
  operationType: string;
  participantScale: number;
  budgetLimit: number;
  purpose: string;
  kpis?: { name: string; target: string }[];
}

export interface ProgressSummary {
  rate: number;
  currentStage: string;
  nextMilestone: string;
}
export interface EventInit {
  id?: string | null;
  ownerUid: string;
  clientOrgId?: string | null;
  basicInfo?: Partial<EventBasicInfo>;
  parsedFromDoc?: boolean;
  status?: EventStatusValue;
  currentStep?: number;
  progressSummary?: ProgressSummary | null;
  /** 휴지통 이동 시각 — null이면 정상, 값이 있으면 휴지통 상태 */
  deletedAt?: Timestamp | FieldValue | null;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

export class Event extends BaseModel {
  ownerUid: string;
  clientOrgId: string | null;
  basicInfo: EventBasicInfo;
  parsedFromDoc: boolean;
  status: EventStatusValue;
  currentStep: number;
  progressSummary: ProgressSummary | null;
  deletedAt: Timestamp | FieldValue | null;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;

  constructor({
    id = null,
    ownerUid,
    clientOrgId = null,
    basicInfo = {},
    parsedFromDoc = false,
    status = EventStatus.DRAFT,
    currentStep = 1,
    progressSummary = null,
    deletedAt = null,
    createdAt = null,
    updatedAt = null,
  }: EventInit) {
    super(id);
    this.ownerUid = ownerUid;
    this.clientOrgId = clientOrgId;
    this.basicInfo = {
      name: '',
      organizer: '',
      eventType: '',
      periodStart: null,
      periodEnd: null,
      region: '',
      operationType: '오프라인',
      participantScale: 0,
      budgetLimit: 0,
      purpose: '',
      kpis: [],
      ...basicInfo,
    };
    this.parsedFromDoc = parsedFromDoc;
    this.status = status;
    this.currentStep = currentStep;
    this.progressSummary = progressSummary;
    this.deletedAt = deletedAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** 다음 단계 진입 가능 여부 — 단계별 필수값 검증 (1 정보 → 2 프로그램 → 3 비품 → 4 인력 → 5 견적) */
  canAdvanceTo(step: number): boolean {
    if (step === 2) {
      const b = this.basicInfo;
      return Boolean(b.name && b.eventType && b.periodStart && b.participantScale > 0);
    }
    if (step === 3 || step === 4) return this.status !== EventStatus.DRAFT;
    if (step === 5) {
      return (this.status === EventStatus.MATCHING || this.status === EventStatus.QUOTED);
    }
    return step === 1;
  }

  get isEditable(): boolean {
    return (
      this.status !== EventStatus.CONFIRMED
      && this.status !== EventStatus.IN_PROGRESS
      && this.status !== EventStatus.DONE
    );
  }

  toFirestore(): DocumentData {
    return {
      ownerUid: this.ownerUid,
      clientOrgId: this.clientOrgId,
      basicInfo: this.basicInfo,
      parsedFromDoc: this.parsedFromDoc,
      status: this.status,
      currentStep: this.currentStep,
      progressSummary: this.progressSummary,
      deletedAt: this.deletedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromFirestore(id: string, data: DocumentData): Event {
    return new Event({ id, ...data } as EventInit);
  }
}
