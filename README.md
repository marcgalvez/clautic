# ChessLab

Entrenador personal d'escacs: diagnostica, ensenya a pensar i proposa entrenament adaptat, amb pedagogia basada en evidència (recuperació activa, repetició espaiada, intercalat), Stockfish com a font de veritat i Claude com a tutor (opcional).

> **Estat:** fases 1–4 implementades. Tot funciona sense cap servei de pagament ni compte (dades al navegador). Supabase (comptes al núvol) i l'entrenador IA (Claude) són opcionals.

## Posada en marxa

Requisits: Node.js ≥ 22.18.

```bash
npm install          # també copia Stockfish (WASM) a public/engine/
npm run dev          # http://localhost:5173
```

| Ordre | Què fa |
|---|---|
| `npm test` | Proves automàtiques (Vitest) |
| `npm run typecheck` | Comprovació de tipus |
| `npm run build` | Build de producció a `dist/` (hosting estàtic) |
| `npm run coach` | Servidor local de l'entrenador IA (llegeix `ANTHROPIC_API_KEY` de `.env`; Vite el fa servir a `/api/coach`) |
| `npm run verify:exercises` | Revalida tots els exercicis amb chess.js + Stockfish (≈2–3 min). Cal executar-la després d'editar `src/data/exercises/*.json`. |

No cal cap `.env` per fer servir l'app. Per a les parts opcionals, copia `.env.example` a `.env`:

- **Entrenador IA en local:** posa `ANTHROPIC_API_KEY` a `.env` i executa `npm run coach` en un altre terminal, al costat de `npm run dev`.
- **Supabase:** crea un projecte (el pla gratuït és suficient), executa `supabase/migrations/0001_init.sql` a l'editor SQL i posa `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` a `.env`.
- **Entrenador en producció:** `supabase functions deploy coach` i `supabase secrets set ANTHROPIC_API_KEY=...`. El client el troba automàticament a partir de `VITE_SUPABASE_URL`.

## Com provar-ho

1. Obre l'app, escriu el teu nom i tria la durada.
2. **Inici:** sessió recomanada, nivell (provisional fins a 10 exercicis), objectiu, repassos, punts forts i febles.
3. **Entrenar:** recorre les fases *Comprendre → Recordar → Aplicar → Consolidar*. Prova de fer una jugada errònia: s'ofereix una pista, el botó de solució es desbloqueja i "Per què no funciona?" mostra la refutació calculada per Stockfish.
4. **Exercicis:** banc filtrable per tema i dificultat, amb l'estat de cada exercici.
5. **Tauler i anàlisi:** mou peces, activa el motor, enganxa un PGN amb variants (`1. e4 e5 (1... c5) 2. Nf3 *`), navega amb ← →, gira el tauler i fes clic dret per marcar caselles o dibuixar fletxes.
6. **Progrés:** registre d'intents, rendiment per tema i repassos programats.
7. **Diagnòstic i perfil:** a l'inici, "Fes el diagnòstic". Després, el perfil mostra les competències i permet importar les classificacions de Lichess.
8. **Partides:** importa les de Lichess (pel nom d'usuari) o enganxa un PGN. Prem **Analitza** i obre la partida: hi veuràs per què ha anat així, els moments crítics, el tipus d'error (amb el nivell de confiança) i els exercicis creats a partir dels teus errors.
9. **Entrenador IA** (amb el servei configurat): "Pista de l'entrenador" mentre resols, "Explica-m'ho" i "Valora el meu raonament" en acabar, i preguntes lliures al tauler i a les partides.
10. **Configuració:** tema clar/fosc, idioma, profunditat del motor, punt de vista de l'avaluació, i exportació/importació/esborrat de les dades.

## Tecnologia

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · components d'estil shadcn/ui · chess.js · react-chessboard 5 · Stockfish 19 (WASM, Web Worker) · Vitest · Supabase (Fase 2) · Claude API via Edge Function (Fase 3) · Lichess API (Fase 4).

Les decisions d'arquitectura, el mètode pedagògic, la verificació, els costos i els criteris d'acceptació són a **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. L'esquema de base de dades amb RLS és a `supabase/migrations/0001_init.sql`.

## Fases

- **Fase 1, MVP:** ✅ tauler complet, regles, Stockfish, FEN/PGN, exercicis verificats, registre de resultats i sessió guiada.
- **Fase 2, personalització:** ✅ diagnòstic, perfil, exercicis d'estratègia, finals, obertures i amenaces, repetició espaiada, sessions adaptatives, estadístiques, ELO extern separat i Supabase opcional.
- **Fase 3, entrenador IA:** ✅ Claude amb fets de chess.js + Stockfish, pistes progressives, preguntes socràtiques, explicacions, revisió del raonament i filtre de jugades no verificades.
- **Fase 4, partides:** ✅ Lichess i PGN, anàlisi automàtica, classificació d'errors amb nivell de confiança, informe "per què he perdut", exercicis generats i actualització del pla. Chess.com, preparat però pendent.

## Llicències

Codi de l'app: privat. Stockfish és GPL-3.0 (no s'inclou al repositori: es copia de `node_modules/stockfish` en instal·lar). chess.js és BSD-2. react-chessboard és MIT.
