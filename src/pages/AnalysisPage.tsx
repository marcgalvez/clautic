import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_POSITION } from 'chess.js';
import {
  ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, ClipboardCopy, Cpu, FileUp, FlipVertical2, RotateCcw, Trash2, Undo2,
} from 'lucide-react';
import { ChessBoard, type BoardMove } from '@/components/board/ChessBoard';
import { EvalBar } from '@/components/board/EvalBar';
import { EngineLines } from '@/components/board/EngineLines';
import { MoveList } from '@/components/board/MoveList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { addMove, createTree, deleteNode, gameAt, mainlineFrom, pathTo, promoteVariation, ROOT_ID, type MoveTree } from '@/lib/chess/moveTree';
import { parsePgn, treeToPgn, type ParsedGame } from '@/lib/chess/pgn';
import { gameStatus } from '@/lib/chess/game';
import { useEngineState, useLiveAnalysis } from '@/lib/engine/useEngine';
import { toWhitePov } from '@/lib/engine/uci';
import { useData } from '@/state/DataProvider';
import type { MessageKey } from '@/i18n';

function statusText(t: (k: MessageKey) => string, tree: MoveTree, id: string): string {
  const g = gameAt(tree, id);
  const s = gameStatus(g);
  if (s.kind === 'checkmate') return `${t('board.checkmate')} — guanyen les ${s.winner === 'w' ? 'blanques' : 'negres'}`;
  if (s.kind === 'stalemate') return t('board.stalemate');
  if (s.kind === 'draw') return t(`board.draw.${s.reason}` as MessageKey);
  return `${g.turn() === 'w' ? t('board.whiteToMove') : t('board.blackToMove')}${s.check ? ` · ${t('board.check')}` : ''}`;
}

