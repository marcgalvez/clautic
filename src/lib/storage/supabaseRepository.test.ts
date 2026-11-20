import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from './supabaseRepository';
import { EMPTY_DATA, type AppData, type Attempt } from './types';

/** Minimal in-memory fake of the supabase-js query builder used by the repository. */
function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: string[] = [];
  const keyOf = (_table: string, row: Record<string, unknown>, onConflict: string) => onConflict.split(',').map((k) => row[k]).join('|');
  const from = (table: string) => {
    tables[table] ??= [];
    const filters: [string, string, unknown][] = [];
    const match = (r: Record<string, unknown>) =>
      filters.every(([op, col, v]) => (op === 'eq' ? r[col] === v : (v as unknown[]).includes(r[col])));
    const builder = {
      select: () => builder,
      eq: (col: string, v: unknown) => (filters.push(['eq', col, v]), builder),
      in: (col: string, v: unknown[]) => (filters.push(['in', col, v]), builder),
      maybeSingle: async () => ({ data: tables[table].find(match) ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: tables[table].filter(match), error: null }),
      upsert: async (rows: Record<string, unknown> | Record<string, unknown>[], { onConflict }: { onConflict: string }) => {
        const list = Array.isArray(rows) ? rows : [rows];
        calls.push(`upsert ${table} ${list.length}`);
        for (const r of list) {
          const i = tables[table].findIndex((x) => keyOf(table, x, onConflict) === keyOf(table, r, onConflict));
          if (i >= 0) tables[table][i] = r;
          else tables[table].push(r);
        }
        return { error: null };
      },
      delete: () => {
        const del = {
          eq: (col: string, v: unknown) => (filters.push(['eq', col, v]), del),
          in: (col: string, v: unknown[]) => {
            filters.push(['in', col, v]);
            calls.push(`delete ${table}`);
            tables[table] = tables[table].filter((r) => !match(r));
            return Promise.resolve({ error: null });
          },
          then: (resolve: (v: unknown) => void) => {
            calls.push(`delete ${table}`);
            tables[table] = tables[table].filter((r) => !match(r));
            resolve({ error: null });
          },
        };
        return del;
      },
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, tables, calls };
}

const attempt = (id: string): Attempt => ({
  id, exerciseId: 'tac-fork-001', theme: 'fork', concepts: ['forquilla-cavall'], difficulty: 1, startedAt: '2026-01-01T00:00:00Z',
  durationMs: 1000, outcome: 'solved', wrongMoves: 0, hintsUsed: 0, firstTry: true, quality: 1, context: 'free',
});

const data = (attempts: Attempt[]): AppData => ({
  ...structuredClone(EMPTY_DATA),
  profile: { id: 'u1', displayName: 'Marta', createdAt: '2026-01-01T00:00:00Z', sessionMinutes: 15, locale: 'ca' },
  attempts,
});

describe('SupabaseRepository', () => {
  it('uploads local data on first login and then only writes differences', async () => {
    const { client, tables, calls } = fakeClient();
    const repo = new SupabaseRepository(client, 'u1', { fallback: async () => data([attempt('a1')]), debounceMs: 0 });
    const loaded = await repo.load();
    expect(loaded.attempts).toHaveLength(1); // came from the local fallback
    await repo.flush(loaded);
    expect(tables.profiles[0]).toMatchObject({ user_id: 'u1', display_name: 'Marta' });
    expect(tables.attempts).toHaveLength(1);
    calls.length = 0;
    await repo.flush(data([attempt('a1'), attempt('a2')]));
    expect(calls).toEqual(['upsert attempts 1']); // profile unchanged, only the new attempt
  });

  it('deletes rows removed locally and reloads normalized rows back into the app model', async () => {
    const { client, tables } = fakeClient();
    const repo = new SupabaseRepository(client, 'u1', { debounceMs: 0 });
    await repo.load();
    const d = data([attempt('a1'), attempt('a2')]);
    d.externalRatings = [{ id: 'r1', platform: 'lichess', timeControl: 'blitz', rating: 1500, source: 'api', recordedAt: '2026-01-01T00:00:00Z' }];
    await repo.flush(d);
    await repo.flush({ ...d, externalRatings: [] });
    expect(tables.external_ratings).toHaveLength(0);
    const again = await new SupabaseRepository(client, 'u1').load();
    expect(again.profile?.displayName).toBe('Marta');
    expect(again.attempts.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
    expect(again.attempts[0]).toEqual(attempt(again.attempts[0].id));
  });

  it('coalesces rapid saves into one flush', async () => {
    const { client, calls } = fakeClient();
    const repo = new SupabaseRepository(client, 'u1', { debounceMs: 10 });
    await repo.load();
    await Promise.all([repo.save(data([attempt('a1')])), repo.save(data([attempt('a1'), attempt('a2')]))]);
    expect(calls.filter((c) => c.startsWith('upsert attempts'))).toEqual(['upsert attempts 2']);
  });
});
