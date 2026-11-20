# Pogo i Dolçaina

Fanzine digital de música en català (i amics) per a fans de l'ska, el punk i el folk festiu: de Fetus a La Ludwig Band, passant per Skatalà, Skalariak, Obrint Pas, La Gossa Sorda, Roba Estesa, Ebri Knight i molts més.

Obre `index.html` al navegador. No cal res més: és un sol fitxer sense dependències (només Google Fonts).

## Què hi ha

- **Grups**: fitxes amb origen, anys, estil, discos, cançons per començar i enllaços per escoltar (Spotify, YouTube, Bandcamp). Cerca, filtres per estil i estat, i botó «Sorprèn-me».
- **Si t'agraden, prova…**: recomanacions segons estil, escena, territori i època.
- **Cronologia**: barres d'activitat de cada grup des de 1985 i les fites clau (naixements, discos, comiats).
- **Mapa**: mapa esquemàtic de la costa amb els pobles d'origen i el recompte per territori.
- **El meu carnet**: marca els grups que estimes i els que has vist en directe, i desbloqueja insígnies. Es desa al navegador (localStorage).

Cada grup té un enllaç propi per compartir: `index.html#grup-fetus`.

## Afegir o corregir grups

Edita la llista `BANDS` dins de `index.html`. Camps: `inici`/`fi` (fi `null` = en actiu), `aprox: true` si les fonts discrepen, `coord: [longitud, latitud]` per al mapa.
