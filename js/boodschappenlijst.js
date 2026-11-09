// De boodschappenlijst van een recept: afvinkbare checklist met eigen items, delen en reset.
// Hoeveelheden volgen de portie-aanpasser.
import { ingredientLabel, baseServings } from './schalen.js';
import { readJSON, writeJSON } from './opslag.js';
import { renderServingsControl } from './porties.js';

export function initBoodschappenlijst(slug, recipe) {
  document.title = `Boodschappenlijst – ${recipe.title}`;
  const titleEl = document.getElementById('listTitle');
  if (titleEl) titleEl.textContent = `Checklist – Boodschappenlijst ${recipe.title}`;

  const STORAGE_KEY = slug + '-checklist-v1';
  let state = readJSON(STORAGE_KEY, {});
  let customItems = readJSON(STORAGE_KEY + '-custom', []);
  const root = document.getElementById('list');
  const progressEl = document.getElementById('progress');
  const servingsControl = document.getElementById('servingsControl');

  function save() { writeJSON(STORAGE_KEY, state); updateProgress(); }
  function saveCustom() { writeJSON(STORAGE_KEY + '-custom', customItems); }

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
