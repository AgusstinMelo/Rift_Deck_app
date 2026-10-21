import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Rune } from '@/api/entitiesSupabase';

import {
  Search,
  Sparkles,
  Gem,
  Shield,
  Flame,
  Wand2,
  ArrowLeft,
} from 'lucide-react';

import EmptyState from '@/components/ui/EmptyState';
import { Link } from 'react-router-dom';
import { entitySlug, findEntityBySlug } from '@/utils/entitySlug';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';
import { DESKTOP_FIT_QUERY, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY, useMatchMedia } from '@/hooks/useMatchMedia';

const BRANCH_COLORS = {
  Clave: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Precisión: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Dominación: 'text-red-400 bg-red-500/10 border-red-500/20',
  Valor: 'text-green-400 bg-green-500/10 border-green-500/20',
  Brujería: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
};

const BRANCH_ICONS = {
  Clave: Sparkles,
  Precisión: Gem,
  Dominación: Flame,
  Valor: Shield,
  Brujería: Wand2,
};

const BRANCHES = ['Clave', 'Dominación', 'Precisión', 'Valor', 'Brujería'];

export default function RuneLibrary({ selectedId, selectedSlug, onSelectId, onClearSelected, initialRunes, publicBasePath }) {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [selected, setSelected] = useState(() => selectedSlug ? findEntityBySlug(initialRunes, selectedSlug) : null);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isDesktopFit = useMatchMedia(DESKTOP_FIT_QUERY);

  const { data: runes = [], isLoading } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('branch'),
    initialData: initialRunes,
    ...(publicBasePath ? publicCatalogQueryOptions : {
      staleTime: initialRunes ? 5 * 60 * 1000 : undefined,
    }),
  });

  useEffect(() => {
    if (!selectedId && !selectedSlug) {
      setSelected(null);
      return;
    }

    const nextSelected = selectedSlug
      ? findEntityBySlug(runes, selectedSlug)
      : runes.find(rune => String(rune.id) === String(selectedId));
    if (nextSelected) {
      setSelected(nextSelected);
    }
  }, [runes, selectedId, selectedSlug]);

  const BRANCH_ORDER = BRANCHES.reduce((acc, branch, index) => {
    acc[branch] = index;
    return acc;
  }, {});

  const normalize = (value) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(' ');
    return String(value);
  };

  const getRuneBranches = (value) => {
    if (value === null || value === undefined) return ['Sin rama'];

    if (Array.isArray(value)) {
      const branches = value
        .map(branch => String(branch).trim())
        .filter(Boolean);

      return branches.length > 0 ? branches : ['Sin rama'];
    }

    const raw = String(value).trim();

    if (!raw) return ['Sin rama'];

    const branches = raw
      .split(/[,/|+&]+|\s+y\s+/i)
      .map(branch => branch.trim())
      .filter(Boolean);

    return branches.length > 0 ? branches : ['Sin rama'];
  };

  const filtered = [...runes]
    .filter(rune => {
      const matchSearch =
        !search ||
        rune.name?.toLowerCase().includes(search.toLowerCase());

      const runeBranches = getRuneBranches(rune.branch);

      const matchBranch =
        branchFilter === 'all' ||
        runeBranches.includes(branchFilter);

      return matchSearch && matchBranch;
    })
    .sort((a, b) => {
      const branchA = getRuneBranches(a.branch)[0];
      const branchB = getRuneBranches(b.branch)[0];

      const branchOrderA = BRANCH_ORDER[branchA] ?? 999;
      const branchOrderB = BRANCH_ORDER[branchB] ?? 999;

      if (branchOrderA !== branchOrderB) {
        return branchOrderA - branchOrderB;
      }

      const groupA = Number(a.group || 0);
      const groupB = Number(b.group || 0);

      if (groupA !== groupB) {
        return groupA - groupB;
      }

      return normalize(a.name).localeCompare(normalize(b.name), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });

  const groupedRunes = filtered.reduce((acc, rune) => {
    const branches = getRuneBranches(rune.branch);

    branches.forEach(branch => {
      if (!acc[branch]) acc[branch] = [];

      const alreadyExists = acc[branch].some(existing => existing.id === rune.id);

      if (!alreadyExists) {
        acc[branch].push(rune);
      }
    });

    return acc;
  }, {});

  const relatedRunes = selected && publicBasePath
    ? runes
        .filter(rune => rune.id !== selected.id)
        .filter(rune => {
          const selectedBranches = getRuneBranches(selected.branch);
          return getRuneBranches(rune.branch).some(branch => selectedBranches.includes(branch));
        })
        .sort((a, b) => normalize(a.name).localeCompare(normalize(b.name), 'es', { sensitivity: 'base' }))
        .slice(0, 6)
    : [];

  // En smartphone (vertical u horizontal) y en escritorio: el mismo "dossier" que objetos y
  // campeones, sin pestañas (la runa solo tiene descripción): identidad compacta y la
  // descripción con todo el alto que queda (no aplica a la ficha pública).
  if (selected && (isPhonePortrait || isPhoneLandscape || isDesktopFit) && !publicBasePath) {
    const BranchIcon = BRANCH_ICONS[selected.branch] || Gem;

    return (
      <div className="rd-entity-detail">
        <button
          onClick={() => {
            setSelected(null);
            onClearSelected?.();
          }}
          className="rd-entity-back flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Volver a runas
        </button>

        <div className="rd-card rd-entity-hero">
          {selected.image_url
            ? <img src={selected.image_url} alt={selected.name} className="rd-entity-hero-img rd-entity-hero-img-round" />
            : <div className="rd-entity-hero-img rd-entity-hero-img-round bg-secondary flex items-center justify-center"><BranchIcon size={26} className="text-primary" /></div>}
          <div className="min-w-0">
            {selected.branch && (
              <div className="rd-entity-hero-pills">
                <span className={`rd-entity-pill border ${BRANCH_COLORS[selected.branch] || 'bg-secondary border-border text-foreground'}`}>
                  {selected.branch}
                </span>
              </div>
            )}
            <h1 className="font-rajdhani font-bold tracking-[-0.06em] text-foreground uppercase">{selected.name}</h1>
          </div>
        </div>

        <div className="rd-card rd-entity-section">
          <div className="rd-entity-section-head">
            <span className="w-6 h-px bg-primary/50" />
            <h2 className="rd-card-title">Descripción</h2>
          </div>
          {selected.description
            ? <p className="rd-entity-desc text-muted-foreground">{selected.description}</p>
            : <p className="text-sm text-muted-foreground">Sin descripción.</p>}
        </div>
      </div>
    );
  }

  if (selected) {
    const BranchIcon = BRANCH_ICONS[selected.branch] || Gem;

    return (
      <div className="space-y-6">
        {publicBasePath ? <Link
          to={publicBasePath}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Volver a runas
        </Link> : <button
          onClick={() => {
            setSelected(null);
            onClearSelected?.();
          }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Volver a runas
        </button>}

        <div className="rd-card overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.18),transparent_35%)]" />

          <div className="relative p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="shrink-0">
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt={selected.name}
                    className="w-24 h-24 rounded-3xl object-cover border border-primary/20 shadow-[0_0_25px_rgba(212,175,55,.10)]"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-3xl bg-secondary border border-border/50 flex items-center justify-center">
                    <BranchIcon size={34} className="text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {selected.branch && (
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg border uppercase tracking-[0.12em] ${
                        BRANCH_COLORS[selected.branch] ||
                        'bg-secondary border-border text-foreground'
                      }`}
                    >
                      {selected.branch}
                    </span>
                  )}
                </div>

                <h1 className="font-rajdhani font-bold text-5xl tracking-[-0.08em] text-foreground uppercase">
                  {selected.name}
                </h1>

                {selected.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed mt-4 max-w-3xl">
                    {selected.description}
                  </p>
                )}

              </div>
            </div>
          </div>
        </div>

        {relatedRunes.length > 0 && (
          <section className="rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">Runas de la misma rama</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Otras runas que comparten la rama registrada de {selected.name}.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {relatedRunes.map(rune => {
                const RelatedIcon = BRANCH_ICONS[rune.branch] || Gem;
                return (
                  <Link
                    key={rune.id}
                    to={`${publicBasePath}/${entitySlug(rune.name)}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {rune.image_url ? (
                      <img src={rune.image_url} alt={`${rune.name} en Wild Rift`} width="48" height="48" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <RelatedIcon size={18} className="text-primary" />
                      </div>
                    )}
                    <h3 className="min-w-0 truncate font-rajdhani text-base font-bold">{rune.name}</h3>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
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
              placeholder="Buscar runa..."
              className="w-full bg-secondary/60 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <select
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
            className="bg-secondary/60 border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary/40"
          >
            <option value="all">Todas las ramas</option>
            {BRANCHES.map(b => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {Array(12)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rd-card h-20 animate-pulse" />
            ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rd-card p-6">
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="No se encontraron runas con esos filtros."
          />
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {Object.entries(groupedRunes)
              .sort(([branchA], [branchB]) => {
                const orderA = BRANCH_ORDER[branchA] ?? 999;
                const orderB = BRANCH_ORDER[branchB] ?? 999;

                if (orderA !== orderB) return orderA - orderB;

                return normalize(branchA).localeCompare(normalize(branchB), 'es', {
                  sensitivity: 'base',
                  numeric: true,
                });
              })
              .map(([branch, branchRunes]) => {
                const BranchIcon = BRANCH_ICONS[branch] || Gem;

                return (
                  <section key={branch} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-px bg-primary/50 shrink-0" />

                        <h2 className="font-rajdhani font-bold text-2xl text-foreground tracking-[-0.06em] uppercase truncate">
                          {branch}
                        </h2>

                        <span
                          className={`
                            text-[10px] px-2.5 py-1 rounded-lg border uppercase tracking-[0.12em] font-semibold shrink-0
                            ${BRANCH_COLORS[branch] || 'bg-secondary border-border text-foreground'}
                          `}
                        >
                          {branchRunes.length}
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border/50 flex items-center justify-center shrink-0">
                        <BranchIcon size={15} className="text-primary" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                      {branchRunes.map(rune => {
                        const RuneBranchIcon = BRANCH_ICONS[rune.branch] || BranchIcon;
                        const Card = publicBasePath ? Link : 'button';

                        return (
                          <Card
                            key={`${branch}-${rune.id}`}
                            {...(publicBasePath ? { to: `${publicBasePath}/${entitySlug(rune.name)}` } : { onClick: () => {
                              setSelected(rune);
                              onSelectId?.(rune.id);
                            }})}
                            className="group relative overflow-hidden rd-card p-2.5 text-left hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200"
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.10),transparent_42%)]" />

                            <div className="relative flex items-center gap-3">
                              <div className="relative shrink-0">
                                {rune.image_url ? (
                                  <img
                                    src={rune.image_url}
                                    alt={rune.name}
                                    className="w-11 h-11 rounded-full object-cover border border-primary/15 shadow-[0_0_16px_rgba(212,175,55,.08)]"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-full bg-secondary border border-border/50 flex items-center justify-center">
                                    <RuneBranchIcon size={19} className="text-primary" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <h3 className="font-rajdhani font-bold text-lg tracking-[-0.05em] text-foreground leading-none truncate">
                                      {rune.name}
                                    </h3>

                                    {rune.branch && (
                                      <div className="mt-1.5">
                                        <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded-md border uppercase tracking-[0.10em] ${
                                            BRANCH_COLORS[rune.branch] ||
                                            'bg-secondary border-border text-foreground'
                                          }`}
                                        >
                                          {rune.branch}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="w-7 h-7 rounded-lg bg-secondary/60 border border-border/50 flex items-center justify-center shrink-0">
                                    <RuneBranchIcon size={13} className="text-primary" />
                                  </div>
                                </div>

                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length} runas
            </p>
          </div>
        </>
      )}
    </div>
  );
}
