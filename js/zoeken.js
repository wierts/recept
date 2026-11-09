// Zoekveld en filters op de startpagina. Filtert de kaarten op zoektekst, keuken, hoofdingrediënt
// en tijd/favorieten, en onthoudt zoekopdracht, filters en scrollpositie zolang de app of het
// tabblad open is, zodat je na een recept weer op dezelfde plek in de lijst terugkomt.
// Moet worden aangeroepen nadat de kaarten en filterknoppen zijn opgebouwd (zie index.js).

const STATE_KEY = 'recepten-index';
const GROUPS = ['keuken', 'hoofd', 'extra'];

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function initZoeken() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  const emptyState = document.getElementById('searchEmpty');

  const filter = () => {
    const q = normalize(searchInput.value.trim());
    const f = document.body.dataset;
    const keuken = f.keuken || '', hoofd = f.hoofd || '', extra = f.extra || '';
    let visible = 0;
    document.querySelectorAll('.grid .card').forEach(card => {
      const haystack = normalize(card.textContent + ' ' + (card.dataset.search || ''));
      const okHoofd = !hoofd || (hoofd === '!Kip' ? card.dataset.hoofd !== 'Kip' : card.dataset.hoofd === hoofd);
      let okExtra = true;
      if (extra === 'fav') okExtra = card.dataset.fav === '1';
      else if (extra) { const m = parseInt(card.dataset.minuten, 10); okExtra = !isNaN(m) && m <= parseInt(extra, 10); }
      const match = (!q || haystack.includes(q)) && (!keuken || card.dataset.keuken === keuken) && okHoofd && okExtra;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    if (emptyState) emptyState.hidden = visible !== 0;
  };

  const saveState = () => {
    try {
      const st = { q: searchInput.value, scroll: window.scrollY };
      GROUPS.forEach(g => { st[g] = document.body.dataset[g] || ''; });
      sessionStorage.setItem(STATE_KEY, JSON.stringify(st));
    } catch (e) {}
  };

  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (e) {}
  if (saved) {
    searchInput.value = saved.q || '';
    GROUPS.forEach(g => {
      const row = document.querySelector(`.chip-row[data-group="${g}"]`);
      if (!row) return;
      const chip = Array.from(row.querySelectorAll('.chip')).find(c => c.dataset.value === (saved[g] || ''));
      if (!chip) return;
      document.body.dataset[g] = saved[g] || '';
      row.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    });
  }

  searchInput.addEventListener('input', filter);
  document.addEventListener('recepten-filter', filter);
  filter();
  if (saved && saved.scroll) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
  window.addEventListener('pagehide', saveState);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveState(); });
}
