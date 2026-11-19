import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { championSlug } from '../src/utils/championSlug.js';
import { entitySlug } from '../src/utils/entitySlug.js';
import { SITE_URL } from '../src/seo/publicSeo.js';
import {
  getCurrentTierlistEntries,
  normalizePatchAverage,
  withCatalogIcons,
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
  'life_reg', 'mana_reg', 'lifesteal', 'physic_vamp', 'magic_vamp', 'damage', 'survive',
  'assist', 'attack_range',
  'external_id', 'original_name', 'strong_against', 'weak_against', 'synergies', 'updated_at',
];
const response = await fetch(`${supabaseUrl}/rest/v1/current_champions?select=${publicColumns.join(',')}&order=name.asc`, {
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
  'good_against', 'avoid_against',
  'life', 'life_reg', 'mana', 'mana_reg', 'attack_damage', 'attack_speed', 'ability_power',
  'armor', 'magic_res', 'flat_movement', 'percentage_movement', 'critical_impact',
  'critical_damage', 'lifesteal', 'physic_vamp', 'magic_vamp', 'flat_armor_penetration',
  'percentage_armor_penetration', 'flat_magic_penetration', 'percentage_magic_penetration',
  'ability_haste', 'tenacity', 'healing_and_shield', 'updated_at',
];
const runeColumns = ['id', 'name', 'image_url', 'branch', 'group', 'description', 'updated_at'];
const items = await fetchPublicRows('current_wr_items', itemColumns, '&active=eq.true');
const runes = await fetchPublicRows('current_runes', runeColumns);
const groupParams = new URLSearchParams({
  select: 'patch_group,last_snapshot_date',
  order: 'last_snapshot_date.desc',
  limit: '1',
});
const groupsResponse = await fetch(`${supabaseUrl}/rest/v1/tierlist_patch_groups?${groupParams}`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
});

if (!groupsResponse.ok) {
  throw new Error(`No se pudo consultar el parche actual de la tierlist (${groupsResponse.status}).`);
}

const [latestGroup] = await groupsResponse.json();
let tierlist = [];
if (latestGroup?.patch_group) {
  const params = new URLSearchParams({
    select: '*',
    patch_group: `eq.${latestGroup.patch_group}`,
    order: 'ranking_final.desc',
  });
  const tierlistResponse = await fetch(`${supabaseUrl}/rest/v1/tierlist_patch_averages?${params}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!tierlistResponse.ok) {
    throw new Error(`No se pudo consultar la posición meta actual (${tierlistResponse.status}).`);
  }
  tierlist = (await tierlistResponse.json()).map(normalizePatchAverage);
}
const slugs = champions.map(champion => championSlug(champion.name)).filter(Boolean);
if (new Set(slugs).size !== slugs.length) {
  throw new Error('Existen nombres de campeones que generan slugs duplicados.');
}

const itemSlugs = items.map(item => entitySlug(item.name)).filter(Boolean);
const runeSlugs = runes.map(rune => entitySlug(rune.name)).filter(Boolean);
if (new Set(itemSlugs).size !== itemSlugs.length) throw new Error('Existen objetos que generan slugs duplicados.');
if (new Set(runeSlugs).size !== runeSlugs.length) throw new Error('Existen runas que generan slugs duplicados.');

// Fecha de la última modificación de cada página (lastmod): le dice a Google qué cambió y
// le da un motivo para volver. Ficha de objeto o runa: su última actualización en el
// catálogo. Ficha de campeón: también muestra su posición en la tierlist, así que vale la
// fecha más reciente entre su actualización y la última foto de la tierlist. Listados y
// home: la fecha más reciente de lo que muestran.
const dayOf = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
};
const latest = (...dates) => dates.flat().filter(Boolean).sort().at(-1) || null;
const tierlistDay = dayOf(latestGroup?.last_snapshot_date);
const championDays = champions.map(champion => latest(dayOf(champion.updated_at), tierlistDay));
const itemDays = items.map(item => dayOf(item.updated_at));
const runeDays = runes.map(rune => dayOf(rune.updated_at));
const championsDay = latest(championDays);
const itemsDay = latest(itemDays);
const runesDay = latest(runeDays);

const entries = [
  ['/', latest(championsDay, itemsDay, runesDay)],
  ['/campeones', championsDay],
  ...slugs.map((slug, index) => [`/campeones/${slug}`, championDays[index]]),
  ['/objetos', itemsDay],
  ...itemSlugs.map((slug, index) => [`/objetos/${slug}`, itemDays[index]]),
  ['/runas', runesDay],
  ...runeSlugs.map((slug, index) => [`/runas/${slug}`, runeDays[index]]),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([path, day]) => `  <url>\n    <loc>${SITE_URL}${path}</loc>${day ? `\n    <lastmod>${day}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`;

await writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8');
await mkdir(resolve('.prerender'), { recursive: true });
// Íconos del catálogo en lugar de los avatares de Tencent (más livianos y rápidos).
const currentTierlist = withCatalogIcons(getCurrentTierlistEntries(tierlist), champions);
// La fecha solo sirve para el sitemap: no viaja en los datos que se incrustan en cada página.
const withoutDate = rows => rows.map(({ updated_at: _updatedAt, ...row }) => row);
await writeFile(resolve('.prerender/public-data.json'), JSON.stringify({
  champions: withoutDate(champions), items: withoutDate(items), runes: withoutDate(runes), tierlist: currentTierlist,
}), 'utf8');
console.log(`Sitemap generado con ${entries.length} URLs públicas.`);
