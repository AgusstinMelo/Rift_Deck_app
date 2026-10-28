import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { usesUnifiedLifesteal } from '@/lib/gamePatch';
import { PRESS_PREVIEW_STYLE, usePressPreview } from '@/hooks/usePressPreview';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { tr } from '@/i18n/uiI18n';
import { itemCategoryLabel, itemTypeLabel } from '@/utils/itemLabels';

const CATEGORIES = [
  { key: 'all', get label() { return tr('builds.todos'); } },
  { key: 'Básico', get label() { return itemCategoryLabel('Básico'); } },
  { key: 'Nivel Medio', get label() { return itemCategoryLabel('Nivel Medio'); } },
  { key: 'Mejorado', get label() { return itemCategoryLabel('Mejorado'); } },
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
  { key: 'life', get label() { return tr('itemStats.life'); }, color: 'text-green-400' },
  { key: 'life_reg', get label() { return tr('itemStats.life_reg'); }, color: 'text-green-400' },
  { key: 'mana', get label() { return tr('itemStats.mana'); }, color: 'text-sky-300' },
  { key: 'mana_reg', get label() { return tr('itemStats.mana_reg'); }, color: 'text-sky-300' },
  { key: 'attack_damage', get label() { return tr('itemStats.attack_damage'); }, color: 'text-orange-400' },
  { key: 'physical_damage', get label() { return tr('itemStats.physical_damage'); }, color: 'text-orange-700' },
  { key: 'magic_damage', get label() { return tr('itemStats.magic_damage'); }, color: 'text-cyan-400' },
  { key: 'true_damage', get label() { return tr('itemStats.true_damage'); }, color: 'text-white' },
  { key: 'attack_speed', get label() { return tr('itemStats.attack_speed'); }, unit: '%', color: 'text-yellow-200' },
  { key: 'ability_power', get label() { return tr('itemStats.ability_power'); }, color: 'text-violet-400' },
  { key: 'armor', get label() { return tr('itemStats.armor'); }, color: 'text-yellow-400' },
  { key: 'magic_res', get label() { return tr('itemStats.magic_res'); } },
  { key: 'flat_movement', get label() { return tr('itemStats.flat_movement'); }, color: 'text-white' },
  { key: 'percentage_movement', get label() { return tr('itemStats.percentage_movement'); }, unit: '%', color: 'text-white' },
  { key: 'critical_impact', get label() { return tr('itemStats.critical_impact'); }, unit: '%', color: 'text-red-400' },
  { key: 'critical_damage', get label() { return tr('itemStats.critical_damage'); }, unit: '%', color: 'text-red-400' },
  { key: 'lifesteal', get label() { return tr('itemStats.lifesteal'); }, unit: '%', color: 'text-green-300' },
  { key: 'physic_vamp', get label() { return tr('itemStats.physic_vamp'); }, unit: '%', color: 'text-green-300' },
  { key: 'magic_vamp', get label() { return tr('itemStats.magic_vamp'); }, unit: '%', color: 'text-green-300' },
  { key: 'flat_armor_penetration', get label() { return tr('itemStats.flat_armor_penetration'); }, color: 'text-red-300' },
  { key: 'percentage_armor_penetration', get label() { return tr('itemStats.percentage_armor_penetration'); }, unit: '%', color: 'text-red-300' },
  { key: 'flat_magic_penetration', get label() { return tr('itemStats.flat_magic_penetration'); } },
  { key: 'percentage_magic_penetration', get label() { return tr('itemStats.percentage_magic_penetration'); }, unit: '%' },
  { key: 'ability_haste', get label() { return tr('itemStats.ability_haste'); }, color: 'text-white' },
  { key: 'tenacity', get label() { return tr('itemStats.tenacity'); }, unit: '%', color: 'text-violet-700' },
  { key: 'healing_and_shield', get label() { return tr('itemStats.healing_and_shield'); }, unit: '%', color: 'text-green-300' },
  { key: 'adaptable_ad', get label() { return tr('itemStats.adaptable_ad'); }, color: 'text-orange-400' },
  { key: 'adaptable_ap', get label() { return tr('itemStats.adaptable_ap'); }, color: 'text-violet-400' },
];

