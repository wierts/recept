// Hoeveelheden schalen met het aantal personen: ingrediëntenregels, getallen in de kooktekst,
// afronden, eenheden omzetten en enkel-/meervoud. Bevat geen pagina-code (DOM) en is daardoor
// ook los te testen (zie tools/check.mjs).

const DEFAULT_SERVINGS = 4;

const FRAC_MAP = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'],
  [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞']
];

function formatQty(n) {
  if (n == null || isNaN(n)) return '';
  n = Math.round(n * 1000) / 1000;
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);
  let best = null, bestDiff = 1;
  FRAC_MAP.forEach(([val, sym]) => {
    const diff = Math.abs(frac - val);
    if (diff < bestDiff) { bestDiff = diff; best = sym; }
  });
  if (best && bestDiff < 0.06) {
    return (whole > 0 ? whole : '') + best;
  }
  const rounded = Math.round(n * 10) / 10;
  return String(rounded).replace('.', ',');
}

// Aantal personen waarvoor het recept in recipes-data.js is uitgeschreven.
export function baseServings(recipe) {
  const n = parseInt(recipe.servings, 10);
  return n > 0 ? n : DEFAULT_SERVINGS;
}

// Maakt hoeveelheden in gram/ml/kilo/liter leesbaar na het schalen: afronden op logische stappen en
// omzetten tussen eenheden (½ kilo → 500 gram, 1500 gram → 1,5 kilo). Alleen bij een andere portiegrootte
// dan het recept; bij het oorspronkelijke aantal blijft de tekst van het recept ongewijzigd.
const METRIC = new Set(['gram', 'ml', 'kilo', 'liter']);

function roundNice(v) {
  if (v < 10) return Math.round(v * 2) / 2;
  if (v < 20) return Math.round(v);
  if (v < 250) return Math.round(v / 5) * 5;
  return Math.round(v / 25) * 25;
}

