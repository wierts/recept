# Recepten

Persoonlijke receptensite met per recept een afvinkbare **boodschappenlijst** en **kookinstructies**. Werkt als app op de iPhone (PWA, ook offline) en past hoeveelheden aan op het aantal personen.

🌐 **https://wierts.github.io/recept/**

## Gebruik

- Open de site in Safari en kies *Deel → Zet op beginscherm* om hem als app te installeren.
- Kies een recept, stel het aantal personen in (1–12) en vink ingrediënten en stappen af. De voortgang wordt lokaal op het toestel bewaard.
- Op de kookpagina houdt de knop 🔆 het scherm aan tijdens het koken.
- Op de startpagina filter je op keuken, hoofdingrediënt, bereidingstijd of favorieten (♡), en zoek je op naam, keuken of bron. Je filters en zoekopdracht blijven staan als je terugkomt uit een recept.
- Bij elk recept kun je eigen notities bewaren (bijvoorbeeld "iets minder chili"). Favorieten en notities staan alleen op het toestel waarop je ze maakt.
- Wijzig je het aantal personen, dan worden hoeveelheden in de lijst én in de stappen netjes omgerekend en afgerond.

## Techniek

Statische HTML, CSS en vanilla JavaScript, zonder build-stap. Alle receptinhoud staat in `recipes-data.js`; de pagina's per recept zijn lege schillen die door de modules in `js/` gevuld worden. Met `node tools/check.mjs` controleer je data, pagina's en offline-cache. Zie `CLAUDE.md` voor het dataformaat en de stappen om een recept toe te voegen.

## Toekomstige features

Ideeën voor later, op volgorde van waarde:

1. **Eén boodschappenlijst voor meerdere recepten.** Kies op de startpagina 2 tot 4 recepten en krijg één lijst, met gelijke ingrediënten (knoflook, rijst, …) bij elkaar. Vraagt om een vaste ingrediëntnaam in `recipes-data.js`, zodat ingrediënten betrouwbaar samengevoegd kunnen worden.
2. **Kookmodus met timers.** Eén stap tegelijk op groot formaat, en bij een stap als "20 minuten sudderen" een knop die een timer start. De timer blijft doorlopen bij het wisselen van stap.
3. **Zoeken op ingrediënt.** Het zoekveld doorzoekt nu naam, bron, keuken en hoofdingrediënt. Straks ook de ingrediënten, zodat "wat kan ik maken met citroen" werkt.
4. **Foto's bij recepten.** Een foto op de kaart en bovenaan het recept (vraagt om eigen foto's).
