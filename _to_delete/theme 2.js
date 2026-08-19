(function () {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js');
    });
  }

  const THEME_KEY = 'recepten-theme';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
  }

  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(cur);
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

    // Afvinkbare kookstappen (per pagina onthouden)
    const stepsList = document.querySelector('ol.steps');
    if (stepsList) {
      const key = 'stappen-' + location.pathname.split('/').pop();
      let state = JSON.parse(localStorage.getItem(key) || '{}');
      stepsList.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.checked = !!state[cb.id];
        cb.closest('li').classList.toggle('done', cb.checked);
        cb.addEventListener('change', () => {
          state[cb.id] = cb.checked;
          localStorage.setItem(key, JSON.stringify(state));
          cb.closest('li').classList.toggle('done', cb.checked);
        });
      });
    }
  });
})();
