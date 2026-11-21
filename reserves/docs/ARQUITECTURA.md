# Arquitectura de la plataforma de reserves

Document de referència tècnica. Respon als sis punts inicials del projecte: arquitectura,
base de dades, pantalles, Google Calendar, WhatsApp (amb costos) i pla de l'MVP.

## 1. Arquitectura tècnica

```
 Navegador (client final / empresa / superadmin)
        │  HTTPS
        ▼
 ┌────────────────────────────── Next.js 15 (App Router, TypeScript) ─────────────────────┐
 │  Pàgines React (servidor)   ·  Server Actions (panell)  ·  Rutes API (públic, webhooks) │
 │                                                                                        │
 │  src/lib                                                                               │
 │   ├─ availability/engine.ts   motor de disponibilitat PUR (sense BD ni xarxa)          │
 │   ├─ availability/service.ts  ajunta BD + Google i crida el motor                     │
 │   ├─ booking/service.ts       crear / reprogramar / cancel·lar (transaccions)          │
 │   ├─ google/*                 OAuth, FreeBusy amb memòria cau, cua de sincronització   │
 │   ├─ whatsapp/*               capa de proveïdor, plantilla, recordatoris idempotents   │
 │   ├─ auth/*                   sessions, rols, aïllament per empresa, estat d'accés     │
 │   └─ jobs/tick.ts             una passada del treballador                              │
 └─────────────────────────────┬─────────────────────────────────────────┬──────────────┘
                               │ Prisma                                   │
                               ▼                                          ▼
                    PostgreSQL (font de veritat)               Treballador (npm run worker)
                    · restricció d'exclusió anti-solapament    o cron extern → /api/cron/tick
                    · cues persistents (SKIP LOCKED)                 │
                                                                     ├─▶ Google Calendar API
                                                                     └─▶ WhatsApp Cloud API (Meta)
```

**Decisions i per què**

