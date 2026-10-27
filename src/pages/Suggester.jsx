import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Champion } from '@/api/entitiesSupabase';
import { getUserMatches } from '@/api/matchesSupabase';
import { getCurrentTierlist } from '@/api/tierlistSupabase';
import { suggestWithAI } from '@/api/aiSupabase';
import { useAuth } from '@/lib/AuthContext';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
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
import StepNav from '@/components/suggester/StepNav';
import SuggesterUsageNotice from '@/components/suggester/SuggesterUsageNotice';
import { useSuggesterUsage } from '@/hooks/useSuggesterUsage';
import { useCloseOnOutside, useFloatingPanel } from '@/hooks/useFloatingPanel';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';

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

const PRIORITY_LABELS = { high: 'alta', medium: 'media', low: 'baja' };

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
    const buttonRef = useRef(null);
    const panelRef = useRef(null);
    const panelStyle = useFloatingPanel(open, buttonRef, 380);
    const [query, setQuery] = useState('');
    const normalizedQuery = normalizeText(query.trim());
    const filtered = normalizedQuery
      ? champions.filter(champion => normalizeText(champion.name).includes(normalizedQuery))
      : champions;

    useCloseOnOutside(open, [buttonRef, panelRef], () => { setOpen(false); setQuery(''); });

    return (
      <div className="relative mb-3">
        <button ref={buttonRef} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)} className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border border-border/70 bg-secondary/55 px-3 py-2 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/30 focus:border-primary/50">
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

        {open && panelStyle && createPortal(<div ref={panelRef} role="listbox" aria-multiselectable="true" style={panelStyle} className="flex flex-col overflow-hidden rounded-xl border border-primary/20 bg-[#0f1420] shadow-2xl shadow-black/60">
          <div className="shrink-0 border-b border-border/70 bg-[#0f1420] p-2">
            <div className="flex items-center gap-2 rounded-lg bg-secondary/70 px-2.5">
              <Search size={14} className="text-muted-foreground" />
              <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar campeón…" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {!filtered.length && <p className="px-3 py-5 text-center text-sm text-muted-foreground">No se encontraron campeones.</p>}
            {filtered.map(champion => {
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
        </div>, document.body)}
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
      <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/25 px-2.5 py-1.5">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-8 w-8 shrink-0 rounded-lg border border-primary/15 object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-bold text-primary">{name?.[0]}</div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {tier && <TierBadge tier={tier.tier} size="sm" />}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {stats.games > 0 ? `${stats.wr}% WR · ${stats.games} partidas` : 'Sin partidas registradas'}
          </p>
        </div>

        <RoleIcon size={14} className="shrink-0 text-primary/80" />
        <button type="button" onClick={() => onRemove(name)} aria-label={`Quitar ${name} del pool`} className="shrink-0 text-muted-foreground transition-colors hover:text-red-400">
          <X size={13} />
        </button>
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

  function StrategicGaps({ gaps, bare = false }) {
    const frame = bare ? '' : 'rd-card p-4';
    if (!gaps?.length) {
      return (
        <div className={frame}>
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
      <div className={frame}>
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

  function RecommendationCard({ rec, champions, tierlist, lane, bare = false }) {
    const champ = getChampionData(champions, rec.champion_name);
    const imageUrl = getChampionImage(champions, rec.champion_name);
    const tierEntry = getTierEntry(tierlist, rec.champion_name, lane);
    const role = normalizeRole(champ?.roles || champ?.primary_role || '');
    const RoleIcon = ROLE_ICONS[role] || Sparkles;

    return (
      <div className={`flex h-full flex-col ${bare ? '' : 'rd-card p-5 group hover:border-primary/25 transition-all'}`}>
        <div className="flex items-start gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt={rec.champion_name} className="h-12 w-12 shrink-0 rounded-xl border border-primary/20 object-cover shadow-[0_0_20px_rgba(212,175,55,.08)]" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-lg font-bold text-primary">{rec.champion_name?.[0]}</div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <h3 className="mr-1 font-rajdhani text-xl font-bold tracking-[-0.06em] text-foreground">{rec.champion_name}</h3>
              {tierEntry && <TierBadge tier={tierEntry.tier} size="sm" />}
              {tierEntry?.lane && <LaneBadge lane={tierEntry.lane} />}
              <RoleIcon size={14} className="text-primary/80" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {rec.final_recommendation && (
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${FINAL_COLORS[rec.final_recommendation] || ''}`}>{FINAL_LABELS[rec.final_recommendation] || rec.final_recommendation}</span>
              )}
              {rec.priority_level && (
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${PRIORITY_COLORS[rec.priority_level] || ''}`}>Prioridad {PRIORITY_LABELS[rec.priority_level] || rec.priority_level}</span>
              )}
              {rec.recommendation_type && (
                <span className="rounded-md border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">{RECOMMENDATION_TYPES[rec.recommendation_type] || rec.recommendation_type}</span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-[13px] leading-snug text-foreground">{rec.reason}</p>

        <div className="mt-3 grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          {[
            ['Gap cubierto', rec.strategic_gap, 'border-accent/20 bg-accent/5', 'text-accent'],
            ['Cuándo pickear', rec.when_to_pick, 'border-green-500/20 bg-green-500/5', 'text-green-400'],
            ['Adaptación', rec.adaptation_difficulty, 'border-primary/20 bg-primary/5', 'text-primary'],
            ['Primeros pasos', rec.first_steps, 'border-border/60 bg-secondary/40', 'text-muted-foreground'],
          ].filter(([, text]) => text).map(([title, text, frame, tone]) => (
            <div key={title} className={`rounded-xl border px-3 py-2 ${frame}`}>
              <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>{title}</p>
              <p className="text-xs leading-snug text-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
const LEGACY_STEPS = ['Pool', 'Parámetros'];
// En smartphone el asistente ocupa el viewport y las sugerencias son un paso más.
const LEGACY_RESULT_STEP = LEGACY_STEPS.length;

  function LegacySuggester({ tabSelector }) {
  const [pool, setPool] = useState([]);
  const [context, setContext] = useState('');
  const [lane, setLane] = useState('');
  const [goal, setGoal] = useState('ranked');
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [strategicGaps, setStrategicGaps] = useState([]);
  const [error, setError] = useState('');
  const usage = useSuggesterUsage('champions');
  const [step, setStep] = useState(0);
  const [view, setView] = useState('recs');
  const [selectedRec, setSelectedRec] = useState(0);
  const { user } = useAuth();
  // En smartphone (horizontal o vertical) el asistente ocupa el viewport y el resultado es un paso más.
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY);
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY);
  const isPhone = isPhoneLandscape || isPhonePortrait;
  const steps = isPhone ? [...LEGACY_STEPS, 'Sugerencias'] : LEGACY_STEPS;
  const viewStep = Math.min(step, steps.length - 1);
  const onResultStep = viewStep === LEGACY_RESULT_STEP;

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist-current'],
    queryFn: getCurrentTierlist,
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

    if (isPhone) setStep(LEGACY_RESULT_STEP);
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
      setView('recs');
      setSelectedRec(0);
    } catch (err) {
      setError(err?.kind === 'usage_limit' ? err.message : 'No se pudo generar la recomendación. Probá de nuevo.');
    } finally {
      setGenerating(false);
      usage.refresh();
    }
  };

  const hasPool = pool.length > 0;
  const hasRecommendations = recommendations.length > 0;
  const currentView = view === 'recs' && !hasRecommendations ? 'gaps' : view;
  const selected = recommendations[selectedRec] || recommendations[0];
  const resultViews = [
    ...(hasRecommendations ? [{ id: 'recs', label: `Recomendaciones (${recommendations.length})` }] : []),
    { id: 'gaps', label: 'Gaps estratégicos' },
    { id: 'pool', label: 'Lectura del pool' },
  ];

  return (
    <div className="rd-v2-build">
      <header className="rd-v2-build-header flex items-start justify-between gap-4">
        <div>
          <div className="rd-page-kicker mb-1 flex items-center gap-2">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Rift Deck Consigliere</span>
          </div>
          <h1 className="rd-page-title font-rajdhani text-4xl font-bold uppercase tracking-[-0.08em] text-foreground md:text-5xl">Sugeridor de campeones</h1>
          <p className="rd-page-subtitle mt-1 text-sm text-muted-foreground">Analizá tu pool, detectá gaps y encontrá picks con sentido competitivo.</p>
          {tabSelector}
        </div>
        <div className="rd-status-pill hidden items-center gap-3 sm:flex">
          <Brain size={16} className="text-primary" />
          <span className="text-xs text-muted-foreground">Champion Intelligence</span>
        </div>
      </header>

      <div className={`rd-v2-build-body grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)] ${onResultStep ? 'rd-v2-result-step' : ''}`}>
        <aside className="rd-v2-build-aside xl:sticky xl:top-6">
          <StepNav steps={steps} label="Pasos del análisis" step={viewStep} completed={[hasPool, hasRecommendations, hasRecommendations]} locked={!hasPool} onStep={setStep} />

          <div className="rd-v2-build-aside-scroll">
            {viewStep === 0 && (
              <section className="rd-card rd-card-overflow-visible rd-v2-step-card flex flex-col p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Target size={15} className="text-primary" />
                  <h2 className="rd-card-title">Tu pool actual</h2>
                </div>

                <PoolChampionSelect champions={champions} pool={pool} onToggle={togglePoolChampion} />

                {hasPool ? (
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                    {pool.map(name => (
                      <PoolChampionChip key={name} name={name} champions={champions} matches={matches} tierlist={tierlist} onRemove={removeFromPool} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-secondary/30 p-4 text-center">
                    <Sparkles size={22} className="mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">Agregá los campeones que jugás regularmente para analizar tu pool.</p>
                  </div>
                )}
              </section>
            )}

            {viewStep === 1 && (
              <section className="rd-card rd-v2-step-card flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Compass size={15} className="text-primary" />
                  <h2 className="rd-card-title">Parámetros</h2>
                </div>

                <div>
                  <label className="rd-label mb-1.5 block">Línea prioritaria</label>
                  <select value={lane} onChange={e => setLane(e.target.value)} className="w-full rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40">
                    <option value="">Todas las líneas</option>
                    {LANES.map(l => <option key={l} value={l}>{LANE_LABELS[l]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="rd-label mb-1.5 block">Objetivo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {GOALS.map(item => {
                      const Icon = item.icon;
                      const active = goal === item.id;
                      return (
                        <button key={item.id} type="button" onClick={() => setGoal(item.id)} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-all ${active ? 'border-primary/30 bg-primary/15 text-primary' : 'border-border/60 bg-secondary/40 text-muted-foreground hover:border-primary/20 hover:text-foreground'}`}>
                          <Icon size={14} className="shrink-0" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-1 flex-col">
                  <label className="rd-label mb-1.5 block">Contexto adicional</label>
                  <textarea value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="Ej: soy main Kai’Sa y Xayah, quiero subir ranked, me cuesta jugar contra asesinos..." className="min-h-[4.5rem] w-full flex-1 resize-none rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                </div>
              </section>
            )}
          </div>

          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</p>}

          <SuggesterUsageNotice usage={usage} />

          <div className="flex gap-2">
            {viewStep > 0 && <button type="button" onClick={() => setStep(viewStep - 1)} className="flex items-center justify-center gap-1 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ChevronLeft size={16} />Atrás</button>}
            {viewStep < LEGACY_STEPS.length - 1
              ? <button type="button" onClick={() => setStep(viewStep + 1)} disabled={!hasPool} title={hasPool ? undefined : 'Agregá al menos un campeón a tu pool'} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40">Siguiente<ChevronRight size={16} /></button>
              : <button type="button" onClick={handleGenerate} disabled={generating || !hasPool || usage.remaining === 0} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{generating ? 'Analizando pool…' : onResultStep ? 'Volver a generar' : 'Generar recomendaciones'}</button>}
          </div>
        </aside>

        <div className="rd-v2-build-result">
          <main className="rd-v2-build-success flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InsightCard icon={Target} title="Pool" value={`${pool.length} picks`} tone="primary" />
              <InsightCard icon={Zap} title="Meta S/S+" value={`${topTierChamps.length} picks`} tone="accent" />
              <InsightCard icon={Shield} title="Gaps" value={`${localAnalysis.gaps.length}`} tone={localAnalysis.gaps.length ? 'yellow' : 'green'} />
              <InsightCard icon={Trophy} title="Meta overlap" value={`${localAnalysis.metaOverlap.length}`} tone="green" />
            </div>

            <section className="rd-card rd-v2-build-analysis flex min-h-[360px] flex-col p-4">
              {generating ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                    <Loader2 size={30} className="animate-spin text-primary" />
                  </div>
                  <h2 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.07em] text-foreground">Analizando tu pool</h2>
                  <p className="max-w-md text-sm text-muted-foreground">Cruzando campeones, gaps estratégicos, meta actual, rendimiento personal y objetivo de juego.</p>
                </div>
              ) : !hasPool && !hasRecommendations ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState icon={Sparkles} title="Sin recomendaciones aún" description="Agregá campeones a tu pool, elegí un objetivo y generá sugerencias personalizadas." />
                </div>
              ) : (
                <>
                  <div role="tablist" className="mb-2.5 flex shrink-0 flex-wrap gap-1 self-start rounded-xl border border-border bg-secondary/40 p-1">
                    {resultViews.map(({ id, label }) => <button key={id} type="button" role="tab" aria-selected={currentView === id} onClick={() => setView(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${currentView === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
                  </div>

                  <div role="tabpanel" className="rd-v2-build-analysis-body text-sm text-muted-foreground">
                    {currentView === 'recs' && selected && (
                      <div className="rd-rec-layout grid min-h-full gap-3 md:grid-cols-[12.5rem_minmax(0,1fr)]">
                        <ol className="space-y-1.5">
                          {recommendations.map((rec, index) => {
                            const imageUrl = getChampionImage(champions, rec.champion_name);
                            const active = rec === selected;
                            return (
                              <li key={`${rec.champion_name}-${index}`}>
                                <button type="button" onClick={() => setSelectedRec(index)} className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${active ? 'border-primary/40 bg-primary/10' : 'border-border/50 bg-secondary/20 hover:border-primary/25'}`}>
                                  {imageUrl ? <img src={imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-primary/20 object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">{rec.champion_name?.[0]}</span>}
                                  <span className="min-w-0 flex-1">
                                    <span className={`block truncate text-sm font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{rec.champion_name}</span>
                                    <span className="block truncate text-[11px] text-muted-foreground">{FINAL_LABELS[rec.final_recommendation] || RECOMMENDATION_TYPES[rec.recommendation_type] || 'Recomendado'}</span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                        <div className="rounded-xl border border-border/50 bg-secondary/10 p-3">
                          <RecommendationCard bare rec={selected} champions={champions} tierlist={tierlist} lane={lane} />
                        </div>
                      </div>
                    )}

                    {currentView === 'gaps' && <StrategicGaps bare gaps={hasRecommendations ? strategicGaps : localAnalysis.gaps} />}

                    {currentView === 'pool' && (hasPool ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          {[
                            ['Daños cubiertos', localAnalysis.damageTypes.map(type => DAMAGE_LABELS[type] || type)],
                            ['Roles detectados', localAnalysis.roles],
                            ['Escalado', localAnalysis.scalings],
                          ].map(([title, values]) => (
                            <div key={title} className="rd-mini-action text-left">
                              <p className="rd-label mb-2">{title}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {values.length > 0
                                  ? values.map(value => <span key={value} className="rd-status-pill text-xs">{value}</span>)
                                  : <span className="text-xs text-muted-foreground">Sin datos</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {(localAnalysis.bestPersonal || localAnalysis.weakPersonal) && (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {localAnalysis.bestPersonal && (
                              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-green-400">Mejor rendimiento personal</p>
                                <p className="text-sm text-foreground">{localAnalysis.bestPersonal.name} · {localAnalysis.bestPersonal.stats.wr}% WR en {localAnalysis.bestPersonal.stats.games} partidas.</p>
                              </div>
                            )}
                            {localAnalysis.weakPersonal && (
                              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-400">Pick a revisar</p>
                                <p className="text-sm text-foreground">{localAnalysis.weakPersonal.name} · {localAnalysis.weakPersonal.stats.wr}% WR en {localAnalysis.weakPersonal.stats.games} partidas.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : <p>Agregá campeones a tu pool para ver su lectura.</p>)}
                  </div>
                </>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Suggester() {
  const [activeTab, setActiveTab] = useState('v2');
  const tabSelector = (
    <div className="mt-4 inline-flex rounded-xl border border-border bg-secondary/40 p-1">
      <button type="button" onClick={() => setActiveTab('v2')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'v2' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Builds</button>
      <button type="button" onClick={() => setActiveTab('legacy')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'legacy' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Campeones</button>
    </div>
  );

  return (
    <div className="rd-page rd-v2-build-page">
      {activeTab === 'legacy' ? <LegacySuggester tabSelector={tabSelector} /> : <V2BuildTab tabSelector={tabSelector} />}
    </div>
  );
}
