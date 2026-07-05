import { where, orderBy, limit } from 'firebase/firestore';
import { BaseRepository } from './BaseRepository.js';
import { Personnel } from '../models/Personnel.js';

export class PersonnelRepository extends BaseRepository<Personnel> {
  constructor() {
    super('personnelPool', Personnel);
  }

  findTopByRole(role: string, max = 30): Promise<Personnel[]> {
    return this.findAll(
      where('role', '==', role),
      where('isActive', '==', true),
      orderBy('rating', 'desc'),
      limit(max),
    );
  }
}

export const personnelRepository = new PersonnelRepository();
