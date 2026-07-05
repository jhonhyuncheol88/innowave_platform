/**
 * INNOWAVE 화면 ↔ Firestore 데이터 계층
 * 화면 컴포넌트는 이 훅/헬퍼와 컨트롤러만 사용하고 Firestore SDK를 직접 다루지 않는다.
 * (예외: 모델이 없는 caseData/quoteParams와 서브컬렉션 배치 교체는 여기서 직접 처리)
 */
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
import { auth, db, storage } from '../../config/firebase.js';
import { useAuth } from '../../hooks/useAuth.js';
import { eventRepository } from '../../repositories/EventRepository.js';
import { rateCardRepository } from '../../repositories/RateCardRepository.js';
import { personnelRepository } from '../../repositories/PersonnelRepository.js';
import { Event } from '../../models/Event.js';
import type { Personnel } from '../../models/Personnel.js';
import type { RateCard } from '../../models/RateCard.js';
import { Quote, QuoteItem, type QuoteOptionValue } from '../../models/Quote.js';
import type { ProgramItem } from './types.js';

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
  setEntry: (key: string, value: unknown) => void;
  invalidate: (prefix: string) => void;
}

export const useCacheStore = create<CacheStore>((set) => ({
  entries: {},
  setEntry: (key, value) => set((s) => ({ entries: { ...s.entries, [key]: value } })),
  invalidate: (prefix) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).filter(([k]) => !k.startsWith(prefix))),
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
  const setEntry = useCacheStore((s) => s.setEntry);
  const [local, setLocal] = useState<T | null>(null);
  const [fetching, setFetching] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const hasCache = key != null && useCacheStore.getState().entries[key] !== undefined;
    if (!hasCache) {
      setFetching(true);
      setLocal(null);
    }
    setError(null);
    fetcher()
      .then((d) => {
        if (key != null) setEntry(key, d);
        if (alive) { setLocal(d); setFetching(false); }
      })
      .catch((e) => { if (alive) { setError(errMessage(e)); setFetching(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const data = (cached !== undefined ? cached : local) ?? null;
  return { data, loading: cached === undefined && fetching, error, reload };
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

/** 저장된 인력 선택 (events/{id}/matches) — 3단계 수정 시 복원용 */
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

/** 이벤트 문서 수정 후 관련 캐시 무효화 — 화면들이 patch 후 호출 */
export function invalidateEvent(eventId: string | null): void {
  invalidateCache('events');
  if (eventId) invalidateCache(`event:${eventId}`);
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

/** 카테고리별 대표 항목을 골라 규모·기간 기반 수량 휴리스틱으로 견적 라인 구성 */
export function buildQuoteItems(cards: RateCard[], event: Event | null): QuoteItem[] {
  const scale = event?.basicInfo.participantScale || 100;
  const days = eventDays(event);
  const picks: { cat: string; qty: number }[] = [
    { cat: '장소·공간', qty: days },
    { cat: '장비·시스템', qty: 1 },
    { cat: '케이터링·다과', qty: scale },
    { cat: '인쇄·디자인', qty: 10 },
    { cat: '인력', qty: 10 * days },
    { cat: '기념품·굿즈', qty: scale },
    { cat: '마케팅·홍보', qty: 1 },
    { cat: '온라인·플랫폼', qty: 1 },
    { cat: '안전·보험', qty: 1 },
    { cat: '운영·행정', qty: 1 },
  ];
  return picks.flatMap(({ cat, qty }) => {
    const card = cards
      .filter((c) => c.isActive && c.category === cat)
      .sort((a, b) => b.unitPrice - a.unitPrice)[0];
    if (!card) return [];
    return [new QuoteItem({
      rateCardId: card.id ?? '',
      itemName: card.itemName,
      unit: card.unit,
      qty,
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
