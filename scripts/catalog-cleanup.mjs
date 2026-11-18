// Limpieza del catálogo para el Coach: genera una migración SQL revisable (no escribe en
// la base). Lee un volcado de las tablas (champions, champion_patch_stats, wr_items) y:
// 1. recorta nombres de campeón con espacios o saltos de línea ("Yunara\n");
// 2. pasa strong_against / weak_against / synergies al nombre canónico del campeón
//    (hoy mezclan ids externos como "10033", minúsculas y errores: "tresh", "rize"),
//    en la tabla base y en los datos de TODOS los parches;
// 3. lleva traits, vulnerabilities e item_scalings a la lista cerrada (sinónimos → valor
//    canónico; ver src/features/coach/taxonomy.js);
// 4. completa effect_tags y situational_role de los objetos terminados que no tienen.
//
// Uso: node scripts/catalog-cleanup.mjs <carpeta-del-volcado> <salida.sql> [rollback.sql]
// El rollback deja cada campo tocado con su valor original.
// El volcado tiene db_champions.json, db_champion_patch_stats.json y db_wr_items.json.
import fs from 'node:fs';
import path from 'node:path';

const [dumpDir, outFile, rollbackFile] = process.argv.slice(2);
if (!dumpDir || !outFile) {
  console.error('Uso: node scripts/catalog-cleanup.mjs <carpeta-del-volcado> <salida.sql>');
  process.exit(1);
}
const read = name => JSON.parse(fs.readFileSync(path.join(dumpDir, name), 'utf8'));
const champions = read('db_champions.json');
const patchStats = read('db_champion_patch_stats.json');
const items = read('db_wr_items.json');

const norm = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sqlText = value => `'${String(value).replace(/'/g, "''")}'`;
const sqlTextArray = list => `array[${list.map(sqlText).join(', ')}]::text[]`;
const sqlJsonb = value => `${sqlText(JSON.stringify(value))}::jsonb`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1-2. Nombres y relaciones entre campeones ─────────────────────────────
const canonicalName = champ => champ.name.trim();
const byExternal = new Map(champions.map(champ => [String(champ.external_id), canonicalName(champ)]));
const byNorm = new Map(champions.map(champ => [norm(champ.name), canonicalName(champ)]));
// Errores de tipeo encontrados en el volcado del 18/11/2026.
const TYPOS = { ambesa: 'Ambessa', tresh: 'Thresh', zigss: 'Ziggs', oriana: 'Orianna', rize: 'Ryze' };
const unresolved = new Set();
function resolveChampion(value) {
  const raw = String(value).trim();
  const hit = byExternal.get(raw) || byNorm.get(norm(raw)) || TYPOS[norm(raw)];
  if (!hit) unresolved.add(raw);
  return hit || raw;
}
const RELATIONS = ['strong_against', 'weak_against', 'synergies'];
const fixRelation = list => (Array.isArray(list) ? [...new Set(list.map(resolveChampion))] : list);

// ── 3. Lista cerrada de traits y vulnerabilidades ─────────────────────────
// Sinónimos → valor canónico; null = se elimina (redundante con otro tag del campeón).
const TRAIT_ALIASES = {
  sigilo: 'camuflaje',
  control: 'cc_blando',
  backline: null, // Hwei: ya tiene largo_alcance.
  inmovil: null, // Hwei: no es un rasgo de juego que use nadie.
  combate_extendido: null, // vocabulario de runas, no de campeones.
  dependiente_enfriamientos: null, // Taliyah: ya tiene dependiente_habilidades.
};
// Las vulnerabilidades canónicas son las que el Coach sabe explicar (VULN en matchups.js).
const VULN_ALIASES = {
  dive: 'diver',
  flanqueo: 'acceso_backline',
  burst: 'daño_burst',
  movilidad: 'gap_close',
  hard_engage: 'cc_duro',
  poke_largo_alcance: 'largo_alcance',
  dependencia_mana: 'presion_mana',
  presion_enfriamientos: null, // Taliyah: ya tiene presion_mana y disengage.
};
const SCALING_ALIASES = { regen_mana: 'regeneracion_mana' };
const mapTags = (list, aliases) => [...new Set((list || [])
  .map(tag => String(tag).trim())
  .map(tag => (tag in aliases ? aliases[tag] : tag))
  .filter(Boolean))];

