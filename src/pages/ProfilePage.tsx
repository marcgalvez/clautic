import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { LineChart } from '@/components/charts/LineChart';
import { useData } from '@/state/DataProvider';
import { COMPETENCE_LABELS } from '@/lib/diagnostic/diagnostic';
import { LichessClient, SourceError, validateUsername, type RatingHistoryPoint } from '@/lib/games/sources';
import { difficultyLabel } from '@/lib/exercises/themes';
import { TC_LABEL } from './DiagnosticPage';
import type { Competence, ExternalRating, RatingPlatform } from '@/lib/storage/types';

const PLATFORM: Record<RatingPlatform, string> = { lichess: 'Lichess', chesscom: 'Chess.com', fide: 'FIDE' };
const lichess = new LichessClient();

export function ProfilePage() {
  const { data, setProfile, addExternalRatings, removeExternalRating } = useData();
  const profile = data.profile!;
  const diagnostic = data.diagnostics.at(-1);
  const [username, setUsername] = useState(profile.lichessUsername ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [history, setHistory] = useState<RatingHistoryPoint[]>([]);

  // Group ratings by platform + time control: separate series, never mixed.
  const series = useMemo(() => {
    const m = new Map<string, ExternalRating[]>();
    for (const r of data.externalRatings) {
      const k = `${r.platform}|${r.timeControl}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()].map(([k, list]) => ({ key: k, list: list.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) }));
  }, [data.externalRatings]);

  const importLichess = async () => {
    const err = validateUsername(username);
    if (err) {
      setMsg({ tone: 'bad', text: err });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const ratings = await lichess.fetchRatings(username);
      addExternalRatings(ratings);
      setProfile({ ...profile, lichessUsername: username.trim() });
      const h = await lichess.fetchRatingHistory(username).catch(() => []);
      setHistory(h);
      setMsg({ tone: 'ok', text: ratings.length ? `${ratings.length} classificacions importades de Lichess.` : 'Aquest usuari encara no té partides puntuades.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: e instanceof SourceError ? e.message : 'No s\'ha pogut importar.' });
    } finally {
      setBusy(false);
    }
  };

  const historyByTc = useMemo(() => {
    const m = new Map<string, RatingHistoryPoint[]>();
    for (const p of history) m.set(p.timeControl, [...(m.get(p.timeControl) ?? []), p]);
    return [...m.entries()].filter(([, v]) => v.length > 1);
  }, [history]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil escaquístic</h1>
        <p className="text-sm text-muted-foreground">{profile.displayName} · sessions de {profile.sessionMinutes} minuts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Diagnòstic</CardTitle>
          <CardDescription>
            {diagnostic
              ? `Fet el ${new Date(diagnostic.completedAt).toLocaleDateString('ca')}. Les sessions ajusten el nivell a mesura que entrenes.`
              : 'Encara no l\'has fet. Serveix per triar el nivell inicial i els primers punts a reforçar.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnostic && (
            <>
              <p className="text-sm">
                Nivell inicial: <strong>{diagnostic.startDifficulty} / 5 · {difficultyLabel(diagnostic.startDifficulty)}</strong>
                {diagnostic.provisional && <Badge variant="warning" className="ml-2">Provisional</Badge>}
              </p>
              <div className="space-y-2">
                {(Object.entries(diagnostic.competences) as [Competence, { score: number; n: number }][]).map(([c, v]) => (
                  <div key={c} className="grid grid-cols-[150px_1fr_48px] items-center gap-3 text-sm sm:grid-cols-[180px_1fr_48px]">
                    <span>{COMPETENCE_LABELS[c]}</span>
                    <Progress value={v.score * 100} label={COMPETENCE_LABELS[c]} />
                    <span className="text-right text-xs tabular-nums text-muted-foreground">{Math.round(v.score * 100)}%</span>
                  </div>
                ))}
              </div>
              {diagnostic.questionnaire.goals.length > 0 && (
                <p className="text-sm text-muted-foreground">Objectius: {diagnostic.questionnaire.goals.join(', ')}.</p>
              )}
            </>
          )}
          <Link to="/diagnostic"><Button variant={diagnostic ? 'outline' : 'default'}>{diagnostic ? 'Repeteix el diagnòstic' : 'Fes el diagnòstic'}</Button></Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classificacions externes</CardTitle>
          <CardDescription>
            Cada plataforma i ritme és una escala diferent: es mostren per separat i no es converteixen. ChessLab no s'inventa cap ELO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-56">
              <label htmlFor="lichess-user" className="text-xs text-muted-foreground">Usuari de Lichess</label>
              <Input id="lichess-user" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="el_teu_usuari" />
            </div>
            <Button onClick={importLichess} disabled={busy || !username.trim()}>
              <Download /> {busy ? 'Important…' : 'Importa de Lichess'}
            </Button>
          </div>
          {msg && <p role="status" className={msg.tone === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>}
          <p className="text-xs text-muted-foreground">Només es llegeixen dades públiques. Chess.com s'afegirà en una fase posterior.</p>

          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hi ha cap classificació desada. Pots afegir-ne al diagnòstic o importar-les de Lichess.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {series.map(({ key, list }) => {
                const lastR = list.at(-1)!;
                return (
                  <div key={key} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{PLATFORM[lastR.platform]} · {TC_LABEL[lastR.timeControl]}</p>
                        <p className="text-2xl font-semibold tabular-nums">
                          {lastR.rating}
                          {lastR.provisional && <span className="ml-1 text-sm text-muted-foreground">?</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lastR.source === 'api' ? 'Importat' : 'Declarat per tu'} · {new Date(lastR.recordedAt).toLocaleDateString('ca')}
                          {list.length > 1 && ` · ${list.length} registres`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Esborra el registre més recent" onClick={() => removeExternalRating(lastR.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                    {list.length > 1 && (
                      <LineChart ariaLabel={`Evolució ${PLATFORM[lastR.platform]} ${TC_LABEL[lastR.timeControl]}`} height={90}
                        points={list.map((r) => ({ label: new Date(r.recordedAt).toLocaleDateString('ca'), value: r.rating }))} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {historyByTc.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm font-medium">Historial de Lichess</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {historyByTc.map(([tc, pts]) => (
                  <div key={tc}>
                    <p className="text-xs text-muted-foreground">{TC_LABEL[tc as keyof typeof TC_LABEL]} (Lichess)</p>
                    <LineChart ariaLabel={`Historial Lichess ${tc}`} height={110} points={pts.slice(-60).map((p) => ({ label: p.date, value: p.rating }))} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
