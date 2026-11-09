// Startpunt van de app: kiest op grond van <body data-page="…"> welk onderdeel de pagina opbouwt.
//   index → startpagina | kook → kookinstructies | lijst → boodschappenlijst
// De receptdata staat in recipes-data.js (window.RECIPES), de rest in de modules in deze map.
import { initIndex } from './index.js';
import { initKookinstructies } from './kookinstructies.js';
import { initBoodschappenlijst } from './boodschappenlijst.js';

function start() {
  const data = window.RECIPES;
  if (!data) return;
  const body = document.body;
  if (body.dataset.page === 'index') {
    initIndex(data);
    return;
  }
  const slug = body.dataset.recipe;
  const recipe = slug && data.recipes[slug];
  if (!recipe) return;
  if (body.dataset.page === 'kook') initKookinstructies(slug, recipe);
  else if (body.dataset.page === 'lijst') initBoodschappenlijst(slug, recipe);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
