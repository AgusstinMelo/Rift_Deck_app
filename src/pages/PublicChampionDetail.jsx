import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, Sword, Zap } from 'lucide-react';
import { Champion } from '@/api/entitiesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import LaneBadge from '@/components/ui/LaneBadge';
import TierBadge from '@/components/ui/TierBadge';
import { championSlug, findChampionBySlug } from '@/utils/championSlug';
import {
  DAMAGE_LABELS,
  DIFFICULTY_LABELS,
  LANE_IMAGES,
  SCALING_LABELS,
  displayList,
  getChampionLaneLabels,
  getChampionLanes,
} from '@/utils/championPresentation';
import { getChampionSeo } from '@/seo/publicSeo';
import { getCurrentTierlistEntries, getTierEntriesForChampion, normalizeChampionName } from '@/utils/tierlist';
const STAT_LABELS = {
  life: 'Vida', mana: 'Maná/Energía', armor: 'Armadura', magic_res: 'Resistencia mágica',
  attack_damage: 'Daño de ataque', attack_speed: 'Velocidad de ataque', movement: 'Movimiento',
  bonus_attack_speed: 'Velocidad de ataque adicional', life_reg: 'Regeneración de vida', mana_reg: 'Regeneración de maná',
  physic_vamp: 'Vampirismo físico', magic_vamp: 'Vampirismo mágico',
};

const buildChampionSummary = (champion, laneLabels) => {
  const parts = [];
  const role = champion.roles?.toLowerCase();
  if (role && laneLabels.length) {
    parts.push(`${champion.name} es un campeón ${role} de Wild Rift que se juega en ${displayList(laneLabels)}.`);
  } else if (role) {
    parts.push(`${champion.name} es un campeón ${role} de Wild Rift.`);
  } else if (laneLabels.length) {
    parts.push(`${champion.name} es un campeón de Wild Rift disponible en ${displayList(laneLabels)}.`);
  }

  const damage = DAMAGE_LABELS[champion.damage_type];
  const scaling = SCALING_LABELS[champion.scaling]?.toLowerCase();
  if (damage && scaling) parts.push(`Su perfil combina ${damage.toLowerCase()} con escalado de ${scaling}.`);
  else if (damage) parts.push(`Su tipo de daño registrado es ${damage.toLowerCase()}.`);
  else if (scaling) parts.push(`Su escalado está orientado al ${scaling}.`);

  const difficulty = DIFFICULTY_LABELS[champion.difficulty]?.toLowerCase();
  if (difficulty) parts.push(`Su dificultad registrada es ${difficulty}.`);
  return parts.join(' ');
};

function SectionTitle({ children }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <span className="h-px w-6 bg-primary/50" />
      <h2 className="rd-card-title">{children}</h2>
    </div>
  );
}

function StatBar({ label, value, color }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="rd-mini-action">
      <div className="mb-2 flex items-center justify-between">
        <span className="rd-label">{label}</span>
        <span className="text-xs font-bold text-foreground">{value}/3</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map(segment => (
          <span key={segment} className={`h-2 rounded-full ${segment <= Number(value) ? color : 'bg-secondary'}`} />
        ))}
      </div>
    </div>
  );
}

function BaseStatRow({ label, value, suffix = '' }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-3 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}{suffix}</dd>
    </div>
  );
}

const resolveChampionReferences = (references, champions) => {
  if (!Array.isArray(references)) return [];
  const byReference = new Map();
  champions.forEach(candidate => {
    [candidate.id, candidate.external_id, candidate.name, candidate.original_name].filter(Boolean).forEach(reference => {
      byReference.set(String(reference), candidate);
      const normalized = normalizeChampionName(reference);
      if (normalized) byReference.set(normalized, candidate);
    });
  });
  return [...new Map(references.map(reference => {
    const candidate = byReference.get(String(reference)) || byReference.get(normalizeChampionName(reference));
    return candidate ? [candidate.id, candidate] : null;
  }).filter(Boolean)).values()];
};

function MatchupColumn({ title, icon: Icon, iconClass, champions }) {
  return (
    <div className="rd-mini-action">
      <h3 className="mb-3 flex min-h-12 items-center gap-2 font-rajdhani text-lg font-bold uppercase"><Icon size={18} className={`shrink-0 ${iconClass}`} />{title}</h3>
      <div className="space-y-2">
        {champions.length ? champions.map(candidate => (
          <Link key={candidate.id} to={`/campeones/${championSlug(candidate.name)}`} className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-primary/30 hover:bg-secondary/50">
            <img src={candidate.image_url} alt="" width="36" height="36" loading="lazy" className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-sm font-semibold">{candidate.name}</span>
          </Link>
        )) : <p className="px-2 text-sm text-muted-foreground">Sin datos disponibles.</p>}
      </div>
    </div>
  );
}

