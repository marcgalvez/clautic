# ChessLab: arquitectura

## Principis

1. **La veritat escaquística no ve mai del model de llenguatge.** La legalitat la decideix chess.js; la qualitat de les jugades, Stockfish. Claude (a partir de la Fase 3) només explica dades ja verificades.
2. **Cap contingut sense verificar arriba a l'usuari.** Cada exercici es valida amb chess.js i Stockfish (`npm run verify:exercises`). La UI només mostra els exercicis amb una verificació vigent per al seu contingut exacte (empremta FNV-1a de FEN + solució).
3. **Cap dada inventada.** Sense dades suficients, el nivell es mostra com a *provisional*. Les mètriques internes no es presenten mai com a ELO.
4. **Pedagogia abans que puntuació.** Encertar no és prou: la qualitat d'un intent descompta pistes, errors i temps. Els repassos són per concepte i es fan amb posicions diferents.

## Visió general

```
Navegador (React 19 + TypeScript + Vite)
├── UI: Tailwind v4 + components d'estil shadcn/ui (cva + tailwind-merge)
├── Tauler: react-chessboard v5   ← regles: chess.js
├── Motor: Stockfish 19 lite (WASM) en un Web Worker (no bloqueja la UI)
├── Lògica pedagògica pura (src/lib/training): puntuació, repetició espaiada, planificador
└── Repository (interfície)
     ├── LocalRepository (Fase 1, localStorage)
     └── SupabaseRepository (Fase 2: Postgres + Auth + RLS)

Servidor (Fase 3)
└── Supabase Edge Function `coach` → Claude API
     La clau ANTHROPIC_API_KEY viu com a secret de la funció; el navegador no la veu mai.
     Entrada: FEN + variants i avaluacions de Stockfish + historial de l'usuari.
     Sortida: pistes / preguntes socràtiques basades només en aquestes dades.
```

### Per què Vite i no Next.js

L'app és una SPA: tauler, motor i lògica s'executen al client, i el backend és Supabase. Next.js afegiria un servidor Node que no cal. L'única peça de servidor (el proxy cap a Claude) encaixa millor en una Edge Function de Supabase, al costat de l'autenticació i les dades.

### Per què Stockfish *lite single-threaded*

- ~1,8 MB (la versió completa en fa ~95).
- No necessita capçaleres COOP/COEP (`SharedArrayBuffer`), així que funciona en qualsevol hosting estàtic i al mòbil.
- És moltíssim més fort que qualsevol humà: sobra per a la pedagogia. El mateix binari verifica els exercicis a Node.

## Estructura del codi

```
src/
  components/
    board/       ChessBoard (clic/arrossegament, legals, promoció, escac, fletxes, caselles), EvalBar, MoveList, EngineLines
    exercise/    ExerciseSolver (pistes progressives, solució bloquejada, refutació amb motor, raonament), ThinkingChecklist
    training/    Passos de lliçó: Comprendre, Recordar (quiz + recuperació lliure)
    layout/ ui/
  data/
    exercises/   tactics.json + verification.json (generat)
    lessons/     lliçons amb pregunta interactiva verificable
    concepts.ts  catàleg de competències
  lib/
    chess/       game.ts (estat, SAN), moveTree.ts (variants), pgn.ts (parser propi amb variants/comentaris/NAG)
    engine/      uci.ts (parser pur), stockfishClient.ts (Worker + cua + cancel·lació), useEngine.ts
    exercises/   tipus, validació de regles, banc (només verificats)
    training/    scoring, spacedRepetition, sessionPlan, stats
    storage/     tipus del model, Repository, LocalRepository
  pages/         Inici, Entrenar, Exercicis, Tauler i anàlisi, Progrés, Configuració
  i18n/          ca (complet), es/en (parcials, amb retorn al català)
scripts/         verify-exercises.mjs, copy-stockfish.mjs
supabase/        migracions SQL amb RLS
```

## Mètode pedagògic implementat

