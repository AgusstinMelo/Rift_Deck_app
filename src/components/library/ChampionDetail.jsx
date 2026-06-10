import {
  ArrowLeft,
  Sword,
  Shield,
  Zap,
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { Champion } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { useAuth } from '@/lib/AuthContext';

import TierBadge from '@/components/ui/TierBadge';
import LaneBadge from '@/components/ui/LaneBadge';

const SCALING_LABEL = {
  earlygame: 'Early Game',
  midgame: 'Mid Game',
  lategame: 'Late Game',
};

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

  let label = 'Estable';
  let tone = 'neutral';

  if (totalGames === 0) {
    label = 'Sin datos';
    tone = 'muted';
  } else if (totalGames < 5) {
    label = 'Poca data';
    tone = 'muted';
  } else if (tierScore >= 70 && wr < 48 && totalGames >= 8) {
    label = 'Meta fuerte, bajo rendimiento';
    tone = 'warning';
  } else if (tierScore < 45 && wr >= 58 && totalGames >= 10) {
    label = 'Off-meta efectivo';
    tone = 'positive';
  } else if (totalGames >= 25 && wr >= 55 && projectionScore >= 65) {
    label = 'Consolidado';
    tone = 'positive';
  } else if (totalGames >= 12 && wr >= 55 && tierScore >= 70) {
    label = 'Pick fuerte';
    tone = 'positive';
  } else if (totalGames < 12 && wr >= 55 && projectionScore >= 58) {
    label = 'Prometedor';
    tone = 'positive';
  } else if (wr < 45 && totalGames >= 8) {
    label = 'Riesgoso';
    tone = 'danger';
  } else if (wr < 48 && totalGames >= 12) {
    label = 'Revisar pick';
    tone = 'danger';
  } else if (tierScore >= 75 && totalGames < 8) {
    label = 'Meta fuerte';
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
const getChampionInsight = ({
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
    return `${totalGames === 1 ? 'Una sola partida' : `Solo ${totalGames} partidas`} con ${championName} — los números son una foto instantánea, no un veredicto. Seguí sumando registros; con 10+ partidas el análisis va a ser mucho más preciso.`;
  }

  if (totalGames >= 20 && numericWr >= 58 && kdaNum >= 3.5) {
    return `Con ${championName} tenés uno de tus perfiles más sólidos: ${numericWr}% de WR en ${totalGames} partidas y un KDA de ${kdaNum.toFixed(1)}. A este nivel de muestra, esos números no son ruido — hay algo que estás haciendo bien sistemáticamente. El siguiente paso no es jugar más cómodo, sino identificar qué hacés en las partidas perdidas que rompe ese patrón.`;
  }

  if (numericWr >= 55 && kdaNum < 2.5 && totalGames >= 10) {
    return `Ganás con ${championName}, pero tu KDA (${kdaNum.toFixed(1)}) sugiere que no es a través de dominio individual. Probablemente tu valor esté en el macro: objetivos, presión de mapa, presencia en peleas clave. Eso es difícil de ver en los números — y a veces es exactamente lo correcto. Aun así, bajar tus muertes promedio (${deathsAvg} por partida) debería elevar aún más tu winrate.`;
  }

  if (numericWr < 50 && kdaNum >= 3 && totalGames >= 10) {
    return `Hay una contradicción interesante con ${championName}: tu KDA es ${kdaNum.toFixed(1)}, pero el winrate está en ${numericWr}%. Estás jugando bien individualmente, pero esa ventaja no se convierte en victoria. Preguntate si estás cerrando partidas cuando tenés delantera, o si priorizás farm/kills sobre objetivos decisivos como el Baron o el inhibidor.`;
  }

  if (assistsAvg >= 8 && participationRatio !== null && participationRatio >= 2.5) {
    return `Tu rol con ${championName} es claramente de habilitador: ${assistsAvg.toFixed(1)} asistencias promedio contra ${killsAvg.toFixed(1)} kills dice que tu impacto vive en las jugadas de tus compañeros. Eso no es malo — es un estilo. La pregunta clave es si ese impacto se mantiene cuando tu equipo no convierte tus jugadas en kills, porque ahí es donde los campeones utilitarios pierden valor.`;
  }

  if (killsAvg >= 7 && participationRatio !== null && participationRatio < 0.8) {
    return `Con ${championName} jugás para kills: ${killsAvg.toFixed(1)} por partida y relativamente pocas asistencias. Eso puede ser una fortaleza si el daño se traduce en eliminar threats clave, pero también puede significar que estás optando por skirmishes individuales cuando el equipo necesita algo más colectivo. Revisá si tus peleas se alinean con los objetivos del mapa.`;
  }

  if (cleanRate >= 0.6 && numericWr < 50 && totalGames >= 10) {
    return `Sos consistente con ${championName} — en ${Math.round(cleanRate * 100)}% de tus partidas terminás con 3 muertes o menos. El problema no está en la sobrevivencia, está en el impacto: no morís, pero tampoco decidís partidas. Buscá ser más agresivo en los momentos clave: tomar peleas de Baron, forzar inhibidores cuando tenés ventaja, hacer llamados de rotación.`;
  }

  if (wrTrend >= 15 && totalGames >= 12) {
    return `Hay una tendencia clara de mejora con ${championName}: tu WR global es ${numericWr}%, pero en tus últimas ${recentMatchesCount} partidas subió a ${recentWrNum.toFixed(0)}%. Algo hiciste diferente — ya sea en builds, decisiones de mapa, o matchups que entendiste mejor. Vale la pena analizar qué cambió para no perderlo.`;
  }

  if (wrTrend <= -15 && totalGames >= 12) {
    return `Tu WR histórico con ${championName} es ${numericWr}%, pero en las últimas ${recentMatchesCount} partidas bajó a ${recentWrNum.toFixed(0)}%. Eso puede ser meta shift, haber subido de MMR, o simplemente varianza. Antes de forzar más partidas, revisá si hay algo concreto que cambió — ya sea en el parche, en tus hábitos de juego, o en los matchups que estás enfrentando.`;
  }

  if (deathsAvg >= 6 && totalGames >= 8) {
    return `El dato más urgente con ${championName} son las muertes: ${deathsAvg} por partida en promedio es alto para cualquier rol. Cada muerte extra no es solo un respawn — es un rebote de gold, un objetivo perdido y presión de mapa cedida. Un recorte a ${(deathsAvg - 2).toFixed(1)} muertes promedio probablemente tendría impacto directo en tu winrate.`;
  }

  if (
    selectedTierEntry &&
    toNumber(selectedTierEntry.ranking_final, 0) >= 70 &&
    numericWr < 50 &&
    totalGames >= 8
  ) {
    return `${championName} está en un buen momento de meta (tier score ${toNumber(selectedTierEntry.ranking_final).toFixed(0)}), pero tu winrate personal (${numericWr}%) no lo refleja. Puede que el campeón esté fuerte en manos que lo trabajan en un estilo específico que todavía no es el tuyo. Mirá cómo lo juegan los tops de la ladder — quizás hay algo puntual en builds o patrones de juego que no estés aplicando.`;
  }

  if (
    selectedTierEntry &&
    toNumber(selectedTierEntry.ranking_final, 0) < 45 &&
    numericWr >= 55 &&
    totalGames >= 10
  ) {
    return `Estás sacando ${numericWr}% de WR con ${championName} pese a que el meta no lo favorece (tier score ${toNumber(selectedTierEntry.ranking_final).toFixed(0)}). Eso habla de dominio real del campeón — sabés cuándo funciona y cuándo no. El riesgo es cuando el meta lo perjudica más activamente; seguí monitoreando si los resultados se sostienen con el parche.`;
  }

  if (totalGames < 12 && numericWr >= 55) {
    return `Inicio prometedor con ${championName}: ${numericWr}% en ${totalGames} partidas. Todavía es muestra chica para ser concluyente, pero la dirección es buena. Llegando a las 15–20 partidas vas a tener una imagen mucho más clara de si es un pick que te suma o si fue solo un arranque positivo.`;
  }

  return `Tu perfil con ${championName} está equilibrado: ${numericWr}% de WR, KDA ${kdaNum.toFixed(1)}, ${deathsAvg} muertes promedio. No hay una señal de alarma, pero tampoco un dominio claro. El margen de mejora más probable está en reducir muertes en los juegos perdidos y forzar más objetivos cuando tenés delantera.`;
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

// ── Main component ────────────────────────────────────────────────────────────

export default function ChampionDetail({ champion, tierData = [], onBack }) {
  const { user } = useAuth();

  const { data: allChampions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list(),
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
    enabled: !!user?.email,
  });

  const champMatches = matches.filter(
    m => m.own_champion_name?.toLowerCase() === champion.name?.toLowerCase()
  );

  const wins = champMatches.filter(m => m.result === 'win').length;

  const wr =
    champMatches.length > 0
      ? ((wins / champMatches.length) * 100).toFixed(1)
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

  const personalKdaValue =
    totalDeaths > 0
      ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
      : totalKills + totalAssists > 0
        ? 'Perfecto'
        : '0.00';

  const numericKda =
    totalDeaths > 0
      ? (totalKills + totalAssists) / totalDeaths
      : totalKills + totalAssists;

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

  return (
    <div className="space-y-6">
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
        Volver a la biblioteca
      </button>

      {/* HERO */}
      <div className="rd-card overflow-hidden relative">
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
                    {champion.attack_range === 'ranged' ? 'Ranged' : 'Melee'}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                  <div className="min-w-0">
                    <p className="rd-label mb-1">Escalado</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {SCALING_LABEL[champion.scaling] || champion.scaling || '—'}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="rd-label mb-1">Proyección</p>
                    <p
                      className={`
                        text-base font-semibold leading-tight
                        ${PROJECTION_TONE_CLASS[projection.tone] || 'text-foreground'}
                      `}
                    >
                      {projection.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Score {projection.projectionScore}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="rd-label mb-1">WR Personal</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {wr ? `${wr}%` : 'Sin datos'}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="rd-label mb-1">Partidas</p>
                    <p className="text-base font-semibold text-foreground leading-tight">
                      {champMatches.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* profile */}
          <div className="rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">Perfil del Campeón</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rd-mini-action">
                <StatBar label="Daño" value={champion.damage} color="bg-red-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label="Supervivencia" value={champion.survive} color="bg-blue-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label="Asistencia" value={champion.assist} color="bg-green-400" />
              </div>
              <div className="rd-mini-action">
                <StatBar label="Dificultad" value={champion.difficulty} color="bg-primary" />
              </div>
            </div>

            {(champion.tags || []).length > 0 && (
              <div className="mt-5">
                <p className="rd-label mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {champion.tags.map(t => (
                    <span key={t} className="rd-status-pill">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {champion.strategic_notes && (
              <div className="mt-5 rd-mini-action">
                <p className="rd-label mb-2">Notas Estratégicas</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {champion.strategic_notes}
                </p>
              </div>
            )}
          </div>

          {/* base stats */}
          <div className="rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">Estadísticas Base</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <BaseStatRow label="Vida" value={champion.life} />
                <BaseStatRow label="Reg. Vida" value={champion.life_reg} />
                <BaseStatRow label="Maná" value={champion.mana} />
                <BaseStatRow label="Reg. Maná" value={champion.mana_reg} />
                <BaseStatRow label="Movimiento" value={champion.movement} />
              </div>
              <div>
                <BaseStatRow label="Daño de Ataque" value={champion.attack_damage} />
                <BaseStatRow label="Vel. de Ataque" value={champion.attack_speed} />
                <BaseStatRow label="Bonus AS" value={champion.bonus_attack_speed ? `${champion.bonus_attack_speed}%` : null} />
                <BaseStatRow label="Armadura" value={champion.armor} />
                <BaseStatRow label="Resist. Mágica" value={champion.magic_res} />
              </div>
            </div>
          </div>

          {/* matchups */}
          <div className="rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">Matchups y Sinergias</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Fuerte Contra */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Sword size={15} className="text-green-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-green-400 font-semibold">
                    Fuerte Contra
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
                    <p className="text-sm text-muted-foreground">Sin datos.</p>
                  )}
                </div>
              </div>

              {/* Débil Contra */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} className="text-red-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-red-400 font-semibold">
                    Débil Contra
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
                    <p className="text-sm text-muted-foreground">Sin datos.</p>
                  )}
                </div>
              </div>

              {/* Sinergias */}
              <div className="rd-mini-action">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={15} className="text-blue-400" />
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-400 font-semibold">
                    Mejores Sinergias
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
                    <p className="text-sm text-muted-foreground">Sin datos.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* personal */}
          <div className="rd-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">Rendimiento Personal</h2>
            </div>

            {champMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin partidas registradas.
              </p>
            ) : (
              <>
                <div>
                  <div className="text-5xl font-rajdhani font-bold text-primary tracking-[-0.08em]">
                    {wr}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {champMatches.length} partidas · {wins}V / {champMatches.length - wins}D
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <PersonalMetric
                    label="KDA Personal"
                    value={personalKdaValue}
                    hint="Ratio global"
                  />
                  <PersonalMetric
                    label="K / D / A"
                    value={avgKdaLine}
                    hint="Promedio por partida"
                  />
                  <PersonalMetric
                    label="Mejor KDA en partida"
                    value={formatMatchKda(bestKdaGame)}
                  />
                  <PersonalMetric
                    label="Peor KDA en partida"
                    value={formatMatchKda(riskiestGame)}
                  />
                </div>

                {championInsight && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                    <p className="rd-label mb-2 text-primary">
                      Insight con {champion.name}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">
                      {championInsight}
                    </p>
                  </div>
                )}

                {champMatches.length < 5 && (
                  <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
                    <p className="text-xs text-yellow-400">Muestra pequeña.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* tier */}
          {tierData.length > 0 && (
            <div className="rd-card p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-px bg-primary/50" />
                <h2 className="rd-card-title">Posición Meta</h2>
              </div>

              <div className="space-y-5">
                {tierData.map((t, index) => (
                  <div
                    key={t.id}
                    className={`
                      ${index !== tierData.length - 1
                        ? 'pb-5 border-b border-border/50'
                        : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <LaneBadge lane={t.lane} />
                      <TierBadge tier={t.tier} />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <p className="rd-label mb-1">WR</p>
                        <p className="font-bold text-foreground">
                          {t.winrate?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <p className="rd-label mb-1">PR</p>
                        <p className="font-bold text-foreground">
                          {t.pickrate?.toFixed(1)}%
                        </p>
                      </div>
                      <div className="bg-secondary/50 rounded-xl p-3 text-center">
                        <p className="rd-label mb-1">BR</p>
                        <p className="font-bold text-foreground">
                          {t.banrate?.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/40 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Score:
                        <span className="text-primary font-semibold ml-1">
                          {t.ranking_final?.toFixed(2)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{t.position_in_lane} en {t.lane}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