export function AnalysisPage() {
  const { data, t, updateSettings } = useData();
  const [params, setParams] = useSearchParams();
  const initialFen = params.get('fen') ?? DEFAULT_POSITION;
  const [tree, setTree] = useState<MoveTree>(() => {
    try {
      return createTree(initialFen);
    } catch {
      return createTree(DEFAULT_POSITION);
    }
  });
  const [currentId, setCurrentId] = useState(ROOT_ID);
  const [orientation, setOrientation] = useState<'white' | 'black'>(() => (initialFen.split(' ')[1] === 'b' ? 'black' : 'white'));
  const [engineOn, setEngineOn] = useState(false);
  const [multiPv, setMultiPv] = useState(3);
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [games, setGames] = useState<ParsedGame[]>([]);

  const current = tree.nodes[currentId];
  const fen = current.fen;
  const engineState = useEngineState();
  const analysis = useLiveAnalysis(fen, engineOn, data.settings.engineDepth, multiPv);
  const freshLines = analysis.fen === fen ? analysis.lines : [];
  const gameOver = gameStatus(gameAt(tree, currentId)).kind !== 'playing';

  const loadTree = (next: MoveTree, goTo: 'start' | 'end' = 'start') => {
    setTree(next);
    const line = mainlineFrom(next);
    setCurrentId(goTo === 'end' && line.length ? line[line.length - 1] : ROOT_ID);
  };

  const navigate = useCallback(
    (dir: 'first' | 'prev' | 'next' | 'last') => {
      const node = tree.nodes[currentId];
      if (dir === 'first') setCurrentId(ROOT_ID);
      else if (dir === 'prev' && node.parentId) setCurrentId(node.parentId);
      else if (dir === 'next' && node.children.length) setCurrentId(node.children[0]);
      else if (dir === 'last') {
        const line = mainlineFrom(tree, currentId);
        if (line.length) setCurrentId(line[line.length - 1]);
      }
    },
    [tree, currentId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
      const map: Record<string, 'first' | 'prev' | 'next' | 'last'> = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' };
      if (map[e.key]) {
        e.preventDefault();
        navigate(map[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const onMove = (m: BoardMove) => {
    try {
      const res = addMove(tree, currentId, m);
      setTree(res.tree);
      setCurrentId(res.id);
      return true;
    } catch {
      return false;
    }
  };

  const undo = () => {
    if (currentId === ROOT_ID) return;
    const parent = current.parentId!;
    setTree(deleteNode(tree, currentId));
    setCurrentId(parent);
  };

  const playLine = (uci: string[]) => {
    let tr = tree;
    let id = currentId;
    try {
      for (const u of uci.slice(0, 8)) {
        const r = addMove(tr, id, u);
        tr = r.tree;
        id = r.id;
      }
    } catch {
      /* stop at the first illegal move */
    }
    setTree(tr);
    setCurrentId(id);
  };

  const loadFen = () => {
    try {
      const next = createTree(fenInput.trim());
      loadTree(next);
      setOrientation(fenInput.trim().split(' ')[1] === 'b' ? 'black' : 'white');
      setGames([]);
      setMessage({ tone: 'ok', text: 'Posició carregada.' });
      setParams({ fen: next.nodes[ROOT_ID].fen });
    } catch (e) {
      setMessage({ tone: 'bad', text: `FEN invàlida: ${(e as Error).message}` });
    }
  };

  const loadPgn = (text: string) => {
    const { games: parsed, errors } = parsePgn(text);
    if (!parsed.length) {
      setMessage({ tone: 'bad', text: errors.map((e) => `Partida ${e.gameIndex}: ${e.message}`).join(' · ') || 'PGN invàlid.' });
      return;
    }
    setGames(parsed);
    loadTree(parsed[0].tree);
    setOrientation('white');
    setMessage({
      tone: errors.length ? 'bad' : 'ok',
      text: `${parsed.length} partida${parsed.length > 1 ? 'es' : ''} carregada${parsed.length > 1 ? 'es' : ''}.` +
        (errors.length ? ` ${errors.length} amb errors: ${errors.map((e) => `#${e.gameIndex} ${e.message}`).join('; ')}` : ''),
    });
  };

  const onFile = async (file: File) => {
    if (file.size > 5_000_000) {
      setMessage({ tone: 'bad', text: 'El fitxer és massa gran (màxim 5 MB).' });
      return;
    }
    loadPgn(await file.text());
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ tone: 'ok', text: `${what} copiat al porta-retalls.` });
    } catch {
      setMessage({ tone: 'bad', text: 'No s\'ha pogut copiar. Selecciona el text manualment.' });
    }
  };

  const whiteScore = freshLines[0] ? toWhitePov(freshLines[0].score, fen.split(' ')[1] as 'w' | 'b') : null;
  const bestArrow = engineOn && freshLines[0]?.pv[0] && !gameOver
    ? [{ startSquare: freshLines[0].pv[0].slice(0, 2), endSquare: freshLines[0].pv[0].slice(2, 4), color: 'rgba(20, 130, 230, 0.75)' }]
    : [];
  const headers = tree.headers;
  const lastMove = current.uci ? { from: current.uci.slice(0, 2), to: current.uci.slice(2, 4) } : null;
  const perspective = data.settings.evalPerspective === 'white' ? 'white' : orientation === 'white' ? 'w' : 'b';
  const isVariation = useMemo(() => pathTo(tree, currentId).some((id) => {
    const n = tree.nodes[id];
    return tree.nodes[n.parentId!].children[0] !== id;
  }), [tree, currentId]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tauler i anàlisi</h1>
          {headers.White || headers.Black ? (
            <p className="text-sm text-muted-foreground">
              {headers.White ?? '?'} – {headers.Black ?? '?'} {headers.Result ? `· ${headers.Result}` : ''} {headers.Event ? `· ${headers.Event}` : ''}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Mou peces lliurement, carrega una FEN o importa un PGN. Clic dret: marca caselles; arrossega amb clic dret: fletxes.</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className="mx-auto flex w-full max-w-[min(100%,680px)] gap-2">
            {engineOn && <EvalBar score={whiteScore} orientation={orientation} />}
            <div className="min-w-0 flex-1">
              <ChessBoard
                fen={fen}
                orientation={orientation}
                movable="turn"
                onMove={onMove}
                lastMove={lastMove}
                arrows={bestArrow}
                showCoordinates={data.settings.showCoordinates}
                id="analysis-board"
              />
            </div>
          </div>
          <div className="mx-auto flex max-w-[680px] flex-wrap items-center justify-center gap-1" role="toolbar" aria-label="Navegació">
            <Button variant="outline" size="icon" onClick={() => navigate('first')} aria-label="Inici"><ChevronFirst /></Button>
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} aria-label="Jugada anterior"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} aria-label="Jugada següent"><ChevronRight /></Button>
            <Button variant="outline" size="icon" onClick={() => navigate('last')} aria-label="Final"><ChevronLast /></Button>
            <span className="mx-1 h-6 w-px bg-border" />
            <Button variant="outline" size="icon" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} aria-label={t('board.flip')} title={t('board.flip')}><FlipVertical2 /></Button>
            <Button variant="outline" size="icon" onClick={undo} disabled={currentId === ROOT_ID} aria-label={t('board.undo')} title="Desfés la darrera jugada (l'esborra)"><Undo2 /></Button>
            <Button variant="outline" size="icon" onClick={() => { loadTree(createTree(DEFAULT_POSITION)); setGames([]); setParams({}); }} aria-label="Posició inicial" title="Nova partida"><RotateCcw /></Button>
            <Button variant={engineOn ? 'default' : 'outline'} onClick={() => setEngineOn((v) => !v)} aria-pressed={engineOn}>
              <Cpu /> Motor
            </Button>
          </div>
          <p className="text-center text-sm font-medium" aria-live="polite">{statusText(t, tree, currentId)}</p>
        </div>

        <div className="space-y-4">
          {engineOn && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>Anàlisi</CardTitle>
                  <div className="flex items-center gap-2">
                    <Segmented label={t('engine.lines')} value={multiPv} onChange={setMultiPv} options={[1, 2, 3].map((v) => ({ value: v, label: String(v) }))} />
                    <select
                      aria-label={t('engine.depth')}
                      className="h-9 rounded-md border border-input bg-card px-2 text-sm"
                      value={data.settings.engineDepth}
                      onChange={(e) => updateSettings({ engineDepth: Number(e.target.value) })}
                    >
                      {[12, 16, 18, 20, 22, 24].map((d) => <option key={d} value={d}>prof. {d}</option>)}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {gameOver ? (
                  <p className="text-sm text-muted-foreground">La partida ha acabat en aquesta posició.</p>
                ) : (
                  <EngineLines
                    fen={fen}
                    lines={freshLines}
                    depth={analysis.fen === fen ? analysis.depth : 0}
                    running={analysis.running}
                    engineState={engineState.state}
                    error={analysis.error ?? engineState.error}
                    perspective={perspective}
                    onPlayLine={playLine}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Jugades</CardTitle>
                <div className="flex gap-1">
                  {isVariation && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      // promote every variation on the path so the current line becomes the mainline
                      let tr = tree;
                      for (const id of pathTo(tree, currentId)) tr = promoteVariation(tr, id);
                      setTree(tr);
                    }}>
                      Fes principal
                    </Button>
                  )}
                  {currentId !== ROOT_ID && (
                    <Button variant="ghost" size="icon-sm" onClick={undo} aria-label="Esborra des d'aquesta jugada"><Trash2 /></Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <MoveList tree={tree} currentId={currentId} onSelect={setCurrentId} />
            {games.length > 1 && (
              <div className="border-t border-border p-3">
                <label className="text-xs text-muted-foreground" htmlFor="game-select">Partida del fitxer</label>
                <select
                  id="game-select"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
                  onChange={(e) => loadTree(games[Number(e.target.value)].tree)}
                >
                  {games.map((g, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {g.headers.White ?? '?'} – {g.headers.Black ?? '?'} {g.headers.Result ?? ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle>Importa i exporta</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {message && (
                <p role="status" className={message.tone === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}>{message.text}</p>
              )}
              <div className="flex gap-2">
                <Input value={fenInput} onChange={(e) => setFenInput(e.target.value)} placeholder="Enganxa una FEN…" aria-label="FEN" className="font-mono text-xs" />
                <Button variant="secondary" onClick={loadFen} disabled={!fenInput.trim()}>Carrega</Button>
              </div>
              <Textarea value={pgnInput} onChange={(e) => setPgnInput(e.target.value)} placeholder="Enganxa un PGN (admet variants, comentaris i diverses partides)…" aria-label="PGN" className="min-h-24 font-mono text-xs" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => loadPgn(pgnInput)} disabled={!pgnInput.trim()}>Importa PGN</Button>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted">
                  <FileUp className="size-4" /> Fitxer .pgn
                  <input type="file" accept=".pgn,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button variant="ghost" size="sm" onClick={() => copy(fen, 'FEN')}><ClipboardCopy /> Copia FEN</Button>
                <Button variant="ghost" size="sm" onClick={() => copy(treeToPgn(tree), 'PGN')}><ClipboardCopy /> Copia PGN</Button>
              </div>
              <p className="break-all font-mono text-[11px] text-muted-foreground">{fen}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
