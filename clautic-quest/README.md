# ClauTIC Quest

Plataforma de gamificació educativa amb un poble futurista compartit, **ClauTIC City**, per a una acadèmia de robòtica, videojocs i Minecraft Education. Té quatre rols (administració, professorat, alumnat i famílies) i tota la interfície és en català.

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
  …006_demo_data.sql       configuració inicial + dades fictícies (66 alumnes, 10 setmanes d'historial)
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

## Posada en marxa a Lovable Cloud / Supabase

1. Crea el projecte apuntant a la carpeta `clautic-quest/`.
2. Aplica les migracions de `supabase/migrations/` en ordre.
3. A **Authentication → Providers → Email**, desactiva la confirmació de correu (*auto-confirm*). Els comptes d'alumne fan servir un domini intern.
4. Variables: `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` (Lovable les configura soles).
5. **Per a producció**: elimina `…006_demo_data.sql` (o buida les dades fictícies) i crea el primer compte d'administració amb una invitació:
   ```sql
   insert into invitations (code, role, full_name) values ('ADMIN-INICIAL', 'admin', 'Direcció');
   ```
   Després activa'l des de `/activar`.

Només es poden registrar comptes amb un codi d'invitació vàlid: ho controla el *trigger* `handle_new_user`.

## Desenvolupament local (sense Supabase)

Cal PostgreSQL 16 en local. `dev/local-api.mjs` emula l'autenticació i l'RPC de Supabase amb el mateix rol `authenticated` i les mateixes claims JWT, i `dev/auth_stub.sql` emula l'esquema `auth`.

```bash
npm install
npm run db:reset     # crea la BD "clautic" amb totes les migracions (PGPASSWORD=postgres)
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
