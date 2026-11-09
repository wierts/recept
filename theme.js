(function () {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js');
    });
  }

  const THEME_KEY = 'recepten-theme';
  const THEME_COLORS = { dark: '#0b1220', light: '#f4f5f7' };
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  // Zonder eigen keuze volgt het thema de instelling van het toestel (licht/donker).
  function systemTheme() {
    return systemDark && !systemDark.matches ? 'light' : 'dark';
  }

  function applyTheme(t, remember) {
    document.documentElement.setAttribute('data-theme', t);
    if (remember) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
    // Kleur van de browser-/statusbalk: één meta-tag zonder media-voorwaarde, zodat ook een eigen keuze werkt.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m, i) => { if (i > 0) m.remove(); });
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.removeAttribute('media');
    meta.content = THEME_COLORS[t];
  }

  applyTheme(storedTheme() || systemTheme(), false);
  if (systemDark && systemDark.addEventListener) {
    systemDark.addEventListener('change', () => { if (!storedTheme()) applyTheme(systemTheme(), false); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        // Kies je hetzelfde als het toestel, dan volgt de app het toestel weer.
        if (next === systemTheme()) {
          try { localStorage.removeItem(THEME_KEY); } catch (e) {}
          applyTheme(next, false);
        } else {
          applyTheme(next, true);
        }
      });
    }

    // Wake Lock (voorkomt dat het scherm slaapt tijdens het koken)
    let wakeLock = null;
    const wakeBtn = document.getElementById('wakeLockBtn');
    if (wakeBtn) {
      if (!('wakeLock' in navigator)) {
        wakeBtn.style.display = 'none';
      } else {
        wakeBtn.addEventListener('click', async () => {
          try {
            if (!wakeLock) {
              wakeLock = await navigator.wakeLock.request('screen');
              wakeBtn.textContent = '🔆 Scherm blijft aan (tik om te stoppen)';
              wakeBtn.classList.add('active');
              wakeLock.addEventListener('release', () => {
                wakeBtn.textContent = '🔆 Voorkom dat scherm slaapt';
                wakeBtn.classList.remove('active');
                wakeLock = null;
              });
            } else {
              await wakeLock.release();
              wakeLock = null;
            }
          } catch (err) {
            alert('Deze functie wordt niet ondersteund in deze browser.');
          }
        });
        document.addEventListener('visibilitychange', async () => {
          if (wakeLock !== null && document.visibilityState === 'visible') {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
          }
        });
      }
    }

    // Zoekveld op de receptenindex
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const emptyState = document.getElementById('searchEmpty');
      const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
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
      // Zoekopdracht, filters en scrollpositie onthouden zolang de app/het tabblad open is,
      // zodat je na een recept weer op dezelfde plek in de lijst terugkomt.
      const STATE_KEY = 'recepten-index';
      const groups = ['keuken', 'hoofd', 'extra'];
      const saveState = () => {
        try {
          const st = { q: searchInput.value, scroll: window.scrollY };
          groups.forEach(g => { st[g] = document.body.dataset[g] || ''; });
          sessionStorage.setItem(STATE_KEY, JSON.stringify(st));
        } catch (e) {}
      };
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); } catch (e) {}
      if (saved) {
        searchInput.value = saved.q || '';
        groups.forEach(g => {
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
  });
})();
