import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem, Rune, Spell } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';
import { BarChart3, ArrowRight, ShieldCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { computeInsights } from '@/hooks/useInsights';
import MembershipGate from '@/components/membership/MembershipGate';
import { getMyMembership } from '@/api/membershipSupabase';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import PatchFilter from '@/components/filters/PatchFilter';
import { filterByPatch, parsePatch, patchMatchesSelection } from '@/utils/patches';
import { matchKda, winratePct } from '@/domain/matchStats';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';

const STATS_MEMBERSHIP_GATE_ENABLED = false;

function calcWR(matches) {
  const wins = matches.filter(m => m.result === 'win').length;
  return winratePct(wins, matches.length);
}

function calcMatchKDA(match) {
  return matchKda(Number(match.kills || 0), Number(match.deaths || 0), Number(match.assists || 0));
}

function getKdaTone(avgKDA) {
  const kda = Number(avgKDA);

  if (!Number.isFinite(kda)) return 'text-cyan-400';
  if (kda < 2.5) return 'text-red-400';
  if (kda < 3) return 'text-yellow-400';
  if (kda < 3.5) return 'text-green-400';

  return 'text-blue-400';
}

function getWrTone(wr) {
  const value = Number(wr);

  if (!Number.isFinite(value)) return 'text-muted-foreground';
  return value < 50 ? 'text-red-400' : 'text-green-400';
}

const insightTone = {
  positive: 'border-green-500/25 bg-green-500/[0.04]',
  opportunity: 'border-cyan-500/25 bg-cyan-500/[0.04]',
  warning: 'border-yellow-500/25 bg-yellow-500/[0.04]',
  critical: 'border-red-500/25 bg-red-500/[0.04]',
  neutral: 'border-border/70 bg-background/25',
};

const insightAccent = {
  positive: 'bg-green-400', opportunity: 'bg-cyan-400', warning: 'bg-yellow-400',
  critical: 'bg-red-400', neutral: 'bg-primary/60',
};

const COACH_BOOK_URL = 'https://media.base44.com/images/public/6a04ac70fd92bb3979b654a9/83cce9c3d_ChatGPTImage19may202611_43_41pm.png';

function getPatchFilterValue(value) {
  const parsed = parsePatch(value);

  if (!parsed) return String(value || '').trim();
  if (parsed.minor === null) return String(parsed.major);

  return `${parsed.major}.${parsed.minor}`;
}

function getPoolGrade(score) {
  if (score >= 90) return 'S+';
  if (score >= 80) return 'S';
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

function getPoolTone(score) {
  if (score >= 80) return 'text-purple-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 45) return 'text-yellow-400';
  return 'text-red-400';
}

function calculatePoolScore(champArr, totalMatches) {
  if (!totalMatches || champArr.length === 0) {
    return {
      score: 0,
      grade: '—',
      label: 'Sin datos',
      tone: 'text-muted-foreground',
    };
  }

  const champsWithSample = champArr.filter(c => c.games >= 3);
  const reliableChamps = champsWithSample.length;

  const weightedWR =
    champArr.reduce((sum, c) => sum + (c.wr * c.games), 0) / totalMatches;

  const wrScore = Math.min(100, Math.max(0, weightedWR));

  const varietyScore = Math.min(100, (reliableChamps / 5) * 100);

  const volumeScore = Math.min(100, (totalMatches / 40) * 100);

  const score = Math.round(
    wrScore * 0.5 +
    varietyScore * 0.25 +
    volumeScore * 0.25
  );

  if (totalMatches < 10) {
    return {
      score,
      grade: 'Inicial',
      label: `${totalMatches} ${totalMatches === 1 ? 'partida' : 'partidas'} · provisional`,
      tone: 'text-yellow-400',
    };
  }

  return {
    score,
    grade: getPoolGrade(score),
    label: `${score}/100`,
    tone: getPoolTone(score),
  };
}

function HeroStat({ label, value, sub, tone }) {
  return (
      <div className="flex flex-col items-center justify-center text-center px-4 py-3 border-b lg:border-b-0">
      <p className="rd-label mb-2">{label}</p>
      <p className={`font-rajdhani font-bold text-4xl tracking-[-0.08em] ${tone}`}>
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
      )}
    </div>
  );
}

