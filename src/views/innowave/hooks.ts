/**
 * INNOWAVE 화면 ↔ Firestore 데이터 계층
 * 화면 컴포넌트는 이 훅/헬퍼와 컨트롤러만 사용하고 Firestore SDK를 직접 다루지 않는다.
 * (예외: 모델이 없는 caseData/quoteParams와 서브컬렉션 배치 교체는 여기서 직접 처리)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, storage } from '../../config/firebase.js';
import { useAuth } from '../../hooks/useAuth.js';
import { eventRepository } from '../../repositories/EventRepository.js';
import { rateCardRepository } from '../../repositories/RateCardRepository.js';
import { personnelRepository } from '../../repositories/PersonnelRepository.js';
import { Event } from '../../models/Event.js';
import type { Personnel } from '../../models/Personnel.js';
import type { RateCard } from '../../models/RateCard.js';
import { Quote, QuoteItem, type QuoteOptionValue } from '../../models/Quote.js';
import type { ProgramItem, SupplyItem } from './types.js';

/* ── 공통 ─────────────────────────────────────────── */

export function errMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') {
    // 비로그인 상태에서 난 권한 오류는 로그인만 하면 해결된다 — 승인/권한 얘기로 겁주지 않는다
    if (!auth.currentUser) {
      return '로그인이 필요한 작업입니다. Google 로그인 후 이어서 진행할 수 있어요.';
    }
    return '접근 권한이 없습니다. 계정이 관리자 승인(사용허가)을 받았는지 확인해 주세요. 시드 데이터 전체 조회·관리자 기능은 admin 권한이 필요합니다 (관리자 페이지 > 사용자 관리에서 부여).';
  }
  if (code === 'failed-precondition') {
    return '필요한 Firestore 인덱스가 아직 없습니다. `firebase deploy --only firestore:indexes`를 실행해 주세요.';
  }
  if (code === 'unavailable') return '네트워크에 연결할 수 없습니다. 연결 상태를 확인해 주세요.';
  return (e as Error)?.message ?? '데이터를 불러오지 못했습니다.';
}

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/* ── 데이터 캐시 (zustand) — stale-while-revalidate ──
   같은 key를 쓰는 화면들이 캐시를 공유한다. 재방문 시 캐시를 즉시 그리고
   백그라운드에서 갱신하므로 로딩 스피너 깜빡임이 사라진다. */

interface CacheStore {
  entries: Record<string, unknown>;
  /** key별 무효화 세대 — invalidate 시 증가해 마운트된 useAsyncData가 자동 재조회 */
  versions: Record<string, number>;
  setEntry: (key: string, value: unknown) => void;
  invalidate: (prefix: string) => void;
}

export const useCacheStore = create<CacheStore>((set) => ({
  entries: {},
  versions: {},
  setEntry: (key, value) => set((s) => ({
    entries: { ...s.entries, [key]: value },
    versions: { ...s.versions, [key]: s.versions[key] ?? 0 },
  })),
  invalidate: (prefix) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).filter(([k]) => !k.startsWith(prefix))),
    versions: Object.fromEntries(Object.entries(s.versions).map(([k, v]) => [k, k.startsWith(prefix) ? v + 1 : v])),
  })),
}));

/** 뮤테이션 직후 관련 캐시 무효화 (예: invalidateCache('events'), invalidateCache('event:abc')) */
export function invalidateCache(prefix: string): void {
  useCacheStore.getState().invalidate(prefix);
}

/**
 * key가 같으면 캐시를 즉시 표시하고 조용히 재검증한다.
 * key=null 이면 캐시 없이 매번 조회 (짧은 목록 등).
 */
