(function () {
  const DEFAULT_SERVINGS = 4;
  const MIN_SERVINGS = 1;
  const MAX_SERVINGS = 12;

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

  function ingredientLabel(item, factor, recipe) {
    if (item.text) return item.text;
    const q = item.qty * factor;
    const qMax = item.qtyMax != null ? item.qtyMax * factor : null;
    let numPart = qMax != null ? `${formatQty(q)}-${formatQty(qMax)}` : formatQty(q);
    if (item.qtyPlus != null) numPart += ` + ${formatQty(item.qtyPlus * factor)}`;
    const parts = [numPart];
    if (item.unit) parts.push(item.unit);
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
  const QTY_RE = new RegExp('(^|[^\\d.,])(' + NUM + ')(?:(\\s*-\\s*|\\s+tot\\s+)(' + NUM + '))?(?=([\\s\\S]{0,60}))', 'g');
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

  function scaleStepText(text, factor, recipe) {
    if (!text || factor === 1) return text;
    const known = ingredientWords(recipe);
    return text.replace(QTY_RE, (match, pre, n1, sep, n2, after) => {
      if (NEVER_SCALE.test(after)) return match;
      // Kijk naar maximaal de eerste twee woorden na het getal (bv. "2 gesnipperde uien").
      const next = after.trim().split(/\s+/).slice(0, 2).map(w => w.toLowerCase().replace(/[^a-zà-ÿ']/g, ''));
      if (!next.some(w => known.has(w))) return match;
      let out = pre + formatQty(parseNum(n1) * factor);
      if (n2) out += sep + formatQty(parseNum(n2) * factor);
      return out;
    });
  }

  function scaleText(text, factor, recipe) {
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

  function servingsKey(slug) { return 'porties-' + slug; }

  // Aantal personen waarvoor het recept in recipes-data.js is uitgeschreven.
  function baseServings(recipe) {
    const n = parseInt(recipe.servings, 10);
    return n > 0 ? n : DEFAULT_SERVINGS;
  }

  function getServings(slug, base) {
    const v = parseInt(localStorage.getItem(servingsKey(slug)), 10);
    if (!v || v < MIN_SERVINGS || v > MAX_SERVINGS) return base;
    return v;
  }

  function setServings(slug, v) {
    localStorage.setItem(servingsKey(slug), String(v));
  }

  function renderServingsControl(container, slug, base, onChange) {
    if (!container) return;
    let servings = getServings(slug, base);
    container.innerHTML = `
      <span class="servings-label">Aantal personen</span>
      <div class="servings-stepper">
        <button type="button" class="servings-btn" id="servingsMinus" aria-label="Minder personen">−</button>
        <span id="servingsValue" class="servings-value">${servings}</span>
        <button type="button" class="servings-btn" id="servingsPlus" aria-label="Meer personen">+</button>
      </div>
    `;
    const valueEl = container.querySelector('#servingsValue');
    const update = (next) => {
      servings = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, next));
      valueEl.textContent = servings;
      setServings(slug, servings);
      onChange(servings / base);
    };
    container.querySelector('#servingsMinus').addEventListener('click', () => update(servings - 1));
    container.querySelector('#servingsPlus').addEventListener('click', () => update(servings + 1));
    onChange(servings / base);
  }

  function renderVideoCard(recipe) {
    const card = document.getElementById('videoCard');
    if (!card) return;
    if (!recipe.videoId) { card.hidden = true; return; }
    card.hidden = false;
    card.href = `https://www.youtube.com/watch?v=${recipe.videoId}`;
    const img = document.getElementById('videoThumb');
    if (img) {
      img.src = `https://img.youtube.com/vi/${recipe.videoId}/hqdefault.jpg`;
      img.alt = `Video thumbnail ${recipe.title}`;
    }
  }

  function initKookinstructies(slug, recipe) {
    document.title = `Kookinstructies – ${recipe.title}`;
    const titleEl = document.getElementById('recipeTitle');
    if (titleEl) titleEl.textContent = `Kookinstructies voor ${recipe.title}`;
    const herkomstEl = document.getElementById('recipeHerkomst');
    if (herkomstEl) {
      herkomstEl.textContent = recipe.herkomst ? `Herkomst: ${recipe.herkomst}` : '';
      if (recipe.origineleNaam) {
        const orig = document.createElement('em');
        orig.textContent = recipe.origineleNaam;
        herkomstEl.append(herkomstEl.textContent ? ' · Origineel: ' : 'Origineel: ', orig);
      }
      if (recipe.bronUrl) {
        const a = document.createElement('a');
        a.href = recipe.bronUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Bekijk origineel recept ↗';
        a.style.color = 'inherit';
        herkomstEl.append(' · ', a);
      }
    }

    renderVideoCard(recipe);

    const ingList = document.getElementById('ingredientsList');
    const stepsList = document.getElementById('stepsList');
    const noteEl = document.getElementById('recipeNote');
    const servingsControl = document.getElementById('servingsControl');

    function renderIngredients(factor) {
      if (!ingList) return;
      ingList.innerHTML = '';
      recipe.ingredients.forEach(item => {
        const li = document.createElement('li');
        li.textContent = ingredientLabel(item, factor, recipe);
        ingList.appendChild(li);
      });
    }

    const stepLabelEls = [];

    if (stepsList) {
      stepsList.innerHTML = '';
      const key = 'stappen-' + slug;
      let state = JSON.parse(localStorage.getItem(key) || '{}');
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'nav-btn reset-steps';
      resetBtn.textContent = '↺ Alle stappen uitvinken';
      const updateReset = () => { resetBtn.hidden = !Object.values(state).some(Boolean); };
      recipe.steps.forEach((text, idx) => {
        const id = 'step-' + (idx + 1);
        const li = document.createElement('li');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = id;
        cb.checked = !!state[id];
        const label = document.createElement('label');
        label.setAttribute('for', id);
        label.textContent = text;
        li.appendChild(cb);
        li.appendChild(label);
        li.classList.toggle('done', cb.checked);
        cb.addEventListener('change', () => {
          state[id] = cb.checked;
          localStorage.setItem(key, JSON.stringify(state));
          li.classList.toggle('done', cb.checked);
          updateReset();
        });
        stepsList.appendChild(li);
        stepLabelEls.push({ el: label, original: text });
      });
      resetBtn.addEventListener('click', () => {
        state = {};
        localStorage.removeItem(key);
        stepsList.querySelectorAll('li').forEach(li => {
          li.classList.remove('done');
          const cb = li.querySelector('input');
          if (cb) cb.checked = false;
        });
        updateReset();
      });
      stepsList.after(resetBtn);
      updateReset();
    }

    function renderSteps(factor) {
      stepLabelEls.forEach(({ el, original }) => {
        el.textContent = scaleText(original, factor, recipe);
      });
    }

    function renderNote(factor) {
      if (!noteEl) return;
      if (recipe.note) {
        noteEl.hidden = false;
        noteEl.innerHTML = `<strong>Notitie:</strong> ${scaleText(recipe.note, factor, recipe)}`;
      } else {
        noteEl.hidden = true;
      }
    }

    if (recipe.ingredients.some(i => i.qty != null)) {
      renderServingsControl(servingsControl, slug, baseServings(recipe), (factor) => {
        renderIngredients(factor);
        renderSteps(factor);
        renderNote(factor);
      });
    } else {
      if (servingsControl) servingsControl.hidden = true;
      renderIngredients(1);
      renderSteps(1);
      renderNote(1);
    }
  }

  function initBoodschappenlijst(slug, recipe) {
    document.title = `Boodschappenlijst – ${recipe.title}`;
    const titleEl = document.getElementById('listTitle');
    if (titleEl) titleEl.textContent = `Checklist – Boodschappenlijst ${recipe.title}`;

    const STORAGE_KEY = slug + '-checklist-v1';
    let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {};
    let customItems = JSON.parse(localStorage.getItem(STORAGE_KEY + '-custom') || '[]');
    const root = document.getElementById('list');
    const progressEl = document.getElementById('progress');
    const servingsControl = document.getElementById('servingsControl');

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateProgress(); }
    function saveCustom() { localStorage.setItem(STORAGE_KEY + '-custom', JSON.stringify(customItems)); }

    function allItems(factor) {
      const base = recipe.ingredients.map(item => ({ id: item.id, label: ingredientLabel(item, factor, recipe) }));
      return base.concat(customItems.map(c => ({ id: c.id, label: c.label })));
    }

    let currentFactor = 1;

    function render() {
      if (!root) return;
      root.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'checklist-card';

      const h2 = document.createElement('h2');
      h2.textContent = recipe.title;

      const addBtn = document.createElement('button');
      addBtn.className = 'btn';
      addBtn.style.float = 'right';
      addBtn.title = 'Eigen item toevoegen';
      addBtn.textContent = '+ Item';
      addBtn.addEventListener('click', () => {
        const label = prompt('Nieuw item toevoegen');
        if (!label) return;
        const id = 'custom-' + Date.now();
        customItems.push({ id, label });
        saveCustom();
        render();
      });

      const ul = document.createElement('ul');
      allItems(currentFactor).forEach(it => {
        const li = document.createElement('li');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = it.id;
        cb.checked = !!state[it.id];
        cb.addEventListener('change', () => {
          state[it.id] = cb.checked;
          li.classList.toggle('done', cb.checked);
          save();
        });
        const lab = document.createElement('label');
        lab.setAttribute('for', it.id);
        lab.textContent = it.label;
        li.classList.toggle('done', cb.checked);
        li.appendChild(cb); li.appendChild(lab);
        ul.appendChild(li);
      });

      card.appendChild(addBtn);
      card.appendChild(h2);
      card.appendChild(ul);
      root.appendChild(card);
      updateProgress();
    }

    function updateProgress() {
      const ids = allItems(currentFactor).map(i => i.id);
      const done = ids.filter(id => state[id]).length;
      if (progressEl) progressEl.textContent = `${done}/${ids.length} afgevinkt`;
    }

    if (recipe.ingredients.some(i => i.qty != null)) {
      renderServingsControl(servingsControl, slug, baseServings(recipe), (factor) => { currentFactor = factor; render(); });
    } else {
      if (servingsControl) servingsControl.hidden = true;
      render();
    }

    const checkAllBtn = document.getElementById('checkAll');
    const uncheckAllBtn = document.getElementById('uncheckAll');
    const resetBtn = document.getElementById('reset');
    const shareBtn = document.getElementById('share');

    function setAll(val) {
      allItems(currentFactor).forEach(i => { state[i.id] = val; });
      save();
      render();
    }

    if (checkAllBtn) checkAllBtn.addEventListener('click', () => setAll(true));
    if (uncheckAllBtn) uncheckAllBtn.addEventListener('click', () => setAll(false));
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (confirm('Alles resetten?')) { state = {}; customItems = []; saveCustom(); save(); render(); }
    });
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const items = allItems(currentFactor);
      const lines = items.map(x => `${state[x.id] ? '[x]' : '[ ]'} ${x.label}`).join('\n');
      const text = `${recipe.title} – Checklist\n\n${lines}`;
      try {
        await navigator.clipboard.writeText(text);
        alert('Checklist gekopieerd naar je klembord!');
      } catch (e) {
        prompt('Kopieer de checklist:', text);
      }
    });
  }

  // Bouwt de receptkaarten op de index uit recipes-data.js (volgorde volgens RECIPES.order).
  // jjjj-mm-dd → dd-mm-jjjj
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (iso || '');
  }

  const SOORT_LABEL = { verbetering: 'Verbetering', fix: 'Fix', onderhoud: 'Onderhoud' };

  // Leest versie.json en toont "vX.Y.Z · bijgewerkt dd-mm-jjjj"; klik opent het wijzigingsoverzicht.
  async function initVersion() {
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

  function initIndex(data) {
    initVersion();

    const grid = document.getElementById('recipeGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const slugs = (data.order || []).filter(s => data.recipes[s])
      .concat(Object.keys(data.recipes).filter(s => !(data.order || []).includes(s)));

    slugs.forEach(slug => {
      const r = data.recipes[slug];
      const card = document.createElement('div');
      card.className = 'card';
      // Zoekveld doorzoekt ook bron en originele naam, zonder dat die op de kaart staan.
      card.dataset.search = [r.title, r.origineleNaam, r.herkomst].filter(Boolean).join(' ');

      const h2 = document.createElement('h2');
      h2.textContent = r.title;
      card.appendChild(h2);

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      if (r.time) {
        const t = document.createElement('span');
        t.className = 'badge';
        t.textContent = `⏱ ${r.time}`;
        meta.appendChild(t);
      }
      if (r.difficultyLabel) {
        const d = document.createElement('span');
        d.className = 'badge' + (r.difficulty ? ' ' + r.difficulty : '');
        d.textContent = r.difficultyLabel;
        meta.appendChild(d);
      }
      card.appendChild(meta);

      [['boodschappenlijst', 'Bekijk Boodschappenlijst'], ['kookinstructies', 'Bekijk Kookinstructies']].forEach(([page, label]) => {
        const a = document.createElement('a');
        a.href = `${slug}_${page}.html`;
        a.className = 'btn';
        a.textContent = label;
        card.appendChild(a);
      });
      grid.appendChild(card);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    if (!window.RECIPES) return;
    if (body.dataset.page === 'index') {
      initIndex(window.RECIPES);
      return;
    }
    const slug = body.dataset.recipe;
    if (!slug) return;
    const recipe = window.RECIPES.recipes[slug];
    if (!recipe) return;
    if (body.dataset.page === 'kook') {
      initKookinstructies(slug, recipe);
    } else if (body.dataset.page === 'lijst') {
      initBoodschappenlijst(slug, recipe);
    }
  });
})();
