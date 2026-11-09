#!/usr/bin/env node
// Controle van de receptensite. Draai dit vóór elke commit:   node tools/check.mjs
// Geen pakketten nodig (alleen Node). Stopt met foutcode 1 als er iets echt mis is;
// waarschuwingen zijn aandachtspunten die de site niet stuk maken.
//
// Controleert: receptdata, paginapaar per recept, offline-cache (sw.js), manifest, versie.json,
// JavaScript-syntax en de rekenfuncties voor het schalen van hoeveelheden.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fout = (m) => errors.push(m);
const let_op = (m) => warnings.push(m);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const git = (...args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return null; }
};
const importJs = (f) => import(pathToFileURL(path.join(root, f)).href);

// ---------------------------------------------------------------- receptdata
let data = null;
try {
  const sandbox = { window: {} };
  vm.runInNewContext(read('recipes-data.js'), sandbox, { filename: 'recipes-data.js' });
  data = sandbox.window.RECIPES;
} catch (e) {
  fout(`recipes-data.js kan niet worden geladen: ${e.message}`);
}

const HOOFDINGREDIENTEN = ['Kip', 'Rundvlees', 'Vis', 'Vegetarisch', 'Overig'];
const MOEILIJKHEID = { easy: 'Makkelijk', medium: 'Gemiddeld', hard: 'Uitdagend' };
const { parseMinutes } = await importJs('js/index.js');
const slugs = data ? Object.keys(data.recipes || {}) : [];

