// De kookpagina van een recept: titel en herkomst, video, ingrediënten en stappen (afvinkbaar),
// favoriet-knop en eigen notities. Hoeveelheden volgen de portie-aanpasser.
import { ingredientLabel, scaleText, baseServings } from './schalen.js';
import { readJSON, writeJSON, removeKey, isFav, setFav, getNote, setNote } from './opslag.js';
import { renderServingsControl } from './porties.js';

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

function renderHeader(recipe) {
  document.title = `Kookinstructies – ${recipe.title}`;
  const titleEl = document.getElementById('recipeTitle');
  if (titleEl) titleEl.textContent = `Kookinstructies voor ${recipe.title}`;
  const herkomstEl = document.getElementById('recipeHerkomst');
  if (!herkomstEl) return;
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

// Favoriet-knop naast de link naar de boodschappenlijst.
function addFavoriteButton(slug) {
  const actions = document.querySelector('.actions');
  if (!actions) return;
  const fb = document.createElement('button');
  fb.type = 'button';
  fb.className = 'nav-btn fav-toggle';
  const paint = () => {
    const on = isFav(slug);
    fb.textContent = on ? '♥ Favoriet' : '♡ Favoriet';
    fb.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  fb.addEventListener('click', () => { setFav(slug, !isFav(slug)); paint(); });
  paint();
  actions.appendChild(fb);
}

// Eigen notities bij het recept, bewaard op dit toestel.
function addNotes(slug) {
  const mainEl = document.querySelector('main');
  if (!mainEl) return;
  const wrap = document.createElement('section');
  wrap.className = 'my-notes';
  const h = document.createElement('h2');
  h.textContent = 'Mijn notities';
  const ta = document.createElement('textarea');
  ta.rows = 3;
  ta.placeholder = 'Bijvoorbeeld: iets minder chili, of 10 minuten langer sudderen…';
  ta.setAttribute('aria-label', 'Mijn notities bij dit recept');
  ta.value = getNote(slug);
  ta.addEventListener('input', () => setNote(slug, ta.value));
  const hint = document.createElement('p');
  hint.className = 'my-notes-hint';
  hint.textContent = 'Wordt bewaard op dit toestel.';
  wrap.append(h, ta, hint);
  mainEl.appendChild(wrap);
}

// Afvinkbare stappen; geeft de labels terug zodat de tekst kan meeschalen.
function buildSteps(slug, recipe, stepsList) {
  const labels = [];
  stepsList.innerHTML = '';
  const key = 'stappen-' + slug;
  let state = readJSON(key, {});
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
      writeJSON(key, state);
      li.classList.toggle('done', cb.checked);
      updateReset();
    });
    stepsList.appendChild(li);
    labels.push({ el: label, original: text });
  });
  resetBtn.addEventListener('click', () => {
    state = {};
    removeKey(key);
    stepsList.querySelectorAll('li').forEach(li => {
      li.classList.remove('done');
      const cb = li.querySelector('input');
      if (cb) cb.checked = false;
    });
    updateReset();
  });
  stepsList.after(resetBtn);
  updateReset();
  return labels;
}

export function initKookinstructies(slug, recipe) {
  renderHeader(recipe);
  renderVideoCard(recipe);
  addFavoriteButton(slug);
  addNotes(slug);

  const ingList = document.getElementById('ingredientsList');
  const stepsList = document.getElementById('stepsList');
  const noteEl = document.getElementById('recipeNote');
  const servingsControl = document.getElementById('servingsControl');

  const stepLabels = stepsList ? buildSteps(slug, recipe, stepsList) : [];

  function renderIngredients(factor) {
    if (!ingList) return;
    ingList.innerHTML = '';
    recipe.ingredients.forEach(item => {
      const li = document.createElement('li');
      li.textContent = ingredientLabel(item, factor, recipe);
      ingList.appendChild(li);
    });
  }

  function renderSteps(factor) {
    stepLabels.forEach(({ el, original }) => {
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
