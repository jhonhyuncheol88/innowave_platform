import type { DocumentData, FieldValue, Timestamp } from 'firebase/firestore';
import { BaseModel } from './BaseModel.js';

export interface RateCardInit {
  id?: string | null;
  category: string;
  subcategory?: string;
  itemName: string;
  spec?: string;
  unit: string;
  unitPrice: number;
  marginRate: number;
  regionVariable?: boolean;
  supplierType?: string;
  isActive?: boolean;
  createdAt?: Timestamp | FieldValue | null;
  updatedAt?: Timestamp | FieldValue | null;
}

export class RateCard extends BaseModel {
  category: string;
  subcategory: string;
  itemName: string;
  spec: string;
  unit: string;
  unitPrice: number;
  marginRate: number;
  regionVariable: boolean;
  supplierType: string;
  isActive: boolean;
  createdAt: Timestamp | FieldValue | null;
  updatedAt: Timestamp | FieldValue | null;

  constructor({
    id = null,
    category,
    subcategory = '',
    itemName,
    spec = '',
    unit,
    unitPrice,
    marginRate,
    regionVariable = false,
    supplierType = '자체',
    isActive = true,
    createdAt = null,
    updatedAt = null,
  }: RateCardInit) {
    super(id);
    this.category = category;
    this.subcategory = subcategory;
    this.itemName = itemName;
    this.spec = spec;
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.marginRate = marginRate;
    this.regionVariable = regionVariable;
    this.supplierType = supplierType;
    this.isActive = isActive;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** 마진 포함 판매 단가 */
  get sellingPrice(): number {
    return Math.round(this.unitPrice * (1 + this.marginRate / 100));
  }

  /** 수량 적용 금액 (마진 포함, VAT 별도) */
  amountFor(qty: number): number {
    return this.sellingPrice * qty;
  }

  toFirestore(): DocumentData {
    const { id: _id, ...rest } = this;
    return rest;
  }

  static fromFirestore(id: string, data: DocumentData): RateCard {
    return new RateCard({ id, ...data } as RateCardInit);
  }
}
