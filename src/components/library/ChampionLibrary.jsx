import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion } from '@/api/entitiesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import { Search } from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import EmptyState from '@/components/ui/EmptyState';
import ChampionDetail from './ChampionDetail';
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

export default function ChampionLibrary({ selectedId, onSelectId, onClearSelected }) {
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: champions = [], isLoading } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const currentSnapshotKey = executions.find(execution =>
    execution.status === 'success' || execution.status === 'partial'
  )?.snapshot_key;

  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist', currentSnapshotKey],
    queryFn: () => getTierlistEntries('-updated_at', 1000, { snapshotKey: currentSnapshotKey }),
    enabled: !!currentSnapshotKey,
  });

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    const nextSelected = champions.find(champ => String(champ.id) === String(selectedId));
    if (nextSelected) {
      setSelected(nextSelected);
    }
  }, [champions, selectedId]);

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

  const currentTierlist = getCurrentTierlistEntries(tierlist, executions);

  if (selected) {
    const tierData = getTierEntriesForChampion(selected, currentTierlist);

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
    <div>
      {/* FILTERS */}
      <div className="rd-card p-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campeón..."
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
            <option value="all">Todas las líneas</option>
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
            <option value="all">Todos los roles</option>
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
          {filtered.map(champ => {
            const tier = getBestTierForChampion(champ, currentTierlist);
            return (
              <button
                key={champ.id}
                onClick={() => {
                  setSelected(champ);
                  onSelectId?.(champ.id);
                }}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:bg-primary/5 transition-all group aspect-square relative"
              >
                {champ.image_url
                  ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-primary bg-secondary">{champ.name[0]}</div>}
                {tier && (
                  <div className="absolute top-0.5 right-0.5">
                    <TierBadge tier={tier.tier} size="sm" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs mt-4">{filtered.length} campeones encontrados</p>
    </div>
  );
}