| Decisió | Motiu |
|---|---|
| Next.js 15 + React 19 + TypeScript | Un sol projecte per a pàgines, API i panell; SSR ràpid al mòbil. Versió estable (la 16 és viable però no aporta res a l'MVP). |
| PostgreSQL + Prisma 6 | Transaccions reals i **restricció d'exclusió** (`btree_gist`) que fa impossibles dues cites solapades encara que arribin alhora. Prisma 6 estable (no la 8 RC). |
| Autenticació pròpia (bcrypt + sessions a BD, galeta httpOnly) | Sense dependències beta; revocable; simple d'auditar. |
| Tailwind CSS v4 + components propis estil shadcn | Mateix resultat visual que shadcn/ui sense dependre del seu CLI/registre. |
| Cues a PostgreSQL (`ReminderJob`, `CalendarSyncJob`) + treballador | Persistents, transaccionals amb la reserva, sense Redis. Escalen a centenars d'empreses; si cal, es pot passar a pg-boss/BullMQ sense canviar el model. |
| Luxon | Zones horàries i canvis d'horari d'estiu correctes. |
| Multiempresa per columna `organizationId` | Cada consulta filtra per l'empresa de la **sessió** (`getOrgContext`), mai per un id del formulari. Provat a `tests/integration/isolation.test.ts`. |

**Desplegament recomanat** (pendent de la teva decisió, vegeu el final):
- Web: Vercel, Railway, Render o un VPS amb Docker.
- BD: PostgreSQL gestionat a la UE (Neon, Supabase, Railway, Scaleway…).
- Treballador: procés permanent (`npm run worker`) o cron cada minut a `/api/cron/tick`.

## 2. Model de base de dades

Esquema complet a `prisma/schema.prisma` (comentat). Entitats:

- **Comptes:** `User`, `Session`, `Organization`, `OrganizationMember` (rol OWNER/ADMIN/PROFESSIONAL), `Subscription` (pla, data de compra, accés fins a, import, referència de pagament; preparada per a Stripe).
- **Catàleg i horaris:** `OrganizationSettings`, `Professional`, `Service`, `ProfessionalService`, `BusinessHours`, `ProfessionalSchedule`, `TimeOff` (vacances, festius, bloquejos; `professionalId` nul = tot el centre).
- **Reserves:** `Customer` (únic per empresa + telèfon), `ConsentRecord` (registre immutable del consentiment amb el text exacte), `Appointment` (inclou `blockStart/blockEnd` amb marges i la restricció d'exclusió), `AppointmentEvent` (historial).
- **Google:** `GoogleCalendarConnection` (tokens xifrats AES-256-GCM), `GoogleCalendarWatch` (canals push), `CalendarBusyCache`, `CalendarSyncJob` (outbox).
- **WhatsApp:** `ReminderJob` (clau d'idempotència única), `WhatsAppMessage`, `WhatsAppSender` (abstracció per tenir números per empresa en el futur).
- **Operació:** `IntegrationErrorLog`, `AuditLog`, `RateLimitBucket`.

Restriccions clau (a la migració SQL):
```sql
EXCLUDE USING gist ("professionalId" WITH =, tsrange("blockStart","blockEnd",'[)') WITH &&)
  WHERE (status IN ('PENDING','CONFIRMED'))
```

## 3. Pantalles

**Client final (sense compte)** — `/reserves/{slug}`
1. Servei (durada, preu) → 2. Professional o "qualsevol" (s'omet si n'hi ha un) → 3. Calendari mensual amb només dies/hores disponibles → 4. Dades + consentiment WhatsApp no premarcat + privacitat → 5. Confirmació amb enllaç segur.
`/cita/{token}`: veure, modificar o cancel·lar segons la política del centre.

**Empresa** — `/panell`
Inici (avui, demà, properes, pendents, cancel·lacions, reserves del mes, estat Google i WhatsApp, posada en marxa) · Calendari (dia per professional / setmana / mes, filtre) · Fitxa de cita (reprogramar, cancel·lar, feta/no presentat, estat de sincronització i recordatori, historial) · Nova cita · Serveis · Professionals (horari, serveis, calendari, accés) · Bloquejos i vacances · Clients (cerca, exportació i supressió RGPD) · Recordatoris · Integracions · Configuració.

**Professional**: inici i calendari només amb les seves cites; bloquejos propis si té permís.

**Superadministració** — `/admin`
Resum (empreses pendents d'accés amb formulari de **Dona accés**, estadístiques globals, accessos que caduquen) · Empreses (filtre per estat, cerca) · Fitxa d'empresa (dades comercials: pla, data de compra, inici, fi, import, factura, notes; suspendre/reactivar; errors; registre d'accions) · Recordatoris globals · Errors d'integració · Estat de la plataforma.

### Cicle d'accés d'una empresa
```
registre ──▶ PENDING_APPROVAL ──(superadmin: Dona accés + dades de compra)──▶ ACTIVE
                 │  pot configurar-ho tot,                                   │
                 │  pàgina pública desactivada                               ├─(data fi superada)─▶ EXPIRED
                 └──(Denega)──▶ SUSPENDED ◀──────────(Suspèn)────────────────┘
```
Només en estat ACTIVE: s'accepten reserves públiques i s'envien recordatoris. SUSPENDED/EXPIRED: el panell queda bloquejat.

## 4. Integració amb Google Calendar

- **Connexió:** OAuth 2.0 (codi d'autorització, `access_type=offline`). Mai es demana la contrasenya. Estat signat amb HMAC lligat a empresa+usuari. Si l'usuari no concedeix els permisos necessaris, es rebutja i es revoca.
- **Permisos mínims:** `calendar.events` (escriure les cites), `calendar.freebusy` (ocupació), `calendar.calendarlist.readonly` (triar calendari), `openid email` (identificar el compte). ⚠ `calendar.events` és un *scope* sensible: per sortir del mode de proves (100 usuaris) cal la **verificació de l'app per Google** (política de privacitat pública, domini verificat, vídeo de demostració). Calcula 2–6 setmanes.
- **Tokens:** xifrats AES-256-GCM; renovació automàtica; `invalid_grant` → connexió REVOKED i avís al panell; desconnectar revoca el token.
- **Crear/modificar/cancel·lar:** cada canvi d'una cita crea una tasca `CalendarSyncJob` dins la mateixa transacció (patró *outbox*). Es processa a l'instant i, si falla, el treballador reintenta (1, 5, 15, 60, 180, 360 min). L'ID d'esdeveniment és **determinista** (`rsv` + hash de la cita) → reintentar mai duplica. Si la cita canvia de professional, s'esborra del calendari antic. En cancel·lar: esborrar o marcar com a cancel·lada i lliure (configurable).
- **Dades a Google:** "Servei · Nom I." + número de reserva i adreça. Sense telèfon, correu ni cognom complet.
- **Estat honest:** la cita es guarda sempre a la BD (font de veritat); `googleSyncStatus` passa a SYNCED només quan Google ha confirmat. Si falla: FAILED, registre d'error, reintent i botó "Reintenta".
- **Ocupació (bloquejos fets a Google):** FreeBusy. Per mostrar disponibilitat s'usa una memòria cau per calendari (TTL 5 min) que **invaliden les notificacions push** (`events.watch`, renovades pel treballador) i la reconciliació periòdica. **Abans de confirmar** una reserva, FreeBusy es consulta **en directe**. Esdeveniments "Lliure" (transparents) no bloquegen. Mai s'importa cap esdeveniment de Google com a reserva.
- **Si Google no respon:** s'usen dades de fins a 30 min; si no n'hi ha, aquell professional no s'ofereix (preferim perdre una franja que crear un conflicte).
- **Zones horàries:** horaris en hora local del centre, instants en UTC, conversions amb Luxon (proves de DST de març i octubre).
- **Push requereix HTTPS públic**; en local funciona amb la reconciliació.

## 5. WhatsApp: solució recomanada i costos

**Recomanació:** WhatsApp Business Platform **Cloud API de Meta directament**, amb **un únic número de la plataforma** a la v1. El codi té una capa `WhatsAppProvider` (fàcil afegir Twilio, 360dialog, etc.) i la taula `WhatsAppSender` per assignar números per empresa més endavant.

- Plantilla `recordatori_cita`, categoria **UTILITY**, en `ca` i `es` (text a `docs/WHATSAPP.md`).
- Només s'envia amb consentiment explícit registrat; mai publicitat.
- Abans d'enviar: cita activa, consentiment, no enviat abans, mateixa data/hora, encara futura, empresa activa.
- Idempotència: clau única `cita + hora + tipus`, reclamació amb `FOR UPDATE SKIP LOCKED` i registre del missatge **abans** de cridar l'API (si el procés mor, no es reenvia a cegues).
- Estats: Pendent, En procés, Enviat, Entregat, Llegit, Error, Cancel·lat, No s'envia. Webhook signat (`X-Hub-Signature-256`).
- Reintents només per errors temporals (fins a 4) i mai a menys d'1 h de la cita.

**Costos previsibles (orientatius, cal verificar a la tarifa oficial de Meta abans de fixar preus):**
- Meta cobra **per missatge de plantilla lliurat**. Per a Espanya, la categoria *utility* es publica al voltant de **0,0166 € + IVA** per missatge (marketing ≈ 0,06 €). Hi ha descomptes per volum.
- Exemple: 1 centre amb 300 cites/mes → ~5 €/mes. 100 centres → ~500 €/mes. Inclou-ho al preu del pla o com a extra per missatge.
- Cloud API directa: sense quota de proveïdor. Amb un BSP (Twilio, 360dialog…) s'hi afegeix un recàrrec per missatge o una quota mensual.
- ⚠ **Número compartit:** el número de la plataforma enviarà en nom de diverses empreses. Abans de producció cal confirmar amb Meta (o el BSP) que aquest ús és acceptable per a la plantilla i el nom visible del compte, i que el missatge identifica clarament el centre. Si no, cal passar a un número per empresa (ja previst al model).

## 6. Pla de l'MVP

| Fase | Contingut | Estat |
|---|---|---|
| 0 | Arquitectura, esquema, decisions | ✅ |
| 1 | Registre, sessions, rols, aïllament per empresa | ✅ |
| 2 | Backoffice de superadmin: donar accés, dades de compra, suspendre, estadístiques, errors | ✅ |
| 3 | Serveis, professionals, horaris, bloquejos, configuració | ✅ |
| 4 | Motor de disponibilitat + reserva pública + gestió per enllaç segur | ✅ |
| 5 | Panell: inici, calendari (dia/setmana/mes), cites manuals, reprogramació, cancel·lació | ✅ |
| 6 | Google Calendar: OAuth, sincronització amb cua, FreeBusy, push, reconciliació | ✅ (cal provar-ho amb credencials reals) |
| 7 | WhatsApp: recordatoris, webhooks, registre | ✅ (cal plantilla aprovada i credencials) |
| 8 | RGPD: consentiments, exportació, supressió, retenció | ✅ |
| 9 | Proves (43), dades de demostració, documentació | ✅ |
| Pilot | Desplegar, verificar app de Google, aprovar plantilla, 2–3 centres reals | ⏳ |

**Fase 2 (preparat, no implementat):** subscripcions amb Stripe (`Subscription.externalId`), pagaments i dipòsits, estadístiques avançades, llista d'espera, reserves recurrents, recordatoris personalitzables, números de WhatsApp per empresa (`WhatsAppSender`), marca avançada, widget incrustable (cal relaxar `X-Frame-Options` per a una ruta), altres idiomes (afegir un diccionari a `src/lib/i18n`).

## Decisions pendents (et toca a tu)

1. **Allotjament i BD** (cost mensual): Vercel + Neon, Railway, o VPS propi.
2. **WhatsApp:** Meta directe (més barat, més tràmit) o un BSP (més car, més suport). Verificar l'ús de número compartit.
3. **Domini** i textos legals (condicions del servei, política de privacitat de la plataforma, contracte d'encàrrec de tractament amb els centres: la plataforma és *encarregada* i el centre *responsable*).
4. **Preus dels plans** i com es repercuteix el cost dels WhatsApp.
5. **Correu transaccional** (recuperar contrasenya, avisos): proveïdor (Postmark, Resend, Brevo…). No inclòs a l'MVP.
