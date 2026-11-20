import type { Repository } from './repository';
import { EMPTY_DATA, DEFAULT_SETTINGS, type AppData } from './types';

const KEY = 'chesslab:data:v1';

export function migrate(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') return structuredClone(EMPTY_DATA);
  const d = raw as Partial<AppData>;
  return {
    version: 1,
    profile: d.profile ?? null,
    attempts: Array.isArray(d.attempts) ? d.attempts : [],
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    reviews: Array.isArray(d.reviews) ? d.reviews : [],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    diagnostics: Array.isArray(d.diagnostics) ? d.diagnostics : [],
    externalRatings: Array.isArray(d.externalRatings) ? d.externalRatings : [],
    games: Array.isArray(d.games) ? d.games : [],
    customExercises: Array.isArray(d.customExercises) ? d.customExercises : [],
    coachConversations: Array.isArray(d.coachConversations) ? d.coachConversations : [],
  };
}

export class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  private storage: Storage;
  private key: string;
  constructor(storage: Storage = window.localStorage, key = KEY) {
    this.storage = storage;
    this.key = key;
  }

  async load(): Promise<AppData> {
    try {
      const raw = this.storage.getItem(this.key);
      return migrate(raw ? JSON.parse(raw) : null);
    } catch {
      // corrupted data: keep a backup and start clean rather than crash
      try {
        const raw = this.storage.getItem(this.key);
        if (raw) this.storage.setItem(`${this.key}:corrupt:${Date.now()}`, raw);
      } catch {
        /* ignore */
      }
      return structuredClone(EMPTY_DATA);
    }
  }

  async save(data: AppData): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    this.storage.removeItem(this.key);
  }
}
