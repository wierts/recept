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

  function niceMetric(q, qMax, unit) {
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

  function ingredientLabel(item, factor, recipe) {
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

  function scaleStepText(text, factor, recipe) {
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

    // Favoriet-knop naast de link naar de boodschappenlijst.
    const actions = document.querySelector('.actions');
    if (actions) {
      const fb = document.createElement('button');
      fb.type = 'button';
      fb.className = 'nav-btn fav-toggle';
      const paintFav = () => {
        const on = isFav(slug);
        fb.textContent = on ? '♥ Favoriet' : '♡ Favoriet';
        fb.setAttribute('aria-pressed', on ? 'true' : 'false');
      };
      fb.addEventListener('click', () => { setFav(slug, !isFav(slug)); paintFav(); });
      paintFav();
      actions.appendChild(fb);
    }

    // Eigen notities bij het recept, bewaard op dit toestel.
    const mainEl = document.querySelector('main');
    if (mainEl) {
      const wrap = document.createElement('section');
      wrap.className = 'my-notes';
      const h = document.createElement('h2');
      h.textContent = 'Mijn notities';
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = 'Bijvoorbeeld: iets minder chili, of 10 minuten langer sudderen…';
      ta.setAttribute('aria-label', 'Mijn notities bij dit recept');
      try { ta.value = localStorage.getItem(noteKey(slug)) || ''; } catch (e) {}
      ta.addEventListener('input', () => {
        try {
          if (ta.value.trim()) localStorage.setItem(noteKey(slug), ta.value);
          else localStorage.removeItem(noteKey(slug));
        } catch (e) {}
      });
      const hint = document.createElement('p');
      hint.className = 'my-notes-hint';
      hint.textContent = 'Wordt bewaard op dit toestel.';
      wrap.append(h, ta, hint);
      mainEl.appendChild(wrap);
    }

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
      return base.concat(customItems.map(c => ({ id: c.id, label: c.label, custom: true })));
    }

    let currentFactor = 1;

    function render() {
      if (!root) return;
      root.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'checklist-card';

      const h2 = document.createElement('h2');
      h2.textContent = recipe.title;

      // Eigen item toevoegen via een invoerveld onder de lijst (geen pop-up).
      const addForm = document.createElement('form');
      addForm.className = 'add-item';
      const addInput = document.createElement('input');
      addInput.type = 'text';
      addInput.placeholder = 'Eigen item toevoegen…';
      addInput.setAttribute('aria-label', 'Eigen item toevoegen');
      addInput.enterKeyHint = 'done';
      const addBtn = document.createElement('button');
      addBtn.type = 'submit';
      addBtn.className = 'btn';
      addBtn.textContent = '+ Toevoegen';
      addForm.append(addInput, addBtn);
      addForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const label = addInput.value.trim();
        if (!label) return;
        customItems.push({ id: 'custom-' + Date.now(), label });
        saveCustom();
        render();
        const again = root.querySelector('.add-item input');
        if (again) again.focus();
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
        if (it.custom) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'remove-item';
          del.setAttribute('aria-label', `${it.label} verwijderen`);
          del.textContent = '✕';
          del.addEventListener('click', () => {
            customItems = customItems.filter(c => c.id !== it.id);
            delete state[it.id];
            saveCustom();
            save();
            render();
          });
          li.appendChild(del);
        }
        ul.appendChild(li);
      });

      card.appendChild(h2);
      card.appendChild(ul);
      card.appendChild(addForm);
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

    function flash(btn, msg) {
      const old = btn.textContent;
      btn.textContent = msg;
      setTimeout(() => { btn.textContent = old; }, 1800);
    }

    if (checkAllBtn) checkAllBtn.addEventListener('click', () => setAll(true));
    if (uncheckAllBtn) uncheckAllBtn.addEventListener('click', () => setAll(false));
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (confirm('Alles resetten?')) { state = {}; customItems = []; saveCustom(); save(); render(); }
    });
    if (shareBtn) shareBtn.addEventListener('click', async () => {
      const items = allItems(currentFactor);
      const lines = items.map(x => `${state[x.id] ? '[x]' : '[ ]'} ${x.label}`).join('\n');
      const text = `${recipe.title} – Boodschappenlijst\n\n${lines}`;
      // Op iPhone/iPad het deelmenu (WhatsApp, Berichten, Notities…); anders naar het klembord.
      if (navigator.share) {
        try {
          await navigator.share({ title: `${recipe.title} – Boodschappenlijst`, text });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        flash(shareBtn, 'Gekopieerd ✓');
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

  const FAV_KEY = 'favorieten';

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; }
  }

  function isFav(slug) { return getFavs().includes(slug); }

  function setFav(slug, on) {
    const favs = getFavs().filter(s => s !== slug);
    if (on) favs.push(slug);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
  }

  function noteKey(slug) { return 'notitie-' + slug; }

  function hasNote(slug) {
    try { return !!(localStorage.getItem(noteKey(slug)) || '').trim(); } catch (e) { return false; }
  }

  // "1 uur 15 min" → 75, "1,5 uur" → 90, "30 min" → 30
  function parseMinutes(t) {
    if (!t) return null;
    let total = 0, found = false;
    const h = /(\d+(?:[.,]\d+)?)\s*uur/i.exec(t);
    if (h) { total += parseFloat(h[1].replace(',', '.')) * 60; found = true; }
    const m = /(\d+)\s*min/i.exec(t);
    if (m) { total += parseInt(m[1], 10); found = true; }
    return found ? Math.round(total) : null;
  }

  function initIndex(data) {
    initVersion();

    const grid = document.getElementById('recipeGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const slugs = (data.order || []).filter(s => data.recipes[s])
      .concat(Object.keys(data.recipes).filter(s => !(data.order || []).includes(s)));
    const favs = getFavs();

    slugs.forEach(slug => {
      const r = data.recipes[slug];
      const card = document.createElement('div');
      card.className = 'card';
      // Zoekveld doorzoekt ook bron, originele naam, keuken en hoofdingrediënt, zonder dat die allemaal op de kaart staan.
      card.dataset.search = [r.title, r.origineleNaam, r.herkomst, r.keuken, r.hoofdingredient].filter(Boolean).join(' ');
      card.dataset.keuken = r.keuken || '';
      card.dataset.hoofd = r.hoofdingredient || '';
      const minutes = parseMinutes(r.time);
      card.dataset.minuten = minutes == null ? '' : String(minutes);
      card.dataset.fav = favs.includes(slug) ? '1' : '';

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
      grid.appendChild(card);
    });
    renderFilters(slugs.map(s => data.recipes[s]));
  }

  // Filterknoppen boven de kaarten (keuken, hoofdingrediënt, tijd/favorieten); werken samen met het zoekveld (theme.js).
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
