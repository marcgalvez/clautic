# ClauTIC Quest — Document de disseny

Aquest document recull les cinc peces que es van demanar abans de programar. Tot el que s'hi descriu està implementat en aquest directori.

---

## 1. Mapa de pantalles per rol

Hi ha una sola aplicació. Després d'entrar, cada rol va a la seva pantalla inicial (`/` redirigeix segons el rol).

### Comú
| Ruta | Pantalla |
|---|---|
| `/entrar` | Inici de sessió (usuari o correu + contrasenya). Els alumnes escriuen només el seu usuari. |
| `/activar` | Activació d'un compte amb un **codi d'invitació** (alumnes, famílies i professors). |

### Professor (`/profe`)
| Ruta | Pantalla |
|---|---|
| `/profe` | **Mode Classe**: selector de grup, graella d'alumnes, botons grans de competències, accions ràpides, selecció múltiple, "Tot el grup" i "Desfer". |
| `/profe/assistencia` | Assistència per sessió: "Tots presents" i després les excepcions. En confirmar la sessió s'atorguen els XP. |
| `/profe/missions` | Validació ràpida de missions: tries la missió, marques els alumnes i ho valides. |
| `/profe/equilibri` | Estadístiques del grup i **equilibri de reconeixements** (qui en rep pocs, quines competències queden poc treballades). |
| `/profe/alumne/:id` | Fitxa d'un alumne (trajectòria, competències, reconeixements). |

### Alumne (`/ciutat`)
| Ruta | Pantalla |
|---|---|
| `/ciutat` | **ClauTIC City**: vista isomètrica, plaça central, edificis i barris. La barra superior mostra el nivell, els XP i les ClauCoins. |
| `/ciutat/barri/:id` | Barri ampliat amb les cases dels alumnes. Si toques una casa, la visites. |
| `/ciutat/casa` | **La meva casa**: editor isomètric amb ranures predefinides (teulada, jardí, robot, dron, holograma, energia, LED, porta, façana). |
| `/ciutat/casa/:id` | Visita la casa d'un company (només la pots mirar). |
| `/ciutat/botiga` | Botiga de decoracions. Es paga amb ClauCoins. |
| `/ciutat/museu` | Museu dels Assoliments: les insígnies que tens i les que encara has de desbloquejar. |
| `/ciutat/lab/:linia` | Laboratori de Robòtica, Estudi de Videojocs o Portal Minecraft: missions de cada línia. |
| `/ciutat/competicions` | Centre de Competicions: activitats extraordinàries. |
| `/ciutat/nucli` | Nucli d'energia: missions comunitàries i elements desbloquejats de la plaça. |
| `/ciutat/jo` | El meu perfil: avatar, nivell, últims reconeixements i trajectòria. |

