// Local coach server for development: `npm run coach` (reads ANTHROPIC_API_KEY from .env).
// Vite proxies /api/coach to it. Not for production: no authentication.
import { createServer } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { validateRequest } from '../supabase/functions/_shared/coach-core.ts';
import { runCoach } from '../supabase/functions/_shared/coach-claude.ts';

const PORT = Number(process.env.COACH_PORT ?? 8787);
const MODEL = process.env.COACH_MODEL ?? 'claude-opus-5-5';
const LIMIT_PER_HOUR = Number(process.env.COACH_HOURLY_LIMIT ?? 60);
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const anthropic = new Anthropic();
const recent: number[] = [];

const send = (res: import('node:http').ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  if (req.url !== '/api/coach') return send(res, 404, { error: 'Not found' });
  if (req.method === 'GET') return send(res, 200, { ok: hasKey, model: MODEL });
  if (req.method !== 'POST') return send(res, 405, { error: 'Mètode no permès' });
  const now = Date.now();
  while (recent.length && recent[0] < now - 3600_000) recent.shift();
  if (recent.length >= LIMIT_PER_HOUR) return send(res, 429, { error: `Límit local de ${LIMIT_PER_HOUR} consultes per hora.` });

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) return send(res, 413, { error: 'Petició massa gran' });
  }
  let request;
  try {
    request = validateRequest(JSON.parse(raw));
  } catch (e) {
    return send(res, 400, { error: (e as Error).message });
  }
  try {
    recent.push(now);
    const result = await runCoach(anthropic, request, { model: MODEL });
    console.log(`[coach] ${request.mode} · ${result.usage.input_tokens} in / ${result.usage.output_tokens} out${result.flagged.length ? ` · flagged: ${result.flagged.join(' ')}` : ''}`);
    send(res, 200, { text: result.text, flagged: result.flagged, model: result.model });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return send(res, 503, { error: 'Clau d\'API de Claude invàlida o absent (ANTHROPIC_API_KEY).' });
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'L\'API de Claude limita les peticions: torna-ho a provar en uns segons.' });
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: `Error de l'API de Claude (${e.status}).` });
    console.error(e);
    send(res, 500, { error: 'Error inesperat' });
  }
}).listen(PORT, () => console.log(`[coach] http://localhost:${PORT}/api/coach · model ${MODEL} · ${hasKey ? 'clau configurada' : 'SENSE clau (ANTHROPIC_API_KEY)'}`));
