import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Champion } from '@/api/entitiesSupabase';
import { getCurrentTierlist } from '@/api/tierlistSupabase';
import { Search } from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import EmptyState from '@/components/ui/EmptyState';
import ChampionDetail from './ChampionDetail';
import { PHONE_PORTRAIT_QUERY, useMatchMedia } from '@/hooks/useMatchMedia';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';
import { championSlug, findChampionBySlug } from '@/utils/championSlug';
import { getChampionLanes } from '@/utils/championPresentation';
import {
  getBestTierForChampion,
  getCurrentTierlistEntries,
  getTierEntriesForChampion,
} from '@/utils/tierlist';

const DAMAGE_COLORS = {
  AD: 'text-orange-400 bg-orange-500/10',
  AP: 'text-purple-400 bg-purple-500/10',
  mixed: 'text-yellow-400 bg-yellow-500/10',
  true: 'text-blue-400 bg-blue-500/10',
};

const LANE_FILTERS = {
  top: ['top', 'toplane'],
  jungle: ['jungle', 'jungler'],
  mid: ['mid', 'midlane'],
  adc: ['adc', 'dragonline', 'dragonlane', 'bot', 'botlane'],
  support: ['support'],
};

const normalizeLane = (lane) =>
  String(lane || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

// Modo público (publicBasePath): la selección viene del slug de la URL, las tarjetas son
// enlaces y los datos iniciales llegan prerenderizados (initialChampions / initialTierlist).
export default function ChampionLibrary({
  selectedId,
  selectedSlug,
  onSelectId,
  onClearSelected,
  initialChampions,
  initialTierlist,
  publicBasePath,
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [selected, setSelected] = useState(() => selectedSlug ? findChampionBySlug(initialChampions, selectedSlug) : null);
  // En smartphone vertical buscador y tres selectores van en una fila: textos cortos.
  const compactFilters = useMatchMedia(PHONE_PORTRAIT_QUERY, { ssrSafe: Boolean(publicBasePath) });

  const { data: champions = [], isLoading } = useQuery({
    queryKey: [publicBasePath ? 'public-champions' : 'champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    ...(publicBasePath ? publicCatalogQueryOptions : {}),
  });

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist-current'],
    queryFn: getCurrentTierlist,
    initialData: initialTierlist,
    ...(publicBasePath ? publicCatalogQueryOptions : {}),
  });

  useEffect(() => {
    if (!selectedId && !selectedSlug) {
      setSelected(null);
      return;
    }

    const nextSelected = selectedSlug
      ? findChampionBySlug(champions, selectedSlug)
      : champions.find(champ => String(champ.id) === String(selectedId));
    if (nextSelected) {
      setSelected(nextSelected);
    }
  }, [champions, selectedId, selectedSlug]);

  const filtered = champions.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const championLanes = Array.isArray(c.lane) ? c.lane : [c.lane];
    const matchLane = laneFilter === 'all' || championLanes.some(lane => {
      const normalizedLane = normalizeLane(lane);
      return (LANE_FILTERS[laneFilter] || [laneFilter]).some(value => normalizedLane.includes(value));
    });
    const matchRole = roleFilter === 'all' || c.roles?.toLowerCase().includes(roleFilter.toLowerCase());
    const matchDiff = diffFilter === 'all' || String(c.difficulty) === diffFilter;
    return matchSearch && matchLane && matchRole && matchDiff;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const currentTierlist = getCurrentTierlistEntries(tierlist);

  if (selected) {
    const tierData = getTierEntriesForChampion(selected, currentTierlist);

    if (publicBasePath) {
      const lanes = getChampionLanes(selected);
      const relatedChampions = champions
        .filter(candidate => candidate.id !== selected.id)
        .map(candidate => {
          const sharedLane = getChampionLanes(candidate).some(lane => lanes.includes(lane));
          const sharedRole = Boolean(selected.roles && candidate.roles === selected.roles);
          return { candidate, score: Number(sharedLane) + Number(sharedRole) };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
        .slice(0, 6)
        .map(({ candidate }) => candidate);

      return (
        <ChampionDetail
          champion={selected}
          champions={champions}
          tierData={tierData}
          relatedChampions={relatedChampions}
          publicMode
          onBack={() => navigate(publicBasePath)}
        />
      );
    }

    return (
      <ChampionDetail
        champion={selected}
        tierData={tierData}
        onBack={() => {
          setSelected(null);
          onClearSelected?.();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* FILTERS */}
      <div className="rd-library-filters rd-card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={compactFilters ? 'Buscar' : 'Buscar campeón...'}
              aria-label="Buscar campeón"
              className="
                w-full bg-secondary/60 border border-border rounded-xl
                pl-10 pr-4 py-2.5 text-sm text-foreground
                placeholder:text-muted-foreground outline-none
                focus:border-primary/40 focus:ring-2 focus:ring-primary/10
                transition-all
              "
            />
          </div>

          <select
            value={laneFilter}
            onChange={e => setLaneFilter(e.target.value)}
            className="bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40"
          >
            <option value="all">{compactFilters ? 'Línea' : 'Todas las líneas'}</option>
            <option value="top">Top</option>
            <option value="jungle">Jungle</option>
            <option value="mid">Mid</option>
            <option value="adc">ADC</option>
            <option value="support">Support</option>
          </select>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40"
          >
            <option value="all">{compactFilters ? 'Rol' : 'Todos los roles'}</option>
            <option value="Luchador">Luchador</option>
            <option value="Tanque">Tanque</option>
            <option value="Mago">Mago</option>
            <option value="Asesino">Asesino</option>
            <option value="Tirador">Tirador</option>
            <option value="Soporte">Soporte</option>
          </select>

          <select
            value={diffFilter}
            onChange={e => setDiffFilter(e.target.value)}
            className="bg-secondary/60 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40"
          >
            <option value="all">Dificultad</option>
            <option value="1">Fácil</option>
            <option value="2">Media</option>
            <option value="3">Difícil</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" description="Probá con otros filtros o buscá otro campeón." />
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14 gap-1.5">
          {filtered.map((champ, index) => {
            const tier = getBestTierForChampion(champ, currentTierlist);
            const Card = publicBasePath ? Link : 'button';
            return (
              <Card
                key={champ.id}
                {...(publicBasePath
                  ? { to: `${publicBasePath}/${championSlug(champ.name)}`, title: champ.name }
                  : { onClick: () => {
                    setSelected(champ);
                    onSelectId?.(champ.id);
                  } })}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:bg-primary/5 transition-all group aspect-square relative block"
              >
                {champ.image_url
                  ? <img
                      src={champ.image_url}
                      alt={publicBasePath ? `${champ.name} en Wild Rift` : champ.name}
                      width="160"
                      height="160"
                      loading={index < 14 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary bg-secondary">{champ.name[0]}</div>}
                {tier && (
                  <div className="absolute top-0.5 right-0.5">
                    <TierBadge tier={tier.tier} size="sm" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs mt-4">{filtered.length} campeones encontrados</p>
    </div>
  );
}
