import { beforeEach, describe, expect, it } from 'vitest';
import { LocalRepository, migrate } from './localRepository';
import { EMPTY_DATA } from './types';

describe('LocalRepository', () => {
  beforeEach(() => localStorage.clear());
  it('returns empty data on first load', async () => {
    expect(await new LocalRepository().load()).toEqual(EMPTY_DATA);
  });
  it('round-trips data', async () => {
    const repo = new LocalRepository();
    const data = { ...EMPTY_DATA, profile: { id: 'u', displayName: 'Test', createdAt: '', sessionMinutes: 15 as const, locale: 'ca' as const } };
    await repo.save(data);
    expect((await repo.load()).profile?.displayName).toBe('Test');
  });
  it('survives corrupted storage, keeping a backup', async () => {
    localStorage.setItem('chesslab:data:v1', '{not json');
    expect(await new LocalRepository().load()).toEqual(EMPTY_DATA);
    expect(Object.keys(localStorage).some((k) => k.includes('corrupt'))).toBe(true);
  });
  it('fills in missing fields when migrating', () => {
    expect(migrate({ attempts: 'x', settings: { engineDepth: 12 } }).settings.engineDepth).toBe(12);
    expect(migrate({ attempts: 'x' }).attempts).toEqual([]);
  });
});
