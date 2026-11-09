// Alles wat op het toestel wordt bewaard (localStorage): aantal personen, afgevinkte stappen,
// boodschappenlijst, favorieten, notities en hoe vaak een recept is gemaakt. Alle toegang loopt via deze functies, zodat een
// geblokkeerde of beschadigde opslag (privémodus, kapotte JSON) de app nooit laat crashen.
// Wijzig bestaande sleutels niet: dan verliezen gebruikers hun favorieten en notities.

export function readText(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

export function writeText(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}

export function removeKey(key) {
  try { localStorage.removeItem(key); } catch (e) {}
}

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const value = JSON.parse(raw);
    return value == null ? fallback : value;
  } catch (e) { return fallback; }
}

export function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

// Aantal personen per recept
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 12;

export function getServings(slug, base) {
  const v = parseInt(readText('porties-' + slug), 10);
  if (!v || v < MIN_SERVINGS || v > MAX_SERVINGS) return base;
  return v;
}

export function setServings(slug, value) {
  writeText('porties-' + slug, String(value));
}

// Favorieten (lijst met slugs)
const FAV_KEY = 'favorieten';

export function getFavs() {
  const list = readJSON(FAV_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function isFav(slug) { return getFavs().includes(slug); }

export function setFav(slug, on) {
  const favs = getFavs().filter(s => s !== slug);
  if (on) favs.push(slug);
  writeJSON(FAV_KEY, favs);
}

// Eigen notities per recept
const noteKey = (slug) => 'notitie-' + slug;

export function getNote(slug) { return readText(noteKey(slug)) || ''; }

export function hasNote(slug) { return getNote(slug).trim() !== ''; }

export function setNote(slug, text) {
  if (text.trim()) writeText(noteKey(slug), text);
  else removeKey(noteKey(slug));
}

// Hoe vaak een recept is gemaakt: lijst met datums (jjjj-mm-dd), oudste eerst
const cookedKey = (slug) => 'gemaakt-' + slug;

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function getCooked(slug) {
  const list = readJSON(cookedKey(slug), []);
  return Array.isArray(list) ? list.filter(x => typeof x === 'string') : [];
}

export function addCooked(slug, dateISO = todayISO()) {
  const list = getCooked(slug);
  list.push(dateISO);
  list.sort();
  writeJSON(cookedKey(slug), list);
  return list;
}

// Haalt de laatste keer weer weg (bv. per ongeluk op de knop getikt).
export function undoCooked(slug) {
  const list = getCooked(slug);
  list.pop();
  if (list.length) writeJSON(cookedKey(slug), list);
  else removeKey(cookedKey(slug));
  return list;
}
