// Tarjetas y secciones de la página de Estadísticas.
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';
import { labels } from '@/i18n/uiI18n';
import { getKdaTone, getWrTone, getSampleStatus } from '@/components/stats/statsHelpers';

export function HeroStat({ label, value, sub, tone }) {
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

export function StatsHeroCard({ winrate, wins, losses, avgKDA, kdaLine, blueWR, redWR, blueWins, blueLosses, redWins, redLosses, champImageUrl, poolScore }) {
  const t = useT();
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
          <p className="rd-label mb-1 text-center">{t('stats.winrateGeneral')}</p>
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
              {winrate.toFixed(0)}%
            </span>
          </div>

          <p className="mt-1.5 text-xs text-muted-foreground">{wins}W - {losses}L</p>
        </div>

        <div className="contents lg:[&>*]:-translate-x-8">
          <HeroStat label={t('stats.kdaProm')} value={avgKDA} sub={kdaLine} tone={getKdaTone(avgKDA)} />

          <HeroStat
            label={t('stats.wrLadoAzul')}
            value={blueWR ? `${blueWR}%` : '—'}
            sub={`${blueWins}W - ${blueLosses}L`}
            tone={getWrTone(blueWR)}
          />

          <HeroStat
            label={t('stats.wrLadoRojo')}
            value={redWR ? `${redWR}%` : '—'}
            sub={`${redWins}W - ${redLosses}L`}
            tone={getWrTone(redWR)}
          />
          
          <HeroStat
            label={t('stats.poolScore')}
            value={poolScore.grade}
            sub={poolScore.label}
            tone={poolScore.tone}
          />

        </div>
      </div>
    </div>
  );
}

export function ChampionAvatar({ name, src, rounded = 'rounded-full' }) {
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

export function WRBar({ value }) {
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

export function SectionCard({ title, children, watermark = false, fixedHeight = false, fullHeight = false, headerExtra = null }) {
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

export function PoolChampionsCard({ champArr, getChampImg, poolScore }) {
  const t = useT();
  const totalGames = champArr.reduce((s, c) => s + c.games, 0) || 1;

  const diversityLabel =
    poolScore.score >= 70 ? t('stats.buena') :
    poolScore.score >= 50 ? t('library.media') :
    t('bugReport.severity.baja');

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
      title={t('stats.poolDeCampeones')}
      watermark
      headerExtra={(
        <div className="text-right leading-tight">
          <p className="text-[11px] text-muted-foreground">
           {t('stats.diversidad')} <span className={`font-bold ${diversityTone}`}>{diversityLabel}</span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{champArr.length} {t('stats.campeonesUsados')}</p>
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
              title={t('stats.pWr', { name: champ.name, games: champ.games, value: champ.wr.toFixed(0) })}
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
export function OverviewTrack({ children }) {
  const t = useT();
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
        aria-label={t('stats.tarjetasAnteriores')}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        disabled={!edges.next}
        className="rd-arrow rd-stats-track-arrow rd-stats-track-arrow-next"
        aria-label={t('stats.tarjetasSiguientes')}
      >
        <ChevronRight size={16} />
      </button>
    </>
  );
}

export const LANE_LABELS = labels({
  top: 'lanes.top',
  jungler: 'lanes.jungler',
  mid: 'lanes.mid',
  adc: 'lanes.adc',
  support: 'stats.supportShort',
});

export const LANE_COLORS = {
  top: '#4FC3F7', jungler: '#B388FF', mid: '#2EE6A6', adc: '#FF6B6B', support: '#FFC857',
};

export function LaneBarChart({ laneArr }) {
  const t = useT();
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
      <svg viewBox="0 0 300 210" className="rd-stats-lane-chart h-full max-h-[276px] w-full" role="img" aria-label={t('stats.winratePorLinea')}>
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

export function MatchupList({ items, empty, getChampImg, positive = true }) {
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
