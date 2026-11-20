import type { AppData } from './types';

/**
 * Persistence boundary. Phase 1 ships a localStorage implementation; the
 * Supabase implementation (Phase 2) will satisfy the same contract so the UI
 * does not change. All methods are async on purpose.
 */
export interface Repository {
  readonly kind: 'local' | 'supabase';
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}
