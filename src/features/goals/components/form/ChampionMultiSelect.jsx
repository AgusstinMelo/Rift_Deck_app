import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { GOAL_LIMITS } from '../../model/goalConstants';
import { INPUT_CLASS } from '../goalUi';

const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Selector múltiple de campeones con búsqueda.
 * @param {{ options: any[], value: { id?: string|null, name: string }[], onChange: (value: { id?: string|null, name: string }[]) => void, disabled?: boolean }} props
 */
export default function ChampionMultiSelect({ options, value, onChange, disabled = false }) {
  const [search, setSearch] = useState('');
  const selectedNames = new Set(value.map(champion => normalize(champion.name)));
  const full = value.length >= GOAL_LIMITS.MAX_CHAMPIONS;

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    return options.filter(option => !query || normalize(option.name).includes(query)).slice(0, 60);
  }, [options, search]);

  const toggle = champion => {
    if (selectedNames.has(normalize(champion.name))) {
      onChange(value.filter(selected => normalize(selected.name) !== normalize(champion.name)));
    } else if (!full) {
      onChange([...value, { id: champion.id ? String(champion.id) : null, name: champion.name }]);
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(champion => (
            <span key={champion.name} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary">
              {champion.name}
              {!disabled && (
                <button type="button" onClick={() => toggle(champion)} aria-label={`Quitar ${champion.name}`} className="hover:text-foreground">
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar campeón..."
              className={`${INPUT_CLASS} pl-9`}
              aria-label="Buscar campeón"
            />
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-10">
            {filtered.map(champion => {
              const selected = selectedNames.has(normalize(champion.name));
              return (
                <button
                  key={champion.id || champion.name}
                  type="button"
                  onClick={() => toggle(champion)}
                  title={champion.name}
                  aria-pressed={selected}
                  disabled={!selected && full}
                  className={`aspect-square overflow-hidden rounded-lg border-2 transition-all disabled:opacity-40 ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-border/40 hover:border-primary/50'}`}
                >
                  {champion.image_url
                    ? <img src={champion.image_url} alt={champion.name} className="h-full w-full object-cover" />
                    : <span className="text-xs font-bold text-primary">{champion.name?.[0]}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
