// Revisa el catálogo del parche activo (Supabase) contra la lista cerrada del Coach
// (src/features/coach/taxonomy.js), que la tabla base y los datos del parche activo no
// se pisen entre sí, y muestra cuánto del perfil del Coach falta cargar.
// Solo lee, con la clave pública.
// Uso: npm run catalog:check
import fs from 'node:fs';
import { catalogCoverage, catalogProblems, patchOverrideProblems } from '../src/features/coach/taxonomy.js';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line.includes('='))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

// PostgREST corta en 1000 filas: pide de a páginas.
async function load(query) {
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${query}${query.includes('?') ? '' : '?select=*'}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!response.ok) throw new Error(`${query}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    rows = rows.concat(page);
    if (page.length < 1000) return rows;
  }
}

const [state] = await load('game_state?select=active_patch_id');
const patchId = state.active_patch_id;
const [champions, items, runes, spells, baseChampions, baseItems, baseRunes, championPatch, itemPatch, runePatch] = await Promise.all([
  load('current_champions'), load('current_wr_items'), load('current_runes'), load('spells'),
  load('champions'), load('wr_items'), load('runes'),
  load(`champion_patch_stats?select=champion_id,data&patch_id=eq.${patchId}`),
  load(`item_patch_data?select=item_id,data&patch_id=eq.${patchId}`),
  load(`rune_patch_data?select=rune_id,data&patch_id=eq.${patchId}`),
]);
const problems = [
  ...catalogProblems({ champions, items, runes, spells }),
  ...patchOverrideProblems({ label: 'Campeón', base: baseChampions, patch: championPatch, key: 'champion_id' }),
  ...patchOverrideProblems({ label: 'Objeto', base: baseItems, patch: itemPatch, key: 'item_id' }),
  ...patchOverrideProblems({ label: 'Runa', base: baseRunes, patch: runePatch, key: 'rune_id' }),
];
console.log('Perfil del Coach cargado:');
Object.entries(catalogCoverage({ champions, items, runes, spells })).forEach(([label, value]) => console.log(`  ${label}: ${value}`));
console.log('');
if (problems.length) {
  console.log(`${problems.length} problemas en el catálogo:\n`);
  problems.forEach(problem => console.log(`- ${problem}`));
  process.exit(1);
}
console.log(`Catálogo OK: ${champions.length} campeones, ${items.length} objetos, ${runes.length} runas y ${spells.length} hechizos dentro de la lista cerrada; base y parche activo sin pisarse.`);
