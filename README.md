# ChessLab

Entrenador personal d'escacs: diagnostica, ensenya a pensar i proposa entrenament adaptat, amb pedagogia basada en evidència (recuperació activa, repetició espaiada, intercalat), Stockfish com a font de veritat i, en fases posteriors, Claude com a tutor.

> **Estat:** Fase 1 (MVP) completada. Funciona sense cap servei de pagament ni compte: les dades es desen al navegador.

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
| `npm run verify:exercises` | Revalida tots els exercicis amb chess.js + Stockfish (≈2–3 min). Cal executar-la després d'editar `src/data/exercises/*.json`. |

No cal cap `.env` per a la Fase 1. Vegeu `.env.example` per a les fases següents.

## Com provar-ho

1. Obre l'app, escriu el teu nom i tria la durada.
2. **Inici:** sessió recomanada, nivell (provisional fins a 10 exercicis), objectiu, repassos, punts forts i febles.
3. **Entrenar:** recorre les fases *Comprendre → Recordar → Aplicar → Consolidar*. Prova de fer una jugada errònia: s'ofereix una pista, el botó de solució es desbloqueja i "Per què no funciona?" mostra la refutació calculada per Stockfish.
4. **Exercicis:** banc filtrable per tema i dificultat, amb l'estat de cada exercici.
5. **Tauler i anàlisi:** mou peces, activa el motor, enganxa un PGN amb variants (`1. e4 e5 (1... c5) 2. Nf3 *`), navega amb ← →, gira el tauler i fes clic dret per marcar caselles o dibuixar fletxes.
6. **Progrés:** registre d'intents, rendiment per tema i repassos programats.
7. **Configuració:** tema clar/fosc, idioma, profunditat del motor, punt de vista de l'avaluació, i exportació/importació/esborrat de les dades.

## Tecnologia

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · components d'estil shadcn/ui · chess.js · react-chessboard 5 · Stockfish 19 (WASM, Web Worker) · Vitest · Supabase (Fase 2) · Claude API via Edge Function (Fase 3) · Lichess API (Fase 4).

Les decisions d'arquitectura, el mètode pedagògic, la verificació, els costos i els criteris d'acceptació són a **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. L'esquema de base de dades amb RLS és a `supabase/migrations/0001_init.sql`.

## Fases

- **Fase 1, MVP:** ✅ tauler complet, regles, Stockfish, FEN/PGN, 19 exercicis verificats, registre de resultats i sessió guiada (amb un planificador i repassos espaiats bàsics).
- **Fase 2, personalització:** diagnòstic inicial, Supabase (auth + RLS), historial al núvol, estadístiques ampliades i ELO extern separat per plataforma i ritme.
- **Fase 3, entrenador IA:** Edge Function amb Claude i explicacions basades només en dades del motor. Preguntes socràtiques i anàlisi del raonament escrit.
- **Fase 4, partides:** importació des de Lichess, anàlisi automàtica, classificació d'errors (objectius o interpretatius) i exercicis generats a partir dels errors.

## Llicències

Codi de l'app: privat. Stockfish és GPL-3.0 (no s'inclou al repositori: es copia de `node_modules/stockfish` en instal·lar). chess.js és BSD-2. react-chessboard és MIT.
