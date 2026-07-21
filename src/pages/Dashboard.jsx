import { Link } from 'react-router-dom';
import { Champion, WRItem, Rune, Spell } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  Swords,
  Wrench,
  Trophy,
  Target,
  ChevronRight,
  Sparkles,
  BookOpen,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import { computeInsights } from '@/hooks/useInsights';
import { useState } from 'react';
import PatchFilter from '@/components/filters/PatchFilter';
import { filterByPatch, patchMatchesSelection } from '@/utils/patches';

export default function Dashboard() {
  const { user } = useAuth();
  const [patchFilter, setPatchFilter] = useState('');

  const { data: allMatches = [] } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email
      ? getUserMatches(user, 1000)
      : [],
    enabled: !!user?.email,
  });

  const { data: allBuilds = [] } = useQuery({
    queryKey: ['builds-dashboard', user?.email],
    queryFn: () => user?.email
      ? getUserBuilds(user, 1000)
      : [],
    enabled: !!user?.email,
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['executions', 'patch-filters'],
    queryFn: () => getTierlistExecutions(100)
  });

  const successfulExecutions = executions
    .filter(e => e.status === 'success' || e.status === 'partial')
    .filter(e => patchMatchesSelection(e.patch, patchFilter));
  const latestSuccessExec = successfulExecutions[0];
  const recentSnapshotKeys = executions
    .filter(execution => (execution.status === 'success' || execution.status === 'partial') && execution.snapshot_key)
    .filter(execution => patchMatchesSelection(execution.patch, patchFilter))
    .slice(0, 3)
    .map(execution => execution.snapshot_key);

  const { data: tierlistHistory = [] } = useQuery({
    queryKey: ['tierlist-all', recentSnapshotKeys],
    queryFn: () => getTierlistEntries('-ranking_final', 2000, { snapshotKeys: recentSnapshotKeys }),
    enabled: recentSnapshotKeys.length > 0,
  });

  const tierlist = latestSuccessExec?.snapshot_key
    ? tierlistHistory.filter(entry => entry.snapshot_key === latestSuccessExec.snapshot_key)
    : [];

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name')
  });

  const { data: wrItems = [] } = useQuery({
    queryKey: ['wr-items'],
    queryFn: () => WRItem.list('name'),
  });

  const { data: runes = [] } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('name'),
  });

  const { data: spellsData = [] } = useQuery({
    queryKey: ['spells'],
    queryFn: () => Spell.list('name'),
  });

  const getSpellImg = (name) => spellsData.find(s => s.name === name)?.image_url;

  const getChampImg = (name) =>
    champions.find(c => c.name?.toLowerCase() === name?.toLowerCase())?.image_url;

  const matches = filterByPatch(allMatches, patchFilter);
  const builds = filterByPatch(allBuilds, patchFilter);

  const getMatchTimestamp = (match) => {
    if (!match?.date) return 0;

    const cleanDate = String(match.date).slice(0, 10);
    const cleanHour = match?.hour ? String(match.hour).slice(0, 5) : '00:00';

    const [year, month, day] = cleanDate.split('-').map(Number);
    const [hours, minutes] = cleanHour.split(':').map(Number);

    if (!year || !month || !day) return 0;

    return new Date(
      year,
      month - 1,
      day,
      Number.isNaN(hours) ? 0 : hours,
      Number.isNaN(minutes) ? 0 : minutes
    ).getTime();
  };

  const sortedMatches = [...matches].sort((a, b) => {
    return getMatchTimestamp(b) - getMatchTimestamp(a);
  });

  const latestMatches = sortedMatches.slice(0, 5);

  const topInsight = computeInsights({
    matches: sortedMatches,
    tierlist: tierlistHistory,
    wrItems,
    builds,
    champions,
    runes,
    spells: spellsData,
    limit: 1,
    minimum: 1,
  })[0] || null;

  const totalMatches = sortedMatches.length;
  const wins = sortedMatches.filter(m => m.result === 'win').length;
  const winrate = totalMatches > 0 ? (wins / totalMatches * 100) : null;

  const last10 = sortedMatches.slice(0, 10);
  const last10WR = last10.length > 0
    ? (last10.filter(m => m.result === 'win').length / last10.length * 100)
    : null;

  const prev10 = sortedMatches.slice(10, 20);
  const prev10WR = prev10.length > 0
    ? (prev10.filter(m => m.result === 'win').length / prev10.length * 100)
    : null;

  const wrTrend = (last10WR !== null && prev10WR !== null)
    ? (last10WR - prev10WR).toFixed(0)
    : null;

  const champCount = {};
  sortedMatches.forEach(m => {
    if (m.own_champion_name) {
      champCount[m.own_champion_name] = (champCount[m.own_champion_name] || 0) + 1;
    }
  });

  const topChamps = Object.entries(champCount).sort((a, b) => b[1] - a[1]);
  const mostUsed = topChamps[0];

  const mostUsedWR = mostUsed
    ? (() => {
        const ms = sortedMatches.filter(m => m.own_champion_name === mostUsed[0]);
        return (ms.filter(m => m.result === 'win').length / ms.length * 100).toFixed(0);
      })()
    : null;

  const buildMatchStats = {};
  sortedMatches.forEach(m => {
    if (m.build_id) {
      if (!buildMatchStats[m.build_id]) buildMatchStats[m.build_id] = { wins: 0, total: 0 };
      buildMatchStats[m.build_id].total++;
      if (m.result === 'win') buildMatchStats[m.build_id].wins++;
    }
  });

  const buildsWithStats = builds.map(b => ({
    ...b,
    matchStats: buildMatchStats[b.id] || null,
    wr: buildMatchStats[b.id]
      ? Math.round(buildMatchStats[b.id].wins / buildMatchStats[b.id].total * 100)
      : null,
  }));

  const matchupWins = {};
  sortedMatches.forEach(m => {
    if (m.enemy_champion_name) {
      if (!matchupWins[m.enemy_champion_name]) {
        matchupWins[m.enemy_champion_name] = { wins: 0, total: 0 };
      }

      matchupWins[m.enemy_champion_name].total++;

      if (m.result === 'win') {
        matchupWins[m.enemy_champion_name].wins++;
      }
    }
  });

  const matchupStats = Object.entries(matchupWins)
    .filter(([, v]) => v.total >= 3)
    .map(([champ, v]) => ({ champ, wr: v.wins / v.total * 100, total: v.total }));

  const bestMatchups = matchupStats
    .filter(m => m.wr > 50)
    .sort((a, b) => b.wr - a.wr)
    .slice(0, 3);

  const worstMatchups = matchupStats
    .filter(m => m.wr < 50)
    .sort((a, b) => a.wr - b.wr)
    .slice(0, 3);

  const laneHighlights = ['top', 'jungler', 'mid', 'adc', 'support']
    .map(lane => {
      const best = tierlist
        .filter(t => t.lane === lane)
        .sort((a, b) => b.ranking_final - a.ranking_final)
        .slice(0, 3);

      // Pad to always have 3 slots
      while (best.length < 3) best.push(null);

      return { lane, champions: best };
    })
    .filter(l => l.champions.some(c => c !== null));

  const lastExecution = patchFilter ? latestSuccessExec : executions[0];

  const wrColor = winrate === null
    ? 'text-muted-foreground'
    : winrate >= 55
      ? 'text-green-400'
      : winrate >= 45
        ? 'text-primary'
        : 'text-red-400';

  const wrLabel = winrate === null
    ? ''
    : winrate >= 55
      ? 'Buen rendimiento'
      : winrate >= 45
        ? 'Rendimiento normal'
        : 'Rendimiento bajo';

  const wrLabelColor = winrate === null
    ? ''
    : winrate >= 55
      ? 'bg-green-500/15 text-green-400 border-green-400/20'
      : winrate >= 45
        ? 'bg-primary/15 text-primary border-primary/20'
        : 'bg-red-500/15 text-red-400 border-red-400/20';

  const LANE_LABELS = {
    top: 'TOP',
    jungler: 'JUNGLA',
    mid: 'MID',
    adc: 'ADC',
    support: 'SUPPORT'
  };

  const LANE_ICONS = {
    top: 'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
    jungler: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
    mid: 'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
    adc: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
    support: 'https://media.base44.com/images/public/6a0005628d71002f05120013/3e7bd0424_support.png',
  };

  const formatDate = (date) => {
    if (!date) return '';

    const cleanDate = String(date).slice(0, 10);
    const [year, month, day] = cleanDate.split('-');

    return `${day}-${month}-${year}`;
  };

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Rift Deck Centro Táctico
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Dashboard
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Analiza tu rendimiento, builds y meta actual.
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground rd-status-pill">
            {lastExecution?.status === 'success'
              ? <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 shadow-[0_0_12px_rgba(74,222,128,.65)]" />
              : <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 shadow-[0_0_12px_rgba(248,113,113,.65)]" />
            }

            <span>Datos actualizados</span>

            {latestSuccessExec?.patch && (
              <>
                <span className="text-border">|</span>
                <span>Parche {latestSuccessExec.patch}</span>
              </>
            )}

            {latestSuccessExec?.snapshot_date && (
              <>
                <span className="text-border">|</span>
                <span>Tierlist {formatDate(latestSuccessExec.snapshot_date)}</span>
              </>
            )}

            <Sparkles size={14} className="text-primary" />
          </div>
          <PatchFilter
            value={patchFilter}
            onChange={setPatchFilter}
            patches={[
              ...allMatches.map(match => match.patch),
              ...allBuilds.map(build => build.patch),
              ...executions.map(execution => execution.patch),
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rd-card rd-card-watermark p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="rd-label">Partidas</span>
            <Swords size={17} className="text-primary" />
          </div>

          <p className="font-rajdhani font-bold text-4xl text-primary tracking-[-0.08em]">
            {totalMatches || '—'}
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-accent">{wins}V</span>
            <span className="mx-1">/</span>
            <span className="text-red-400">{totalMatches - wins}D</span>
          </p>
        </div>

        <div className="rd-card p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="rd-label">Winrate</span>
            <Trophy size={17} className="text-primary" />
          </div>

          <p className={`font-rajdhani font-bold text-4xl tracking-[-0.08em] ${wrColor}`}>
            {winrate !== null ? `${winrate.toFixed(1)}%` : '—'}
          </p>

          {winrate !== null && (
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium mt-1 inline-block border ${wrLabelColor}`}>
              {wrLabel}
            </span>
          )}

          {wrTrend !== null && (
            <p className={`text-xs mt-1 ${Number(wrTrend) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {Number(wrTrend) >= 0 ? '+' : ''}{wrTrend}% vs últimas 10
            </p>
          )}
        </div>

        <div className="rd-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="rd-label">Campeón más usado</span>
            <Target size={17} className="text-accent" />
          </div>

          <div className="flex items-center gap-3">
            {mostUsed && getChampImg(mostUsed[0]) && (
              <img
                src={getChampImg(mostUsed[0])}
                alt={mostUsed[0]}
                className="w-12 h-12 rounded-full object-cover border border-accent/40 shadow-[0_0_18px_rgba(0,174,239,.16)] shrink-0"
              />
            )}

            <div>
              <p className="font-rajdhani font-bold text-2xl text-accent tracking-[-0.06em]">
                {mostUsed?.[0] || '—'}
              </p>

              {mostUsed && (
                <p className="text-xs text-muted-foreground">
                  {mostUsed[1]} partidas
                </p>
              )}

              {mostUsedWR && (
                <p className="text-xs text-muted-foreground">
                  {mostUsedWR}% WR
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rd-card rd-card-watermark p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="rd-label">Builds creadas</span>
            <Wrench size={17} className="text-primary" />
          </div>

          <p className="font-rajdhani font-bold text-4xl text-primary tracking-[-0.08em]">
            {builds.length || '—'}
          </p>

          {builds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {buildsWithStats.filter(b => b.matchStats).length} usada
              {buildsWithStats.filter(b => b.matchStats).length !== 1 ? 's' : ''} en ranked
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rd-card rd-card-watermark p-5">
          <div className="flex items-start gap-4">
          
            <img
              src="https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/83cce9c3d_ChatGPTImage19may202611_43_41pm.png"
              alt="Rift Deck Coach"
              className="w-[100px] object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.35)]"
            />

            <div>
              <p className="rd-section-kicker">Insight del día</p>

              {topInsight ? (
                <div className="max-w-2xl">
                  <p className="font-rajdhani text-lg font-bold text-foreground leading-tight">
                    {topInsight.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    {topInsight.thesis}
                  </p>
                  <p className="text-xs text-primary/90 mt-2">
                    Consejo: {topInsight.action}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Registrá más partidas para recibir insights personalizados.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rd-card p-5">
          <p className="text-xs text-green-400 uppercase tracking-[0.16em] font-semibold mb-3">
            Mejor partida reciente
          </p>

          {sortedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin partidas registradas.</p>
          ) : (() => {
            const recentMatches = sortedMatches.filter(m => {
              const matchDate = new Date(m.date || m.created_date);
              const sevenDaysAgo = new Date();

              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

              return matchDate >= sevenDaysAgo;
            });

            const best = [...recentMatches]
              .filter(m => m.result === 'win' && m.kills != null)
              .sort((a, b) => {
                const kdaA = (a.deaths || 0) === 0 ? (a.kills + a.assists) : (a.kills + a.assists) / a.deaths;
                const kdaB = (b.deaths || 0) === 0 ? (b.kills + b.assists) : (b.kills + b.assists) / b.deaths;
                return kdaB - kdaA;
              })[0] || sortedMatches[0];

            const kda = best.deaths === 0
              ? (best.kills + best.assists).toFixed(2)
              : ((best.kills + best.assists) / best.deaths).toFixed(2);

            return (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-primary/10 border border-primary/20 shrink-0">
                    {getChampImg(best.own_champion_name)
                      ? (
                        <img
                          src={getChampImg(best.own_champion_name)}
                          alt={best.own_champion_name}
                          className="w-full h-full object-cover"
                        />
                      )
                      : (
                        <span className="text-primary font-bold flex items-center justify-center w-full h-full">
                          {best.own_champion_name?.[0]}
                        </span>
                      )
                    }
                  </div>

                  <div>
                    <p className="font-semibold text-foreground text-base">
                      {best.own_champion_name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {best.lane}
                      {best.date && ` · ${formatDate(best.date)}`}
                      {best.hour && ` · ${best.hour}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-green-500/15 border border-green-400/20 text-green-400 text-xs font-bold px-2 py-1 rounded">
                    Victoria
                  </span>

                  <span className="bg-secondary/80 border border-border text-muted-foreground text-xs px-2 py-1 rounded">
                    KDA {best.kills}/{best.deaths}/{best.assists} ({kda})
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="rd-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="rd-card-title">Últimas Partidas</h2>
            <Link to="/matches" className="rd-link">Ver todas</Link>
          </div>

          {sortedMatches.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No hay partidas registradas aún.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/70 flex-1">
              {latestMatches.map(m => (
                <div key={m.id} className="flex items-center gap-3 flex-1 py-0 min-h-[4rem]">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary shrink-0 ring-1 ring-primary/15">
                    {getChampImg(m.own_champion_name)
                      ? (
                        <img
                          src={getChampImg(m.own_champion_name)}
                          alt={m.own_champion_name}
                          className="w-full h-full object-cover"
                        />
                      )
                      : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                          {m.own_champion_name?.[0]}
                        </div>
                      )
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.own_champion_name}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {m.lane} · KDA {m.kills}/{m.deaths}/{m.assists}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold ${m.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>
                      {m.result === 'win' ? 'Victoria' : 'Derrota'}
                    </span>

                    {m.date && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(m.date)}{m.hour ? ` · ${m.hour}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link to="/matches" className="mt-auto pt-3 block text-center rd-link">
            Ver historial completo
          </Link>
        </div>

        <div className="rd-card rd-card-watermark p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="rd-card-title">Últimas Builds</h2>
            <Link to="/build-calculator" className="rd-link">Ver todas</Link>
          </div>

          {builds.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No hay builds creadas aún.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border/70 flex-1">
              {buildsWithStats.slice(0, 5).map(b => {
                const keystoneRune = runes.find(r => r.branch === 'Clave' && (b.additional_runes || []).includes(r.name));
                return (
                  <div key={b.id} className="flex items-center gap-3 flex-1 py-0 min-h-[4rem]">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary shrink-0 ring-1 ring-primary/15">
                      {getChampImg(b.champion_name)
                        ? <img src={getChampImg(b.champion_name)} alt={b.champion_name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{b.champion_name?.[0]}</div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">
                        {b.name}
                      </p>

                      <div className="flex items-center gap-1.5 mt-1">
                        {keystoneRune?.image_url && (
                          <>
                            <img
                              src={keystoneRune.image_url}
                              alt={keystoneRune.name}
                              title={keystoneRune.name}
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-primary/30 shrink-0"
                            />
                            <span className="w-px h-4 bg-border/70 shrink-0" />
                          </>
                        )}
                        {b.items?.length > 0 && b.items.slice(0, 6).map((itemName, i) => {
                          const item = wrItems.find(it => it.name === itemName);
                          return item?.image_url
                            ? <img key={i} src={item.image_url} alt={itemName} title={itemName} className="w-5 h-5 rounded object-cover ring-1 ring-primary/10" />
                            : <div key={i} className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[7px] text-muted-foreground font-bold">{itemName?.[0]}</div>;
                        })}
                      </div>
                    </div>

                    {/* Spells vertical + WR */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {(b.spells || []).map((spell, i) => (
                        getSpellImg(spell)
                          ? <img key={i} src={getSpellImg(spell)} alt={spell} title={spell} className="w-5 h-5 rounded-full object-cover" />
                          : <span key={i} className="text-[10px] text-muted-foreground">{spell}</span>
                      ))}
                      {b.wr !== null && (
                        <span className={`text-xs font-bold ${b.wr >= 55 ? 'text-green-400' : b.wr >= 45 ? 'text-primary' : 'text-red-400'}`}>
                          {b.wr}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Link to="/build-calculator" className="mt-auto pt-3 block text-center rd-link">
            Ver biblioteca completa
          </Link>
        </div>

        <div className="rd-card p-5">
          <h2 className="rd-card-title mb-4">Análisis de Matchups</h2>

          {matchupStats.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              Necesitás más partidas para detectar tus matchups.
            </p>
          ) : (
            <>
              <p className="rd-mini-label text-green-400">Favorables</p>

              <div className="space-y-1.5 mb-4">
                {bestMatchups.map(m => (
                  <div key={m.champ} className="rd-list-row">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary shrink-0">
                      {getChampImg(m.champ)
                        ? <img src={getChampImg(m.champ)} alt={m.champ} className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-primary">{m.champ[0]}</span>
                      }
                    </div>

                    <span className="text-sm text-foreground flex-1 truncate">{m.champ}</span>
                    <span className="text-xs font-bold text-green-400">{m.wr.toFixed(0)}% WR</span>
                  </div>
                ))}
              </div>

              <p className="rd-mini-label text-red-400">Problemáticos</p>

              <div className="space-y-1.5 mb-4">
                {worstMatchups.map(m => (
                  <div key={m.champ} className="rd-list-row">
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary shrink-0">
                      {getChampImg(m.champ)
                        ? <img src={getChampImg(m.champ)} alt={m.champ} className="w-full h-full object-cover" />
                        : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-primary">{m.champ[0]}</span>
                      }
                    </div>

                    <span className="text-sm text-foreground flex-1 truncate">{m.champ}</span>
                    <span className="text-xs font-bold text-red-400">{m.wr.toFixed(0)}% WR</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rd-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="rd-card-title">Meta del Parche por Línea</h2>

          <Link to="/tierlist" className="rd-link flex items-center gap-1">
            Ver tierlist completa <ChevronRight size={12} />
          </Link>
        </div>

        {laneHighlights.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Cargá la tierlist para ver campeones meta.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {laneHighlights.map(({ lane, champions: lchamps }) => (
              <div key={lane} className="bg-secondary/30 border border-border/80 rounded-xl overflow-hidden">
                <div className="px-3 pt-3 pb-2 flex items-center gap-2">
                  <img src={LANE_ICONS[lane]} alt={lane} className="w-5 h-5 object-contain shrink-0" />
                  <span className="text-xs font-bold text-muted-foreground tracking-wide">
                    {LANE_LABELS[lane]}
                  </span>
                </div>

                <div className="px-3 pb-3 space-y-1.5">
                  {lchamps.map((champion, idx) => (
                    <div key={champion?.id ?? `empty-${idx}`} className="rd-list-row h-11">
                      <span className="text-[10px] text-muted-foreground font-bold w-3 shrink-0">
                        {champion ? idx + 1 : ''}
                      </span>

                      <div className="w-8 h-8 rounded overflow-hidden bg-muted shrink-0">
                        {champion?.image_url
                          ? (
                            <img
                              src={champion.image_url}
                              alt={champion.champion_name}
                              className="w-full h-full object-cover object-top"
                            />
                          )
                          : champion
                          ? (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                              {champion.champion_name[0]}
                            </div>
                          )
                          : <div className="w-full h-full" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        {champion && (
                          <>
                            <p className="text-xs font-semibold text-foreground truncate">
                              {champion.champion_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {champion.winrate?.toFixed(1)}% WR
                            </p>
                          </>
                        )}
                      </div>

                      {champion && <TierBadge tier={champion.tier} size="sm" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="rd-card-title mb-3">Acciones Rápidas</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Link to="/build-calculator" className="rd-action-card group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Wrench size={20} className="text-primary" />
            </div>

            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground group-hover:text-primary">
                Nueva Build
              </p>

              <p className="text-xs text-muted-foreground">
                Crear build personalizada
              </p>
            </div>

            <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link to="/matches" className="rd-action-card group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Swords size={20} className="text-primary" />
            </div>

            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground group-hover:text-primary">
                Registrar Partida
              </p>

              <p className="text-xs text-muted-foreground">
                Añadir nueva partida
              </p>
            </div>

            <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/library', label: 'Biblioteca', icon: BookOpen, desc: 'Campeones, objetos y runas' },
            { to: '/tierlist', label: 'Tierlist', icon: TrendingUp, desc: 'Meta actual por parche' },
            { to: '/stats', label: 'Mis Estadísticas', icon: BarChart3, desc: 'Análisis personal' },
            { to: '/suggester', label: 'Sugeridor', icon: Sparkles, desc: 'Recomendaciones' },
          ].map(item => {
            const Icon = item.icon;

            return (
              <Link key={item.to} to={item.to} className="rd-mini-action group">
                <Icon size={20} className="mx-auto mb-2 text-primary" />

                <p className="font-semibold text-xs text-foreground group-hover:text-primary">
                  {item.label}
                </p>

                <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                  {item.desc}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