### Família (`/familia`)
| Ruta | Pantalla |
|---|---|
| `/familia` | Tauler clar per a cada fill vinculat (selector si en té més d'un): nivell, XP, assistència, anys a ClauTIC, insígnies, reconeixements recents amb la seva explicació educativa, evolució de les competències, activitats, missions i trajectòria. |
| `/familia/casa/:id` | Visita la casa virtual del fill (només la pot mirar). |
| `/familia/competencies` | Què significa cada competència i per què la reconeixem. |

### Administrador (`/admin`)
| Ruta | Pantalla |
|---|---|
| `/admin` | Estadístiques generals: XP per setmana, assistència, distribució de competències, alumnes poc reconeguts, evolució de grups, missions i activitats. |
| `/admin/alumnes` | Alta, baixa i modificació d'alumnes, grups, any d'inici, codi d'invitació. **Importació CSV/Excel**. |
| `/admin/professors` | Professors i grups assignats. Invitacions. |
| `/admin/families` | Famílies i vinculació amb els fills. Invitacions. Consentiments. |
| `/admin/grups` | Grups R1–R7, V1–V8 i M1–M2 per curs. Activar/desactivar, matrícules i professors. |
| `/admin/cursos` | Cursos acadèmics (curs actual) i barris de la ciutat. |
| `/admin/punts` | Regles de punts (XP i ClauCoins) i accions ràpides. |
| `/admin/competencies` | Les 9 competències: icona, color, descripció, exemples i explicació per a famílies. |
| `/admin/missions` | Missions individuals i comunitàries, amb les seves recompenses. |
| `/admin/insignies` | Insígnies, incloses les d'antiguitat (1, 3, 5, 7 anys…). |
| `/admin/botiga` | Catàleg de decoracions: preu, nivell mínim i objectes exclusius. |
| `/admin/activitats` | Activitats extraordinàries: participants i concessió massiva (participa / col·labora / destaca). |
| `/admin/moviments` | Historial de moviments, correccions, reversions i codis d'invitació. |
| `/admin/invitacions` | Codis d'invitació pendents i targetes imprimibles. |

L'administrador també pot entrar al Mode Classe de qualsevol grup.

---

## 2. Estructura de la base de dades (PostgreSQL / Lovable Cloud)

Fitxers: `supabase/migrations/*.sql`. Totes les taules tenen **RLS activat**. Totes les escriptures passen per funcions `SECURITY DEFINER` que comproven el rol al servidor.

```
auth.users ──1:1── profiles ──1:N── user_roles (admin | teacher | student | family)
                      │
                      ├── teacher_groups ──N:1── groups ──N:1── academic_years
                      │                            │
                      ├── family_students ──┐      └── enrollments ──┐
                      │                     ▼                        ▼
                      └─(user_id)──────── students ◄─────────────────┘
                                            │  (district_id → districts)
     ┌──────────────┬──────────────┬────────┼───────────────┬──────────────┬──────────────┐
point_movements  attendance    student_badges  mission_completions  activity_participants  houses / inventory
 (XP + coins)  (sessions)       (badges)        (missions)         (activities)        (shop_items)
```

| Taula | Contingut |
|---|---|
| `profiles`, `user_roles` | Usuari i rols (taula separada de rols, funció `has_role`). |
| `invitations` | Codis d'activació amb rol, alumne(s) o grups vinculats i data d'ús. |
| `academic_years` | Cursos acadèmics, un marcat com a actual. |
| `groups` | `code` (R1…M2), línia (`robotica`/`videojocs`/`minecraft`), curs, actiu. |
| `teacher_groups` | Quins grups gestiona cada professor. |
| `students` | Nom, any de naixement, **any d'inici a ClauTIC**, barri i parcel·la, avatar, consentiments, compte vinculat. |
| `enrollments` | Matrícules (un alumne pot ser a diversos grups). |
| `family_students` | Una família, diversos fills. |
| `student_history` | Trajectòria importada d'abans de l'app. |
| `competencies` | 9 competències editables: icona, color, descripció, exemples, explicació per a famílies, XP i coins. |
| `quick_actions` | Accions ràpides vinculades a una competència. |
| `point_rules` | Valors configurables (assistència 5, torneig 40, curs 100…). |
| `settings` | Paràmetres globals (finestra antiduplicats, minuts per desfer…). |
| `point_movements` | **Llibre de moviments**: XP i ClauCoins (positius o negatius), origen, professor, grup, competència, `dedupe_key` única, `batch_id`, `undone_at`. Els saldos sempre es calculen a partir d'aquí. |
| `class_sessions`, `attendance` | Sessions i estat d'assistència (present / justificada / injustificada). |
| `badges`, `student_badges` | Insígnies permanents (fites, antiguitat, activitats, missions). |
| `missions`, `mission_completions` | Missions individuals o comunitàries (amb objectiu col·lectiu i desbloqueig de la plaça). |
| `activities`, `activity_participants` | Activitats extraordinàries amb XP per participar, col·laborar i destacar. |
| `districts` | Barris de ClauTIC City. |
| `shop_items`, `inventory`, `houses` | Botiga, inventari i casa (model, colors i ranures). |
| `plaza_unlocks` | Elements de la plaça desbloquejats per fites col·lectives. |
| `audit_log` | Registre de totes les modificacions administratives i de punts. |

**Antiduplicats**: cada toc del professor envia un `client_key` (UUID). El servidor desa `dedupe_key = 'tap:<client_key>:<alumne>'` (única), i a més ignora el mateix professor + alumne + competència en una finestra de 3 s. L'assistència (`att:<sessió>:<alumne>`), les activitats i les compres també tenen claus úniques.

**Saldos**: XP = suma de `xp` dels moviments no desfets; ClauCoins = suma de `coins`. El nivell es deriva dels XP i no es desa mai.

---

## 3. Disseny visual de ClauTIC City

- **Paleta**: vermell corporatiu ClauTIC `#E5213B`, cian `#22D3EE`, violeta `#8B5CF6`, sobre un blau nit suau `#0E1430` → `#1B2350`. És fosc, però no és cyberpunk: el cel té degradat d'alba, hi ha molta vegetació verda menta `#34D399` i les superfícies són clares (blanc gel `#E8F1FF`).
- **Vista isomètrica 2:1 en SVG**, dibuixada a partir de primitives reutilitzables (`IsoBox`, `IsoTile`, cilindres, hologrames, arbres tecnològics). No es fan servir imatges externes: cada casa es genera amb codi a partir de la seva configuració.
- **Plaça central** amb el **Nucli d'energia ClauTIC**: un cristall vermell que levita dins d'anells cian, i que creix i canvia segons les fites comunitàries assolides.
- **Edificis amb funció**:
  - Laboratori de Robòtica: braç robòtic i cúpula.
  - Estudi de Videojocs: pantalla gegant amb píxels animats.
  - Portal Minecraft: arc de blocs amb portal violeta.
  - Centre de Competicions: estadi amb focus.
  - Museu dels Assoliments: columnes i una insígnia hologràfica.
  - Botiga: façana amb un cartell LED.
- **Barris**: anells de parcel·les al voltant de la plaça. Amb 150 alumnes, la vista general mostra cada barri com un bloc compacte de cases en miniatura; si en toques un, s'amplia. Cada barri té el seu color LED.
- **Cases**: 3 models (Cub, Torre, Cúpula) i ranures fixes: teulada (plaques solars, antena, turbina), jardí (arbre tecnològic, flors hologràfiques, font), robot, dron, holograma, energia (bateria, nucli), LED (franja de color), porta i façana.
- **Interfície**: targetes de vidre (*glassmorphism* lleuger), tipografia **Chakra Petch** per als títols i **Inter** per al text, botons grans (≥ 56 px en Mode Classe), icones emoji consistents a cada competència i animacions curtes (pujada de nivell, +XP flotant, desbloqueig).
- **Famílies**: tema clar i sobri, amb la mateixa identitat de color però sense la complexitat de videojoc.

---

## 4. Flux exacte per donar punts en menys de 5 segons

Situació de partida: el professor obre l'app a la tauleta. L'app recorda l'últim grup, i el Mode Classe és la pantalla inicial.

| Pas | Acció | Temps |
|---|---|---|
| 0 | L'app s'obre directament al Mode Classe de l'últim grup (el grup del dia, si coincideix amb l'horari). | 0 s |
| 1 | **Toc 1**: tocar l'avatar de l'alumne. Queda seleccionat (vora cian). Es poden tocar més alumnes per seleccionar-ne diversos. | ~1 s |
| 2 | **Toc 2**: tocar la competència (o una acció ràpida). | ~1 s |
| 3 | El servidor desa el moviment, apareix "+10 XP" sobre l'avatar, la selecció es buida i el botó **Desfer** queda actiu 15 minuts. | < 0,5 s |

