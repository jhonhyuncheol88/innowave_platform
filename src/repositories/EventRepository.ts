import { where, orderBy } from 'firebase/firestore';
import { BaseRepository } from './BaseRepository.js';
import { Event } from '../models/Event.js';
import { ProgressStage } from '../models/ProgressStage.js';
import { Quote } from '../models/Quote.js';

export class EventRepository extends BaseRepository<Event> {
  constructor() {
    super('events', Event);
  }

  findMine(uid: string): Promise<Event[]> {
    return this.findAll(where('ownerUid', '==', uid), orderBy('updatedAt', 'desc'));
  }

  /** 발주처: 자기 조직에 배정된 프로젝트 목록 (REQ-15 권한 분리) */
  findByClientOrg(clientOrgId: string): Promise<Event[]> {
    return this.findAll(where('clientOrgId', '==', clientOrgId), orderBy('updatedAt', 'desc'));
  }

  progressRepo(eventId: string): BaseRepository<ProgressStage> {
    return new BaseRepository<ProgressStage>(`events/${eventId}/progress`, ProgressStage);
  }

  quoteRepo(eventId: string): BaseRepository<Quote> {
    return new BaseRepository<Quote>(`events/${eventId}/quotes`, Quote);
  }
}

export const eventRepository = new EventRepository();
