import type { ExternalRating, TimeControl } from '@/lib/storage/types';
import type { GameSource } from './types';

export interface ImportedGame {
  source: GameSource;
  externalId: string;
  pgn: string;
  /** Color of the requested user in the game. */
  userColor: 'w' | 'b' | null;
  playedAt: string;
  speed?: string;
}

export interface RatingHistoryPoint {
  timeControl: TimeControl;
  date: string; // YYYY-MM-DD
  rating: number;
}

/** A provider of a user's games and ratings (Lichess now, Chess.com later). */
export interface GameSourceClient {
  readonly id: GameSource;
  readonly label: string;
  readonly available: boolean;
  fetchRecentGames(username: string, opts?: { max?: number; signal?: AbortSignal }): Promise<ImportedGame[]>;
  fetchRatings(username: string, signal?: AbortSignal): Promise<ExternalRating[]>;
  fetchRatingHistory(username: string, signal?: AbortSignal): Promise<RatingHistoryPoint[]>;
}

export class SourceError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SourceError';
    this.status = status;
  }
}

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

export function validateUsername(u: string): string | null {
  const t = u.trim();
  if (!USERNAME_RE.test(t)) return 'Nom d\'usuari no vàlid (2–30 caràcters: lletres, números, - o _).';
  return null;
}

const LICHESS_TC: Record<string, TimeControl> = {
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'classical',
  correspondence: 'correspondence',
};

type FetchLike = typeof fetch;

export class LichessClient implements GameSourceClient {
  readonly id = 'lichess' as const;
  readonly label = 'Lichess';
  readonly available = true;
  private fetchImpl: FetchLike;
  private base: string;

  constructor(fetchImpl: FetchLike = (...a) => fetch(...a), base = 'https://lichess.org') {
    this.fetchImpl = fetchImpl;
    this.base = base;
  }

  private async get(path: string, accept: string, signal?: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.base}${path}`, { headers: { Accept: accept }, signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new SourceError('No s\'ha pogut connectar amb Lichess. Comprova la connexió.');
    }
    if (res.status === 404) throw new SourceError('Aquest usuari no existeix a Lichess o no té partides públiques.', 404);
    if (res.status === 429) throw new SourceError('Lichess limita les peticions: espera un minut i torna-ho a provar.', 429);
    if (!res.ok) throw new SourceError(`Lichess ha respost amb un error (${res.status}).`, res.status);
    return res;
  }

  async fetchRecentGames(username: string, { max = 10, signal }: { max?: number; signal?: AbortSignal } = {}): Promise<ImportedGame[]> {
    const err = validateUsername(username);
    if (err) throw new SourceError(err);
    const n = Math.max(1, Math.min(50, max));
    const res = await this.get(
      `/api/games/user/${encodeURIComponent(username.trim())}?max=${n}&pgnInJson=true&clocks=true&opening=true&moves=true&tags=true`,
      'application/x-ndjson',
      signal,
    );
    const text = await res.text();
    const lower = username.trim().toLowerCase();
    const games: ImportedGame[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let g: {
        id: string;
        pgn?: string;
        createdAt?: number;
        speed?: string;
        variant?: string;
        players?: { white?: { user?: { id?: string; name?: string } }; black?: { user?: { id?: string; name?: string } } };
      };
      try {
        g = JSON.parse(line);
      } catch {
        continue;
      }
      if (!g.pgn || (g.variant && g.variant !== 'standard')) continue;
      const white = g.players?.white?.user?.id ?? g.players?.white?.user?.name?.toLowerCase();
      const black = g.players?.black?.user?.id ?? g.players?.black?.user?.name?.toLowerCase();
      games.push({
        source: 'lichess',
        externalId: g.id,
        pgn: g.pgn,
        userColor: white === lower ? 'w' : black === lower ? 'b' : null,
        playedAt: new Date(g.createdAt ?? Date.now()).toISOString(),
        speed: g.speed,
      });
    }
    return games;
  }

  async fetchRatings(username: string, signal?: AbortSignal): Promise<ExternalRating[]> {
    const err = validateUsername(username);
    if (err) throw new SourceError(err);
    const res = await this.get(`/api/user/${encodeURIComponent(username.trim())}`, 'application/json', signal);
    const u = (await res.json()) as { perfs?: Record<string, { rating: number; games: number; prov?: boolean }>; disabled?: boolean };
    if (u.disabled) throw new SourceError('Aquest compte de Lichess està tancat.');
    const now = new Date().toISOString();
    return Object.entries(u.perfs ?? {})
      .filter(([k, p]) => LICHESS_TC[k] && p.games > 0)
      .map(([k, p]) => ({
        id: `lichess-${k}-${now}`,
        platform: 'lichess' as const,
        timeControl: LICHESS_TC[k],
        rating: p.rating,
        provisional: !!p.prov,
        source: 'api' as const,
        username: username.trim(),
        recordedAt: now,
      }));
  }

  async fetchRatingHistory(username: string, signal?: AbortSignal): Promise<RatingHistoryPoint[]> {
    const err = validateUsername(username);
    if (err) throw new SourceError(err);
    const res = await this.get(`/api/user/${encodeURIComponent(username.trim())}/rating-history`, 'application/json', signal);
    const data = (await res.json()) as { name: string; points: [number, number, number, number][] }[];
    const out: RatingHistoryPoint[] = [];
    for (const series of data) {
      const tc = LICHESS_TC[series.name.toLowerCase()];
      if (!tc) continue;
      for (const [y, m, d, r] of series.points) {
        // Lichess months are 0-based
        out.push({ timeControl: tc, date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, rating: r });
      }
    }
    return out;
  }
}

/**
 * Chess.com: prepared for a later phase. Its public API exposes monthly
 * archives (`/pub/player/{user}/games/archives`) and stats (`/pub/player/{user}/stats`).
 */
export class ChessComClient implements GameSourceClient {
  readonly id = 'chesscom' as const;
  readonly label = 'Chess.com';
  readonly available = false;
  async fetchRecentGames(): Promise<ImportedGame[]> {
    throw new SourceError('La importació des de Chess.com encara no està disponible.');
  }
  async fetchRatings(): Promise<ExternalRating[]> {
    throw new SourceError('La importació des de Chess.com encara no està disponible.');
  }
  async fetchRatingHistory(): Promise<RatingHistoryPoint[]> {
    return [];
  }
}

export const SOURCES: GameSourceClient[] = [new LichessClient(), new ChessComClient()];