export default function PublicChampionDetail({ initialChampions, initialExecutions, initialTierlist }) {
  const { slug } = useParams();
  const { data: champions = [], isLoading, isError } = useQuery({
    queryKey: ['public-champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    staleTime: 5 * 60 * 1000,
  });
  const champion = findChampionBySlug(champions, slug);
  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
    initialData: initialExecutions,
    staleTime: 5 * 60 * 1000,
  });
  const currentSnapshotKey = executions.find(execution =>
    execution.status === 'success' || execution.status === 'partial'
  )?.snapshot_key;
  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist', currentSnapshotKey],
    queryFn: () => getTierlistEntries('-updated_at', 1000, { snapshotKey: currentSnapshotKey }),
    initialData: initialTierlist,
    enabled: Boolean(currentSnapshotKey),
    staleTime: 5 * 60 * 1000,
  });
  const currentTierlist = getCurrentTierlistEntries(tierlist, executions);
  const notFound = !isLoading && !isError && !champion;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background"><Seo title="Campeón de Wild Rift | Rift Deck" canonicalPath={`/campeones/${slug}`} indexable={false} /><PublicHeader /><main className="mx-auto max-w-6xl px-5 py-12"><div className="h-80 animate-pulse rounded-2xl border border-border bg-card" /></main></div>
    );
  }

  if (notFound || isError) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Seo title="Campeón no encontrado | Rift Deck" description="La página de campeón solicitada no existe en Rift Deck." canonicalPath={`/campeones/${slug}`} indexable={false} />
        <PublicHeader />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="mt-2 font-rajdhani text-4xl font-bold">Campeón no encontrado</h1>
          <p className="mt-3 text-muted-foreground">No existe un campeón asociado a esta URL.</p>
          <Link to="/campeones" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver campeones</Link>
        </main>
      </div>
    );
  }

  const lanes = getChampionLanes(champion);
  const laneLabels = getChampionLaneLabels(champion);
  const stats = Object.entries(STAT_LABELS).filter(([key]) => champion[key] !== null && champion[key] !== undefined && champion[key] !== '');
  const summary = buildChampionSummary(champion, laneLabels);
  const seo = getChampionSeo(champion, slug, laneLabels, displayList, DAMAGE_LABELS);
  const tierData = getTierEntriesForChampion(champion, currentTierlist);
  const strongAgainst = resolveChampionReferences(champion.strong_against, champions);
  const weakAgainst = resolveChampionReferences(champion.weak_against, champions);
  const synergies = resolveChampionReferences(champion.synergies, champions);
  const relatedChampions = champions
    .filter(candidate => candidate.id !== champion.id)
    .map(candidate => {
      const candidateLanes = getChampionLanes(candidate);
      const sharedLane = candidateLanes.some(lane => lanes.includes(lane));
      const sharedRole = Boolean(champion.roles && candidate.roles === champion.roles);
      return { candidate, score: Number(sharedLane) + Number(sharedRole) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, 6)
    .map(({ candidate }) => candidate);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo {...seo} indexable />
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:py-12">
        <Link to="/campeones" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} /> Todos los campeones</Link>

        <article className="space-y-6">
          <header className="rd-card relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,.18),transparent_35%)] opacity-40" />
            <div className="relative flex flex-col gap-6 p-6 lg:flex-row">
              <div className="shrink-0">
                <img src={champion.image_url_card || champion.image_url} alt={`${champion.name} en Wild Rift`} width="320" height="512" className="h-64 w-40 rounded-3xl border border-primary/20 object-cover object-top shadow-[0_0_30px_rgba(212,175,55,.10)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {lanes.map((lane, index) => LANE_IMAGES[lane] ? (
                    <img key={lane} src={LANE_IMAGES[lane]} alt={laneLabels[index]} title={laneLabels[index]} width="28" height="28" className="h-7 w-7 object-contain" />
                  ) : <span key={lane} className="rd-status-pill">{laneLabels[index]}</span>)}
                  {champion.damage_type && <span className="rd-status-pill">{champion.damage_type}</span>}
                  {champion.attack_range && <span className="rd-status-pill">{champion.attack_range === 'ranged' ? 'Ranged' : 'Melee'}</span>}
                </div>
                <h1 className="font-rajdhani text-5xl font-bold uppercase tracking-[-0.08em] text-foreground">{champion.name}</h1>
                {champion.roles && <p className="mt-1 text-muted-foreground">{champion.roles}</p>}
                <div className="mt-5 border-t border-border/40 pt-4">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {champion.scaling && <div><dt className="rd-label mb-1">Escalado</dt><dd className="font-semibold">{SCALING_LABELS[champion.scaling] || champion.scaling}</dd></div>}
                    {champion.damage_type && <div><dt className="rd-label mb-1">Daño</dt><dd className="font-semibold">{DAMAGE_LABELS[champion.damage_type] || champion.damage_type}</dd></div>}
                  </dl>
                </div>
                {summary && <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{summary}</p>}
              </div>
            </div>
          </header>

          <section className="rd-card p-5">
            <SectionTitle>Perfil del Campeón</SectionTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatBar label="Daño" value={champion.damage} color="bg-red-400" />
              <StatBar label="Supervivencia" value={champion.survive} color="bg-blue-400" />
              <StatBar label="Asistencia" value={champion.assist} color="bg-green-400" />
              <StatBar label="Dificultad" value={champion.difficulty} color="bg-primary" />
            </div>

            {Array.isArray(champion.tags) && champion.tags.length > 0 && (
              <div className="mt-5">
                <p className="rd-label mb-2">Tags</p>
                <ul className="flex flex-wrap gap-2" aria-label={`Características de ${champion.name}`}>
                  {champion.tags.map(tag => <li key={tag} className="rd-status-pill">{tag}</li>)}
                </ul>
              </div>
            )}

            {champion.strategic_notes && (
              <div className="rd-mini-action mt-5 text-center">
                <h3 className="rd-label mb-2">Notas Estratégicas</h3>
                <p className="text-sm leading-relaxed text-foreground">{champion.strategic_notes}</p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rd-card p-5">
              <SectionTitle>Matchups y Sinergias</SectionTitle>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <MatchupColumn title="Fuerte contra" icon={Sword} iconClass="text-green-400" champions={strongAgainst} />
                <MatchupColumn title="Débil contra" icon={Shield} iconClass="text-red-400" champions={weakAgainst} />
                <MatchupColumn title="Mejores sinergias" icon={Zap} iconClass="text-blue-400" champions={synergies} />
              </div>
            </section>

            <aside className="rd-card h-full p-5">
              <SectionTitle>Posición Meta</SectionTitle>
              {tierData.length ? <div className="space-y-4">{tierData.map(entry => (
                <div key={`${entry.lane}-${entry.tier}`} className="rd-mini-action">
                  <div className="mb-4 flex items-center justify-between"><LaneBadge lane={entry.lane} /><TierBadge tier={entry.tier} /></div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    {[['WR', entry.winrate], ['PR', entry.pickrate], ['BR', entry.banrate]].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-secondary/60 p-2"><dt className="rd-label">{label}</dt><dd className="mt-1 font-bold">{Number(value || 0).toFixed(1)}%</dd></div>
                    ))}
                  </dl>
                  <div className="mt-4 border-t border-border/50 pt-3 text-sm text-muted-foreground">
                    <p>Score: <strong className="text-primary">{Number(entry.ranking_final || 0).toFixed(2)}</strong></p>
                    {entry.position_in_lane && <p>#{entry.position_in_lane} en {entry.lane}</p>}
                  </div>
                </div>
              ))}</div> : <p className="text-sm text-muted-foreground">Sin datos para el último cálculo de tierlist.</p>}
            </aside>
          </div>

          {stats.length > 0 && (
            <section className="rd-card p-5">
              <SectionTitle>Estadísticas Base</SectionTitle>
              <dl className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <div>
                  <BaseStatRow label="Vida" value={champion.life} />
                  <BaseStatRow label="Reg. Vida" value={champion.life_reg} />
                  <BaseStatRow label="Maná/Energía" value={champion.mana} />
                  <BaseStatRow label="Reg. Maná" value={champion.mana_reg} />
                  <BaseStatRow label="Movimiento" value={champion.movement} />
                  <BaseStatRow label="Vampirismo físico" value={champion.physic_vamp} />
                </div>
                <div>
                  <BaseStatRow label="Daño de Ataque" value={champion.attack_damage} />
                  <BaseStatRow label="Vel. de Ataque" value={champion.attack_speed} />
                  <BaseStatRow label="Bonus AS" value={champion.bonus_attack_speed} suffix="%" />
                  <BaseStatRow label="Armadura" value={champion.armor} />
                  <BaseStatRow label="Resist. Mágica" value={champion.magic_res} />
                  <BaseStatRow label="Vampirismo mágico" value={champion.magic_vamp} />
                </div>
              </dl>
            </section>
          )}

          {relatedChampions.length > 0 && (
            <section className="rd-card p-5">
              <SectionTitle>Campeones del mismo rol o línea</SectionTitle>
              <p className="mt-1 text-sm text-muted-foreground">Opciones relacionadas por los datos de rol y línea registrados en Rift Deck.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {relatedChampions.map(related => (
                  <Link key={related.id} to={`/campeones/${championSlug(related.name)}`} className="overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40">
                    {related.image_url && <img src={related.image_url} alt={`${related.name} en Wild Rift`} width="160" height="160" loading="lazy" className="aspect-square w-full object-cover" />}
                    <h3 className="p-3 font-rajdhani text-lg font-bold">{related.name}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    </div>
  );
}
