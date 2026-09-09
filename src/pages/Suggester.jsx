import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { suggestWithAI } from '@/api/aiSupabase';
import { useAuth } from '@/lib/AuthContext';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  ChevronDown,
  Brain,
  Target,
  Shield,
  Swords,
  Wand2,
  Crosshair,
  Flame,
  Gauge,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Layers,
  Zap,
} from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import LaneBadge from '@/components/ui/LaneBadge';
import EmptyState from '@/components/ui/EmptyState';
import V2BuildTab from '@/features/buildV2/V2BuildTab';

const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];

const LANE_ALIASES = {
  top: ['top', 'baron', 'solo'],
  jungler: ['jungler', 'jungle', 'jungla'],
  mid: ['mid', 'middle'],
  adc: ['adc', 'dragon', 'duo', 'bottom', 'bot', 'marksman'],
  support: ['support', 'soporte'],
};

const LANE_LABELS = {
  top: 'Top',
  jungler: 'Jungla',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Support',
};

const GOALS = [
  { id: 'ranked', label: 'Subir ranked', icon: Trophy },
  { id: 'expand_pool', label: 'Ampliar pool', icon: Layers },
  { id: 'cover_gaps', label: 'Cubrir debilidades', icon: Shield },
  { id: 'learn_easy', label: 'Pick más simple', icon: Gauge },
  { id: 'aggressive', label: 'Jugar agresivo', icon: Flame },
  { id: 'safe', label: 'Jugar seguro', icon: Compass },
];

const RECOMMENDATION_TYPES = {
  similar: 'Similar a tu pool',
  complementary: 'Complementario',
  meta: 'Meta pick',
  blind_pick: 'Blind pick',
  counter_pool: 'Cubre counters',
  pocket_pick: 'Pocket pick',
};

const PRIORITY_COLORS = {
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  low: 'text-green-400 bg-green-500/10 border-green-500/20',
};

const FINAL_LABELS = {
  highly_recommended: 'Muy recomendado',
  recommended: 'Recomendado',
  situational: 'Situacional',
  learn_different: 'Aprendé otro',
};

