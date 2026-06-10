// Campeones sin maná (sin recurso)
const NO_RESOURCE = ['Aatrox', 'Dr. Mundo', 'Garen', 'Katarina', 'Mordekaiser', 'Rengar', 'Riven', 'Rumble', 'Sett', 'Viego', 'Yasuo', 'Yone'];
// Campeones con Energía
const ENERGY_CHAMPS = ['Akali', 'Ambessa', 'Kennen', 'Lee Sin', 'Shen', 'Zed'];
// Campeones con Furia
const FURY_CHAMPS = ['Gnar', 'Renekton', 'Shyvana', 'Tryndamere'];

function getManaLabel(champName) {
  if (ENERGY_CHAMPS.includes(champName)) return { resource: 'Energía', resourceReg: 'Regeneración de Energía' };
  if (FURY_CHAMPS.includes(champName)) return { resource: 'Furia', resourceReg: null };
  if (NO_RESOURCE.includes(champName)) return { resource: null, resourceReg: null };
  return { resource: 'Maná', resourceReg: 'Regeneración de Maná' };
}

// Interacciones especiales de objetos
function applySpecialItems(stats, items) {
  for (const item of items) {
    const name = item.name || '';

    if (name === 'Filo del Infinito' && stats.critical_impact > 100) {
      stats.critical_damage += (stats.critical_impact - 100) * 0.6;
    }
    if (name === 'Sombrero Mortífero de Rabadon') {
      stats.ability_power += stats.ability_power * 0.2;
    }
    if (name === 'Guantelete de Sterak') {
      stats.attack_damage += stats.base_attack_damage * 0.5;
    }
    if (name === 'Cota Sangrienta del Soberano') {
      stats.attack_damage += (stats.life - stats.base_life) * 0.025;
    }
    if (name === 'Manamune') {
      stats.attack_damage += stats.mana * 0.015;
    }
    if (name === 'Muramaná') {
      stats.attack_damage += stats.mana * 0.02;
    }
    if (name === 'Báculo del Arcángel') {
      stats.ability_power += stats.mana * 0.01;
    }
    if (name === 'Abrazo de Serafín') {
      stats.ability_power += stats.mana * 0.03;
    }
    if (name === 'Proyector Psíquico') {
      stats.ability_power += (stats.life - stats.base_life) * 0.035;
    }
    if (name === 'Llegada del Invierno') {
      stats.life += stats.mana * 0.08;
    }
    if (name === 'Invierno Nórdico') {
      stats.life += stats.mana * 0.1;
    }
  }
  return stats;
}

function buildBaseStats(c) {
  return {
    base_life: Number(c.life || 0),
    base_attack_damage: Number(c.attack_damage || 0),
    base_attack_speed: Number(c.attack_speed || 0),
    base_bonus_attack_speed: Number(c.bonus_attack_speed || 0),

    life: Number(c.life || 0),
    life_reg: Number(c.life_reg || 0),
    mana: Number(c.mana || 0),
    mana_reg: Number(c.mana_reg || 0),
    attack_damage: Number(c.attack_damage || 0),
    bonus_attack_speed: Number(c.bonus_attack_speed || 0),
    armor: Number(c.armor || 0),
    magic_res: Number(c.magic_res || 0),
    movement_flat: Number(c.movement || 0),
    movement_pct: 0,
    ability_power: 0,
    ability_haste: 0,
    critical_impact: 0,
    critical_damage: 175,
    physic_vamp: Number(c.physic_vamp || 0),
    magic_vamp: Number(c.magic_vamp || 0),
    flat_armor_penetration: 0,
    percentage_armor_penetration: 0,
    flat_magic_penetration: 0,
    percentage_magic_penetration: 0,
    tenacity: 0,
    healing_and_shield: 0,
    percentage_armor: 0,
    percentage_magic_res: 0,
  };
}

function applySource(stats, source) {
  stats.life            += Number(source.life || 0);
  stats.life_reg        += (stats.life_reg * Number(source.life_reg || 0)) / 100;
  stats.mana            += Number(source.mana || 0);
  stats.mana_reg        += (stats.mana_reg * Number(source.mana_reg || 0)) / 100;
  stats.attack_damage   += Number(source.attack_damage || 0);
  stats.bonus_attack_speed += Number(source.attack_speed || 0);
  stats.armor           += Number(source.armor || 0);
  stats.magic_res       += Number(source.magic_res || 0);
  stats.movement_flat   += Number(source.flat_movement || 0);
  stats.movement_pct    += Number(source.percentage_movement || 0);
  stats.ability_power   += Number(source.ability_power || 0);
  stats.ability_haste   += Number(source.ability_haste || 0);
  stats.critical_impact += Number(source.critical_impact || 0);
  stats.critical_damage += Number(source.critical_damage || 0);
  stats.physic_vamp     += Number(source.physic_vamp || 0);
  stats.magic_vamp      += Number(source.magic_vamp || 0);
  stats.flat_armor_penetration        += Number(source.flat_armor_penetration || 0);
  stats.percentage_armor_penetration  += Number(source.percentage_armor_penetration || 0);
  stats.flat_magic_penetration        += Number(source.flat_magic_penetration || 0);
  stats.percentage_magic_penetration  += Number(source.percentage_magic_penetration || 0);
  stats.tenacity          += Number(source.tenacity || 0);
  stats.healing_and_shield+= Number(source.healing_and_shield || 0);
  stats.percentage_armor      += Number(source.percentage_armor || 0);
  stats.percentage_magic_res  += Number(source.percentage_magic_res || 0);
  }

