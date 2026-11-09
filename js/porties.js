// De portie-aanpasser (− 4 +) bovenaan de kook- en boodschappenpagina.
import { MIN_SERVINGS, MAX_SERVINGS, getServings, setServings } from './opslag.js';

export function renderServingsControl(container, slug, base, onChange) {
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
