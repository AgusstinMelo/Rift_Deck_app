import { X, Plus, Footprints } from 'lucide-react';

const NORMAL_SLOTS = 5;

const CATEGORY_COLOR = {
  'Básico': 'border-green-400/40 bg-green-400/5',
  'Nivel Medio': 'border-blue-400/40 bg-blue-400/10',
  'Mejorado': 'border-yellow-400/60 bg-yellow-400/10',
};

const isMobilityBoots = (item) =>
  item && item.category === 'Nivel Medio' && Array.isArray(item.type) && item.type.includes('Movimiento');
const isMovement = (item) =>
  item && Array.isArray(item.type) && item.type.includes('Movimiento');
const isEnchantment = (item) =>
  item && item.category === 'Mejorado' && Array.isArray(item.type) && item.type.includes('Encantamiento');

// Separate items into normal slots and the movement/enchant slot
function buildDisplaySlots(selectedItems) {
  const normalItems = [];
  let movementItem = null;
  let enchantItem = null;

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    if (isEnchantment(item)) {
      enchantItem = { item, index: i };
    } else if (isMovement(item)) {
      movementItem = { item, index: i };
    } else {
      normalItems.push({ item, index: i });
    }
  }

  return { normalItems, movementItem, enchantItem };
}

export default function ItemPool({ selectedItems, onRemove }) {
  const { normalItems, movementItem, enchantItem } = buildDisplaySlots(selectedItems);
  const emptyNormalCount = Math.max(0, NORMAL_SLOTS - normalItems.length);
  const hasMovementSlot = movementItem || enchantItem;

  const renderItem = (slot) => {
    const { item, index } = slot;
    return (
      <div
        key={index}
        className={`relative w-16 h-16 rounded-xl border-2 flex items-center justify-center transition-all
          ${CATEGORY_COLOR[item.category] || 'border-primary/30 bg-secondary/30'}`}
      >
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-10 h-10 object-contain rounded" />
          : <span className="text-xs font-bold text-primary text-center px-1 leading-tight">{item.name?.slice(0, 6)}</span>}
        <button
          onClick={() => onRemove(index)}
          className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-20">
          <X size={9} className="text-white" />
        </button>
      </div>
    );
  };

  // Movement slot: show enchant as main + boots badge, or just boots, or empty reserved slot
  const renderMovementSlot = () => {
    if (enchantItem && movementItem) {
      // Both boots + enchantment: merged slot
      return (
        <div className="relative w-16 h-16 rounded-xl border-2 border-purple-400/50 bg-purple-400/10 flex items-center justify-center transition-all">
          {enchantItem.item.image_url
            ? <img src={enchantItem.item.image_url} alt={enchantItem.item.name} className="w-10 h-10 object-contain rounded" />
            : <span className="text-xs font-bold text-primary text-center px-1 leading-tight">{enchantItem.item.name?.slice(0, 6)}</span>}
          {/* Boots badge */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-md border border-blue-400/50 bg-card overflow-hidden shadow-md z-10" title={movementItem.item.name}>
            {movementItem.item.image_url
              ? <img src={movementItem.item.image_url} alt={movementItem.item.name} className="w-full h-full object-contain" />
              : <span className="text-[8px] font-bold text-blue-300 leading-tight text-center block">{movementItem.item.name?.[0]}</span>}
          </div>
          <button
            onClick={() => onRemove(movementItem.index, enchantItem.index)}
            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-20">
            <X size={9} className="text-white" />
          </button>
        </div>
      );
    }

    if (movementItem) return renderItem(movementItem);
    if (enchantItem) return renderItem(enchantItem);

    // Empty reserved slot for movement/enchantment
    return (
      <div className="relative w-16 h-16 rounded-xl border-2 border-dashed border-blue-400/30 bg-blue-400/5 opacity-60 flex flex-col items-center justify-center gap-0.5"
           title="Slot reservado para botas/encantamiento">
        <Footprints size={14} className="text-blue-400/60" />
        <span className="text-[9px] text-blue-400/50 font-medium leading-tight text-center">Botas</span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-3 justify-center flex-wrap">
        {/* 5 normal slots */}
        {normalItems.map(slot => renderItem(slot))}
        {Array(emptyNormalCount).fill(null).map((_, i) => (
          <div key={`empty-${i}`} className="relative w-16 h-16 rounded-xl border-2 flex items-center justify-center border-dashed border-border/50 bg-secondary/10 opacity-40">
            <Plus size={16} className="text-muted-foreground" />
          </div>
        ))}
        {/* 6th slot: movement/enchantment */}
        {renderMovementSlot()}
      </div>
    </div>
  );
}