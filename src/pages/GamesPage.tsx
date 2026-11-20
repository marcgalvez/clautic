import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileUp, Loader2, Play, Square, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { useData } from '@/state/DataProvider';
import { LichessClient, SourceError, SOURCES } from '@/lib/games/sources';
import { parsePgn } from '@/lib/chess/pgn';
import { treeToPgn } from '@/lib/chess/pgn';
import { analyseGame } from '@/lib/games/analyze';
import { exercisesFromGame } from '@/lib/games/generate';
import { summarizePatterns, gameWeakConcepts, ERROR_TYPE_LABELS } from '@/lib/games/patterns';
import { browserAnalyse, browserMulti } from '@/lib/games/browserEngine';
import { conceptLabel } from '@/data/concepts';
import type { StoredGame } from '@/lib/games/types';
import { uid } from '@/lib/utils';

const lichess = new LichessClient();

function opponentOf(g: StoredGame) {
  return g.userColor === 'b' ? g.headers.White : g.userColor === 'w' ? g.headers.Black : `${g.headers.White ?? '?'} – ${g.headers.Black ?? '?'}`;
}

function outcomeFor(g: StoredGame): { label: string; variant: 'success' | 'danger' | 'outline' } {
  const r = g.headers.Result;
  if (!g.userColor || !r || r === '*') return { label: r ?? '*', variant: 'outline' };
  if (r === '1/2-1/2') return { label: 'Taules', variant: 'outline' };
  const won = (r === '1-0') === (g.userColor === 'w');
  return won ? { label: 'Victòria', variant: 'success' } : { label: 'Derrota', variant: 'danger' };
}

