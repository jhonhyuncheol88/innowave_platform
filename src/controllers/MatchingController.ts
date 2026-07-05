/**
 * MatchingController — 인력풀 추천/선택 로직 (REQ-07, 08)
 */
import { personnelRepository, type PersonnelRepository } from '../repositories/PersonnelRepository.js';
import { PersonnelRole, type Personnel, type PersonnelRoleValue } from '../models/Personnel.js';
import type { Event } from '../models/Event.js';

export interface MatchRecommendation {
  person: Personnel;
  score: number;
}

export class MatchingController {
  private personnel: PersonnelRepository;

  constructor(personnel: PersonnelRepository = personnelRepository) {
    this.personnel = personnel;
  }

  /** 역할별 상위 후보를 가져와 행사 적합도 점수로 재정렬 */
  async recommendFor(
    event: Event,
    role: PersonnelRoleValue = PersonnelRole.LECTURER,
    count = 5,
  ): Promise<MatchRecommendation[]> {
    const candidates = await this.personnel.findTopByRole(role, 30);
    return candidates
      .map((p) => ({ person: p, score: p.matchScoreFor(event) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /** 전 역할 일괄 추천 (3단계 화면 초기 로드) */
  async recommendAll(event: Event): Promise<Record<PersonnelRoleValue, MatchRecommendation[]>> {
    const roles = Object.values(PersonnelRole) as PersonnelRoleValue[];
    const results = await Promise.all(roles.map((r) => this.recommendFor(event, r)));
    return Object.fromEntries(roles.map((r, i) => [r, results[i]])) as Record<
      PersonnelRoleValue,
      MatchRecommendation[]
    >;
  }
}

export const matchingController = new MatchingController();
