// Compara los textos de interfaz de cada idioma contra es-419.json (la referencia).
//
//   npm run i18n:ui   -> lista claves faltantes y sobrantes por idioma
//
// Una clave faltante no rompe la app (se muestra en español latino), pero queda
// sin traducir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_LOCALE, TRANSLATED_LOCALES } from '../src/i18n/catalogI18n.js';
import { flattenKeys } from '../src/i18n/uiI18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = path.join(root, 'src', 'i18n', 'ui');
const read = locale => JSON.parse(fs.readFileSync(path.join(uiDir, `${locale}.json`), 'utf8'));

const baseKeys = new Set(flattenKeys(read(DEFAULT_LOCALE)));
let problems = 0;

for (const locale of TRANSLATED_LOCALES) {
  const keys = new Set(flattenKeys(read(locale)));
  const missing = [...baseKeys].filter(key => !keys.has(key));
  const extra = [...keys].filter(key => !baseKeys.has(key));
  problems += missing.length + extra.length;

  console.log(`${locale}: ${keys.size - extra.length}/${baseKeys.size} claves`);
  for (const key of missing) console.log(`  falta    ${key}`);
  for (const key of extra) console.log(`  sobra    ${key}`);
}

process.exitCode = problems ? 1 : 0;