if (data) {
  if (!Array.isArray(data.order)) fout('recipes-data.js: "order" ontbreekt');
  else {
    data.order.forEach(s => { if (!data.recipes[s]) fout(`order bevat "${s}" maar dat recept bestaat niet`); });
    slugs.forEach(s => { if (!data.order.includes(s)) fout(`recept "${s}" staat niet in "order"`); });
    if (new Set(data.order).size !== data.order.length) fout('"order" bevat dubbele recepten');
  }
  const titels = new Map();
  for (const slug of slugs) {
    const r = data.recipes[slug];
    const w = (m) => fout(`${slug}: ${m}`);
    if (!/^[a-z0-9_]+$/.test(slug)) w('slug mag alleen kleine letters, cijfers en _ bevatten');
    if (!r.title || typeof r.title !== 'string') w('title ontbreekt');
    else {
      if (titels.has(r.title)) w(`titel "${r.title}" komt ook voor bij ${titels.get(r.title)}`);
      titels.set(r.title, slug);
    }
    if (!r.keuken || typeof r.keuken !== 'string') w('keuken ontbreekt');
    if (!HOOFDINGREDIENTEN.includes(r.hoofdingredient)) w(`hoofdingredient "${r.hoofdingredient}" is geen van: ${HOOFDINGREDIENTEN.join(', ')}`);
    if (typeof r.herkomst !== 'string' || !r.herkomst) w('herkomst ontbreekt');
    if (parseMinutes(r.time) == null) w(`time "${r.time}" is niet te lezen (bv. "30 min", "1,5 uur", "1 uur 15 min")`);
    if (!MOEILIJKHEID[r.difficulty]) w(`difficulty "${r.difficulty}" moet easy, medium of hard zijn`);
    else if (r.difficultyLabel !== MOEILIJKHEID[r.difficulty]) w(`difficultyLabel moet "${MOEILIJKHEID[r.difficulty]}" zijn bij ${r.difficulty}`);
    if (!Number.isInteger(r.servings) || r.servings < 1) w('servings moet een geheel getal ≥ 1 zijn');
    if (r.videoId != null && !/^[\w-]{11}$/.test(r.videoId)) w(`videoId "${r.videoId}" is geen geldig YouTube-id`);
    if (r.bronUrl != null && !/^https:\/\//.test(r.bronUrl)) w('bronUrl moet met https:// beginnen');
    if (r.note != null && typeof r.note !== 'string') w('note moet tekst of null zijn');

    if (!Array.isArray(r.ingredients) || !r.ingredients.length) w('ingredients ontbreekt of is leeg');
    else {
      const ids = new Set();
      r.ingredients.forEach((i, n) => {
        const label = `ingrediënt ${n + 1}`;
        if (!/^ing-\d+$/.test(i.id || '')) w(`${label}: id "${i.id}" moet er zo uitzien: ing-0, ing-1, …`);
        else if (ids.has(i.id)) w(`${label}: id "${i.id}" komt dubbel voor`);
        ids.add(i.id);
        if (i.text != null) {
          if (typeof i.text !== 'string' || !i.text.trim()) w(`${label}: text is leeg`);
          else if (/^\s*[\d½¼¾⅓⅔⅛]/.test(i.text)) let_op(`${slug}: ${label} ("${i.text}") begint met een getal in vrije tekst en schaalt dus niet mee`);
        } else {
          if (typeof i.qty !== 'number' || !(i.qty > 0)) w(`${label}: qty moet een getal > 0 zijn`);
          if (i.qtyMax != null && !(i.qtyMax > i.qty)) w(`${label}: qtyMax moet groter zijn dan qty`);
          if (i.qtyPlus != null && !(typeof i.qtyPlus === 'number' && i.qtyPlus > 0)) w(`${label}: qtyPlus moet een getal > 0 zijn`);
          if (i.unit != null && typeof i.unit !== 'string') w(`${label}: unit moet tekst of null zijn`);
          if (i.rest != null && typeof i.rest !== 'string') w(`${label}: rest moet tekst of null zijn`);
          if (!i.unit && !i.rest) w(`${label}: heeft geen unit en geen rest`);
        }
      });
    }
    if (!Array.isArray(r.steps) || !r.steps.length) w('steps ontbreekt of is leeg');
    else r.steps.forEach((s, n) => { if (typeof s !== 'string' || !s.trim()) w(`stap ${n + 1} is leeg`); });
  }
}

// ---------------------------------------------------------------- pagina's
// De paginaschillen en de receptpagina's in sw.js worden gegenereerd (node tools/genereer.mjs).
try { execFileSync(process.execPath, [path.join(root, 'tools', 'genereer.mjs'), '--check'], { stdio: 'pipe', encoding: 'utf8' }); }
catch (e) { fout('pagina\'s of sw.js zijn niet up-to-date met recipes-data.js → draai: node tools/genereer.mjs\n      ' + String(e.stdout || e.message).trim().split('\n').slice(0, 6).join('\n      ')); }
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const PAGINA = { boodschappenlijst: 'lijst', kookinstructies: 'kook' };
for (const slug of slugs) {
  for (const [naam, type] of Object.entries(PAGINA)) {
    const f = `${slug}_${naam}.html`;
    if (!exists(f)) { fout(`${f} ontbreekt → draai: node tools/genereer.mjs`); continue; }
    const h = read(f);
    if (!h.includes(`data-recipe="${slug}"`)) fout(`${f}: data-recipe moet "${slug}" zijn`);
    if (!h.includes(`data-page="${type}"`)) fout(`${f}: data-page moet "${type}" zijn`);
    const ander = naam === 'lijst' ? 'kookinstructies' : 'boodschappenlijst';
    if (!h.includes(`href="${slug}_${PAGINA[naam] === 'lijst' ? 'kookinstructies' : 'boodschappenlijst'}.html"`)) fout(`${f}: link naar de andere pagina van dit recept ontbreekt`);
  }
}
for (const f of htmlFiles) {
  const m = /^(.+)_(boodschappenlijst|kookinstructies)\.html$/.exec(f);
  if (m && data && !data.recipes[m[1]]) fout(`${f} hoort bij een recept dat niet in recipes-data.js staat`);
  const h = read(f);
  if (!h.includes('<script src="recipes-data.js"></script>')) fout(`${f}: laadt recipes-data.js niet`);
  if (!h.includes('<script type="module" src="js/app.js"></script>')) fout(`${f}: laadt js/app.js niet als module`);
  if (!h.includes('theme.js')) fout(`${f}: laadt theme.js niet`);
  for (const [, , url] of h.matchAll(/(href|src)="([^"#?]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(url)) continue;
    if (!exists(url)) fout(`${f}: verwijst naar ${url}, dat bestaat niet`);
  }
}
if (exists('index.html')) {
  const h = read('index.html');
  for (const id of ['recipeGrid', 'filters', 'searchInput', 'searchEmpty', 'verBtn', 'versionDialog', 'versionList', 'versionClose']) {
    if (!h.includes(`id="${id}"`)) fout(`index.html: element met id="${id}" ontbreekt (js/ gebruikt dat)`);
  }
  if (!h.includes('data-page="index"')) fout('index.html: <body data-page="index"> ontbreekt');
} else fout('index.html ontbreekt');

// ---------------------------------------------------------------- offline-cache (sw.js)
let assets = [];
const sw = read('sw.js');
const cacheNaam = /const CACHE_NAME = '([^']+)'/.exec(sw)?.[1];
if (!cacheNaam) fout('sw.js: CACHE_NAME niet gevonden');
try {
  const code = /const ASSETS = (\[[\s\S]*?\]);/.exec(sw)?.[1];
  assets = vm.runInNewContext(code);
} catch (e) { fout('sw.js: ASSETS kan niet worden gelezen'); }
const assetPad = (a) => a.replace(/^\.\//, '');
if (new Set(assets).size !== assets.length) fout('sw.js: ASSETS bevat dubbele regels');
for (const a of assets) {
  if (a === './') continue;
  if (!exists(assetPad(a))) fout(`sw.js: ${a} staat in ASSETS maar bestaat niet (de installatie van de app mislukt dan!)`);
}
const nodig = [
  ...htmlFiles, 'theme.css', 'theme.js', 'recipes-data.js', 'versie.json', 'manifest.webmanifest', 'sw.js',
  ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`),
  ...(exists('icons') ? fs.readdirSync(path.join(root, 'icons')).filter(f => f.endsWith('.png')).map(f => `icons/${f}`) : [])
];
for (const f of nodig) {
  if (!assets.map(assetPad).includes(f)) fout(`sw.js: ${f} ontbreekt in ASSETS (werkt dan niet offline)`);
}
// Cache-versie ophogen zodra een bestand van de site is gewijzigd (git nodig; anders overgeslagen).
const gewijzigd = git('status', '--porcelain');
const oudeSw = git('show', 'HEAD:sw.js');
if (gewijzigd != null && oudeSw != null) {
  const oudeNaam = /const CACHE_NAME = '([^']+)'/.exec(oudeSw)?.[1];
  const siteWijziging = gewijzigd.split('\n').filter(Boolean).map(l => l.slice(3).replace(/^"|"$/g, ''))
    .filter(f => !/^(README\.md|CLAUDE\.md|\.gitignore|tools\/|bronnen\/|versie\.json)/.test(f));
  if (siteWijziging.length && oudeNaam === cacheNaam) {
    let_op(`sw.js: CACHE_NAME is nog "${cacheNaam}" terwijl er sitebestanden zijn gewijzigd (${siteWijziging.slice(0, 3).join(', ')}${siteWijziging.length > 3 ? ', …' : ''}). Verhoog het nummer.`);
  }
}

// ---------------------------------------------------------------- manifest en versie
try {
  const mf = JSON.parse(read('manifest.webmanifest'));
  if (mf.start_url !== './' || mf.scope !== './') let_op('manifest.webmanifest: start_url en scope horen "./" te zijn (anders geldt de app voor het hele domein)');
  (mf.icons || []).forEach(i => { if (!exists(i.src)) fout(`manifest.webmanifest: icoon ${i.src} bestaat niet`); });
} catch (e) { fout(`manifest.webmanifest is geen geldige JSON: ${e.message}`); }

try {
  const v = JSON.parse(read('versie.json'));
  const semver = /^\d+\.\d+\.\d+$/;
  const gs = v.geschiedenis || [];
  if (!semver.test(v.versie || '')) fout(`versie.json: versie "${v.versie}" is geen x.y.z`);
  if (!gs.length) fout('versie.json: geschiedenis is leeg');
  else {
    if (gs[0].versie !== v.versie) fout(`versie.json: versie (${v.versie}) hoort gelijk te zijn aan het bovenste item (${gs[0].versie})`);
    if (gs[0].datum !== v.datum) fout('versie.json: datum hoort gelijk te zijn aan de datum van het bovenste item');
    const gezien = new Set();
    gs.forEach((g, n) => {
      if (!semver.test(g.versie || '')) fout(`versie.json: "${g.versie}" is geen x.y.z`);
      if (gezien.has(g.versie)) fout(`versie.json: versie ${g.versie} komt dubbel voor`);
      gezien.add(g.versie);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(g.datum || '')) fout(`versie.json ${g.versie}: datum moet jjjj-mm-dd zijn`);
      if (!['verbetering', 'fix', 'onderhoud'].includes(g.soort)) fout(`versie.json ${g.versie}: soort moet verbetering, fix of onderhoud zijn`);
      if (!g.omschrijving) fout(`versie.json ${g.versie}: omschrijving ontbreekt`);
      (g.commits || []).forEach(c => {
        if (!c.hash && n > 0) fout(`versie.json ${g.versie}: lege commit-hash (alleen het bovenste item mag die nog leeg hebben)`);
        if (c.hash && !/^[0-9a-f]{7,40}$/.test(c.hash)) fout(`versie.json ${g.versie}: hash "${c.hash}" is ongeldig`);
      });
      if (n > 0 && /\(deze versie\)/.test((g.commits || []).map(c => c.titel).join(' '))) fout(`versie.json ${g.versie}: "(deze versie)" hoort alleen bij het bovenste item`);
    });
    const tags = git('tag');
    if (tags != null) {
      const bestaand = new Set(tags.split('\n').filter(Boolean));
      gs.slice(1).forEach(g => { if (!bestaand.has(`v${g.versie}`)) let_op(`git-tag v${g.versie} ontbreekt`); });
    }
  }
} catch (e) { fout(`versie.json is geen geldige JSON: ${e.message}`); }

// ---------------------------------------------------------------- JavaScript-syntax
const jsBestanden = [
  ...fs.readdirSync(root).filter(f => f.endsWith('.js')),
  ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`),
  ...fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.mjs')).map(f => `tools/${f}`)
];
for (const f of jsBestanden) {
  try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); }
  catch (e) { fout(`${f}: syntaxfout\n      ${String(e.stderr || e.message).split('\n').find(l => /Error/.test(l)) || ''}`); }
}

