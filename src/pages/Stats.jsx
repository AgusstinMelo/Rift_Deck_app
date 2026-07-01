import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem, Rune, Spell } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { useAuth } from '@/lib/AuthContext';
import { BarChart3, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { computeInsights } from '@/hooks/useInsights';
import MembershipGate from '@/components/membership/MembershipGate';
import { getMyMembership } from '@/api/membershipSupabase';
import { MATCH_TYPES } from '@/constants/matchTypes';
import PatchFilter from '@/components/filters/PatchFilter';
import { filterByPatch, patchMatchesSelection } from '@/utils/patches';

const STATS_MEMBERSHIP_GATE_ENABLED = false;

function calcWR(matches) {
  const wins = matches.filter(m => m.result === 'win').length;
  return matches.length > 0 ? (wins / matches.length) * 100 : 0;
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

  return {
    score,
    grade: getPoolGrade(score),
    label: `${score}/100`,
    tone: getPoolTone(score),
  };
}

function HeroStat({ label, value, sub, tone }) {
  return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 border-b lg:border-b-0">
      <p className="rd-label mb-5">{label}</p>
      <p className={`font-rajdhani font-bold text-5xl md:text-4xl tracking-[-0.08em] ${tone}`}>
        {value}
      </p>
      {sub && (
        <p className="text-sm text-muted-foreground mt-3">{sub}</p>
      )}
    </div>
  );
}

function StatsHeroCard({ winrate, wins, losses, avgKDA, kdaLine, blueWR, redWR, blueWins, blueLosses, redWins, redLosses, champImageUrl, poolScore }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border min-h-[280px]"
    style={{
      background: `
        radial-gradient(circle at 18% 0%, rgba(74, 222, 128, 0.08), transparent 32%),
        radial-gradient(circle at 85% 15%, rgba(96, 165, 250, 0.08), transparent 35%),
        linear-gradient(135deg, hsl(222,36%,13%) 0%, hsl(222,36%,9%) 100%)
      `,
    }}>
      {champImageUrl && (
        <>
          <div className="absolute inset-y-0 left-0 h-full pointer-events-none overflow-visible">
            <div
              className="relative h-full w-fit overflow-hidden"
              style={{
                WebkitMaskImage:
                  window.innerWidth >= 768
                    ? 'linear-gradient(to right, black 0%, black 80%, transparent 100%)'
                    : 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
                maskImage:
                  window.innerWidth >= 768
                    ? 'linear-gradient(to right, black 0%, black 80%, transparent 100%)'
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
                    ? 'brightness(0.72) saturate(1.2)'
                    : 'brightness(0.55) saturate(1.1) opacity(0.25)',

              }}
            />
            <div
              className="
                absolute inset-y-0 right-0 w-20
                bg-gradient-to-l from-[hsl(222,36%,9%)] via-[hsl(222,36%,9%)]/75 to-transparent
              "
            />
            </div>
          </div>
        </>
      )}

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(300px,400px)_1fr_1fr_1fr_1fr] min-h-[280px]">
        <div className="flex flex-col items-center justify-center py-6 px-8 md:translate-x-10">
          <div className="relative w-44 h-44 flex items-center justify-center">
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

            <span className="relative font-rajdhani font-bold text-3xl text-green-400 tracking-[-0.08em]">
              {winrate.toFixed(1)}%
            </span>
          </div>

          <p className="rd-label mt-5 text-center">WINRATE GENERAL</p>
          <p className="text-lg text-foreground mt-1">{wins}W - {losses}L</p>
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

