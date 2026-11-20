// Supabase Edge Function: POST /functions/v1/coach
// Secrets (supabase secrets set ...): ANTHROPIC_API_KEY, optional COACH_MODEL, COACH_DAILY_LIMIT, ALLOWED_ORIGIN.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
import Anthropic from 'npm:@anthropic-ai/sdk@1.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateRequest } from '../_shared/coach-core.ts';
import { runCoach } from '../_shared/coach-claude.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5';
const DAILY_LIMIT = Number(Deno.env.get('COACH_DAILY_LIMIT') ?? '60');
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method === 'GET') return json({ ok: !!Deno.env.get('ANTHROPIC_API_KEY'), model: MODEL });
  if (req.method !== 'POST') return json({ error: 'Mètode no permès' }, 405);

  // Authenticate the user with their own JWT.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json({ error: 'Cal iniciar sessió' }, 401);

  // Per-user daily limit (cost control).
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from('coach_usage').select('id', { count: 'exact', head: true }).eq('user_id', auth.user.id).gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Has arribat al límit diari de ${DAILY_LIMIT} consultes a l'entrenador.` }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON invàlid' }, 400);
  }
  let request;
  try {
    request = validateRequest(body);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }

  try {
    const result = await runCoach(anthropic, request, { model: MODEL });
    await admin.from('coach_usage').insert({ user_id: auth.user.id, input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens });
    return json({ text: result.text, flagged: result.flagged, model: result.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'L\'entrenador està saturat. Torna-ho a provar en uns segons.' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'L\'entrenador no està ben configurat (clau d\'API).' }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `Error de l'API de Claude (${e.status}).` }, 502);
    return json({ error: 'Error inesperat de l\'entrenador.' }, 500);
  }
});
