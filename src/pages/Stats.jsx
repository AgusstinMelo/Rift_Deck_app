import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Champion, WRItem, Rune } from '@/api/entitiesSupabase';
import { userMatchesQuery } from '@/api/matchesSupabase';
import { getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';
import { BarChart3, ArrowRight, ShieldCheck, Sparkles, ChevronLeft, ChevronRight, Target } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useCoachReport } from '@/hooks/useCoachReport';
import { averageMatchKda } from '@/domain/matchStats';
import MembershipGate from '@/components/membership/MembershipGate';
import { daysUntil, getMyMembership } from '@/api/membershipSupabase';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import PatchFilter from '@/components/filters/PatchFilter';
import { filterByPatch } from '@/utils/patches';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';
import { useT } from '@/lib/LocaleContext';
import {
  COACH_BOOK_URL, calcWR, calculatePoolScore, getPatchFilterValue, insightAccent, insightTone,
} from '@/components/stats/statsHelpers';
import {
  ChampionAvatar, LaneBarChart, MatchupList, OverviewTrack, PoolChampionsCard, SectionCard, StatsHeroCard, WRBar,
} from '@/components/stats/StatsSections';

const STATS_MEMBERSHIP_GATE_ENABLED = false;

export default function Stats() {
  const t = useT();
  const { user } = useAuth();
  const [matchTypeFilter, setMatchTypeFilter] = useState(DEFAULT_MATCH_TYPE);
  const [patchFilter, setPatchFilter] = useState('');
  const [analyticsView, setAnalyticsView] = useState('overview');
  const [coachPage, setCoachPage] = useState(0);
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const patchDefaultApplied = useRef(false);
  const [membershipLoading, setMembershipLoading] = useState(STATS_MEMBERSHIP_GATE_ENABLED);
  const [hasAccess, setHasAccess] = useState(!STATS_MEMBERSHIP_GATE_ENABLED);
  const [membership, setMembership] = useState(null);

  const loadMembership = useCallback(() => {
    if (!STATS_MEMBERSHIP_GATE_ENABLED) {
      setHasAccess(true);
      setMembershipLoading(false);
      return;
    }

    if (user?.role === 'admin') {
      setHasAccess(true);
      setMembershipLoading(false);
      return;
    }
    getMyMembership(user?.id)
      .then(res => {
        setMembership(res);
        setHasAccess(res.hasAccess === true);
      })
      .catch(() => setHasAccess(false))
      .finally(() => setMembershipLoading(false));
  }, [user]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  const trialDaysLeft = membership?.status === 'trialing' ? daysUntil(membership.accessUntil) : null;

  const { data: allMatches = [], isLoading } = useQuery(userMatchesQuery(user));

  const { data: tierlistExecutions = [] } = useQuery({
    queryKey: ['executions', 'patch-filters'],
    queryFn: () => getTierlistExecutions(100),
  });

  const latestTierlistExecution = tierlistExecutions
    .find(execution => execution.status === 'success' || execution.status === 'partial');
  const currentPatchFilter = getPatchFilterValue(latestTierlistExecution?.patch);
  const patchOptions = [
    ...allMatches.map(match => match.patch),
    ...tierlistExecutions.map(execution => execution.patch),
  ];

  useEffect(() => {
    if (patchDefaultApplied.current || patchFilter || !currentPatchFilter) return;

    patchDefaultApplied.current = true;
    setPatchFilter(currentPatchFilter);
  }, [currentPatchFilter, patchFilter]);

  const handlePatchFilterChange = (value) => {
    patchDefaultApplied.current = true;
    setPatchFilter(value);
  };

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: wrItems = [] } = useQuery({
    queryKey: ['wr-items'],
    queryFn: () => WRItem.list('name'),
  });

  const { data: runes = [] } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('name'),
  });

  const getChampImg = (name) =>
    champions.find(c => c.name?.toLowerCase() === name?.toLowerCase())?.image_url;

  const getChampCardImg = (name) => {
    const champ = champions.find(c => c.name?.toLowerCase() === name?.toLowerCase());
    return champ?.image_url_card || champ?.image_url;
  };

  const matchesByType = matchTypeFilter === 'all'
    ? allMatches
    : allMatches.filter(match => (match.type || 'ranked') === matchTypeFilter);
  const matches = filterByPatch(matchesByType, patchFilter);
  // El Coach estudia hábitos (muertes, builds contra el rival, matchups, sesiones): usa
  // todo el historial del tipo de partida elegido, no solo el parche filtrado.
  const coachMatches = useMemo(
    () => (matchTypeFilter === 'all' ? allMatches : allMatches.filter(match => (match.type || 'ranked') === matchTypeFilter)),
    [allMatches, matchTypeFilter],
  );
  const coach = useCoachReport(user, { matches: coachMatches, wrItems, champions, runes, limit: 8 }, [t]);

  if (membershipLoading || isLoading) {
    return (
      <div className="rd-page">
        <div className="rd-card h-40 animate-pulse" />
      </div>
    );
  }

  if (!hasAccess) {
    return <MembershipGate onAccessGranted={loadMembership} />;
  }

  if (allMatches.length === 0) {
    return (
      <div className="rd-page rd-dashboard flex flex-col">
        <PageHeader kicker={t('stats.riftDeckAnalytics')} title={t('stats.estadisticasPersonales')} />
        <div className="rd-card p-6 flex flex-1 items-center justify-center">
          <EmptyState
            icon={BarChart3}
            title={t('stats.sinPartidas')}
            description={t('stats.registraPartidasParaVer')}
          />
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rd-page space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader kicker={t('stats.riftDeckAnalytics')} title={t('stats.estadisticasPersonales')} />
          <div className="flex items-center gap-3 rd-status-pill">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">{t('stats.performancePersonal')}</span>
          </div>
        </div>
        <div className="rd-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/70 bg-secondary/20 p-4 sm:flex-row sm:items-end sm:justify-end">
            <label className="min-w-0 flex-1 text-xs text-muted-foreground sm:max-w-64">
             {t('goals.filterLabels.types')}
              <select
                value={matchTypeFilter}
                onChange={event => setMatchTypeFilter(event.target.value)}
                className="mt-1 w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
              >
                <option value="all">{t('stats.todasLasPartidas')}</option>
                {MATCH_TYPES.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <PatchFilter
              value={patchFilter}
              onChange={handlePatchFilterChange}
              patches={patchOptions}
              className="min-w-0 flex-1 sm:max-w-64"
            />
          </div>
          <div className="flex min-h-[260px] items-center justify-center p-6">
            <EmptyState
              icon={BarChart3}
              title={t('stats.sinPartidasParaEstos')}
              description={t('stats.elegiOtroTipoDe')}
            />
          </div>
        </div>
      </div>
    );
  }

  const totalMatches = matches.length;
  const wins = matches.filter(m => m.result === 'win').length;
  const losses = totalMatches - wins;
  const winrate = calcWR(matches);

  const totalKills = matches.reduce((s, m) => s + (m.kills || 0), 0);
  const totalDeaths = matches.reduce((s, m) => s + (m.deaths || 0), 0);
  const totalAssists = matches.reduce((s, m) => s + (m.assists || 0), 0);

  const avgKDA = (averageMatchKda(matches) ?? 0).toFixed(2);

  const blueMatches = matches.filter(m => m.side === 'blue');
  const redMatches = matches.filter(m => m.side === 'red');
  const blueWR = calcWR(blueMatches).toFixed(0);
  const redWR = calcWR(redMatches).toFixed(0);
  const blueWins = blueMatches.filter(m => m.result === 'win').length;
  const blueLosses = blueMatches.length - blueWins;
  const redWins = redMatches.filter(m => m.result === 'win').length;
  const redLosses = redMatches.length - redWins;
  const kdaLine = `${(totalKills / totalMatches).toFixed(1)} / ${(totalDeaths / totalMatches).toFixed(1)} / ${(totalAssists / totalMatches).toFixed(1)}`;

  const champStats = {};
  matches.forEach(m => {
    const c = m.own_champion_name;
    if (!c) return;

    if (!champStats[c]) champStats[c] = { games: 0, wins: 0 };
    champStats[c].games++;

    if (m.result === 'win') champStats[c].wins++;
  });

  const champArr = Object.entries(champStats)
    .map(([name, s]) => ({
      name,
      games: s.games,
      wins: s.wins,
      wr: (s.wins / s.games) * 100,
    }))
    .sort((a, b) => b.games - a.games);

  const poolScore = calculatePoolScore(champArr, totalMatches);

  const mostPlayedChampImageUrl = champArr.length > 0 ? getChampImg(champArr[0].name) : null;
  const mostPlayedChampCardImageUrl = champArr.length > 0 ? getChampCardImg(champArr[0].name) : null;

  const laneStats = {};
  matches.forEach(m => {
    if (!m.lane) return;

    if (!laneStats[m.lane]) laneStats[m.lane] = { games: 0, wins: 0 };
    laneStats[m.lane].games++;

    if (m.result === 'win') laneStats[m.lane].wins++;
  });

  const laneArr = Object.entries(laneStats).map(([lane, s]) => ({
    lane,
    games: s.games,
    wr: Math.round((s.wins / s.games) * 100),
  }));

  const matchupStats = {};
  matches.forEach(m => {
    if (!m.enemy_champion_name) return;

    if (!matchupStats[m.enemy_champion_name]) {
      matchupStats[m.enemy_champion_name] = { wins: 0, total: 0 };
    }

    matchupStats[m.enemy_champion_name].total++;

    if (m.result === 'win') {
      matchupStats[m.enemy_champion_name].wins++;
    }
  });

  const matchupArr = Object.entries(matchupStats)
    .filter(([, v]) => v.total >= 1)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestMatchups = [...matchupArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.total - a.total || b.wr - a.wr)
    .slice(0, 10);

  const worstMatchups = [...matchupArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => b.total - a.total || a.wr - b.wr)
    .slice(0, 10);

  const synergyStats = {};
  matches.forEach(m => {
    (m.ally_champions || []).forEach(ally => {
      if (!ally || ally === m.own_champion_name) return;

      if (!synergyStats[ally]) {
        synergyStats[ally] = { wins: 0, total: 0 };
      }

      synergyStats[ally].total++;

      if (m.result === 'win') {
        synergyStats[ally].wins++;
      }
    });
  });

  const synergyArr = Object.entries(synergyStats)
    .filter(([, v]) => v.total >= 1)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestSynergies = [...synergyArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.total - a.total || b.wr - a.wr)
    .slice(0, 10);

  const worstSynergies = [...synergyArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => b.total - a.total || a.wr - b.wr)
    .slice(0, 10);

  // Matchups generales: contra cualquier campeón enemigo del equipo
  const generalMatchupStats = {};
  matches.forEach(m => {
    const allEnemies = [
      ...(m.enemy_champions || []),
      m.enemy_champion_name,
    ].filter(Boolean);

    const unique = [...new Set(allEnemies)];
    unique.forEach(enemy => {
      if (!generalMatchupStats[enemy]) generalMatchupStats[enemy] = { wins: 0, total: 0 };
      generalMatchupStats[enemy].total++;
      if (m.result === 'win') generalMatchupStats[enemy].wins++;
    });
  });

  const generalMatchupArr = Object.entries(generalMatchupStats)
    .filter(([, v]) => v.total >= 1)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestGeneralMatchups = [...generalMatchupArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.total - a.total || b.wr - a.wr)
    .slice(0, 10);

  const worstGeneralMatchups = [...generalMatchupArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => b.total - a.total || a.wr - b.wr)
    .slice(0, 10);

  const insights = coach.insights;
  // En smartphone no entran dos consejos legibles: va uno por página.
  const insightsPerPage = isPhoneLandscape || isPhonePortrait ? 1 : 2;
  const coachPageCount = Math.max(1, Math.ceil(insights.length / insightsPerPage));
  const effectiveCoachPage = Math.min(coachPage, coachPageCount - 1);
  const visibleInsights = insights.slice(effectiveCoachPage * insightsPerPage, (effectiveCoachPage + 1) * insightsPerPage);

  return (
    <div className="rd-page rd-dashboard rd-compact-page rd-stats-layout">

      <section className="rd-viewport-section rd-stats-overview space-y-6" aria-label={t('stats.resumenDeRendimiento')}>
      <div className="rd-stats-header flex flex-wrap items-start justify-between gap-4">
        <div className="rd-stats-title">
          <div className="rd-page-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
             {t('stats.riftDeckAnalytics')}
            </span>
          </div>

          <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
           {t('nav.stats')}
          </h1>

          <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">
           {t('stats.basadoEn')} {totalMatches} {t('stats.partidasRegistradas')}
          </p>

          {trialDaysLeft !== null && (
            <Link
              to="/membresia"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/15"
            >
             {t('stats.pruebaGratis')} {trialDaysLeft === 1 ? t('stats.teQueda1Dia') : t('stats.teQuedanDias', { trialDaysLeft })} {t('stats.verPlanes')}
            </Link>
          )}
        </div>

        <div className="rd-stats-filters flex flex-wrap items-end justify-end gap-3">
          <label className="rd-stats-filter min-w-52 text-xs text-muted-foreground">
           {t('goals.filterLabels.types')}
            <select
              value={matchTypeFilter}
              onChange={event => setMatchTypeFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-secondary/90 px-3 text-xs font-medium text-foreground outline-none focus:border-primary/40"
            >
              <option value="all">{t('stats.todasLasPartidas')}</option>
              {MATCH_TYPES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <PatchFilter
            value={patchFilter}
            onChange={handlePatchFilterChange}
            patches={patchOptions}
            className="rd-stats-filter rd-stats-filter-patch min-w-52"
          />
          <div className="hidden items-center gap-3 rd-status-pill 2xl:flex">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">{t('stats.performancePersonal')}</span>
          </div>
        </div>
      </div>

      </section>

      <div className="rd-panel-tabs" role="tablist" aria-label={t('stats.seccionesDeEstadisticas')}>
        {/* En smartphone vertical las cinco pestañas comparten una fila: nombres cortos. */}
        {[
          ['overview', t('library.rendimiento')],
          ['direct', isPhonePortrait ? t('stats.directos') : t('stats.matchupsDirectos')],
          ['general', isPhonePortrait ? t('stats.generales') : t('stats.matchupsGenerales')],
          ['synergy', t('stats.sinergias')],
          ...(insights.length ? [['coach', t('home.anchors.coach')]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={analyticsView === id}
            onClick={() => setAnalyticsView(id)}
            className={`rd-panel-tab ${analyticsView === id ? 'rd-panel-tab-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {analyticsView === 'overview' && <section className="rd-analytics-panel rd-stats-overview-panel flex min-h-0 flex-col gap-3" aria-label={t('stats.rendimientoPorCampeonY')}>
        <OverviewTrack>
        <StatsHeroCard
          winrate={winrate}
          wins={wins}
          losses={losses}
          avgKDA={avgKDA}
          kdaLine={kdaLine}
          blueWR={blueMatches.length > 0 ? blueWR : null}
          redWR={redMatches.length > 0 ? redWR : null}
          blueWins={blueWins}
          blueLosses={blueLosses}
          redWins={redWins}
          redLosses={redLosses}
          champImageUrl={mostPlayedChampCardImageUrl}
          poolScore={poolScore}
        />
        <div className="rd-stats-cards grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-6">
        <div className="lg:col-span-2 flex flex-col">
          <SectionCard title={t('stats.winratePorCampeon')} watermark fullHeight>
            <div className="rd-stats-champ-list grid h-full auto-rows-fr grid-cols-1 gap-1.5 xl:grid-cols-2">
              {champArr.slice(0, 10).map(c => {
                const tone =
                  c.wr >= 55 ? 'text-green-400' :
                  c.wr >= 45 ? 'text-primary' :
                  'text-red-400';

                return (
                  <div key={c.name} className="grid min-h-0 grid-cols-[auto_1fr] items-center gap-2 rounded-lg border border-border/50 bg-secondary/20 px-2 py-1.5">
                    <ChampionAvatar name={c.name} src={getChampImg(c.name)} rounded="rounded-lg" />

                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {c.name}
                        </span>

                        <span className={`whitespace-nowrap text-[11px] font-bold ${tone}`}>
                          {c.wr.toFixed(0)}% · {c.games}p
                        </span>
                      </div>

                      <WRBar value={c.wr} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <SectionCard title={t('stats.winratePorLinea')} fullHeight watermark>
            {laneArr.length > 0 ? (
              <LaneBarChart laneArr={laneArr} />
            ) : (
              <p className="text-muted-foreground text-sm">{t('stats.sinDatosDeLineas')}</p>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <PoolChampionsCard
            champArr={champArr}
            getChampImg={getChampImg}
            poolScore={poolScore}
          />
        </div>
        </div>
        </OverviewTrack>
      </section>}

      {analyticsView === 'direct' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label={t('stats.matchupsDirectos')}>
        <div>
          <SectionCard title={t('stats.mejoresMatchupsDirectos')} fixedHeight>
            <MatchupList
              items={bestMatchups}
              empty={t('stats.todaviaNoHayResultados')}
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>
        <div>
          <SectionCard title={t('stats.matchupsDirectosProblematicos')} fixedHeight>
            <MatchupList
              items={worstMatchups}
              empty={t('stats.todaviaNoHayResultados2')}
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>
      </section>}

      {analyticsView === 'general' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label={t('stats.matchupsGenerales')}>
        <div>
          <SectionCard title={t('stats.mejoresMatchupsGenerales')} fixedHeight>
            <MatchupList
              items={bestGeneralMatchups}
              empty={t('stats.todaviaNoHayResultados3')}
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div>
          <SectionCard title={t('stats.peoresMatchupsGenerales')} fixedHeight>
            <MatchupList
              items={worstGeneralMatchups}
              empty={t('stats.todaviaNoHayResultados3')}
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>

      </section>}

      {analyticsView === 'synergy' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label={t('stats.sinergiasAliadas')}>

        <div>
          <SectionCard title={t('stats.buenaSinergiaAliada')} fixedHeight>
            <MatchupList
              items={bestSynergies}
              empty={t('stats.todaviaNoHayResultados4')}
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div>
          <SectionCard title={t('stats.malaSinergiaAliada')} fixedHeight>
            <MatchupList
              items={worstSynergies}
              empty={t('stats.todaviaNoHayResultados2')}
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>
      </section>}

      {analyticsView === 'coach' && insights.length > 0 && (
        <section className="rd-analytics-panel rd-stats-coach rd-card rd-card-watermark p-5 md:p-7 overflow-hidden" aria-label={t('stats.lecturaEstrategica')}>
          <div className="rd-stats-coach-header flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <img
                src={COACH_BOOK_URL}
                alt={t('stats.libroDeRiftDeck')}
                className="w-16 md:w-20 h-auto object-contain drop-shadow-[0_0_20px_rgba(212,175,55,0.22)]"
              />
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Sparkles size={15} />
                  <span className="text-[10px] uppercase tracking-[0.24em] font-semibold">{t('stats.lecturaEstrategica')}</span>
                </div>
                <h2 className="font-rajdhani text-2xl font-bold text-foreground">{t('dashboard.riftDeckCoach')}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.hipotesisPriorizadasParaTu')}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-[11px] text-muted-foreground max-w-sm md:text-right">
               {t('stats.laConfianzaReflejaCuanto')}
              </p>
              {coachPageCount > 1 && (
                <div className="flex items-center gap-2" aria-label={t('stats.navegacionDeConsejos')}>
                  <button
                    type="button"
                    onClick={() => setCoachPage(Math.max(0, effectiveCoachPage - 1))}
                    disabled={effectiveCoachPage === 0}
                    className="rd-arrow h-7 w-7"
                    aria-label={t('stats.consejosAnteriores')}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="min-w-12 text-center text-[10px] text-muted-foreground">
                    {effectiveCoachPage + 1} / {coachPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCoachPage(Math.min(coachPageCount - 1, effectiveCoachPage + 1))}
                    disabled={effectiveCoachPage >= coachPageCount - 1}
                    className="rd-arrow h-7 w-7"
                    aria-label={t('stats.consejosSiguientes')}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rd-stats-coach-grid grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleInsights.map((insight, i) => (
              <article key={insight.id} className={`rd-stats-insight relative flex flex-col rounded-2xl border p-5 overflow-hidden ${insightTone[insight.tone] || insightTone.neutral}`}>
                <div className={`absolute inset-y-0 left-0 w-1 ${insightAccent[insight.tone] || insightAccent.neutral}`} />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      {String(effectiveCoachPage * insightsPerPage + i + 1).padStart(2, '0')} · {insight.domain}
                      {coach.historyReady && insight.isNew && (
                        <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-primary">{t('coachEngine.ui.new')}</span>
                      )}
                    </p>
                    <h3 className="font-rajdhani text-xl font-bold leading-tight text-foreground">{insight.title}</h3>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                    <ShieldCheck size={11} /> {insight.confidenceLabel}
                  </span>
                </div>

                <div className="rd-stats-insight-body mt-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">{t('coach.queMuestranLosDatos')}</p>
                  <p className="text-sm text-foreground/85 leading-relaxed">{insight.thesis}</p>
                </div>

                {insight.evidence.length > 0 && (
                  <div className="rd-stats-insight-evidence flex flex-wrap gap-2 mt-4">
                    {insight.evidence.map(item => (
                      <span key={item} className="rounded-md bg-background/45 border border-border/50 px-2 py-1 text-[11px] text-muted-foreground">{item}</span>
                    ))}
                  </div>
                )}

                <div className="rd-stats-insight-spacer min-h-4 flex-1" aria-hidden="true" />

                <div className="rd-stats-insight-action flex items-start gap-2 pt-4 border-t border-border/50 xl:min-h-[88px] xl:shrink-0">
                  <ArrowRight size={14} className="text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-muted-foreground"><span className="text-foreground font-medium">{t('coach.consejo')}</span> {insight.action}</p>
                    {insight.goal && (
                      <Link
                        to="/objetivos/nuevo"
                        state={{ coachGoal: insight.goal }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Target size={12} /> {t('coachEngine.ui.createGoal')}
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