function StatsHeroCard({ winrate, wins, losses, avgKDA, kdaLine, blueWR, redWR, blueWins, blueLosses, redWins, redLosses, champImageUrl, poolScore }) {
  return (
    <div className="rd-stats-hero relative overflow-hidden rounded-2xl border border-border min-h-[150px]"
    style={{
      background: `
        radial-gradient(circle at 18% 0%, rgba(74, 222, 128, 0.08), transparent 32%),
        radial-gradient(circle at 85% 15%, rgba(96, 165, 250, 0.08), transparent 35%),
        linear-gradient(135deg, hsl(222,36%,13%) 0%, hsl(222,36%,9%) 100%)
      `,
    }}>
      {champImageUrl && (
        <>
          <div className="rd-stats-hero-art pointer-events-none absolute -bottom-[10%] -top-[10%] left-0 overflow-visible">
            <div
              className="relative h-full w-fit overflow-hidden"
              style={{
                WebkitMaskImage:
                  window.innerWidth >= 768
                    ? 'linear-gradient(to right, black 0%, black 90%, transparent 100%)'
                    : 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
                maskImage:
                  window.innerWidth >= 768
                    ? 'linear-gradient(to right, black 0%, black 90%, transparent 100%)'
                    : 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
              }}
            >
            <img
              src={champImageUrl}
              alt=""
              className="
                h-full w-auto max-w-none
                object-contain object-left
              "
              style={{
                filter:
                  window.innerWidth >= 768
                    ? 'brightness(0.84) saturate(1.16)'
                    : 'brightness(0.55) saturate(1.1) opacity(0.25)',

              }}
            />
            <div
              className="
                absolute inset-y-0 right-0 w-10
                bg-gradient-to-l from-[hsl(222,36%,9%)]/85 to-transparent
              "
            />
            </div>
          </div>
        </>
      )}

      <div className="rd-stats-hero-grid relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(220px,290px)_1fr_1fr_1fr_1fr] min-h-[150px]">
        <div className="flex flex-col items-center justify-center px-5 py-2 md:translate-x-6">
          <p className="rd-label mb-1 text-center">WINRATE GENERAL</p>
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="46"
                fill="rgba(2, 8, 20, 0.75)"
              />

              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(74,222,128,0.16)" strokeWidth="10" />

              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgb(74,222,128)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - winrate / 100)}`}
              />
            </svg>

            <span className="relative font-rajdhani text-sm font-bold text-green-400 tracking-[-0.06em]">
              {winrate.toFixed(1)}%
            </span>
          </div>

          <p className="mt-1.5 text-xs text-muted-foreground">{wins}W - {losses}L</p>
        </div>

        <div className="contents lg:[&>*]:-translate-x-8">
          <HeroStat label="KDA PROM" value={avgKDA} sub={kdaLine} tone={getKdaTone(avgKDA)} />

          <HeroStat
            label="WR LADO AZUL"
            value={blueWR ? `${blueWR}%` : '—'}
            sub={`${blueWins}W - ${blueLosses}L`}
            tone={getWrTone(blueWR)}
          />

          <HeroStat
            label="WR LADO ROJO"
            value={redWR ? `${redWR}%` : '—'}
            sub={`${redWins}W - ${redLosses}L`}
            tone={getWrTone(redWR)}
          />
          
          <HeroStat
            label="POOL SCORE"
            value={poolScore.grade}
            sub={poolScore.label}
            tone={poolScore.tone}
          />

        </div>
      </div>
    </div>
  );
}

function ChampionAvatar({ name, src, rounded = 'rounded-full' }) {
  return (
    <div className={`w-8 h-8 ${rounded} overflow-hidden bg-secondary shrink-0 ring-1 ring-primary/15`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
          {name?.[0]}
        </div>
      )}
    </div>
  );
}

function WRBar({ value }) {
  const color =
    value >= 55 ? 'bg-green-400' :
    value >= 45 ? 'bg-primary' :
    'bg-red-400';

  return (
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function SectionCard({ title, children, watermark = false, fixedHeight = false, fullHeight = false, headerExtra = null }) {
  return (
    <div className={`rd-card min-h-0 p-3 flex flex-col ${fixedHeight || fullHeight ? 'h-full' : ''} ${watermark ? 'rd-card-watermark' : ''}`}>
      <div className="mb-2 flex shrink-0 items-start justify-between gap-3">
        <h2 className="rd-card-title">{title}</h2>
        {headerExtra}
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}

function PoolChampionsCard({ champArr, getChampImg, poolScore }) {
  const totalGames = champArr.reduce((s, c) => s + c.games, 0) || 1;

  const diversityLabel =
    poolScore.score >= 70 ? 'Buena' :
    poolScore.score >= 50 ? 'Media' :
    'Baja';

  const diversityTone =
    poolScore.score >= 70 ? 'text-green-400' :
    poolScore.score >= 50 ? 'text-yellow-400' :
    'text-red-400';

  const getRingColor = (champ) => {
    if (champ.games < 3) return 'ring-yellow-400';
    if (champ.wr >= 50) return 'ring-green-400';
    return 'ring-red-400';
  };

  const getPoolWrTone = (champ) => {
    if (champ.games < 3) return 'text-yellow-400';
    if (champ.wr >= 50) return 'text-green-400';
    return 'text-red-400';
  };

  const topChamps = [...champArr].sort((a, b) => b.games - a.games).slice(0, 5);

  // Pack-placement: itera intentando colocar cada burbuja sin salirse
  // y con mínima superposición. Orden asimétrico por diseño.
  const CONTAINER_W = 380;
  const CONTAINER_H = 220;
  const CONTAINER_PADDING = 4;
  const MIN_R = 11;
  const MAX_R = 58;
  const MIN_VISIBLE_R = 9;

  const gamesValues = champArr.map(c => c.games);
  const minGames = Math.min(...gamesValues, 1);
  const maxGames = Math.max(...gamesValues, 1);
  const gamesRange = Math.max(1, maxGames - minGames);

  const getBaseRadius = (games) => {
    if (maxGames === minGames) return (MIN_R + MAX_R) / 2;

    const normalized = (games - minGames) / gamesRange;
    const eased = Math.pow(normalized, 0.72);
    return MIN_R + eased * (MAX_R - MIN_R);
  };

  const placed = [];

  // Secuencia de ángulos asimétricos para distribuir de forma orgánica
  const angleSeq = [0.7, 2.1, 4.5, 1.2, 3.8, 5.6, 0.3, 2.9, 4.1, 1.7, 5.1, 3.3];

  const placeBubble = (r, index) => {
    if (placed.length === 0) {
      // Primera burbuja: cerca del centro pero desplazada asimétricamente
      return { cx: CONTAINER_W * 0.45, cy: CONTAINER_H * 0.42 };
    }

    const baseAngle = angleSeq[index % angleSeq.length];
    const tries = 120;

    for (let t = 0; t < tries; t++) {
      // Espiral asimétrica desde el centro
      const spiralAngle = baseAngle + t * 0.42;
      const spiralDist = 8 + t * 3.5;
      const cx = CONTAINER_W / 2 + Math.cos(spiralAngle) * spiralDist;
      const cy = CONTAINER_H / 2 + Math.sin(spiralAngle) * spiralDist * 0.85;

      // Verificar que no se sale del contenedor
      if (cx - r < CONTAINER_PADDING || cx + r > CONTAINER_W - CONTAINER_PADDING) continue;
      if (cy - r < CONTAINER_PADDING || cy + r > CONTAINER_H - CONTAINER_PADDING) continue;

      // Sin superposición (overlap = 0)
      const overlap = placed.every(p => {
        const dx = p.cx - cx;
        const dy = p.cy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist >= p.r + r;
      });

      if (overlap) return { cx, cy };
    }

    // Fallback: posición válida dentro del borde
    const angle = baseAngle + placed.length * 1.1;
    const maxDist = Math.min(CONTAINER_W, CONTAINER_H) / 2 - r - 4;
    const dist = Math.min(30 + placed.length * 18, maxDist);
    return {
      cx: Math.max(r + CONTAINER_PADDING, Math.min(CONTAINER_W - r - CONTAINER_PADDING, CONTAINER_W / 2 + Math.cos(angle) * dist)),
      cy: Math.max(r + CONTAINER_PADDING, Math.min(CONTAINER_H - r - CONTAINER_PADDING, CONTAINER_H / 2 + Math.sin(angle) * dist * 0.85)),
    };
  };

  const baseBubbles = champArr.map((champ, i) => {
    const r = getBaseRadius(champ.games);
    const pos = placeBubble(r, i);
    placed.push({ ...pos, r });
    return { champ, r, ...pos };
  });

  const bounds = baseBubbles.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.cx - b.r),
    maxX: Math.max(acc.maxX, b.cx + b.r),
    minY: Math.min(acc.minY, b.cy - b.r),
    maxY: Math.max(acc.maxY, b.cy + b.r),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

  const usedW = bounds.maxX - bounds.minX || CONTAINER_W;
  const usedH = bounds.maxY - bounds.minY || CONTAINER_H;
  const fitScale = Math.min(
    1,
    (CONTAINER_W - CONTAINER_PADDING * 2) / usedW,
    (CONTAINER_H - CONTAINER_PADDING * 2) / usedH
  );

  const bubbles = baseBubbles.map(b => {
    const scaledMinR = Math.min(MIN_VISIBLE_R, MIN_VISIBLE_R * fitScale);
    const scaledR = Math.max(scaledMinR, b.r * fitScale);

    return {
      ...b,
      r: scaledR,
      cx: CONTAINER_W / 2 + (b.cx - CONTAINER_W / 2) * fitScale,
      cy: CONTAINER_H / 2 + (b.cy - CONTAINER_H / 2) * fitScale,
    };
  });

  return (
    <SectionCard
      title="Pool de campeones"
      watermark
      headerExtra={(
        <div className="text-right leading-tight">
          <p className="text-[11px] text-muted-foreground">
            Diversidad: <span className={`font-bold ${diversityTone}`}>{diversityLabel}</span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{champArr.length} campeones usados</p>
        </div>
      )}
    >
      <div className="min-h-0 h-full flex flex-col">
        <div className="rd-pool-frame flex-1 flex items-center justify-center overflow-hidden rounded-xl">
          <div
            className="rd-pool-bubbles relative shrink-0"
            style={{ aspectRatio: `${CONTAINER_W} / ${CONTAINER_H}` }}
          >
          {bubbles.map(({ champ, r, cx, cy }) => (
            <div
              key={champ.name}
              className={`absolute rounded-full overflow-hidden bg-secondary ring-2 ${getRingColor(champ)} shadow-lg shadow-black/40`}
              style={{
                width: `${(r * 2 / CONTAINER_W) * 100}%`,
                aspectRatio: '1',
                left: `${((cx - r) / CONTAINER_W) * 100}%`,
                top: `${((cy - r) / CONTAINER_H) * 100}%`,
                zIndex: Math.round(MAX_R - r + 1),
              }}
              title={`${champ.name} · ${champ.games}p · ${champ.wr.toFixed(0)}% WR`}
            >
              {getChampImg(champ.name) ? (
                <img
                  src={getChampImg(champ.name)}
                  alt={champ.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-bold text-primary">
                  {champ.name?.[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Más jugados: solo en smartphone vertical, donde el lienzo deja alto libre. */}
      <ul className="rd-stats-pool-list" aria-hidden="true">
        {topChamps.map(champ => (
          <li key={champ.name}>
            {getChampImg(champ.name)
              ? <img src={getChampImg(champ.name)} alt="" className={`ring-2 ${getRingColor(champ)}`} />
              : <span className={`ring-2 ${getRingColor(champ)}`} />}
            <span>{champ.name}</span>
            <span className="rd-stats-pool-bar"><span style={{ width: `${(champ.games / totalGames) * 100}%` }} /></span>
            <em>{champ.games}p</em>
            <strong className={getPoolWrTone(champ)}>{champ.wr.toFixed(0)}%</strong>
          </li>
        ))}
      </ul>
      </div>
    </SectionCard>
  );
}

// Carril de Rendimiento. En desktop es una columna normal; en smartphone
// horizontal el CSS lo vuelve un carril de dos tarjetas por vista y muestra
// las flechas, que se ocultan al llegar a cada extremo.
function OverviewTrack({ children }) {
  const trackRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const [edges, setEdges] = useState({ prev: false, next: false });

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setEdges({
      prev: track.scrollLeft > 4,
      next: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);
    return () => observer.disconnect();
  }, [updateEdges]);

  // Avanza una tarjeta: su ancho más el gap (dos por vista en horizontal, una en
  // vertical); el snap corrige el resto.
  const scrollByCard = (direction) => {
    const track = trackRef.current;
    if (!track) return;

    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const card = track.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + gap : (track.clientWidth + gap) / 2;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <>
      <div ref={trackRef} onScroll={updateEdges} className="rd-stats-track flex min-h-0 flex-1 flex-col gap-3">
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        disabled={!edges.prev}
        className="rd-arrow rd-stats-track-arrow rd-stats-track-arrow-prev"
        aria-label="Tarjetas anteriores"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        disabled={!edges.next}
        className="rd-arrow rd-stats-track-arrow rd-stats-track-arrow-next"
        aria-label="Tarjetas siguientes"
      >
        <ChevronRight size={16} />
      </button>
    </>
  );
}

const LANE_LABELS = {
  top: 'Top',
  jungler: 'Jungla',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Supp',
};

const LANE_COLORS = {
  top: '#4FC3F7', jungler: '#B388FF', mid: '#2EE6A6', adc: '#FF6B6B', support: '#FFC857',
};

function LaneBarChart({ laneArr }) {
  const orderedLanes = ['top', 'jungler', 'mid', 'adc', 'support'];
  const data = orderedLanes.map(lane => {
    const entry = laneArr.find(item => item.lane === lane);
    return { lane, wr: entry?.wr || 0, games: entry?.games || 0 };
  });
  const centerX = 150;
  const centerY = 105;
  const radius = 70;
  const pointAt = (index, distance) => {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / data.length);
    return [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance];
  };
  const polygon = (distance) => data.map((_, index) => pointAt(index, distance).join(',')).join(' ');
  const valuePolygon = data.map((entry, index) => {
    const normalized = Math.max(0.22, Math.min(1, entry.wr / 70));
    return pointAt(index, radius * normalized).join(',');
  }).join(' ');

  return (
    <div className="rd-stats-lane flex h-full min-h-0 items-center justify-center">
      <svg viewBox="0 0 300 210" className="rd-stats-lane-chart h-full max-h-[276px] w-full" role="img" aria-label="Winrate por línea">
        {[0.33, 0.66, 1].map(level => (
          <polygon key={level} points={polygon(radius * level)} fill="none" stroke="rgba(148,163,184,.16)" strokeWidth="1" />
        ))}
        {data.map((_, index) => {
          const [x, y] = pointAt(index, radius);
          return <line key={index} x1={centerX} y1={centerY} x2={x} y2={y} stroke="rgba(148,163,184,.13)" strokeWidth="1" />;
        })}
        <polygon points={valuePolygon} fill="rgba(77,166,255,.18)" stroke="#4da6ff" strokeWidth="2" />
        {data.map((entry, index) => {
          const [px, py] = pointAt(index, radius * Math.max(0.22, Math.min(1, entry.wr / 70)));
          const [lx, ly] = pointAt(index, 94);
          const color = LANE_COLORS[entry.lane] || '#d4af37';
          return (
            <g key={entry.lane}>
              <circle cx={px} cy={py} r="3.5" fill={color} stroke="hsl(222,36%,11%)" strokeWidth="2" />
              <text x={lx} y={ly - 2} textAnchor="middle" fill="hsl(40,53%,94%)" fontSize="10" fontWeight="700">
                {LANE_LABELS[entry.lane]}
              </text>
              <text x={lx} y={ly + 10} textAnchor="middle" fill={color} fontSize="9" fontWeight="700">
                {entry.wr}% · {entry.games}p
              </text>
            </g>
          );
        })}
      </svg>
      {/* Detalle por línea: solo se muestra en smartphone vertical, debajo del radar. */}
      <ul className="rd-stats-lane-list" aria-hidden="true">
        {data.map(entry => (
          <li key={entry.lane} style={/** @type {any} */ ({ '--rd-lane': /** @type {Record<string, string>} */ (LANE_COLORS)[entry.lane] })}>
            <span>{/** @type {Record<string, string>} */ (LANE_LABELS)[entry.lane]}</span>
            <span className="rd-stats-lane-bar"><span style={{ width: `${entry.wr}%` }} /></span>
            <strong>{entry.wr}%</strong>
            <em>{entry.games}p</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getSampleStatus(total) {
  if (total === 1) return { label: 'Dato inicial', tone: 'text-yellow-300 border-yellow-500/25 bg-yellow-500/10' };
  if (total < 3) return { label: 'Muestra baja', tone: 'text-yellow-300 border-yellow-500/25 bg-yellow-500/10' };
  if (total < 6) return { label: 'Tendencia', tone: 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10' };
  return { label: 'Mayor respaldo', tone: 'text-green-300 border-green-500/25 bg-green-500/10' };
}

function MatchupList({ items, empty, getChampImg, positive = true }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  return (
    <div className="rd-matchup-list space-y-1.5 overflow-hidden">
      {items.map(m => (
        <div key={m.champ} className={`rd-list-row rd-matchup-row ${positive ? 'rd-matchup-row-positive' : 'rd-matchup-row-negative'}`}>
          <ChampionAvatar name={m.champ} src={getChampImg(m.champ)} rounded="rounded" />

          <span className="text-[13px] text-foreground flex-1 truncate">
            {m.champ}
          </span>

          <span className={`rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-wide ${getSampleStatus(m.total).tone}`}>
            {getSampleStatus(m.total).label}
          </span>

          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {m.total} {m.total === 1 ? 'partida' : 'partidas'}
          </span>

          <span className={`text-[13px] font-bold ${positive ? 'text-green-300' : 'text-red-300'}`}>
            {m.wr.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
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

  useEffect(() => {
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
      .then(res => setHasAccess(res.hasAccess === true))
      .catch(() => setHasAccess(false))
      .finally(() => setMembershipLoading(false));
  }, [user]);

  const { data: allMatches = [], isLoading } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email
      ? getUserMatches(user, 1000)
      : [],
    enabled: !!user?.email,
  });

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

  const insightSnapshotKeys = tierlistExecutions
    .filter(execution => (execution.status === 'success' || execution.status === 'partial') && execution.snapshot_key)
    .filter(execution => patchMatchesSelection(execution.patch, patchFilter))
    .slice(0, 5)
    .map(execution => execution.snapshot_key);

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist', insightSnapshotKeys],
    queryFn: () => getTierlistEntries('-ranking_final', 3000, { snapshotKeys: insightSnapshotKeys }),
    enabled: insightSnapshotKeys.length > 0,
  });

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: wrItems = [] } = useQuery({
    queryKey: ['wr-items'],
    queryFn: () => WRItem.list('name'),
  });

  const { data: builds = [] } = useQuery({
    queryKey: ['builds-insights', user?.email],
    queryFn: () => user?.email ? getUserBuilds(user, 1000) : [],
    enabled: !!user?.email,
  });

  const { data: runes = [] } = useQuery({
    queryKey: ['runes'],
    queryFn: () => Rune.list('name'),
  });

  const { data: spells = [] } = useQuery({
    queryKey: ['spells'],
    queryFn: () => Spell.list('name'),
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
  const insightBuilds = filterByPatch(builds, patchFilter);

  if (membershipLoading || isLoading) {
    return (
      <div className="rd-page">
        <div className="rd-card h-40 animate-pulse" />
      </div>
    );
  }

  if (!hasAccess) {
    return <MembershipGate />;
  }

  if (allMatches.length === 0) {
    return (
      <div className="rd-page">
        <PageHeader title="Estadísticas Personales" />
        <div className="rd-card p-6">
          <EmptyState
            icon={BarChart3}
            title="Sin partidas"
            description="Registrá partidas para ver tus estadísticas personales."
          />
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rd-page space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader title="Estadísticas Personales" />
          <div className="flex items-center gap-3 rd-status-pill">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Performance personal</span>
          </div>
        </div>
        <div className="rd-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/70 bg-secondary/20 p-4 sm:flex-row sm:items-end sm:justify-end">
            <label className="min-w-0 flex-1 text-xs text-muted-foreground sm:max-w-64">
              Tipo de partida
              <select
                value={matchTypeFilter}
                onChange={event => setMatchTypeFilter(event.target.value)}
                className="mt-1 w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
              >
                <option value="all">Todas las partidas</option>
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
              title="Sin partidas para estos filtros"
              description="Elegí otro tipo de partida o parche para procesar sus estadísticas e insights."
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

  const avgKDA = (
    matches.reduce((sum, match) => sum + calcMatchKDA(match), 0) / totalMatches
  ).toFixed(2);

  const blueMatches = matches.filter(m => m.side === 'blue');
  const redMatches = matches.filter(m => m.side === 'red');
  const blueWR = calcWR(blueMatches).toFixed(1);
  const redWR = calcWR(redMatches).toFixed(1);
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

  const insights = computeInsights({ matches, tierlist, wrItems, builds: insightBuilds, champions, runes, spells });
  // En smartphone no entran dos consejos legibles: va uno por página.
  const insightsPerPage = isPhoneLandscape || isPhonePortrait ? 1 : 2;
  const coachPageCount = Math.max(1, Math.ceil(insights.length / insightsPerPage));
  const effectiveCoachPage = Math.min(coachPage, coachPageCount - 1);
  const visibleInsights = insights.slice(effectiveCoachPage * insightsPerPage, (effectiveCoachPage + 1) * insightsPerPage);

  return (
    <div className="rd-page rd-dashboard rd-compact-page rd-stats-layout">

      <section className="rd-viewport-section rd-stats-overview space-y-6" aria-label="Resumen de rendimiento">
      <div className="rd-stats-header flex flex-wrap items-start justify-between gap-4">
        <div className="rd-stats-title">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Rift Deck Analytics
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Estadísticas
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Basado en {totalMatches} partidas registradas.
          </p>
        </div>

        <div className="rd-stats-filters flex flex-wrap items-end justify-end gap-3">
          <label className="rd-stats-filter min-w-52 text-xs text-muted-foreground">
            Tipo de partida
            <select
              value={matchTypeFilter}
              onChange={event => setMatchTypeFilter(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-secondary/90 px-3 text-xs font-medium text-foreground outline-none focus:border-primary/40"
            >
              <option value="all">Todas las partidas</option>
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
            <span className="text-xs text-muted-foreground">Performance personal</span>
          </div>
        </div>
      </div>

      </section>

      <div className="rd-panel-tabs" role="tablist" aria-label="Secciones de estadísticas">
        {/* En smartphone vertical las cinco pestañas comparten una fila: nombres cortos. */}
        {[
          ['overview', 'Rendimiento'],
          ['direct', isPhonePortrait ? 'Directos' : 'Matchups directos'],
          ['general', isPhonePortrait ? 'Generales' : 'Matchups generales'],
          ['synergy', 'Sinergias'],
          ...(insights.length ? [['coach', 'Coach']] : []),
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

      {analyticsView === 'overview' && <section className="rd-analytics-panel rd-stats-overview-panel flex min-h-0 flex-col gap-3" aria-label="Rendimiento por campeón y línea">
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
          <SectionCard title="Winrate por campeón" watermark fullHeight>
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
          <SectionCard title="Winrate por línea" fullHeight watermark>
            {laneArr.length > 0 ? (
              <LaneBarChart laneArr={laneArr} />
            ) : (
              <p className="text-muted-foreground text-sm">Sin datos de líneas.</p>
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

      {analyticsView === 'direct' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Matchups directos">
        <div>
          <SectionCard title="Mejores Matchups Directos" fixedHeight>
            <MatchupList
              items={bestMatchups}
              empty="Todavía no hay resultados favorables contra un rival directo."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>
        <div>
          <SectionCard title="Matchups Directos Problemáticos" fixedHeight>
            <MatchupList
              items={worstMatchups}
              empty="Todavía no hay resultados adversos en esta categoría."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>
      </section>}

      {analyticsView === 'general' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Matchups generales">
        <div>
          <SectionCard title="Mejores Matchups Generales" fixedHeight>
            <MatchupList
              items={bestGeneralMatchups}
              empty="Todavía no hay resultados para mostrar en esta categoría."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Peores Matchups Generales" fixedHeight>
            <MatchupList
              items={worstGeneralMatchups}
              empty="Todavía no hay resultados para mostrar en esta categoría."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>

      </section>}

      {analyticsView === 'synergy' && <section className="rd-analytics-panel rd-stats-pair grid grid-cols-1 lg:grid-cols-2 gap-4" aria-label="Sinergias aliadas">

        <div>
          <SectionCard title="Buena Sinergia Aliada" fixedHeight>
            <MatchupList
              items={bestSynergies}
              empty="Todavía no hay resultados favorables con un aliado repetido."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Mala Sinergia Aliada" fixedHeight>
            <MatchupList
              items={worstSynergies}
              empty="Todavía no hay resultados adversos en esta categoría."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>
      </section>}

      {analyticsView === 'coach' && insights.length > 0 && (
        <section className="rd-analytics-panel rd-stats-coach rd-card rd-card-watermark p-5 md:p-7 overflow-hidden" aria-label="Lectura estratégica">
          <div className="rd-stats-coach-header flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <img
                src={COACH_BOOK_URL}
                alt="Libro de Rift Deck Coach"
                className="w-16 md:w-20 h-auto object-contain drop-shadow-[0_0_20px_rgba(212,175,55,0.22)]"
              />
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Sparkles size={15} />
                  <span className="text-[10px] uppercase tracking-[0.24em] font-semibold">Lectura estratégica</span>
                </div>
                <h2 className="font-rajdhani text-2xl font-bold text-foreground">Rift Deck Coach</h2>
                <p className="text-xs text-muted-foreground mt-1">Hipótesis priorizadas para tu próximo bloque de partidas.</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-[11px] text-muted-foreground max-w-sm md:text-right">
                La confianza refleja cuánto respaldo tiene cada consejo en tu historial y en los datos del juego.
              </p>
              {coachPageCount > 1 && (
                <div className="flex items-center gap-2" aria-label="Navegación de consejos">
                  <button
                    type="button"
                    onClick={() => setCoachPage(Math.max(0, effectiveCoachPage - 1))}
                    disabled={effectiveCoachPage === 0}
                    className="rd-arrow h-7 w-7"
                    aria-label="Consejos anteriores"
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
                    aria-label="Consejos siguientes"
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
                    </p>
                    <h3 className="font-rajdhani text-xl font-bold leading-tight text-foreground">{insight.title}</h3>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                    <ShieldCheck size={11} /> {insight.confidenceLabel}
                  </span>
                </div>

                <div className="rd-stats-insight-body mt-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Qué muestran los datos</p>
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

                <div className="rd-stats-insight-action flex items-start gap-2 pt-4 border-t border-border/50 xl:h-[88px] xl:shrink-0">
                  <ArrowRight size={14} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-muted-foreground"><span className="text-foreground font-medium">Consejo:</span> {insight.action}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
