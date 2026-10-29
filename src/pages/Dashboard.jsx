import { useMemo, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { Champion, WRItem, Rune, Spell } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getTierlistEntries, getTierlistExecutions, getTierlistPatchAverages } from '@/api/tierlistSupabase';
import { getActivePatchVersion } from '@/api/patchesSupabase';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import TierBadge from '@/components/ui/TierBadge';
import PatchFilter from '@/components/filters/PatchFilter';
import { getChampionInsight } from '@/components/library/ChampionDetail';
import { computeInsights } from '@/hooks/useInsights';
import { filterByPatch, getPatchGroup, patchMatchesSelection } from '@/utils/patches';
import { matchKda } from '@/domain/matchStats';
import GoalsDashboardWidget from '@/features/goals/components/GoalsDashboardWidget';
import { tr } from '@/i18n/uiI18n';

const COACH_IMAGE_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/83cce9c3d_ChatGPTImage19may202611_43_41pm.png';

const DASHBOARD_TABS = [
  { id: 'summary', get label() { return tr('dashboard.tabs.summary'); } },
  { id: 'activity', get label() { return tr('dashboard.tabs.activity'); } },
  { id: 'meta', get label() { return tr('dashboard.tabs.meta'); } },
];

const DASHBOARD_HEADINGS = {
  summary: {
    get title() { return tr('dashboard.headings.summaryTitle'); },
    get description() { return tr('dashboard.headings.summaryDescription'); },
  },
  activity: {
    get title() { return tr('dashboard.headings.activityTitle'); },
    get description() { return tr('dashboard.headings.activityDescription'); },
  },
  meta: {
    get title() { return tr('dashboard.headings.metaTitle'); },
    get description() { return tr('dashboard.headings.metaDescription'); },
  },
};

// Tarjetas de Actividad; en mobile vertical son un carrusel y estos chips saltan entre ellas.
// Mensaje de tarjeta vacía: centrado en el alto libre, igual en las tres tarjetas de actividad.
const ACTIVITY_EMPTY = 'rd-dashboard-empty flex flex-1 items-center justify-center text-center text-sm text-muted-foreground';

const ACTIVITY_SLIDES = ['dashboard.slides.matches', 'dashboard.slides.builds', 'dashboard.slides.matchups'];

