#!/usr/bin/env node
// Maakt de twee paginaschillen per recept (<slug>_boodschappenlijst.html en <slug>_kookinstructies.html)
// uit recipes-data.js en werkt de receptpagina's in de ASSETS-lijst van sw.js bij.
//
//   node tools/genereer.mjs           schrijf de pagina's en sw.js
//   node tools/genereer.mjs --check   alleen controleren, niets schrijven (stopt met foutcode 1 bij verschil)
//
// De bestanden zijn gegenereerd: pas ze niet met de hand aan, maar pas de sjablonen hieronder aan.
// Na een wijziging in ASSETS: CACHE_NAME in sw.js met 1 ophogen.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const alleenControle = process.argv.includes('--check');

const SJABLOON_KOOK = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kookinstructies – @@TITEL@@</title>
<meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" sizes="180x180">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Kookinstructies @@TITEL@@">
<link rel="stylesheet" href="theme.css">
</head>
<body data-recipe="@@SLUG@@" data-page="kook">
<noscript><div style="padding:20px;color:#e5e7eb;background:#1f2937;margin:16px;border-radius:10px;">JavaScript is uitgeschakeld. Zet JavaScript aan om deze pagina te gebruiken.</div></noscript>
  <div class="wrap">
    <div class="page-controls">
      <a href="index.html" class="back-btn">&#8592; Terug naar recepten</a>
      <div class="control-buttons">
        <button id="themeToggle" class="icon-btn" title="Licht/donker thema" type="button">🌓</button>
        <button id="wakeLockBtn" class="wake-btn" type="button">🔆 Voorkom dat scherm slaapt</button>
      </div>
    </div>
    <header>
      <div>
        <h1 id="recipeTitle">Kookinstructies voor @@TITEL@@</h1>
        <p class="subtitle" id="recipeHerkomst"></p>
      </div>
    </header>
    <div class="actions">
      <a href="@@SLUG@@_boodschappenlijst.html" class="nav-btn">🛒 Bekijk boodschappenlijst</a>
    </div>
    <a id="videoCard" href="#" target="_blank" rel="noopener" class="video-card" hidden>
      <img id="videoThumb" src="" alt="">
      <span class="video-card-play">▶</span>
      <span class="video-card-label">Bekijk video</span>
    </a>
    <main>
      <div class="servings-control" id="servingsControl"></div>
      <h2>Ingrediënten</h2>
      <ul id="ingredientsList"></ul>
      <h2>Kookinstructies</h2>
      <ol class="steps" id="stepsList"></ol>
      <div class="note" id="recipeNote" hidden></div>
    </main>
  </div>
<script src="recipes-data.js"></script>
<script type="module" src="js/app.js"></script>
<script src="theme.js" defer></script>
</body>
</html>
`;

const SJABLOON_LIJST = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boodschappenlijst – @@TITEL@@</title>
<meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f4f5f7" media="(prefers-color-scheme: light)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" sizes="180x180">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Boodschappenlijst @@TITEL@@">
<link rel="stylesheet" href="theme.css">
</head>
<body data-recipe="@@SLUG@@" data-page="lijst">
<noscript><div style="padding:20px;color:#e5e7eb;background:#1f2937;margin:16px;border-radius:10px;">JavaScript is uitgeschakeld. Zet JavaScript aan om deze pagina te gebruiken.</div></noscript>
  <div class="wrap">
    <div class="page-controls">
      <a href="index.html" class="back-btn">&#8592; Terug naar recepten</a>
      <div class="control-buttons">
        <button id="themeToggle" class="icon-btn" title="Licht/donker thema" type="button">🌓</button>
      </div>
    </div>
    <header>
      <div>
        <h1 id="listTitle">Checklist – Boodschappenlijst @@TITEL@@</h1>
        <div class="subtitle">Werkt als app op je iPhone. Offline, met lokale opslag.</div>
      </div>
      <div class="checklist-controls">
        <button id="checkAll">Alles aanvinken</button>
        <button id="uncheckAll">Alles uitvinken</button>
        <button id="reset">Reset</button>
        <button id="share">Deel/Exporteer</button>
      </div>
    </header>
    <div class="actions">
      <a href="@@SLUG@@_kookinstructies.html" class="nav-btn">🍳 Bekijk kookinstructies</a>
    </div>
    <div class="servings-control" id="servingsControl"></div>

    <section class="checklist-grid" id="list"></section>
  </div>

  <footer class="checklist-footer">
    <div class="checklist-status">
      <div id="progress">0/0 afgevinkt</div>
      <div class="checklist-tip">Tip: voeg eigen items toe onder de lijst. Toevoegen aan beginscherm via Deel‑icoon → Zet op beginscherm.</div>
    </div>
  </footer>

<script src="recipes-data.js"></script>
<script type="module" src="js/app.js"></script>
<script src="theme.js" defer></script>
</body>
</html>
`;

