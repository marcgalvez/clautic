# ClauTIC Quest

Plataforma de gamificació educativa amb un poble futurista compartit, **ClauTIC City**, per a una acadèmia de robòtica, videojocs i Minecraft Education. Té quatre rols (administració, professorat, alumnat i famílies) i tota la interfície és en català.

> 🌐 **App real**: https://marcgalvez.github.io/clautic/clautic-quest-app/ · 🧪 **Demo**: https://marcgalvez.github.io/clautic/clautic-quest-demo/
>
> 📐 El disseny previ (mapa de pantalles, base de dades, disseny visual, flux de 5 segons i fases) és a [`docs/DISSENY.md`](docs/DISSENY.md).

## Què inclou

| Fase | Funcionalitats |
|---|---|
| **1 · Gestió educativa** | Autenticació per invitació i 4 rols, alumnes i grups (R1–R7, V1–V8, M1–M2), importació CSV/Excel, **Mode Classe** (dos tocs, sense confirmacions, selecció múltiple, tot el grup, desfer i mode ràfega), assistència ràpida amb XP automàtics, antiduplicats. |
| **2 · Gamificació** | XP i nivells, ClauCoins, missions individuals i comunitàries (fites col·lectives que desbloquegen elements de la plaça), insígnies automàtiques i manuals, antiguitat amb línia temporal, activitats extraordinàries amb concessió massiva (participa / col·labora / destaca). |
| **3 · ClauTIC City** | Poble isomètric SVG amb plaça, nucli d'energia i edificis amb funció, barris que creixen sols, cases personalitzables (3 models i 9 ranures), avatars, botiga, inventari i visites només de lectura. |
| **4 · Famílies i analítica** | Portal familiar multi-fill amb explicacions pedagògiques, evolució de competències, trajectòria i informe imprimible. Estadístiques d'acadèmia i de grup, i eina d'**equilibri de reconeixements**. |

## Arquitectura

