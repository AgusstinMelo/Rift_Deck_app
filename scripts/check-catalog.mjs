// Revisa el catálogo del parche activo (Supabase) contra la lista cerrada del Coach
// (src/features/coach/taxonomy.js) y muestra cuánto del perfil del Coach falta cargar.
// Solo lee, con la clave pública.
// Uso: npm run catalog:check
import fs from 'node:fs';
import { catalogCoverage, catalogProblems } from '../src/features/coach/taxonomy.js';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => line.includes('='))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

async function load(table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

const [champions, items, runes, spells] = await Promise.all([load('current_champions'), load('current_wr_items'), load('current_runes'), load('spells')]);
const problems = catalogProblems({ champions, items, runes, spells });
console.log('Perfil del Coach cargado:');
Object.entries(catalogCoverage({ champions, runes, spells })).forEach(([label, value]) => console.log(`  ${label}: ${value}`));
console.log('');
if (problems.length) {
  console.log(`${problems.length} problemas en el catálogo:\n`);
  problems.forEach(problem => console.log(`- ${problem}`));
  process.exit(1);
}
console.log(`Catálogo OK: ${champions.length} campeones, ${items.length} objetos, ${runes.length} runas y ${spells.length} hechizos dentro de la lista cerrada.`);
