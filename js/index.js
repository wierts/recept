// De startpagina: bouwt de receptkaarten en filterknoppen op uit recipes-data.js
// (volgorde volgens RECIPES.order) en start het zoekveld.
import { getFavs, setFav, hasNote } from './opslag.js';
import { initVersion } from './versie.js';
import { initZoeken } from './zoeken.js';

// "1 uur 15 min" → 75, "1,5 uur" → 90, "30 min" → 30
export function parseMinutes(t) {
  if (!t) return null;
  let total = 0, found = false;
  const h = /(\d+(?:[.,]\d+)?)\s*uur/i.exec(t);
  if (h) { total += parseFloat(h[1].replace(',', '.')) * 60; found = true; }
  const m = /(\d+)\s*min/i.exec(t);
  if (m) { total += parseInt(m[1], 10); found = true; }
  return found ? Math.round(total) : null;
}

function buildCard(slug, r, isFavorite) {
  const card = document.createElement('div');
  card.className = 'card';
  // Zoekveld doorzoekt ook bron, originele naam, keuken en hoofdingrediënt, zonder dat die allemaal op de kaart staan.
  card.dataset.search = [r.title, r.origineleNaam, r.herkomst, r.keuken, r.hoofdingredient].filter(Boolean).join(' ');
  card.dataset.keuken = r.keuken || '';
  card.dataset.hoofd = r.hoofdingredient || '';
  const minutes = parseMinutes(r.time);
  card.dataset.minuten = minutes == null ? '' : String(minutes);
  card.dataset.fav = isFavorite ? '1' : '';

  const heart = document.createElement('button');
  heart.type = 'button';
  heart.className = 'fav-btn';
  const paintHeart = () => {
    const on = card.dataset.fav === '1';
    heart.textContent = on ? '♥' : '♡';
    heart.setAttribute('aria-pressed', on ? 'true' : 'false');
    heart.setAttribute('aria-label', on ? `${r.title} verwijderen uit favorieten` : `${r.title} toevoegen aan favorieten`);
  };
  heart.addEventListener('click', () => {
    const on = card.dataset.fav !== '1';
    card.dataset.fav = on ? '1' : '';
    setFav(slug, on);
    paintHeart();
    document.dispatchEvent(new Event('recepten-filter'));
  });
  paintHeart();
  card.appendChild(heart);

  const h2 = document.createElement('h2');
  h2.textContent = r.title;
  card.appendChild(h2);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const addBadge = (text, cls) => {
    const b = document.createElement('span');
    b.className = 'badge' + (cls ? ' ' + cls : '');
    b.textContent = text;
    meta.appendChild(b);
  };
  if (r.keuken) addBadge(r.keuken, 'keuken');
  if (r.time) addBadge(`⏱ ${r.time}`);
  if (r.difficultyLabel) addBadge(r.difficultyLabel, r.difficulty || '');
  if (hasNote(slug)) addBadge('📝 notitie');
  card.appendChild(meta);

  [['boodschappenlijst', 'Bekijk Boodschappenlijst'], ['kookinstructies', 'Bekijk Kookinstructies']].forEach(([page, label]) => {
    const a = document.createElement('a');
    a.href = `${slug}_${page}.html`;
    a.className = 'btn';
    a.textContent = label;
    card.appendChild(a);
  });
  return card;
}

// Filterknoppen boven de kaarten (keuken, hoofdingrediënt, tijd/favorieten); werken samen met het zoekveld.
function renderFilters(recipes) {
  const box = document.getElementById('filters');
  if (!box) return;
  box.innerHTML = '';
  const tally = (key) => {
    const c = {};
    recipes.forEach(r => { if (r[key]) c[r[key]] = (c[r[key]] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a] || a.localeCompare(b, 'nl'))
      .map(k => ({ value: k, text: `${k} (${c[k]})` }));
  };
  const within = (max) => recipes.filter(r => { const m = parseMinutes(r.time); return m != null && m <= max; }).length;
  const hoofd = tally('hoofdingredient');
  const kipCount = recipes.filter(r => r.hoofdingredient === 'Kip').length;
  if (kipCount) hoofd.push({ value: '!Kip', text: `Zonder kip (${recipes.length - kipCount})` });
  const rows = [
    ['keuken', 'Filter op keuken', tally('keuken')],
    ['hoofd', 'Filter op hoofdingrediënt', hoofd],
    ['extra', 'Filter op tijd of favorieten', [
      { value: 'fav', text: '★ Favorieten' },
      { value: '30', text: `≤ 30 min (${within(30)})` },
      { value: '60', text: `≤ 1 uur (${within(60)})` }
    ]]
  ];
  rows.forEach(([id, label, items]) => {
    if (!items.length) return;
    const row = document.createElement('div');
    row.className = 'chip-row';
    row.dataset.group = id;
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    [{ value: '', text: 'Alle' }].concat(items).forEach(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.value = it.value;
      b.textContent = it.text;
      b.setAttribute('aria-pressed', it.value === '' ? 'true' : 'false');
      b.addEventListener('click', () => {
        document.body.dataset[id] = it.value;
        row.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b ? 'true' : 'false'));
        document.dispatchEvent(new Event('recepten-filter'));
      });
      row.appendChild(b);
    });
    box.appendChild(row);
  });
}

export function initIndex(data) {
  initVersion();

  const grid = document.getElementById('recipeGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const slugs = (data.order || []).filter(s => data.recipes[s])
    .concat(Object.keys(data.recipes).filter(s => !(data.order || []).includes(s)));
  const favs = getFavs();
  slugs.forEach(slug => grid.appendChild(buildCard(slug, data.recipes[slug], favs.includes(slug))));
  renderFilters(slugs.map(s => data.recipes[s]));
  initZoeken();
}
