import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTierlistEntries,
  getTierlistExecutions,
  getTierlistPatchAverages,
  getTierlistPatchGroups,
} from '@/api/tierlistSupabase';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Trophy, Table2, Layers } from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import LaneBadge, { LANE_CONFIG } from '@/components/ui/LaneBadge';
import EmptyState from '@/components/ui/EmptyState';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY, DESKTOP_FIT_QUERY } from '@/hooks/useMatchMedia';
import { useTierTileSize } from '@/hooks/useTierTileSize';
import { useT } from '@/lib/LocaleContext';
import { formatLocale, tr } from '@/i18n/uiI18n';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D', 'E'];

const formatDays = (group) => {
  const days = Number(group?.snapshots_count) || 0;
  return `${days} ${days === 1 ? tr('tierlist.dia') : tr('tierlist.dias')}`;
};

const formatSnapshotDate = (execution) => {
  const rawDate = execution?.snapshot_date || execution?.executed_at;
  if (!rawDate) return tr('tierlist.sinFecha');
  const datePart = String(rawDate).slice(0, 10);
  return new Date(`${datePart}T00:00:00`).toLocaleDateString(formatLocale());
};

const TIERLIST_MODES = [
  { id: 'average', get label() { return tr('tierlist.modes.average'); }, get shortLabel() { return tr('tierlist.modes.averageShort'); } },
  { id: 'daily', get label() { return tr('tierlist.modes.daily'); }, get shortLabel() { return tr('tierlist.modes.dailyShort'); } },
];

// Color de acento de cada tier (mismas variables que TierBadge).
const TIER_COLOR_VAR = {
  'S+': '--tier-splus',
  'S': '--tier-s',
  'A': '--tier-a',
  'B': '--tier-b',
  'C': '--tier-c',
};

const average = (values) => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
};

const sortTiers = (tiers) => [...tiers].sort((a, b) => {
  const aIndex = TIER_ORDER.indexOf(a);
  const bIndex = TIER_ORDER.indexOf(b);

  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
});

