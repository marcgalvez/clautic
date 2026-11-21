# SOLC · vinils, punk i intercanvi

App web per a col·leccionistes de vinils de punk, rock, hardcore, post-punk i garage.
Estètica de fanzine fotocopiat: cinta adhesiva, lletres retallades, semitons i gra de xerox.

## Què fa

- **La meva caixa**: la teva col·lecció. Cada disc té una portada generada per codi (única per a cada disc).
  Marca els que vols canviar, cerca i filtra per gènere, afegeix-ne de nous.
- **Giradiscs que sona**: posa un disc al plat i gira, el braç baixa, l'agulla espetega i comença a sonar música generada en directe a l'app (Web Audio): guitarra distorsionada, baix i bateria. Cada disc té el seu tema: el tempo, el to, els acords i el ritme surten del disc i del gènere (punk ràpid, hardcore, post-punk amb guitarra neta i eco, grunge fluix-fort…). Amb vúmetre animat.
- **Intercanvi**: discos que ofereixen altres col·leccionistes. Etiqueta **MATCH!** quan tenen una cosa que vols i volen una cosa que tens.
- **Desitjos**: la teva llista de cerca; t'avisa si algú té el disc.
- **Tractes**: proposa un canvi triant quin disc dones. L'altra persona respon (de moment simulat) i, si accepta, els discos es mouen de caixa.

Les dades es guarden al navegador (localStorage).

## Com obrir-la

No cal instal·lar res: obre `index.html` al navegador. Sense Spotify, cada disc sona amb el tema generat per l'app.

## Connectar Spotify (cançons senceres dins l'app)

SOLC fa servir el Web Playback SDK de Spotify: el navegador es converteix en un dispositiu
Spotify ("SOLC giradiscs") i els discos sonen sencers dins l'app. Cal **Spotify Premium**.

1. **Publica l'app amb GitHub Pages**: al repositori, *Settings → Pages → Build and deployment →
   Deploy from a branch*, tria la branca i la carpeta `/ (root)`. L'adreça serà
   `https://<usuari>.github.io/clautic/`.
2. **Crea una app a Spotify**: <https://developer.spotify.com/dashboard> → *Create app*.
   - *Redirect URIs*: l'adreça exacta de l'app (p. ex. `https://<usuari>.github.io/clautic/`).
     Per provar en local: `http://127.0.0.1:8000/` (Spotify no accepta `localhost`).
   - Marca *Web API* i *Web Playback SDK*.
   - A *User Management* afegeix els correus dels comptes de Spotify que la faran servir
     (en mode desenvolupament Spotify permet fins a 5 usuaris).
3. Copia el **Client ID** i posa'l a `config.js` (així ja el té tothom), o enganxa'l des del botó
   **Connecta Spotify** de l'app.
4. Clica **Connecta Spotify**, accepta els permisos i ja està: posa un disc al plat.

Si un disc no és a Spotify, o no hi ha connexió, sona la versió generada per SOLC.
El Client ID no és secret (l'inici de sessió fa servir PKCE, sense servidor ni contrasenyes guardades).

## Properes passes possibles

- Portades reals dels discos des de Spotify o Discogs.
- Portades reals i dades des de l'API de Discogs.
- Backend amb usuaris reals, xat entre col·leccionistes i mapa de botigues/concerts.

## Pogo i Dolçaina

Fanzine digital d'ska, punk, folk i rock (Països Catalans, Euskal Herria, resta de l'Estat i internacional) a la carpeta [`pogo/`](pogo/). Web: https://marcgalvez.github.io/clautic/pogo/


---

## Altres projectes del repositori

- **[`reserves/`](reserves/)** — SaaS de reserves online amb Google Calendar i recordatoris per WhatsApp (Next.js + PostgreSQL).