const vul = (sjabloon, slug, titel) => sjabloon
  .replaceAll('@@SLUG@@', slug)
  .replaceAll('@@TITEL@@', titel);

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'recipes-data.js'), 'utf8'), sandbox);
const data = sandbox.window.RECIPES;
const slugs = Object.keys(data.recipes).sort();

const gewenst = new Map();
for (const slug of slugs) {
  const titel = data.recipes[slug].title;
  gewenst.set(`${slug}_boodschappenlijst.html`, vul(SJABLOON_LIJST, slug, titel));
  gewenst.set(`${slug}_kookinstructies.html`, vul(SJABLOON_KOOK, slug, titel));
}

const verschillen = [];
const schrijf = (bestand, inhoud) => {
  const pad = path.join(root, bestand);
  const huidig = fs.existsSync(pad) ? fs.readFileSync(pad, 'utf8') : null;
  if (huidig === inhoud) return;
  verschillen.push(`${huidig == null ? 'nieuw' : 'gewijzigd'}: ${bestand}`);
  if (!alleenControle) fs.writeFileSync(pad, inhoud);
};

for (const [bestand, inhoud] of gewenst) schrijf(bestand, inhoud);

// Receptpagina's zonder recept in de data (bv. een verwijderd recept) melden we; we verwijderen niets.
for (const f of fs.readdirSync(root)) {
  if (/_(boodschappenlijst|kookinstructies)\.html$/.test(f) && !gewenst.has(f)) verschillen.push(`overbodig (hoort bij geen recept): ${f}`);
}

// sw.js: receptpagina's in ASSETS vervangen door de gewenste, alfabetisch op slug.
const swPad = path.join(root, 'sw.js');
const sw = fs.readFileSync(swPad, 'utf8');
const m = /const ASSETS = (\[[\s\S]*?\]);/.exec(sw);
if (!m) { console.error('sw.js: ASSETS niet gevonden'); process.exit(1); }
const vast = vm.runInNewContext(m[1]).filter(a => !/_(boodschappenlijst|kookinstructies)\.html$/.test(a));
const nieuweAssets = [...vast, ...[...gewenst.keys()].map(f => `./${f}`)];
const blok = '[\n' + nieuweAssets.map(a => `  ${JSON.stringify(a)}`).join(',\n') + '\n]';
const nieuwSw = sw.replace(m[1], () => blok);
if (nieuwSw !== sw) {
  verschillen.push('gewijzigd: sw.js (ASSETS) – verhoog CACHE_NAME');
  if (!alleenControle) fs.writeFileSync(swPad, nieuwSw);
}

if (!verschillen.length) console.log(`✓ ${gewenst.size} pagina's en sw.js zijn up-to-date.`);
else {
  console.log(`${alleenControle ? 'Niet up-to-date' : 'Bijgewerkt'} (${verschillen.length}):`);
  verschillen.forEach(v => console.log('  • ' + v));
  if (alleenControle) { console.log('\nDraai: node tools/genereer.mjs'); process.exit(1); }
}
