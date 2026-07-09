import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WRItem } from '@/api/entitiesSupabase';
import { Search, ArrowLeft, Coins, Sword } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import ReactMarkdown from 'react-markdown';

const CATEGORY_LABELS = {
  'Básico': 'Básico',
  'Nivel Medio': 'Nivel Medio',
  'Mejorado': 'Mejorado',
};

const CATEGORY_COLORS = {
  'Básico': 'text-green-400 bg-green-500/10 border-green-500/20',
  'Nivel Medio': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Mejorado': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

export default function ItemLibrary({ selectedId, onSelectId, onClearSelected }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['writems'],
    queryFn: () => WRItem.list('type'),
  });

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    const nextSelected = items.find(item => String(item.id) === String(selectedId));
    if (nextSelected) {
      setSelected(nextSelected);
    }
  }, [items, selectedId]);

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
        item.name?.toLowerCase().includes(search.toLowerCase());

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

      return normalize(a.name).localeCompare(normalize(b.name), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
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
    
  const STAT_CONFIG = [
    { key: 'life', label: 'Vida', color: 'text-red-400', unit: '' },
    { key: 'life_reg', label: 'Reg. Vida', color: 'text-red-300', unit: '' },
    { key: 'mana', label: 'Maná', color: 'text-blue-400', unit: '' },
    { key: 'mana_reg', label: 'Reg. Maná', color: 'text-blue-300', unit: '' },
    { key: 'attack_damage', label: 'Daño Físico', color: 'text-orange-400', unit: '' },
    { key: 'attack_speed', label: 'Vel. Ataque', color: 'text-yellow-400', unit: '%' },
    { key: 'ability_power', label: 'Poder de Habilidad', color: 'text-purple-400', unit: '' },
    { key: 'armor', label: 'Armadura', color: 'text-yellow-300', unit: '' },
    { key: 'magic_res', label: 'Resist. Mágica', color: 'text-indigo-400', unit: '' },
    { key: 'flat_movement', label: 'Vel. Mov.', color: 'text-teal-400', unit: '' },
    { key: 'percentage_movement', label: 'Vel. Mov. %', color: 'text-teal-300', unit: '%' },
    { key: 'critical_impact', label: 'Tasa de Críticos', color: 'text-amber-400', unit: '%' },
    { key: 'critical_damage', label: 'Daño Crítico', color: 'text-amber-300', unit: '%' },
    { key: 'physic_vamp', label: 'Vamp. Físico', color: 'text-pink-400', unit: '%' },
    { key: 'magic_vamp', label: 'Vamp. Mágico', color: 'text-pink-300', unit: '%' },
    { key: 'flat_armor_penetration', label: 'Pen. Armadura', color: 'text-red-300', unit: '' },
    { key: 'percentage_armor_penetration', label: 'Pen. Armadura %', color: 'text-red-200', unit: '%' },
    { key: 'flat_magic_penetration', label: 'Pen. Mágica', color: 'text-violet-400', unit: '' },
    { key: 'percentage_magic_penetration', label: 'Pen. Mágica %', color: 'text-violet-300', unit: '%' },
    { key: 'ability_haste', label: 'Aceleración de Habilidad', color: 'text-cyan-400', unit: '' },
    { key: 'tenacity', label: 'Tenacidad', color: 'text-green-400', unit: '%' },
    { key: 'healing_and_shield', label: 'Curación/Escudo', color: 'text-emerald-400', unit: '%' },
  ];

  const activeStats = selected
    ? STAT_CONFIG.filter(stat => {
        const value = Number(selected[stat.key]);
        return !Number.isNaN(value) && value !== 0;
      })
    : [];

  if (selected) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setSelected(null);
            onClearSelected?.();
          }}
          className="
            flex items-center gap-2 text-sm
            text-muted-foreground hover:text-foreground
            transition-colors
          "
        >
          <ArrowLeft size={15} />
          Volver a objetos
        </button>

        <div className="rd-card overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.18),transparent_35%)]" />

          <div className="relative p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="shrink-0">
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt={selected.name}
                    className="
                      w-24 h-24 rounded-3xl object-cover
                      border border-primary/20
                      shadow-[0_0_25px_rgba(212,175,55,.10)]
                    "
                  />
                ) : (
                  <div
                    className="
                      w-24 h-24 rounded-3xl bg-secondary
                      border border-border/50
                      flex items-center justify-center
                    "
                  >
                    <Sword size={34} className="text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {selected.category && (
                    <span
                      className={`
                        text-xs px-2.5 py-1 rounded-lg border uppercase tracking-[0.12em]
                        ${CATEGORY_COLORS[selected.category] || 'bg-secondary border-border text-foreground'}
                      `}
                    >
                      {CATEGORY_LABELS[selected.category] || selected.category}
                    </span>
                  )}

                  {selected.price && (
                    <span className="rd-status-pill">
                      <Coins size={13} className="inline mr-1 text-primary" />
                      {selected.price} oro
                    </span>
                  )}
                </div>

                <h1 className="font-rajdhani font-bold text-5xl tracking-[-0.08em] text-foreground uppercase">
                  {selected.name}
                </h1>

                {selected.description && (
                  <div className="text-muted-foreground text-sm leading-relaxed mt-4 max-w-3xl prose prose-invert prose-p:my-2 prose-strong:text-foreground">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="my-1.5">{children}</p>,
                        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                      }}
                    >
                      {selected.description.replace(/\\n/g, '\n')}
                    </ReactMarkdown>
                  </div>
                )}

                {(selected.tags || '').length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-5">
                    {selected.tags
                      .split(',')
                      .map(t => t.trim())
                      .filter(Boolean)
                      .map(t => (
                        <span key={t} className="rd-status-pill">
                          {t}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {activeStats.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-px bg-primary/50" />
                  <h2 className="rd-card-title">Estadísticas del objeto</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {activeStats.map(stat => {
                    const value = selected[stat.key];

                    return (
                      <div key={stat.key} className="rd-mini-action">
                        <p className="rd-label mb-1">
                          {stat.label}
                        </p>

                        <p className={`text-lg font-bold ${stat.color}`}>
                          +{value}{stat.unit}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rd-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar objeto..."
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
            <option value="all">Todas las categorías</option>

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
            title="Sin resultados"
            description="No se encontraron objetos con esos filtros."
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
            <h2 className="font-rajdhani font-bold text-2xl text-foreground tracking-[-0.06em] uppercase truncate">
              {type}
            </h2>
          </div>

          <span className="text-xs text-muted-foreground shrink-0">
            {totalByType} objetos
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
                  {groupItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelected(item);
                        onSelectId?.(item.id);
                      }}
                      className="
                        bg-card border border-border rounded-lg overflow-hidden
                        text-left hover:border-primary/40 hover:bg-primary/5
                        transition-all group aspect-square
                      "
                      title={item.name}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
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
                    </button>
                  ))}
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
        {filtered.length} objetos
      </p>
    </div>
  );
}
