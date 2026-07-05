/** INNOWAVE.dc.html 프로토타입 상태 타입 */
import type { EventBasicInfo } from '../../models/Event.js';

export type ScreenId =
  | 'landing' | 'auth'
  | 'step1' | 'step2' | 'step3' | 'step4'
  | 'proposal' | 'progress' | 'dashboard' | 'projects' | 'admin'
  | 'project'; // 프로젝트 상세 허브 (하단 데모 내비게이션에는 미노출)

export interface ProgramItem {
  time: string;
  name: string;
  dur: number; // 분
  ai: boolean; // AI 제안 여부 (false = 직접 수정)
}

export type StageStatus = 'done' | 'active' | 'todo';

export interface Milestone {
  title: string;
  st: StageStatus;
  note: string;
  file: string; // '' = 첨부 없음
}

export interface RateItem {
  name: string;
  cat: string;
  unit: string;
  price: number;
  margin: number; // %
  active: boolean;
}

export interface PoolPerson {
  name: string;
  role: string;
  field: string;
  region: string;
  rating: number;
  count: number;
  active: boolean;
}

export interface MatchPerson {
  name: string;
  tags: string;
  summary: string;
  fit: number;
  rating: string;
  region: string;
  c: string; // 아바타 배경색
}

export type PlanId = 'basic' | 'standard' | 'premium';

export interface IwState {
  /** 현재 작업 중인 events/{id} 문서 ID — 워크플로우·대시보드·진행입력이 공유 */
  currentEventId: string | null;
  /** 비로그인 게스트가 1단계에서 입력한 행사 정보 (Firestore 미저장, 3·4단계 데모 계산용) */
  guestInfo: EventBasicInfo | null;
  uploaded: boolean;
  opMode: string;
  programs: ProgramItem[];
  editIdx: number | null;
  editTime: string;
  editName: string;
  editDur: number;
  roleTab: string;
  selected: Record<string, boolean>;
  budget: number; // 만 원
  plan: PlanId;
  detailOpen: boolean;
  pubDone: boolean;
  msTemplate: string | null;
  msList: Milestone[];
  projFilter: string;
  adminTab: string;
  poolRole: string;
  poolList: PoolPerson[];
  qpMargin: string;
  qpVat: string;
  qpBasic: string;
  qpPremium: string;
  qpSaved: boolean;
  adminCat: string;
  adminQuery: string;
  rateList: RateItem[];
  rcOpen: boolean;
  rcIdx: number | null;
  rcName: string;
  rcCat: string;
  rcUnit: string;
  rcPrice: string;
  rcMargin: string;
}