export function GamesPage() {
  const { data, upsertGame, removeGame, addCustomExercises, setProfile } = useData();
  const profile = data.profile!;
  const [username, setUsername] = useState(profile.lichessUsername ?? '');
  const [count, setCount] = useState(10);
  const [pgn, setPgn] = useState('');
  const [pgnColor, setPgnColor] = useState<'auto' | 'w' | 'b'>('auto');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [depth, setDepth] = useState(12);
  const [running, setRunning] = useState<{ id: string; done: number; total: number; stage: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const games = useMemo(() => [...data.games].sort((a, b) => (b.playedAt ?? b.importedAt).localeCompare(a.playedAt ?? a.importedAt)), [data.games]);
  const patterns = useMemo(() => summarizePatterns(data.games), [data.games]);
  const weak = useMemo(() => gameWeakConcepts(data.games), [data.games]);

  const importLichess = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const list = await lichess.fetchRecentGames(username, { max: count });
      const existing = new Set(data.games.filter((g) => g.source === 'lichess').map((g) => g.externalId));
      let added = 0;
      for (const g of list) {
        if (existing.has(g.externalId)) continue;
        const parsed = parsePgn(g.pgn).games[0];
        if (!parsed) continue;
        upsertGame({ id: uid('game'), source: 'lichess', externalId: g.externalId, pgn: g.pgn, headers: parsed.headers, userColor: g.userColor, playedAt: g.playedAt, importedAt: new Date().toISOString() });
        added++;
      }
      setProfile({ ...profile, lichessUsername: username.trim() });
      setMsg({ tone: 'ok', text: list.length ? `${added} partides noves importades (${list.length - added} ja hi eren).` : 'No s\'han trobat partides públiques d\'escacs clàssics.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof SourceError ? e.message : 'No s\'ha pogut importar.' });
    } finally {
      setBusy(false);
    }
  };

  const detectColor = (headers: Record<string, string>): 'w' | 'b' | null => {
    const names = [profile.displayName, profile.lichessUsername, profile.chesscomUsername].filter(Boolean).map((n) => n!.toLowerCase());
    if (names.includes((headers.White ?? '').toLowerCase())) return 'w';
    if (names.includes((headers.Black ?? '').toLowerCase())) return 'b';
    return null;
  };

  const importPgn = (text: string) => {
    const { games: parsed, errors } = parsePgn(text);
    for (const g of parsed) {
      const userColor = pgnColor === 'auto' ? detectColor(g.headers) : pgnColor;
      upsertGame({ id: uid('game'), source: 'pgn', pgn: treeToPgn(g.tree, g.result ?? '*'), headers: g.headers, userColor, playedAt: undefined, importedAt: new Date().toISOString() });
    }
    setMsg({
      tone: errors.length && !parsed.length ? 'bad' : 'ok',
      text: `${parsed.length} ${parsed.length === 1 ? 'partida importada' : 'partides importades'}.` + (errors.length ? ` ${errors.length} amb errors: ${errors.map((e) => `#${e.gameIndex} ${e.message}`).join('; ')}` : ''),
    });
    if (parsed.length) setPgn('');
  };

  const analyse = async (g: StoredGame) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning({ id: g.id, done: 0, total: 1, stage: 'Analitzant jugades' });
    try {
      const res = await analyseGame(g.pgn, g.userColor, browserAnalyse, {
        depth,
        signal: ac.signal,
        onProgress: (done, total) => setRunning({ id: g.id, done, total, stage: 'Analitzant jugades' }),
      });
      const analysed: StoredGame = { ...g, analysis: { depth: res.depth, analysedAt: new Date().toISOString(), moves: res.moves, report: res.report } };
      setRunning({ id: g.id, done: 1, total: 1, stage: 'Creant exercicis a partir dels errors' });
      const exercises = await exercisesFromGame(analysed, browserMulti, 4);
      addCustomExercises(exercises);
      upsertGame({ ...analysed, exerciseIds: exercises.map((e) => e.id) });
      setMsg({ tone: 'ok', text: `Partida analitzada. ${exercises.length} exercici${exercises.length === 1 ? '' : 's'} nou${exercises.length === 1 ? '' : 's'} amb solució única verificada.` });
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && (e as Error).name !== 'CancelledError') setMsg({ tone: 'bad', text: `No s'ha pogut analitzar: ${(e as Error).message}` });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Partides</h1>
        <p className="text-sm text-muted-foreground">Importa les teves partides i descobreix per què les perds i què has d'entrenar.</p>
      </div>

      {patterns.gamesAnalysed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Patrons en {patterns.gamesAnalysed === 1 ? "1 partida analitzada" : `${patterns.gamesAnalysed} partides analitzades`}</CardTitle>
            <CardDescription>Un patró només compta quan es repeteix en almenys dues partides.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <ul className="divide-y divide-border">
              {patterns.recurring.length === 0 && <li className="py-1.5 text-muted-foreground">Cap error greu classificat.</li>}
              {patterns.recurring.map((r) => (
                <li key={r.type} className="flex justify-between gap-2 py-1.5">
                  <span>{ERROR_TYPE_LABELS[r.type]}</span>
                  <span className="text-muted-foreground">
                    {r.count} en {r.games} {r.games > 1 ? 'partides' : 'partida'}{r.engineVerified ? ` · ${r.engineVerified} verificats pel motor` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <p>
                Errors per fase: obertura {patterns.byPhase.opening}, mig joc {patterns.byPhase.middlegame}, final {patterns.byPhase.endgame}.
              </p>
              {weak.length ? (
                <p className="rounded-md bg-secondary p-3 text-secondary-foreground">
                  El pla d'entrenament ja inclou: {weak.map(conceptLabel).join(', ')}. <Link to="/entrenar" className="underline">Entrena ara</Link>.
                </p>
              ) : (
                <p className="text-muted-foreground">Analitza més partides per confirmar patrons i ajustar el pla.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Importa de {SOURCES[0].label}</CardTitle>
            <CardDescription>Partides públiques recents. {SOURCES.filter((s) => !s.available).map((s) => s.label).join(', ')}: properament.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-48">
                <label htmlFor="li-user" className="text-xs text-muted-foreground">Usuari</label>
                <Input id="li-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="el_teu_usuari" />
              </div>
              <Segmented label="Nombre de partides" value={count} onChange={setCount} options={[5, 10, 20].map((n) => ({ value: n, label: String(n) }))} />
              <Button onClick={importLichess} disabled={busy || !username.trim()}>
                {busy ? <Loader2 className="animate-spin" /> : <Download />} Importa
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Enganxa un PGN</CardTitle>
            <CardDescription>Admet fitxers amb diverses partides, comentaris i rellotge (%clk).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={pgn} onChange={(e) => setPgn(e.target.value)} className="min-h-20 font-mono text-xs" placeholder={'[White "Jo"]\n[Black "Rival"]\n\n1. e4 e5 2. Nf3 ...'} aria-label="PGN" />
            <div className="flex flex-wrap items-center gap-2">
              <Segmented label="Amb quines peces jugaves" value={pgnColor} onChange={setPgnColor} options={[{ value: 'auto', label: 'Detecta pel nom' }, { value: 'w', label: 'Blanques' }, { value: 'b', label: 'Negres' }]} />
              <Button variant="secondary" onClick={() => importPgn(pgn)} disabled={!pgn.trim()}>Importa</Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-muted">
                <FileUp className="size-4" /> .pgn
                <input type="file" accept=".pgn,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importPgn(await f.text()); }} />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {msg && <p role="status" className={msg.tone === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Les teves partides</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Profunditat</span>
              <Segmented label="Profunditat de l'anàlisi" value={depth} onChange={setDepth} options={[10, 12, 14].map((d) => ({ value: d, label: String(d) }))} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">Encara no hi ha cap partida. Importa'n de Lichess o enganxa un PGN.</p>
          ) : (
            <ul className="divide-y divide-border">
              {games.map((g) => {
                const out = outcomeFor(g);
                const isRunning = running?.id === g.id;
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {g.analysis ? <Link to={`/partides/${g.id}`} className="hover:underline">contra {opponentOf(g) ?? '?'}</Link> : <>contra {opponentOf(g) ?? '?'}</>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {g.source === 'lichess' ? 'Lichess' : 'PGN'} · {g.playedAt ? new Date(g.playedAt).toLocaleDateString('ca') : g.headers.Date ?? 'sense data'}
                        {g.headers.Opening ? ` · ${g.headers.Opening}` : ''}
                        {!g.userColor && ' · color desconegut'}
                      </p>
                      {isRunning && (
                        <div className="mt-2 space-y-1">
                          <Progress value={(running.done / running.total) * 100} label="Progrés de l'anàlisi" />
                          <p className="text-xs text-muted-foreground">{running.stage}… {running.total > 1 ? `${running.done}/${running.total}` : ''}</p>
                        </div>
                      )}
                    </div>
                    <Badge variant={out.variant}>{out.label}</Badge>
                    {g.analysis && <Badge variant="outline">{Math.round(g.analysis.report.accuracy)}% · {g.analysis.report.counts.blunder} greus</Badge>}
                    {!g.userColor && (
                      <select aria-label="El teu color" className="h-8 rounded-md border border-input bg-card px-2 text-xs" value="" onChange={(e) => upsertGame({ ...g, userColor: e.target.value as 'w' | 'b', analysis: undefined })}>
                        <option value="" disabled>El teu color…</option>
                        <option value="w">Blanques</option>
                        <option value="b">Negres</option>
                      </select>
                    )}
                    {isRunning ? (
                      <Button size="sm" variant="outline" onClick={() => abortRef.current?.abort()}><Square /> Atura</Button>
                    ) : (
                      <Button size="sm" variant={g.analysis ? 'outline' : 'default'} disabled={!!running} onClick={() => analyse(g)}>
                        <Play /> {g.analysis ? 'Reanalitza' : 'Analitza'}
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label="Esborra la partida" disabled={isRunning} onClick={() => removeGame(g.id)}><Trash2 /></Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
