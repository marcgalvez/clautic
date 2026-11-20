import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository } from './repository';
import { migrate } from './localRepository';
import type { AppData, Attempt, DiagnosticResult, ExternalRating, ReviewItem, TrainingSession, UserProfile } from './types';
import type { StoredGame } from '@/lib/games/types';
import type { Exercise } from '@/lib/exercises/types';
import type { CoachConversation } from '@/lib/coach/types';

type Row = Record<string, unknown>;

interface TableSpec<T> {
  table: string;
  /** Primary key columns (besides user_id when it is part of the key). */
  key: string[];
  toRow: (item: T, userId: string) => Row;
  fromRow: (row: Row) => T;
  items: (d: AppData) => T[];
  id: (item: T) => string;
}

/* ---------- row mappers (camelCase app model <-> snake_case tables) ---------- */

const attempts: TableSpec<Attempt> = {
  table: 'attempts',
  key: ['id'],
  items: (d) => d.attempts,
  id: (a) => a.id,
  toRow: (a, user_id) => ({
    id: a.id, user_id, exercise_id: a.exerciseId, session_id: a.sessionId ?? null, theme: a.theme, concepts: a.concepts,
    difficulty: a.difficulty, context: a.context, outcome: a.outcome, wrong_moves: a.wrongMoves, hints_used: a.hintsUsed,
    first_try: a.firstTry, duration_ms: Math.round(a.durationMs), quality: a.quality, reasoning: a.reasoning ?? null, started_at: a.startedAt,
  }),
  fromRow: (r) => ({
    id: r.id as string, exerciseId: r.exercise_id as string, sessionId: (r.session_id as string) ?? undefined, theme: r.theme as string,
    concepts: (r.concepts as string[]) ?? [], difficulty: r.difficulty as number, context: r.context as Attempt['context'],
    outcome: r.outcome as Attempt['outcome'], wrongMoves: r.wrong_moves as number, hintsUsed: r.hints_used as number,
    firstTry: r.first_try as boolean, durationMs: r.duration_ms as number, quality: r.quality as number,
    reasoning: (r.reasoning as string) ?? undefined, startedAt: r.started_at as string,
  }),
};

const sessions: TableSpec<TrainingSession> = {
  table: 'training_sessions',
  key: ['id'],
  items: (d) => d.sessions,
  id: (s) => s.id,
  toRow: (s, user_id) => ({
    id: s.id, user_id, lesson_id: s.lessonId, planned_minutes: s.plannedMinutes, exercise_ids: s.exerciseIds, attempt_ids: s.attemptIds,
    recall: s.recall, reflection: s.reflection ?? null, started_at: s.startedAt, completed_at: s.completedAt ?? null,
  }),
  fromRow: (r) => ({
    id: r.id as string, lessonId: r.lesson_id as string, plannedMinutes: r.planned_minutes as TrainingSession['plannedMinutes'],
    exerciseIds: (r.exercise_ids as string[]) ?? [], attemptIds: (r.attempt_ids as string[]) ?? [], recall: (r.recall as TrainingSession['recall']) ?? [],
    reflection: (r.reflection as TrainingSession['reflection']) ?? undefined, startedAt: r.started_at as string, completedAt: (r.completed_at as string) ?? undefined,
  }),
};

const reviews: TableSpec<ReviewItem> = {
  table: 'review_items',
  key: ['user_id', 'concept_id'],
  items: (d) => d.reviews,
  id: (r) => r.conceptId,
  toRow: (r, user_id) => ({
    user_id, concept_id: r.conceptId, stage: r.stage, interval_days: r.intervalDays, due_at: r.dueAt,
    last_reviewed_at: r.lastReviewedAt, last_quality: r.lastQuality, reviews: r.reviews,
  }),
  fromRow: (r) => ({
    conceptId: r.concept_id as string, stage: r.stage as number, intervalDays: r.interval_days as number, dueAt: r.due_at as string,
    lastReviewedAt: r.last_reviewed_at as string, lastQuality: r.last_quality as number, reviews: r.reviews as number,
  }),
};

