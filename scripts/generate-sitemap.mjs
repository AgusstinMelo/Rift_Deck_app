import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { championSlug } from '../src/utils/championSlug.js';
import { entitySlug } from '../src/utils/entitySlug.js';
import { SITE_URL } from '../src/seo/publicSeo.js';
import {
  getCurrentTierlistEntries,
  normalizeTierlistSnapshotRecord,
} from '../src/utils/tierlist.js';

const readLocalEnv = async () => {
  try {
    const contents = await readFile(resolve('.env.local'), 'utf8');
    return Object.fromEntries(contents.split(/\r?\n/).flatMap(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      return match ? [[match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]] : [];
    }));
  } catch {
    return {};
  }
};

const localEnv = await readLocalEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY para generar el sitemap.');
}

const publicColumns = [
  'id', 'name', 'image_url', 'image_url_card', 'lane', 'roles', 'difficulty',
  'damage_type', 'scaling', 'strategic_notes', 'tags', 'life', 'mana', 'armor',
  'magic_res', 'attack_damage', 'attack_speed', 'movement', 'bonus_attack_speed',
  'life_reg', 'mana_reg', 'physic_vamp', 'magic_vamp', 'damage', 'survive',
  'assist', 'attack_range',
  'external_id', 'original_name', 'strong_against', 'weak_against', 'synergies',
];
const response = await fetch(`${supabaseUrl}/rest/v1/champions?select=${publicColumns.join(',')}&order=name.asc`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});

if (!response.ok) {
  throw new Error(`No se pudo consultar champions para el sitemap (${response.status}).`);
}

const champions = await response.json();
const fetchPublicRows = async (table, columns, filters = '') => {
  const result = await fetch(`${supabaseUrl}/rest/v1/${table}?select=${columns.join(',')}${filters}&order=name.asc`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!result.ok) throw new Error(`No se pudo consultar ${table} con la clave anónima (${result.status}).`);
  return result.json();
};
const itemColumns = [
  'id', 'name', 'image_url', 'price', 'description', 'category', 'type', 'tags', 'active',
  'life', 'life_reg', 'mana', 'mana_reg', 'attack_damage', 'attack_speed', 'ability_power',
  'armor', 'magic_res', 'flat_movement', 'percentage_movement', 'critical_impact',
  'critical_damage', 'physic_vamp', 'magic_vamp', 'flat_armor_penetration',
  'percentage_armor_penetration', 'flat_magic_penetration', 'percentage_magic_penetration',
  'ability_haste', 'tenacity', 'healing_and_shield',
];
const runeColumns = ['id', 'name', 'image_url', 'branch', 'group', 'description', 'tags'];
const items = await fetchPublicRows('wr_items', itemColumns, '&active=eq.true');
const runes = await fetchPublicRows('runes', runeColumns);
const executionParams = new URLSearchParams({
  select: '*',
  order: 'snapshot_date.desc,executed_at.desc',
  limit: '30',
});
const executionsResponse = await fetch(`${supabaseUrl}/rest/v1/tierlist_executions?${executionParams}`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});

if (!executionsResponse.ok) {
  throw new Error(`No se pudo consultar el último cálculo de tierlist (${executionsResponse.status}).`);
}

const executionRows = (await executionsResponse.json()).map(normalizeTierlistSnapshotRecord);
const seenSnapshots = new Set();
const executions = executionRows.filter(execution => {
  const identity = execution.snapshot_key || String(execution.id);
  if (seenSnapshots.has(identity)) return false;
  seenSnapshots.add(identity);
  return true;
}).slice(0, 10);
const latestExecution = executions.find(execution => execution.status === 'success' || execution.status === 'partial');
let tierlist = [];
if (latestExecution?.snapshot_key) {
  const params = new URLSearchParams({
    select: '*',
    snapshot_key: `eq.${latestExecution.snapshot_key}`,
    order: 'ranking_final.desc',
  });
  const tierlistResponse = await fetch(`${supabaseUrl}/rest/v1/tierlist_entries?${params}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!tierlistResponse.ok) {
    throw new Error(`No se pudo consultar la posición meta actual (${tierlistResponse.status}).`);
  }
  tierlist = (await tierlistResponse.json()).map(normalizeTierlistSnapshotRecord);
}
const slugs = champions.map(champion => championSlug(champion.name)).filter(Boolean);
if (new Set(slugs).size !== slugs.length) {
  throw new Error('Existen nombres de campeones que generan slugs duplicados.');
}

const itemSlugs = items.map(item => entitySlug(item.name)).filter(Boolean);
const runeSlugs = runes.map(rune => entitySlug(rune.name)).filter(Boolean);
if (new Set(itemSlugs).size !== itemSlugs.length) throw new Error('Existen objetos que generan slugs duplicados.');
if (new Set(runeSlugs).size !== runeSlugs.length) throw new Error('Existen runas que generan slugs duplicados.');

const paths = ['/', '/campeones', ...slugs.map(slug => `/campeones/${slug}`), '/objetos', ...itemSlugs.map(slug => `/objetos/${slug}`), '/runas', ...runeSlugs.map(slug => `/runas/${slug}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(path => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n  </url>`).join('\n')}
</urlset>
`;

await writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8');
await mkdir(resolve('.prerender'), { recursive: true });
const currentTierlist = getCurrentTierlistEntries(tierlist, executions);
await writeFile(resolve('.prerender/public-data.json'), JSON.stringify({ champions, items, runes, executions, tierlist: currentTierlist }), 'utf8');
console.log(`Sitemap generado con ${paths.length} URLs públicas.`);
