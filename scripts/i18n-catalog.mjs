// Revisa las traducciones de objetos y runas contra el catálogo del parche activo.
//
//   npm run i18n:catalog            -> lista lo que falta o quedó desactualizado
//   npm run i18n:catalog -- --out pendientes.json
//                                   -> además guarda los textos en español a traducir
//
// Una traducción queda desactualizada cuando la descripción en español cambió desde
// que se tradujo (su `source` ya no coincide); la app muestra el español hasta
// que se actualice.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATED_LOCALES, catalogTextHash, normalizeCatalogText } from '../src/i18n/catalogI18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDir = path.join(root, 'src', 'i18n', 'catalog');

function readEnv() {
  const env = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

async function fetchTable(env, table) {
  const url = `${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=id,name,description`;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

const env = readEnv();
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env.local).');
  process.exit(1);
}

const catalog = {
  items: await fetchTable(env, 'current_wr_items'),
  runes: await fetchTable(env, 'current_runes'),
};

const pending = [];
for (const locale of TRANSLATED_LOCALES) {
  const translations = JSON.parse(fs.readFileSync(path.join(catalogDir, `${locale}.json`), 'utf8'));
  for (const [kind, entities] of Object.entries(catalog)) {
    for (const entity of entities) {
      const entry = translations[kind]?.[String(entity.id)];
      const description = normalizeCatalogText(entity.description);
      const problems = [];
      if (!entry?.name) problems.push('nombre');
      if (description && !entry?.description) problems.push('descripción');
      else if (description && entry.source !== catalogTextHash(description)) problems.push('descripción desactualizada');
      if (problems.length === 0) continue;

      pending.push({
        locale,
        kind,
        id: String(entity.id),
        name: entity.name.trim(),
        description,
        source: description ? catalogTextHash(description) : undefined,
        problems,
      });
    }
  }
}

if (pending.length === 0) {
  console.log('Traducciones de objetos y runas al día.');
} else {
  for (const item of pending) {
    console.log(`[${item.locale}] ${item.kind}/${item.id} ${item.name}: ${item.problems.join(', ')}`);
  }
  console.log(`\n${pending.length} traducciones pendientes.`);
}

const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1 && process.argv[outIndex + 1]) {
  fs.writeFileSync(process.argv[outIndex + 1], `${JSON.stringify(pending, null, 2)}\n`);
  console.log(`Pendientes guardados en ${process.argv[outIndex + 1]}`);
}

process.exitCode = pending.length > 0 ? 1 : 0;
