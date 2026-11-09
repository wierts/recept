// Versienummer op de startpagina: leest versie.json en toont "vX.Y.Z · bijgewerkt dd-mm-jjjj".
// Klik op het nummer opent het wijzigingsoverzicht.

// jjjj-mm-dd → dd-mm-jjjj
export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || '');
}

const SOORT_LABEL = { verbetering: 'Verbetering', fix: 'Fix', onderhoud: 'Onderhoud' };

export async function initVersion() {
  const btn = document.getElementById('verBtn');
  const dialog = document.getElementById('versionDialog');
  const list = document.getElementById('versionList');
  if (!btn) return;
  let info;
  try {
    const resp = await fetch('versie.json', { cache: 'no-store' });
    if (!resp.ok) return;
    info = await resp.json();
  } catch (e) { return; }
  btn.textContent = `v${info.versie} · bijgewerkt ${formatDate(info.datum)}`;
  btn.title = 'Bekijk wijzigingsoverzicht';
  btn.hidden = false;
  if (!dialog || !list) return;
  list.innerHTML = '';
  (info.geschiedenis || []).forEach(g => {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'ver-item-head';
    const v = document.createElement('strong');
    v.textContent = `v${g.versie}`;
    const meta = document.createElement('span');
    meta.className = 'ver-meta';
    meta.textContent = `${formatDate(g.datum)} · ${SOORT_LABEL[g.soort] || g.soort}`;
    head.append(v, meta);
    const p = document.createElement('p');
    p.textContent = g.omschrijving;
    li.append(head, p);
    list.appendChild(li);
  });
  btn.addEventListener('click', () => dialog.showModal());
  const close = document.getElementById('versionClose');
  if (close) close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
}
