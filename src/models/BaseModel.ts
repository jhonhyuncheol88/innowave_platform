import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';

/**
 * BaseModel — 모든 도메인 모델의 추상 부모 클래스 (M of MVC)
 * Firestore 문서 <-> 도메인 객체 변환 규약을 강제한다.
 */
export abstract class BaseModel {
  id: string | null;

  constructor(id: string | null = null) {
    this.id = id;
  }

  /** Firestore 저장용 평면 객체. 하위 클래스에서 반드시 구현. */
  abstract toFirestore(): DocumentData;

  /** Firestore withConverter용 컨버터 팩토리 */
  static converter<T extends BaseModel>(
    this: {
      new (...args: never[]): T;
      fromFirestore(id: string, data: DocumentData): T;
    },
  ): FirestoreDataConverter<T> {
    const ModelClass = this;
    return {
      toFirestore: (model: T) => model.toFirestore(),
      fromFirestore: (snapshot: QueryDocumentSnapshot, options?: SnapshotOptions) =>
        ModelClass.fromFirestore(snapshot.id, snapshot.data(options)),
    };
  }

  static fromFirestore(_id: string, _data: DocumentData): BaseModel {
    throw new Error(`${this.name}.fromFirestore() not implemented`);
  }
}