- **Frontend**: React 18, Vite, TypeScript i Tailwind (l'stack de Lovable). La ciutat són gràfics SVG generats per codi (`src/components/iso.tsx`, `House.tsx`, `City.tsx`), sense imatges externes.
- **Backend**: PostgreSQL (Lovable Cloud / Supabase). Totes les dades passen per **funcions RPC `SECURITY DEFINER`** que comproven el rol al servidor, i totes les taules tenen **RLS**. Les funcions internes (`_award`, `_give_badge`…) no es poden cridar des del client.
- **Llibre de moviments únic** (`point_movements`): els saldos d'XP i de ClauCoins es calculen sempre a partir d'aquí, amb `dedupe_key` única (doble clic), `batch_id` (desfer) i `undone_at` (anul·lacions auditades).

```
supabase/migrations/
  …001_schema.sql          taules i índexs
  …002_security.sql        funcions de permisos + polítiques RLS
  …003_core_functions.sql  nivells, concessió de punts, desfer, assistència, missions, alta per invitació
  …004_student_family.sql  tauler de l'alumne, ciutat, botiga, cases, informes, estadístiques de grup
  …005_admin.sql           administració, importació, activitats, estadístiques, permisos d'execució
  …006_initial_config.sql  configuració inicial: curs, barris, grups, competències, punts, botiga, insígnies, missions
  …007_remove_demo_accounts.sql  seguretat: elimina comptes de demo si una versió antiga els havia creat
dev/demo_data.sql          dades fictícies (66 alumnes, comptes de demo): NOMÉS per a la demo i les proves locals
```

## Comptes de demostració

La contrasenya de tots els comptes és `clautic2026`. A la pantalla d'inici hi ha botons d'accés ràpid.

| Rol | Usuari |
|---|---|
| Administració | `admin@clautic.cat` |
| Professora (R1–R4, V1) | `anna@clautic.cat` |
| Professor (V2–V8, M1–M2) | `marc@clautic.cat` |
| Professor (R5–R7) | `jordi@clautic.cat` |
| Alumne veterà | `nil` |
| Alumna nova | `laia` |
| Alumnes | `pau`, `julia` |
| Família (Nil i Laia) | `familia@clautic.cat` |

Els alumnes entren només amb el seu **nom d'usuari**. Internament es fa servir `usuari@alumnes.clautic.app`, de manera que no cal que tinguin correu.

## Posada en marxa amb Supabase (base de dades real)

Les migracions creen una instal·lació **neta**: tota la configuració, però cap alumne ni cap compte de demo.

1. **Integració GitHub**: a Supabase, *Project Settings → Integrations → GitHub*, connecta el repositori i posa **Supabase directory = `clautic-quest`**. Activa **Deploy to production** amb la branca `master`. Les migracions s'apliquen soles a cada canvi a `master`.
2. **Autenticació**: a *Authentication → Sign In / Providers → Email*, desactiva **Confirm email** (els alumnes no tenen correu).
3. **Primer administrador**: a *SQL Editor*, crea una invitació amb un codi secret que només sàpigues tu:
   ```sql
   insert into public.invitations (code, role, full_name) values ('EL-TEU-CODI-SECRET', 'admin', 'Direcció');
   ```
   Després, a l'app, ves a **Activa el teu compte**, escriu aquest codi i tria el teu correu i la teva contrasenya. Des del panell d'administració ja pots importar alumnes i convidar professors i famílies.
4. **Frontend**: `npm run build:pages` compila l'app real a `../clautic-quest-app/` (GitHub Pages) amb els valors de `.env.pages` (`VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`, que són públics; la seguretat la fa RLS).

Només es poden registrar comptes amb un codi d'invitació vàlid: ho controla el *trigger* `handle_new_user`.

## Versió de demostració (sense servidor)

`npm run build:demo` genera una versió estàtica a `../clautic-quest-demo/`, preparada per a GitHub Pages. Tota la base de dades (les mateixes migracions, RLS i funcions) s'executa **dins del navegador** amb PostgreSQL en WebAssembly ([PGlite](https://pglite.dev)), i les dades es guarden a IndexedDB. El primer cop triga uns 5 segons a construir ClauTIC City.

- Les dades són fictícies i es guarden **només en aquell navegador**: no es comparteixen entre dispositius.
- El botó groc **🧪 DEMO** (a baix a l'esquerra) permet tornar la demo a l'estat inicial.
- `npm run dev:demo` executa la demo en mode de desenvolupament.

## Desenvolupament local (sense Supabase)

Cal PostgreSQL 16 en local. `dev/local-api.mjs` emula l'autenticació i l'RPC de Supabase amb el mateix rol `authenticated` i les mateixes claims JWT, i `dev/auth_stub.sql` emula l'esquema `auth`.

```bash
npm install
npm run db:reset     # BD "clautic" amb migracions + dades de demo (NO_DEMO=1 per a una BD neta)
npm run db:test      # 53 proves de servidor: permisos, RLS, antiduplicats, desfer, assistència, botiga…
npm run dev:api      # API local a :54321
npm run dev          # app a :8080 (fa servir .env.local)
```

## Seguretat i dades de menors

- **RLS** a totes les taules. Un alumne només veu les seves dades, i una família només les dels fills vinculats.
- A la ciutat només es mostra el nom de pila, la inicial del cognom, el nivell i la casa. No hi ha xat, missatgeria ni rànquings.
- Les autoritzacions familiars i d'imatge es registren per alumne. A la gestió de famílies, un avís marca els fills que encara no tenen l'autorització signada.
- L'**auditoria** (`audit_log`) registra totes les correccions, anul·lacions, importacions i canvis de configuració.
- Els punts **no són notes**: l'app no té cap camp de qualificació.
- La importació d'Excel fa servir la biblioteca `xlsx` (SheetJS 0.18), que només carrega l'administració i només processa fitxers que puja la mateixa administració.
