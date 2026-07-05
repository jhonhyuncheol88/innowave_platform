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

  /** 예산 시뮬레이션 (REQ-10): 예산 한도에 맞춰 전 항목 수량/구성 비례 축소 */
  scaleToBudget(budgetLimit: number): Quote {
    if (this.total <= budgetLimit) return this;
    const ratio = budgetLimit / this.total;
    const scaled = this.items.map((i) => new QuoteItem({
      ...i,
      qty: Math.max(1, Math.floor(i.qty * ratio)),
    }));
    return new Quote({
      optionType: this.optionType,
      items: scaled,
      simulatedBudget: budgetLimit,
    });
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