// ── 4. Objetos terminados sin effect_tags (vocabulario existente) ─────────
const ITEM_TAGS = {
  'Tiara Susurrante': { effect: ['curacion_aliada', 'sosten_mana', 'acumulacion', 'escalado'], role: ['utilidad', 'escalado'] },
  'Diadema Musical': { effect: ['curacion_aliada', 'sosten_mana', 'escalado'], role: ['utilidad', 'escalado'] },
  'Ecos de Helia': { effect: ['curacion_aliada', 'aceleracion_habilidad', 'sosten_mana'], role: ['utilidad'] },
  'Proyectiles Cazademonios': { effect: ['modificador_critico', 'buff_velocidad_ataque', 'daño_autoataque', 'daño_verdadero', 'daño_burst'], role: ['ofensivo'] },
  'Filo de la Tormenta': { effect: ['daño_autoataque', 'modificador_critico', 'velocidad_movimiento_combate', 'daño_burst'], role: ['ofensivo', 'early'] },
  'Cañón de Fuego Rápido': { effect: ['daño_autoataque', 'modificador_critico', 'buff_velocidad_ataque', 'velocidad_movimiento'], role: ['ofensivo', 'utilidad'] },
  'Flechas Salvajes de Yun Tal': { effect: ['modificador_critico', 'buff_velocidad_ataque', 'daño_autoataque', 'acumulacion', 'escalado'], role: ['ofensivo', 'escalado'] },
  'Hexóptica C44': { effect: ['modificador_critico', 'daño_autoataque', 'amplificacion_daño'], role: ['ofensivo', 'late'] },
  'Daga de Statikk': { effect: ['daño_autoataque', 'buff_velocidad_ataque', 'velocidad_movimiento', 'daño_on_hit'], role: ['ofensivo', 'early'] },
  'Arcoescudo Inmortal': { effect: ['escudo', 'anti_burst', 'modificador_critico'], role: ['defensivo', 'ofensivo'] },
};

// ── Cambios ──────────────────────────────────────────────────────────────
const statements = [];
const undo = [];
const report = { names: [], relationsBase: 0, relationsPatch: 0, patchTags: 0, traits: [], vulns: [], items: [] };

champions.forEach(champ => {
  const sets = [];
  if (champ.name !== champ.name.trim()) {
    sets.push(`name = ${sqlText(champ.name.trim())}`);
    report.names.push(JSON.stringify(champ.name));
  }
  RELATIONS.forEach(field => {
    const fixed = fixRelation(champ[field]);
    if (!same(fixed, champ[field])) { sets.push(`${field} = ${sqlJsonb(fixed)}`); report.relationsBase += 1; }
  });
  const traits = mapTags(champ.traits, TRAIT_ALIASES);
  if (!same(traits, champ.traits)) { sets.push(`traits = ${sqlTextArray(traits)}`); report.traits.push(`${champ.name.trim()}: ${champ.traits.join(',')} → ${traits.join(',')}`); }
  const vulns = mapTags(champ.vulnerabilities, VULN_ALIASES);
  if (!same(vulns, champ.vulnerabilities)) { sets.push(`vulnerabilities = ${sqlTextArray(vulns)}`); report.vulns.push(`${champ.name.trim()}: ${champ.vulnerabilities.join(',')} → ${vulns.join(',')}`); }
  const scalings = mapTags(champ.item_scalings, SCALING_ALIASES);
  if (!same(scalings, champ.item_scalings)) { sets.push(`item_scalings = ${sqlTextArray(scalings)}`); report.traits.push(`${champ.name.trim()} (item_scalings): ${champ.item_scalings.join(',')} → ${scalings.join(',')}`); }
  if (sets.length) {
    statements.push(`update public.champions set ${sets.join(', ')} where id = ${sqlText(champ.id)};`);
    const fields = sets.map(entry => entry.split(' = ')[0]);
    const original = field => (field === 'name' ? sqlText(champ.name)
      : RELATIONS.includes(field) ? (champ[field] == null ? 'null' : sqlJsonb(champ[field])) : sqlTextArray(champ[field] || []));
    undo.push(`update public.champions set ${fields.map(field => `${field} = ${original(field)}`).join(', ')} where id = ${sqlText(champ.id)};`);
  }
});