| Fase | On | Detall |
|---|---|---|
| Recuperació inicial | `TrainPage` (warmup) | Si hi ha repassos vençuts, preguntes de memòria sobre aquests conceptes abans del tema nou. |
| Comprendre | `UnderstandStep` | Concepte, què cal observar i posició d'exemple amb una pregunta al tauler (la resposta no es mostra fins després de dos intents). |
| Recordar | `PrincipleRecall`, `RecallQuiz` | Primer formular el principi amb paraules pròpies (efecte de generació), després preguntes tancades amb l'explicació un cop respostes. |
| Aplicar | `ExerciseSolver` | Posicions noves. Un 75 % del tema i un 25 % intercalades d'altres temes (*interleaving*). Rutina "amenaces, escacs, captures, peces indefenses". Pista oferta després de cada error, cada vegada més concreta. La solució només es desbloqueja després d'un intent. Abans de l'explicació es demana el raonament. |
| Punt feble | `planSession` | Conceptes amb qualitat < 0,6 (mínim 2 intents). S'exclouen les posicions intentades les darreres 24 h, perquè l'error torni en una posició diferent. |
| Consolidar | `Consolidate` | Resum, reflexió i confiança. Es programen repassos per concepte: escala 1-3-7-14-30-60 dies. Pugen amb qualitat ≥ 0,8, es repeteixen entre 0,5 i 0,8, i tornen a 1 dia per sota de 0,5. |

**Qualitat d'un intent** (`scoring.ts`): 1 − 0,2 per pista (màx. 0,6) − 0,15 per error (màx. 0,45) − penalització si el temps supera 1,5× o 3× el temps de referència de la dificultat. Revelar la solució val 0,1.

**Dificultat adaptativa:** puja només si la qualitat mitjana dels darrers 8 intents és ≥ 0,8 (no n'hi ha prou amb encertar), i baixa si és < 0,5.

**Punts forts:** cal una qualitat ≥ 0,8 en almenys **dues posicions diferents**, perquè repetir una resposta memoritzada no compti com a domini.

## Verificació d'exercicis

`scripts/verify-exercises.mjs` (Stockfish a profunditat 20, MultiPV 4):

1. FEN vàlida, el bàndol que no juga no està en escac i la posició no ha acabat.
2. Totes les jugades de la solució són legals.
3. Cada jugada de l'usuari és la primera del motor.
4. Unicitat: cap alternativa no acceptada s'hi acosta a menys de 15 punts de probabilitat de victòria. Als problemes de mat, cap altra jugada fa mat igual de ràpid.
5. Posició final: mat si l'objectiu és un mat, o clarament guanyadora (≥ 75 %) si no ho és.
6. Avís si la resposta del rival no és la millor defensa.

Durant el desenvolupament, aquest procés va detectar tres exercicis ambigus a la segona jugada, que es van corregir.

## Costos

| Element | Cost |
|---|---|
| Fase 1 sencera | **0 €**: tot s'executa al navegador, sense comptes ni claus. |
| Hosting estàtic (Netlify/Vercel/Cloudflare Pages) | Pla gratuït suficient. |
| Supabase (Fase 2) | Pla gratuït: 500 MB de base de dades i 50.000 usuaris actius al mes. Els projectes inactius es pausen. |
| Claude API (Fase 3) | De pagament per ús. Amb un model petit/mitjà, unes poques pistes per sessió suposen cèntims al mes per a un sol usuari. Es limitarà per usuari i dia i s'aprofitarà el *prompt caching*. |
| Lichess API (Fase 4) | Gratuïta (amb límits de velocitat). |
| Stockfish | Gratuït (GPL-3.0). Si es distribueix l'app, cal oferir-ne el codi font (és al paquet npm `stockfish`). |

## Criteris d'acceptació de la Fase 1

- [x] `npm install && npm run dev` arrenca l'app sense cap variable d'entorn ni servei extern.
- [x] Tauler: arrossegar i clicar, legals marcats, escac/mat/ofegat/taules (material, triple repetició, 50 jugades), enroc, captura al pas, promoció amb selector, desfer, girar, coordenades, fletxes i caselles amb clic dret.
- [x] Càrrega de FEN amb validació; PGN multi-partida amb variants niades, comentaris, NAG, errors amb número de jugada; navegació (botons i teclat); exportació de FEN/PGN.
- [x] Stockfish en un Web Worker: avaluació, MultiPV 1–3, profunditat configurable, barra d'avaluació, fletxa de millor jugada, afegir una variant amb un clic, i errors gestionats sense bloquejar la UI.
- [x] 19 exercicis tàctics verificats (12 temes) amb pistes progressives, explicació i etiquetes.
- [x] Registre de resultats persistent (intents, temps, pistes, errors, raonament) i pàgina de progrés.
- [x] Sessió guiada de 10–45 min amb les quatre fases i programació de repassos.
- [x] Proves automàtiques (regles, PGN, UCI, exercicis, lliçons, pedagogia, persistència, components) i build de producció sense errors.
