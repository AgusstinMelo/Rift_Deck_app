import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sword,
  Shield,
  Zap,
} from 'lucide-react';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Champion } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';

import TierBadge from '@/components/ui/TierBadge';
import LaneBadge from '@/components/ui/LaneBadge';
import { championSlug } from '@/utils/championSlug';
import { getTierEntriesForChampion } from '@/utils/tierlist';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY, DESKTOP_FIT_QUERY } from '@/hooks/useMatchMedia';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { labels, tr } from '@/i18n/uiI18n';
import { championTagLabel } from '@/utils/itemLabels';

const SCALING_LABEL = labels({
  earlygame: 'champion.scalingShort.earlygame',
  midgame: 'champion.scalingShort.midgame',
  lategame: 'champion.scalingShort.lategame',
});

const PROJECTION_TONE_CLASS = {
  positive: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-red-400',
  neutral: 'text-foreground',
  muted: 'text-muted-foreground',
};

const clamp = (value, min = 0, max = 100) => {
  return Math.min(max, Math.max(min, value));
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizePercent = (value) => {
  const n = toNumber(value, 0);
  return n > 0 && n <= 1 ? n * 100 : n;
};

const scaleBetween = (value, min, max) => {
  if (max === min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
};

const normalizeLane = (lane) => {
  const value = String(lane || '').toLowerCase();
  if (['dragonline', 'dragonlane', 'adc', 'bot', 'bottom'].includes(value)) {
    return 'adc';
  }
  if (value === 'jungle') {
    return 'jungler';
  }
  return value;
};

const getMostPlayedLane = (matches) => {
  const counts = matches.reduce((acc, match) => {
    const lane = normalizeLane(match.lane);
    if (!lane) return acc;
    acc[lane] = (acc[lane] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const getRelevantTierEntry = ({ tierData, champion, champMatches }) => {
  if (!tierData.length) return null;
  const mostPlayedLane = getMostPlayedLane(champMatches);
  const championLanes = Array.isArray(champion.lane)
    ? champion.lane.map(normalizeLane)
    : [normalizeLane(champion.lane)].filter(Boolean);
  return (
    tierData.find(t => normalizeLane(t.lane) === mostPlayedLane) ||
    tierData.find(t => championLanes.includes(normalizeLane(t.lane))) ||
    [...tierData].sort(
      (a, b) => toNumber(b.ranking_final) - toNumber(a.ranking_final)
    )[0]
  );
};

const getSampleConfidenceScore = (games) => {
  if (games >= 30) return 100;
  if (games >= 20) return 85;
  if (games >= 12) return 70;
  if (games >= 8) return 55;
  if (games >= 5) return 40;
  return 20;
};

const getMetaScore = (tierEntry) => {
  if (!tierEntry) return 50;
  const tierScore = toNumber(tierEntry.ranking_final, 50);
  const metaWr = normalizePercent(tierEntry.winrate);
  const pickrate = normalizePercent(tierEntry.pickrate);
  const banrate = normalizePercent(tierEntry.banrate);
  const metaWrScore = scaleBetween(metaWr, 45, 55);
  const pickrateScore = scaleBetween(pickrate, 2, 18);
  const banrateScore = scaleBetween(banrate, 0, 25);
  return clamp(
    tierScore * 0.55 +
    metaWrScore * 0.20 +
    pickrateScore * 0.15 +
    banrateScore * 0.10
  );
};

const getPersonalScore = ({ personalWinrate, avgKda, recentWinrate }) => {
  const wr = normalizePercent(personalWinrate);
  const recentWr = recentWinrate == null ? wr : normalizePercent(recentWinrate);
  const wrScore = scaleBetween(wr, 35, 70);
  const recentScore = scaleBetween(recentWr, 35, 70);
  const kdaScore = avgKda == null ? 50 : scaleBetween(avgKda, 1.2, 5);
  return clamp(
    wrScore * 0.60 +
    kdaScore * 0.20 +
    recentScore * 0.20
  );
};

const getChampionProjection = ({
  games,
  personalWinrate,
  avgKda,
  recentWinrate,
  tierEntry,
}) => {
  const totalGames = toNumber(games, 0);
  const wr = normalizePercent(personalWinrate);
  const sampleScore = getSampleConfidenceScore(totalGames);
  const personalScore = getPersonalScore({ personalWinrate: wr, avgKda, recentWinrate });
  const metaScore = getMetaScore(tierEntry);
  const tierScore = tierEntry ? toNumber(tierEntry.ranking_final, 50) : 50;
  const projectionScore = clamp(
    personalScore * 0.55 +
    metaScore * 0.30 +
    sampleScore * 0.15
  );

  let label = tr('library.estable');
  let tone = 'neutral';

  if (totalGames === 0) {
    label = tr('dashboard.sinDatos');
    tone = 'muted';
  } else if (totalGames < 5) {
    label = tr('library.pocaData');
    tone = 'muted';
  } else if (tierScore >= 70 && wr < 48 && totalGames >= 8) {
    label = tr('library.metaFuerteBajoRendimiento');
    tone = 'warning';
  } else if (tierScore < 45 && wr >= 58 && totalGames >= 10) {
    label = tr('library.offMetaEfectivo');
    tone = 'positive';
  } else if (totalGames >= 25 && wr >= 55 && projectionScore >= 65) {
    label = tr('library.consolidado');
    tone = 'positive';
  } else if (totalGames >= 12 && wr >= 55 && tierScore >= 70) {
    label = tr('library.pickFuerte');
    tone = 'positive';
  } else if (totalGames < 12 && wr >= 55 && projectionScore >= 58) {
    label = tr('library.prometedor');
    tone = 'positive';
  } else if (wr < 45 && totalGames >= 8) {
    label = tr('library.riesgoso');
    tone = 'danger';
  } else if (wr < 48 && totalGames >= 12) {
    label = tr('library.revisarPick');
    tone = 'danger';
  } else if (tierScore >= 75 && totalGames < 8) {
    label = tr('library.metaFuerte');
    tone = 'positive';
  }

  return {
    label,
    tone,
    projectionScore: Number(projectionScore.toFixed(1)),
    personalScore: Number(personalScore.toFixed(1)),
    metaScore: Number(metaScore.toFixed(1)),
    sampleScore: Number(sampleScore.toFixed(1)),
  };
};

// ── Insight function (defined outside component, receives all values as params) ──
export const getChampionInsight = ({
  championName,
  totalGames,
  numericWr,
  deathsAvg,
  killsAvg,
  assistsAvg,
  kdaNum,
  recentWrNum,
  recentMatchesCount,
  cleanRate,
  participationRatio,
  selectedTierEntry,
}) => {
  if (totalGames === 0) return null;

  const wrTrend = recentWrNum - numericWr;

  if (totalGames < 5) {
    return tr('library.conLosNumerosSon', { value: totalGames === 1 ? tr('library.unaSolaPartida') : tr('library.soloPartidas', { totalGames }), championName });
  }

  if (totalGames >= 20 && numericWr >= 58 && kdaNum >= 3.5) {
    return tr('library.conTenesUnoDe', { championName, numericWr, totalGames, value: kdaNum.toFixed(1) });
  }

  if (numericWr >= 55 && kdaNum < 2.5 && totalGames >= 10) {
    return tr('library.ganasConPeroTu', { championName, value: kdaNum.toFixed(1), deathsAvg });
  }

  if (numericWr < 50 && kdaNum >= 3 && totalGames >= 10) {
    return tr('library.hayUnaContradiccionInteresante', { championName, value: kdaNum.toFixed(1), numericWr });
  }

  if (assistsAvg >= 8 && participationRatio !== null && participationRatio >= 2.5) {
    return tr('library.tuRolConEs', { championName, value: assistsAvg.toFixed(1), value2: killsAvg.toFixed(1) });
  }

  if (killsAvg >= 7 && participationRatio !== null && participationRatio < 0.8) {
    return tr('library.conJugasParaKills', { championName, value: killsAvg.toFixed(1) });
  }

  if (cleanRate >= 0.6 && numericWr < 50 && totalGames >= 10) {
    return tr('library.sosConsistenteConEn', { championName, value: Math.round(cleanRate * 100) });
  }

  if (wrTrend >= 15 && totalGames >= 12) {
    return tr('library.hayUnaTendenciaClara', { championName, numericWr, recentMatchesCount, value: recentWrNum.toFixed(0) });
  }

  if (wrTrend <= -15 && totalGames >= 12) {
    return tr('library.tuWrHistoricoCon', { championName, numericWr, recentMatchesCount, value: recentWrNum.toFixed(0) });
  }

  if (deathsAvg >= 6 && totalGames >= 8) {
    return tr('library.elDatoMasUrgente', { championName, deathsAvg, value: (deathsAvg - 2).toFixed(1) });
  }

  if (
    selectedTierEntry &&
    toNumber(selectedTierEntry.ranking_final, 0) >= 70 &&
    numericWr < 50 &&
    totalGames >= 8
  ) {
    return tr('library.estaEnUnBuen', { championName, value: toNumber(selectedTierEntry.ranking_final).toFixed(0), numericWr });
  }

  if (
    selectedTierEntry &&
    toNumber(selectedTierEntry.ranking_final, 0) < 45 &&
    numericWr >= 55 &&
    totalGames >= 10
  ) {
    return tr('library.estasSacandoDeWr', { numericWr, championName, value: toNumber(selectedTierEntry.ranking_final).toFixed(0) });
  }

  if (totalGames < 12 && numericWr >= 55) {
    return tr('library.inicioPrometedorConEn', { championName, numericWr, totalGames });
  }

  return tr('library.tuPerfilConEsta', { championName, numericWr, value: kdaNum.toFixed(1), deathsAvg });
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBar({ label, value, max = 3, color = 'bg-primary' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="flex gap-1">
        {Array(max)
          .fill(0)
          .map((_, i) => (
            <div
              key={i}
              className={`
                h-2 flex-1 rounded-full transition-all
                ${i < value ? color : 'bg-secondary'}
              `}
            />
          ))}
      </div>
    </div>
  );
}

function BaseStatRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

function MatchupChip({ name, type = 'good' }) {
  return (
    <div
      className={`
        text-xs px-2.5 py-1 rounded-lg border
        ${type === 'good'
          ? 'bg-green-500/10 text-green-400 border-green-500/20'
          : 'bg-red-500/10 text-red-400 border-red-500/20'}
      `}
    >
      {name}
    </div>
  );
}

function PersonalMetric({ label, value, hint }) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3">
      <p className="rd-label mb-1">{label}</p>
      <p className="text-lg font-rajdhani font-bold text-foreground tracking-[-0.04em]">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  );
}

// Evolución de una línea en los últimos parches: curva del score y el tier de
// cada snapshot. `points` va del parche más viejo al actual.
function MetaEvolution({ points }) {
  const t = useT();
  if (points.length < 2) {
    return (
      <div className="rd-champ-meta-evolution rd-champ-meta-evolution-empty">
        <p className="rd-label">{t('goals.evolution')}</p>
        <p className="text-xs text-muted-foreground">
         {t('library.haceFaltaAlMenos')}
        </p>
      </div>
    );
  }

  const scores = points.map(point => point.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  // x centrado en la columna de cada parche, para alinear con los chips de abajo.
  const coords = points.map((point, index) => [
    ((index + 0.5) / points.length) * 100,
    36 - ((point.score - min) / range) * 30,
  ]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${coords[0][0]},40 ${line} ${coords[coords.length - 1][0]},40`;
  const first = points[0];
  const last = points[points.length - 1];
  const delta = last.score - first.score;

  return (
    <div className="rd-champ-meta-evolution">
      <div className="rd-champ-meta-evolution-head">
        <p className="rd-label">{t('library.evolucion')} {points.length} {t('library.parches')}</p>
        <p className="text-xs text-muted-foreground">
          {first.tier !== last.tier && <span>{first.tier} → {last.tier} · </span>}
          <span className={delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : ''}>
            {delta > 0 ? '+' : ''}{delta.toFixed(1)} {t('library.score')}
          </span>
        </p>
      </div>

      <div className="rd-champ-meta-evolution-chart">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="rd-meta-evolution-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(212,175,55)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(212,175,55)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#rd-meta-evolution-fill)" />
          <polyline points={line} fill="none" stroke="rgb(212,175,55)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {coords.map(([x, y], index) => (
          <span
            key={points[index].key}
            className="rd-champ-meta-evolution-dot"
            style={{ left: `${x}%`, top: `${(y / 40) * 100}%` }}
          />
        ))}
      </div>

      <ol className="rd-champ-meta-evolution-patches" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map(point => (
          <li key={point.key} title={t('library.score2', { value: point.score.toFixed(1), value2: point.date ? t('library.snapshotDel', { date: point.date }) : '' })}>
            <TierBadge tier={point.tier} size="sm" />
            <span className="font-semibold text-foreground">{point.patch}</span>
            {point.date && (
              <span className="text-muted-foreground">{point.date.slice(8, 10)}/{point.date.slice(5, 7)}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChampionDetail({
  champion,
  tierData = [],
  onBack,
  publicMode = false,
  champions: initialChampions,
  relatedChampions = [],
}) {
  const t = useT();
  const { championNotes } = useCatalogText();
  const { user } = useAuth();
  // La ficha pública se prerenderiza: arranca sin dossier y lo activa al montar.
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY, { ssrSafe: publicMode });
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY, { ssrSafe: publicMode });
  const isDesktopFit = useMatchMedia(DESKTOP_FIT_QUERY, { ssrSafe: publicMode });
  const [section, setSection] = useState('profile');
  const [metaIndex, setMetaIndex] = useState(0);

  const { data: allChampions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list(),
    initialData: initialChampions,
    staleTime: initialChampions ? 5 * 60 * 1000 : undefined,
  });

  const champByExternalId = Object.fromEntries(
    allChampions.filter(c => c.external_id).map(c => [String(c.external_id), c])
  );

  // Also support lookup by name (case-insensitive) for champions stored as names instead of external_id
  const champByName = Object.fromEntries(
    allChampions.map(c => [c.name?.toLowerCase(), c])
  );

  const resolveChamp = (idOrName) => {
    const str = String(idOrName);
    return champByExternalId[str] || champByName[str.toLowerCase()] || null;
  };

  const { data: matches = [] } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email
      ? getUserMatches(user, 200)
      : [],
    enabled: !publicMode && !!user?.email,
  });

  const champMatches = matches.filter(
    m => m.own_champion_name?.toLowerCase() === champion.name?.toLowerCase()
  );

  const wins = champMatches.filter(m => m.result === 'win').length;

  const wr =
    champMatches.length > 0
      ? ((wins / champMatches.length) * 100).toFixed(0)
      : null;

  const totalKills = champMatches.reduce((acc, m) => acc + Number(m.kills || 0), 0);
  const totalDeaths = champMatches.reduce((acc, m) => acc + Number(m.deaths || 0), 0);
  const totalAssists = champMatches.reduce((acc, m) => acc + Number(m.assists || 0), 0);

  const avgKills =
    champMatches.length > 0 ? (totalKills / champMatches.length).toFixed(1) : null;
  const avgDeaths =
    champMatches.length > 0 ? (totalDeaths / champMatches.length).toFixed(1) : null;
  const avgAssists =
    champMatches.length > 0 ? (totalAssists / champMatches.length).toFixed(1) : null;

  const numericKda =
    champMatches.length > 0
      ? champMatches.reduce((sum, match) => {
          const kills = Number(match.kills || 0);
          const deaths = Number(match.deaths || 0);
          const assists = Number(match.assists || 0);
          const matchKda = deaths === 0 ? kills + assists : (kills + assists) / deaths;

          return sum + matchKda;
        }, 0) / champMatches.length
      : 0;

  const personalKdaValue = numericKda.toFixed(2);

  const avgKdaLine =
    champMatches.length > 0
      ? `${avgKills}/${avgDeaths}/${avgAssists}`
      : null;

  const formatMatchKda = (match) => {
    if (!match) return '—';
    return `${Number(match.kills || 0)}/${Number(match.deaths || 0)}/${Number(match.assists || 0)}`;
  };

  const getMatchKdaScore = (match) => {
    const kills = Number(match.kills || 0);
    const deaths = Number(match.deaths || 0);
    const assists = Number(match.assists || 0);
    if (deaths === 0) return kills + assists + 1000;
    return (kills + assists) / deaths;
  };

  const bestKdaGame =
    champMatches.length > 0
      ? [...champMatches].sort((a, b) => getMatchKdaScore(b) - getMatchKdaScore(a))[0]
      : null;

  const riskiestGame =
    champMatches.length > 0
      ? [...champMatches].sort((a, b) => {
          const scoreA = getMatchKdaScore(a);
          const scoreB = getMatchKdaScore(b);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return Number(b.deaths || 0) - Number(a.deaths || 0);
        })[0]
      : null;

  const recentMatches = [...champMatches]
    .sort((a, b) => {
      const dateA = new Date(a.date || a.created_date || 0).getTime();
      const dateB = new Date(b.date || b.created_date || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 10);

  const recentWins = recentMatches.filter(m => m.result === 'win').length;

  const recentWr =
    recentMatches.length > 0
      ? (recentWins / recentMatches.length) * 100
      : null;

  const selectedTierEntry = getRelevantTierEntry({
    tierData,
    champion,
    champMatches,
  });

  // ── Insight derived values (all computed before calling getChampionInsight) ──
  const cleanGames = champMatches.filter(m => Number(m.deaths || 0) <= 3).length;
  const cleanRate = champMatches.length > 0 ? cleanGames / champMatches.length : 0;
  const participationRatio =
    Number(avgAssists) > 0 && Number(avgKills) > 0
      ? Number(avgAssists) / Number(avgKills)
      : null;

  const championInsight = getChampionInsight({
    championName: champion.name,
    totalGames: champMatches.length,
    numericWr: Number(wr),
    deathsAvg: Number(avgDeaths),
    killsAvg: Number(avgKills),
    assistsAvg: Number(avgAssists),
    kdaNum: numericKda,
    recentWrNum: recentWr ?? Number(wr),
    recentMatchesCount: recentMatches.length,
    cleanRate,
    participationRatio,
    selectedTierEntry,
  });

  const projection = getChampionProjection({
    games: champMatches.length,
    personalWinrate: wr,
    avgKda: numericKda,
    recentWinrate: recentWr,
    tierEntry: selectedTierEntry,
  });

  // En smartphone y en escritorio la ficha es un "dossier": identidad fija (a la
  // izquierda en horizontal y escritorio, arriba en vertical) y una sección a la vez.
  // La ficha pública no tiene rendimiento personal y suma los campeones relacionados.
  const useSections = isPhoneLandscape || isPhonePortrait || isDesktopFit;
  // Sin dossier, la ficha pública reparte las tarjetas en su propia grilla de dos columnas.
  const publicGrid = publicMode && !useSections;
  const sectionTabs = [
    ['profile', t('bugReport.pages.Perfil')],
    ['stats', t('nav.stats')],
    ['matchups', t('dashboard.slides.matchups')],
    ...(publicMode ? [] : [['personal', t('library.rendimiento')]]),
    ...(tierData.length > 0 ? [['meta', t('goals.target')]] : []),
    ...(publicMode && relatedChampions.length > 0 ? [['related', t('library.relacionados')]] : []),
  ];
  const activeSection = sectionTabs.some(([id]) => id === section) ? section : 'profile';
  const show = id => !useSections || activeSection === id;
  // En el dossier se ve una posición meta por vez (flechas para cambiar).
  const activeMetaIndex = Math.min(metaIndex, Math.max(0, tierData.length - 1));
  const visibleTierData = useSections ? tierData.slice(activeMetaIndex, activeMetaIndex + 1) : tierData;

  // Evolución en el meta (solo en el dossier): últimos 6 snapshots,
  // consultando únicamente las filas de este campeón.
  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
    enabled: useSections,
  });
  const historyExecutions = executions
    .filter(execution => execution.status === 'success' || execution.status === 'partial')
    .slice(0, 6)
    .reverse();
  const historyKeys = historyExecutions.map(execution => execution.snapshot_key).filter(Boolean);
  const championNames = [champion.name, champion.original_name].filter(Boolean);
  const { data: historyEntries = [] } = useQuery({
    queryKey: ['tierlist-champion-history', champion.id, historyKeys],
    queryFn: () => getTierlistEntries('-ranking_final', 500, { snapshotKeys: historyKeys, championNames }),
    enabled: useSections && historyKeys.length > 1,
    staleTime: 5 * 60 * 1000,
  });
  const getLaneHistory = lane => historyExecutions.flatMap(execution => {
    const [entry] = getTierEntriesForChampion(
      champion,
      historyEntries.filter(item => item.snapshot_key === execution.snapshot_key && item.lane === lane)
    );
    if (!entry || entry.ranking_final == null) return [];
    return [{
      key: execution.snapshot_key,
      patch: execution.patch,
      date: execution.snapshot_date,
      tier: entry.tier,
      score: Number(entry.ranking_final),
    }];
  });

  return (
    <div className="rd-champ-detail space-y-6">
      {/* back */}
      <button
        onClick={onBack}
        className="
          flex items-center gap-2 text-sm
          text-muted-foreground hover:text-foreground
          transition-colors
        "
      >
        <ArrowLeft size={15} />
        {publicMode ? t('library.todosLosCampeones') : t('library.volverALaBiblioteca')}
      </button>

      {useSections && (
        <div className="rd-panel-tabs rd-champ-tabs" role="tablist" aria-label={t('library.seccionesDelCampeon')}>
          {sectionTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeSection === id}
              onClick={() => setSection(id)}
              className={`rd-panel-tab ${activeSection === id ? 'rd-panel-tab-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* HERO */}
      <div className="rd-champ-hero rd-card overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.18),transparent_35%)]" />

        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* image */}
            <div className="relative shrink-0">
              {champion.image_url_card && (
                <img
                  src={champion.image_url_card}
                  alt={champion.name}
                  className="
                    w-40 h-64 rounded-3xl object-cover
                    border border-primary/20
                    shadow-[0_0_30px_rgba(212,175,55,.10)]
                  "
                />
              )}
            </div>

            {/* content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {(champion.lane || []).map(l => {
                  const LANE_IMAGES = {
                    top: 'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
                    toplane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
                    jungler: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
                    jungle: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
                    mid: 'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
                    midlane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
                    adc: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
                    botlane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
                    bot: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
                    dragonlane: 'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
                    support: 'https://media.base44.com/images/public/6a0005628d71002f05120013/3e7bd0424_support.png',
                  };
                  const key = l?.toLowerCase().trim();
                  const imgSrc = LANE_IMAGES[key];
                  return imgSrc
                    ? <img key={l} src={imgSrc} alt={l} title={l} className="w-7 h-7 object-contain" />
                    : <span key={l} className="text-xs text-muted-foreground">{l}</span>;
                })}

                {champion.damage_type && (
                  <span className="rd-status-pill">{champion.damage_type}</span>
                )}

                {champion.attack_range && (
                  <span className="rd-status-pill">
                    {champion.attack_range === 'ranged' ? t('library.ranged') : t('library.melee')}
                  </span>
                )}
              </div>

              <h1 className="font-rajdhani font-bold text-5xl tracking-[-0.08em] text-foreground uppercase">
                {champion.name}
              </h1>

              {champion.roles && (
                <p className="text-muted-foreground mt-1">{champion.roles}</p>
              )}

              {/* meta strip */}
              <div className="mt-5 pt-4 border-t border-border/40">
                <div className={`grid grid-cols-1 gap-x-6 gap-y-4 ${publicMode ? '' : 'md:grid-cols-4'}`}>
                  <div className="min-w-0">
                    <p className="rd-label mb-1">{t('library.escalado')}</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {SCALING_LABEL[champion.scaling] || champion.scaling || '—'}
                    </p>
                  </div>

                  {!publicMode && <div className="min-w-0">
                    <p className="rd-label mb-1">{t('library.proyeccion')}</p>
                    <p
                      className={`
                        text-base font-semibold leading-tight
                        ${PROJECTION_TONE_CLASS[projection.tone] || 'text-foreground'}
                      `}
                    >
                      {projection.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                     {t('dashboard.score')} {projection.projectionScore}
                    </p>
                  </div>}

                  {!publicMode && <div className="min-w-0">
                    <p className="rd-label mb-1">{t('library.wrPersonal')}</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {wr ? `${wr}%` : t('dashboard.sinDatos')}
                    </p>
                  </div>}

                  {!publicMode && <div className="min-w-0">
                    <p className="rd-label mb-1">{t('nav.matches')}</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {champMatches.length}
                    </p>
                  </div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* layout */}
      <div className="rd-champ-sections grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* LEFT */}
        <div className={publicGrid ? 'contents' : 'space-y-6'}>
          {/* profile */}
          {show('profile') && <div className={`rd-champ-profile rd-card p-5 ${publicGrid ? 'xl:col-span-2 xl:row-start-1' : ''}`}>
            {/* Primera "pantalla" del perfil: en smartphone horizontal ocupa todo el alto
                visible y las notas quedan debajo, accesibles con scroll. */}
            <div className="rd-champ-profile-main">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">{t('library.perfilDelCampeon')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rd-mini-action">
                <StatBar label={t('library.dano')} value={champion.damage} color="bg-red-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label={t('library.supervivencia')} value={champion.survive} color="bg-blue-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label={t('library.asistencia')} value={champion.assist} color="bg-green-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label={t('library.dificultad')} value={champion.difficulty} color="bg-primary" />
              </div>
            </div>

            {(champion.tags || []).length > 0 && (
              <div className="mt-5">
                <p className="rd-label mb-2">{t('library.tags')}</p>
                <div className="flex flex-wrap gap-2">
                  {champion.tags.map(tag => (
                    <span key={tag} className="rd-status-pill">{championTagLabel(tag)}</span>
                  ))}
                </div>
              </div>
            )}
            </div>

            {champion.strategic_notes && (
              <div className="rd-champ-profile-notes mt-5 rd-mini-action">
                <p className="rd-label mb-2">{t('builds.notasEstrategicas')}</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {championNotes(champion)}
                </p>
              </div>
            )}
          </div>}

          {/* base stats */}
          {show('stats') && <div className={`rd-champ-stats rd-card p-5 ${publicGrid ? 'xl:col-start-1 xl:row-start-2' : ''}`}>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">{t('library.estadisticasBase')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <BaseStatRow label={t('builds.vida')} value={champion.life} />
                <BaseStatRow label={t('builds.regVida')} value={champion.life_reg} />
                <BaseStatRow label={t('builds.mana')} value={champion.mana} />
                <BaseStatRow label={t('builds.regMana')} value={champion.mana_reg} />
                <BaseStatRow label={t('itemTypes.Movimiento')} value={champion.movement} />
              </div>
              <div>
                <BaseStatRow label={t('library.danoDeAtaque')} value={champion.attack_damage} />
                <BaseStatRow label={t('library.velDeAtaque')} value={champion.attack_speed} />
                <BaseStatRow label={t('library.bonusAs')} value={champion.bonus_attack_speed ? `${champion.bonus_attack_speed}%` : null} />
                <BaseStatRow label={t('builds.armadura')} value={champion.armor} />
                <BaseStatRow label={t('library.resistMagica')} value={champion.magic_res} />
              </div>
            </div>
          </div>}

          {/* matchups */}
          {show('matchups') && <div className={`rd-champ-matchups rd-card p-5 ${publicGrid ? 'xl:col-span-2 xl:row-start-3' : ''}`}>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">{t('library.matchupsYSinergias')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Fuerte Contra */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Sword size={15} className="text-green-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-green-400 font-semibold">
                   {t('library.fuerteContra')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {(champion.strong_against || []).length > 0 ? (
                    champion.strong_against.map(id => {
                      const c = resolveChamp(id);
                      if (!c) return null;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.name} className="w-8 h-8 rounded-lg object-cover border border-green-500/20 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 shrink-0" />
                          )}
                          <span className="text-xs text-green-300 font-medium truncate">{c.name}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('library.sinDatos')}</p>
                  )}
                </div>
              </div>

              {/* Débil Contra */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} className="text-red-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400 font-semibold">
                   {t('library.debilContra')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {(champion.weak_against || []).length > 0 ? (
                    champion.weak_against.map(id => {
                      const c = resolveChamp(id);
                      if (!c) return null;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.name} className="w-8 h-8 rounded-lg object-cover border border-red-500/20 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 shrink-0" />
                          )}
                          <span className="text-xs text-red-300 font-medium truncate">{c.name}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('library.sinDatos')}</p>
                  )}
                </div>
              </div>

              {/* Sinergias */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={15} className="text-blue-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-400 font-semibold">
                   {t('library.mejoresSinergias')}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {(champion.synergies || []).length > 0 ? (
                    champion.synergies.map(id => {
                      const c = resolveChamp(id);
                      if (!c) return null;
                      return (
                        <div key={id} className="flex items-center gap-2">
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.name} className="w-8 h-8 rounded-lg object-cover border border-blue-500/20 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 shrink-0" />
                          )}
                          <span className="text-xs text-blue-300 font-medium truncate">{c.name}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('library.sinDatos')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>}
        </div>

        {/* RIGHT */}
        <div className={publicGrid ? 'space-y-6 xl:col-start-2 xl:row-start-2' : 'space-y-6'}>
          {/* personal */}
          {!publicMode && show('personal') && <div className="rd-champ-personal rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">{t('library.rendimientoPersonal')}</h2>
            </div>

            {champMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
               {t('library.sinPartidasRegistradas')}
              </p>
            ) : (
              <>
                <div>
                  <div className="text-5xl font-rajdhani font-bold text-primary tracking-[-0.08em]">
                    {wr}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {champMatches.length} {t('library.partidas')} {wins}V / {champMatches.length - wins}D
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <PersonalMetric
                    label={t('library.kdaPersonal')}
                    value={personalKdaValue}
                    hint={t('library.ratioGlobal')}
                  />
                  <PersonalMetric
                    label="K / D / A"
                    value={avgKdaLine}
                    hint={t('goals.aggregation.average')}
                  />
                  <PersonalMetric
                    label={t('library.mejorKdaEnPartida')}
                    value={formatMatchKda(bestKdaGame)}
                  />
                  <PersonalMetric
                    label={t('library.peorKdaEnPartida')}
                    value={formatMatchKda(riskiestGame)}
                  />
                </div>

                {championInsight && (
                  <div className="rd-champ-personal-insight mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                    <p className="rd-label mb-2 text-primary">
                     {t('dashboard.insightCon')} {champion.name}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {championInsight}
                    </p>
                  </div>
                )}

                {champMatches.length < 5 && (
                  <div className="rd-champ-personal-warning mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
                    <p className="text-xs text-yellow-400">{t('library.muestraPequena')}</p>
                  </div>
                )}
              </>
            )}
          </div>}

          {/* tier */}
          {tierData.length > 0 && show('meta') && (
            <div className="rd-champ-meta rd-card p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-px bg-primary/50" />
                <h2 className="rd-card-title">{t('library.posicionMeta')}</h2>
                {useSections && tierData.length > 1 && (
                  <div className="rd-champ-meta-nav ml-auto flex items-center gap-1.5" aria-label={t('library.cambiarPosicion')}>
                    <button
                      type="button"
                      className="rd-arrow"
                      onClick={() => setMetaIndex((activeMetaIndex - 1 + tierData.length) % tierData.length)}
                      aria-label={t('library.posicionAnterior')}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>{activeMetaIndex + 1} / {tierData.length}</span>
                    <button
                      type="button"
                      className="rd-arrow"
                      onClick={() => setMetaIndex((activeMetaIndex + 1) % tierData.length)}
                      aria-label={t('library.posicionSiguiente')}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* --rd-fill: nivel 0-100% de cada valor; lo usan las barras de la ficha
                  en smartphone horizontal (WR 40-60%, PR 0-25%, BR 0-50%, score 0-100). */}
              <div className="rd-champ-meta-list space-y-5">
                {visibleTierData.map((t, index) => (
                  <div
                    key={t.id}
                    className={`
                      ${index !== visibleTierData.length - 1
                        ? 'pb-5 border-b border-border/50'
                        : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <LaneBadge lane={t.lane} />
                      <TierBadge tier={t.tier} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/50 rounded-xl p-3 text-center" style={{ '--rd-fill': `${clamp((toNumber(t.winrate) - 40) * 5)}%` }}>
                        <p className="rd-label mb-1">{tr('tierlist.wr')}</p>
                        <p className="font-bold text-foreground">
                          {t.winrate?.toFixed(0)}%
                        </p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center" style={{ '--rd-fill': `${clamp(toNumber(t.pickrate) * 4)}%` }}>
                        <p className="rd-label mb-1">{tr('tierlist.pr')}</p>
                        <p className="font-bold text-foreground">
                          {t.pickrate?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center" style={{ '--rd-fill': `${clamp(toNumber(t.banrate) * 2)}%` }}>
                        <p className="rd-label mb-1">{tr('tierlist.br2')}</p>
                        <p className="font-bold text-foreground">
                          {t.banrate?.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="rd-champ-meta-footer mt-4 pt-4 border-t border-border/40 space-y-1" style={{ '--rd-fill': `${clamp(toNumber(t.ranking_final))}%` }}>
                      <p className="text-xs text-muted-foreground">
                       {tr('library.score3')}
                        <span className="text-primary font-semibold ml-1">
                          {t.ranking_final?.toFixed(2)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{t.position_in_lane} {tr('dashboard.en')} {t.lane}
                      </p>
                    </div>

                    {useSections && <MetaEvolution points={getLaneHistory(t.lane)} />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {publicMode && useSections && show('related') && relatedChampions.length > 0 && (
            <div className="rd-champ-related rd-card p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-px bg-primary/50" />
                <h2 className="rd-card-title">{t('library.campeonesDelMismoRol')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {relatedChampions.map(related => (
                  <Link key={related.id} to={`/campeones/${championSlug(related.name)}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-primary/5">
                    {related.image_url && <img src={related.image_url} alt={t('library.enWildRift', { name: related.name })} width="40" height="40" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
                    <h3 className="min-w-0 truncate font-rajdhani text-base font-bold">{related.name}</h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {publicGrid && relatedChampions.length > 0 && (
        <section className="rd-card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-6 h-px bg-primary/50" />
            <h2 className="rd-card-title">{t('library.campeonesDelMismoRol')}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t('library.opcionesRelacionadasPorLos')}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {relatedChampions.map(related => (
              <Link key={related.id} to={`/campeones/${championSlug(related.name)}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 transition-colors hover:border-primary/40 hover:bg-primary/5">
                {related.image_url && <img src={related.image_url} alt={t('library.enWildRift', { name: related.name })} width="48" height="48" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
                <h3 className="min-w-0 truncate font-rajdhani text-base font-bold">{related.name}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
