import { useState } from 'react';
import { Search } from 'lucide-react';
import TierBadge from '@/components/ui/TierBadge';
import { getBestTierForChampion } from '@/utils/tierlist';

export default function ChampionPicker({ champions, tierlist, onSelect }) {
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');

  const LANES = ['top', 'jungler', 'mid', 'adc', 'support'];

  const filtered = champions.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const ADC_ALIASES = ['adc', 'dragonlane', 'bot'];
    const matchLane = laneFilter === 'all' || (c.lane || []).some(l => {
      const lLower = l.toLowerCase();
      if (laneFilter === 'adc') return ADC_ALIASES.some(alias => lLower.includes(alias));
      return lLower.includes(laneFilter.toLowerCase());
    });
    return matchSearch && matchLane;
  });

  const getTier = (champion) => {
    return getBestTierForChampion(champion, tierlist);
  };

  return (
    <div className="w-full max-w-none mx-0 overflow-x-hidden p-5 md:p-6">
      <div className="flex items-center gap-2 mb-1"><span className="w-8 h-px bg-primary/50" /><span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">Calculadora de Builds</span></div>
      <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase mb-1">Seleccionar Campeón</h1>
      <p className="text-muted-foreground text-sm mb-5">Elegí el campeón para crear la build</p>

      <div className="rd-card p-3 mb-5 w-full max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center w-full min-w-0">
          <div className="relative w-full sm:flex-1 min-w-0">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campeón..."
              className="w-full min-w-0 bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-all"
            />
          </div>

          <div className="w-full sm:w-auto min-w-0">
            <div className="grid grid-cols-3 sm:flex sm:w-auto gap-1 bg-secondary/40 border border-border/50 p-1 rounded-xl">
              <button
                onClick={() => setLaneFilter('all')}
                className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  laneFilter === 'all'
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos
              </button>

              {LANES.map(l => (
                <button
                  key={l}
                  onClick={() => setLaneFilter(l)}
                  className={`w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    laneFilter === l
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12 xl:grid-cols-14 gap-1.5 w-full max-w-full min-w-0">
        {filtered.map(champ => {
          const tier = getTier(champ);
          return (
            <button key={champ.id} onClick={() => onSelect(champ)}
              className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:bg-primary/5 transition-all group aspect-square relative">
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

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-muted-foreground">No se encontraron campeones</p>
        </div>
      )}
    </div>
  );
}