const getActiveStats = (item) => ITEM_STATS.filter(({ key }) => {
  const unifiedLifesteal = usesUnifiedLifesteal(item?.patch_version);
  if (unifiedLifesteal && (key === 'physic_vamp' || key === 'magic_vamp')) return false;
  if (!unifiedLifesteal && key === 'lifesteal') return false;

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
    if (!selectedItems.some(isMobilityBoots)) return tr('builds.requiereBotasDeMovimiento');
    if (selectedItems.some(isEnchant)) return tr('builds.yaTienesUnEncantamiento');
    return null;
  }

  if (movement) {
    if (hasMovement) return tr('builds.solo1ItemDe');
    return null;
  }

  if (normalCount >= 5) return tr('builds.maximo5ObjetosNormales');

  if (UNIQUE_ITEMS.includes(item?.name?.toLowerCase()) &&
      selectedItems.some(i => UNIQUE_ITEMS.includes(i?.name?.toLowerCase())))
    return tr('builds.soloPuedesLlevar1');

  if (item.category === 'Mejorado' && selectedItems.some(i => i?.id === item.id))
    return tr('builds.losItemsMejoradosNo');

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
  const t = useT();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [tooltip, setTooltip] = useState(null);
  const [tooltipTop, setTooltipTop] = useState(null);
  const tooltipRef = useRef(null);
  // Mouse: al pasar por encima. Táctil: solo manteniendo presionado (ver usePressPreview).
  const pressPreview = usePressPreview();
  const { entityName, entityDescription, matchesName } = useCatalogText();

  const showTooltip = (element, item, lockReason) => {
    const rect = element.getBoundingClientRect();
    // Las descripciones largas usan un tooltip más ancho: queda más bajo y entra en pantalla.
    const isLong = entityDescription(item).length > 280;
    const tooltipWidth = Math.min(isLong ? 380 : 320, window.innerWidth - 24);
    const wouldOverflowRight = rect.left + tooltipWidth > window.innerWidth - 12;
    const left = wouldOverflowRight
      ? Math.max(12, rect.right - tooltipWidth)
      : Math.max(12, rect.left);

    setTooltipTop(null);
    setTooltip({ item, lockReason, left, width: tooltipWidth, anchor: { top: rect.top, bottom: rect.bottom } });
  };

  // Posición vertical según la altura real del tooltip: abajo o arriba del item, donde entre;
  // si no entra en ninguno de los dos lados, se desplaza para quedar completo dentro de la pantalla.
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const margin = 12;
    const gap = 8;
    const viewportHeight = window.innerHeight;
    const height = tooltipRef.current.offsetHeight;
    const spaceBelow = viewportHeight - tooltip.anchor.bottom - gap - margin;
    const spaceAbove = tooltip.anchor.top - gap - margin;

    let top;
    if (height <= spaceBelow) top = tooltip.anchor.bottom + gap;
    else if (height <= spaceAbove) top = tooltip.anchor.top - gap - height;
    else top = spaceBelow >= spaceAbove ? tooltip.anchor.bottom + gap : tooltip.anchor.top - gap - height;

    setTooltipTop(Math.max(margin, Math.min(top, viewportHeight - height - margin)));
  }, [tooltip]);

  const canAddEnchantment = selectedItems.some(isMobilityBoots) && !selectedItems.some(isEnchant);
  const itemTypes = [...new Set(items.flatMap(getItemTypes))].sort(sortItemTypes);

  const filtered = items.filter(item => {
    const normalizedSearch = normalizeSearch(search);
    const matchSearch = !normalizedSearch || matchesName(item, normalizedSearch, normalizeSearch);
    const matchCat = category === 'all' || (item.category && item.category.toLowerCase() === category.toLowerCase());
    const matchType = typeFilter === 'all' || getItemTypes(item).some(type => type.toLowerCase() === typeFilter.toLowerCase());
    return matchSearch && matchCat && matchType;
  });

  return (
    <div className="rd-card rd-item-browser p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-px bg-primary/50" />
        <h3 className="rd-card-title">{t('builds.items3')}</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-36">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('builds.buscarItem')}
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
          <option value="all">{t('matches.todosLosTipos')}</option>
          {itemTypes.map(type => (
            <option key={type} value={type}>{itemTypeLabel(type)}</option>
          ))}
        </select>
      </div>

      <div className="rd-item-browser-results relative">
        <div className="rd-item-browser-grid grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-2 max-h-52 overflow-y-auto pr-1">
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
                style={PRESS_PREVIEW_STYLE}
                {...pressPreview.bind({
                  onShow: element => showTooltip(element, item, lockReason),
                  onHide: () => setTooltip(null),
                })}
              >
                <button
                  onClick={() => addable && onSelect(item)}
                  disabled={isDisabled}
                  aria-label={entityName(item)}
                  className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center transition-all
                    ${alreadyInBuild ? 'ring-2 ring-primary opacity-60' : ''}
                    ${isDisabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
                    ${itemIsEnchant && canAddEnchantment ? 'border-purple-400/50' : 'border-border'}
                    bg-secondary/20`}>
                  {item.image_url
                    ? <img src={item.image_url} alt={entityName(item)} className="w-10 h-10 object-contain rounded" />
                    : <span className="text-xs font-bold text-primary px-0.5 text-center leading-tight">{entityName(item).slice(0, 5)}</span>}
                </button>
              </div>
            );
          })}
        </div>

        {/* Item tooltip */}
        {tooltip && typeof document !== 'undefined' && createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[100] pointer-events-none overflow-hidden"
            style={{
              left: tooltip.left,
              width: tooltip.width,
              top: tooltipTop ?? 0,
              maxHeight: 'calc(100dvh - 24px)',
              // Hasta medir la altura se dibuja invisible, para que no "salte" en pantalla.
              visibility: tooltipTop === null ? 'hidden' : 'visible',
            }}
          >
            <div className="bg-popover border border-primary/25 rounded-xl p-3 shadow-2xl w-full">
              <div className="flex items-start gap-3">
                {tooltip.item.image_url && <img src={tooltip.item.image_url} alt="" className="w-11 h-11 object-contain rounded-lg border border-border bg-secondary/30 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground text-sm leading-tight">{entityName(tooltip.item)}</p>
                  <div className="flex flex-wrap items-center gap-x-2 mt-1">
                    {tooltip.item.category && <span className="text-[11px] text-muted-foreground">{tooltip.item.category}</span>}
                    {tooltip.item.price != null && <span className="text-[11px] text-primary font-semibold">{tooltip.item.price} {t('builds.oro')}</span>}
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
                  {entityDescription(tooltip.item)}
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
        <p className="text-muted-foreground text-xs text-center py-6">{t('builds.noSeEncontraronItems')}</p>
      )}
    </div>
  );
}