const ratings: TableSpec<ExternalRating> = {
  table: 'external_ratings',
  key: ['id'],
  items: (d) => d.externalRatings,
  id: (r) => r.id,
  toRow: (r, user_id) => ({
    id: r.id, user_id, platform: r.platform, time_control: r.timeControl, rating: r.rating, provisional: r.provisional ?? null,
    source: r.source, username: r.username ?? null, recorded_at: r.recordedAt,
  }),
  fromRow: (r) => ({
    id: r.id as string, platform: r.platform as ExternalRating['platform'], timeControl: r.time_control as ExternalRating['timeControl'],
    rating: r.rating as number, provisional: (r.provisional as boolean) ?? undefined, source: r.source as ExternalRating['source'],
    username: (r.username as string) ?? undefined, recordedAt: r.recorded_at as string,
  }),
};

const diagnostics: TableSpec<DiagnosticResult> = {
  table: 'diagnostics',
  key: ['id'],
  items: (d) => d.diagnostics,
  id: (x) => x.id,
  toRow: (x, user_id) => ({ id: x.id, user_id, completed_at: x.completedAt, data: x }),
  fromRow: (r) => r.data as DiagnosticResult,
};

const games: TableSpec<StoredGame> = {
  table: 'games',
  key: ['id'],
  items: (d) => d.games,
  id: (g) => g.id,
  toRow: (g, user_id) => ({
    id: g.id, user_id, source: g.source, external_id: g.externalId ?? null, pgn: g.pgn, headers: g.headers, user_color: g.userColor,
    played_at: g.playedAt ?? null, imported_at: g.importedAt, analysis: g.analysis ?? null, exercise_ids: g.exerciseIds ?? [],
  }),
  fromRow: (r) => ({
    id: r.id as string, source: r.source as StoredGame['source'], externalId: (r.external_id as string) ?? undefined, pgn: r.pgn as string,
    headers: (r.headers as Record<string, string>) ?? {}, userColor: (r.user_color as StoredGame['userColor']) ?? null,
    playedAt: (r.played_at as string) ?? undefined, importedAt: r.imported_at as string,
    analysis: (r.analysis as StoredGame['analysis']) ?? undefined, exerciseIds: (r.exercise_ids as string[]) ?? [],
  }),
};

const userExercises: TableSpec<Exercise> = {
  table: 'user_exercises',
  key: ['id'],
  items: (d) => d.customExercises,
  id: (e) => e.id,
  toRow: (e, user_id) => ({ id: e.id, user_id, data: e }),
  fromRow: (r) => r.data as Exercise,
};

const conversations: TableSpec<CoachConversation> = {
  table: 'coach_conversations',
  key: ['id'],
  items: (d) => d.coachConversations,
  id: (c) => c.id,
  toRow: (c, user_id) => ({ id: c.id, user_id, context: c.context, messages: c.messages, created_at: c.createdAt }),
  fromRow: (r) => ({ id: r.id as string, context: r.context as CoachConversation['context'], messages: (r.messages as CoachConversation['messages']) ?? [], createdAt: r.created_at as string }),
};

// Order matters only for readability; there are no cross-table foreign keys.
const SPECS = [attempts, sessions, reviews, ratings, diagnostics, games, userExercises, conversations] as TableSpec<unknown>[];

function profileRow(p: UserProfile, settings: AppData['settings'], user_id: string): Row {
  return {
    user_id, display_name: p.displayName, locale: p.locale, session_minutes: p.sessionMinutes,
    lichess_username: p.lichessUsername ?? null, chesscom_username: p.chesscomUsername ?? null, settings,
    updated_at: new Date().toISOString(),
  };
}

export class SupabaseSyncError extends Error {
  constructor(table: string, message: string) {
    super(`No s'ha pogut sincronitzar (${table}): ${message}`);
    this.name = 'SupabaseSyncError';
  }
}

