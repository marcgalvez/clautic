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

Servidor (opcional)
├── Supabase Edge Function `coach` (producció) ─┐
└── server/coach-dev.ts (desenvolupament local) ─┴→ supabase/functions/_shared/coach-core.ts → Claude API
     La clau ANTHROPIC_API_KEY només viu al servidor; el navegador no la veu mai.
     Entrada: fets calculats al client amb chess.js + Stockfish (mai opinions del model).
     Sortida: text filtrat. Qualsevol jugada que no surti dels fets s'amaga.
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

## Fase 2: personalització

- **Diagnòstic** (`src/lib/diagnostic`, `DiagnosticPage`): qüestionari (regles, freqüència de joc, classificacions per plataforma i ritme, temps i objectius) i 13 posicions de dificultat creixent, amb un sol intent i sense pistes. Avalua set competències: visió tàctica, càlcul, obertura, comprensió posicional, finals, detecció d'amenaces i justificació (amb un "per què?" de tres opcions). S'atura després de 4 errors seguits. El nivell inicial és el més alt amb un ≥ 60 % d'encerts, i surt marcat com a *provisional* si hi ha menys de 8 ítems.
- **Nous formats d'exercici**: `choice` (triar la millor de 3 jugades candidates) i `threat` (identificar l'amenaça del rival). Es verifiquen analitzant cada opció per separat (`go searchmoves`); en el format `threat`, amb el torn passat al rival. Ara n'hi ha 29: tàctica, amenaces, finals (oposició, caselles clau, regla del quadrat), estratègia (simplificar, fer aire al rei) i obertures (trampes reals).
- **Perfil** (`ProfilePage`): diagnòstic, competències i classificacions externes. Cada plataforma i ritme és una sèrie separada (no es converteixen mai), amb importació des de Lichess i el seu historial.
- **Sessions adaptatives**: el planificador rep el nivell del diagnòstic i les competències febles (que alimenten el bloc de punt feble) fins que la pràctica les confirma o les desmenteix.
- **Estadístiques**: precisió per categoria, qualitat setmanal en tàctica i en finals, temps de resolució, errors recurrents (només si es repeteixen en ≥ 2 posicions o partides) i historial de sessions.
- **Supabase** (`supabaseRepository.ts`, `AuthGate.tsx`): opcional. Amb les variables `VITE_SUPABASE_*` hi ha inici de sessió per correu i contrasenya (o "continua sense compte"). Les dades se sincronitzen amb taules normalitzades i RLS, escrivint només les diferències en lots (*debounce* de 800 ms). En el primer inici de sessió es pugen les dades locals. Les competències són una vista SQL (`concept_mastery`), no dades duplicades.

## Fase 3: entrenador IA