function fmtDec(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function niceMetric(q, qMax, unit) {
  const big = unit === 'kilo' || unit === 'liter';
  const mult = big ? 1000 : 1;
  const a0 = q * mult;
  const b0 = qMax != null ? qMax * mult : null;
  const baseUnit = unit === 'kilo' || unit === 'gram' ? 'gram' : 'ml';
  if ((b0 != null ? b0 : a0) >= 1000) {
    // Hele kwarten (1,25 / 1,5 / 1,75) blijven exact, de rest op 100 gram afgerond.
    const f = (x) => fmtDec((x % 250 === 0 ? x : Math.round(x / 100) * 100) / 1000);
    return { a: f(a0), b: b0 != null ? f(b0) : null, unit: baseUnit === 'gram' ? 'kilo' : 'liter' };
  }
  const f = (x) => fmtDec(roundNice(x));
  return { a: f(a0), b: b0 != null ? f(b0) : null, unit: baseUnit };
}

export function ingredientLabel(item, factor, recipe) {
  if (item.text) return item.text;
  const q = item.qty * factor;
  const qMax = item.qtyMax != null ? item.qtyMax * factor : null;
  let numPart = qMax != null ? `${formatQty(q)}-${formatQty(qMax)}` : formatQty(q);
  if (item.qtyPlus != null) numPart += ` + ${formatQty(item.qtyPlus * factor)}`;
  const parts = [numPart];
  let unit = item.unit;
  if (factor !== 1 && item.qtyPlus == null && METRIC.has(unit)) {
    const n = niceMetric(q, qMax, unit);
    parts[0] = n.b != null ? `${n.a}-${n.b}` : n.a;
    unit = n.unit;
  }
  if (unit) parts.push(unit);
  // Getallen in de omschrijving (bv. "(70 gram)", "(of 1 eetlepel olie)") schalen mee, maten in cm niet.
  if (item.rest) parts.push(recipe ? scaleStepText(item.rest, factor, recipe) : item.rest);
  return fixPlurals(parts.join(' ').trim(), factor);
}

// Herschaalt hoeveelheden die letterlijk in de kooktekst genoemd worden (bv. "voeg 250 ml bouillon toe",
// "6 kaffir limoenblaadjes", "½ theelepel zout"), zodat de stappen kloppen met de portie-aanpasser.
// Een getal wordt alleen geschaald als het direct gevolgd wordt door een ingrediënt-eenheid (gram, ml,
// eetlepel, ...) of door een woord dat ook in de ingrediëntenlijst van dit recept voorkomt. Kooktijden
// ("10 minuten"), hoeveelheden per persoon/stuk ("1 per persoon", "225 gram per filet"), temperaturen ("180 graden", "150°C") en afmetingen ("5 cm") worden NOOIT aangepast.
const GLYPHS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
const NUM = '(?:\\d+(?:[.,]\\d+)?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])';
const QTY_RE = new RegExp('(^|[^\\d.,])(' + NUM + ')(?:(\\s*-\\s*|\\s+tot\\s+)(' + NUM + '))?(?:(\\s+)(kilo|liter|gram|ml)\\b)?(?=([\\s\\S]{0,60}))', 'g');
const UNIT_WORDS = new Set(['gram', 'kilo', 'kg', 'ml', 'liter', 'l', 'eetlepel', 'eetlepels', 'el', 'theelepel',
  'theelepels', 'tl', 'tenen', 'teen', 'teentje', 'teentjes', 'kopje', 'kopjes', 'blikje', 'blikjes']);
const NEVER_SCALE = /^\s*(?:minuten|minuut|min\b|uur|uren|seconden|sec\b|graden|°|cm|mm|keer|x\b|dagen|nachten|%|sterren|stemmen|per\b|[a-zà-ÿ]+\s+per\b|\/)/i;
const STOP = new Set(['de', 'het', 'een', 'en', 'of', 'in', 'op', 'met', 'van', 'voor', 'naar', 'tot', 'ca', 'om', 'te',
  'bij', 'aan', 'uit', 'extra', 'plus', 'stuk', 'stukken', 'stukje', 'stukjes', 'grote', 'groot', 'klein', 'kleine', 'verse', 'vers', 'fijn', 'smaak', 'zout']);

function parseNum(str) {
  const m = str.match(/^(\d+(?:[.,]\d+)?)?([½¼¾⅓⅔⅛])?$/);
  if (!m) return NaN;
  return (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? GLYPHS[m[2]] : 0);
}

function words(str) {
  return (str || '').toLowerCase().split(/[^a-zà-ÿ']+/).filter(w => w.length >= 2 && !STOP.has(w));
}

function ingredientWords(recipe) {
  if (recipe._scaleWords) return recipe._scaleWords;
  const set = new Set(UNIT_WORDS);
  recipe.ingredients.forEach(i => {
    if (i.qty == null) return;
    words(i.unit).concat(words(i.rest)).forEach(w => set.add(w));
  });
  recipe._scaleWords = set;
  return set;
}

export function scaleStepText(text, factor, recipe) {
  if (!text || factor === 1) return text;
  const known = ingredientWords(recipe);
  return text.replace(QTY_RE, (match, pre, n1, sep, n2, usp, unit, after) => {
    const rest = (usp || '') + (unit || '') + after;
    if (NEVER_SCALE.test(rest)) return match;
    // Kijk naar maximaal de eerste twee woorden na het getal (bv. "2 gesnipperde uien").
    const next = rest.trim().split(/\s+/).slice(0, 2).map(w => w.toLowerCase().replace(/[^a-zà-ÿ']/g, ''));
    if (!next.some(w => known.has(w))) return match;
    if (unit) {
      const n = niceMetric(parseNum(n1) * factor, n2 ? parseNum(n2) * factor : null, unit);
      return pre + n.a + (n.b != null ? (sep || '-') + n.b : '') + usp + n.unit;
    }
    let out = pre + formatQty(parseNum(n1) * factor);
    if (n2) out += sep + formatQty(parseNum(n2) * factor);
    return out;
  });
}

// Kooktekst of notitie schalen en daarna enkel-/meervoud corrigeren.
export function scaleText(text, factor, recipe) {
  return fixPlurals(scaleStepText(text, factor, recipe), factor);
}

// Zet het woord na een geschaalde hoeveelheid in enkel- of meervoud ("2 eetlepel" → "2 eetlepels",
// "1 theelepels" → "1 theelepel", "2 klein blikje" → "2 kleine blikjes"). Alleen bij factor ≠ 1,
// zodat de oorspronkelijke tekst van het recept ongewijzigd blijft.
const PLURALS = {
  eetlepel: 'eetlepels', theelepel: 'theelepels', teen: 'tenen', teentje: 'teentjes', kopje: 'kopjes',
  blikje: 'blikjes', blik: 'blikken', stuk: 'stukken', stukje: 'stukjes', takje: 'takjes', blaadje: 'blaadjes',
  klontje: 'klontjes', handje: 'handjes', ei: 'eieren', ui: 'uien', citroen: 'citroenen', limoen: 'limoenen',
  sjalot: 'sjalotten', aubergine: 'aubergines', spriet: 'sprieten', kom: 'kommen', kippenpoot: 'kippenpoten'
};
const SINGULARS = Object.fromEntries(Object.entries(PLURALS).map(([a, b]) => [b, a]));
const ADJ = { klein: 'kleine', groot: 'grote' };
const ADJ_SINGULAR = { kleine: 'klein', grote: 'groot' };
const PLURAL_RE = new RegExp('(' + NUM + ')(\\s+)(?:(klein|kleine|groot|grote)(\\s+))?([a-zà-ÿ]+)\\b', 'gi');

function fixPlurals(text, factor) {
  if (!text || factor === 1) return text;
  return text.replace(PLURAL_RE, (match, num, sp1, adj, sp2, word) => {
    const lower = word.toLowerCase();
    if (!PLURALS[lower] && !SINGULARS[lower]) return match;
    const many = parseNum(num) > 1;
    const newWord = many ? (PLURALS[lower] || lower) : (SINGULARS[lower] || lower);
    let newAdj = adj;
    if (adj) newAdj = many ? (ADJ[adj.toLowerCase()] || adj) : (ADJ_SINGULAR[adj.toLowerCase()] || adj);
    return num + sp1 + (adj ? newAdj + sp2 : '') + newWord;
  });
}
