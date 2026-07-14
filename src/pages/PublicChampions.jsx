import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Champion } from '@/api/entitiesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import TierBadge from '@/components/ui/TierBadge';
import { championSlug } from '@/utils/championSlug';
import { CHAMPIONS_SEO } from '@/seo/publicSeo';
import { getBestTierForChampion, getCurrentTierlistEntries } from '@/utils/tierlist';

const LANE_FILTERS = {
  top: ['top', 'toplane'],
  jungle: ['jungle', 'jungler'],
  mid: ['mid', 'midlane'],
  adc: ['adc', 'dragonline', 'dragonlane', 'bot', 'botlane'],
  support: ['support'],
};

const normalizeLane = lane => String(lane || '').toLowerCase().replace(/[^a-z]/g, '');

export default function PublicChampions({ initialChampions, initialExecutions, initialTierlist }) {
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const { data: champions = [], isLoading, isError } = useQuery({
    queryKey: ['public-champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    staleTime: 5 * 60 * 1000,
  });
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
  const filtered = champions.filter(champion => {
    const matchesSearch = !search || champion.name.toLowerCase().includes(search.toLowerCase());
    const lanes = Array.isArray(champion.lane) ? champion.lane : [champion.lane];
    const matchesLane = laneFilter === 'all' || lanes.some(lane =>
      (LANE_FILTERS[laneFilter] || [laneFilter]).some(value => normalizeLane(lane).includes(value))
    );
    const matchesRole = roleFilter === 'all' || champion.roles?.toLowerCase().includes(roleFilter.toLowerCase());
    const matchesDifficulty = diffFilter === 'all' || String(champion.difficulty) === diffFilter;
    return matchesSearch && matchesLane && matchesRole && matchesDifficulty;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo {...CHAMPIONS_SEO} indexable />
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1800px] px-3 py-8 md:px-5 md:py-10">
        <header className="mb-6 max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.26em] text-primary">Biblioteca pública</p>
          <h1 className="font-rajdhani text-4xl font-bold uppercase tracking-tight md:text-5xl">Campeones de Wild Rift</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Explorá los roles, líneas y estadísticas base registradas para cada campeón en Rift Deck.
          </p>
        </header>

        <div className="rd-card mb-2 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Buscar campeón</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar campeón..." className="w-full rounded-xl border border-border bg-secondary/60 py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
            </label>
            <select value={laneFilter} onChange={event => setLaneFilter(event.target.value)} aria-label="Filtrar por línea" className="rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="all">Todas las líneas</option><option value="top">Top</option><option value="jungle">Jungle</option><option value="mid">Mid</option><option value="adc">ADC</option><option value="support">Support</option>
            </select>
            <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Filtrar por rol" className="rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="all">Todos los roles</option><option value="Luchador">Luchador</option><option value="Tanque">Tanque</option><option value="Mago">Mago</option><option value="Asesino">Asesino</option><option value="Tirador">Tirador</option><option value="Soporte">Soporte</option>
            </select>
            <select value={diffFilter} onChange={event => setDiffFilter(event.target.value)} aria-label="Filtrar por dificultad" className="rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40">
              <option value="all">Dificultad</option><option value="1">Fácil</option><option value="2">Media</option><option value="3">Difícil</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14">
            {Array.from({ length: 28 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded-lg border border-border bg-card" />)}
          </div>
        ) : isError ? (
          <div className="rd-card p-6 text-sm text-red-400">No se pudo cargar el listado de campeones.</div>
        ) : filtered.length === 0 ? (
          <div className="rd-card py-14 text-center"><Search className="mx-auto mb-3 text-muted-foreground" /><p className="font-semibold">Sin resultados</p><p className="mt-1 text-sm text-muted-foreground">Probá con otros filtros o buscá otro campeón.</p></div>
        ) : (
          <section aria-label="Listado de campeones" className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14">
            {filtered.map((champion, index) => {
              const tier = getBestTierForChampion(champion, currentTierlist);
              return (
                <article key={champion.id} className="aspect-square overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-primary/5">
                  <Link to={`/campeones/${championSlug(champion.name)}`} aria-label={`Ver información de ${champion.name}`} title={champion.name} className="group relative block h-full">
                    {champion.image_url ? (
                      <img src={champion.image_url} alt={`${champion.name} en Wild Rift`} width="160" height="160" loading={index < 14 ? 'eager' : 'lazy'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary text-lg font-bold text-primary">{champion.name?.[0]}</div>
                    )}
                    {tier && <span className="absolute right-0.5 top-0.5"><TierBadge tier={tier.tier} size="sm" /></span>}
                  </Link>
                </article>
              );
            })}
          </section>
        )}
        {!isLoading && !isError && <p className="mt-4 text-xs text-muted-foreground">{filtered.length} campeones encontrados</p>}
      </main>
    </div>
  );
}
