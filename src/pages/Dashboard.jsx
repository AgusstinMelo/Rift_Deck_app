import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Champion, WRItem, Rune, Spell } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';
import TierBadge from '@/components/ui/TierBadge';
import PatchFilter from '@/components/filters/PatchFilter';
import { getChampionInsight } from '@/components/library/ChampionDetail';
import { computeInsights } from '@/hooks/useInsights';
import { filterByPatch, patchMatchesSelection } from '@/utils/patches';
import { matchKda } from '@/domain/matchStats';
import GoalsDashboardWidget from '@/features/goals/components/GoalsDashboardWidget';

const DASHBOARD_TABS = [
  { id: 'summary', label: 'Resumen' },
  { id: 'activity', label: 'Actividad' },
  { id: 'meta', label: 'Meta' },
];

const DASHBOARD_HEADINGS = {
  summary: {
    title: 'Dashboard',
    description: 'Analiza tu rendimiento, builds y meta actual.',
  },
  activity: {
    title: 'Actividad',
    description: 'Repasa tus últimas partidas, builds y matchups.',
  },
  meta: {
    title: 'Meta',
    description: 'Compara el parche actual con tus campeones principales.',
  },
};

const LANE_LABELS = { top: 'TOP', jungler: 'JUNGLA', mid: 'MID', adc: 'ADC', support: 'SUPPORT' };
const LANE_ICONS = {
  top: 'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
  jungler: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
  mid: 'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
  adc: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
  support: 'https://media.base44.com/images/public/6a0005628d71002f05120013/3e7bd0424_support.png',
};

const formatDate = (date) => {
  if (!date) return '';
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
};

const getKda = (match) =>
  matchKda(Number(match?.kills) || 0, Number(match?.deaths) || 0, Number(match?.assists) || 0);

// K/D/A legible: un dato no registrado (null) se muestra como "—".
const formatKdaLine = (match) =>
  [match?.kills, match?.deaths, match?.assists].map(value => value ?? '—').join('/');

