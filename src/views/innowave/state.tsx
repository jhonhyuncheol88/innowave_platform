import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import type { IwState, Milestone, PlanId, ScreenId } from './types.js';
import { INITIAL_MILESTONES, INITIAL_POOL_LIST, INITIAL_PROGRAMS, INITIAL_RATE_LIST } from './data.js';

const INITIAL_STATE: IwState = {
  currentEventId: null,
  guestInfo: null,
  programsEventId: null,
  suppliesEventId: null,
  matchesEventId: null,
  planEventId: null,
  uploaded: false,
  opMode: '오프라인',
  programs: INITIAL_PROGRAMS,
  supplies: [],
  editIdx: null,
  editTime: '',
  editName: '',
  editDur: 30,
  roleTab: '강사',
  selected: {},
  budget: 6000,
  plan: 'standard',
  detailOpen: false,
  pubDone: false,
  msTemplate: null,
  msList: INITIAL_MILESTONES,
  projFilter: '전체',
  adminTab: '레이트카드',
  poolRole: '전체 역할',
  poolList: INITIAL_POOL_LIST,
  qpMargin: '20',
  qpVat: '10',
  qpBasic: '0.8',
  qpPremium: '1.3',
  qpSaved: false,
  adminCat: '전체 카테고리',
  adminQuery: '',
  rateList: INITIAL_RATE_LIST,
  rcOpen: false,
  rcIdx: null,
  rcName: '',
  rcCat: '장소·공간',
  rcUnit: '',
  rcPrice: '',
  rcMargin: '',
};

/** '새 기획 시작' 등에서 워크플로우 로컬 상태를 초기값으로 되돌릴 때 사용 */
export const WORKFLOW_RESET: Partial<IwState> = {
  currentEventId: null,
  guestInfo: null,
  programsEventId: null,
  suppliesEventId: null,
  matchesEventId: null,
  planEventId: null,
  uploaded: false,
  opMode: '오프라인',
  programs: INITIAL_PROGRAMS,
  supplies: [],
  editIdx: null,
  selected: {},
  budget: 6000,
  plan: 'standard',
  detailOpen: false,
};

interface IwStore extends IwState {
  /** 부분 패치 — 기존 useIw().set 과 동일한 시그니처 */
  patch: (p: Partial<IwState>) => void;
}

/** 앱 공유 상태 — zustand 스토어라 라우트 리마운트와 무관하게 유지된다 */
export const useIwStore = create<IwStore>((setState) => ({
  ...INITIAL_STATE,
  patch: (p) => setState(p),
}));

interface IwContextValue {
  s: IwState;
  set: (patch: Partial<IwState>) => void;
  go: (screen: ScreenId) => void;
}

/** 기존 화면들과의 호환 훅 — { s, set, go } 형태 유지 */
export function useIw(): IwContextValue {
  const s = useIwStore();
  const navigate = useNavigate();

  const go = useCallback((screen: ScreenId) => {
    navigate(screen === 'landing' ? '/' : `/${screen}`);
    window.scrollTo(0, 0);
  }, [navigate]);

  return { s, set: s.patch, go };
}

/** ₩ 표기용 반올림 + 천 단위 구분 */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

export interface QuoteBreakdown {
  supply: number;
  margin: number;
  vat: number;
  total: number;
}

/** 예산 한도(만 원)와 배율로 총액을 역산해 공급가·마진·부가세로 분해 */
export function mkQuote(budget: number, mult: number, qpMargin: string, qpVat: string): QuoteBreakdown {
  const m = (Number(qpMargin) || 0) / 100;
  const v = (Number(qpVat) || 0) / 100;
  const supply = (budget * mult * 10000) / ((1 + m) * (1 + v));
  const margin = supply * m;
  const vat = (supply + margin) * v;
  return { supply, margin, vat, total: supply + margin + vat };
}

export interface PlanDef {
  id: PlanId;
  name: string;
  desc: string;
  mult: number;
}

export function getPlanDefs(qpBasic: string, qpPremium: string): PlanDef[] {
  return [
    { id: 'basic', name: 'Basic', desc: '핵심 프로그램 중심의 실속 구성', mult: Number(qpBasic) || 0.82 },
    { id: 'standard', name: 'Standard', desc: '권장 구성 — 예산 한도 기준 최적화', mult: 1.0 },
    { id: 'premium', name: 'Premium', desc: '브랜딩·중계까지 포함한 확장 구성', mult: Number(qpPremium) || 1.22 },
  ];
}

/** 수행사 입력 단계 목록 → 발주처 대시보드 진행률(%) */
export function calcDashProgress(msList: Milestone[]): number {
  if (msList.length === 0) return 0;
  const done = msList.filter((m) => m.st === 'done').length;
  const active = msList.filter((m) => m.st === 'active').length;
  return Math.round(((done + active * 0.6) / msList.length) * 100);
}

/** 3단계 인력 선택 요약: 역할별 인원 수 */
export function selectionSummary(selected: Record<string, boolean>): { role: string; count: number }[] {
  const counts: Record<string, number> = {};
  Object.keys(selected).forEach((k) => {
    const role = k.split(':')[0];
    counts[role] = (counts[role] || 0) + 1;
  });
  return Object.entries(counts).map(([role, count]) => ({ role, count }));
}