/**
 * Syncs AppData with normalized Supabase tables. Only rows that changed since
 * the last successful sync are written; removed rows are deleted. Saves are
 * coalesced (debounced) because the UI saves on every state change.
 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;
  private client: SupabaseClient;
  private userId: string;
  private fallback?: () => Promise<AppData>;
  private debounceMs: number;
  /** table -> (row id -> serialized row) of what the server has. */
  private synced = new Map<string, Map<string, string>>();
  private syncedProfile: string | null = null;
  private pending: AppData | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private waiters: { resolve: () => void; reject: (e: Error) => void }[] = [];
  private flushing: Promise<void> = Promise.resolve();

  constructor(client: SupabaseClient, userId: string, opts: { fallback?: () => Promise<AppData>; debounceMs?: number } = {}) {
    this.client = client;
    this.userId = userId;
    this.fallback = opts.fallback;
    this.debounceMs = opts.debounceMs ?? 800;
  }

  async load(): Promise<AppData> {
    const { data: prof, error } = await this.client.from('profiles').select('*').eq('user_id', this.userId).maybeSingle();
    if (error) throw new SupabaseSyncError('profiles', error.message);
    if (!prof) {
      // First login on this account: start from local data (if any); the first save uploads it.
      return this.fallback ? this.fallback() : migrate(null);
    }
    const out = migrate({
      profile: {
        id: this.userId,
        displayName: prof.display_name,
        createdAt: prof.created_at,
        sessionMinutes: prof.session_minutes,
        locale: prof.locale,
        lichessUsername: prof.lichess_username ?? undefined,
        chesscomUsername: prof.chesscom_username ?? undefined,
      },
      settings: prof.settings ?? {},
    }) as AppData & Record<string, unknown>;
    this.syncedProfile = JSON.stringify(profileRow(out.profile!, out.settings, this.userId), (k, v) => (k === 'updated_at' ? undefined : v));
    for (const spec of SPECS) {
      const { data: rows, error: e } = await this.client.from(spec.table).select('*').eq('user_id', this.userId);
      if (e) throw new SupabaseSyncError(spec.table, e.message);
      const items = (rows ?? []).map(spec.fromRow);
      const map = new Map<string, string>();
      for (const it of items) map.set(spec.id(it), JSON.stringify(spec.toRow(it, this.userId)));
      this.synced.set(spec.table, map);
      assign(out, spec, items);
    }
    return out;
  }

  save(data: AppData): Promise<void> {
    this.pending = data;
    if (this.timer) clearTimeout(this.timer);
    const p = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    this.timer = setTimeout(() => {
      this.timer = null;
      const waiters = this.waiters.splice(0);
      const snapshot = this.pending!;
      this.flushing = this.flushing
        .then(() => this.flush(snapshot))
        .then(() => waiters.forEach((w) => w.resolve()))
        .catch((e: Error) => waiters.forEach((w) => w.reject(e)));
    }, this.debounceMs);
    return p;
  }

  /** Writes the differences between `data` and what the server has. */
  async flush(data: AppData): Promise<void> {
    if (!data.profile) return;
    const prof = profileRow(data.profile, data.settings, this.userId);
    const profKey = JSON.stringify(prof, (k, v) => (k === 'updated_at' ? undefined : v));
    if (profKey !== this.syncedProfile) {
      const { error } = await this.client.from('profiles').upsert(prof, { onConflict: 'user_id' });
      if (error) throw new SupabaseSyncError('profiles', error.message);
      this.syncedProfile = profKey;
    }
    for (const spec of SPECS) {
      const prev = this.synced.get(spec.table) ?? new Map<string, string>();
      const next = new Map<string, string>();
      const changed: Row[] = [];
      for (const item of spec.items(data)) {
        const row = spec.toRow(item, this.userId);
        const ser = JSON.stringify(row);
        next.set(spec.id(item), ser);
        if (prev.get(spec.id(item)) !== ser) changed.push(row);
      }
      for (let i = 0; i < changed.length; i += 200) {
        const { error } = await this.client.from(spec.table).upsert(changed.slice(i, i + 200), { onConflict: spec.key.join(',') });
        if (error) throw new SupabaseSyncError(spec.table, error.message);
      }
      const removed = [...prev.keys()].filter((id) => !next.has(id));
      if (removed.length) {
        const idCol = spec.key.includes('concept_id') ? 'concept_id' : 'id';
        const { error } = await this.client.from(spec.table).delete().eq('user_id', this.userId).in(idCol, removed);
        if (error) throw new SupabaseSyncError(spec.table, error.message);
      }
      this.synced.set(spec.table, next);
    }
  }

  async clear(): Promise<void> {
    for (const spec of SPECS) {
      const { error } = await this.client.from(spec.table).delete().eq('user_id', this.userId);
      if (error) throw new SupabaseSyncError(spec.table, error.message);
      this.synced.set(spec.table, new Map());
    }
  }
}

function assign(out: AppData, spec: TableSpec<unknown>, items: unknown[]) {
  const field: Record<string, keyof AppData> = {
    attempts: 'attempts', training_sessions: 'sessions', review_items: 'reviews', external_ratings: 'externalRatings',
    diagnostics: 'diagnostics', games: 'games', user_exercises: 'customExercises', coach_conversations: 'coachConversations',
  };
  (out as unknown as Record<string, unknown>)[field[spec.table]] = items;
}
