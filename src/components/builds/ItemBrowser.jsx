import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'Todos' },
  { key: 'Básico', label: 'Básico' },
  { key: 'Nivel Medio', label: 'Nivel Medio' },
  { key: 'Mejorado', label: 'Mejorado' },
];

const TYPE_ORDER = [
  'Daño Físico',
  'Daño Mágico',
  'Defensa',
  'Vida',
  'Crítico',
  'Velocidad de Ataque',
  'Movimiento',
  'Soporte',
  'Encantamiento',
];

const UNIQUE_ITEMS = ['escudo reliquia', 'hoz espectral', 'guadaña de niebla oscura', 'baluarte de la montaña'];
const ITEM_STATS = [
  { key: 'life', label: 'Vida', color: 'text-green-400' },
  { key: 'life_reg', label: 'Reg. de vida', color: 'text-green-400' },
  { key: 'mana', label: 'Maná', color: 'text-sky-300' },
  { key: 'mana_reg', label: 'Reg. de maná', color: 'text-sky-300' },
  { key: 'attack_damage', label: 'Daño de ataque', color: 'text-orange-400' },
  { key: 'physical_damage', label: 'Daño físico', color: 'text-orange-700' },
  { key: 'magic_damage', label: 'Daño mágico', color: 'text-cyan-400' },
  { key: 'true_damage', label: 'Daño verdadero', color: 'text-white' },
  { key: 'attack_speed', label: 'Vel. de ataque', unit: '%', color: 'text-yellow-200' },
  { key: 'ability_power', label: 'Poder de habilidad', color: 'text-violet-400' },
  { key: 'armor', label: 'Armadura', color: 'text-yellow-400' },
  { key: 'magic_res', label: 'Resist. mágica' },
  { key: 'flat_movement', label: 'Vel. de movimiento', color: 'text-white' },
  { key: 'percentage_movement', label: 'Vel. de movimiento', unit: '%', color: 'text-white' },
  { key: 'critical_impact', label: 'Prob. de crítico', unit: '%', color: 'text-red-400' },
  { key: 'critical_damage', label: 'Daño crítico', unit: '%', color: 'text-red-400' },
  { key: 'physic_vamp', label: 'Vamp. físico', unit: '%', color: 'text-green-300' },
  { key: 'magic_vamp', label: 'Vamp. mágico', unit: '%', color: 'text-green-300' },
  { key: 'flat_armor_penetration', label: 'Pen. de armadura', color: 'text-red-300' },
  { key: 'percentage_armor_penetration', label: 'Pen. de armadura', unit: '%', color: 'text-red-300' },
  { key: 'flat_magic_penetration', label: 'Pen. mágica' },
  { key: 'percentage_magic_penetration', label: 'Pen. mágica', unit: '%' },
  { key: 'ability_haste', label: 'Aceleración de habilidad', color: 'text-white' },
  { key: 'tenacity', label: 'Tenacidad', unit: '%', color: 'text-violet-700' },
  { key: 'healing_and_shield', label: 'Curación y escudo', unit: '%', color: 'text-green-300' },
  { key: 'adaptable_ad', label: 'Daño adaptable', color: 'text-orange-400' },
  { key: 'adaptable_ap', label: 'Poder adaptable', color: 'text-violet-400' },
];

const getActiveStats = (item) => ITEM_STATS.filter(({ key }) => {
  const value = Number(item?.[key]);
  return Number.isFinite(value) && value !== 0;
});

const normalizeSearch = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getItemTypes = (item) => {
  if (Array.isArray(item?.type)) return item.type.filter(Boolean);
  if (typeof item?.type === 'string' && item.type.trim()) return [item.type.trim()];
  return [];
};

const sortItemTypes = (a, b) => {
  const indexA = TYPE_ORDER.findIndex(type => type.toLowerCase() === a.toLowerCase());
  const indexB = TYPE_ORDER.findIndex(type => type.toLowerCase() === b.toLowerCase());

  if (indexA !== -1 || indexB !== -1) {
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  }

  return a.localeCompare(b);
};

const isEnchant = (item) =>
  item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');
const isMovement = (item) =>
  item && Array.isArray(item.type) && item.type.includes('Movimiento');
const isMobilityBoots = (item) =>
  item && item.category === 'Nivel Medio' && Array.isArray(item.type) && item.type.includes('Movimiento');

function getLockReason(item, selectedItems) {
  const enchant = isEnchant(item);
  const movement = isMovement(item);
  const normalCount = selectedItems.filter(i => !isEnchant(i) && !isMovement(i)).length;
  const hasMovement = selectedItems.some(isMovement);

  if (enchant) {
    if (!selectedItems.some(isMobilityBoots)) return 'Requiere botas de Movimiento primero';
    if (selectedItems.some(isEnchant)) return 'Ya tienes un encantamiento';
    return null;
  }

  if (movement) {
    if (hasMovement) return 'Solo 1 item de movimiento por build';
    return null;
  }

  if (normalCount >= 5) return 'Máximo 5 objetos normales (el 6° slot es para botas)';

  if (UNIQUE_ITEMS.includes(item?.name?.toLowerCase()) &&
      selectedItems.some(i => UNIQUE_ITEMS.includes(i?.name?.toLowerCase())))
    return 'Solo puedes llevar 1 de estos 4 items';

  if (item.category === 'Mejorado' && selectedItems.some(i => i?.id === item.id))
    return 'Los items Mejorados no se pueden repetir';

  return null;
}