function SectionCard({ title, children, watermark = false, fixedHeight = false, fullHeight = false }) {
  return (
    <div className={`rd-card p-5 flex flex-col ${fixedHeight ? 'h-[350px]' : ''} ${fullHeight ? 'h-full' : ''} ${watermark ? 'rd-card-watermark' : ''}`}>
      <h2 className="rd-card-title mb-4 shrink-0">{title}</h2>
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
    if (champ.games >= 4 && champ.wr >= 50) return 'ring-green-400';
    if (champ.games >= 2 && champ.wr >= 45) return 'ring-yellow-400';
    return 'ring-red-400';
  };

  // Pack-placement: itera intentando colocar cada burbuja sin salirse
  // y con mínima superposición. Orden asimétrico por diseño.
  const CONTAINER_W = 280;
  const CONTAINER_H = 260;
  const CONTAINER_PADDING = 4;
  const MIN_R = 15;
  const MAX_R = 64;
  const MIN_VISIBLE_R = 12;

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
    <SectionCard title="Pool de campeones" watermark>
      <div className="min-h-[320px] flex flex-col">
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground">
            Diversidad del pool:{' '}
            <span className={`font-bold ${diversityTone}`}>
              {diversityLabel}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {champArr.length} campeones usados
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden rounded-xl">
          <div
            className="relative shrink-0"
            style={{
              width: `${CONTAINER_W}px`,
              height: `${CONTAINER_H}px`,
            }}
          >
          {bubbles.map(({ champ, r, cx, cy }) => (
            <div
              key={champ.name}
              className={`absolute rounded-full overflow-hidden bg-secondary ring-2 ${getRingColor(champ)} shadow-lg shadow-black/40`}
              style={{
                width: `${r * 2}px`,
                height: `${r * 2}px`,
                left: `${cx - r}px`,
                top: `${cy - r}px`,
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
      </div>
    </SectionCard>
  );
}

const LANE_LABELS = {
  top: 'Top',
  jungler: 'Jungla',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Supp',
};

const LANE_TICK_COLORS = {
  top: '#4FC3F7',
  jungler: '#B388FF',
  mid: '#2EE6A6',
  adc: '#FF6B6B',
  support: '#FFC857',
};

const LANE_ICONS = {
  top:     'https://media.base44.com/images/public/6a0005628d71002f05120013/abe747f2d_top.png',
  jungler: 'https://media.base44.com/images/public/6a0005628d71002f05120013/0b50ba53f_jungle.png',
  mid:     'https://media.base44.com/images/public/6a0005628d71002f05120013/9b1932129_mid.png',
  adc:     'https://media.base44.com/images/public/6a0005628d71002f05120013/798004bb6_adc.png',
  support: 'https://media.base44.com/images/public/6a0005628d71002f05120013/3e7bd0424_support.png',
};

const LANE_COLORS = {
  top: '#4FC3F7', jungler: '#B388FF', mid: '#2EE6A6', adc: '#FF6B6B', support: '#FFC857',
};

function LaneBarChart({ laneArr }) {
  return (
    <div className="flex flex-col justify-between h-full gap-3">
      {laneArr.map(entry => {
        const color = LANE_COLORS[entry.lane] || 'hsl(43,65%,58%)';
        const icon = LANE_ICONS[entry.lane];
        const label = LANE_LABELS[entry.lane] || entry.lane;
        return (
          <div key={entry.lane} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-[68px] shrink-0">
              {icon && <img src={icon} alt={label} className="w-5 h-5 shrink-0" />}
              <span className="text-xs text-muted-foreground font-semibold">{label}</span>
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className="h-5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${entry.wr}%`, background: color }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground pl-1">{entry.games} partidas</span>
            </div>
            <span className="text-xs font-bold w-9 text-right" style={{ color }}>
              {entry.wr}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MatchupList({ items, empty, getChampImg, positive = true }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{empty}</p>;
  }

  return (
    <div className="space-y-2 overflow-hidden">
      {items.map(m => (
        <div key={m.champ} className="rd-list-row">
          <ChampionAvatar name={m.champ} src={getChampImg(m.champ)} rounded="rounded" />

          <span className="text-sm text-foreground flex-1 truncate">
            {m.champ}
          </span>

          <span className="text-xs text-muted-foreground">
            {m.total}g
          </span>

          <span className={`text-sm font-bold ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {m.wr.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const { user } = useAuth();
  const [matchTypeFilter, setMatchTypeFilter] = useState('all');
  const [patchFilter, setPatchFilter] = useState('');
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
      <div className="w-full max-w-none mx-0 p-5 md:p-6">
        <div className="rd-card h-40 animate-pulse" />
      </div>
    );
  }

  if (!hasAccess) {
    return <MembershipGate />;
  }

  if (allMatches.length === 0) {
    return (
      <div className="w-full max-w-none mx-0 p-5 md:p-6">
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
      <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title="Estadísticas Personales" />
          <div className="flex flex-col items-stretch sm:items-end gap-3">
            <div className="flex items-center gap-3 rd-status-pill">
              <BarChart3 size={16} className="text-primary" />
              <span className="text-xs text-muted-foreground">Performance personal</span>
            </div>
            <label className="min-w-64 text-xs text-muted-foreground">
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
              onChange={setPatchFilter}
              patches={allMatches.map(match => match.patch)}
              className="min-w-64"
            />
          </div>
        </div>
        <div className="rd-card p-6">
          <EmptyState
            icon={BarChart3}
            title="Sin partidas para estos filtros"
            description="Elegí otro tipo de partida o parche para procesar sus estadísticas e insights."
          />
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

  const avgKDA = totalDeaths > 0
    ? ((totalKills + totalAssists) / totalDeaths).toFixed(2)
    : '∞';

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
    .filter(([, v]) => v.total >= 3)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestMatchups = [...matchupArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.wr - a.wr)
    .slice(0, 5);

  const worstMatchups = [...matchupArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => a.wr - b.wr)
    .slice(0, 5);

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
    .filter(([, v]) => v.total >= 3)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestSynergies = [...synergyArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.wr - a.wr)
    .slice(0, 5);

  const worstSynergies = [...synergyArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => a.wr - b.wr)
    .slice(0, 5);

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
    .filter(([, v]) => v.total > 3)
    .map(([champ, v]) => ({
      champ,
      wr: (v.wins / v.total) * 100,
      total: v.total,
    }));

  const bestGeneralMatchups = [...generalMatchupArr]
    .filter(m => m.wr > 50)
    .sort((a, b) => b.wr - a.wr)
    .slice(0, 5);

  const worstGeneralMatchups = [...generalMatchupArr]
    .filter(m => m.wr < 50)
    .sort((a, b) => a.wr - b.wr)
    .slice(0, 5);

  const insights = computeInsights({ matches, tierlist, wrItems, builds: insightBuilds, champions, runes, spells });

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
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

        <div className="flex flex-col items-stretch sm:items-end gap-3">
          <div className="flex items-center gap-3 rd-status-pill">
            <BarChart3 size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Performance personal</span>
          </div>
          <label className="min-w-64 text-xs text-muted-foreground">
            Procesar estadísticas de
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
            onChange={setPatchFilter}
            patches={allMatches.map(match => match.patch)}
            className="min-w-64"
          />
        </div>
      </div>

      {totalMatches < 10 && (
        <div className="rd-card p-4 flex items-start gap-3 border-yellow-500/20">
          <AlertCircle size={18} className="text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Pocos datos. Los resultados pueden no ser estadísticamente confiables todavía.
          </p>
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        <div className="lg:col-span-2 flex flex-col">
          <SectionCard title="Winrate por campeón" watermark fullHeight>
            <div className="space-y-3">
              {champArr.slice(0, 5).map(c => {
                const tone =
                  c.wr >= 55 ? 'text-green-400' :
                  c.wr >= 45 ? 'text-primary' :
                  'text-red-400';

                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <ChampionAvatar name={c.name} src={getChampImg(c.name)} rounded="rounded-lg" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {c.name}
                        </span>

                        <span className={`text-xs font-bold ${tone}`}>
                          {c.wr.toFixed(0)}%
                        </span>
                      </div>

                      <WRBar value={c.wr} />

                      <span className="text-xs text-muted-foreground">
                        {c.games} partidas
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <SectionCard title="Winrate por línea" fullHeight>
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

        <div className="lg:col-span-3">
          <SectionCard title="Mejores Matchups Directos" fixedHeight>
            <MatchupList
              items={bestMatchups}
              empty="Necesitás al menos 3 partidas contra el mismo campeón."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
          <SectionCard title="Matchups Directos Problemáticos" fixedHeight>
            <MatchupList
              items={worstMatchups}
              empty="Necesitás más partidas para detectar patrones."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
          <SectionCard title="Mejores Matchups Generales" fixedHeight>
            <MatchupList
              items={bestGeneralMatchups}
              empty="Necesitás más de 3 partidas contra el mismo campeón enemigo."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
          <SectionCard title="Peores Matchups Generales" fixedHeight>
            <MatchupList
              items={worstGeneralMatchups}
              empty="Necesitás más de 3 partidas contra el mismo campeón enemigo."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
          <SectionCard title="Buena Sinergia Aliada" fixedHeight>
            <MatchupList
              items={bestSynergies}
              empty="Necesitás al menos 3 partidas con el mismo aliado."
              getChampImg={getChampImg}
              positive
            />
          </SectionCard>
        </div>

        <div className="lg:col-span-3">
          <SectionCard title="Mala Sinergia Aliada" fixedHeight>
            <MatchupList
              items={worstSynergies}
              empty="Necesitás más partidas para detectar patrones."
              getChampImg={getChampImg}
              positive={false}
            />
          </SectionCard>
        </div>
      </div>

      {insights.length > 0 && (
        <section className="rd-card rd-card-watermark p-5 md:p-7 overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
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
            <p className="text-[11px] text-muted-foreground max-w-sm md:text-right">
              La confianza mide evidencia, no certeza. Cada tarjeta propone algo que podés validar.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {insights.map((insight, i) => (
              <article key={insight.id} className={`relative flex flex-col rounded-2xl border p-5 overflow-hidden ${insightTone[insight.tone] || insightTone.neutral}`}>
                <div className={`absolute inset-y-0 left-0 w-1 ${insightAccent[insight.tone] || insightAccent.neutral}`} />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                      {String(i + 1).padStart(2, '0')} · {insight.domain}
                    </p>
                    <h3 className="font-rajdhani text-xl font-bold leading-tight text-foreground">{insight.title}</h3>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
                    <ShieldCheck size={11} /> {insight.confidenceLabel}
                  </span>
                </div>

                <div className="mt-1">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">Qué muestran los datos</p>
                  <p className="text-sm text-foreground/85 leading-relaxed">{insight.thesis}</p>
                </div>

                {insight.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {insight.evidence.map(item => (
                      <span key={item} className="rounded-md bg-background/45 border border-border/50 px-2 py-1 text-[11px] text-muted-foreground">{item}</span>
                    ))}
                  </div>
                )}

                <div className="min-h-4 flex-1" aria-hidden="true" />

                <div className="flex items-start gap-2 pt-4 border-t border-border/50 xl:h-[88px] xl:shrink-0">
                  <ArrowRight size={14} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed text-muted-foreground"><span className="text-foreground font-medium">Cómo validarlo:</span> {insight.action}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