function calcStats(champion, items, runes = []) {
  const c = champion || {};

  const adaptableItems = items.filter(i => Number(i.adaptable_ad || 0) > 0 || Number(i.adaptable_ap || 0) > 0);
  const normalItems    = items.filter(i => !(Number(i.adaptable_ad || 0) > 0 || Number(i.adaptable_ap || 0) > 0));

  const maxIter = adaptableItems.length + 5;
  let ad_final = null;
  let ap_final = null;
  let stats;

  for (let iter = 0; iter < maxIter; iter++) {
    stats = buildBaseStats(c);

    // Runas
    for (const rune of runes) applySource(stats, rune);
    // Items normales
    for (const item of normalItems) applySource(stats, item);
    // Items adaptables (stats base, sin el bonus adaptable aún)
    for (const item of adaptableItems) applySource(stats, item);

    // Modo adaptable: si AP bonus > AD bonus → AP, sino AD
    const adBonus = stats.attack_damage - stats.base_attack_damage;
    const modoAP = stats.ability_power > adBonus;

    if (modoAP) {
      for (const item of adaptableItems) stats.ability_power += Number(item.adaptable_ap || 0);
    } else {
      for (const item of adaptableItems) stats.attack_damage += Number(item.adaptable_ad || 0);
    }

    if (stats.attack_damage === ad_final && stats.ability_power === ap_final) break;
    ad_final = stats.attack_damage;
    ap_final = stats.ability_power;
  }

  // Bonus porcentual de armadura y magic res (runas)
  stats.armor    = Math.round(stats.armor    * (1 + stats.percentage_armor     / 100));
  stats.magic_res = Math.round(stats.magic_res * (1 + stats.percentage_magic_res / 100));

  // Interacciones especiales
  stats = applySpecialItems(stats, items);

  // Velocidad de ataque final: base * (1 + bonus% / 100)
  const attack_speed = parseFloat((stats.base_attack_speed * (1 + stats.bonus_attack_speed / 100)).toFixed(2));

  // Velocidad de movimiento con cap 415
  let movement = stats.movement_flat * (1 + stats.movement_pct / 100);
  if (movement > 415) {
    movement = 415 + (movement - 415) * 0.8;
  }
  movement = Math.ceil(movement);

  // Redondeos
  stats.attack_damage = Math.ceil(stats.attack_damage);
  stats.life_reg = parseFloat(stats.life_reg.toFixed(2));
  stats.mana_reg = parseFloat(stats.mana_reg.toFixed(2));
  stats.life = Math.round(stats.life);
  stats.mana = Math.round(stats.mana);
  stats.ability_power = parseFloat(stats.ability_power.toFixed(1));

  return { stats, attack_speed, movement };
}

export default function StatsPanel({ champion, items, runes = [] }) {
  const { stats, attack_speed, movement } = calcStats(champion, items, runes);
  const champName = champion?.name || '';
  const manaLabels = getManaLabel(champName);
  const hasItems = items.length > 0;

  const rows = [
    { label: 'Vida',                          value: stats.life },
    { label: 'Regeneración de vida',           value: stats.life_reg },
    ...(manaLabels.resource ? [{ label: manaLabels.resource, value: stats.mana }] : []),
    ...(manaLabels.resourceReg ? [{ label: manaLabels.resourceReg, value: stats.mana_reg }] : []),
    { label: 'Velocidad de movimiento',        value: movement },
    { label: 'Armadura',                       value: stats.armor },
    { label: 'Resistencia mágica',             value: stats.magic_res },
    { label: 'Daño de ataque',                 value: stats.attack_damage },
    { label: 'Velocidad de ataque',            value: attack_speed },
    { label: 'Poder de habilidad',             value: stats.ability_power },
    { label: 'Velocidad de habilidades',       value: stats.ability_haste },
    { label: 'Impacto crítico',                value: stats.critical_impact,               unit: '%' },
    { label: 'Daño crítico',                   value: stats.critical_damage,               unit: '%' },
    { label: 'Vampirismo físico',              value: stats.physic_vamp,                   unit: '%' },
    { label: 'Vampirismo mágico',              value: stats.magic_vamp,                    unit: '%' },
    { label: 'Penetración de armadura',        value: stats.flat_armor_penetration },
    { label: 'Penetración de armadura %',      value: stats.percentage_armor_penetration,  unit: '%' },
    { label: 'Penetración mágica',             value: stats.flat_magic_penetration },
    { label: 'Penetración mágica %',           value: stats.percentage_magic_penetration,  unit: '%' },
    { label: 'Tenacidad',                      value: stats.tenacity,                      unit: '%' },
    { label: 'Curación y escudo',              value: stats.healing_and_shield,            unit: '%' },
  ];

  return (
    <div className="rd-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-px bg-primary/50" />
        <h3 className="rd-card-title">Stats de la Build</h3>
      </div>
      <div>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span className={`text-sm font-bold font-rajdhani ${row.value > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {typeof row.value === 'number' ? row.value : 0}{row.unit || ''}
            </span>
          </div>
        ))}
      </div>
      {(hasItems || runes.length > 0) && (
        <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border/60">
          Stats con {items.length} obj.{runes.length > 0 && ` y ${runes.length} runa${runes.length > 1 ? 's' : ''}`}
        </p>
      )}
    </div>
  );
}