export default function Tierlist() {
  const t = useT();
  const [laneFilter, setLaneFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const isDesktopFit = useMatchMedia(DESKTOP_FIT_QUERY);
  // En smartphone el selector de vista va en la línea del parche, no en los filtros.
  const toggleInHeader = isPhoneLandscape || isPhonePortrait;
  // En smartphone horizontal se entra directo a la tabla (se lee mejor a lo ancho);
  // solo define el valor inicial, girar el teléfono después no cambia la vista.
  const [viewMode, setViewMode] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(PHONE_LANDSCAPE_QUERY).matches ? 'table' : 'tier'
  ));
  // 'average': promedio acumulado del parche. 'daily': snapshot de un día sin promediar.
  const [tierlistMode, setTierlistMode] = useState('average');
  const isDaily = tierlistMode === 'daily';
  const [patchFilter, setPatchFilter] = useState(''); // stores patch_group (7.3, 7.2...)
  const [snapshotFilter, setSnapshotFilter] = useState(''); // stores execution id

  // Cada grupo de parche muestra el promedio acumulado de sus tierlists diarias.
  const { data: patchGroups = [] } = useQuery({
    queryKey: ['tierlist-patch-groups'],
    queryFn: () => getTierlistPatchGroups(10),
  });

  const latestGroup = patchGroups[0] || null;
  const selectedGroupIndex = patchFilter
    ? patchGroups.findIndex(group => group.patch_group === patchFilter)
    : 0;
  const activeGroup = patchGroups[Math.max(selectedGroupIndex, 0)] || latestGroup;
  const activePatchGroup = activeGroup?.patch_group || '';

  const { data: averageTierlist = [], isLoading: isLoadingAverage } = useQuery({
    queryKey: ['tierlist-patch-averages', [activePatchGroup]],
    queryFn: () => getTierlistPatchAverages([activePatchGroup]),
    enabled: !isDaily && Boolean(activePatchGroup),
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
    enabled: isDaily,
  });

  const successfulExecs = executions.filter(e => e.status === 'success' || e.status === 'partial');
  const selectedSnapshotIndex = snapshotFilter
    ? successfulExecs.findIndex(execution => String(execution.id) === String(snapshotFilter))
    : 0;
  const activeSnapshotIndex = Math.max(selectedSnapshotIndex, 0);
  const activeExec = successfulExecs[activeSnapshotIndex] || null;
  const comparisonExec = successfulExecs[activeSnapshotIndex + 1] || null;
  const dailySnapshotKeys = useMemo(
    () => [activeExec?.snapshot_key, comparisonExec?.snapshot_key].filter(Boolean),
    [activeExec?.snapshot_key, comparisonExec?.snapshot_key]
  );

  const { data: dailyTierlist = [], isLoading: isLoadingDaily } = useQuery({
    queryKey: ['tierlist-full', dailySnapshotKeys],
    queryFn: () => getTierlistEntries('-ranking_final', 2000, { snapshotKeys: dailySnapshotKeys }),
    enabled: isDaily && dailySnapshotKeys.length > 0,
  });

  const tierlist = isDaily ? dailyTierlist : averageTierlist;
  const isLoading = isDaily ? isLoadingDaily : isLoadingAverage;
  const activeSnapshotKey = isDaily
    ? activeExec?.snapshot_key || ''
    : activePatchGroup ? `${activePatchGroup}::average` : '';

  // Promediada: Δ vs el promedio del día anterior. Del día: Δ vs el snapshot anterior.
  const hasPreviousDay = isDaily ? Boolean(comparisonExec) : Number(activeGroup?.snapshots_count) > 1;
  const prevDailyEntries = isDaily && comparisonExec
    ? dailyTierlist.filter(entry => entry.snapshot_key === comparisonExec.snapshot_key)
    : [];

  const getPositionVariation = (entry) => {
    const previousPosition = isDaily
      ? prevDailyEntries.find(p => p.champion_name === entry.champion_name && p.lane === entry.lane)?.position_in_lane
      : entry.previous_position_in_lane;

    if (previousPosition == null || entry.position_in_lane == null) {
      return null;
    }

    return previousPosition - entry.position_in_lane;
  };

  const filtered = tierlist.filter(t => {
    const matchSnapshot = t.snapshot_key === activeSnapshotKey;
    const matchLane = laneFilter === 'all' || t.lane === laneFilter;
    const matchTier = tierFilter === 'all' || t.tier === tierFilter;
    const matchDiff = diffFilter === 'all' || String(Math.round(t.difficulty)) === diffFilter;

    return matchSnapshot && matchLane && matchTier && matchDiff;
  });

  const availableTiers = useMemo(
    () => sortTiers(new Set(tierlist.filter(t => t.snapshot_key === activeSnapshotKey).map(t => t.tier).filter(Boolean))),
    [tierlist, activeSnapshotKey]
  );

  // "Por Tier" en escritorio: las imágenes se agrandan hasta llenar el alto disponible.
  const scrollRef = useRef(null);
  const tierGroupsRef = useRef(null);
  useTierTileSize({
    scrollRef,
    groupsRef: tierGroupsRef,
    enabled: isDesktopFit && viewMode === 'tier',
    layoutKey: `${isLoading}|${availableTiers.map(tier => filtered.filter(t => t.tier === tier).length).join(',')}`,
  });

  const renderVariation = (entry) => {
    const variation = getPositionVariation(entry);

    if (variation === null) {
      return <Minus size={12} className="text-muted-foreground" />;
    }

    if (variation > 0) {
      return (
        <span className="text-green-400 text-xs flex items-center gap-0.5">
          <TrendingUp size={12} />+{variation}
        </span>
      );
    }

    if (variation < 0) {
      return (
        <span className="text-red-400 text-xs flex items-center gap-0.5">
          <TrendingDown size={12} />{variation}
        </span>
      );
    }

    return <Minus size={12} className="text-muted-foreground" />;
  };

  // Selector promediada / del día, al lado del selector de vista.
  const modeToggle = (
    <div
      role="tablist"
      aria-label={t('tierlist.tipoDeTierlist')}
      className="rd-tierlist-view-toggle flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border/60"
    >
      {TIERLIST_MODES.map(mode => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          aria-selected={tierlistMode === mode.id}
          aria-label={mode.label}
          title={mode.label}
          onClick={() => {
            setTierlistMode(mode.id);
            setTierFilter('all');
          }}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
            ${tierlistMode === mode.id
              ? 'bg-primary/15 text-primary border border-primary/20'
              : 'text-muted-foreground hover:text-foreground'}
          `}
        >
          {mode.shortLabel}
        </button>
      ))}
    </div>
  );

  // Selector Por Tier / Tabla. En smartphone no entra en la fila de
  // filtros: va en el encabezado, en la línea de "Parche X vs Parche Y".
  const viewToggle = (
    <div className="rd-tierlist-view-toggle flex gap-1 bg-secondary/50 p-1 rounded-xl border border-border/60">
      <button
        onClick={() => setViewMode('tier')}
        aria-pressed={viewMode === 'tier'}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${viewMode === 'tier'
            ? 'bg-primary/15 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground'}
        `}
      >
        <Layers size={13} />
       {t('tierlist.porTier')}
      </button>

      <button
        onClick={() => setViewMode('table')}
        aria-pressed={viewMode === 'table'}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${viewMode === 'table'
            ? 'bg-primary/15 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground'}
        `}
      >
        <Table2 size={13} />
       {t('tierlist.tabla')}
      </button>
    </div>
  );

  const toggles = (
    <div className="rd-tierlist-toggles flex items-center gap-2 ml-auto shrink-0">
      {modeToggle}
      {viewToggle}
    </div>
  );

  return (
    <div className="rd-page rd-dashboard rd-tierlist-layout">

      <div className="rd-tierlist-header flex items-start justify-between gap-4">
        <div>
          <div className="rd-page-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
             {t('tierlist.riftDeckMeta')}
            </span>
          </div>

          <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
           {t('nav.tierlist')}
          </h1>

          <div className="rd-tierlist-subline mt-1 flex items-center gap-3">
          <p className="rd-page-subtitle text-muted-foreground text-sm">
            {isDaily ? (
              activeExec ? (
                <>
                  <span className="text-foreground font-medium">{t('goals.filterLabels.patches')} {activeExec.patch}</span>
                  <span> · {formatSnapshotDate(activeExec)}</span>
                  {comparisonExec && <span> {t('tierlist.vs')} {formatSnapshotDate(comparisonExec)}</span>}
                </>
              ) : t('tierlist.sinDatosDeActualizacion')
            ) : activeGroup ? (
              <>
                <span className="text-foreground font-medium">{t('goals.filterLabels.patches')} {activeGroup.patch_group}</span>
                <span> {t('tierlist.promedioPonderadoDe')} {formatDays(activeGroup)}</span>
                {hasPreviousDay && <span> {t('tierlist.vsDiaAnterior')}</span>}
              </>
            ) : t('tierlist.sinDatosDeActualizacion')}
          </p>
          {toggleInHeader && toggles}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 rd-status-pill">
          <Trophy size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            {latestGroup
              ? t('tierlist.actualizado', { value: new Date(latestGroup.updated_at).toLocaleDateString(formatLocale()) })
              : t('tierlist.sinEjecucionReciente')}
          </span>
        </div>
      </div>

      <div className="rd-tierlist-filters rd-card p-4">
        <div className="flex flex-wrap gap-3 lg:gap-2 items-center">
          <div className="w-full sm:w-auto min-w-0">
            <div className="grid grid-cols-3 sm:flex sm:w-auto gap-1 bg-secondary/40 border border-border/50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLaneFilter('all')}
                aria-pressed={laneFilter === 'all'}
                className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  laneFilter === 'all'
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
               {t('builds.todos')}
              </button>

              {LANES.map(lane => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => setLaneFilter(lane)}
                  aria-pressed={laneFilter === lane}
                  className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    laneFilter === lane
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lane}
                </button>
              ))}
            </div>
          </div>

          <select
            value={tierFilter}
            onChange={event => setTierFilter(event.target.value)}
            className="bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">{isPhonePortrait ? t('tierlist.tier') : t('tierlist.todosLosTiers')}</option>
            {availableTiers.map(tier => (
              <option key={tier} value={tier}>{t('tierlist.tier')} {tier}</option>
            ))}
          </select>

          <select
            value={diffFilter}
            onChange={event => setDiffFilter(event.target.value)}
            className="bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">{t('library.dificultad')}</option>
            <option value="1">{t('library.facil')}</option>
            <option value="2">{t('tierlist.intermedia')}</option>
            <option value="3">{t('library.dificil')}</option>
          </select>

          {isDaily && successfulExecs.length > 1 && (
            <select
              value={snapshotFilter || activeExec?.id || ''}
              onChange={event => setSnapshotFilter(event.target.value)}
              className="bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
            >
              {successfulExecs.map(execution => (
                <option key={execution.id} value={execution.id}>
                  {isPhonePortrait ? `${execution.patch} · ${formatSnapshotDate(execution).replace(/\/\d{4}$/, '')}` : `${execution.patch} · ${formatSnapshotDate(execution)}`}
                </option>
              ))}
            </select>
          )}

          {!isDaily && patchGroups.length > 1 && (
            <select
              value={patchFilter || latestGroup?.patch_group || ''}
              onChange={event => setPatchFilter(event.target.value)}
              className="bg-secondary/40 border border-border/50 rounded-xl px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
            >
              {patchGroups.map(group => (
                <option key={group.patch_group} value={group.patch_group}>
                  {isPhonePortrait ? t('tierlist.parche', { patch_group: group.patch_group }) : t('tierlist.parche2', { patch_group: group.patch_group, formatDays: formatDays(group) })}
                </option>
              ))}
            </select>
          )}

          {!toggleInHeader && toggles}
        </div>
      </div>

      <div ref={scrollRef} className="rd-tierlist-scroll">
      {isLoading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="rd-card h-28 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rd-card p-6">
          <EmptyState
            icon={RefreshCw}
            title={t('tierlist.sinDatosDeTierlist')}
            description={t('tierlist.laTierlistAunNo')}
          />
        </div>
      ) : viewMode === 'tier' ? (
        <div ref={tierGroupsRef} className="rd-tier-groups space-y-6">
          {availableTiers.map(tier => {
            const championsInTier = filtered.filter(t => t.tier === tier);
            if (championsInTier.length === 0) return null;
            const tierColorVar = TIER_COLOR_VAR[tier];
            const avgWinrate = average(championsInTier.map(t => t.winrate));
            const avgPickrate = average(championsInTier.map(t => t.pickrate));

            return (
              <div
                key={tier}
                className="rd-tier-group rd-card overflow-hidden"
                style={tierColorVar ? { '--rd-tier-color': `var(${tierColorVar})` } : undefined}
              >
                <div className="rd-tier-group-head flex items-center gap-3 px-5 py-4 border-b border-border/70 bg-secondary/20">
                  <TierBadge tier={tier} size="lg" />

                  <div>
                    <p className="rd-card-title">{t('tierlist.tier')} {tier}</p>
                    <p className="text-xs text-muted-foreground">
                      {championsInTier.length} {t('tierlist.campeones')}
                    </p>
                  </div>

                  {/* Promedios del tier: solo escritorio (ver index.css). */}
                  <dl className="rd-tier-group-stats hidden" title={t('tierlist.promediosDelTier')}>
                    {avgWinrate !== null && (
                      <div>
                        <dt>{t('tierlist.wr')}</dt>
                        <dd>{avgWinrate.toFixed(0)}%</dd>
                      </div>
                    )}
                    {avgPickrate !== null && (
                      <div>
                        <dt>{t('tierlist.pr')}</dt>
                        <dd>{avgPickrate.toFixed(1)}%</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Solo la imagen de cada campeón; nombre y rol quedan en el tooltip. */}
                <div className="rd-tier-group-grid p-3 grid grid-cols-[repeat(auto-fill,3rem)] gap-1.5">
                  {championsInTier.map(entry => (
                    <div
                      key={entry.id}
                      title={[entry.champion_name, LANE_CONFIG[entry.lane]?.label || entry.lane].filter(Boolean).join(' - ')}
                      className={`
                        rd-tier-tile relative w-12 h-12 overflow-hidden rounded-lg
                        bg-muted border-2 ${LANE_CONFIG[entry.lane]?.border || 'border-border/60'}
                        hover:brightness-125
                        transition-[filter] duration-200
                      `}
                    >
                      {entry.image_url ? (
                        <img
                          src={entry.image_url}
                          alt={entry.champion_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                          {entry.champion_name?.[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Desktop: tabla normal */}
          <div className="rd-card rd-tierlist-table overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/70 bg-secondary/30">
                  <th className="text-left p-3 rd-label">#</th>
                  <th className="text-left p-3 rd-label">{t('common.champion')}</th>
                  <th className="text-left p-3 rd-label">{t('goals.filterLabels.lanes')}</th>
                  <th className="text-left p-3 rd-label">{t('tierlist.tier')}</th>
                  <th className="text-right p-3 rd-label">{t('tierlist.wr2')}</th>
                  <th className="text-right p-3 rd-label">{t('tierlist.pr2')}</th>
                  <th className="text-right p-3 rd-label">{t('tierlist.br')}</th>
                  <th className="text-right p-3 rd-label">{t('dashboard.score')}</th>
                  <th className="text-right p-3 rd-label">Δ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="p-3 text-muted-foreground text-sm">{idx + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden flex items-center justify-center text-xs font-bold text-primary border border-primary/10">
                          {entry.image_url ? (
                            <img src={entry.image_url} alt={entry.champion_name} className="w-full h-full object-cover" />
                          ) : entry.champion_name?.[0]}
                        </div>
                        <span className="font-medium text-sm text-foreground">{entry.champion_name}</span>
                      </div>
                    </td>
                    <td className="p-3"><LaneBadge lane={entry.lane} /></td>
                    <td className="p-3"><TierBadge tier={entry.tier} size="sm" /></td>
                    <td className="p-3 text-right text-sm text-foreground">{entry.winrate?.toFixed(0)}%</td>
                    <td className="p-3 text-right text-sm text-muted-foreground">{entry.pickrate?.toFixed(2)}%</td>
                    <td className="p-3 text-right text-sm text-muted-foreground">{entry.banrate?.toFixed(2)}%</td>
                    <td className="p-3 text-right text-sm font-semibold text-primary">{entry.ranking_final?.toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end">{renderVariation(entry)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: tarjetas */}
          <div className="md:hidden space-y-2">
            {filtered.map((entry, idx) => (
              <div
                key={entry.id}
                className="rd-card px-4 py-3 flex items-center gap-3"
              >
                <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">{idx + 1}</span>

                <div className="w-10 h-10 rounded-xl bg-muted overflow-hidden shrink-0 border border-primary/10">
                  {entry.image_url ? (
                    <img src={entry.image_url} alt={entry.champion_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                      {entry.champion_name?.[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm text-foreground truncate">{entry.champion_name}</span>
                    <TierBadge tier={entry.tier} size="sm" />
                    <LaneBadge lane={entry.lane} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-1 max-w-[10.5rem]">
                    <div className="text-xs leading-tight text-muted-foreground">
                      <p>{t('tierlist.wr')}</p>
                      <p className="text-blue-300">{entry.winrate?.toFixed(0)}%</p>
                    </div>

                    <div className="text-xs leading-tight text-muted-foreground">
                      <p>{t('tierlist.pr')}</p>
                      <p className="text-blue-300">{entry.pickrate?.toFixed(1)}%</p>
                    </div>

                    <div className="text-xs leading-tight text-muted-foreground">
                      <p>{t('tierlist.br2')}</p>
                      <p className="text-blue-300">{entry.banrate?.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold text-primary">{entry.ranking_final?.toFixed(1)}</span>
                  {renderVariation(entry)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
