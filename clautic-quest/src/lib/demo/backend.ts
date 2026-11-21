// MODE DEMOSTRACIÓ: tota la base de dades (mateixes migracions, RLS i funcions) s'executa
// dins del navegador amb PostgreSQL en WebAssembly (PGlite). Les dades es guarden a IndexedDB.
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import authStub from '../../../dev/auth_stub.sql?raw';
import demoData from '../../../dev/demo_data.sql?raw';

const migrations = import.meta.glob('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const DEMO_DB = 'clautic-quest-demo';
const VERSION = '2';

let dbPromise: Promise<PGlite> | null = null;
const listeners = new Set<(s: string) => void>();
export const onDemoStatus = (cb: (s: string) => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const status = (s: string) => listeners.forEach((l) => l(s));

async function open(): Promise<PGlite> {
  status('Carregant el motor de base de dades…');
  const db = await PGlite.create(`idb://${DEMO_DB}`, { extensions: { pgcrypto } });
  const ready = await db.query<{ v: string | null }>(`select (select value #>> '{}' from public.settings where key = 'demo_version') as v`).catch(() => null);
  if (!ready || ready.rows[0]?.v !== VERSION) {
    status('Construint ClauTIC City (només el primer cop)…');
    await db.exec(authStub);
    for (const k of Object.keys(migrations).sort()) await db.exec(migrations[k]);
    await db.exec(demoData);
    await db.exec(`insert into public.settings (key, value) values ('demo_version', '"${VERSION}"') on conflict (key) do update set value = excluded.value`);
  }
  status('');
  return db;
}
export const getDb = () => (dbPromise ??= open());

const argCache = new Map<string, Record<string, string>>();
async function fnArgs(db: PGlite, name: string) {
  if (argCache.has(name)) return argCache.get(name)!;
  const r = await db.query<{ names: string[] | null; types: string[] }>(
    `select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [name]);
  if (!r.rows[0]) return null;
  const map: Record<string, string> = {};
  (r.rows[0].names ?? []).forEach((n, i) => { map[n] = r.rows[0].types[i]; });
  argCache.set(name, map);
  return map;
}

/** Crida una funció RPC amb el rol i les claims de l'usuari, com faria PostgREST. */
export async function demoRpc(fn: string, args: Record<string, unknown>, userId: string | null) {
  const db = await getDb();
  if (fn.startsWith('_')) throw new Error('Funció no disponible');
  const types = await fnArgs(db, fn);
  if (!types) throw new Error(`Funció desconeguda: ${fn}`);
  const params: unknown[] = [];
  const parts = Object.entries(args).filter(([k]) => k in types).map(([k, v]) => {
    const t = types[k];
    params.push(v === null || v === undefined ? null : t === 'jsonb' || t === 'json' ? JSON.stringify(v) : Array.isArray(v) ? `{${v.join(',')}}` : v);
    return `${k} => $${params.length}::${t}`;
  });
  return db.transaction(async (tx: Transaction) => {
    await tx.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(userId ? { sub: userId, role: 'authenticated' } : { role: 'anon' })]);
    const r = await tx.query<{ r: unknown }>(`select public.${fn}(${parts.join(', ')}) as r`, params);
    return r.rows[0]?.r ?? null;
  });
}

export async function demoLogin(email: string, password: string) {
  const db = await getDb();
  const r = await db.query<{ id: string; email: string; meta: Record<string, unknown> }>(
    `select id, email, raw_user_meta_data as meta from auth.users where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)`, [email, password]);
  return r.rows[0] ?? null;
}

export async function demoSignUp(email: string, password: string, data: Record<string, unknown>) {
  const db = await getDb();
  const id = crypto.randomUUID();
  try {
    await db.query(
      `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', lower($2), crypt($3, gen_salt('bf')), now(), '{}', $4, now(), now())`,
      [id, email, password, JSON.stringify(data)]);
  } catch (e) {
    const m = (e as Error).message;
    throw new Error(m.includes('users_email_key') ? 'User already registered' : m);
  }
  return { id, email: email.toLowerCase(), meta: data };
}

/** Torna la demo a l'estat inicial (només en aquest navegador). */
export async function resetDemo() {
  try { localStorage.setItem('clautic-quest-demo-session', 'null'); } catch { /* */ }
  try { const db = await dbPromise; await db?.close(); } catch { /* */ }
  await new Promise<void>((ok) => {
    const req = indexedDB.deleteDatabase(`/pglite/${DEMO_DB}`);
    req.onsuccess = req.onerror = req.onblocked = () => ok();
  });
  location.reload();
}
