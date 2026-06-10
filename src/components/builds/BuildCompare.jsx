import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getComparableBuilds } from '@/api/buildsSupabase';
import { ArrowLeft, ChevronDown, Trophy } from 'lucide-react';
import LaneBadge from '@/components/ui/LaneBadge';

// ── stat calculation ──────────────────────────────────────────────────────────
const NO_RESOURCE = ['Aatrox', 'Dr. Mundo', 'Garen', 'Katarina', 'Mordekaiser', 'Rengar', 'Riven', 'Rumble', 'Sett', 'Viego', 'Yasuo', 'Yone'];
const ENERGY_CHAMPS = ['Akali', 'Ambessa', 'Kennen', 'Lee Sin', 'Shen', 'Zed'];
const FURY_CHAMPS = ['Gnar', 'Renekton', 'Shyvana', 'Tryndamere'];

function getManaLabel(n) {
  if (ENERGY_CHAMPS.includes(n)) return { resource: 'Energía', resourceReg: 'Reg. Energía' };
  if (FURY_CHAMPS.includes(n)) return { resource: 'Furia', resourceReg: null };
  if (NO_RESOURCE.includes(n)) return { resource: null, resourceReg: null };
  return { resource: 'Maná', resourceReg: 'Reg. Maná' };
}

function buildBaseStats(c) {
  return {
    base_life: Number(c.life || 0), base_attack_damage: Number(c.attack_damage || 0),
    base_attack_speed: Number(c.attack_speed || 0),
    life: Number(c.life || 0), life_reg: Number(c.life_reg || 0),
    mana: Number(c.mana || 0), mana_reg: Number(c.mana_reg || 0),
    attack_damage: Number(c.attack_damage || 0), bonus_attack_speed: Number(c.bonus_attack_speed || 0),
    armor: Number(c.armor || 0), magic_res: Number(c.magic_res || 0),
    movement_flat: Number(c.movement || 0), movement_pct: 0,
    ability_power: 0, ability_haste: 0, critical_impact: 0, critical_damage: 175,
    physic_vamp: Number(c.physic_vamp || 0), magic_vamp: Number(c.magic_vamp || 0),
    flat_armor_penetration: 0, percentage_armor_penetration: 0,
    flat_magic_penetration: 0, percentage_magic_penetration: 0,
    tenacity: 0, healing_and_shield: 0, percentage_armor: 0, percentage_magic_res: 0,
  };
}

function applySource(s, src) {
  s.life += Number(src.life || 0); s.life_reg += (s.life_reg * Number(src.life_reg || 0)) / 100;
  s.mana += Number(src.mana || 0); s.mana_reg += (s.mana_reg * Number(src.mana_reg || 0)) / 100;
  s.attack_damage += Number(src.attack_damage || 0); s.bonus_attack_speed += Number(src.attack_speed || 0);
  s.armor += Number(src.armor || 0); s.magic_res += Number(src.magic_res || 0);
  s.movement_flat += Number(src.flat_movement || 0); s.movement_pct += Number(src.percentage_movement || 0);
  s.ability_power += Number(src.ability_power || 0); s.ability_haste += Number(src.ability_haste || 0);
  s.critical_impact += Number(src.critical_impact || 0); s.critical_damage += Number(src.critical_damage || 0);
  s.physic_vamp += Number(src.physic_vamp || 0); s.magic_vamp += Number(src.magic_vamp || 0);
  s.flat_armor_penetration += Number(src.flat_armor_penetration || 0);
  s.percentage_armor_penetration += Number(src.percentage_armor_penetration || 0);
  s.flat_magic_penetration += Number(src.flat_magic_penetration || 0);
  s.percentage_magic_penetration += Number(src.percentage_magic_penetration || 0);
  s.tenacity += Number(src.tenacity || 0); s.healing_and_shield += Number(src.healing_and_shield || 0);
  s.percentage_armor += Number(src.percentage_armor || 0); s.percentage_magic_res += Number(src.percentage_magic_res || 0);
}