patchStats.forEach(row => {
  const patch = {};
  RELATIONS.forEach(field => {
    if (!(field in row.data)) return;
    const fixed = fixRelation(row.data[field]);
    if (!same(fixed, row.data[field])) patch[field] = fixed;
  });
  // Algunos campeones agregados por parche (Hwei) traen sus tags en los datos del parche.
  [['traits', TRAIT_ALIASES], ['vulnerabilities', VULN_ALIASES], ['item_scalings', SCALING_ALIASES]].forEach(([field, aliases]) => {
    if (!Array.isArray(row.data[field])) return;
    const fixed = mapTags(row.data[field], aliases);
    if (!same(fixed, row.data[field])) { patch[field] = fixed; report.patchTags += 1; }
  });
  const nameFix = row.champion_name && row.champion_name !== row.champion_name.trim();
  if (!Object.keys(patch).length && !nameFix) return;
  report.relationsPatch += RELATIONS.filter(field => field in patch).length;
  const sets = [];
  if (Object.keys(patch).length) sets.push(`data = data || ${sqlJsonb(patch)}`);
  if (nameFix) sets.push(`champion_name = ${sqlText(row.champion_name.trim())}`);
  statements.push(`update public.champion_patch_stats set ${sets.join(', ')} where champion_id = ${sqlText(row.champion_id)} and patch_id = ${row.patch_id};`);
  const before = Object.fromEntries(Object.keys(patch).map(field => [field, row.data[field]]));
  const undoSets = [];
  if (Object.keys(patch).length) undoSets.push(`data = data || ${sqlJsonb(before)}`);
  if (nameFix) undoSets.push(`champion_name = ${sqlText(row.champion_name)}`);
  undo.push(`update public.champion_patch_stats set ${undoSets.join(', ')} where champion_id = ${sqlText(row.champion_id)} and patch_id = ${row.patch_id};`);
});

items.forEach(item => {
  const tags = ITEM_TAGS[item.name];
  if (!tags || (item.effect_tags || []).length) return;
  const sets = [`effect_tags = ${sqlTextArray(tags.effect)}`];
  if (!(item.situational_role || []).length) sets.push(`situational_role = ${sqlTextArray(tags.role)}`);
  statements.push(`update public.wr_items set ${sets.join(', ')} where id = ${sqlText(item.id)};`);
  undo.push(`update public.wr_items set effect_tags = ${sqlTextArray(item.effect_tags || [])}${sets.length > 1 ? `, situational_role = ${sqlTextArray(item.situational_role || [])}` : ''} where id = ${sqlText(item.id)};`);
  report.items.push(item.name);
});
const missingItems = Object.keys(ITEM_TAGS).filter(name => !items.some(item => item.name === name));

if (unresolved.size) {
  console.error('Relaciones sin resolver (agregar a TYPOS):', [...unresolved].join(', '));
  process.exit(1);
}

const sql = `-- Limpieza del catálogo para el Coach (generada con scripts/catalog-cleanup.mjs).
-- 1. Nombres de campeón sin espacios ni saltos de línea.
-- 2. strong_against / weak_against / synergies con el nombre canónico del campeón (en la
--    tabla base y en los datos de todos los parches): antes mezclaban ids externos,
--    minúsculas y errores de tipeo, y el Coach no los encontraba.
-- 3. traits, vulnerabilities e item_scalings en la lista cerrada (sinónimos unificados).
-- 4. effect_tags y situational_role de los objetos terminados que no tenían.
begin;

${statements.join('\n')}

commit;
`;
fs.writeFileSync(outFile, sql);
if (rollbackFile) {
  fs.writeFileSync(rollbackFile, `-- Rollback de ${path.basename(outFile)}: deja cada campo tocado con su valor original.
begin;

${undo.join('\n')}

commit;
`);
}
console.log(JSON.stringify({ ...report, statements: statements.length, missingItems }, null, 2));