export default function Dashboard() {
  const { user } = useAuth();
  const [patchFilter, setPatchFilter] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [mainIndex, setMainIndex] = useState(0);
  const activeHeading = DASHBOARD_HEADINGS[activeTab];

  const { data: allMatches = [] } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email ? getUserMatches(user, 1000) : [],
    enabled: !!user?.email,
  });
  const { data: allBuilds = [] } = useQuery({
    queryKey: ['builds-dashboard', user?.email],
    queryFn: () => user?.email ? getUserBuilds(user, 1000) : [],
    enabled: !!user?.email,
  });
  const { data: executions = [] } = useQuery({
    queryKey: ['executions', 'patch-filters'],
    queryFn: () => getTierlistExecutions(100),
  });

  const successfulExecutions = executions
    .filter(execution => execution.status === 'success' || execution.status === 'partial')
    .filter(execution => patchMatchesSelection(execution.patch, patchFilter));
  const latestSuccessExec = successfulExecutions[0];
  const recentSnapshotKeys = successfulExecutions
    .filter(execution => execution.snapshot_key)
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

  const { data: champions = [] } = useQuery({ queryKey: ['champions'], queryFn: () => Champion.list('name') });
  const { data: wrItems = [] } = useQuery({ queryKey: ['wr-items'], queryFn: () => WRItem.list('name') });
  const { data: runes = [] } = useQuery({ queryKey: ['runes'], queryFn: () => Rune.list('name') });
  const { data: spellsData = [] } = useQuery({ queryKey: ['spells'], queryFn: () => Spell.list('name') });

  const getChampImg = (name) => champions.find(
    champion => champion.name?.toLowerCase() === name?.toLowerCase()
  )?.image_url;
  const getSpellImg = (name) => spellsData.find(spell => spell.name === name)?.image_url;
  const matches = filterByPatch(allMatches, patchFilter);
  const builds = filterByPatch(allBuilds, patchFilter);

  const getMatchTimestamp = (match) => {
    if (!match?.date) return 0;
    const [year, month, day] = String(match.date).slice(0, 10).split('-').map(Number);
    const [hours, minutes] = String(match.hour || '00:00').slice(0, 5).split(':').map(Number);
    if (!year || !month || !day) return 0;
    return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
  };

  const sortedMatches = [...matches].sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));
  const latestMatches = sortedMatches.slice(0, 10);
  const totalMatches = sortedMatches.length;
  const wins = sortedMatches.filter(match => match.result === 'win').length;
  const winrate = totalMatches ? (wins / totalMatches) * 100 : null;

  const sevenDayCutoff = new Date();
  sevenDayCutoff.setHours(0, 0, 0, 0);
  sevenDayCutoff.setDate(sevenDayCutoff.getDate() - 6);
  const recentSevenDayMatches = sortedMatches.filter(match => getMatchTimestamp(match) >= sevenDayCutoff.getTime());
  const averageSevenDayKda = recentSevenDayMatches.length
    ? recentSevenDayMatches.reduce((sum, match) => sum + getKda(match), 0) / recentSevenDayMatches.length
    : null;
  const lastTenMatches = sortedMatches.slice(0, 10);
  const recentFormWr = lastTenMatches.length
    ? (lastTenMatches.filter(match => match.result === 'win').length / lastTenMatches.length) * 100
    : null;
  const streakResult = sortedMatches[0]?.result || null;
  const currentStreak = streakResult
    ? sortedMatches.findIndex(match => match.result !== streakResult)
    : 0;
  const currentStreakCount = streakResult
    ? (currentStreak === -1 ? sortedMatches.length : currentStreak)
    : 0;

  const championGroups = sortedMatches.reduce((groups, match) => {
    const name = match.own_champion_name;
    if (!name) return groups;
    if (!groups[name]) groups[name] = [];
    groups[name].push(match);
    return groups;
  }, {});
  const topChamps = Object.entries(championGroups).sort((a, b) => b[1].length - a[1].length);
  const mostUsed = topChamps[0];
  const mostUsedWR = mostUsed
    ? (mostUsed[1].filter(match => match.result === 'win').length / mostUsed[1].length) * 100
    : null;

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

  const bestRecentMatch = [...recentSevenDayMatches]
    .filter(match => match.result === 'win')
    .sort((a, b) => getKda(b) - getKda(a))[0] || sortedMatches[0] || null;

  const buildMatchStats = sortedMatches.reduce((stats, match) => {
    if (!match.build_id) return stats;
    if (!stats[match.build_id]) stats[match.build_id] = { wins: 0, total: 0 };
    stats[match.build_id].total += 1;
    if (match.result === 'win') stats[match.build_id].wins += 1;
    return stats;
  }, {});
  const buildsWithStats = builds.map(build => ({
    ...build,
    wr: buildMatchStats[build.id]
      ? Math.round((buildMatchStats[build.id].wins / buildMatchStats[build.id].total) * 100)
      : null,
  }));

  const matchupStats = Object.entries(sortedMatches.reduce((stats, match) => {
    if (!match.enemy_champion_name) return stats;
    if (!stats[match.enemy_champion_name]) stats[match.enemy_champion_name] = { wins: 0, total: 0 };
    stats[match.enemy_champion_name].total += 1;
    if (match.result === 'win') stats[match.enemy_champion_name].wins += 1;
    return stats;
  }, {}))
    .map(([champ, stat]) => ({ champ, total: stat.total, wr: (stat.wins / stat.total) * 100 }));
  const bestMatchups = matchupStats
    .filter(item => item.wr > 50)
    .sort((a, b) => b.total - a.total || b.wr - a.wr)
    .slice(0, 5);
  const worstMatchups = matchupStats
    .filter(item => item.wr < 50)
    .sort((a, b) => b.total - a.total || a.wr - b.wr)
    .slice(0, 5);

  const laneHighlights = Object.keys(LANE_LABELS).map(lane => ({
    lane,
    champions: tierlist
      .filter(entry => entry.lane === lane)
      .sort((a, b) => Number(b.ranking_final || 0) - Number(a.ranking_final || 0))
      .slice(0, 3),
  }));

  const mainChampions = topChamps.slice(0, 3).map(([name, championMatches]) => {
    const meta = tierlist
      .filter(entry => entry.champion_name?.toLowerCase() === name.toLowerCase())
      .sort((a, b) => Number(b.ranking_final || 0) - Number(a.ranking_final || 0))[0] || null;
    const laneRanking = meta
      ? tierlist
        .filter(entry => entry.lane === meta.lane)
        .sort((a, b) => Number(b.ranking_final || 0) - Number(a.ranking_final || 0))
      : [];
    const rankIndex = meta
      ? laneRanking.findIndex(entry => entry.champion_name?.toLowerCase() === name.toLowerCase())
      : -1;
    const personalWins = championMatches.filter(match => match.result === 'win').length;
    const totalKills = championMatches.reduce((sum, match) => sum + (Number(match.kills) || 0), 0);
    const totalDeaths = championMatches.reduce((sum, match) => sum + (Number(match.deaths) || 0), 0);
    const totalAssists = championMatches.reduce((sum, match) => sum + (Number(match.assists) || 0), 0);
    const killsAvg = totalKills / championMatches.length;
    const deathsAvg = totalDeaths / championMatches.length;
    const assistsAvg = totalAssists / championMatches.length;
    const personalWr = (personalWins / championMatches.length) * 100;
    const personalKda = championMatches.reduce((sum, match) => sum + getKda(match), 0) / championMatches.length;
    const recentMainMatches = [...championMatches]
      .sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a))
      .slice(0, 10);
    const recentMainWins = recentMainMatches.filter(match => match.result === 'win').length;
    const recentWr = recentMainMatches.length ? (recentMainWins / recentMainMatches.length) * 100 : personalWr;
    const cleanRate = championMatches.filter(match => (Number(match.deaths) || 0) <= 3).length / championMatches.length;
    const participationRatio = killsAvg > 0 && assistsAvg > 0 ? assistsAvg / killsAvg : null;
    const insight = getChampionInsight({
      championName: name,
      totalGames: championMatches.length,
      numericWr: Number(personalWr.toFixed(1)),
      deathsAvg: Number(deathsAvg.toFixed(1)),
      killsAvg: Number(killsAvg.toFixed(1)),
      assistsAvg: Number(assistsAvg.toFixed(1)),
      kdaNum: personalKda,
      recentWrNum: recentWr,
      recentMatchesCount: recentMainMatches.length,
      cleanRate,
      participationRatio,
      selectedTierEntry: meta,
    });
    return {
      name,
      games: championMatches.length,
      personalWr,
      personalKda,
      meta,
      position: rankIndex >= 0 ? rankIndex + 1 : null,
      insight,
    };
  });
  const selectedMain = mainChampions[Math.min(mainIndex, Math.max(mainChampions.length - 1, 0))];

  const changeMain = (direction) => {
    if (mainChampions.length < 2) return;
    setMainIndex(current => (current + direction + mainChampions.length) % mainChampions.length);
  };

  const wrColor = winrate === null
    ? 'text-muted-foreground'
    : winrate >= 55 ? 'text-green-400' : winrate >= 45 ? 'text-primary' : 'text-red-400';

  const renderChampionAvatar = (name, className = 'w-9 h-9', fallbackImageUrl = '') => {
    const imageUrl = getChampImg(name) || fallbackImageUrl;
    return (
    <div className={`${className} rounded-lg overflow-hidden bg-secondary shrink-0 ring-1 ring-primary/20`}>
      {imageUrl
        ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">{name?.[0]}</span>}
    </div>
    );
  };

  return (
    <div className="rd-page rd-dashboard-tabs">
      <header className="rd-dashboard-header">
        <div>
          <div className="rd-dashboard-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Rift Deck Centro Táctico</span>
          </div>
          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{activeHeading.title}</h1>
          <p className="rd-dashboard-description mt-0.5 text-sm text-muted-foreground">{activeHeading.description}</p>
        </div>

        <div className="rd-panel-tabs rd-dashboard-tablist" role="tablist" aria-label="Secciones del Dashboard">
          {DASHBOARD_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`rd-panel-tab ${activeTab === tab.id ? 'rd-panel-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground rd-status-pill">
            <span className={`w-2 h-2 rounded-full shrink-0 ${latestSuccessExec ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.65)]' : 'bg-red-400'}`} />
            <span>Datos actualizados</span>
            <span className="text-border">|</span>
            <span>{latestSuccessExec?.patch ? `Parche ${latestSuccessExec.patch}` : 'Sin parche'}</span>
            {latestSuccessExec?.snapshot_date && <>
              <span className="text-border">|</span>
              <span>Tierlist {formatDate(latestSuccessExec.snapshot_date)}</span>
            </>}
            <Sparkles size={14} className="text-primary" />
          </div>
          <PatchFilter
            className="rd-dashboard-patch"
            value={patchFilter}
            onChange={(value) => { setPatchFilter(value); setMainIndex(0); }}
            patches={[
              ...allMatches.map(match => match.patch),
              ...allBuilds.map(build => build.patch),
              ...executions.map(execution => execution.patch),
            ]}
          />
        </div>
      </header>

      <main className="rd-dashboard-panel rd-analytics-panel">
        {activeTab === 'summary' && (
          <section className="rd-dashboard-summary" aria-label="Resumen">
            <div className="rd-dashboard-stats grid grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Partidas</span><Swords size={17} className="text-primary" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-primary">{totalMatches || '—'}</p>
                <p className="text-xs text-muted-foreground"><span className="text-green-400">{wins}V</span> / <span className="text-red-400">{totalMatches - wins}D</span></p>
              </article>
              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Winrate</span><Trophy size={17} className="text-primary" /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${wrColor}`}>{winrate === null ? '—' : `${winrate.toFixed(1)}%`}</p>
                <p className="text-xs text-muted-foreground">Rendimiento global filtrado</p>
              </article>
              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Campeón más usado</span><Target size={17} className="text-accent" /></div>
                <div className="flex items-center gap-3 min-h-0">
                  {renderChampionAvatar(mostUsed?.[0], 'w-10 h-10 rd-dashboard-stat-avatar')}
                  <div className="min-w-0"><p className="font-rajdhani font-bold text-lg text-accent truncate">{mostUsed?.[0] || '—'}</p><p className="rd-dashboard-stat-hint text-xs text-muted-foreground">Pick principal del historial</p></div>
                </div>
                {mostUsed ? <div className="rd-dashboard-stat-tags flex items-center gap-2">
                  <span className="rounded border border-border bg-secondary/80 px-2 py-0.5 text-[11px] text-muted-foreground">{mostUsed[1].length} partidas</span>
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${mostUsedWR >= 50 ? 'border-green-400/25 bg-green-500/10 text-green-400' : 'border-red-400/25 bg-red-500/10 text-red-400'}`}>{mostUsedWR.toFixed(0)}% WR</span>
                </div> : <p className="text-xs text-muted-foreground">Sin partidas registradas</p>}
              </article>
              <article className="rd-card rd-dashboard-stat rd-card-watermark">
                <div className="flex items-center justify-between"><span className="rd-label">KDA promedio</span><BarChart3 size={17} className="text-primary" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-primary">{averageSevenDayKda === null ? '—' : averageSevenDayKda.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{recentSevenDayMatches.length} partidas · últimos 7 días</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Forma reciente</span><TrendingUp size={17} className="text-primary" /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${recentFormWr === null ? 'text-muted-foreground' : recentFormWr >= 50 ? 'text-green-400' : 'text-red-400'}`}>{recentFormWr === null ? '—' : `${recentFormWr.toFixed(0)}%`}</p>
                <p className="text-xs text-muted-foreground">WR en las últimas {lastTenMatches.length} partidas</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Racha actual</span><Flame size={17} className={streakResult === 'win' ? 'text-green-400' : 'text-red-400'} /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${!streakResult ? 'text-muted-foreground' : streakResult === 'win' ? 'text-green-400' : 'text-red-400'}`}>{streakResult ? currentStreakCount : '—'}</p>
                <p className="text-xs text-muted-foreground">{streakResult ? `${streakResult === 'win' ? 'Victorias' : 'Derrotas'} consecutivas` : 'Sin partidas registradas'}</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">Campeones utilizados</span><Users size={17} className="text-accent" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-accent">{topChamps.length || '—'}</p>
                <p className="text-xs text-muted-foreground">Picks diferentes registrados</p>
              </article>

              <article className="rd-card rd-dashboard-stat rd-card-watermark">
                <div className="flex items-center justify-between"><span className="rd-label">Mejor partida reciente</span><Trophy size={17} className="text-green-400" /></div>
                {bestRecentMatch ? <div className="flex items-center gap-3 min-h-0">
                  {renderChampionAvatar(bestRecentMatch.own_champion_name, 'w-10 h-10 rd-dashboard-stat-avatar')}
                  <div className="min-w-0 flex-1">
                    <p className="font-rajdhani text-lg font-bold text-foreground truncate">{bestRecentMatch.own_champion_name}</p>
                    <p className="text-xs text-muted-foreground">{bestRecentMatch.lane} · {formatDate(bestRecentMatch.date)}</p>
                  </div>
                </div> : <p className="font-rajdhani rd-dashboard-stat-value text-muted-foreground">—</p>}
                {bestRecentMatch ? <div className="rd-dashboard-stat-tags flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${bestRecentMatch.result === 'win' ? 'border-green-400/25 bg-green-500/10 text-green-400' : 'border-red-400/25 bg-red-500/10 text-red-400'}`}>{bestRecentMatch.result === 'win' ? 'Victoria' : 'Derrota'}</span>
                  <span className="rounded border border-border bg-secondary/80 px-2 py-0.5 text-[11px] text-muted-foreground">{formatKdaLine(bestRecentMatch)} · KDA {getKda(bestRecentMatch).toFixed(2)}</span>
                </div> : <p className="text-xs text-muted-foreground">Sin partidas registradas</p>}
              </article>
            </div>

            <div className="rd-dashboard-side grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 min-h-0">
              <article className="rd-card rd-card-watermark rd-dashboard-insight p-5 min-h-0 overflow-hidden">
                <div className="flex items-start gap-4 h-full">
                  <img src="https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/83cce9c3d_ChatGPTImage19may202611_43_41pm.png" alt="Rift Deck Coach" className="rd-dashboard-insight-art w-[88px] self-center object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.35)]" />
                  <div className="min-w-0 self-center">
                    <p className="rd-section-kicker">Insight del día</p>
                    {topInsight ? <><h2 className="font-rajdhani text-xl font-bold text-foreground leading-tight mt-1">{topInsight.title}</h2><p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{topInsight.thesis}</p><p className="rd-dashboard-insight-tip text-xs text-primary mt-3 line-clamp-2">Consejo: {topInsight.action}</p></> : <p className="text-sm text-muted-foreground mt-2">Registrá más partidas para recibir insights personalizados.</p>}
                  </div>
                </div>
              </article>
              <GoalsDashboardWidget />
            </div>
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="rd-dashboard-activity" aria-label="Actividad">
            <article className="rd-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">Últimas partidas</h2><Link to="/matches" className="rd-link">Ver todas</Link></div>
              <div className="rd-dashboard-list rd-dashboard-match-list">
                {latestMatches.length ? latestMatches.map(match => <div key={match.id} className="font-rajdhani rd-dashboard-row">
                  {renderChampionAvatar(match.own_champion_name, 'w-9 h-9')}
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{match.own_champion_name}</p><p className="text-[11px] text-muted-foreground">{match.lane} · {formatKdaLine(match)}</p></div>
                  <div className="text-right"><p className={`text-xs font-bold ${match.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>{match.result === 'win' ? 'Victoria' : 'Derrota'}</p><p className="text-[10px] text-muted-foreground">{formatDate(match.date)}</p></div>
                </div>) : <p className="text-sm text-muted-foreground text-center my-auto">No hay partidas registradas.</p>}
              </div>
            </article>

            <article className="rd-card rd-card-watermark p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">Últimas builds</h2><Link to="/build-calculator" className="rd-link">Ver todas</Link></div>
              <div className="rd-dashboard-list">
                {buildsWithStats.length ? buildsWithStats.slice(0, 5).map(build => {
                  const keystone = runes.find(rune => rune.branch === 'Clave' && (build.additional_runes || []).includes(rune.name));
                  const itemSlots = Array.from({ length: 6 }, (_, index) => build.items?.[index] || null);
                  const spellSlots = Array.from({ length: 2 }, (_, index) => build.spells?.[index] || null);
                  return <div key={build.id} className="font-rajdhani rd-dashboard-row rd-dashboard-build-row">
                    <div className="rd-dashboard-build-name">
                      {renderChampionAvatar(build.champion_name, 'w-10 h-10')}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{build.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{build.champion_name}</p>
                      </div>
                    </div>

                    <div className="rd-build-loadout">
                      <div className="rd-build-keystone" title={keystone?.name || 'Sin runa clave'}>
                        {keystone?.image_url
                          ? <img src={keystone.image_url} alt={keystone.name} />
                          : <span>R</span>}
                      </div>

                      <div className="rd-build-spells">
                        {spellSlots.map((spell, index) => getSpellImg(spell)
                          ? <img key={spell || index} src={getSpellImg(spell)} alt={spell} title={spell} />
                          : <span key={index} />)}
                      </div>

                      <div className="rd-build-items">
                        {itemSlots.map((itemName, index) => {
                          const item = wrItems.find(entry => entry.name === itemName);
                          return item?.image_url
                            ? <img key={`${itemName}-${index}`} src={item.image_url} alt={itemName} title={itemName} />
                            : <span key={index} />;
                        })}
                      </div>
                    </div>

                    {build.wr !== null && <span className="rd-build-winrate">{build.wr}%</span>}
                  </div>;
                }) : <p className="text-sm text-muted-foreground text-center my-auto">No hay builds creadas.</p>}
              </div>
            </article>

            <article className="rd-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">Análisis de matchups</h2><Link to="/stats" className="rd-link">Ampliar</Link></div>
              {matchupStats.length ? <div className="grid grid-rows-2 gap-3 min-h-0 flex-1">
                {[{ title: 'Favorables', rows: bestMatchups, positive: true }, { title: 'Problemáticos', rows: worstMatchups, positive: false }].map(group => <div key={group.title} className={`rd-dashboard-matchup-group rounded-xl border p-2 min-h-0 overflow-hidden ${group.positive ? 'bg-green-500/[0.05] border-green-400/15' : 'bg-red-500/[0.05] border-red-400/15'}`}><p className={`rd-mini-label ${group.positive ? 'text-green-400' : 'text-red-400'}`}>{group.title}</p>{group.rows.map(item => <div key={item.champ} className="rd-dashboard-matchup-row flex items-center gap-2 min-h-0">{renderChampionAvatar(item.champ, 'w-6 h-6')}<span className="text-sm flex-1 truncate">{item.champ}</span><span className="text-[10px] text-muted-foreground">{item.total}p</span><span className={`text-xs font-bold ${group.positive ? 'text-green-400' : 'text-red-400'}`}>{item.wr.toFixed(0)}%</span></div>)}</div>)}
              </div> : <p className="text-sm text-muted-foreground text-center my-auto">Necesitás más partidas para detectar matchups.</p>}
            </article>
          </section>
        )}

        {activeTab === 'meta' && (
          <section className="rd-dashboard-meta" aria-label="Meta">
            <article className="rd-card p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3"><div className="rd-inline-section-heading"><h2 className="rd-card-title">Meta por línea</h2><span aria-hidden="true">·</span><p className="rd-section-kicker">Parche {latestSuccessExec?.patch || 'actual'}</p></div><Link to="/tierlist" className="rd-link flex items-center gap-1">Tierlist completa <ChevronRight size={12} /></Link></div>
              <div className="grid grid-cols-5 gap-2 h-[calc(100%-2.75rem)]">
                {laneHighlights.map(({ lane, champions: laneChampions }) => <div key={lane} className="rd-meta-lane-card rounded-xl border border-border/80 bg-secondary/25 p-2 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1.5"><img src={LANE_ICONS[lane]} alt="" className="w-5 h-5 object-contain" /><span className="text-[11px] font-bold text-muted-foreground">{LANE_LABELS[lane]}</span></div>
                  {laneChampions.length ? laneChampions.map((champion, index) => <div key={champion.id || `${champion.champion_name}-${index}`} className="rd-meta-lane-row font-rajdhani flex items-center gap-2 border-t border-border/50 first:border-0">
                    <span className="text-[10px] text-muted-foreground w-3">{index + 1}</span>{renderChampionAvatar(champion.champion_name, 'w-7 h-7', champion.image_url)}<div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{champion.champion_name}</p><p className="text-[9px] text-muted-foreground">{Number(champion.winrate || 0).toFixed(1)}% WR</p></div><TierBadge tier={champion.tier} size="sm" />
                  </div>) : <p className="text-[11px] text-muted-foreground mt-4 text-center">Sin datos</p>}
                </div>)}
              </div>
            </article>

            <article className="rd-card rd-card-watermark rd-main-card p-5 min-h-0 overflow-hidden">
              <div className="rd-main-card-header">
                <div className="rd-inline-section-heading"><h2 className="rd-card-title">Mis mains en el meta</h2><span aria-hidden="true">·</span><p className="rd-section-kicker">Pool personal</p></div>
                <div className="rd-main-navigation"><button type="button" onClick={() => changeMain(-1)} disabled={mainChampions.length < 2} className="rd-main-arrow" aria-label="Main anterior"><ChevronLeft size={18} /></button><span className="font-rajdhani text-xs text-muted-foreground tabular-nums">{mainChampions.length ? mainIndex + 1 : 0} / {mainChampions.length}</span><button type="button" onClick={() => changeMain(1)} disabled={mainChampions.length < 2} className="rd-main-arrow" aria-label="Main siguiente"><ChevronRight size={18} /></button></div>
              </div>

              {selectedMain ? <div className="rd-main-meta-layout">
                <div className="rd-main-identity">
                  {renderChampionAvatar(selectedMain.name, 'w-20 h-20')}
                  <div className="min-w-0"><p className="font-rajdhani text-[11px] uppercase tracking-[0.18em] text-muted-foreground">#{selectedMain.position || '—'} en {LANE_LABELS[selectedMain.meta?.lane] || 'sin línea'}</p><h3 className="font-rajdhani text-3xl font-bold tracking-tight truncate">{selectedMain.name}</h3><div className="flex items-center gap-2 mt-1.5"><TierBadge tier={selectedMain.meta?.tier || '—'} /><span className="font-rajdhani text-xs text-muted-foreground">Score {Number(selectedMain.meta?.ranking_final || 0).toFixed(1)}</span></div></div>
                </div>
                <div className="font-rajdhani rd-main-stat-group"><p className="rd-mini-label">Estadísticas del meta</p><div className="grid grid-cols-3 gap-2"><div><strong className="font-rajdhani">{Number(selectedMain.meta?.winrate || 0).toFixed(1)}%</strong><span>Winrate</span></div><div><strong className="font-rajdhani">{Number(selectedMain.meta?.pickrate || 0).toFixed(1)}%</strong><span>Pickrate</span></div><div><strong className="font-rajdhani">{Number(selectedMain.meta?.banrate || 0).toFixed(1)}%</strong><span>Banrate</span></div></div></div>
                <div className="font-rajdhani rd-main-stat-group"><p className="rd-mini-label">Tu rendimiento</p><div className="grid grid-cols-3 gap-2"><div><strong className="font-rajdhani">{selectedMain.games}</strong><span>Partidas</span></div><div><strong className={`font-rajdhani ${selectedMain.personalWr >= 50 ? 'text-green-400' : 'text-red-400'}`}>{selectedMain.personalWr.toFixed(1)}%</strong><span>Winrate</span></div><div><strong className="font-rajdhani text-primary">{selectedMain.personalKda.toFixed(2)}</strong><span>KDA</span></div></div></div>
                {selectedMain.insight && <div className="rd-main-insight"><p className="rd-mini-label text-primary">Insight con {selectedMain.name}</p><p className="line-clamp-2">{selectedMain.insight}</p></div>}
              </div> : <p className="text-sm text-muted-foreground text-center mt-10">Registrá partidas para comparar tus mains con el meta.</p>}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