export function useAsyncData<T>(key: string | null, fetcher: () => Promise<T>, deps: unknown[]): AsyncData<T> {
  const cached = useCacheStore((s) => (key != null ? (s.entries[key] as T | undefined) : undefined));
  const version = useCacheStore((s) => (key != null ? (s.versions[key] ?? 0) : 0));
  const setEntry = useCacheStore((s) => s.setEntry);
  const [local, setLocal] = useState<T | null>(null);
  const [fetching, setFetching] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const keyRef = useRef(key);

  useEffect(() => {
    let alive = true;
    const keyChanged = keyRef.current !== key;
    keyRef.current = key;
    const hasCache = key != null && useCacheStore.getState().entries[key] !== undefined;
    if (!hasCache) {
      setFetching(true);
      // 키가 바뀐 경우(다른 프로젝트/탭)에는 이전 키의 값을 보여주지 않는다.
      // 같은 키의 무효화(재검증)라면 이전 값을 유지해 깜빡임 없이 갱신.
      if (keyChanged) setLocal(null);
    }
    setError(null);
    fetcher()
      .then((d) => {
        if (key != null) setEntry(key, d);
        if (alive) { setLocal(d); setFetching(false); }
      })
      .catch((e) => { if (alive) { setError(errMessage(e)); setFetching(false); } });
    return () => { alive = false; };
    // version: invalidateCache가 세대를 올리면 마운트된 상태에서도 자동 재조회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, version]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const data = (cached !== undefined ? cached : local) ?? null;
  // 재검증 중에는 이전 값(local)을 유지해 스피너 깜빡임 없이 조용히 갱신
  return { data, loading: data === null && fetching, error, reload };
}

/** Firestore Timestamp → '2026. 7. 3.' */
export function tsLabel(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in (ts as object)) {
    const d = (ts as { toDate(): Date }).toDate();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
  }
  return '-';
}

/** 원 단위 금액 → '4,500만 원' 표기 */
export function wonLabel(won: number): string {
  if (!won) return '-';
  if (won >= 100000000) {
    const eok = Math.floor(won / 100000000);
    const man = Math.round((won % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만 원` : `${eok}억 원`;
  }
  return `${Math.round(won / 10000).toLocaleString('ko-KR')}만 원`;
}

/* ── 이벤트 ───────────────────────────────────────── */

/** 내 프로젝트 목록 — admin은 전체, 그 외에는 본인 소유만 */
export function useMyEvents() {
  const { user, role, loading: authLoading } = useAuth();
  const result = useAsyncData<Event[]>(`events:${role ?? 'none'}:${user?.uid ?? 'anon'}`, async () => {
    if (!user) return [];
    if (role === 'admin') return eventRepository.findAll(orderBy('updatedAt', 'desc'));
    return eventRepository.findMine(user.uid);
  }, [user?.uid, role]);
  return { ...result, events: result.data ?? [], loading: authLoading || result.loading, isAdmin: role === 'admin' };
}

export function useEvent(eventId: string | null) {
  const result = useAsyncData<Event | null>(
    eventId ? `event:${eventId}` : null,
    async () => (eventId ? eventRepository.findById(eventId) : null),
    [eventId],
  );
  return { ...result, event: result.data };
}

/** 프로젝트 허브: 저장된 최신 견적 (events/{id}/quotes) */
export function useLatestQuote(eventId: string | null) {
  const result = useAsyncData<Quote | null>(eventId ? `quote:${eventId}` : null, async () => {
    if (!eventId) return null;
    const quotes = await eventRepository.quoteRepo(eventId).findAll(orderBy('createdAt', 'desc'), fbLimit(1));
    return quotes[0] ?? null;
  }, [eventId]);
  return { ...result, quote: result.data };
}

export interface SavedProgram {
  title: string;
  startTime: string;
  durationMin: number;
  source: string;
  order: number;
}

/** 발주처 공유 문서용: 저장된 프로그램 구성 (events/{id}/programs) */
export function usePrograms(eventId: string | null) {
  const result = useAsyncData<SavedProgram[]>(eventId ? `programs:${eventId}` : null, async () => {
    if (!eventId) return [];
    const snap = await getDocs(query(collection(db, `events/${eventId}/programs`), orderBy('order')));
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        title: v.title ?? '',
        startTime: v.startTime ?? '',
        durationMin: Number(v.durationMin) || 0,
        source: v.source ?? 'user',
        order: Number(v.order) || 0,
      };
    });
  }, [eventId]);
  return { ...result, programs: result.data ?? [] };
}

/** 저장된 비품 선택 (events/{id}/supplies) — 3단계 수정·5단계 견적 산출용 */
export function useSupplies(eventId: string | null) {
  const result = useAsyncData<SupplyItem[]>(eventId ? `supplies:${eventId}` : null, async () => {
    if (!eventId) return [];
    const snap = await getDocs(query(collection(db, `events/${eventId}/supplies`), orderBy('order')));
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        rateCardId: v.rateCardId ?? '',
        name: v.itemName ?? '',
        cat: v.category ?? '',
        unit: v.unit ?? '',
        unitPrice: Number(v.unitPrice) || 0,
        marginRate: Number(v.marginRate) || 0,
        qty: Number(v.qty) || 1,
        source: v.source === 'user' ? 'user' as const : 'ai' as const,
      };
    });
  }, [eventId]);
  return { ...result, supplies: result.data ?? [] };
}

/** 3단계 비품 선택 저장 (events/{id}/supplies) — 레이트카드 스냅샷 포함 */
export async function saveSupplies(eventId: string, items: SupplyItem[]): Promise<void> {
  await replaceSubcollection(`events/${eventId}/supplies`, items.map((it, i) => ({
    data: {
      rateCardId: it.rateCardId,
      itemName: it.name,
      category: it.cat,
      unit: it.unit,
      unitPrice: it.unitPrice,
      marginRate: it.marginRate,
      qty: it.qty,
      source: it.source,
      order: i,
    },
  })));
  invalidateCache(`supplies:${eventId}`);
}

/** 저장된 인력 선택 (events/{id}/matches) — 4단계 수정 시 복원용 */
export function useMatches(eventId: string | null) {
  const result = useAsyncData<MatchSelection[]>(eventId ? `matches:${eventId}` : null, async () => {
    if (!eventId) return [];
    const snap = await getDocs(collection(db, `events/${eventId}/matches`));
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        personnelId: v.personnelId ?? '',
        role: v.role ?? '',
        matchScore: Number(v.matchScore) || 0,
        unitRateSnapshot: Number(v.unitRateSnapshot) || 0,
      };
    });
  }, [eventId]);
  return { ...result, matches: result.data ?? [] };
}

/** 프로젝트 삭제 — 소유자/관리자만 (rules). 서브컬렉션 정리는 서버 함수 도입 전까지 보류 */
export async function deleteEvent(eventId: string): Promise<void> {
  await eventRepository.remove(eventId);
  invalidateCache('events');
  invalidateCache(`event:${eventId}`);
  invalidateCache(`quote:${eventId}`);
}

/** 휴지통 이동 (소프트 삭제) — deletedAt 마킹, 목록에서 숨김 */
export async function trashEvent(eventId: string): Promise<void> {
  await eventRepository.patch(eventId, { deletedAt: serverTimestamp() });
  invalidateCache('events');
  invalidateCache(`event:${eventId}`);
}

/** 휴지통 복원 */
export async function restoreEvent(eventId: string): Promise<void> {
  await eventRepository.patch(eventId, { deletedAt: null });
  invalidateCache('events');
  invalidateCache(`event:${eventId}`);
}

/** 이벤트 문서 수정 후 관련 캐시 무효화 — 화면들이 patch 후 호출 */
export function invalidateEvent(eventId: string | null): void {
  invalidateCache('events');
  if (eventId) invalidateCache(`event:${eventId}`);
}

/** 워크플로우 상태 순서 — 단계 저장이 확정/진행 중 상태를 되돌리지 않게 하는 기준 */
const STATUS_RANK: Record<string, number> = {
  draft: 0, composing: 1, matching: 2, quoted: 3, confirmed: 4, in_progress: 5, done: 6,
};

/**
 * 단계 저장 시 이벤트 패치 — 상태·currentStep은 앞으로 갈 때만 갱신한다.
 * (예: in_progress 프로젝트의 프로그램을 수정해도 상태가 'matching'으로 후퇴하지 않음)
 */
export async function saveWorkflowStep(
  eventId: string,
  status: string,
  step: number,
  extra: DocumentData = {},
): Promise<void> {
  const event = await eventRepository.findById(eventId);
  const patch: DocumentData = { ...extra };
  const curRank = STATUS_RANK[event?.status ?? 'draft'] ?? 0;
  const nextRank = STATUS_RANK[status] ?? 0;
  if (nextRank > curRank) patch.status = status;
  if (step > (event?.currentStep ?? 1)) patch.currentStep = step;
  if (Object.keys(patch).length > 0) await eventRepository.patch(eventId, patch);
  invalidateEvent(eventId);
}

/* ── 단계별 AI 지침 (다음 단계 초안 생성 시 반영) ───────── */

export type InstructionKey = 'toStep2' | 'toStep3' | 'toStep4' | 'toStep5';
export type InstructionTarget = 'basicInfo' | 'programs' | 'matching' | 'quote';

export interface BasicInfoInstructionResult {
  fields: {
    name: string; organizer: string; eventType: string;
    periodStart: string; periodEnd: string; region: string;
    operationType: string; participantScale: number; budgetLimit: number; purpose: string;
  };
  note: string;
}

export interface ProgramInstructionResult {
  programs: { time: string; name: string; dur: number }[];
  note: string;
}
export interface MatchingInstructionResult {
  recommendedIds: string[];
  note: string;
}
export interface QuoteInstructionResult {
  items: { rateCardId: string; qty: number }[];
  note: string;
}

const applyInstructionCallable = httpsCallable(functions, 'applyStepInstruction');

/** 지침 문서 로드 — events/{id}/instructions/{key} */
export async function loadStepInstruction(eventId: string, key: InstructionKey): Promise<string> {
  const snap = await getDoc(doc(db, `events/${eventId}/instructions/${key}`));
  return ((snap.data()?.text as string) ?? '').trim();
}

/** 지침 저장 — 프로젝트 하위 컬렉션 문서로 기록 */
export async function saveStepInstruction(eventId: string, key: InstructionKey, text: string): Promise<void> {
  await setDoc(doc(db, `events/${eventId}/instructions/${key}`), {
    text: text.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid ?? '',
  }, { merge: true });
}

/* ── 단계별 AI 채팅 기록 (events/{id}/chats/{stepKey}) ── */

export type StepChatKey = 'step1' | 'step2' | 'step3' | 'step4';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  at: number; // epoch ms (배열 내부라 serverTimestamp 불가)
}

export async function loadStepChat(eventId: string, stepKey: StepChatKey): Promise<ChatMessage[]> {
  const snap = await getDoc(doc(db, `events/${eventId}/chats/${stepKey}`));
  return (snap.data()?.messages as ChatMessage[]) ?? [];
}

export async function saveStepChat(eventId: string, stepKey: StepChatKey, messages: ChatMessage[]): Promise<void> {
  await setDoc(doc(db, `events/${eventId}/chats/${stepKey}`), {
    messages: messages.slice(-60), // 최근 60개만 보존
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid ?? '',
  });
}

/** AI 반영 결과 기록 — 언제 어떤 요약으로 반영됐는지 지침 문서에 남긴다 */
export async function markInstructionApplied(eventId: string, key: InstructionKey, note: string): Promise<void> {
  await setDoc(doc(db, `events/${eventId}/instructions/${key}`), {
    appliedNote: note,
    appliedAt: serverTimestamp(),
  }, { merge: true });
}

/** Cloud Function 호출 — 지침을 반영해 다음 단계 초안을 조정 */
export async function applyStepInstruction<T>(
  target: InstructionTarget,
  instruction: string,
  eventInfo: unknown,
  base: unknown,
): Promise<T> {
  const res = await applyInstructionCallable({ target, instruction, eventInfo, base });
  return res.data as T;
}

/* ── 5단계 산출 문서 (운영사업 제안서 · 과업지시서) ───────── */

export type WorkflowDocType = 'proposal' | 'workorder';

export interface DocRow { label: string; value: string }

export interface ProposalDocContent {
  overviewRows: DocRow[];
  backgroundPolicy: string[];
  backgroundEnvironment: string[];
  necessity: string[];
  goals: string[];
  effects: string[];
  programDirection: string[];
  differentiation: string[];
  recruitment: string[];
  promotion: string[];
  aftercare: string[];
  contentAssets: string[];
  kpi: { name: string; target: string; note: string }[];
  schedule: { period: string; activity: string }[];
  team: string[];
  risks: { risk: string; mitigation: string }[];
  budgetSummary: string;
}

export interface WorkorderDocContent {
  overviewRows: DocRow[];
  purpose: string[];
  scopePre: string[];
  scopeRun: string[];
  scopePost: string[];
  taskRows: DocRow[];
  direction: string[];
  notes: string[];
  schedule: string[];
}

const generateDocumentCallable = httpsCallable(functions, 'generateDocument');

/** 문서 텍스트의 5자리 이상 숫자에 천 단위 콤마 적용 (연도·시각·전화번호 등 4자리 이하는 유지) */
export function normalizeDocNumbers<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/\d{5,}/g, (m) => Number(m).toLocaleString('ko-KR')) as T;
  }
  if (Array.isArray(value)) return value.map((v) => normalizeDocNumbers(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeDocNumbers(v)]),
    ) as T;
  }
  return value;
}

/** Cloud Function 호출 — 워크플로우 데이터로 산출 문서 서술 섹션 생성 (금액 콤마 정규화 포함) */
export async function generateWorkflowDocument<T>(docType: WorkflowDocType, context: unknown): Promise<T> {
  const res = await generateDocumentCallable({ docType, context });
  return normalizeDocNumbers(res.data as T);
}

/* ── 4단계 → 5단계 이동 시 문서 사전 생성 ── */
const docGenPending = new Map<string, Promise<void>>();

/** 두 산출 문서(제안서·과업지시서)를 백그라운드에서 생성·저장 시작 — 이미 진행 중이면 무시 */
export function startDocumentPregeneration(eventId: string, context: unknown): void {
  if (docGenPending.has(eventId)) return;
  const run = (async () => {
    const [proposal, workorder] = await Promise.all([
      generateWorkflowDocument<ProposalDocContent>('proposal', context),
      generateWorkflowDocument<WorkorderDocContent>('workorder', context),
    ]);
    await Promise.all([
      saveWorkflowDocument(eventId, 'proposal', proposal),
      saveWorkflowDocument(eventId, 'workorder', workorder),
    ]);
  })();
  docGenPending.set(eventId, run.finally(() => docGenPending.delete(eventId)).catch(() => {}));
}

/** 진행 중인 사전 생성 Promise — 5단계 화면이 대기·완료 감지에 사용 */
export function pendingDocumentGeneration(eventId: string): Promise<void> | null {
  return docGenPending.get(eventId) ?? null;
}

/** 생성 문서 저장 — events/{id}/documents/{proposal|workorder} */
export async function saveWorkflowDocument(eventId: string, docType: WorkflowDocType, content: unknown): Promise<void> {
  await setDoc(doc(db, `events/${eventId}/documents/${docType}`), {
    docType,
    content,
    generatedAt: serverTimestamp(),
    generatedBy: auth.currentUser?.uid ?? '',
  });
}

/** 저장된 생성 문서 로드 */
export async function loadWorkflowDocument<T>(eventId: string, docType: WorkflowDocType): Promise<T | null> {
  const snap = await getDoc(doc(db, `events/${eventId}/documents/${docType}`));
  return (snap.data()?.content as T) ?? null;
}

/* ── 마스터 데이터 ────────────────────────────────── */

/** 역할별 인력풀 — 단일 equality 쿼리로 인덱스 의존 없이 로드 후 클라이언트 정렬
 *  enabled=false면 조회하지 않는다 (비로그인 게스트는 rules상 읽기 불가). */
export function usePersonnel(role: string, max = 60, enabled = true) {
  const result = useAsyncData<Personnel[]>(`personnel:${role}:${max}:${enabled}`, async () => {
    if (!enabled) return [];
    const rows = role === '전체 역할'
      ? await personnelRepository.findAll(fbLimit(max))
      : await personnelRepository.findAll(where('role', '==', role), fbLimit(max));
    return rows.filter((p) => p.isActive !== false).sort((a, b) => b.rating - a.rating);
  }, [role, max, enabled]);
  return { ...result, people: result.data ?? [] };
}

/** 관리자용 — 비활성 포함 전체 인력풀 */
export function usePersonnelAdmin(role: string, max = 100) {
  const result = useAsyncData<Personnel[]>(`personnelAdmin:${role}:${max}`, async () => {
    const rows = role === '전체 역할'
      ? await personnelRepository.findAll(fbLimit(max))
      : await personnelRepository.findAll(where('role', '==', role), fbLimit(max));
    return rows.sort((a, b) => b.rating - a.rating);
  }, [role, max]);
  return { ...result, people: result.data ?? [] };
}

export function useRateCards(enabled = true) {
  const result = useAsyncData<RateCard[]>(`rateCards:${enabled}`, async () => {
    if (!enabled) return [];
    const rows = await rateCardRepository.findAll();
    return rows.sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.itemName.localeCompare(b.itemName, 'ko'));
  }, [enabled]);
  return { ...result, cards: result.data ?? [] };
}

export interface CaseRow {
  id: string;
  eventName: string;
  eventType: string;
  organizer: string;
  participantScale: number;
  budgetTotal: number;
  periodStart: string;
}

export function useCaseData() {
  const result = useAsyncData<CaseRow[]>('caseData', async () => {
    const snap = await getDocs(collection(db, 'caseData'));
    return snap.docs
      .map((d) => {
        const v = d.data();
        return {
          id: d.id,
          eventName: v.eventName ?? '',
          eventType: v.eventType ?? '',
          organizer: v.organizer ?? '',
          participantScale: v.participantScale ?? 0,
          budgetTotal: v.budgetTotal ?? 0,
          periodStart: v.periodStart ?? '',
        };
      })
      .sort((a, b) => (b.periodStart || '').localeCompare(a.periodStart || ''));
  }, []);
  return { ...result, cases: result.data ?? [] };
}

/* ── 문서 분석 (docParses — Vertex AI 파이프라인, REQ-03/04) ── */

export type DocParseStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface ParsedFieldValue {
  value: string | number | null;
  confidence: number;
  evidence: string;
}

export interface ParsedFields {
  name: ParsedFieldValue;
  organizer: ParsedFieldValue;
  eventType: ParsedFieldValue;
  periodStart: ParsedFieldValue;
  periodEnd: ParsedFieldValue;
  region: ParsedFieldValue;
  operationType: ParsedFieldValue;
  participantScale: ParsedFieldValue;
  budgetLimit: ParsedFieldValue;
  purpose: ParsedFieldValue;
}

/* ── 시연용 결정적 파싱 프로필 ──────────────────────
 * 특정 공고·과업지시서 파일이 올라오면 AI 호출 없이 문서에서 사전 추출한 값을 그대로 반환한다.
 * 시연 중 네트워크·모델 변동성을 제거하기 위한 장치로, 값은 원문에 실제로 존재하는 내용만 담는다. */
interface DemoParseProfile {
  /** 파일명에 모두 포함되어야 하는 키워드 묶음 (묶음 중 하나라도 충족하면 매칭) */
  keywordSets: string[][];
  fields: ParsedFields;
}

const DEMO_PARSE_PROFILES: DemoParseProfile[] = [
  {
    // 호서대학교 앵커사업단 아산 스타트업 벤처포럼 입찰공고 (2026-07-31, 공고 제2026-144호)
    keywordSets: [['아산', '벤처포럼'], ['앵커사업단']],
    fields: {
      name: { value: '아산 스타트업 벤처포럼', confidence: 0.95, evidence: '앵커사업단 아산 스타트업 벤처포럼 프로그램 운영 용역' },
      organizer: { value: '호서대학교 앵커사업단', confidence: 0.9, evidence: '공고 제2026-144호 호서대학교' },
      eventType: { value: '포럼·컨퍼런스', confidence: 0.9, evidence: '아산 스타트업 벤처포럼 프로그램' },
      periodStart: { value: '', confidence: 0, evidence: '' },
      periodEnd: { value: '', confidence: 0, evidence: '' },
      region: { value: '충남 아산', confidence: 0.85, evidence: '호서대학교 아산캠퍼스 본관 101호' },
      operationType: { value: '오프라인', confidence: 0.6, evidence: '포럼 운영 및 창업 유치' },
      participantScale: { value: 0, confidence: 0, evidence: '' },
      budgetLimit: { value: 60000000, confidence: 0.95, evidence: '기초금액(부가가치세 포함) 60,000,000원' },
      purpose: { value: '아산 지역 스타트업 벤처포럼 프로그램 운영을 통한 창업 생태계 활성화', confidence: 0.55, evidence: '포럼 운영 및 창업 유치 관련 실적' },
    },
  },
];

/** 파일명이 시연 프로필과 일치하면 사전 추출값 반환, 아니면 null */
export function demoParseFor(fileName: string): ParsedFields | null {
  const n = fileName.replace(/\s+/g, '');
  const hit = DEMO_PARSE_PROFILES.find((p) => p.keywordSets.some((set) => set.every((k) => n.includes(k))));
  return hit ? hit.fields : null;
}

export interface DocParse {
  id: string;
  fileName: string;
  status: DocParseStatus;
  fields: ParsedFields | null;
  error: string | null;
}

export const DOC_ACCEPT = '.pdf,.docx,.pptx,.xlsx,.hwp,.hwpx';

/** 파일 업로드 시작: docParses 문서 생성(pending) → Storage 업로드 → Functions가 이어받는다 */
export async function startDocParse(uid: string, file: File): Promise<string> {
  const docId = crypto.randomUUID();
  await setDoc(doc(db, 'docParses', docId), {
    uid,
    fileName: file.name,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  await uploadBytes(
    storageRef(storage, `uploads/${uid}/${docId}/${file.name}`),
    file,
    { contentType: file.type || 'application/octet-stream' },
  );
  return docId;
}

/** 분석 진행 상황 실시간 구독 */
export function subscribeDocParse(docId: string, onChange: (parse: DocParse) => void): Unsubscribe {
  return onSnapshot(doc(db, 'docParses', docId), (snap) => {
    if (!snap.exists()) return;
    const v = snap.data();
    onChange({
      id: snap.id,
      fileName: v.fileName ?? '',
      status: (v.status as DocParseStatus | undefined) ?? 'pending',
      fields: (v.fields as ParsedFields | undefined) ?? null,
      error: v.error ?? null,
    });
  });
}

/* ── 고객문의 (inquiries) ─────────────────────────── */

export type InquiryStatus = 'new' | 'in_progress' | 'done';

export interface InquiryInput {
  name: string;
  contact: string;
  organization: string;
  eventType: string;
  budgetRange: string;
  message: string;
}

export interface InquiryRow extends InquiryInput {
  id: string;
  status: InquiryStatus;
  memo: string;
  createdAt: unknown;
}

/** 랜딩 문의 접수 — rules상 비로그인도 생성 가능 */
export async function submitInquiry(input: InquiryInput): Promise<void> {
  await addDoc(collection(db, 'inquiries'), {
    ...input,
    status: 'new',
    memo: '',
    source: 'landing',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

const INQUIRY_ORDER: Record<InquiryStatus, number> = { new: 0, in_progress: 1, done: 2 };

export function useInquiriesAdmin() {
  const result = useAsyncData<InquiryRow[]>('inquiries', async () => {
    const snap = await getDocs(collection(db, 'inquiries'));
    return snap.docs
      .map((d) => {
        const v = d.data();
        return {
          id: d.id,
          name: v.name ?? '',
          contact: v.contact ?? '',
          organization: v.organization ?? '',
          eventType: v.eventType ?? '',
          budgetRange: v.budgetRange ?? '',
          message: v.message ?? '',
          status: (v.status as InquiryStatus | undefined) ?? 'new',
          memo: v.memo ?? '',
          createdAt: v.createdAt ?? null,
        };
      })
      .sort((a, b) =>
        INQUIRY_ORDER[a.status] - INQUIRY_ORDER[b.status]
        || ((b.createdAt as { seconds?: number } | null)?.seconds ?? 0) - ((a.createdAt as { seconds?: number } | null)?.seconds ?? 0));
  }, []);
  return { ...result, inquiries: result.data ?? [] };
}

export async function updateInquiry(id: string, patch: Partial<Pick<InquiryRow, 'status' | 'memo'>>): Promise<void> {
  await updateDoc(doc(db, 'inquiries', id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteInquiry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'inquiries', id));
}

/* ── 사용자 관리 (users, 관리자 전용) ─────────────── */

export type UserApproval = 'pending' | 'approved' | 'rejected';

export interface AdminUserRow {
  uid: string;
  displayName: string;
  email: string;
  organization: string;
  role: string;
  approvalStatus: UserApproval;
  clientOrgId: string | null;
  createdAt: unknown;
  lastLoginAt: unknown;
}

const APPROVAL_ORDER: Record<UserApproval, number> = { pending: 0, approved: 1, rejected: 2 };

export function useUsersAdmin() {
  const result = useAsyncData<AdminUserRow[]>('users', async () => {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map((d) => {
        const v = d.data();
        return {
          uid: d.id,
          displayName: v.displayName ?? '',
          email: v.email ?? '',
          organization: v.organization ?? '',
          role: v.role ?? 'user',
          approvalStatus: (v.approvalStatus as UserApproval | undefined) ?? 'approved',
          clientOrgId: v.clientOrgId ?? null,
          createdAt: v.createdAt ?? null,
          lastLoginAt: v.lastLoginAt ?? null,
        };
      })
      .sort((a, b) =>
        APPROVAL_ORDER[a.approvalStatus] - APPROVAL_ORDER[b.approvalStatus]
        || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  }, []);
  return { ...result, users: result.data ?? [] };
}

/** 관리자: 승인 상태·역할·발주처 조직 변경 (rules상 admin만 통과) */
export async function updateUserAdmin(
  uid: string,
  patch: Partial<Pick<AdminUserRow, 'approvalStatus' | 'role' | 'clientOrgId' | 'organization'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...patch, updatedAt: serverTimestamp() });
}

/* ── 견적 파라미터 (quoteParams, 관리자 전용 읽기/쓰기) ── */

export interface QuoteParams {
  marginRate: number;   // % (기본 마진율 — 레이트카드에 마진이 없을 때의 기본값)
  vatRate: number;      // %
  multBasic: number;
  multPremium: number;
}

export const DEFAULT_QUOTE_PARAMS: QuoteParams = {
  marginRate: 20,
  vatRate: 10,
  multBasic: 0.8,
  multPremium: 1.3,
};

export function useQuoteParams() {
  const { user, role } = useAuth();
  const enabled = !!user && role === 'admin';
  const result = useAsyncData<{ params: QuoteParams; available: boolean }>(
    `quoteParams:${enabled}`,
    async () => {
      if (!enabled) return { params: DEFAULT_QUOTE_PARAMS, available: false };
      try {
        const snap = await getDocs(collection(db, 'quoteParams'));
        const next = { ...DEFAULT_QUOTE_PARAMS };
        snap.docs.forEach((d) => {
          const v = d.data();
          if (v.key === 'default_margin') next.marginRate = Number(v.value) || next.marginRate;
          if (v.key === 'vat_rate') next.vatRate = (Number(v.value) || 0.1) * 100;
          if (v.key === 'option_multipliers') {
            next.multBasic = Number(v.value?.basic) || next.multBasic;
            next.multPremium = Number(v.value?.premium) || next.multPremium;
          }
        });
        return { params: next, available: true };
      } catch {
        return { params: DEFAULT_QUOTE_PARAMS, available: false };
      }
    },
    [enabled],
  );

  return {
    params: result.data?.params ?? DEFAULT_QUOTE_PARAMS,
    available: result.data?.available ?? false,
    loading: result.loading,
  };
}

export async function saveQuoteParams(p: QuoteParams, updatedBy: string): Promise<void> {
  const stamp = { updatedAt: serverTimestamp(), updatedBy };
  await Promise.all([
    setDoc(doc(db, 'quoteParams', 'qp-default-margin'), { key: 'default_margin', value: p.marginRate, ...stamp }),
    setDoc(doc(db, 'quoteParams', 'qp-vat-rate'), { key: 'vat_rate', value: p.vatRate / 100, ...stamp }),
    setDoc(doc(db, 'quoteParams', 'qp-option-multipliers'), {
      key: 'option_multipliers',
      value: { basic: p.multBasic, standard: 1.0, premium: p.multPremium },
      ...stamp,
    }),
  ]);
  invalidateCache('quoteParams');
}

/* ── 견적 구성 (REQ-09/10) ────────────────────────── */

function eventDays(event: Event | null): number {
  const s = event?.basicInfo.periodStart;
  const e = event?.basicInfo.periodEnd;
  if (!s || !e) return 1;
  const diff = Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1;
  return Math.max(1, Math.min(diff, 30));
}

const QUOTE_CATEGORIES = [
  '장소·공간', '장비·시스템', '케이터링·다과', '인쇄·디자인', '인력',
  '기념품·굿즈', '마케팅·홍보', '온라인·플랫폼', '안전·보험', '운영·행정',
];

/** 단위 기반 수량 휴리스틱 — 인 단위는 규모, 일 단위는 행사일수, 식·회는 1식 */
function heuristicQty(unit: string, cat: string, scale: number, days: number): number {
  if (unit.includes('인·일')) return Math.max(2, Math.ceil(scale / 25)) * days; // 운영 인력: 25명당 1인 배치
  if (unit.includes('인')) return scale;
  if (unit === '시간') return 3 * days;                                        // 강사 등 시간제: 1일 3시간 기준
  if (unit === '일' || unit === '박') return days;
  if (unit === '개' || unit === '매' || unit === '부') return cat === '기념품·굿즈' ? scale : 10;
  return 1;                                                                    // 식·회·개월 등 일괄 항목
}

/** 카테고리별 중간 가격대 대표 항목을 골라 단위·규모·기간 기반 수량으로 견적 라인 구성 */
export function buildQuoteItems(cards: RateCard[], event: Event | null): QuoteItem[] {
  const scale = event?.basicInfo.participantScale || 100;
  // 장기 용역(수개월)이어도 실제 행사 운영일 기준으로 산정 — 최대 3일
  const days = Math.min(eventDays(event), 3);
  return QUOTE_CATEGORIES.flatMap((cat) => {
    const pool = cards
      .filter((c) => c.isActive && c.category === cat)
      .sort((a, b) => a.unitPrice - b.unitPrice);
    if (pool.length === 0) return [];
    const card = pool[Math.floor(pool.length / 2)]; // 최고가 대신 중간 가격대 항목
    return [new QuoteItem({
      rateCardId: card.id ?? '',
      itemName: card.itemName,
      unit: card.unit,
      qty: heuristicQty(card.unit, cat, scale, days),
      unitPrice: card.unitPrice,
      marginRate: card.marginRate,
    })];
  });
}

/** 옵션 배율 적용 + 예산 한도 시뮬레이션(REQ-10) */
export function buildOptionQuote(
  items: QuoteItem[],
  optionType: QuoteOptionValue,
  mult: number,
  budgetWon: number | null,
): Quote {
  const scaled = items.map((i) => new QuoteItem({ ...i, qty: Math.max(1, Math.round(i.qty * mult)) }));
  const quote = new Quote({ optionType, items: scaled, simulatedBudget: budgetWon });
  return budgetWon ? quote.scaleToBudget(budgetWon) : quote;
}

/* ── 서브컬렉션 배치 교체 헬퍼 ─────────────────────── */

async function replaceSubcollection(path: string, docs: { id?: string; data: DocumentData }[]): Promise<void> {
  const colRef = collection(db, path);
  const existing = await getDocs(query(colRef));
  const batch = writeBatch(db);
  existing.docs.forEach((d) => batch.delete(d.ref));
  docs.forEach(({ id, data }, i) => {
    batch.set(id ? doc(db, path, id) : doc(colRef), { ...data, order: data.order ?? i });
  });
  await batch.commit();
}

/** 2단계 프로그램 구성 저장 (events/{id}/programs, REQ-05/06) */
export async function savePrograms(eventId: string, programs: ProgramItem[]): Promise<void> {
  await replaceSubcollection(`events/${eventId}/programs`, programs.map((p, i) => ({
    data: {
      title: p.name,
      description: '',
      order: i,
      startTime: p.time,
      durationMin: p.dur,
      source: p.ai ? 'ai' : 'user',
      linkedRateCardIds: [],
    },
  })));
  invalidateCache(`programs:${eventId}`);
}

export interface MatchSelection {
  personnelId: string;
  role: string;
  matchScore: number;
  unitRateSnapshot: number;
}

/** 3단계 인력 선택 저장 (events/{id}/matches, REQ-07/08) */
export async function saveMatches(eventId: string, selections: MatchSelection[]): Promise<void> {
  await replaceSubcollection(`events/${eventId}/matches`, selections.map((s) => ({
    data: { ...s, status: 'selected' },
  })));
  invalidateCache(`matches:${eventId}`);
}

export interface StageSeed {
  stageName: string;
  status: 'done' | 'active' | 'pending';
  progressRate: number;
  note: string;
  deliverablePath: string | null;
}

/** 진행 단계 일괄 생성/교체 (events/{id}/progress — rules상 admin 전용 쓰기) */
export async function replaceStages(eventId: string, stages: StageSeed[], updatedBy: string): Promise<void> {
  await replaceSubcollection(`events/${eventId}/progress`, stages.map((s, i) => ({
    id: `stage-${i + 1}`,
    data: { ...s, stageOrder: i + 1, updatedAt: serverTimestamp(), updatedBy },
  })));
  const rate = Math.round(stages.reduce((sum, s) => sum + s.progressRate, 0) / (stages.length || 1));
  const active = stages.find((s) => s.status === 'active');
  const next = stages.find((s) => s.status === 'pending');
  await eventRepository.patch(eventId, {
    progressSummary: {
      rate,
      currentStage: active?.stageName ?? (rate === 100 ? '완료' : stages[0]?.stageName ?? '-'),
      nextMilestone: next?.stageName ?? '-',
    },
  });
  invalidateEvent(eventId);
}
