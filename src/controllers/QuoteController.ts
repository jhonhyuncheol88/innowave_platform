/**
 * QuoteController — 견적 산출 비즈니스 로직 (C of MVC)
 * View(React 컴포넌트)는 이 컨트롤러의 메서드만 호출한다.
 */
import { Quote, QuoteItem, QuoteOption, type QuoteOptionValue } from '../models/Quote.js';
import { rateCardRepository, type RateCardRepository } from '../repositories/RateCardRepository.js';
import { eventRepository, type EventRepository } from '../repositories/EventRepository.js';
import type { Event } from '../models/Event.js';

/** 옵션별 구성 배율 — quoteParams 컬렉션에서 동적 로드 가능 (REQ-17) */
const OPTION_MULTIPLIERS: Record<QuoteOptionValue, number> = {
  [QuoteOption.BASIC]: 0.8,
  [QuoteOption.STANDARD]: 1.0,
  [QuoteOption.PREMIUM]: 1.3,
};

export interface QuoteSelection {
  rateCardId: string;
  qty: number;
}

export class QuoteController {
  private rateCards: RateCardRepository;
  private events: EventRepository;

  constructor(
    rateCards: RateCardRepository = rateCardRepository,
    events: EventRepository = eventRepository,
  ) {
    this.rateCards = rateCards;
    this.events = events;
  }

  /** REQ-09: 행사 유형·규모·예산 기반 3가지 견적 옵션 생성 */
  async buildOptions(event: Event, selections: QuoteSelection[]): Promise<Quote[]> {
    const cards = await Promise.all(
      selections.map((s) => this.rateCards.findById(s.rateCardId)),
    );

    const quotes = Object.entries(OPTION_MULTIPLIERS).map(([optionType, mult]) => {
      const items = selections.map((sel, i) => {
        const card = cards[i];
        if (!card) throw new Error(`레이트카드를 찾을 수 없습니다: ${sel.rateCardId}`);
        return new QuoteItem({
          rateCardId: card.id!,
          itemName: card.itemName,
          unit: card.unit,
          qty: Math.max(1, Math.round(sel.qty * mult)),
          unitPrice: card.unitPrice,
          marginRate: card.marginRate,
        });
      });
      return new Quote({ optionType: optionType as QuoteOptionValue, items });
    });

    return quotes;
  }

  /** REQ-10: 예산 변경 시 재계산 시뮬레이션 */
  simulate(quote: Quote, newBudgetLimit: number): Quote {
    return quote.scaleToBudget(newBudgetLimit);
  }

  /** 견적 3종 저장 */
  async saveOptions(eventId: string, quotes: Quote[]): Promise<Quote[]> {
    const repo = this.events.quoteRepo(eventId);
    return Promise.all(quotes.map((q) => repo.create(q)));
  }
}

export const quoteController = new QuoteController();