- No hi ha confirmacions ni comentaris obligatoris.
- **Actualització optimista**: la UI suma els punts a l'instant i reverteix si el servidor falla.
- **Doble clic**: el botó queda bloquejat mentre la petició és en curs, el `client_key` és únic i el servidor fa servir una finestra de 3 s.
- **Tot el grup**: el botó "Tot el grup" selecciona tots els presents (o tots), i un toc a la competència ho concedeix a tothom.
- **Mode alternatiu** (competència primer): si tens una competència "armada", cada toc a un alumne la concedeix.
- **Desfer**: anul·la tot l'últim lot del professor (`undone_at`) i ho deixa registrat.

---

## 5. Pla de desenvolupament per fases

| Fase | Contingut | Estat |
|---|---|---|
| **1. Gestió educativa** | Autenticació i rols, invitacions, alumnes i grups (R1–R7, V1–V8, M1–M2), importació CSV/Excel, Mode Classe, assistència, sistema XP, desfer i antiduplicats. | ✅ |
| **2. Gamificació** | Nivells, ClauCoins, missions (individuals i comunitàries), insígnies, antiguitat i línia temporal, activitats extraordinàries amb concessió massiva. | ✅ |
| **3. ClauTIC City** | Poble isomètric amb barris, edificis amb funció, cases personalitzables, avatars, botiga, inventari i visites. | ✅ |
| **4. Famílies i analítica** | Portal familiar multi-fill, explicacions pedagògiques, estadístiques per a professorat i administració, eina d'equilibri i informe imprimible. | ✅ |

**Properes passes recomanades**: notificacions push, mode sense connexió per al Mode Classe, editor de casa amb posicions lliures, exportació d'informes en PDF per curs i gestió documental de les autoritzacions signades.

---

## Principis pedagògics aplicats

- Es reconeix **l'esforç i el procés**: 7 de les 9 competències són actituds.
- **No hi ha rànquings** ni comparacions. Les visites a les cases mostren el nom de pila i el nivell, i res més.
- Els punts **no es converteixen en notes**. L'app no té cap camp de qualificació.
- **Antiguitat equilibrada**: les insígnies d'antiguitat són permanents i visibles, però només donen ClauCoins simbòliques (no XP). La corba de nivells és progressiva i els objectes de la botiga depenen del nivell amb llindars baixos, de manera que un alumne nou pot tenir una casa espectacular el primer trimestre.
- **Participar val**: la participació en una activitat té valor propi, i "destaca" només hi suma un extra petit.
- **Dades de menors**: els noms es mostren abreujats als altres alumnes, hi ha consentiments familiars, accés mínim per RLS, registre d'auditoria i cap xat.
