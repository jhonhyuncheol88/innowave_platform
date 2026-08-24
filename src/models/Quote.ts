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

  /** 예산 한도에 맞춰 전 항목 수량을 비례 조정하고, 대표(단가 최대) 항목 수량을 미세조정해 총액을 예산에 최대한 근접시킨다 */
  scaleToBudget(budgetLimit: number): Quote {
    const current = this.total;
    if (current <= 0 || budgetLimit <= 0) return this;
    const ratio = budgetLimit / current;
    const scaled = this.items.map((i) => new QuoteItem({ ...i, qty: Math.max(1, Math.round(i.qty * ratio)) }));
    let best = new Quote({ optionType: this.optionType, items: scaled, simulatedBudget: budgetLimit });
    if (scaled.length > 0) {
      // 단가가 가장 큰 항목을 미세조정 대상으로 삼아 ±5 범위에서 총액이 예산에 가장 가까운 수량을 찾는다
      let idx = 0;
      for (let i = 1; i < scaled.length; i += 1) if (scaled[i].unitPrice > scaled[idx].unitPrice) idx = i;
      let bestDiff = Math.abs(best.total - budgetLimit);
      for (let d = -5; d <= 5; d += 1) {
        if (d === 0) continue;
        const items = scaled.map((it, i) => (i === idx ? new QuoteItem({ ...it, qty: Math.max(1, it.qty + d) }) : it));
        const cand = new Quote({ optionType: this.optionType, items, simulatedBudget: budgetLimit });
        const diff = Math.abs(cand.total - budgetLimit);
        if (diff < bestDiff) { bestDiff = diff; best = cand; }
      }
    }
    return best;
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
