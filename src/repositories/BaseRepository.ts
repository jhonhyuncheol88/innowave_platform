/**
 * BaseRepository — Firestore 데이터 접근 계층의 추상 부모 클래스
 * Controller는 Firestore SDK를 직접 알지 못하고 Repository만 사용한다.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  serverTimestamp,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import type { BaseModel } from '../models/BaseModel.js';

type ModelConstructor<T extends BaseModel> = {
  new (...args: never[]): T;
  converter(): ReturnType<typeof BaseModel.converter<T>>;
  fromFirestore(id: string, data: DocumentData): T;
};

type TimestampableModel<T extends BaseModel> = T & {
  createdAt?: unknown;
  updatedAt?: unknown;
};

export class BaseRepository<T extends BaseModel> {
  protected collectionPath: string;
  protected ModelClass: ModelConstructor<T>;

  constructor(collectionPath: string, ModelClass: ModelConstructor<T>) {
    this.collectionPath = collectionPath;
    this.ModelClass = ModelClass;
  }

  get colRef() {
    return collection(db, this.collectionPath).withConverter(this.ModelClass.converter());
  }

  docRef(id: string) {
    return doc(db, this.collectionPath, id).withConverter(this.ModelClass.converter());
  }

  async findById(id: string): Promise<T | null> {
    const snap = await getDoc(this.docRef(id));
    return snap.exists() ? snap.data() : null;
  }

  async findAll(...constraints: QueryConstraint[]): Promise<T[]> {
    const snap = await getDocs(query(this.colRef, ...constraints));
    return snap.docs.map((d) => d.data());
  }

  async create(model: TimestampableModel<T>): Promise<T> {
    model.createdAt = serverTimestamp();
    model.updatedAt = serverTimestamp();
    const ref = await addDoc(this.colRef, model);
    model.id = ref.id;
    return model;
  }

  async save(model: TimestampableModel<T>): Promise<T> {
    if (!model.id) return this.create(model);
    await setDoc(this.docRef(model.id), model, { merge: true });
    return model;
  }

  async patch(id: string, partial: DocumentData): Promise<void> {
    await updateDoc(doc(db, this.collectionPath, id), {
      ...partial,
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionPath, id));
  }

  /** 실시간 구독 — 진행 현황 대시보드(REQ-12) 등에 사용 */
  subscribe(onChange: (items: T[]) => void, ...constraints: QueryConstraint[]): Unsubscribe {
    return onSnapshot(query(this.colRef, ...constraints), (snap) => {
      onChange(snap.docs.map((d) => d.data()));
    });
  }
}
