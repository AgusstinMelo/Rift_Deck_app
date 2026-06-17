import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSpells } from '@/hooks/useSpells';
import { useAuth } from '@/lib/AuthContext';
import { createBuild, updateBuild } from '@/api/buildsSupabase';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import ItemPool from './ItemPool';
import ItemBrowser from './ItemBrowser';
import StatsPanel from './StatsPanel';
import RunePicker from './RunePicker';
import LaneBadge from '@/components/ui/LaneBadge';
import TierBadge from '@/components/ui/TierBadge';
import { getTierEntriesForChampion } from '@/utils/tierlist';

export default function BuildWorkspace({ champion, tierEntries, items, existingBuild, onBack }) {
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
        patch: tierEntry?.patch || '',
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

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft size={16} /> Cambiar campeón
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Champion + Item Pool */}
        <div className="lg:col-span-2 space-y-4">
          {/* Champion Card */}
          <div className="rd-card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xl font-bold text-primary shrink-0">
              {champion.image_url
                ? <img src={champion.image_url} alt={champion.name} className="w-full h-full object-cover" />
                : champion.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-rajdhani font-bold text-2xl text-foreground truncate max-w-full">
                  {champion.name}
                </h2>
                {tierEntry && <TierBadge tier={tierEntry.tier} size="md" />}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
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

            {/* Build name & lane selector inline */}
            <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
              <input
                value={buildName}
                onChange={e => setBuildName(e.target.value)}
                className="bg-secondary/70 border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 transition-all w-full sm:w-48"
              />
              <select
                value={lane}
                onChange={e => setLane(e.target.value)}
                className="bg-secondary/70 border border-border rounded-xl px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 transition-all w-full sm:w-48"
              >
                <option value="">Línea</option>
                <option value="top">Top</option>
                <option value="jungler">Jungler</option>
                <option value="mid">Mid</option>
                <option value="adc">ADC</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>

          {/* Rune Picker */}
          <RunePicker
            selectedRunes={selectedRunes}
            onToggleRune={toggleRune}
            initialRuneNames={initialRuneNames}
            onRunesInitialized={setSelectedRunes}
          />

          {/* Item Pool */}
          <div className="rd-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Objetos ({selectedItems.filter(i => !isEnchantItem(i) && !isMovementItem(i)).length}/5 + botas)</h3></div>
            </div>
            <ItemPool selectedItems={selectedItems} onRemove={removeItem} />
          </div>

          {/* Item Browser */}
          <ItemBrowser items={items} selectedItems={selectedItems} onSelect={addItem} />

          {/* Hechizos */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-3">
              Hechizos ({selectedSpells.length}/2)
            </label>
            <div className="flex gap-2 w-full overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
              {spells.map(spell => {
                const selected = selectedSpells.includes(spell.name);
                const disabled = selectedSpells.length >= 2 && !selected;
                return (
                  <button
                    key={spell.id}
                    type="button"
                    onClick={() => {
                      if (selected) setSelectedSpells(prev => prev.filter(s => s !== spell.name));
                      else if (selectedSpells.length < 2) setSelectedSpells(prev => [...prev, spell.name]);
                    }}
                    disabled={disabled}
                    title={spell.name}
                    className={`shrink-0 w-11 h-11 sm:w-auto sm:h-auto sm:flex-1 flex items-center justify-center p-1 rounded-full sm:rounded-xl border-2 transition-all overflow-hidden ${
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {spell.image_url
                      ? <img src={spell.image_url} alt={spell.name} className="w-9 h-9 sm:w-8 sm:h-8 rounded-full object-cover" />
                      : <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary">{spell.name[0]}</div>
                    }
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {selectedItems.length > 0 && (
              <button onClick={() => setSelectedItems([])}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10">
                <Trash2 size={12} /> Limpiar
              </button>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !buildName}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              <Save size={12} /> {saved ? '¡Guardado!' : 'Guardar Build'}
            </button>
          </div>
          <StatsPanel champion={champion} items={selectedItems} runes={selectedRunes} />

          {/* Champion strategic notes */}
          {champion.strategic_notes && (
            <div className="rd-card p-4">
              <div className="flex items-center gap-2 mb-2"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Notas Estratégicas</h3></div>
              <p className="text-xs text-muted-foreground leading-relaxed">{champion.strategic_notes}</p>
            </div>
          )}

          {/* Recommended items from champion data */}
          {(champion.recommended_items || []).length > 0 && (
            <div className="rd-card p-4">
              <div className="flex items-center gap-2 mb-3"><span className="w-5 h-px bg-primary/50" /><h3 className="rd-card-title">Items Recomendados</h3></div>
              <div className="flex flex-wrap gap-2">
                {champion.recommended_items.map((itemName, i) => {
                  const item = items.find(it => it.name?.toLowerCase() === itemName?.toLowerCase() || it.id === itemName);
                  return (
                    <button key={i} onClick={() => item && selectedItems.length < 6 && addItem(item)}
                      className="flex items-center gap-1.5 bg-secondary border border-border px-2 py-1.5 rounded-lg text-xs text-foreground hover:border-primary/40 transition-colors">
                      {item?.image_url && <img src={item.image_url} alt={item.name} className="w-5 h-5 object-contain" />}
                      {item?.name || itemName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Stats disclaimer */}
          <p className="text-[12px] leading-relaxed text-muted-foreground/60 px-1">
            Las estadísticas presentadas corresponden a cálculos teóricos realizados fuera de combate y bajo condiciones base del campeón a nivel 1. Esta calculadora no contempla determinadas interacciones dinámicas, efectos situacionales, escalados en combate ni modificaciones específicas derivadas de pasivas, acumulaciones o efectos únicos de campeones, objetos y runas.
          </p>
        </div>
      </div>
    </div>
  );
}
