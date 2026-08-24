import type { DocumentData, FieldValue, Timestamp } from 'firebase/firestore';
import { BaseModel } from './BaseModel.js';

export const QuoteOption = Object.freeze({
  BASIC: 'basic',
  STANDARD: 'standard',
  PREMIUM: 'premium',
} as const);

export type QuoteOptionValue = (typeof QuoteOption)[keyof typeof QuoteOption];

export interface QuoteItemInit {
  rateCardId: string;
  itemName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  marginRate: number;
}

/** 견적 라인 아이템 값 객체 */
export class QuoteItem {
  rateCardId: string;
  itemName: string;
  unit: string;
  qty: number;
  unitPrice: number;
  marginRate: number;

  constructor({ rateCardId, itemName, unit, qty, unitPrice, marginRate }: QuoteItemInit) {
    this.rateCardId = rateCardId;
    this.itemName = itemName;
    this.unit = unit;
    this.qty = qty;
    this.unitPrice = unitPrice;
    this.marginRate = marginRate;
  }

  get amount(): number {
    return Math.round(this.unitPrice * (1 + this.marginRate / 100)) * this.qty;
  }

  toJSON(): QuoteItemInit & { amount: number } {
    return { ...this, amount: this.amount };
  }
}

export interface QuoteInit {
  id?: string | null;
  optionType: QuoteOptionValue;
  items?: (QuoteItem | QuoteItemInit)[];
  simulatedBudget?: number | null;
  generatedDocPath?: string | null;
  createdAt?: Timestamp | FieldValue | null;
}

export class Quote extends BaseModel {
  static VAT_RATE = 0.1;

  optionType: QuoteOptionValue;
  items: QuoteItem[];
  simulatedBudget: number | null;
  generatedDocPath: string | null;
  createdAt: Timestamp | FieldValue | null;

  constructor({
    id = null,
    optionType,
    items = [],
    simulatedBudget = null,
    generatedDocPath = null,
    createdAt = null,
  }: QuoteInit) {
    super(id);
    this.optionType = optionType;
    this.items = items.map((i) => (i instanceof QuoteItem ? i : new QuoteItem(i)));
    this.simulatedBudget = simulatedBudget;
    this.generatedDocPath = generatedDocPath;
    this.createdAt = createdAt;
  }

  get subtotal(): number {
    return this.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  }

  get marginTotal(): number {
    return this.items.reduce((sum, i) => sum + i.amount, 0) - this.subtotal;
  }

  get vat(): number {
    return Math.round((this.subtotal + this.marginTotal) * Quote.VAT_RATE);
  }

  get total(): number {
    return this.subtotal + this.marginTotal + this.vat;
  }

  /** 예산 한도에 맞춰 전 항목 수량을 비례 조정하고, 최소 단가 항목으로 잔차를 흡수한다.
   *  총액(부가세 포함)이 예산을 넘지 않는 후보를 우선 선택 — 예산 이하에서 최대한 근접. */
  scaleToBudget(budgetLimit: number): Quote {
    const current = this.total;
    if (current <= 0 || budgetLimit <= 0) return this;
    const ratio = budgetLimit / current;
    // 내림(floor) 편향 — 비례 조정 단계에서부터 예산 초과를 피한다
    let scaled = this.items.map((i) => new QuoteItem({ ...i, qty: Math.max(1, Math.floor(i.qty * ratio)) }));
    if (scaled.length > 0) {
      // 단위당 총액 기여(단가×(1+마진)×(1+부가세))가 가장 작은 항목으로 잔차를 흡수 → 예산에 촘촘히 근접
      const perUnit = (i: QuoteItem) => i.unitPrice * (1 + (i.marginRate || 0)) * (1 + Quote.VAT_RATE);
      let idx = 0;
      for (let i = 1; i < scaled.length; i += 1) if (perUnit(scaled[i]) < perUnit(scaled[idx])) idx = i;
      const step = perUnit(scaled[idx]);
      if (step > 0) {
        const base = new Quote({ optionType: this.optionType, items: scaled, simulatedBudget: budgetLimit });
        const delta = Math.floor((budgetLimit - base.total) / step);
        scaled = scaled.map((it, i) => (i === idx ? new QuoteItem({ ...it, qty: Math.max(1, it.qty + delta) }) : it));
        // ±3 범위 재탐색 — 예산 이하 후보 중 총액이 가장 큰(=예산에 가장 가까운) 것을 고른다.
        // 예산 이하 후보가 하나도 없으면(최소 수량 제약) 총액이 가장 작은 후보로 폴백.
        let bestUnder: Quote | null = null;
        let minOver: Quote | null = null;
        for (let d = -3; d <= 3; d += 1) {
          const items = scaled.map((it, i) => (i === idx ? new QuoteItem({ ...it, qty: Math.max(1, it.qty + d) }) : it));
          const cand = new Quote({ optionType: this.optionType, items, simulatedBudget: budgetLimit });
          if (cand.total <= budgetLimit) {
            if (!bestUnder || cand.total > bestUnder.total) bestUnder = cand;
          } else if (!minOver || cand.total < minOver.total) {
            minOver = cand;
          }
        }
        return bestUnder ?? minOver ?? base;
      }
    }
    return new Quote({ optionType: this.optionType, items: scaled, simulatedBudget: budgetLimit });
  }

  toFirestore(): DocumentData {
    return {
      optionType: this.optionType,
      items: this.items.map((i) => i.toJSON()),
      subtotal: this.subtotal,
      marginTotal: this.marginTotal,
      vat: this.vat,
      total: this.total,
      simulatedBudget: this.simulatedBudget,
      generatedDocPath: this.generatedDocPath,
      createdAt: this.createdAt,
    };
  }

  static fromFirestore(id: string, data: DocumentData): Quote {
    return new Quote({ id, ...data } as QuoteInit);
  }
}
