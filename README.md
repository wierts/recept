# Recepten

Persoonlijke receptensite met per recept een afvinkbare **boodschappenlijst** en **kookinstructies**. Werkt als app op de iPhone (PWA, ook offline) en past hoeveelheden aan op het aantal personen.

🌐 **https://wierts.github.io/recept/**

## Gebruik

- Open de site in Safari en kies *Deel → Zet op beginscherm* om hem als app te installeren.
- Kies een recept, stel het aantal personen in (1–12) en vink ingrediënten en stappen af. De voortgang wordt lokaal op het toestel bewaard.
- Op de kookpagina houdt de knop 🔆 het scherm aan tijdens het koken.

## Techniek

Statische HTML, CSS en vanilla JavaScript, zonder build-stap. Alle receptinhoud staat in `recipes-data.js`; de pagina's per recept zijn lege schillen die door `recipe.js` gevuld worden. Zie `CLAUDE.md` voor het dataformaat en de stappen om een recept toe te voegen.
