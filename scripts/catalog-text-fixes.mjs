// Genera la migración que corrige errores de tipeo y los "\n" escritos como texto en las
// descripciones de runas y objetos (tabla base y datos del parche, que es la que se ve),
// con su rollback exacto. Además actualiza la huella `source` de las traducciones que
// estaban al día, para que una corrección de tipeo no las marque como desactualizadas
// (los "\n" no cambian la huella: normalizeCatalogText ya los convertía).
// Uso: node scripts/catalog-text-fixes.mjs <nombre_migracion>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogTextHash } from '../src/i18n/catalogI18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
if (!name) throw new Error('Uso: node scripts/catalog-text-fixes.mjs <nombre_migracion>');

const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)
  .filter(line => line.includes('='))
  .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()]));
const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` };
async function all(query) {
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${query}`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${query}: ${JSON.stringify(page)}`);
    rows = rows.concat(page);
    if (page.length < 1000) return rows;
  }
}

const TYPOS = [
  [/inglingen/g, 'infligen'],
  [/([Ii])nfling/g, '$1nflig'],
  [/adapatable/g, 'adaptable'],
  [/([Dd])erriv/g, '$1errib'],
  [/cuanto tienes/g, 'cuando tienes'],
];
export function fixText(text) {
  let out = String(text).replace(/\\+n/g, '\n');
  for (const [pattern, replacement] of TYPOS) out = out.replace(pattern, replacement);
  return out;
}

const quote = text => {
  let tag = 'rd';
  while (text.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${text}$${tag}$`;
};

const tables = [
  { kind: 'runes', base: 'runes', patch: 'rune_patch_data', key: 'rune_id' },
  { kind: 'items', base: 'wr_items', patch: 'item_patch_data', key: 'item_id' },
];
const up = [], down = [], hashes = { runes: new Map(), items: new Map() };
for (const table of tables) {
  const base = await all(`${table.base}?select=id,name,description`);
  const patch = await all(`${table.patch}?select=patch_id,${table.key},data`);
  const baseById = new Map(base.map(row => [String(row.id), row]));
  for (const row of base) {
    if (typeof row.description !== 'string') continue;
    const fixed = fixText(row.description);
    if (fixed === row.description) continue;
    up.push(`update public.${table.base} set description = ${quote(fixed)} where id::text = '${row.id}';`);
    down.push(`update public.${table.base} set description = ${quote(row.description)} where id::text = '${row.id}';`);
  }
  const activePatch = Math.max(...patch.map(row => Number(row.patch_id)));
  for (const row of patch) {
    const id = String(row[table.key]);
    const hasOwn = row.data && Object.prototype.hasOwnProperty.call(row.data, 'description');
    const shown = hasOwn ? row.data.description : baseById.get(id)?.description;
    if (Number(row.patch_id) === activePatch && typeof shown === 'string' && fixText(shown) !== shown) {
      hashes[table.kind].set(id, [catalogTextHash(shown), catalogTextHash(fixText(shown))]);
    }
    if (!hasOwn || typeof row.data.description !== 'string') continue;
    const fixed = fixText(row.data.description);
    if (fixed === row.data.description) continue;
    const where = `where patch_id = ${row.patch_id} and ${table.key} = '${id}'`;
    up.push(`update public.${table.patch} set data = jsonb_set(data, '{description}', to_jsonb(${quote(fixed)}::text)) ${where};`);
    down.push(`update public.${table.patch} set data = jsonb_set(data, '{description}', to_jsonb(${quote(row.data.description)}::text)) ${where};`);
  }
}

const header = `-- Corrige tipeos ("inflingen", "derrivar", "adapatable", "cuanto tienes") y los "\\n"
-- escritos como texto en las descripciones de runas y objetos, en la tabla base y en los
-- datos del parche. Generado con scripts/catalog-text-fixes.mjs (${up.length} cambios).\n\n`;
fs.writeFileSync(path.join(root, 'supabase', 'migrations', `${name}.sql`), `${header}${up.join('\n')}\n`);
fs.writeFileSync(path.join(root, 'supabase', 'rollbacks', `${name}.sql`), `-- Rollback de ${name}.sql\n\n${down.join('\n')}\n`);

let touched = 0;
for (const locale of ['es-ES', 'en', 'pt-BR']) {
  const file = path.join(root, 'src', 'i18n', 'catalog', `${locale}.json`);
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const catalog = JSON.parse(raw);
  for (const kind of ['runes', 'items']) {
    for (const [id, [oldHash, newHash]] of hashes[kind]) {
      const entry = catalog[kind]?.[id];
      if (entry && entry.source === oldHash && oldHash !== newHash) { entry.source = newHash; touched++; }
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(catalog, null, 2).replace(/\n/g, eol)}${eol}`);
}
console.log(`${up.length} cambios en la migración; ${touched} huellas de traducción actualizadas.`);