const LANE_LABELS = {
  get top() { return tr('lanes.top').toUpperCase(); },
  get jungler() { return tr('lanes.jungler').toUpperCase(); },
  get mid() { return tr('lanes.mid').toUpperCase(); },
  get adc() { return tr('lanes.adc').toUpperCase(); },
  get support() { return tr('lanes.support').toUpperCase(); },
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
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}-${month}-${year}`;
};

const getKda = (match) =>
  matchKda(Number(match?.kills) || 0, Number(match?.deaths) || 0, Number(match?.assists) || 0);

// K/D/A legible: un dato no registrado (null) se muestra como "—".
const formatKdaLine = (match) =>
  [match?.kills, match?.deaths, match?.assists].map(value => value ?? '—').join('/');

export default function Dashboard() {
  const t = useT();
  const { user } = useAuth();
  const { entityName } = useCatalogText();
  const [patchFilter, setPatchFilter] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [mainIndex, setMainIndex] = useState(0);
  const [insightOpen, setInsightOpen] = useState(false);
  // Línea visible en Meta en mobile; en desktop se ven todas.
  const [metaLane, setMetaLane] = useState('top');
  const activityRef = useRef(null);
  const [activitySlide, setActivitySlide] = useState(0);
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
  const { data: activePatchVersion } = useQuery({
    queryKey: ['active-patch-version'],
    queryFn: getActivePatchVersion,
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
  // "Meta por línea" muestra el promedio del parche; los insights usan los snapshots diarios.
  const latestPatchGroup = getPatchGroup(latestSuccessExec?.patch);
  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist-patch-averages', [latestPatchGroup]],
    queryFn: () => getTierlistPatchAverages([latestPatchGroup]),
    enabled: Boolean(latestPatchGroup),
  });

  const { data: champions = [] } = useQuery({ queryKey: ['champions'], queryFn: () => Champion.list('name') });
  const { data: wrItems = [] } = useQuery({ queryKey: ['wr-items'], queryFn: () => WRItem.list('name') });
  const { data: runes = [] } = useQuery({ queryKey: ['runes'], queryFn: () => Rune.list('name') });
  const { data: spellsData = [] } = useQuery({ queryKey: ['spells'], queryFn: () => Spell.list('name') });

  const getChampImg = (name) => champions.find(
    champion => champion.name?.toLowerCase() === name?.toLowerCase()
  )?.image_url;
  const getSpellImg = (name) => spellsData.find(spell => spell.name === name)?.image_url;
  const builds = useMemo(() => filterByPatch(allBuilds, patchFilter), [allBuilds, patchFilter]);

  const getMatchTimestamp = (match) => {
    if (!match?.date) return 0;
    const [year, month, day] = String(match.date).slice(0, 10).split('-').map(Number);
    const [hours, minutes] = String(match.hour || '00:00').slice(0, 5).split(':').map(Number);
    if (!year || !month || !day) return 0;
    return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
  };

  // Los cálculos pesados se memorizan: cambiar de pestaña re-renderiza el Dashboard y,
  // sin esto, se recalculaba todo (incluido computeInsights) en cada clic.
  const sortedMatches = useMemo(
    () => [...filterByPatch(allMatches, patchFilter)].sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a)),
    [allMatches, patchFilter],
  );
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

  const topChamps = useMemo(() => {
    const championGroups = sortedMatches.reduce((groups, match) => {
      const name = match.own_champion_name;
      if (!name) return groups;
      if (!groups[name]) groups[name] = [];
      groups[name].push(match);
      return groups;
    }, {});
    return Object.entries(championGroups).sort((a, b) => b[1].length - a[1].length);
  }, [sortedMatches]);
  const mostUsed = topChamps[0];
  const mostUsedWR = mostUsed
    ? (mostUsed[1].filter(match => match.result === 'win').length / mostUsed[1].length) * 100
    : null;

  const topInsight = useMemo(() => computeInsights({
    matches: sortedMatches,
    tierlist: tierlistHistory,
    wrItems,
    builds,
    champions,
    runes,
    spells: spellsData,
    limit: 1,
    minimum: 1,
  // `t` cambia con el idioma: los textos del Coach se arman en ese idioma.
  })[0] || null, [sortedMatches, tierlistHistory, wrItems, builds, champions, runes, spellsData, t]);

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

  const mainChampions = useMemo(() => topChamps.slice(0, 3).map(([name, championMatches]) => {
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
      numericWr: Number(personalWr.toFixed(0)),
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
  }), [topChamps, tierlist]);
  const selectedMain = mainChampions[Math.min(mainIndex, Math.max(mainChampions.length - 1, 0))];

  const changeMain = (direction) => {
    if (mainChampions.length < 2) return;
    setMainIndex(current => (current + direction + mainChampions.length) % mainChampions.length);
  };

  // El scroll del carrusel se mapea de forma proporcional: 0 → primera tarjeta, máximo → última.
  const handleActivityScroll = (event) => {
    const { scrollLeft, scrollWidth, clientWidth } = event.currentTarget;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 0) return;
    setActivitySlide(Math.round((scrollLeft / maxScroll) * (ACTIVITY_SLIDES.length - 1)));
  };

  const goToActivitySlide = (index) => {
    const carousel = activityRef.current;
    if (!carousel || index < 0 || index >= ACTIVITY_SLIDES.length) return;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollTo({ left: (maxScroll * index) / (ACTIVITY_SLIDES.length - 1), behavior: 'smooth' });
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
          <div className="rd-page-kicker rd-dashboard-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">{t('dashboard.riftDeckCentroTactico')}</span>
          </div>
          <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{activeHeading.title}</h1>
          <p className="rd-page-subtitle rd-dashboard-description mt-0.5 text-sm text-muted-foreground">{activeHeading.description}</p>
        </div>

        <div className="rd-panel-tabs rd-dashboard-tablist" role="tablist" aria-label={t('dashboard.seccionesDelDashboard')}>
          {DASHBOARD_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`rd-panel-tab ${activeTab === tab.id ? 'rd-panel-tab-active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setActivitySlide(0); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground rd-status-pill">
            <span className={`w-2 h-2 rounded-full shrink-0 ${latestSuccessExec ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,.65)]' : 'bg-red-400'}`} />
            <span>{t('dashboard.datosActualizados')}</span>
            <span className="text-border">|</span>
            <span>{activePatchVersion ? t('dashboard.parche', { patch: activePatchVersion }) : t('dashboard.sinParche')}</span>
            {latestSuccessExec?.snapshot_date && <>
              <span className="text-border">|</span>
              <span>{t('nav.tierlist')} {formatDate(latestSuccessExec.snapshot_date)}</span>
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
          <section className="rd-dashboard-summary" aria-label={t('goals.wizard.summary')}>
            <div className="rd-dashboard-stats grid grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">{t('nav.matches')}</span><Swords size={17} className="text-primary" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-primary">{totalMatches || '—'}</p>
                <p className="text-xs text-muted-foreground"><span className="text-green-400">{wins}V</span> / <span className="text-red-400">{totalMatches - wins}D</span></p>
              </article>
              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">{t('goals.metric.winrate')}</span><Trophy size={17} className="text-primary" /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${wrColor}`}>{winrate === null ? '—' : `${winrate.toFixed(0)}%`}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.rendimientoGlobalFiltrado')}</p>
              </article>
              <article className="rd-card rd-dashboard-stat rd-dashboard-stat-with-avatar">
                <div className="flex items-center justify-between"><span className="rd-label">{t('dashboard.campeonMasUsado')}</span><Target size={17} className="text-accent" /></div>
                <div className="rd-dashboard-stat-champ flex items-center gap-3 min-h-0">
                  {renderChampionAvatar(mostUsed?.[0], 'w-10 h-10 rd-dashboard-stat-avatar')}
                  <div className="min-w-0"><p className="font-rajdhani font-bold text-lg text-accent truncate">{mostUsed?.[0] || '—'}</p><p className="rd-dashboard-stat-hint text-xs text-muted-foreground">{t('dashboard.pickPrincipalDelHistorial')}</p></div>
                </div>
                {mostUsed ? <div className="rd-dashboard-stat-tags flex items-center gap-2">
                  <span className="rounded border border-border bg-secondary/80 px-2 py-0.5 text-[11px] text-muted-foreground">{mostUsed[1].length} {t('goals.unit.partidas')}</span>
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${mostUsedWR >= 50 ? 'border-green-400/25 bg-green-500/10 text-green-400' : 'border-red-400/25 bg-red-500/10 text-red-400'}`}>{mostUsedWR.toFixed(0)}{t('dashboard.wr')}</span>
                </div> : <p className="text-xs text-muted-foreground">{t('dashboard.sinPartidasRegistradas')}</p>}
              </article>
              <article className="rd-card rd-dashboard-stat rd-card-watermark">
                <div className="flex items-center justify-between"><span className="rd-label">{t('goals.metric.promedio_kda')}</span><BarChart3 size={17} className="text-primary" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-primary">{averageSevenDayKda === null ? '—' : averageSevenDayKda.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{recentSevenDayMatches.length} {t('dashboard.partidasUltimos7Dias')}</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">{t('dashboard.formaReciente')}</span><TrendingUp size={17} className="text-primary" /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${recentFormWr === null ? 'text-muted-foreground' : recentFormWr >= 50 ? 'text-green-400' : 'text-red-400'}`}>{recentFormWr === null ? '—' : `${recentFormWr.toFixed(0)}%`}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.wrEnLasUltimas')} {lastTenMatches.length} {t('goals.unit.partidas')}</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">{t('dashboard.rachaActual')}</span><Flame size={17} className={streakResult === 'win' ? 'text-green-400' : 'text-red-400'} /></div>
                <p className={`font-rajdhani rd-dashboard-stat-value ${!streakResult ? 'text-muted-foreground' : streakResult === 'win' ? 'text-green-400' : 'text-red-400'}`}>{streakResult ? currentStreakCount : '—'}</p>
                <p className="text-xs text-muted-foreground">{streakResult ? t('dashboard.consecutivas', { value: streakResult === 'win' ? t('goals.stat.victorias') : t('dashboard.derrotas') }) : t('dashboard.sinPartidasRegistradas')}</p>
              </article>

              <article className="rd-card rd-dashboard-stat">
                <div className="flex items-center justify-between"><span className="rd-label">{t('dashboard.campeonesUtilizados')}</span><Users size={17} className="text-accent" /></div>
                <p className="font-rajdhani rd-dashboard-stat-value text-accent">{topChamps.length || '—'}</p>
                <p className="text-xs text-muted-foreground">{t('dashboard.picksDiferentesRegistrados')}</p>
              </article>

              <article className={`rd-card rd-dashboard-stat rd-card-watermark ${bestRecentMatch ? 'rd-dashboard-stat-with-avatar' : ''}`}>
                <div className="flex items-center justify-between"><span className="rd-label">{t('dashboard.mejorPartida')}<span className="rd-dashboard-label-extra"> {t('dashboard.reciente')}</span></span><Trophy size={17} className="text-green-400" /></div>
                {bestRecentMatch ? <div className="rd-dashboard-stat-champ flex items-center gap-3 min-h-0">
                  {renderChampionAvatar(bestRecentMatch.own_champion_name, 'w-10 h-10 rd-dashboard-stat-avatar')}
                  <div className="min-w-0 flex-1">
                    <p className="font-rajdhani text-lg font-bold text-foreground truncate">{bestRecentMatch.own_champion_name}</p>
                    <p className="rd-dashboard-stat-hint text-xs text-muted-foreground">{bestRecentMatch.lane} · {formatDate(bestRecentMatch.date)}</p>
                  </div>
                </div> : <p className="font-rajdhani rd-dashboard-stat-value text-muted-foreground">—</p>}
                {bestRecentMatch ? <div className="rd-dashboard-stat-tags flex items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${bestRecentMatch.result === 'win' ? 'border-green-400/25 bg-green-500/10 text-green-400' : 'border-red-400/25 bg-red-500/10 text-red-400'}`}>{bestRecentMatch.result === 'win' ? t('matches.victoria') : t('matches.derrota')}</span>
                  <span className="rounded border border-border bg-secondary/80 px-2 py-0.5 text-[11px] text-muted-foreground">{formatKdaLine(bestRecentMatch)} {t('dashboard.kda')} {getKda(bestRecentMatch).toFixed(2)}</span>
                </div> : <p className="text-xs text-muted-foreground">{t('dashboard.sinPartidasRegistradas')}</p>}
              </article>
            </div>

            <div className="rd-dashboard-side grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 min-h-0">
              <article className="rd-card rd-card-watermark rd-dashboard-insight p-5 min-h-0 overflow-hidden">
                <div className="flex items-start gap-4 h-full">
                  <img src={COACH_IMAGE_URL} alt={t('dashboard.riftDeckCoach')} className="rd-dashboard-insight-art w-[88px] self-center object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.35)]" />
                  <div className="min-w-0 self-center">
                    <p className="rd-section-kicker"><img src={COACH_IMAGE_URL} alt="" className="rd-dashboard-insight-icon" />{t('dashboard.insightDelDia')}</p>
                    {topInsight ? <><h2 className="font-rajdhani text-xl font-bold text-foreground leading-tight mt-1">{topInsight.title}</h2><p className="rd-dashboard-insight-thesis text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{topInsight.thesis}</p><p className="rd-dashboard-insight-tip text-xs text-primary mt-3 line-clamp-2">{t('coach.consejo')} {topInsight.action}</p><button type="button" className="rd-dashboard-insight-more" onClick={() => setInsightOpen(true)}>{t('dashboard.verConsejo')} <ChevronRight size={12} /></button></> : <p className="text-sm text-muted-foreground mt-2">{t('dashboard.registraMasPartidasPara')}</p>}
                  </div>
                </div>
              </article>
              <GoalsDashboardWidget />
            </div>
            {/* Solo se abre desde mobile, donde la tarjeta muestra únicamente el título. */}
            {insightOpen && topInsight && (
              <div className="rd-insight-sheet" role="dialog" aria-modal="true" aria-label={t('dashboard.insightDelDia')} onClick={() => setInsightOpen(false)}>
                <div className="rd-card rd-insight-sheet-panel" onClick={event => event.stopPropagation()}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="rd-label flex items-center gap-2"><img src={COACH_IMAGE_URL} alt="" className="h-[15px] w-[15px] object-contain" />{t('dashboard.insightDelDia')}</p>
                    <button type="button" onClick={() => setInsightOpen(false)} className="text-muted-foreground transition-colors hover:text-primary" aria-label={t('dashboard.cerrar')}><X size={16} /></button>
                  </div>
                  <h2 className="font-rajdhani text-lg font-bold leading-tight text-foreground mt-2">{topInsight.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-2">{topInsight.thesis}</p>
                  <p className="text-xs text-primary mt-3">{t('coach.consejo')} {topInsight.action}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'activity' && (
          <>
          <div className="rd-dashboard-pager" aria-label={t('dashboard.tarjetasDeActividad')}>
            <button type="button" className="rd-arrow rd-dashboard-pager-arrow" onClick={() => goToActivitySlide(activitySlide - 1)} disabled={activitySlide === 0} aria-label={t('dashboard.tarjetaAnterior')}><ChevronLeft size={16} /></button>
            <div className="rd-dashboard-pager-chips">
              {ACTIVITY_SLIDES.map((label, index) => (
                <button key={label} type="button" aria-pressed={activitySlide === index} onClick={() => goToActivitySlide(index)}>{t(label)}</button>
              ))}
            </div>
            <button type="button" className="rd-arrow rd-dashboard-pager-arrow" onClick={() => goToActivitySlide(activitySlide + 1)} disabled={activitySlide === ACTIVITY_SLIDES.length - 1} aria-label={t('dashboard.tarjetaSiguiente')}><ChevronRight size={16} /></button>
          </div>
          <section ref={activityRef} onScroll={handleActivityScroll} className="rd-dashboard-activity" aria-label={t('dashboard.actividad')}>
            <article className="rd-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">{t('dashboard.ultimasPartidas')}</h2><Link to="/matches" className="rd-link">{t('dashboard.verTodas')}</Link></div>
              {latestMatches.length ? <div className="rd-dashboard-list rd-dashboard-match-list">
                {latestMatches.map(match => <div key={match.id} className="font-rajdhani rd-dashboard-row">
                  {renderChampionAvatar(match.own_champion_name, 'w-9 h-9')}
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{match.own_champion_name}</p><p className="text-[11px] text-muted-foreground">{match.lane} · {formatKdaLine(match)}</p></div>
                  <div className="text-right"><p className={`text-xs font-bold ${match.result === 'win' ? 'text-green-400' : 'text-red-400'}`}>{match.result === 'win' ? t('matches.victoria') : t('matches.derrota')}</p><p className="text-[10px] text-muted-foreground">{formatDate(match.date)}</p></div>
                </div>)}
              </div> : <p className={ACTIVITY_EMPTY}>{t('dashboard.noHayPartidasRegistradas')}</p>}
            </article>

            <article className="rd-card rd-card-watermark p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">{t('dashboard.ultimasBuilds')}</h2><Link to="/build-calculator" className="rd-link">{t('dashboard.verTodas')}</Link></div>
              {buildsWithStats.length ? <div className="rd-dashboard-list">
                {buildsWithStats.slice(0, 5).map(build => {
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
                      <div className="rd-build-keystone" title={keystone ? entityName(keystone) : t('dashboard.sinRunaClave')}>
                        {keystone?.image_url
                          ? <img src={keystone.image_url} alt={entityName(keystone)} />
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
                            ? <img key={`${itemName}-${index}`} src={item.image_url} alt={entityName(item)} title={entityName(item)} />
                            : <span key={index} />;
                        })}
                      </div>
                    </div>

                    {build.wr !== null && <span className="rd-build-winrate">{build.wr}%</span>}
                  </div>;
                })}
              </div> : <p className={ACTIVITY_EMPTY}>{t('dashboard.noHayBuildsCreadas')}</p>}
            </article>

            <article className="rd-card p-4 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2"><h2 className="rd-card-title">{t('dashboard.analisisDeMatchups')}</h2><Link to="/stats" className="rd-link">{t('dashboard.ampliar')}</Link></div>
              {matchupStats.length ? <div className="rd-dashboard-matchups grid grid-rows-2 gap-3 min-h-0 flex-1">
                {[{ title: t('dashboard.favorables'), rows: bestMatchups, positive: true }, { title: t('dashboard.problematicos'), rows: worstMatchups, positive: false }].map(group => <div key={group.title} className={`rd-dashboard-matchup-group rounded-xl border p-2 min-h-0 overflow-hidden ${group.positive ? 'bg-green-500/[0.05] border-green-400/15' : 'bg-red-500/[0.05] border-red-400/15'}`}><p className={`rd-mini-label ${group.positive ? 'text-green-400' : 'text-red-400'}`}>{group.title}</p>{group.rows.map(item => <div key={item.champ} className="rd-dashboard-matchup-row flex items-center gap-2 min-h-0">{renderChampionAvatar(item.champ, 'w-6 h-6')}<span className="text-sm flex-1 truncate">{item.champ}</span><span className="text-[10px] text-muted-foreground">{item.total}p</span><span className={`text-xs font-bold ${group.positive ? 'text-green-400' : 'text-red-400'}`}>{item.wr.toFixed(0)}%</span></div>)}</div>)}
              </div> : <p className={ACTIVITY_EMPTY}>{t('dashboard.necesitasMasPartidasPara')}</p>}
            </article>
          </section>
          </>
        )}

        {activeTab === 'meta' && (
          <section className="rd-dashboard-meta" aria-label={t('goals.target')}>
            <article className="rd-card p-4 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3"><div className="rd-inline-section-heading"><h2 className="rd-card-title">{t('dashboard.metaPorLinea')}</h2><span aria-hidden="true">·</span><p className="rd-section-kicker">{t('goals.filterLabels.patches')} {latestSuccessExec?.patch || 'actual'}</p></div><Link to="/tierlist" className="rd-link flex items-center gap-1">{t('nav.tierlist')}<span className="rd-dashboard-label-extra"> {t('dashboard.completa')}</span> <ChevronRight size={12} /></Link></div>
              <div className="rd-meta-lane-picker" role="tablist" aria-label={t('goals.filterLabels.lanes')}>
                {laneHighlights.map(({ lane }) => <button key={lane} type="button" role="tab" aria-selected={metaLane === lane} aria-label={LANE_LABELS[lane]} title={LANE_LABELS[lane]} onClick={() => setMetaLane(lane)} className={`rd-meta-lane-pick ${metaLane === lane ? 'rd-meta-lane-pick-active' : ''}`}><img src={LANE_ICONS[lane]} alt="" /></button>)}
              </div>
              <div className="grid grid-cols-5 gap-2 h-[calc(100%-2.75rem)]">
                {laneHighlights.map(({ lane, champions: laneChampions }) => <div key={lane} className={`rd-meta-lane-card ${metaLane === lane ? 'rd-meta-lane-card-active' : ''} rounded-xl border border-border/80 bg-secondary/25 p-2 min-w-0 overflow-hidden`}>
                  <div className="flex items-center gap-2 mb-1.5"><img src={LANE_ICONS[lane]} alt="" className="w-5 h-5 object-contain" /><span className="text-[11px] font-bold text-muted-foreground">{LANE_LABELS[lane]}</span></div>
                  {laneChampions.length ? laneChampions.map((champion, index) => <div key={champion.id || `${champion.champion_name}-${index}`} className="rd-meta-lane-row font-rajdhani flex items-center gap-2 border-t border-border/50 first:border-0">
                    <span className="text-[10px] text-muted-foreground w-3">{index + 1}</span>{renderChampionAvatar(champion.champion_name, 'w-7 h-7', champion.image_url)}<div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{champion.champion_name}</p><p className="text-[9px] text-muted-foreground">{Number(champion.winrate || 0).toFixed(0)}{t('dashboard.wr')}</p></div><TierBadge tier={champion.tier} size="sm" />
                  </div>) : <p className="text-[11px] text-muted-foreground mt-4 text-center">{t('dashboard.sinDatos')}</p>}
                </div>)}
              </div>
            </article>

            <article className="rd-card rd-card-watermark rd-main-card p-5 min-h-0 overflow-hidden">
              <div className="rd-main-card-header">
                <div className="rd-inline-section-heading"><h2 className="rd-card-title">{t('dashboard.misMainsEnEl')}</h2><span aria-hidden="true">·</span><p className="rd-section-kicker">{t('dashboard.poolPersonal')}</p></div>
                <div className="rd-main-navigation"><button type="button" onClick={() => changeMain(-1)} disabled={mainChampions.length < 2} className="rd-arrow rd-main-arrow" aria-label={t('dashboard.mainAnterior')}><ChevronLeft size={18} /></button><span className="font-rajdhani text-xs text-muted-foreground tabular-nums">{mainChampions.length ? mainIndex + 1 : 0} / {mainChampions.length}</span><button type="button" onClick={() => changeMain(1)} disabled={mainChampions.length < 2} className="rd-arrow rd-main-arrow" aria-label={t('dashboard.mainSiguiente')}><ChevronRight size={18} /></button></div>
              </div>

              {selectedMain ? <div className="rd-main-meta-layout">
                <div className="rd-main-identity">
                  {renderChampionAvatar(selectedMain.name, 'w-20 h-20')}
                  <div className="min-w-0"><p className="font-rajdhani text-[11px] uppercase tracking-[0.18em] text-muted-foreground">#{selectedMain.position || '—'} {t('dashboard.en')} {LANE_LABELS[selectedMain.meta?.lane] || t('dashboard.sinLinea')}</p><h3 className="font-rajdhani text-3xl font-bold tracking-tight truncate">{selectedMain.name}</h3><div className="flex items-center gap-2 mt-1.5"><TierBadge tier={selectedMain.meta?.tier || '—'} /><span className="font-rajdhani text-xs text-muted-foreground">{t('dashboard.score')} {Number(selectedMain.meta?.ranking_final || 0).toFixed(1)}</span></div></div>
                </div>
                <div className="font-rajdhani rd-main-stat-group"><p className="rd-mini-label">{t('dashboard.estadisticasDelMeta')}</p><div className="grid grid-cols-3 gap-2"><div><strong className="font-rajdhani">{Number(selectedMain.meta?.winrate || 0).toFixed(0)}%</strong><span>{t('goals.metric.winrate')}</span></div><div><strong className="font-rajdhani">{Number(selectedMain.meta?.pickrate || 0).toFixed(1)}%</strong><span>{t('dashboard.pickrate')}</span></div><div><strong className="font-rajdhani">{Number(selectedMain.meta?.banrate || 0).toFixed(1)}%</strong><span>{t('dashboard.banrate')}</span></div></div></div>
                <div className="font-rajdhani rd-main-stat-group"><p className="rd-mini-label">{t('dashboard.tuRendimiento')}</p><div className="grid grid-cols-3 gap-2"><div><strong className="font-rajdhani">{selectedMain.games}</strong><span>{t('nav.matches')}</span></div><div><strong className={`font-rajdhani ${selectedMain.personalWr >= 50 ? 'text-green-400' : 'text-red-400'}`}>{selectedMain.personalWr.toFixed(0)}%</strong><span>{t('goals.metric.winrate')}</span></div><div><strong className="font-rajdhani text-primary">{selectedMain.personalKda.toFixed(2)}</strong><span>{t('goals.stat.kda')}</span></div></div></div>
                {selectedMain.insight && <div className="rd-main-insight"><p className="rd-mini-label text-primary">{t('dashboard.insightCon')} {selectedMain.name}</p><p className="line-clamp-2">{selectedMain.insight}</p></div>}
              </div> : <p className="text-sm text-muted-foreground text-center mt-10">{t('dashboard.registraPartidasParaComparar')}</p>}
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
