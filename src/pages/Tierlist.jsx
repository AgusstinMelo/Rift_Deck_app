import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Trophy, Table2, Layers } from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import LaneBadge from '@/components/ui/LaneBadge';
import EmptyState from '@/components/ui/EmptyState';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];
const TIERS = ['S+', 'S', 'A', 'B', 'C'];

export default function Tierlist() {
  const [laneFilter, setLaneFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [viewMode, setViewMode] = useState('tier');
  const [patchFilter, setPatchFilter] = useState(''); // stores execution id

  const { data: tierlist = [], isLoading } = useQuery({
    queryKey: ['tierlist-full'],
    queryFn: () => getTierlistEntries('-ranking_final', 1000),
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const successfulExecs = executions.filter(e => e.status === 'success' || e.status === 'partial');

  const latestExec = successfulExecs[0];
  const previousExec = successfulExecs[1];

  const activeExec = patchFilter
    ? successfulExecs.find(e => e.id === patchFilter) || latestExec
    : latestExec;

  const activePatchFilter = activeExec?.patch || '';
  const previousPatch = activeExec === latestExec ? previousExec?.patch : null;

  const prevEntries = previousPatch ? tierlist.filter(t => t.patch === previousPatch) : [];

  const getPositionVariation = (entry) => {
    if (!previousPatch || prevEntries.length === 0) return null;

    const prev = prevEntries.find(
      p => p.champion_name === entry.champion_name && p.lane === entry.lane
    );

    if (!prev || prev.position_in_lane == null || entry.position_in_lane == null) {
      return null;
    }

    return prev.position_in_lane - entry.position_in_lane;
  };

  const filtered = tierlist.filter(t => {
    const matchPatch = t.patch === activePatchFilter;
    const matchLane = laneFilter === 'all' || t.lane === laneFilter;
    const matchTier = tierFilter === 'all' || t.tier === tierFilter;
    const matchDiff = diffFilter === 'all' || String(Math.round(t.difficulty)) === diffFilter;

    return matchPatch && matchLane && matchTier && matchDiff;
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

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Rift Deck Meta
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Tierlist
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            {activeExec ? (
              <>
                <span className="text-foreground font-medium">Parche {activeExec.patch}</span>
                {previousExec && activeExec === latestExec && (
                  <>
                    <span> vs </span>
                    <span className="text-foreground font-medium">Parche {previousExec.patch}</span>
                  </>
                )}
              </>
            ) : 'Sin datos de actualización'}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 rd-status-pill">
          <Trophy size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            {latestExec
              ? `Actualizado ${new Date(latestExec.executed_at).toLocaleDateString('es-ES')}`
              : 'Sin ejecución reciente'}
          </span>
        </div>
      </div>

      <div className="rd-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={laneFilter}
            onChange={e => setLaneFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">Todas las líneas</option>
            {LANES.map(l => (
              <option key={l} value={l}>
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">Todos los tiers</option>
            {TIERS.map(t => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </select>

          <select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">Dificultad</option>
            <option value="1">Fácil</option>
            <option value="2">Intermedia</option>
            <option value="3">Difícil</option>
          </select>

          {successfulExecs.length > 1 && (
            <select
              value={patchFilter || latestExec?.id || ''}
              onChange={e => setPatchFilter(e.target.value)}
              className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            >
              {successfulExecs.map(e => (
                <option key={e.id} value={e.id}>
                  {e.patch}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl ml-auto border border-border/60">
            <button
              onClick={() => setViewMode('tier')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${viewMode === 'tier'
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              <Layers size={13} />
              Por Tier
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${viewMode === 'table'
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              <Table2 size={13} />
              Tabla
            </button>
          </div>
        </div>
      </div>

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
            title="Sin datos de tierlist"
            description="La tierlist aún no tiene datos. Un administrador debe ejecutar la actualización automática."
          />
        </div>
      ) : viewMode === 'tier' ? (
        <div className="space-y-6">
          {TIERS.map(tier => {
            const championsInTier = filtered.filter(t => t.tier === tier);
            if (championsInTier.length === 0) return null;

            return (
              <div key={tier} className="rd-card overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/70 bg-secondary/20">
                  <TierBadge tier={tier} size="lg" />

                  <div>
                    <p className="rd-card-title">Tier {tier}</p>
                    <p className="text-xs text-muted-foreground">
                      {championsInTier.length} campeones
                    </p>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                  {championsInTier.map(entry => (
                    <div
                      key={entry.id}
                      className="
                        group relative overflow-hidden rounded-xl
                        border border-border/60
                        bg-secondary/25
                        hover:bg-secondary/45
                        hover:border-primary/25
                        transition-all duration-200
                        px-3 py-2.5
                      "
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.10),transparent_42%)]" />

                      <div className="relative flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted border border-primary/15 shrink-0">
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

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {entry.champion_name}
                            </p>

                            <div className="shrink-0">
                              {renderVariation(entry)}
                            </div>
                          </div>

                          <div className="mt-1 flex items-center gap-2">
                            <LaneBadge lane={entry.lane} />

                            <span className="text-[11px] text-muted-foreground">
                              {entry.winrate?.toFixed(1)}% WR
                            </span>
                          </div>
                        </div>
                      </div>
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
          <div className="rd-card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/70 bg-secondary/30">
                  <th className="text-left p-3 rd-label">#</th>
                  <th className="text-left p-3 rd-label">Campeón</th>
                  <th className="text-left p-3 rd-label">Línea</th>
                  <th className="text-left p-3 rd-label">Tier</th>
                  <th className="text-right p-3 rd-label">WR%</th>
                  <th className="text-right p-3 rd-label">PR%</th>
                  <th className="text-right p-3 rd-label">BR%</th>
                  <th className="text-right p-3 rd-label">Score</th>
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
                    <td className="p-3 text-right text-sm text-foreground">{entry.winrate?.toFixed(2)}%</td>
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
                      <p>WR</p>
                      <p className="text-blue-300">{entry.winrate?.toFixed(1)}%</p>
                    </div>

                    <div className="text-xs leading-tight text-muted-foreground">
                      <p>PR</p>
                      <p className="text-blue-300">{entry.pickrate?.toFixed(1)}%</p>
                    </div>

                    <div className="text-xs leading-tight text-muted-foreground">
                      <p>BR</p>
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
  );
}
