import { useState } from 'react';
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

  const canAddEnchantment = selectedItems.some(isMobilityBoots) && !selectedItems.some(isEnchant);
  const itemTypes = [...new Set(items.flatMap(getItemTypes))].sort(sortItemTypes);

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
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
              <div key={item.id} className="relative group">
                <button
                  onClick={() => addable && onSelect(item)}
                  onMouseEnter={() => setTooltip(item)}
                  onMouseLeave={() => setTooltip(null)}
                  disabled={isDisabled}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all
                    ${alreadyInBuild ? 'ring-2 ring-primary opacity-60' : ''}
                    ${isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
                    ${itemIsEnchant && canAddEnchantment ? 'border-purple-400/50' : 'border-border'}
                    bg-secondary/20`}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-10 h-10 object-contain rounded" />
                    : <span className="text-xs font-bold text-primary px-0.5 text-center leading-tight">{item.name?.slice(0, 5)}</span>}
                </button>

                {/* Lock reason tooltip */}
                {lockReason && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none">
                    <div className="bg-popover border border-border rounded-lg px-2 py-1 text-[10px] text-muted-foreground whitespace-nowrap shadow-lg">
                      {lockReason}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Item tooltip */}
        {tooltip && (
          <div className="absolute bottom-full left-0 mb-2 z-50 pointer-events-none">
            <div className="bg-popover border border-border rounded-xl p-3 shadow-xl min-w-48 max-w-64">
              <p className="font-semibold text-foreground text-sm mb-1">{tooltip.name}</p>
              {tooltip.category && <span className="text-xs text-muted-foreground capitalize">{tooltip.category}</span>}
              {tooltip.price && <span className="text-xs text-primary ml-2 font-semibold">{tooltip.price}g</span>}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-xs text-center py-6">No se encontraron items</p>
      )}
    </div>
  );
}
