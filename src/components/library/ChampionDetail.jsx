import { ArrowLeft, Shield, Sword, Zap } from 'lucide-react';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Champion } from '@/api/entitiesSupabase';
import { userMatchesQuery } from '@/api/matchesSupabase';
import { averageMatchKda } from '@/domain/matchStats';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';

import TierBadge from '@/components/ui/TierBadge';
import LaneBadge from '@/components/ui/LaneBadge';
import { championSlug } from '@/utils/championSlug';
import { getTierEntriesForChampion } from '@/utils/tierlist';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';
import { useSwipeTabs } from '@/hooks/useSwipeTabs';
import { DAMAGE_LABELS, LANE_IMAGES, LANE_LABELS, getChampionLanes } from '@/utils/championPresentation';
import { DEFAULT_PALETTE, loadArtPalette } from '@/features/share/artPalette';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { CardTitle, MatchupRow, useFitCount, useFitText } from '@/components/library/detailParts';
import { labels, tr } from '@/i18n/uiI18n';
import { championTagLabel } from '@/utils/itemLabels';

// Recorte propio de esta pantalla sobre la query compartida de partidas.
const recentMatches200 = matches => matches.slice(0, 200);

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

/** Barra de 0 a `max` en segmentos (daño, supervivencia, asistencia, dificultad). */
function StatBar({ label, value, max = 3, tone }) {
  const filled = Math.max(0, Math.min(max, toNumber(value)));
  return (
    <div className="rd-cd-bar" data-tone={tone}>
      <span className="rd-cd-bar-label">{label}</span>
      <span className="rd-cd-bar-track" aria-hidden="true">
        {Array.from({ length: max }, (_, index) => (
          <span key={index} className={index < filled ? 'rd-cd-bar-on' : ''} />
        ))}
      </span>
      <span className="rd-cd-bar-value">{filled}/{max}</span>
    </div>
  );
}

function BaseStatRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="rd-cd-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// Evolución de una línea en los últimos parches: curva del score y el tier de cada
// snapshot. `points` va del parche más viejo al actual.
function MetaEvolution({ points }) {
  const t = useT();
  if (points.length < 2) {
    return <p className="rd-cd-empty">{t('library.haceFaltaAlMenos')}</p>;
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
  // Si varias fotos son del mismo parche (7.3f, 7.3f...), cada punto se rotula con su fecha.
  const distinctPatches = new Set(points.map(point => point.patch)).size === points.length;
  const pointLabel = point => (distinctPatches || !point.date ? point.patch : `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`);

  return (
    <div className="rd-cd-evo">
      <p className="rd-cd-evo-head">
        <span>{t('library.evolucion')} {points.length} {t('library.parches')}</span>
        <span className={delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : ''}>
          {first.tier !== last.tier && `${first.tier} → ${last.tier} · `}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} {t('library.score')}
        </span>
      </p>
      <div className="rd-cd-evo-chart">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="rd-cd-evo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(212,175,55)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="rgb(212,175,55)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#rd-cd-evo-fill)" />
          <polyline points={line} fill="none" stroke="rgb(226,196,106)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {coords.map(([x, y], index) => (
          <span key={points[index].key} className="rd-cd-evo-dot" style={{ left: `${x}%`, top: `${(y / 40) * 100}%` }} />
        ))}
      </div>
      <ol className="rd-cd-evo-patches" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map(point => (
          <li key={point.key} title={t('library.score2', { value: point.score.toFixed(1), value2: point.date ? t('library.snapshotDel', { date: point.date }) : '' })}>
            <TierBadge tier={point.tier} size="sm" />
            <span className="rd-cd-evo-date">{pointLabel(point)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Secciones de la ficha en el celular (una por pantalla). En escritorio se ven todas.
// De a dos por pantalla: perfil con estadísticas, notas con matchups y meta con tu rendimiento
// (en la ficha pública, que no lo tiene, meta con los campeones relacionados).
const PHONE_PANEL = { profile: 'profile', stats: 'profile', notes: 'matchups', matchups: 'matchups', meta: 'meta', personal: 'meta', related: 'meta' };

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
  // La ficha pública se prerenderiza: arranca en la vista de escritorio y ajusta al montar.
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY, { ssrSafe: publicMode });
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY, { ssrSafe: publicMode });
  const [section, setSection] = useState('profile');
  const [metaIndex, setMetaIndex] = useState(null);
  // Campeones del mismo rol o línea: tantos como filas completas entren en la tarjeta.
  const relatedListRef = useRef(null);
  const visibleRelated = relatedChampions.slice(0, useFitCount(relatedListRef, relatedChampions.length, 6));

  const { data: allChampions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list(),
    initialData: initialChampions,
    staleTime: initialChampions ? 5 * 60 * 1000 : undefined,
  });

  const champByExternalId = Object.fromEntries(
    allChampions.filter(c => c.external_id).map(c => [String(c.external_id), c])
  );
  // Campeones guardados por nombre en lugar de external_id.
  const champByName = Object.fromEntries(allChampions.map(c => [c.name?.toLowerCase(), c]));
  const resolveChamp = idOrName => {
    const str = String(idOrName);
    return champByExternalId[str] || champByName[str.toLowerCase()] || null;
  };
  const resolveList = values => (values || []).map(resolveChamp).filter(Boolean);

  // La ficha usa las últimas 200 partidas.
  const { data: matches = [] } = useQuery(userMatchesQuery(user, { enabled: !publicMode, select: recentMatches200 }));
  const champMatches = matches.filter(m => m.own_champion_name?.toLowerCase() === champion.name?.toLowerCase());
  const wins = champMatches.filter(m => m.result === 'win').length;
  const wr = champMatches.length > 0 ? ((wins / champMatches.length) * 100).toFixed(0) : null;
  const totalKills = champMatches.reduce((acc, m) => acc + Number(m.kills || 0), 0);
  const totalDeaths = champMatches.reduce((acc, m) => acc + Number(m.deaths || 0), 0);
  const totalAssists = champMatches.reduce((acc, m) => acc + Number(m.assists || 0), 0);
  const avgKills = champMatches.length > 0 ? (totalKills / champMatches.length).toFixed(1) : null;
  const avgDeaths = champMatches.length > 0 ? (totalDeaths / champMatches.length).toFixed(1) : null;
  const avgAssists = champMatches.length > 0 ? (totalAssists / champMatches.length).toFixed(1) : null;
  // Misma fórmula que Estadísticas: promedio del KDA de cada partida.
  const numericKda = averageMatchKda(champMatches) ?? 0;
  const avgKdaLine = champMatches.length > 0 ? `${avgKills}/${avgDeaths}/${avgAssists}` : null;

  const recentMatches = [...champMatches]
    .sort((a, b) => new Date(b.date || b.created_date || 0).getTime() - new Date(a.date || a.created_date || 0).getTime())
    .slice(0, 10);
  const recentWins = recentMatches.filter(m => m.result === 'win').length;
  const recentWr = recentMatches.length > 0 ? (recentWins / recentMatches.length) * 100 : null;
  const selectedTierEntry = getRelevantTierEntry({ tierData, champion, champMatches });

  const cleanGames = champMatches.filter(m => Number(m.deaths || 0) <= 3).length;
  const cleanRate = champMatches.length > 0 ? cleanGames / champMatches.length : 0;
  const participationRatio = Number(avgAssists) > 0 && Number(avgKills) > 0 ? Number(avgAssists) / Number(avgKills) : null;
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

  // Línea del meta que se muestra: arranca en la más relevante (la que más jugás o la mejor).
  const defaultMetaIndex = Math.max(0, tierData.indexOf(selectedTierEntry));
  const activeMetaIndex = tierData.length ? Math.min(metaIndex ?? defaultMetaIndex, tierData.length - 1) : 0;
  const activeTier = tierData[activeMetaIndex] || null;

  // Evolución en el meta: últimos 6 snapshots, consultando solo las filas de este campeón.
  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
    enabled: tierData.length > 0,
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
    enabled: historyKeys.length > 1,
    staleTime: 5 * 60 * 1000,
  });
  const getLaneHistory = lane => historyExecutions.flatMap(execution => {
    const [entry] = getTierEntriesForChampion(
      champion,
      historyEntries.filter(item => item.snapshot_key === execution.snapshot_key && item.lane === lane)
    );
    if (!entry || entry.ranking_final == null) return [];
    return [{ key: execution.snapshot_key, patch: execution.patch, date: execution.snapshot_date, tier: entry.tier, score: Number(entry.ranking_final) }];
  });

  // Arte del héroe: el splash guardado (horizontal, en alta) o la imagen card. Las luces
  // toman los colores del splash, como la tarjeta para compartir.
  // Si una URL no carga (archivo borrado o renombrado en Storage), se pasa a la siguiente.
  const artCandidates = [champion.image_url_splash, champion.image_url_card, champion.image_url].filter(Boolean);
  const [failedArt, setFailedArt] = useState([]);
  const art = artCandidates.find(url => !failedArt.includes(url)) || null;
  const [lights, setLights] = useState(null);
  useEffect(() => {
    let active = true;
    loadArtPalette(art).then(palette => { if (active) setLights(palette === DEFAULT_PALETTE ? null : palette); });
    return () => { active = false; };
  }, [art]);
  const lightStyle = {
    ...(art ? { '--rd-cd-splash': `url(${JSON.stringify(art)})` } : {}),
    ...(lights ? {
      '--rd-cd-light-a': lights.primary.join(', '),
      '--rd-cd-light-b': lights.secondary.join(', '),
    } : {}),
  };

  // Celular: una sección por pantalla, con pestañas. Escritorio y tablet: todas a la vista.
  const usePanels = isPhoneLandscape || isPhonePortrait;

  // Mosaico: un solo splash que cubre toda la ficha (como un `cover` sobre el héroe y la
  // grilla juntos); el héroe y cada tarjeta pintan la porción que tienen encima, así la
  // imagen se arma al juntar las piezas. Cada pieza recibe el tamaño del splash, su posición
  // corrida según dónde está la pieza y su altura relativa (--rd-cd-mt: 0 arriba, 1 abajo)
  // para apagarlo hacia abajo. En celular no se usa: las tarjetas van en columna y el splash
  // queda solo en el héroe.
  const articleRef = useRef(null);
  const [artSize, setArtSize] = useState(null);
  useEffect(() => {
    if (!art) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setArtSize({ url: art, width: image.naturalWidth, height: image.naturalHeight }); };
    image.onerror = () => { if (active) setFailedArt(failed => [...failed, art]); };
    image.src = art;
    return () => { active = false; };
  }, [art]);
  const mosaic = artSize?.url === art && !usePanels;
  useEffect(() => {
    const article = articleRef.current;
    if (!article || !mosaic || typeof ResizeObserver === 'undefined') return undefined;
    const pieces = () => article.querySelectorAll('.rd-cd-hero, .rd-cd-card');
    const layout = () => {
      const box = article.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const scale = Math.max(box.width / artSize.width, box.height / artSize.height);
      const width = artSize.width * scale;
      const height = artSize.height * scale;
      // Encuadre arriba al centro: en los splash la cara suele estar en el tercio superior.
      const offsetX = (box.width - width) / 2;
      const offsetY = (box.height - height) * 0.2;
      pieces().forEach(piece => {
        const rect = piece.getBoundingClientRect();
        const x = offsetX - (rect.left - box.left + piece.clientLeft);
        const y = offsetY - (rect.top - box.top + piece.clientTop);
        piece.style.setProperty('--rd-cd-bs', `${width}px ${height}px`);
        piece.style.setProperty('--rd-cd-bp', `${x}px ${y}px`);
        piece.style.setProperty('--rd-cd-mt', ((rect.top - box.top) / box.height).toFixed(3));
      });
    };
    const observer = new ResizeObserver(layout);
    observer.observe(article);
    pieces().forEach(piece => observer.observe(piece));
    return () => {
      observer.disconnect();
      pieces().forEach(piece => ['--rd-cd-bs', '--rd-cd-bp', '--rd-cd-mt'].forEach(name => piece.style.removeProperty(name)));
    };
  }, [mosaic, artSize]);
  const panelTabs = [
    ['profile', t('bugReport.pages.Perfil')],
    ['matchups', champion.strategic_notes ? t('library.notasYMatchups') : t('dashboard.slides.matchups')],
    ...(tierData.length > 0 || !publicMode || relatedChampions.length > 0 ? [['meta', tierData.length > 0
      ? t('goals.target')
      : publicMode ? t('library.relacionados') : t('library.rendimiento')]] : []),
  ];
  const activePanel = panelTabs.some(([id]) => id === section) ? section : 'profile';
  const swipe = useSwipeTabs({ ids: panelTabs.map(([id]) => id), active: activePanel, onChange: setSection, enabled: usePanels });
  const show = id => !usePanels || PHONE_PANEL[id] === activePanel;
  // Celular: la letra de las notas se ajusta a su extensión y llena el espacio de la tarjeta.
  const notesRef = useRef(null);
  const notesText = champion.strategic_notes ? championNotes(champion) : '';
  useFitText(notesRef, { enabled: usePanels, min: 10, max: 17, deps: [activePanel, notesText] });

  const lanes = getChampionLanes(champion);
  const strong = resolveList(champion.strong_against);
  const weak = resolveList(champion.weak_against);
  const synergies = resolveList(champion.synergies);
  const scaling = SCALING_LABEL[champion.scaling] || champion.scaling;

  return (
    <article {...swipe} ref={articleRef} className="rd-cd" style={lightStyle} data-panels={usePanels ? 'on' : 'off'} data-mosaic={mosaic ? 'on' : 'off'}>
      {/* HÉROE: identidad sobre su porción del splash (la posición meta va en su tarjeta). */}
      <header className="rd-cd-hero">
        <div className="rd-cd-hero-shade" aria-hidden="true" />

        <button type="button" onClick={onBack} className="rd-cd-back">
          <ArrowLeft size={14} aria-hidden="true" />
          {publicMode ? t('library.todosLosCampeones') : t('library.volverALaBiblioteca')}
        </button>

        <div className="rd-cd-hero-main">
          <div className="rd-cd-identity">
            {champion.roles && <p className="rd-cd-role">{champion.roles}</p>}
            <h1 className="rd-cd-name">{champion.name}</h1>
            <ul className="rd-cd-chips">
              {lanes.map(lane => (
                <li key={lane} className="rd-cd-chip rd-cd-chip-lane">
                  {LANE_IMAGES[lane] && <img src={LANE_IMAGES[lane]} alt="" width="16" height="16" />}
                  {LANE_LABELS[lane] || lane}
                </li>
              ))}
              {champion.damage_type && <li className="rd-cd-chip">{DAMAGE_LABELS[champion.damage_type] || champion.damage_type}</li>}
              {champion.attack_range && <li className="rd-cd-chip">{champion.attack_range === 'ranged' ? t('library.ranged') : t('library.melee')}</li>}
              {scaling && <li className="rd-cd-chip">{scaling}</li>}
            </ul>
          </div>

        </div>
      </header>

      {usePanels && (
        <div className="rd-panel-tabs rd-cd-tabs" role="tablist" aria-label={t('library.seccionesDelCampeon')}>
          {panelTabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={activePanel === id} onClick={() => setSection(id)} className={`rd-panel-tab ${activePanel === id ? 'rd-panel-tab-active' : ''}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="rd-cd-grid" data-private={publicMode ? undefined : 'true'}>
        {show('profile') && (
          <section className="rd-cd-card rd-cd-profile">
            <CardTitle>{t('library.perfilDelCampeon')}</CardTitle>
            <div className="rd-cd-bars">
              <StatBar label={t('library.dano')} value={champion.damage} tone="red" />
              <StatBar label={t('library.supervivencia')} value={champion.survive} tone="blue" />
              <StatBar label={t('library.asistencia')} value={champion.assist} tone="green" />
              <StatBar label={t('library.dificultad')} value={champion.difficulty} tone="gold" />
            </div>
            {(champion.tags || []).length > 0 && (
              <ul className="rd-cd-tags" aria-label={t('library.tags')}>
                {champion.tags.map(tag => <li key={tag}>{championTagLabel(tag)}</li>)}
              </ul>
            )}
          </section>
        )}

        {show('matchups') && (
          <section className="rd-cd-card rd-cd-matchups">
            <CardTitle>{t('library.matchupsYSinergias')}</CardTitle>
            <MatchupRow icon={Sword} tone="green" label={t('library.fuerteContra')} champions={strong} publicMode={publicMode} emptyLabel={t('library.sinDatos')} />
            <MatchupRow icon={Shield} tone="red" label={t('library.debilContra')} champions={weak} publicMode={publicMode} emptyLabel={t('library.sinDatos')} />
            <MatchupRow icon={Zap} tone="blue" label={t('library.mejoresSinergias')} champions={synergies} publicMode={publicMode} emptyLabel={t('library.sinDatos')} />
          </section>
        )}

        {tierData.length > 0 && show('meta') && (
          <section className="rd-cd-card rd-cd-meta">
            <CardTitle
              extra={tierData.length > 1 && (
                <div className="rd-cd-lane-switch" role="tablist" aria-label={t('library.cambiarPosicion')}>
                  {tierData.map((entry, index) => (
                    <button key={entry.id || entry.lane} type="button" role="tab" aria-selected={index === activeMetaIndex} onClick={() => setMetaIndex(index)}>
                      <LaneBadge lane={entry.lane} />
                    </button>
                  ))}
                </div>
              )}
            >
              {t('library.posicionMeta')}
            </CardTitle>
            <div className="rd-cd-meta-summary">
              <TierBadge tier={activeTier.tier} size="md" />
              <p>
                <span className="rd-cd-meta-score">{toNumber(activeTier.ranking_final).toFixed(1)}</span>
                <span className="rd-cd-meta-score-label">{t('dashboard.score')}</span>
              </p>
              <p className="rd-cd-meta-position">#{activeTier.position_in_lane} {tr('dashboard.en')} <LaneBadge lane={activeTier.lane} /></p>
            </div>
            <dl className="rd-cd-meta-rates">
              <div><dt>{tr('tierlist.wr')}</dt><dd>{toNumber(activeTier.winrate).toFixed(1)}%</dd></div>
              <div><dt>{tr('tierlist.pr')}</dt><dd>{toNumber(activeTier.pickrate).toFixed(1)}%</dd></div>
              <div><dt>{tr('tierlist.br2')}</dt><dd>{toNumber(activeTier.banrate).toFixed(1)}%</dd></div>
            </dl>
            <MetaEvolution points={getLaneHistory(activeTier.lane)} />
          </section>
        )}

        {show('stats') && (
          <section className="rd-cd-card rd-cd-stats">
            <CardTitle>{t('library.estadisticasBase')}</CardTitle>
            <dl className="rd-cd-stat-list">
              <BaseStatRow label={t('builds.vida')} value={champion.life} />
              <BaseStatRow label={t('library.danoDeAtaque')} value={champion.attack_damage} />
              <BaseStatRow label={t('builds.regVida')} value={champion.life_reg} />
              <BaseStatRow label={t('library.velDeAtaque')} value={champion.attack_speed} />
              <BaseStatRow label={t('builds.mana')} value={champion.mana} />
              <BaseStatRow label={t('library.bonusAs')} value={champion.bonus_attack_speed ? `${champion.bonus_attack_speed}%` : null} />
              <BaseStatRow label={t('builds.regMana')} value={champion.mana_reg} />
              <BaseStatRow label={t('builds.armadura')} value={champion.armor} />
              <BaseStatRow label={t('itemTypes.Movimiento')} value={champion.movement} />
              <BaseStatRow label={t('library.resistMagica')} value={champion.magic_res} />
            </dl>
          </section>
        )}

        {champion.strategic_notes && show('notes') && (
          <section className="rd-cd-card rd-cd-notes">
            <CardTitle>{t('builds.notasEstrategicas')}</CardTitle>
            <p ref={notesRef} className="rd-cd-notes-text">{notesText}</p>
          </section>
        )}

        {!publicMode && show('personal') && (
          <section className="rd-cd-card rd-cd-personal">
            <CardTitle>{t('library.rendimientoPersonal')}</CardTitle>
            {champMatches.length === 0 ? (
              <p className="rd-cd-empty">{t('library.sinPartidasRegistradas')}</p>
            ) : (
              <>
                <div className="rd-cd-personal-head">
                  <p className="rd-cd-personal-wr">{wr}%</p>
                  <div className="rd-cd-personal-summary">
                    <p className="rd-cd-personal-record">{champMatches.length} {t('library.partidas')} {wins}V / {champMatches.length - wins}D</p>
                    <dl className="rd-cd-personal-metrics">
                      <div><dt>KDA</dt><dd>{numericKda.toFixed(2)}</dd></div>
                      <div><dt>K/D/A</dt><dd>{avgKdaLine}</dd></div>
                    </dl>
                    <p className={`rd-cd-personal-projection ${PROJECTION_TONE_CLASS[projection.tone] || ''}`}>{projection.label}</p>
                  </div>
                </div>
                {championInsight && <p className="rd-cd-personal-insight">{championInsight}</p>}
                {champMatches.length < 5 && <p className="rd-cd-personal-warning">{t('library.muestraPequena')}</p>}
              </>
            )}
          </section>
        )}

        {publicMode && relatedChampions.length > 0 && show('related') && (
          <section className="rd-cd-card rd-cd-related">
            <CardTitle>{t('library.campeonesDelMismoRol')}</CardTitle>
            <ul ref={relatedListRef} className="rd-cd-related-list">
              {visibleRelated.map(related => (
                <li key={related.id}>
                  <Link to={`/campeones/${championSlug(related.name)}`} className="rd-cd-related-item">
                    {related.image_url && <img src={related.image_url} alt={t('library.enWildRift', { name: related.name })} width="40" height="40" loading="lazy" />}
                    <h3>{related.name}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
