// Revisa el catálogo del parche activo (Supabase) contra la lista cerrada del Coach
// (src/features/coach/taxonomy.js). Solo lee, con la clave pública.
// Uso: npm run catalog:check
import fs from 'node:fs';
import { catalogProblems } from '../src/features/coach/taxonomy.js';

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

const [champions, items] = await Promise.all([load('current_champions'), load('current_wr_items')]);
const problems = catalogProblems({ champions, items });
if (problems.length) {
  console.log(`${problems.length} problemas en el catálogo:\n`);
  problems.forEach(problem => console.log(`- ${problem}`));
  process.exit(1);
}
console.log(`Catálogo OK: ${champions.length} campeones y ${items.length} objetos dentro de la lista cerrada.`);
