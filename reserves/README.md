# Reserves — SaaS de cites online amb Google Calendar i recordatoris per WhatsApp

Plataforma multiempresa: cada negoci té la seva pàgina de reserves, panell, serveis, professionals i horaris.
Les cites se sincronitzen amb Google Calendar i el client rep un recordatori per WhatsApp unes 24 h abans.
Un backoffice de **superadministració** decideix quines empreses tenen accés (quan han comprat l'aplicació).

📐 Arquitectura i decisions: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) · 💬 WhatsApp: [`docs/WHATSAPP.md`](docs/WHATSAPP.md)

## Requisits
- Node.js 20+ (provat amb 22)
- PostgreSQL 14+ (amb `btree_gist`, inclòs a PostgreSQL estàndard)

## Execució local
```bash
cd reserves
cp .env.example .env            # omple DATABASE_URL i ENCRYPTION_KEY (openssl rand -base64 32)
                                # per provar recordatoris sense Meta: WHATSAPP_PROVIDER="log"
npm install
npx prisma migrate deploy       # crea les taules i la restricció anti-solapament
npm run db:seed                 # dades de demostració (opcional)
npm run dev                     # http://localhost:3000
npm run worker                  # en una altra terminal: recordatoris i sincronització
```

Usuaris de demostració (contrasenya `demo-demo-demo`):
| Rol | Correu | On |
|---|---|---|
| Superadministrador | admin@demo.local | `/admin` |
| Empresa (propietària) | maria@demo.local | `/panell` · pàgina pública `/reserves/perruqueria-maria` |
| Professional | jordi@demo.local | `/panell` (només les seves cites) |
| Empresa pendent d'accés | pau@demo.local | per provar "Dona accés" |

Crear el superadministrador real: `npm run superadmin -- tu@domini.com "Nom" 'contrasenya-llarga'`

## Proves
```bash
createdb reserves_test           # BD separada, s'esborra a cada prova
# .env.test amb DATABASE_URL de proves i ENCRYPTION_KEY
DATABASE_URL=… npx prisma migrate deploy
npm test
```
Cobreixen: reserva correcta, franja ocupada, reserves simultànies (només una guanya), durades, diversos professionals,
bloquejos de Google, errors i reintents de sincronització, modificació, cancel·lació, recordatori enviat / no duplicat / cancel·lat /
reprogramat, fallada de l'API de WhatsApp, WhatsApp no configurat, aïllament entre empreses i canvis d'horari d'estiu.

## Desplegament
1. PostgreSQL gestionat (UE). `npx prisma migrate deploy` a cada desplegament.
2. Web: `npm run build && npm start` (Vercel, Railway, Render, Docker…). `APP_URL` amb HTTPS.
3. Treballador: `npm run worker` com a procés permanent **o** un cron cada minut:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://DOMINI/api/cron/tick`
4. Google Cloud: crea el client OAuth (redirecció `https://DOMINI/api/google/oauth/callback`), activa Google Calendar API, configura la pantalla de consentiment i demana la verificació.
5. Meta: segueix `docs/WHATSAPP.md`.
6. `WHATSAPP_PROVIDER=log` està bloquejat en producció; sense credencials, el panell mostra "No configurat" i els recordatoris queden en error (mai es simulen com a enviats).

## Estructura
```
prisma/            esquema, migracions (amb SQL propi), dades de demostració
src/app/           pàgines i API (reserves/, cita/, panell/, admin/, api/)
src/lib/           lògica de negoci (availability, booking, google, whatsapp, auth, i18n, jobs)
src/components/    components de la interfície
scripts/           treballador i creació de superadmin
tests/             unitàries i d'integració (PostgreSQL real)
```
