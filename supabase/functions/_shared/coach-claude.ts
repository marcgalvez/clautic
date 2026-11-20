/**
 * Calls Claude for the coach. The Anthropic client is injected so the same
 * code runs in Deno (Edge Function, npm: import) and Node (local dev server).
 */
import { buildUserMessage, groundResponse, SYSTEM_PROMPT, type CoachRequest, type CoachResponse } from './coach-core.ts';

/** Structural subset of the Anthropic SDK client used here. */
export interface AnthropicLike {
  beta: {
    messages: {
      // deno-lint-ignore no-explicit-any
      create(params: any): Promise<any>;
    };
  };
}

export interface CoachConfig {
  /** Defaults to Claude Opus 5.5. */
  model?: string;
  effort?: 'low' | 'medium' | 'high';
}

export interface CoachResult extends CoachResponse {
  usage: { input_tokens: number; output_tokens: number };
  refused: boolean;
}

export async function runCoach(client: AnthropicLike, req: CoachRequest, config: CoachConfig = {}): Promise<CoachResult> {
  // The conversation must start with a user turn.
  const history = [...(req.history ?? [])];
  while (history.length && history[0].role !== 'user') history.shift();

  const message = await client.beta.messages.create({
    model: config.model ?? 'claude-opus-5-5',
    max_tokens: 4000,
    // Server-side fallback: if a safety classifier declines, another model continues the same request.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: config.effort ?? 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [...history, { role: 'user', content: buildUserMessage(req) }],
  });

  const usage = {
    input_tokens: message.usage?.input_tokens ?? 0,
    output_tokens: message.usage?.output_tokens ?? 0,
  };
  if (message.stop_reason === 'refusal') {
    return { text: 'Ara mateix no puc respondre aquesta pregunta. Prova de reformular-la o fes servir les pistes de l\'exercici.', flagged: [], usage, refused: true, model: message.model };
  }
  const text = (message.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
  return { ...groundResponse(text, req), usage, refused: false, model: message.model };
}