// ---------------------------------------------------------------- schalen
const { ingredientLabel, scaleText, niceMetric } = await importJs('js/schalen.js');
const eq = (naam, gekregen, verwacht) => { if (gekregen !== verwacht) fout(`schalen: ${naam}: verwacht "${verwacht}", kreeg "${gekregen}"`); };
const mini = { ingredients: [{ id: 'ing-0', qty: 1, unit: 'kilo', rest: 'kip' }, { id: 'ing-1', qty: 2, unit: 'eetlepels', rest: 'olie' }, { id: 'ing-2', qty: 250, unit: 'ml', rest: 'bouillon' }] };
const m = (a, b, u) => { const n = niceMetric(a, b, u); return `${n.a}${n.b != null ? '-' + n.b : ''} ${n.unit}`; };
eq('½ kilo', m(0.5, null, 'kilo'), '500 gram');
eq('1500 gram', m(1500, null, 'gram'), '1,5 kilo');
eq('2250 gram', m(2250, null, 'gram'), '2,25 kilo');
eq('¼ liter', m(0.125, null, 'liter'), '125 ml');
eq('62,5 ml', m(62.5, null, 'ml'), '65 ml');
eq('bereik', m(0.5, 1, 'kilo'), '0,5-1 kilo');
eq('label 2x kilo', ingredientLabel(mini.ingredients[0], 2, mini), '2 kilo kip');
eq('label ½x kilo', ingredientLabel(mini.ingredients[0], 0.5, mini), '500 gram kip');
eq('label meervoud', ingredientLabel(mini.ingredients[1], 0.5, mini), '1 eetlepel olie');
eq('stap schaalt', scaleText('Voeg 250 ml bouillon toe en 2 eetlepels olie.', 2, mini), 'Voeg 500 ml bouillon toe en 4 eetlepels olie.');
eq('tijd blijft', scaleText('Bak 10 minuten op 180 graden, 250 ml bouillon.', 2, mini), 'Bak 10 minuten op 180 graden, 500 ml bouillon.');
eq('per blijft', scaleText('Neem 2 eetlepels olie, 1 per persoon.', 2, mini), 'Neem 4 eetlepels olie, 1 per persoon.');

