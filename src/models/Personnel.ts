import type { DocumentData } from 'firebase/firestore';
import { BaseModel } from './BaseModel.js';
import type { Event } from './Event.js';

export const PersonnelRole = Object.freeze({
  LECTURER: '강사',
  MENTOR: '멘토',
  JUDGE: '심사위원',
  STAFF: '운영인력',
} as const);

export type PersonnelRoleValue = (typeof PersonnelRole)[keyof typeof PersonnelRole];

export interface PersonnelInit {
  id?: string | null;
  name: string;
  role: PersonnelRoleValue | string;
  expertiseField: string;
  affiliation?: string;
  careerYears?: number;
  careerSummary?: string;
  eventExperienceCount?: number;
  rating?: number;
  activityRegion?: string;
  availableType?: string;
  unitRate?: number;
  isActive?: boolean;
}

export class Personnel extends BaseModel {
  name: string;
  role: PersonnelRoleValue | string;
  expertiseField: string;
  affiliation: string;
  careerYears: number;
  careerSummary: string;
  eventExperienceCount: number;
  rating: number;
  activityRegion: string;
  availableType: string;
  unitRate: number;
  isActive: boolean;

  constructor({
    id = null,
    name,
    role,
    expertiseField,
    affiliation = '',
    careerYears = 0,
    careerSummary = '',
    eventExperienceCount = 0,
    rating = 0,
    activityRegion = '전국',
    availableType = '온오프라인',
    unitRate = 0,
    isActive = true,
  }: PersonnelInit) {
    super(id);
    this.name = name;
    this.role = role;
    this.expertiseField = expertiseField;
    this.affiliation = affiliation;
    this.careerYears = careerYears;
    this.careerSummary = careerSummary;
    this.eventExperienceCount = eventExperienceCount;
    this.rating = rating;
    this.activityRegion = activityRegion;
    this.availableType = availableType;
    this.unitRate = unitRate;
    this.isActive = isActive;
  }

  /**
   * 행사와의 적합도 점수 (0~100) — REQ-07 추천 정렬 기준
   * 지역 일치(30) + 운영형태 호환(20) + 평점(30) + 경험치(20)
   */
  matchScoreFor(event: Event): number {
    const b = event.basicInfo;
    let score = 0;
    if (this.activityRegion === '전국' || this.activityRegion === b.region) score += 30;
    const online = b.operationType !== '오프라인';
    if (
      this.availableType === '온오프라인'
      || (online && this.availableType === '온라인')
      || (!online && this.availableType === '오프라인')
    ) score += 20;
    score += (this.rating / 5) * 30;
    score += Math.min(this.eventExperienceCount / 30, 1) * 20;
    return Math.round(score);
  }

  toFirestore(): DocumentData {
    const { id: _id, ...rest } = this;
    return rest;
  }

  static fromFirestore(id: string, data: DocumentData): Personnel {
    return new Personnel({ id, ...data } as PersonnelInit);
  }
}