function canAddItem(item, selectedItems) {
  const enchantment = isEnchant(item);
  const movement = isMovement(item);
  // Non-movement, non-enchantment items
  const normalCount = selectedItems.filter(i => !isEnchant(i) && !isMovement(i)).length;
  const hasMovement = selectedItems.some(isMovement);

  if (enchantment) {
    return selectedItems.some(isMobilityBoots) && !selectedItems.some(isEnchant);
  }

  // Movement item (boots): allowed only if no movement item yet, and normal slots not exceeded
  if (movement) {
    if (hasMovement) return false;
    return true;
  }

  // Normal item: max 5 slots
  if (normalCount >= 5) return false;
  // Only 1 of the unique group allowed in total (mutually exclusive)
  if (UNIQUE_ITEMS.includes(item?.name?.toLowerCase()) &&
      selectedItems.some(i => UNIQUE_ITEMS.includes(i?.name?.toLowerCase()))) return false;
  if (item.category === 'Mejorado' && selectedItems.some(i => i?.id === item.id)) return false;

  return true;
}

export default function ItemBrowser({ items, selectedItems, onSelect }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tooltip, setTooltip] = useState(null);

  const showTooltip = (event, item, lockReason) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 24);
    const wouldOverflowRight = rect.left + tooltipWidth > window.innerWidth - 12;
    const left = wouldOverflowRight
      ? Math.max(12, rect.right - tooltipWidth)
      : Math.max(12, rect.left);
    const placeBelow = rect.top < Math.min(300, window.innerHeight / 2);

    setTooltip({
      item,
      lockReason,
      position: placeBelow
        ? { top: rect.bottom + 8, left, width: tooltipWidth }
        : { bottom: window.innerHeight - rect.top + 8, left, width: tooltipWidth },
    });
  };

  const canAddEnchantment = selectedItems.some(isMobilityBoots) && !selectedItems.some(isEnchant);
  const itemTypes = [...new Set(items.flatMap(getItemTypes))].sort(sortItemTypes);

  const filtered = items.filter(item => {
    const normalizedSearch = normalizeSearch(search);
    const matchSearch = !normalizedSearch || normalizeSearch(item.name).includes(normalizedSearch);
    const matchCat = category === 'all' || (item.category && item.category.toLowerCase() === category.toLowerCase());
    const matchType = typeFilter === 'all' || getItemTypes(item).some(type => type.toLowerCase() === typeFilter.toLowerCase());
    return matchSearch && matchCat && matchType;
  });

  return (
    <div className="rd-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-px bg-primary/50" />
        <h3 className="rd-card-title">Items</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-36">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar item..."
            className="w-full bg-secondary/70 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-all" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${category === cat.key ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-secondary/70 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-all"
        >
          <option value="all">Todos los tipos</option>
          {itemTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-52 overflow-y-auto pr-1">
          {filtered.map(item => {
            const itemIsEnchant = isEnchant(item);
            const addable = canAddItem(item, selectedItems);
            const lockReason = !addable ? getLockReason(item, selectedItems) : null;
            // Items already in build: show as selected (dimmed ring), still "not disabled" for context
            const alreadyInBuild = selectedItems.some(s => s?.id === item.id) && item.category !== 'Básico' && item.category !== 'Nivel Medio';
            const isDisabled = !addable;

            return (
              <div
                key={item.id}
                className="relative group"
                onMouseEnter={event => showTooltip(event, item, lockReason)}
                onMouseLeave={() => setTooltip(null)}
              >
                <button
                  onClick={() => addable && onSelect(item)}
                  disabled={isDisabled}
                  aria-label={item.name}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all
                    ${alreadyInBuild ? 'ring-2 ring-primary opacity-60' : ''}
                    ${isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
                    ${itemIsEnchant && canAddEnchantment ? 'border-purple-400/50' : 'border-border'}
                    bg-secondary/20`}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-10 h-10 object-contain rounded" />
                    : <span className="text-xs font-bold text-primary px-0.5 text-center leading-tight">{item.name?.slice(0, 5)}</span>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Item tooltip */}
        {tooltip && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed z-[100] pointer-events-none"
            style={tooltip.position}
          >
            <div className="bg-popover border border-primary/25 rounded-xl p-3 shadow-2xl w-full">
              <div className="flex items-start gap-3">
                {tooltip.item.image_url && <img src={tooltip.item.image_url} alt="" className="w-11 h-11 object-contain rounded-lg border border-border bg-secondary/30 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm leading-tight">{tooltip.item.name}</p>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1">
                    {tooltip.item.category && <span className="text-[11px] text-muted-foreground">{tooltip.item.category}</span>}
                    {tooltip.item.price != null && <span className="text-[11px] text-primary font-semibold">{tooltip.item.price} oro</span>}
                  </div>
                </div>
              </div>
              {getActiveStats(tooltip.item).length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-2.5 border-t border-border/70">
                  {getActiveStats(tooltip.item).map(({ key, label, unit, color }) => (
                    <div key={key} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="text-muted-foreground truncate">{label}</span>
                      <span className={`${color || 'text-primary'} font-semibold shrink-0`}>+{tooltip.item[key]}{unit || ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {tooltip.item.description && (
                <p className="mt-3 pt-2.5 border-t border-border/70 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                  {String(tooltip.item.description).replace(/\\n/g, '\n')}
                </p>
              )}
              {getItemTypes(tooltip.item).length > 0 && <p className="mt-2 text-[10px] text-muted-foreground/80">{getItemTypes(tooltip.item).join(' / ')}</p>}
              {tooltip.lockReason && <p className="mt-2 rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[10px] text-amber-300">{tooltip.lockReason}</p>}
            </div>
          </div>,
          document.body,
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-xs text-center py-6">No se encontraron items</p>
      )}
    </div>
  );
}
