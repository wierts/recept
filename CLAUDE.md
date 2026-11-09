# Recepten – projectcontext

Persoonlijke receptensite van Duco en Maartje: per recept een **boodschappenlijst** (afvinkbare checklist) en **kookinstructies** (afvinkbare stappen), te gebruiken als app op de iPhone (PWA, werkt offline).

- Repo: `github.com/wierts/recept` · lokaal: `~/Documents/GitHub/recept`
- Gehost via GitHub Pages: https://wierts.github.io/recept/
- Puur statisch: HTML + CSS + vanilla JS, geen build-stap, geen frameworks, geen backend.
- Alle tekst in de UI en recepten is Nederlands; eenheden metrisch (gram, ml, eetlepel, theelepel).

## Structuur

| Bestand | Rol |
|---|---|
| `recipes-data.js` | **Enige bron van receptinhoud.** `window.RECIPES = { order: [...], recipes: { <slug>: {...} } }`. `order` = volgorde op de index |
| `recipe.js` | Rendert alles uit de data: de kaarten op de index (+ versieknop), en per recept de portie-aanpasser, schalen van hoeveelheden (ook in staptekst), checklist-opslag, delen |
| `theme.js` | Registreert de service worker, licht/donker-thema (volgt het toestel tot je zelf kiest; past ook de statusbalkkleur aan), wake lock (scherm aan tijdens koken), zoekveld + keukenfilter op de index |
| `theme.css` | Gedeelde stijl voor alle pagina's (index heeft daarnaast eigen inline `<style>`) |
| `index.html` | Schil voor het overzicht (`data-page="index"`); kaarten worden door `recipe.js` uit de data gemaakt |
| `versie.json` | Versienummer, datum en wijzigingsgeschiedenis; getoond als `vX.Y.Z · bijgewerkt dd-mm-jjjj` op de index, klik opent het overzicht |
| `<slug>_boodschappenlijst.html` | Lege schil met `<body data-recipe="<slug>" data-page="lijst">` |
| `<slug>_kookinstructies.html` | Lege schil met `<body data-recipe="<slug>" data-page="kook">` |
| `sw.js` | Service worker, netwerk-eerst met de cache als offline-terugval. `CACHE_NAME = 'recepten-checklist-vNN'` + lijst `ASSETS` |
| `bronnen/` | Originele bronbestanden (PDF's) van recepten; niet gebruikt door de site |
| `manifest.webmanifest`, `icons/` | PWA-instellingen en app-iconen |

## Receptformaat (`recipes-data.js`)

```js
"<slug>": {
  "title": "Kip Korma",
  "keuken": "Indiaas",                            // label op de kaart + filterknop op de index
  "herkomst": "RecipeTin Eats (Nagi Maehashi)",   // bron/kok, getoond als "Herkomst: …"
  "origineleNaam": "Chicken Korma",               // optioneel, originele titel
  "bronUrl": "https://…",                         // optioneel, link naar origineel recept
  "videoId": "shwVCPAxU5E",                       // optioneel, YouTube-id → videokaart
  "time": "1 uur",
  "difficulty": "easy" | "medium" | "hard",
  "difficultyLabel": "Makkelijk" | "Gemiddeld" | "Uitdagend",
  "servings": 4,
  "ingredients": [
    { "id": "ing-0", "qty": 750, "qtyMax": null, "unit": "gram", "rest": "kipdijfilet, in stukken" },
    { "id": "ing-1", "qty": 1, "qtyPlus": 1, "unit": "eetlepel", "rest": "olie" },   // "1 + 1 eetlepel"
    { "id": "ing-14", "text": "Rijst, om te serveren" }                             // vrije tekst, schaalt niet
  ],
  "steps": ["Meng 125 ml yoghurt …", "…"],
  "note": null                                     // optionele notitie onder de stappen
}
```

Afspraken:
- **Slug** = snake_case, gelijk aan de bestandsnaam-prefix en de key in `recipes`.
- `servings` = aantal personen waarvoor het recept is uitgeschreven (standaard 4; ontbreekt het, dan geldt 4). De portie-aanpasser schaalt vanaf dat getal, van 1 t/m 12.
- Ingrediënt-`id`'s (`ing-0`, `ing-1`, …) niet hernummeren bij bestaande recepten: ze zijn de sleutel voor afgevinkte items in localStorage.
- Hoeveelheden in de **staptekst** schalen mee als het getal gevolgd wordt door een eenheid (gram, ml, eetlepel, theelepel, tenen …) of door een woord uit de ingrediëntenlijst. Tijden, temperaturen, maten (minuten, graden, °C, cm) en hoeveelheden "per …" ("1 per persoon", "225 gram per filet") schalen nooit. Hetzelfde geldt voor getallen tussen haakjes in `rest` van een ingrediënt (bv. "(70 gram)"). Bij een andere portiegrootte wordt het woord na de hoeveelheid in enkel- of meervoud gezet (eetlepel/eetlepels, teen/tenen, klein blikje/kleine blikjes). Schrijf hoeveelheden in stappen dus als "250 ml bouillon", tijden als "10 minuten".
- Breuken als ½ ¼ ¾ ⅓ ⅔ ⅛ zijn toegestaan in staptekst.

## Nieuw recept toevoegen – checklist

1. Recept toevoegen aan `recipes-data.js` (object in `recipes` + slug achteraan in `order`).
2. `<slug>_boodschappenlijst.html` en `<slug>_kookinstructies.html` maken door een bestaand paar te kopiëren en `data-recipe`, `<title>`, `apple-mobile-web-app-title`, h1 en de onderlinge link aan te passen.
3. De kaart op de index verschijnt vanzelf (titel, `keuken`, `time`, `difficulty`/`difficultyLabel` uit de data). Gebruik bij `keuken` bij voorkeur een bestaande waarde (Indiaas, Thais, Chinees, Indonesisch, Italiaans, Grieks, Frans, Spaans, Amerikaans, Aziatisch), zodat de filterknoppen overzichtelijk blijven.
4. In `sw.js` beide pagina's aan `ASSETS` toevoegen en `CACHE_NAME` met 1 ophogen (anders zien geïnstalleerde apps de wijziging niet).
5. Nieuwe versie in `versie.json` (zie hieronder).
6. Controleren in de browser: index, beide pagina's, portie-aanpasser (bv. 2 en 6 personen), staptekst schaalt correct, licht/donker.
7. Commit + annotated tag (zie hieronder).

Bij elke wijziging `CACHE_NAME` in `sw.js` ophogen, zodat oude caches worden opgeruimd.

## Versienummering

Zelfde werkwijze als de Wijnkelder- en facturen-app. Elke commit is een eigen versie (semver) met een annotated tag.
- Nieuwe recepten of functies: `x.Y.0` (na .9 komt .10). Fix: `x.y.Z`. Onderhoud zonder effect voor gebruikers: `x.y.Z`, soort `onderhoud`. Een grote omslag `X.0.0` alleen als Duco dat zegt.
- De historie tot en met v1.3.1 is achteraf in mijlpalen genummerd (0.1.0 = eerste versie maart 2026, 1.0.0 = centrale receptdata augustus 2026). Alle mijlpalen hebben een annotated tag op hun laatste commit.
- `versie.json` bij elke wijziging bijwerken:
  1. Bovenaan `geschiedenis` een item met `versie`, `datum` (jjjj-mm-dd), `soort` (verbetering|fix|onderhoud), `omschrijving` (korte Nederlandse zin voor gebruikers), `commits: [{hash: "", datum, titel: "… (deze versie)"}]`.
  2. Top-level `versie` en `datum` bijwerken.
  3. Bij de vorige versie de lege hash invullen (`TZ=Europe/Amsterdam git show -s --date=format-local:'%Y-%m-%d %H:%M' --format='%h %ad' <hash>`) en "(deze versie)" uit de titel halen.
  4. Valideren: `python3 -c "import json;json.load(open('versie.json'))"`.
- Commit en tag in één keten, met naam/e-mail van de vorige commit:
  ```
  set -e
  N="$(git log -1 --format=%an)"; E="$(git log -1 --format=%ae)"
  git add <bestanden>
  git -c user.name="$N" -c user.email="$E" commit -F -
  git -c user.name="$N" -c user.email="$E" tag -a vX.Y.Z -m "vX.Y.Z – <omschrijving>"
  ```
- Commitbericht: `vX.Y.Z – <titel>` + opsomming, in het Nederlands. Alleen de gewijzigde bestanden stagen, nooit `git add -A`.
- Claude pusht nooit; Duco pusht via GitHub Desktop (annotated tags gaan mee). Gepushte commits niet amenden of hertaggen.

## Werkwijze met Claude

- Antwoord en commit-berichten in het Nederlands.
- Vraag eerst akkoord voordat je bestanden wijzigt of commit. Pushen doet Duco zelf.
- Vertaal Engelstalige recepten naar Nederlands, reken om naar metrische eenheden (cups → ml/gram, °F → °C, oz → gram) en schaal naar 4 personen. Bewaar de originele titel in `origineleNaam` en de bron in `herkomst`/`bronUrl`.
- Geen externe libraries of build-tools introduceren zonder overleg.

## Bekende aandachtspunten

- Geen openstaande punten.