function calcStats(champion, items) {
  const c = champion || {};
  const adaptable = items.filter(i => Number(i.adaptable_ad || 0) > 0 || Number(i.adaptable_ap || 0) > 0);
  const normal = items.filter(i => !(Number(i.adaptable_ad || 0) > 0 || Number(i.adaptable_ap || 0) > 0));
  let stats, ad_final = null, ap_final = null;
  for (let iter = 0; iter < adaptable.length + 5; iter++) {
    stats = buildBaseStats(c);
    for (const item of normal) applySource(stats, item);
    for (const item of adaptable) applySource(stats, item);
    const modoAP = stats.ability_power > (stats.attack_damage - stats.base_attack_damage);
    if (modoAP) for (const item of adaptable) stats.ability_power += Number(item.adaptable_ap || 0);
    else for (const item of adaptable) stats.attack_damage += Number(item.adaptable_ad || 0);
    if (stats.attack_damage === ad_final && stats.ability_power === ap_final) break;
    ad_final = stats.attack_damage; ap_final = stats.ability_power;
  }
  stats.armor = Math.round(stats.armor * (1 + stats.percentage_armor / 100));
  stats.magic_res = Math.round(stats.magic_res * (1 + stats.percentage_magic_res / 100));
  const attack_speed = parseFloat((stats.base_attack_speed * (1 + stats.bonus_attack_speed / 100)).toFixed(2));
  let movement = stats.movement_flat * (1 + stats.movement_pct / 100);
  if (movement > 415) movement = 415 + (movement - 415) * 0.8;
  movement = Math.ceil(movement);
  stats.attack_damage = Math.ceil(stats.attack_damage);
  stats.life_reg = parseFloat(stats.life_reg.toFixed(2));
  stats.mana_reg = parseFloat(stats.mana_reg.toFixed(2));
  stats.life = Math.round(stats.life);
  stats.mana = Math.round(stats.mana);
  stats.ability_power = parseFloat(stats.ability_power.toFixed(1));
  return { stats, attack_speed, movement };
}

function getAllRows(champion, computed) {
  if (!computed) return [];
  const { stats, attack_speed, movement } = computed;
  const ml = getManaLabel(champion?.name || '');
  return [
    { label: 'Vida', key: 'life', value: stats.life },
    { label: 'Reg. Vida', key: 'life_reg', value: stats.life_reg },
    ...(ml.resource ? [{ label: ml.resource, key: 'mana', value: stats.mana }] : []),
    ...(ml.resourceReg ? [{ label: ml.resourceReg, key: 'mana_reg', value: stats.mana_reg }] : []),
    { label: 'Mov.', key: 'movement', value: movement },
    { label: 'Armadura', key: 'armor', value: stats.armor },
    { label: 'Res. mágica', key: 'magic_res', value: stats.magic_res },
    { label: 'Daño ataque', key: 'attack_damage', value: stats.attack_damage },
    { label: 'Vel. ataque', key: 'attack_speed', value: attack_speed },
    { label: 'Poder hab.', key: 'ability_power', value: stats.ability_power },
    { label: 'Vel. hab.', key: 'ability_haste', value: stats.ability_haste },
    { label: 'Crítico %', key: 'critical_impact', value: stats.critical_impact, unit: '%' },
    { label: 'Daño crítico', key: 'critical_damage', value: stats.critical_damage, unit: '%' },
    { label: 'Vamp. físico', key: 'physic_vamp', value: stats.physic_vamp, unit: '%' },
    { label: 'Vamp. mágico', key: 'magic_vamp', value: stats.magic_vamp, unit: '%' },
    { label: 'Pen. armad.', key: 'flat_armor_penetration', value: stats.flat_armor_penetration },
    { label: 'Pen. armad. %', key: 'percentage_armor_penetration', value: stats.percentage_armor_penetration, unit: '%' },
    { label: 'Pen. mágica', key: 'flat_magic_penetration', value: stats.flat_magic_penetration },
    { label: 'Pen. mágica %', key: 'percentage_magic_penetration', value: stats.percentage_magic_penetration, unit: '%' },
    { label: 'Tenacidad', key: 'tenacity', value: stats.tenacity, unit: '%' },
    { label: 'Cur. y escudo', key: 'healing_and_shield', value: stats.healing_and_shield, unit: '%' },
  ];
}

function getCategoryWinners(computedA, computedB, buildA, buildB) {
  if (!computedA || !computedB) return [];
  const sA = computedA.stats; const sB = computedB.stats;
  const nameA = buildA?.name || 'Build A';
  const nameB = buildB?.name || 'Build B';
  const totalDmgA = sA.attack_damage + sA.ability_power;
  const totalDmgB = sB.attack_damage + sB.ability_power;
  const survA = sA.life + sA.armor * 10 + sA.magic_res * 8;
  const survB = sB.life + sB.armor * 10 + sB.magic_res * 8;
  return [
    { label: 'Mayor daño', icon: '⚔️', winner: totalDmgA >= totalDmgB ? nameA : nameB },
    { label: 'Más aguante', icon: '🛡️', winner: survA >= survB ? nameA : nameB },
    { label: 'Más movilidad', icon: '💨', winner: computedA.movement >= computedB.movement ? nameA : nameB },
    { label: 'Más utilidad', icon: '⚡', winner: (sA.ability_haste + sA.healing_and_shield) >= (sB.ability_haste + sB.healing_and_shield) ? nameA : nameB },
  ];
}

