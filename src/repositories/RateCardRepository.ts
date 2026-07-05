import { where, orderBy } from 'firebase/firestore';
import { BaseRepository } from './BaseRepository.js';
import { RateCard } from '../models/RateCard.js';

export class RateCardRepository extends BaseRepository<RateCard> {
  constructor() {
    super('rateCards', RateCard);
  }

  findActiveByCategory(category: string): Promise<RateCard[]> {
    return this.findAll(
      where('category', '==', category),
      where('isActive', '==', true),
      orderBy('itemName'),
    );
  }
}

export const rateCardRepository = new RateCardRepository();
