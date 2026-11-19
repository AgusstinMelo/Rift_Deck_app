import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { Search, Sword } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { entitySlug, findEntityBySlug } from '@/utils/entitySlug';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { itemCategoryLabel, itemTypeLabel } from '@/utils/itemLabels';
import ItemDetail from '@/components/library/ItemDetail';

const CATEGORY_LABELS = {
  get 'Básico'() { return itemCategoryLabel('Básico'); },
  get 'Nivel Medio'() { return itemCategoryLabel('Nivel Medio'); },
  get 'Mejorado'() { return itemCategoryLabel('Mejorado'); },
  get 'Sin categoría'() { return itemCategoryLabel('Sin categoría'); },
};

const CATEGORY_COLORS = {
  'Básico': 'text-green-400 bg-green-500/10 border-green-500/20',
  'Nivel Medio': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Mejorado': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

export default function ItemLibrary({ selectedId, selectedSlug, onSelectId, onClearSelected, initialItems, initialChampions, publicBasePath }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selected, setSelected] = useState(() => selectedSlug ? findEntityBySlug(initialItems, selectedSlug) : null);
  const { entityName, matchesName, compareNames } = useCatalogText();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['writems'],
    queryFn: () => WRItem.list('type'),
    initialData: initialItems,
    ...(publicBasePath ? publicCatalogQueryOptions : {
      staleTime: initialItems ? 5 * 60 * 1000 : undefined,
    }),
  });

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    ...(publicBasePath ? publicCatalogQueryOptions : {
      staleTime: initialChampions ? 5 * 60 * 1000 : undefined,
    }),
  });

  useEffect(() => {
    if (!selectedId && !selectedSlug) {
      setSelected(null);
      return;
    }

    const nextSelected = selectedSlug
      ? findEntityBySlug(items, selectedSlug)
      : items.find(item => String(item.id) === String(selectedId));
    if (nextSelected) {
      setSelected(nextSelected);
    }
  }, [items, selectedId, selectedSlug]);

  const CATEGORY_ORDER = {
    'Básico': 3,
    'Nivel Medio': 2,
    'Mejorado': 1,
  };

  const TYPE_ORDER = {
    'dano fisico': 1,
    'dano magico': 2,
    'defensa': 3,
    'soporte': 4,
    'movilidad': 5,
  };

  const normalize = (value) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(' ');
    return String(value);
  };

  const normalizeKey = (value) => {
    return normalize(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const getTypeOrder = (type) => {
    return TYPE_ORDER[normalizeKey(type)] ?? 999;
  };

  const getItemTypes = (value) => {
    if (value === null || value === undefined) return ['Sin tipo'];

    if (Array.isArray(value)) {
      const types = value
        .map(type => String(type).trim())
        .filter(Boolean);

      return types.length > 0 ? types : ['Sin tipo'];
    }

    const raw = String(value).trim();

    if (!raw) return ['Sin tipo'];

    const types = raw
      .split(/[,/|+&]+|\s+y\s+/i)
      .map(type => type.trim())
      .filter(Boolean);

    return types.length > 0 ? types : ['Sin tipo'];
  };

  const filtered = [...items]
    .filter(item => {
      const matchSearch =
        !search ||
        matchesName(item, search);

      const matchCat =
        catFilter === 'all' ||
        item.category === catFilter;

      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      const typeA = getItemTypes(a.type)[0];
      const typeB = getItemTypes(b.type)[0];

      const typeOrderA = getTypeOrder(typeA);
      const typeOrderB = getTypeOrder(typeB);

      if (typeOrderA !== typeOrderB) {
        return typeOrderA - typeOrderB;
      }

      const typeCompare = normalize(typeA).localeCompare(normalize(typeB), 'es', {
        sensitivity: 'base',
        numeric: true,
      });

      if (typeCompare !== 0) return typeCompare;

      const categoryA = CATEGORY_ORDER[a.category] ?? 999;
      const categoryB = CATEGORY_ORDER[b.category] ?? 999;

      if (categoryA !== categoryB) return categoryA - categoryB;

      return compareNames(a, b);
    });

  const groupedItems = filtered.reduce((acc, item) => {
    const types = getItemTypes(item.type);
    const category = item.category || 'Sin categoría';

    types.forEach(type => {
      if (!acc[type]) acc[type] = {};
      if (!acc[type][category]) acc[type][category] = [];

      const alreadyExists = acc[type][category].some(existing => existing.id === item.id);

      if (!alreadyExists) {
        acc[type][category].push(item);
      }
    });

    return acc;
  }, {});
    
  if (selected) {
    return (
      <ItemDetail
        item={selected}
        items={items}
        champions={champions}
        publicBasePath={publicBasePath}
        onBack={() => {
          setSelected(null);
          onClearSelected?.();
        }}
        onSelectItem={item => {
          setSelected(item);
          onSelectId?.(item.id);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rd-library-filters rd-card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('library.buscarObjeto')}
              className="
                w-full bg-secondary/60 border border-border rounded-xl
                pl-10 pr-4 py-3 text-sm text-foreground
                placeholder:text-muted-foreground outline-none
                focus:border-primary/40 focus:ring-2 focus:ring-primary/10
                transition-all
              "
            />
          </div>

          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="
              bg-secondary/60 border border-border rounded-xl
              px-4 py-3 text-sm text-foreground
              outline-none focus:border-primary/40
            "
          >
            <option value="all">{t('library.todasLasCategorias')}</option>

            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14 gap-1.5">
          {Array(28)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rd-card aspect-square animate-pulse" />
            ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rd-card p-6">
          <EmptyState
            icon={Search}
            title={t('common.noResults')}
            description={t('library.noSeEncontraronObjetos')}
          />
        </div>
      ) : (
        <div className="space-y-8">
  {Object.entries(groupedItems)
  .sort(([typeA], [typeB]) => {
    const orderA = getTypeOrder(typeA);
    const orderB = getTypeOrder(typeB);

    if (orderA !== orderB) return orderA - orderB;

    return normalize(typeA).localeCompare(normalize(typeB), 'es', {
      sensitivity: 'base',
      numeric: true,
    });
  })
  .map(([type, categories]) => {
    const totalByType = Object.values(categories).reduce(
      (total, list) => total + list.length,
      0
    );

    return (
      <section key={type} className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-px bg-primary/50 shrink-0" />
            <h2 className="font-rajdhani font-bold text-2xl leading-none text-foreground tracking-[-0.06em] uppercase break-words">
              {itemTypeLabel(type)}
            </h2>
          </div>

          <span className="text-xs text-muted-foreground shrink-0">
            {totalByType} {t('library.objetos')}
          </span>
        </div>

        <div className="space-y-5">
          {Object.entries(categories)
            .sort(([catA], [catB]) => {
              const orderA = CATEGORY_ORDER[catA] ?? 999;
              const orderB = CATEGORY_ORDER[catB] ?? 999;

              if (orderA !== orderB) return orderA - orderB;

              return normalize(catA).localeCompare(normalize(catB), 'es', {
                sensitivity: 'base',
                numeric: true,
              });
            })
            .map(([category, groupItems]) => (
              <div key={`${type}-${category}`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      text-[10px] px-2.5 py-1 rounded-lg border uppercase tracking-[0.12em] font-semibold
                      ${CATEGORY_COLORS[category] || 'bg-secondary border-border text-foreground'}
                    `}
                  >
                    {CATEGORY_LABELS[category] || category}
                  </span>

                  <span className="text-[10px] text-muted-foreground">
                    {groupItems.length}
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14 gap-1.5">
                  {groupItems.map(item => {
                    const Card = publicBasePath ? Link : 'button';
                    return (
                    <Card
                      key={item.id}
                      {...(publicBasePath ? { to: `${publicBasePath}/${entitySlug(item.name)}` } : { onClick: () => {
                        setSelected(item);
                        onSelectId?.(item.id);
                      }})}
                      className="
                        bg-card border border-border rounded-lg overflow-hidden
                        text-left hover:border-primary/40 hover:bg-primary/5
                        transition-all group aspect-square
                      "
                      title={entityName(item)}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={entityName(item)}
                          width="160"
                          height="160"
                          loading="lazy"
                          decoding="async"
                          className="
                            w-full h-full object-cover
                            transition-transform duration-200
                            group-hover:scale-105
                          "
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <Sword size={22} className="text-primary" />
                        </div>
                      )}
                    </Card>
                  );})}
                </div>
              </div>
            ))}
        </div>
      </section>
    );
  })}
</div>
      )}

      <p className="text-muted-foreground text-xs">
        {filtered.length} {t('library.objetos')}
      </p>
    </div>
  );
}
