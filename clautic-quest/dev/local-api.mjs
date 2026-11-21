// NOMÉS PER A DESENVOLUPAMENT LOCAL.
// Emula el mínim de Supabase (GoTrue + PostgREST/RPC) sobre el PostgreSQL local,
// aplicant el mateix rol "authenticated" i les mateixes claims JWT que Lovable Cloud.
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PORT = Number(process.env.API_PORT || 54321);
const SECRET = process.env.JWT_SECRET || 'clautic-local-dev-secret';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/clautic' });

const b64u = (b) => Buffer.from(b).toString('base64url');
function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  if (!token) return null;
  const [h, b, s] = token.split('.');
  if (!s) return null;
  const sig = crypto.createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  if (sig !== s) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}

async function userJson(id) {
  const { rows } = await pool.query('select id, email, raw_user_meta_data, created_at from auth.users where id = $1', [id]);
  if (!rows[0]) return null;
  const u = rows[0];
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.raw_user_meta_data || {},
           app_metadata: { provider: 'email', providers: ['email'] }, created_at: u.created_at };
}
async function session(id) {
  const now = Math.floor(Date.now() / 1000);
  const user = await userJson(id);
  const access_token = signJwt({ sub: id, role: 'authenticated', aud: 'authenticated', email: user.email, iat: now, exp: now + 3600 });
  const refresh_token = signJwt({ sub: id, typ: 'refresh', iat: now, exp: now + 3600 * 24 * 30 });
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user };
}

const fnCache = new Map();
async function fnArgs(name) {
  if (fnCache.has(name)) return fnCache.get(name);
  const { rows } = await pool.query(
    `select coalesce(p.proargnames, '{}') as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [name]);
  if (!rows[0]) return null;
  const map = {};
  rows[0].names.forEach((n, i) => { map[n] = rows[0].types[i]; });
  fnCache.set(name, map);
  return map;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d ? JSON.parse(d) : {})); });

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const auth = verifyJwt((req.headers.authorization || '').replace(/^Bearer /i, ''));
  try {
    // ── Auth ──
    if (url.pathname === '/auth/v1/token') {
      const body = await readBody(req);
      if (url.searchParams.get('grant_type') === 'password') {
        const { rows } = await pool.query(
          'select id from auth.users where lower(email) = lower($1) and encrypted_password = crypt($2, encrypted_password)', [body.email, body.password]);
        if (!rows[0]) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
        return send(res, 200, await session(rows[0].id));
      }
      const rt = verifyJwt(body.refresh_token);
      if (!rt) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      return send(res, 200, await session(rt.sub));
    }
    if (url.pathname === '/auth/v1/signup') {
      const body = await readBody(req);
      const id = crypto.randomUUID();
      try {
        await pool.query(
          `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
           values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', lower($2), crypt($3, gen_salt('bf')), now(), '{}', $4, now(), now())`,
          [id, body.email, body.password, body.data || {}]);
      } catch (e) {
        return send(res, 400, { code: 400, msg: e.message.includes('users_email_key') ? 'User already registered' : `Database error saving new user: ${e.message}` });
      }
      return send(res, 200, await session(id));
    }
    if (url.pathname === '/auth/v1/user') {
      if (!auth) return send(res, 401, { msg: 'invalid JWT' });
      return send(res, 200, await userJson(auth.sub));
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);

    // ── RPC ──
    const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
    if (m) {
      const name = m[1];
      if (name.startsWith('_')) return send(res, 404, { message: 'not found' });
      const args = await fnArgs(name);
      if (!args) return send(res, 404, { code: 'PGRST202', message: `Could not find the function public.${name}` });
      const body = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
      const params = [];
      const parts = Object.entries(body).filter(([k]) => k in args).map(([k, v]) => {
        const t = args[k];
        params.push(t === 'jsonb' || t === 'json' ? JSON.stringify(v) : v);
        return `${k} => $${params.length}::${t}`;
      });
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(`set local role ${auth ? 'authenticated' : 'anon'}`);
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(auth || { role: 'anon' })]);
        const r = await client.query(`select public.${name}(${parts.join(', ')}) as r`, params);
        await client.query('commit');
        return send(res, 200, r.rows[0]?.r ?? null);
      } catch (e) {
        await client.query('rollback').catch(() => {});
        return send(res, e.code === '42501' ? 403 : 400, { code: e.code, message: e.message, details: e.detail || null, hint: e.hint || null });
      } finally {
        client.release();
      }
    }
    send(res, 404, { message: 'not found' });
  } catch (e) {
    console.error(e);
    send(res, 500, { message: e.message });
  }
}).listen(PORT, () => console.log(`API local de ClauTIC Quest a http://localhost:${PORT}`));