- **Fets verificats** (`src/lib/coach/facts.ts`): jugades legals, escacs, captures, peces mal defensades (pròpies i rivals), amenaces del rival (amb el torn passat), variants de Stockfish amb l'avaluació des del punt de vista de l'alumne, intents erronis amb la seva refutació, i la solució i l'explicació només quan ja s'han revelat.
- **Nucli** (`supabase/functions/_shared/coach-core.ts`, sense dependències): valida i limita la petició, construeix el *prompt* (sistema estable i en memòria cau; els textos de l'alumne van entre cometes com a dades) i aplica `groundResponse`: cada jugada que escriu el model es contrasta amb els fets. Les desconegudes es canvien per «[jugada no verificada]» i la solució es canvia per «[…]» mentre no s'hagi revelat. El client tradueix la notació a la catalana.
- **Modes**: pistes progressives (pregunta socràtica → zona o peça → idea, sense la jugada), explicació de la solució, valoració del raonament escrit, preguntes lliures (exercici, tauler i partida) i revisió de partides.
- **Model**: Claude Opus 5.5 (`claude-opus-5-5`, configurable amb `COACH_MODEL`), esforç `low` (respostes curtes) i *fallback* del servidor activat (`fallbacks: "default"`): si un classificador de seguretat rebutja la petició, un altre model la reprèn. Si el rebuig és definitiu, es mostra un missatge neutre.
- **Control de costos**: límit diari per usuari a la Edge Function (taula `coach_usage`, `COACH_DAILY_LIMIT`, 60 per defecte), límit per hora al servidor local i textos truncats a la validació.
- Les pistes de la IA compten com a pistes en la puntuació de l'intent. Sense servei configurat, l'app ho indica i continua amb les pistes estàtiques.

## Fase 4: partides i automatització

- **Fonts** (`src/lib/games/sources.ts`): interfície `GameSourceClient`. Lichess està implementat (exportació en ndjson amb rellotge, classificacions i historial); Chess.com queda preparat (`available: false`).
- **Anàlisi** (`analyze.ts`): s'avalua cada posició una vegada; la qualitat d'una jugada és la caiguda de la probabilitat de victòria de qui mou (llindars de Lichess: 10/20/30). El temps per jugada surt del `%clk`. Mat representat de manera que el guanyador surti al 100 %.
- **Classificació d'errors** (`classify.ts`), amb un nivell de confiança per a cada error:
  - *Verificats pel motor*: peça penjada (la jugada deixa una peça indefensa i la resposta del motor la captura) i amenaça no detectada (la resposta del motor executa una amenaça que ja existia).
  - *Heurístics*: decisió precipitada (requereix dades de rellotge), error de càlcul (jugada forçant refutada), errors d'obertura i de final.
  - *Pendent de més evidència*: problema posicional (no hi ha pèrdua de material immediata).
- **Informe**: precisió aproximada, moment decisiu (la primera jugada que passa d'una posició jugable, ≥ 40 %, a una perduda, < 25 %, sense recuperació), moments crítics, veredicte i recomanacions. Les interpretacions només entren a les recomanacions si es repeteixen.
- **Exercicis a partir dels errors** (`generate.ts`): la posició prèvia a l'error es converteix en exercici només si Stockfish (profunditat 16, MultiPV 2) confirma que la millor jugada supera la segona en ≥ 15 punts i que té sentit (guanyar avantatge o salvar la posició). Es desen amb el registre de verificació i entren al banc i al planificador.
- **Patrons recurrents** (`patterns.ts`): tipus d'error per partides i per fases. Un patró només actualitza el pla si apareix en ≥ 2 partides (`usePlanInputs`).

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
| Claude API (Fase 3) | De pagament per ús. Amb Claude Opus 5.5 (4 $ / 20 $ per milió de tokens d'entrada/sortida), una consulta típica (~1.000 tokens d'entrada i 100–300 de sortida, més el raonament amb esforç `low`) costa aproximadament **1–2 cèntims**. Amb el límit per defecte de 60 consultes diàries, el màxim teòric és ~1 $ per usuari i dia; l'ús real (unes quantes pistes per sessió) queda en cèntims. Es pot canviar el model amb `COACH_MODEL`. |
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

## Criteris d'acceptació de les fases 2–4

- [x] Diagnòstic amb qüestionari i posicions progressives, perfil provisional i actualitzable, i classificacions externes separades per plataforma i ritme.
- [x] Repetició espaiada per concepte, i els errors tornen en posicions diferents (exclusió estricta de les intentades les últimes 24 h).
- [x] Sessions adaptades al diagnòstic, als errors de pràctica i als patrons de les partides.
- [x] Estadístiques per categoria, temps, errors recurrents i evolució de l'ELO importat (mai inventat).
- [x] Supabase opcional amb RLS a totes les taules d'usuari i sincronització provada amb un client simulat.
- [x] Entrenador amb pistes progressives, preguntes socràtiques, explicacions i revisió del raonament, fonamentat en dades verificades, amb filtre de jugades i clau només al servidor.
- [x] Importació de Lichess i PGN, anàlisi automàtica, classificació d'errors amb nivell de confiança, informe "per què he perdut", exercicis verificats generats a partir dels errors i actualització del pla.
- [x] Proves automàtiques per a cada mòdul, inclosa una prova d'integració amb Stockfish real.
