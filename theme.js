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

  });
})();