const FINAL_COLORS = {
  highly_recommended: 'text-green-400 bg-green-500/10 border-green-500/20',
  recommended: 'text-primary bg-primary/10 border-primary/20',
  situational: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  learn_different: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const DAMAGE_LABELS = {
  AD: 'Daño AD',
  AP: 'Daño AP',
  mixed: 'Mixto',
  true: 'True Damage',
};

const ROLE_ICONS = {
  luchador: Swords,
  tanque: Shield,
  mago: Wand2,
  asesino: Sparkles,
  tirador: Crosshair,
  soporte: Shield,
};

const LANE_STRATEGIC_NEEDS = {
  top: {
    wantsFrontline: true,
    wantsUtility: false,
    allowedRoles: ['luchador', 'tanque', 'asesino', 'mago'],
    description: 'top laners',
  },
  jungler: {
    wantsFrontline: true,
    wantsUtility: true,
    allowedRoles: ['luchador', 'tanque', 'asesino', 'mago'],
    description: 'junglas',
  },
  mid: {
    wantsFrontline: false,
    wantsUtility: true,
    allowedRoles: ['mago', 'asesino', 'luchador', 'tirador'],
    description: 'mid laners',
  },
  adc: {
    wantsFrontline: false,
    wantsUtility: false,
    allowedRoles: ['tirador', 'mago'],
    description: 'AD carries',
  },
  support: {
    wantsFrontline: true,
    wantsUtility: true,
    allowedRoles: ['soporte', 'tanque', 'mago'],
    description: 'supports',
  },
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeText(value = '') {
  return value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeLane(lane = '') {
  const normalized = normalizeText(lane);
  return Object.entries(LANE_ALIASES).find(([, aliases]) =>
    aliases.includes(normalized)
  )?.[0] || normalized;
}

function getChampionImage(champions, name) {
  return champions.find(
    c => c.name?.toLowerCase() === name?.toLowerCase()
  )?.image_url;
}

function getChampionData(champions, name) {
  return champions.find(
    c => c.name?.toLowerCase() === name?.toLowerCase()
  );
}

function getTierEntry(tierlist, name, lane = '') {
  const entries = tierlist.filter(
    t => t.champion_name?.toLowerCase() === name?.toLowerCase()
  );

  if (lane) {
    return entries.find(t => normalizeLane(t.lane) === normalizeLane(lane)) || entries[0];
  }

  return entries[0];
}

function normalizeRole(role = '') {
  return role
    .toString()
    .toLowerCase()
    .split(',')
    .map(r => r.trim())[0];
}

function getChampionLanes(champion) {
  return toArray(champion?.lane || champion?.lanes).map(normalizeLane);
}

function getChampionRoles(champion) {
  return toArray(champion?.roles || champion?.primary_role).map(normalizeRole);
}

function championCanPlayLane(champion, lane, tierlist = []) {
  if (!lane) return true;

  const normalizedLane = normalizeLane(lane);
  const championLanes = getChampionLanes(champion);

  if (championLanes.includes(normalizedLane)) return true;

  return tierlist.some(
    t =>
      t.champion_name?.toLowerCase() === champion?.name?.toLowerCase() &&
      normalizeLane(t.lane) === normalizedLane
  );
}

function calcWR(matches) {
  if (!matches.length) return null;

  const wins = matches.filter(m => m.result === 'win').length;
  return Math.round((wins / matches.length) * 100);
}

function getChampMatchStats(matches, champName) {
  const champMatches = matches.filter(
    m => m.own_champion_name?.toLowerCase() === champName?.toLowerCase()
  );

  return {
    games: champMatches.length,
    wr: calcWR(champMatches),
    wins: champMatches.filter(m => m.result === 'win').length,
  };
}

function buildLocalPoolAnalysis({ pool, champions, matches, tierlist, lane }) {
  const normalizedLane = normalizeLane(lane);
  const laneNeeds = lane
    ? LANE_STRATEGIC_NEEDS[normalizedLane] || null
    : { wantsFrontline: true, wantsUtility: true };
  const poolData = pool
    .map(name => {
      const champ = getChampionData(champions, name);
      const stats = getChampMatchStats(matches, name);
      const tier = getTierEntry(tierlist, name, lane);

      return {
        name,
        champion: champ,
        stats,
        tier,
        damage_type: champ?.damage_type,
        role: normalizeRole(champ?.roles || champ?.primary_role || ''),
        roles: getChampionRoles(champ),
        scaling: champ?.scaling,
        difficulty: champ?.difficulty,
        lanes: getChampionLanes(champ),
      };
    })
    .filter(Boolean);

  const damageTypes = new Set(poolData.map(p => p.damage_type).filter(Boolean));
  const roles = new Set(poolData.map(p => p.role).filter(Boolean));
  const scalings = new Set(poolData.map(p => p.scaling).filter(Boolean));

  const gaps = [];

  if (!damageTypes.has('AP')) {
    gaps.push('Tu pool parece tener poca amenaza AP.');
  }

  if (!damageTypes.has('AD')) {
    gaps.push('Tu pool parece tener poca amenaza AD.');
  }

  if (laneNeeds?.wantsFrontline && !roles.has('tanque')) {
    gaps.push('No aparece un tanque/engage claro en tu pool.');
  }

  if (laneNeeds?.wantsUtility && !roles.has('mago') && !roles.has('soporte')) {
    gaps.push('Podrías sumar más utilidad, control o peel.');
  }

  if (normalizedLane === 'adc' && !roles.has('tirador')) {
    gaps.push('Tu pool de ADC necesita al menos un tirador confiable.');
  }

  if (!scalings.has('earlygame')) {
    gaps.push('Te falta un pick fuerte de early game.');
  }

  if (!scalings.has('lategame')) {
    gaps.push('Te falta un pick confiable de late game.');
  }

  const bestPersonal = [...poolData]
    .filter(p => p.stats.games >= 3 && p.stats.wr !== null)
    .sort((a, b) => b.stats.wr - a.stats.wr || b.stats.games - a.stats.games)[0];

  const weakPersonal = [...poolData]
    .filter(p => p.stats.games >= 3 && p.stats.wr !== null)
    .sort((a, b) => a.stats.wr - b.stats.wr || b.stats.games - a.stats.games)[0];

  const metaOverlap = poolData.filter(p => ['S+', 'S'].includes(p.tier?.tier));

  return {
    poolData,
    gaps,
    bestPersonal,
    weakPersonal,
    metaOverlap,
    damageTypes: [...damageTypes],
    roles: [...roles],
    scalings: [...scalings],
  };
}

function buildRecommendationCandidates({ champions, tierlist, pool, lane }) {
  const poolNames = new Set(pool.map(name => name.toLowerCase()));
  const laneNeeds = LANE_STRATEGIC_NEEDS[normalizeLane(lane)] || null;

  return champions
    .filter(champ => champ?.name && !poolNames.has(champ.name.toLowerCase()))
    .filter(champ => championCanPlayLane(champ, lane, tierlist))
    .filter(champ => {
      if (!laneNeeds?.allowedRoles?.length) return true;
      const roles = getChampionRoles(champ);
      return roles.length === 0 || roles.some(role => laneNeeds.allowedRoles.includes(role));
    })
    .map(champ => {
      const tier = getTierEntry(tierlist, champ.name, lane);

      return {
        name: champ.name,
        lanes: getChampionLanes(champ),
        roles: getChampionRoles(champ),
        damage_type: champ.damage_type,
        scaling: champ.scaling,
        difficulty: champ.difficulty,
        attack_type: champ.attack_type,
        range_type: champ.range_type,
        traits: toArray(champ.traits),
        item_scalings: toArray(champ.item_scalings),
        vulnerabilities: toArray(champ.vulnerabilities),
        strategic_notes: champ.strategic_notes,
        tags: toArray(champ.tags),
        tier: tier?.tier || 'sin tier',
        meta_lane: tier?.lane || null,
        score: tier?.ranking_final || 0,
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name))
    .slice(0, 40);
}

function normalizeRecommendations(recommendations, candidates) {
  const candidateNames = new Set(
    candidates.map(candidate => candidate.name.toLowerCase())
  );

  return (recommendations || [])
    .filter(rec => candidateNames.has(rec.champion_name?.toLowerCase()))
    .slice(0, 5);
}

  function PoolChampionSelect({ champions, pool, onToggle }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
      const close = event => {
        if (!rootRef.current?.contains(event.target)) setOpen(false);
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, []);

    return (
      <div ref={rootRef} className="relative mb-4" style={{ zIndex: open ? 60 : 1 }}>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {pool.length > 0 && <span className="flex shrink-0 -space-x-2">
              {pool.slice(0, 3).map(name => {
                const champion = getChampionData(champions, name);
                return champion?.image_url
                  ? <img key={name} src={champion.image_url} alt="" className="h-7 w-7 rounded-full border-2 border-[#151b28] object-cover" />
                  : <span key={name} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#151b28] bg-secondary text-[10px] font-bold text-primary">{name[0]}</span>;
              })}
            </span>}
            <span className={pool.length ? 'truncate font-medium' : 'truncate text-muted-foreground'}>
              {pool.length ? `${pool.length} ${pool.length === 1 ? 'campeón seleccionado' : 'campeones seleccionados'}` : 'Seleccionar campeones…'}
            </span>
          </span>
          <ChevronDown size={16} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && <div role="listbox" aria-multiselectable="true" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-primary/20 bg-[#0f1420] p-1.5 shadow-2xl shadow-black/60">
          <div className="max-h-80 overflow-y-auto">
            {champions.map(champion => {
              const active = pool.includes(champion.name);
              const roles = getChampionRoles(champion);
              return <button key={champion.id} type="button" role="option" aria-selected={active} onClick={() => onToggle(champion.name)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary ${active ? 'bg-primary/8' : ''}`}>
                {champion.image_url ? <img src={champion.image_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-full border border-primary/20 object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-primary">{champion.name?.[0]}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{champion.name}</span>
                  {roles.length > 0 && <span className="block truncate text-[11px] text-muted-foreground">{roles.join(' · ')}</span>}
                </span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary/50'}`}>
                  {active && <Check size={13} />}
                </span>
              </button>;
            })}
          </div>
        </div>}
      </div>
    );
  }

  function PoolChampionChip({ name, champions, matches, tierlist, onRemove }) {
    const champ = getChampionData(champions, name);
    const imageUrl = getChampionImage(champions, name);
    const stats = getChampMatchStats(matches, name);
    const tier = getTierEntry(tierlist, name);
    const role = normalizeRole(champ?.roles || champ?.primary_role || '');
    const RoleIcon = ROLE_ICONS[role] || Sparkles;

    return (
      <div className="rd-card p-2.5 group">
        <div className="flex items-center gap-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-11 h-11 rounded-xl object-cover border border-primary/15"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm font-bold text-primary">
              {name?.[0]}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-rajdhani font-bold text-lg tracking-[-0.05em] text-foreground truncate">
                {name}
              </p>

              {tier && <TierBadge tier={tier.tier} size="sm" />}
            </div>

            <div className="flex items-center gap-2 mt-1">
              {champ?.lane?.slice?.(0, 2)?.map(l => (
                <LaneBadge key={l} lane={l} />
              ))}

              <span className="text-[10px] text-muted-foreground">
                {stats.games > 0 ? `${stats.wr}% WR · ${stats.games}g` : 'sin datos'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border/50 flex items-center justify-center">
              <RoleIcon size={14} className="text-primary" />
            </div>

            <button
              onClick={() => onRemove(name)}
              className="text-muted-foreground hover:text-red-400 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  function InsightCard({ icon: Icon, title, value, tone = 'primary' }) {
    const toneClass = {
      primary: 'text-primary',
      green: 'text-green-400',
      red: 'text-red-400',
      yellow: 'text-yellow-400',
      accent: 'text-accent',
    }[tone];

    return (
      <div className="rd-mini-action text-left">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={15} className={toneClass} />
          <span className="rd-label">
            {title}
          </span>
        </div>

        <p className={`text-sm font-semibold ${toneClass}`}>
          {value}
        </p>
      </div>
    );
  }

  function StrategicGaps({ gaps }) {
    if (!gaps?.length) {
      return (
        <div className="rd-card p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="rd-card-title mb-1">
                Pool equilibrado
              </p>

              <p className="text-sm text-muted-foreground">
                No se detectan gaps grandes con la información disponible.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rd-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={17} className="text-yellow-400" />
          <h3 className="rd-card-title">
            Gaps detectados
          </h3>
        </div>

        <div className="space-y-2">
          {gaps.slice(0, 5).map((gap, index) => (
            <div
              key={index}
              className="rd-list-row"
            >
              <span className="text-primary">✦</span>
              <p className="text-sm text-foreground">
                {gap}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function RecommendationCard({ rec, champions, tierlist, lane }) {
    const champ = getChampionData(champions, rec.champion_name);
    const imageUrl = getChampionImage(champions, rec.champion_name);
    const tierEntry = getTierEntry(tierlist, rec.champion_name, lane);
    const role = normalizeRole(champ?.roles || champ?.primary_role || '');
    const RoleIcon = ROLE_ICONS[role] || Sparkles;

    return (
      <div className="rd-card p-5 group hover:border-primary/25 transition-all">
        <div className="flex items-start gap-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={rec.champion_name}
              className="
                w-16 h-16 rounded-2xl object-cover shrink-0
                border border-primary/20
                shadow-[0_0_20px_rgba(212,175,55,.08)]
              "
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center shrink-0 text-lg font-bold text-primary">
              {rec.champion_name?.[0]}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-rajdhani font-bold text-2xl tracking-[-0.06em] text-foreground">
                {rec.champion_name}
              </h3>

              {tierEntry && <TierBadge tier={tierEntry.tier} size="sm" />}

              {tierEntry?.lane && <LaneBadge lane={tierEntry.lane} />}
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {rec.final_recommendation && (
                <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${FINAL_COLORS[rec.final_recommendation] || ''}`}>
                  {FINAL_LABELS[rec.final_recommendation] || rec.final_recommendation}
                </span>
              )}

              {rec.priority_level && (
                <span className={`text-xs px-2 py-1 rounded-lg border ${PRIORITY_COLORS[rec.priority_level] || ''}`}>
                  Prioridad {rec.priority_level}
                </span>
              )}

              {rec.recommendation_type && (
                <span className="rd-status-pill text-xs">
                  {RECOMMENDATION_TYPES[rec.recommendation_type] || rec.recommendation_type}
                </span>
              )}
            </div>

            <p className="text-sm text-foreground leading-relaxed">
              {rec.reason}
            </p>
          </div>

          <div className="hidden sm:flex w-9 h-9 rounded-lg bg-secondary/60 border border-border/50 items-center justify-center shrink-0">
            <RoleIcon size={15} className="text-primary" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {rec.strategic_gap && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
              <p className="text-[10px] text-accent uppercase tracking-[0.14em] font-semibold mb-1">
                Gap cubierto
              </p>

              <p className="text-xs text-foreground">
                {rec.strategic_gap}
              </p>
            </div>
          )}

          {rec.when_to_pick && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
              <p className="text-[10px] text-green-400 uppercase tracking-[0.14em] font-semibold mb-1">
                Cuándo pickear
              </p>

              <p className="text-xs text-foreground">
                {rec.when_to_pick}
              </p>
            </div>
          )}

          {rec.adaptation_difficulty && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-[10px] text-primary uppercase tracking-[0.14em] font-semibold mb-1">
                Adaptación
              </p>

              <p className="text-xs text-foreground">
                {rec.adaptation_difficulty}
              </p>
            </div>
          )}

          {rec.first_steps && (
            <div className="bg-secondary/40 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] font-semibold mb-1">
                Primeros pasos
              </p>

              <p className="text-xs text-foreground">
                {rec.first_steps}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
  function LegacySuggester() {
  const [pool, setPool] = useState([]);
  const [context, setContext] = useState('');
  const [lane, setLane] = useState('');
  const [goal, setGoal] = useState('ranked');
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [strategicGaps, setStrategicGaps] = useState([]);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: tierlistExecutions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const currentSnapshotKey = tierlistExecutions.find(execution =>
    execution.status === 'success' || execution.status === 'partial'
  )?.snapshot_key;

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist', currentSnapshotKey],
    queryFn: () => getTierlistEntries('-ranking_final', 1000, { snapshotKey: currentSnapshotKey }),
    enabled: !!currentSnapshotKey,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email
      ? getUserMatches(user, 100)
      : [],
    enabled: !!user?.email,
  });

  const localAnalysis = useMemo(() => {
    return buildLocalPoolAnalysis({
      pool,
      champions,
      matches,
      tierlist,
      lane,
    });
  }, [pool, champions, matches, tierlist, lane]);

  const topTierChamps = useMemo(() => {
    return tierlist
      .filter(t => t.tier === 'S+' || t.tier === 'S')
      .filter(t => !lane || normalizeLane(t.lane) === normalizeLane(lane))
      .slice(0, 24)
      .map(t => ({
        name: t.champion_name,
        lane: t.lane,
        tier: t.tier,
        winrate: t.winrate,
        pickrate: t.pickrate,
        banrate: t.banrate,
        score: t.ranking_final,
      }));
  }, [tierlist, lane]);

  const recommendationCandidates = useMemo(() => {
    return buildRecommendationCandidates({
      champions,
      tierlist,
      pool,
      lane,
    });
  }, [champions, tierlist, pool, lane]);

  const togglePoolChampion = name => {
    setPool(current => current.includes(name)
      ? current.filter(champion => champion !== name)
      : [...current, name]);
  };

  const removeFromPool = (name) => {
    setPool(pool.filter(c => c !== name));
  };

  const handleGenerate = async () => {
    if (pool.length === 0) {
      setError('Agregá al menos un campeón a tu pool.');
      return;
    }

    setError('');
    setGenerating(true);
    setRecommendations([]);
    setStrategicGaps(localAnalysis.gaps || []);

    if (recommendationCandidates.length === 0) {
      setGenerating(false);
      setError('No encontrÃ© candidatos compatibles con esa lÃ­nea y tu pool actual.');
      return;
    }

    const champData = localAnalysis.poolData.map(p => ({
      name: p.name,
      lanes: p.lanes,
      damage_type: p.damage_type,
      role: p.role,
      scaling: p.scaling,
      difficulty: p.difficulty,
      attack_type: p.champion?.attack_type,
      range_type: p.champion?.range_type,
      traits: toArray(p.champion?.traits),
      item_scalings: toArray(p.champion?.item_scalings),
      vulnerabilities: toArray(p.champion?.vulnerabilities),
      strategic_notes: p.champion?.strategic_notes,
      tags: toArray(p.champion?.tags),
      tier: p.tier?.tier || 'sin tier',
      meta_lane: p.tier?.lane || null,
      personal_wr:
        p.stats.wr !== null ? `${p.stats.wr}%` : 'sin datos',
      games_played: p.stats.games,
    }));

    const prompt = `Eres un analista experto de Wild Rift y coaching competitivo. Tu tarea es recomendar campeones de forma útil, accionable y estratégica.

POOL ACTUAL DEL JUGADOR:
${JSON.stringify(champData, null, 2)}

GAPS DETECTADOS LOCALMENTE:
${JSON.stringify(localAnalysis.gaps, null, 2)}

CAMPEONES META ACTUALES S+/S:
${JSON.stringify(topTierChamps, null, 2)}

CANDIDATOS PERMITIDOS PARA RECOMENDAR:
${JSON.stringify(recommendationCandidates, null, 2)}

OBJETIVO DEL JUGADOR:
${goal}

LÍNEA PRIORITARIA:
${lane || 'todas'}

CONTEXTO ADICIONAL:
${context || 'sin contexto'}

Instrucciones:
- Recomienda exclusivamente campeones incluidos en CANDIDATOS PERMITIDOS PARA RECOMENDAR.
- Si hay linea prioritaria, todas las recomendaciones deben ser picks jugables en esa linea.
- No inventes gaps que no correspondan a la linea. Para ADC no recomiendes tanques, frontline ni engage como necesidad principal.
- No recomiendes campeones que ya estén en el pool.
- Da prioridad a picks que cubran gaps reales del pool.
- Considera si el jugador necesita daño AP/AD, engage, frontline, peel, early game, late game, blind pick o facilidad de aprendizaje.
- Si el objetivo es subir ranked, prioriza picks de impacto práctico y curva de aprendizaje razonable.
- Si el objetivo es ampliar pool, prioriza cobertura estratégica.
- Si el objetivo es jugar agresivo, prioriza presión, snowball y kill pressure.
- Si el objetivo es jugar seguro, prioriza estabilidad, utilidad y blind picks.
- Devuelve recomendaciones concretas, no genéricas.
- Incluye cuándo pickearlo y primeros pasos de aprendizaje.
- Sé directo y específico.

Devuelve exactamente 5 recomendaciones.`;

    try {
      const result = await suggestWithAI({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            strategic_gaps: {
              type: 'array',
              items: { type: 'string' },
            },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  champion_name: { type: 'string' },
                  recommendation_type: {
                    type: 'string',
                    enum: [
                      'similar',
                      'complementary',
                      'meta',
                      'blind_pick',
                      'counter_pool',
                      'pocket_pick',
                    ],
                  },
                  reason: { type: 'string' },
                  strategic_gap: { type: 'string' },
                  adaptation_difficulty: { type: 'string' },
                  priority_level: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                  },
                  when_to_pick: { type: 'string' },
                  first_steps: { type: 'string' },
                  final_recommendation: {
                    type: 'string',
                    enum: [
                      'highly_recommended',
                      'recommended',
                      'situational',
                      'learn_different',
                    ],
                  },
                },
              },
            },
          },
        },
      });

      setStrategicGaps(localAnalysis.gaps || []);
      setRecommendations(normalizeRecommendations(result.recommendations, recommendationCandidates));
    } catch (err) {
      setError('No se pudo generar la recomendación. Probá de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Rift Deck Consigliere
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Sugeridor de campeones
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Analizá tu pool, detectá gaps y encontrá picks con sentido competitivo.
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 rd-status-pill">
          <Brain size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            Champion Intelligence
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || pool.length === 0}
          className="
            flex w-full items-center justify-center gap-2 rounded-xl
            bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
            transition-colors hover:bg-primary/90 disabled:cursor-not-allowed
            disabled:opacity-50 sm:w-auto
          "
        >
          {generating ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analizando pool...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Generar recomendaciones
            </>
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-6">
        <div className="space-y-5">
          <div className="rd-card rd-card-overflow-visible p-5 focus-within:z-40">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">
                Tu pool actual
              </h2>
            </div>

            <PoolChampionSelect champions={champions} pool={pool} onToggle={togglePoolChampion} />

            {pool.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-center">
                <Sparkles size={22} className="text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Agregá campeones que jugás regularmente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pool.map(name => (
                  <PoolChampionChip
                    key={name}
                    name={name}
                    champions={champions}
                    matches={matches}
                    tierlist={tierlist}
                    onRemove={removeFromPool}
                  />
                ))}
              </div>
            )}
          </div>
                    <div className="rd-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-px bg-primary/50" />
              <h2 className="rd-card-title">
                Parámetros
              </h2>
            </div>

            <div>
              <label className="rd-label mb-2 block">
                Línea prioritaria
              </label>

              <select
                value={lane}
                onChange={e => setLane(e.target.value)}
                className="
                  w-full bg-secondary/60 border border-border rounded-xl
                  px-3 py-3 text-sm text-foreground
                  outline-none focus:border-primary/40
                "
              >
                <option value="">Todas las líneas</option>
                {LANES.map(l => (
                  <option key={l} value={l}>
                    {LANE_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="rd-label mb-2 block">
                Objetivo
              </label>

              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(item => {
                  const Icon = item.icon;
                  const active = goal === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setGoal(item.id)}
                      className={`
                        flex items-center gap-2 rounded-xl border px-3 py-2.5
                        text-xs font-medium transition-all text-left
                        ${active
                          ? 'bg-primary/15 border-primary/30 text-primary'
                          : 'bg-secondary/40 border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/20'}
                      `}
                    >
                      <Icon size={14} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="rd-label mb-2 block">
                Contexto adicional
              </label>

              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                rows={4}
                placeholder="Ej: soy main Kai’Sa y Xayah, quiero subir ranked, me cuesta jugar contra asesinos..."
                className="
                  w-full bg-secondary/60 border border-border rounded-xl
                  px-3 py-3 text-sm text-foreground
                  placeholder:text-muted-foreground
                  outline-none focus:border-primary/40
                  focus:ring-2 focus:ring-primary/10
                  transition-all resize-none
                "
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InsightCard
              icon={Target}
              title="Pool"
              value={`${pool.length} picks`}
              tone="primary"
            />

            <InsightCard
              icon={Zap}
              title="Meta S/S+"
              value={`${topTierChamps.length} picks`}
              tone="accent"
            />

            <InsightCard
              icon={Shield}
              title="Gaps"
              value={`${localAnalysis.gaps.length}`}
              tone={localAnalysis.gaps.length ? 'yellow' : 'green'}
            />

            <InsightCard
              icon={Trophy}
              title="Meta overlap"
              value={`${localAnalysis.metaOverlap.length}`}
              tone="green"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-red-400 text-sm">
                {error}
              </p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || pool.length === 0}
            className="
              w-full flex items-center justify-center gap-2
              bg-primary text-primary-foreground py-3 rounded-xl
              font-semibold text-sm hover:bg-primary/90
              transition-colors disabled:opacity-50
              disabled:cursor-not-allowed
              shadow-[0_0_28px_rgba(212,175,55,.10)]
            "
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analizando pool...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generar recomendaciones
              </>
            )}
          </button>
        </div>

        <div className="space-y-5">
          {pool.length > 0 && recommendations.length === 0 && !generating && (
            <StrategicGaps gaps={localAnalysis.gaps} />
          )}

          {generating ? (
            <div className="rd-card rd-card-watermark p-10">
              <div className="flex flex-col items-center justify-center min-h-[340px] gap-4 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                  <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                    <Loader2 size={30} className="animate-spin text-primary" />
                  </div>
                </div>

                <div>
                  <h2 className="font-rajdhani font-bold text-3xl tracking-[-0.07em] text-foreground uppercase">
                    Analizando tu pool
                  </h2>

                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Cruzando campeones, gaps estratégicos, meta actual, rendimiento personal y objetivo de juego.
                  </p>
                </div>
              </div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="rd-card p-8">
              <EmptyState
                icon={Sparkles}
                title="Sin recomendaciones aún"
                description="Agregá campeones a tu pool, elegí un objetivo y generá sugerencias personalizadas."
              />
            </div>
          ) : (
            <>
              <StrategicGaps gaps={strategicGaps} />

              <div className="rd-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-px bg-primary/50" />
                      <h2 className="rd-card-title">
                        Recomendaciones
                      </h2>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Picks ordenados por impacto estratégico y utilidad para tu pool.
                    </p>
                  </div>

                  <span className="rd-status-pill">
                    {recommendations.length} picks
                  </span>
                </div>

                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <RecommendationCard
                      key={`${rec.champion_name}-${i}`}
                      rec={rec}
                      champions={champions}
                      tierlist={tierlist}
                      lane={lane}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {pool.length > 0 && (
            <div className="rd-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-px bg-primary/50" />
                <h2 className="rd-card-title">
                  Lectura rápida del pool
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rd-mini-action text-left">
                  <p className="rd-label mb-2">
                    Daños cubiertos
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {localAnalysis.damageTypes.length > 0 ? (
                      localAnalysis.damageTypes.map(type => (
                        <span key={type} className="rd-status-pill text-xs">
                          {DAMAGE_LABELS[type] || type}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sin datos
                      </span>
                    )}
                  </div>
                </div>

                <div className="rd-mini-action text-left">
                  <p className="rd-label mb-2">
                    Roles detectados
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {localAnalysis.roles.length > 0 ? (
                      localAnalysis.roles.map(role => (
                        <span key={role} className="rd-status-pill text-xs">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sin datos
                      </span>
                    )}
                  </div>
                </div>

                <div className="rd-mini-action text-left">
                  <p className="rd-label mb-2">
                    Escalado
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {localAnalysis.scalings.length > 0 ? (
                      localAnalysis.scalings.map(scaling => (
                        <span key={scaling} className="rd-status-pill text-xs">
                          {scaling}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sin datos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(localAnalysis.bestPersonal || localAnalysis.weakPersonal) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {localAnalysis.bestPersonal && (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-green-400 uppercase tracking-[0.14em] font-semibold mb-1">
                        Mejor rendimiento personal
                      </p>

                      <p className="text-sm text-foreground">
                        {localAnalysis.bestPersonal.name} · {localAnalysis.bestPersonal.stats.wr}% WR en {localAnalysis.bestPersonal.stats.games} partidas.
                      </p>
                    </div>
                  )}

                  {localAnalysis.weakPersonal && (
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-red-400 uppercase tracking-[0.14em] font-semibold mb-1">
                        Pick a revisar
                      </p>

                      <p className="text-sm text-foreground">
                        {localAnalysis.weakPersonal.name} · {localAnalysis.weakPersonal.stats.wr}% WR en {localAnalysis.weakPersonal.stats.games} partidas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Suggester() {
  const [activeTab, setActiveTab] = useState('v2');
  return (
    <div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-5">
        <div className="inline-flex rounded-xl border border-border bg-secondary/40 p-1">
          <button type="button" onClick={() => setActiveTab('legacy')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'legacy' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Campeones</button>
          <button type="button" onClick={() => setActiveTab('v2')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'v2' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Builds</button>
        </div>
      </div>
      {activeTab === 'legacy' ? <LegacySuggester /> : <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6"><V2BuildTab /></div>}
    </div>
  );
}
