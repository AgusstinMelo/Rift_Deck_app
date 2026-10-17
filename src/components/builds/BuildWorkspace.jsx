import { useState } from 'react';
import EntityHoverCard from '@/components/ui/EntityHoverCard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpells } from '@/hooks/useSpells';
import { useAuth } from '@/lib/AuthContext';
import { createBuild, updateBuild } from '@/api/buildsSupabase';
import { ArrowLeft, ChevronDown, Info, Save, Trash2 } from 'lucide-react';
import ItemPool from './ItemPool';
import ItemBrowser from './ItemBrowser';
import StatsPanel from './StatsPanel';
import RunePicker from './RunePicker';
import TierBadge from '@/components/ui/TierBadge';
import { getTierEntriesForChampion } from '@/utils/tierlist';
import PatchSelect from '@/components/patches/PatchSelect';

export default function BuildWorkspace({ champion, tierEntries, items, runes, patches, patchVersion, onPatchChange, existingBuild, onBack }) {
  const isEditing = !!existingBuild;
  const { user } = useAuth();
  const { data: spells = [] } = useSpells();

  // When editing, resolve item names back to item objects
  const initialItems = isEditing
    ? (existingBuild.items || []).map(name => items.find(i => i.name === name)).filter(Boolean)
    : [];

  const [selectedItems, setSelectedItems] = useState(initialItems);
  // selectedRunes are initialized lazily once rune data is available (handled in RunePicker via initialRuneNames)
  const [selectedRunes, setSelectedRunes] = useState([]);
  const initialRuneNames = isEditing ? (existingBuild.additional_runes || []) : [];
  const [selectedSpells, setSelectedSpells] = useState(isEditing ? (existingBuild.spells || []) : []);
  const [buildName, setBuildName] = useState(isEditing ? existingBuild.name : `Build de ${champion.name}`);
  const [lane, setLane] = useState(isEditing ? existingBuild.lane || '' : champion.lane?.[0] || '');
  const [saved, setSaved] = useState(false);

  const toggleRune = (rune) => {
    setSelectedRunes(prev =>
      prev.some(r => r.id === rune.id)
        ? prev.filter(r => r.id !== rune.id)
        : [...prev, rune]
    );
  };
  const qc = useQueryClient();

  const championTierEntries = getTierEntriesForChampion(champion, tierEntries);
  const tierEntry = championTierEntries.find(t => !lane || t.lane === lane) || championTierEntries[0];

  const isMobilityBoots = (item) =>
    item && item.category === 'Nivel Medio' && Array.isArray(item.type) && item.type.includes('Movimiento');
  const isEnchantItem = (item) =>
    item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');
  const isMovementItem = (item) =>
    item && Array.isArray(item.type) && item.type.includes('Movimiento');

  // Items that can only appear once regardless of category
  const UNIQUE_ITEMS = ['escudo reliquia', 'hoz espectral', 'guadaña de niebla oscura', 'baluarte de la montaña'];
  const isUniqueItem = (item) =>
    UNIQUE_ITEMS.includes(item?.name?.toLowerCase());

  const canAdd = (item) => {
    const enchantment = isEnchantItem(item);
    const movement = isMovementItem(item);
    const normalCount = selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length;
    const hasMovement = selectedItems.some(isMovementItem);

    // Enchantment: requires boots, only 1 allowed
    if (enchantment) {
      return selectedItems.some(isMobilityBoots) && !selectedItems.some(isEnchantItem);
    }

    // Movement (boots): only 1 allowed
    if (movement) {
      return !hasMovement;
    }

    // Normal item: max 5
    if (normalCount >= 5) return false;

    // Unique group: mutually exclusive
    if (isUniqueItem(item) && selectedItems.some(i => isUniqueItem(i))) return false;

    // Mejorado: no repeat
    if (item.category === 'Mejorado' && selectedItems.some(i => i?.id === item.id)) return false;

    return true;
  };

  const addItem = (item) => {
    if (!canAdd(item)) return;
    setSelectedItems(prev => [...prev, item]);
  };

  const removeItem = (index, index2) => {
    if (index2 !== undefined) {
      setSelectedItems(prev => prev.filter((_, i) => i !== index && i !== index2));
    } else {
      setSelectedItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const data = {
        name: buildName,
        champion_name: champion.name,
        champion_id: champion.id,
        lane: lane || (champion.lane?.[0] || ''),
        items: selectedItems.map(i => i.name),
        additional_runes: selectedRunes.map(r => r.name),
        spells: selectedSpells,
        patch: patchVersion || tierEntry?.patch || '',
        user_id: user?.id,
      };
      return isEditing
        ? updateBuild(existingBuild.id, data)
        : createBuild(user, data);
    },
    onSuccess: () => {
      qc.invalidateQueries(['builds']);
      qc.invalidateQueries(['builds', champion.id]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const normalItemCount = selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length;
  const recommendedItems = (champion.recommended_items || [])
    .map(itemName => ({ itemName, item: items.find(it => it.name?.toLowerCase() === itemName?.toLowerCase() || it.id === itemName) }));

  return (
    <div className="rd-page rd-buildws">
      {/* Campeón y controles de la build en una sola franja. */}
      <div className="rd-card rd-buildws-header flex flex-col gap-3 p-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onBack}
            title="Cambiar campeón"
            aria-label="Cambiar campeón"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex items-center justify-center text-lg font-bold text-primary shrink-0">
            {champion.image_url
              ? <img src={champion.image_url} alt={champion.name} className="w-full h-full object-cover" />
              : champion.name?.[0]}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-rajdhani font-bold text-2xl leading-none text-foreground truncate max-w-full">
                {champion.name}
              </h2>
              {tierEntry && <TierBadge tier={tierEntry.tier} size="md" />}
              {(champion.lane || []).map(l => <span key={l} className="text-xs bg-secondary text-foreground px-2 py-0.5 rounded border border-border">{l}</span>)}
              {champion.damage_type && <span className="text-xs text-muted-foreground">{champion.damage_type}</span>}
              {champion.roles && <span className="text-xs text-muted-foreground">{champion.roles}</span>}
            </div>
            {tierEntry && (
              <p className="text-xs text-muted-foreground mt-1">
                WR: <span className="text-foreground">{tierEntry.winrate?.toFixed(1)}%</span>
                <span className="mx-2">·</span>
                PR: <span className="text-foreground">{tierEntry.pickrate?.toFixed(1)}%</span>
                <span className="mx-2">·</span>
                BR: <span className="text-foreground">{tierEntry.banrate?.toFixed(1)}%</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <PatchSelect
            value={patchVersion}
            patches={patches}
            onChange={onPatchChange}
            className="w-full sm:w-40"
          />
          <input
            value={buildName}
            onChange={e => setBuildName(e.target.value)}
            placeholder="Nombre de la build"
            aria-label="Nombre de la build"
            className="bg-secondary/70 border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 transition-all w-full sm:w-48"
          />
          <select
            value={lane}
            onChange={e => setLane(e.target.value)}
            aria-label="Línea"
            className="bg-secondary/70 border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 transition-all w-full sm:w-32"
          >
            <option value="">Línea</option>
            <option value="top">Top</option>
            <option value="jungler">Jungler</option>
            <option value="mid">Mid</option>
            <option value="adc">ADC</option>
            <option value="support">Support</option>
          </select>
          {selectedItems.length > 0 && (
            <button onClick={() => setSelectedItems([])}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/10">
              <Trash2 size={12} /> Limpiar
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !buildName}
            className="flex shrink-0 items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Save size={14} /> {saved ? '¡Guardado!' : 'Guardar Build'}
          </button>
        </div>
      </div>

      {/* Espacio de trabajo: objetos · runas y hechizos · stats. */}
      <div className="rd-buildws-body grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="rd-buildws-items flex min-w-0 flex-col gap-4">
          <div className="rd-card p-4">
            <div className="flex items-center gap-2 mb-3"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Objetos ({normalItemCount}/5 + botas)</h3></div>
            <ItemPool selectedItems={selectedItems} onRemove={removeItem} />
            {recommendedItems.length > 0 && (
              <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recomendados</span>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {recommendedItems.map(({ itemName, item }, i) => (
                    <button key={i} onClick={() => item && selectedItems.length < 6 && addItem(item)}
                      title={item?.name || itemName}
                      className="flex items-center gap-1.5 bg-secondary border border-border px-2 py-1 rounded-lg text-xs text-foreground hover:border-primary/40 transition-colors">
                      {item?.image_url && <img src={item.image_url} alt={item.name} className="w-5 h-5 object-contain" />}
                      <span className="max-w-[8rem] truncate">{item?.name || itemName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ItemBrowser items={items} selectedItems={selectedItems} onSelect={addItem} />
        </div>

        <div className="rd-buildws-side flex min-w-0 flex-col gap-4">
          <RunePicker
            runes={runes}
            selectedRunes={selectedRunes}
            onToggleRune={toggleRune}
            initialRuneNames={initialRuneNames}
            onRunesInitialized={setSelectedRunes}
          />

          <div className="rd-card p-4">
            <p className="text-sm font-semibold text-foreground mb-3">
              Hechizos ({selectedSpells.length}/2)
            </p>
            <div className="grid w-full grid-cols-5 justify-items-center gap-2 sm:[grid-template-columns:repeat(var(--spell-count),minmax(0,1fr))]" style={/** @type {any} */ ({ '--spell-count': spells.length })}>
              {spells.map(spell => {
                const selected = selectedSpells.includes(spell.name);
                const disabled = selectedSpells.length >= 2 && !selected;
                return (
                  <EntityHoverCard key={spell.id} entity={spell} kind="Hechizo">
                    <button
                      type="button"
                      onClick={() => {
                        if (selected) setSelectedSpells(prev => prev.filter(s => s !== spell.name));
                        else if (selectedSpells.length < 2) setSelectedSpells(prev => [...prev, spell.name]);
                      }}
                      aria-disabled={disabled}
                      className={`aspect-square w-full max-w-12 min-w-0 flex items-center justify-center rounded-full transition-all overflow-hidden ${
                        selected ? 'opacity-100 scale-110 ring-2 ring-primary/70 shadow-[0_0_10px_rgba(212,175,55,.45)]' : 'opacity-50 hover:opacity-90'
                      } ${disabled ? '!opacity-25 cursor-not-allowed' : ''}`}
                    >
                      {spell.image_url
                        ? <img src={spell.image_url} alt={spell.name} className="w-full h-full rounded-full object-cover" />
                        : <div className="w-full h-full rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>
                      }
                    </button>
                  </EntityHoverCard>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rd-buildws-stats flex min-w-0 flex-col gap-3 lg:col-span-2 xl:col-span-1">
          <StatsPanel champion={champion} items={selectedItems} runes={selectedRunes} />

          {champion.strategic_notes && (
            <details className="rd-card group p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className="w-5 h-px bg-primary/50" />
                <h3 className="rd-card-title">Notas Estratégicas</h3>
                <span className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                  <span className="group-open:hidden">Ver</span>
                  <span className="hidden group-open:inline">Ocultar</span>
                  <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{champion.strategic_notes}</p>
            </details>
          )}

          <p
            className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground/70"
            title="Las estadísticas presentadas corresponden a cálculos teóricos realizados fuera de combate y bajo condiciones base del campeón a nivel 1. Esta calculadora no contempla determinadas interacciones dinámicas, efectos situacionales, escalados en combate ni modificaciones específicas derivadas de pasivas, acumulaciones o efectos únicos de campeones, objetos y runas."
          >
            <Info size={12} className="shrink-0" />
            Cálculo teórico a nivel 1, fuera de combate (pasá el mouse para más detalle).
          </p>
        </div>
      </div>
    </div>
  );
}