const FACTOREN = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
if (data) {
  for (const slug of slugs) {
    const r = data.recipes[slug];
    if (!Array.isArray(r.ingredients) || !Array.isArray(r.steps)) continue;
    const teksten = r.steps.concat(r.note ? [r.note] : []);
    for (const f of FACTOREN) {
      const uitvoer = [
        ...r.ingredients.map(i => ingredientLabel(i, f, r)),
        ...teksten.map(t => scaleText(t, f, r))
      ];
      for (const t of uitvoer) {
        if (/NaN|undefined|Infinity|null/.test(t)) fout(`${slug}: bij factor ${f} komt "${t.slice(0, 70)}…" uit de schaalfuncties`);
      }
    }
    teksten.forEach((t, n) => { if (scaleText(t, 1, r) !== t) fout(`${slug}: tekst ${n + 1} verandert bij het oorspronkelijke aantal personen`); });
    // Waarschuwing: hoeveelheid in een stap die niet meeschaalt
    r.steps.forEach((t, n) => {
      const heeft = /(?:\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])\s*(?:gram|ml|kilo|liter|eetlepels?|theelepels?)\b(?!\s+per\b)/.test(t);
      if (heeft && scaleText(t, 2, r) === t) let_op(`${slug}: stap ${n + 1} noemt een hoeveelheid die niet meeschaalt met het aantal personen`);
    });
  }
}

// ---------------------------------------------------------------- uitkomst
const paginas = htmlFiles.length;
console.log(`${slugs.length} recepten, ${paginas} pagina's, ${assets.length} bestanden in de offline-cache, ${jsBestanden.length} scripts gecontroleerd.`);
if (warnings.length) { console.log(`\nLet op (${warnings.length}):`); warnings.forEach(w => console.log('  • ' + w)); }
if (errors.length) { console.log(`\nFOUTEN (${errors.length}):`); errors.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log(warnings.length ? '\nGeen fouten, wel aandachtspunten.' : '\n✓ Alles in orde.');