// ── Build Selector ────────────────────────────────────────────────────────────
function BuildSelector({ slot, allBuilds, allChampions, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const label = selected ? `${selected.champion_name} — ${selected.name}` : `Elegir build (${slot})`;
  const champ = selected ? allChampions.find(c => c.name === selected.champion_name) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full bg-secondary/70 border border-border rounded-xl px-4 py-3 text-sm text-foreground hover:border-primary/40 transition-all"
      >
        {champ?.image_url && <img src={champ.image_url} alt={champ.name} className="w-6 h-6 rounded-full object-cover shrink-0" />}
        <span className="flex-1 text-left font-medium truncate">{label}</span>
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
          {allBuilds.length === 0 && <p className="text-xs text-muted-foreground p-4 text-center">No hay builds guardadas.</p>}
          {allBuilds.map(build => {
            const c = allChampions.find(ch => ch.name === build.champion_name);
            return (
              <button key={build.id} onClick={() => { onSelect(build); setOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-secondary transition-colors text-left">
                {c?.image_url
                  ? <img src={c.image_url} alt={c.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-primary shrink-0">{build.champion_name?.[0]}</div>}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{build.name}</p>
                  <p className="text-xs text-muted-foreground">{build.champion_name}{build.lane && ` · ${build.lane}`}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Champion Header Card ──────────────────────────────────────────────────────
function ChampionHeader({ build, champion, side, itemCount }) {
  if (!build || !champion) {
    return (
      <div className="flex-1 rounded-2xl border border-dashed border-border bg-secondary/30 p-5 flex items-center justify-center min-h-28">
        <p className="text-muted-foreground text-sm">Sin build seleccionada</p>
      </div>
    );
  }

  const isRight = side === 'right';
  const gradientClass = isRight ? 'bg-gradient-to-l from-accent/20 to-transparent' : 'bg-gradient-to-r from-primary/20 to-transparent';
  const borderClass = isRight ? 'border-accent/30' : 'border-primary/30';

  return (
    <div className={`flex-1 relative overflow-hidden rounded-2xl border ${borderClass} ${gradientClass} p-4`}>
      <div className={`flex items-center gap-4 ${isRight ? 'flex-row-reverse' : ''}`}>
        <div className={`w-16 h-16 rounded-full overflow-hidden border-2 shrink-0 ${isRight ? 'border-accent/60' : 'border-primary/60'}`}>
          {champion.image_url
            ? <img src={champion.image_url} alt={champion.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-muted flex items-center justify-center font-bold text-xl text-primary">{champion.name[0]}</div>}
        </div>
        <div className={`flex-1 min-w-0 ${isRight ? 'text-right' : ''}`}>
          <h3 className="font-rajdhani font-bold text-xl text-foreground truncate">{champion.name} — {build.name}</h3>
          <div className={`flex items-center gap-2 mt-1 ${isRight ? 'justify-end' : ''}`}>
            {build.lane && <LaneBadge lane={build.lane} />}
          </div>
          <div className={`flex items-center gap-3 mt-2 text-xs text-muted-foreground ${isRight ? 'justify-end' : ''}`}>
            <span>🗡️ {itemCount} ítems</span>
            {build.patch && <span>Parche {build.patch}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BuildCompare({ onBack, champions, items }) {
  const { user } = useAuth();
  const [buildA, setBuildA] = useState(null);
  const [buildB, setBuildB] = useState(null);

  const { data: allBuilds = [] } = useQuery({
    queryKey: ['builds-all', user?.id],
    queryFn: () => getComparableBuilds(user, 1000),
  });

  const resolveItems = (build) => build ? (build.items || []).map(name => items.find(i => i.name === name)).filter(Boolean) : [];
  const resolveChampion = (build) => build ? champions.find(c => c.name === build.champion_name) || null : null;

  const champA = resolveChampion(buildA);
  const champB = resolveChampion(buildB);
  const itemsA = resolveItems(buildA);
  const itemsB = resolveItems(buildB);

  const computedA = champA ? calcStats(champA, itemsA) : null;
  const computedB = champB ? calcStats(champB, itemsB) : null;
  const canCompare = computedA && computedB;

  // Merge all stat rows from both champions
  const rowsA = getAllRows(champA, computedA);
  const rowsB = getAllRows(champB, computedB);
  const rowMapA = Object.fromEntries(rowsA.map(r => [r.key, r]));
  const rowMapB = Object.fromEntries(rowsB.map(r => [r.key, r]));
  const allKeys = [...new Set([...rowsA.map(r => r.key), ...rowsB.map(r => r.key)])];

  const categoryWinners = getCategoryWinners(computedA, computedB, buildA, buildB);

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors mb-6">
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="flex items-center gap-2 mb-1"><span className="w-8 h-px bg-primary/50" /><span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Build Calculator</span></div>
      <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase mb-1">Comparar Builds</h1>
      <p className="text-muted-foreground text-sm mb-6">Compará las estadísticas de dos builds, del mismo campeón o de campeones distintos.</p>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <BuildSelector slot="A" allBuilds={allBuilds} allChampions={champions} selected={buildA} onSelect={setBuildA} />
        <BuildSelector slot="B" allBuilds={allBuilds} allChampions={champions} selected={buildB} onSelect={setBuildB} />
      </div>

      {/* Champion Headers */}
      <div className="flex items-stretch gap-4 mb-6">
        <ChampionHeader build={buildA} champion={champA} side="left" itemCount={itemsA.length} />
        <div className="flex items-center justify-center shrink-0">
          <div className="bg-card border border-border rounded-full w-12 h-12 flex items-center justify-center">
            <span className="font-rajdhani font-bold text-lg text-primary">VS</span>
          </div>
        </div>
        <ChampionHeader build={buildB} champion={champB} side="right" itemCount={itemsB.length} />
      </div>


      {/* Stats table */}
      {canCompare && (
        <div className="rd-card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[125px_1fr_250px_1fr] gap-0 px-4 py-3 border-b border-border bg-secondary/30">
            <div />
            <div className="text-right pr-10">
              <span className="text-sm font-semibold text-primary truncate">{buildA?.name || 'Build A'}</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Diferencia</span>
            </div>
            <div className="text-left pl-10">
              <span className="text-sm font-semibold text-accent truncate">{buildB?.name || 'Build B'}</span>
            </div>
          </div>

          {/* Rows */}
          {allKeys.map((key, i) => {
            const rA = rowMapA[key];
            const rB = rowMapB[key];
            const label = rA?.label || rB?.label || key;
            const unit = rA?.unit || rB?.unit || '';
            const valA = typeof rA?.value === 'number' ? rA.value : 0;
            const valB = typeof rB?.value === 'number' ? rB.value : 0;
            const diff = valA - valB;
            const aWins = diff > 0;
            const bWins = diff < 0;

            const fmt = (v) => `${v}${unit}`;
            const diffText = diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff % 1 !== 0 ? diff.toFixed(2) : diff}${unit}`;
            const diffColor = diff === 0 ? 'text-muted-foreground' : diff > 0 ? 'text-green-400' : 'text-red-400';

            return (
              <div key={key} className={`grid grid-cols-[125px_1fr_250px_1fr] items-center px-4 py-2.5 border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/20'}`}>
                {/* Stat label */}
                <span className="text-xs text-muted-foreground">{label}</span>

                {/* Value A */}
                <div className="flex items-center justify-end gap-1.5 pr-10">
                  {aWins && <span className="text-xs text-primary">👑</span>}
                  <span className={`text-sm font-bold font-rajdhani ${aWins ? 'text-primary' : 'text-foreground'}`}>
                    {fmt(valA)}
                  </span>
                </div>

                {/* Diff */}
                <div className="text-center">
                  <p className={`text-xs font-bold ${diffColor}`}>{diffText}</p>
                </div>

                {/* Value B */}
                <div className="flex items-center justify-start gap-1.5 pl-10">
                  <span className={`text-sm font-bold font-rajdhani ${bWins ? 'text-accent' : 'text-foreground'}`}>
                    {fmt(valB)}
                  </span>
                  {bWins && <span className="text-xs text-accent">👑</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canCompare && (buildA || buildB) && (
        <div className="rd-card text-center py-12 text-muted-foreground text-sm">
          Seleccioná las dos builds para ver la comparación.
        </div>
      )}

      {!buildA && !buildB && (
        <div className="rd-card text-center py-16 text-muted-foreground text-sm">
          Seleccioná dos builds para comenzar la comparación.
        </div>
      )}
    </div>
  );
}
