import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';
import { useMatchMedia } from '@/hooks/useMatchMedia';

// Sin tildes, espacios ni signos: "kaisa" encuentra a Kai'Sa y "leesin" a Lee Sin.
const normalizeName = (value) =>
  String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const initialOf = (champ) => normalizeName(champ.name)[0]?.toUpperCase() || '#';

const TILE_SIZES = {
  sm: { tile: 'w-12 h-12', fallback: 'text-xs font-bold text-primary' },
  lg: { tile: 'w-16 h-16', fallback: 'text-sm font-bold text-primary text-center px-1' },
};

/**
 * Buscador + grilla de campeones en orden alfabético. Al costado de cada fila va una
 * referencia con las iniciales que contiene; las filas se miden después del render porque
 * la cantidad de columnas depende del ancho. La barra A–Z salta a la primera fila de esa letra.
 * En escritorio el buscador toma el foco y Enter elige el primer resultado no seleccionado.
 * Devuelve un fragmento: el CSS de los pools espera buscador y grilla como hijos directos.
 */
export default function ChampionGrid({ champions, isSelected, onPick, size = 'sm', gridClassName = '' }) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [rowLabels, setRowLabels] = useState([]);
  const [activeLetter, setActiveLetter] = useState(null);
  const gridRef = useRef(null);
  const inputRef = useRef(null);
  const finePointer = useMatchMedia('(pointer: fine)');
  const sizes = TILE_SIZES[size];

  // En táctil no se enfoca: abriría el teclado y taparía la grilla.
  useEffect(() => {
    if (finePointer) inputRef.current?.focus({ preventScroll: true });
  }, [finePointer]);

  const visibleChampions = useMemo(() => {
    const query = normalizeName(search);
    return [...champions]
      .filter(champ => !query || normalizeName(champ.name).includes(query))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [champions, search]);

  const letters = useMemo(
    () => [...new Set(champions.map(initialOf))].sort(),
    [champions],
  );

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const measure = () => {
      const rows = new Map();
      grid.querySelectorAll('[data-initial]').forEach(tile => {
        const top = tile.offsetTop;
        if (!rows.has(top)) rows.set(top, { top, height: tile.offsetHeight, letters: [] });
        const row = rows.get(top);
        if (!row.letters.includes(tile.dataset.initial)) row.letters.push(tile.dataset.initial);
      });
      const next = [...rows.values()];
      setRowLabels(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [visibleChampions]);

  const jumpTo = (letter) => {
    const grid = gridRef.current;
    const target = grid?.querySelector(`[data-initial="${letter}"]`);
    if (!grid || !target) return;
    setActiveLetter(letter);
    grid.scrollTo({ top: target.offsetTop,behavior: 'smooth' });
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const first = visibleChampions.find(champ => !isSelected(champ));
    if (!first) return;
    onPick(first);
    setSearch('');
  };

  return (
    <>
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('common.searchChampionPlaceholder')}
          className="w-full bg-secondary/70 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary/40 transition-all"
        />
      </div>
      {!search && letters.length > 1 && (
        <div className="mb-2 flex w-full">
          {letters.map(letter => (
            <button
              key={letter}
              type="button"
              onClick={() => jumpTo(letter)}
              className={`min-w-0 flex-1 rounded py-0.5 font-rajdhani text-xs font-bold hover:bg-primary/10 hover:text-primary transition-colors
                ${letter === activeLetter ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {letter}
            </button>
          ))}
        </div>
      )}
      {/* position inline: la clase "relative" la toma el CSS del pool para el buscador. */}
      <div ref={gridRef} style={{ position: 'relative' }} className={`grid gap-2 overflow-y-auto pl-4 pr-1 ${gridClassName}`}>
        {rowLabels.map(row => (
          <span
            key={row.top}
            aria-hidden="true"
            style={{ top: row.top, height: row.height }}
            className="pointer-events-none absolute left-0 flex w-3 flex-col items-center justify-center text-[9px] font-semibold leading-tight text-muted-foreground/70"
          >
            {row.letters.map(letter => (
              <span key={letter} className={letter === activeLetter ? 'text-primary' : undefined}>{letter}</span>
            ))}
          </span>
        ))}
        {visibleChampions.map(champ => {
          const selected = isSelected(champ);
          return (
            <button
              key={champ.id || champ.name}
              type="button"
              data-initial={initialOf(champ)}
              onClick={() => onPick(champ)}
              title={champ.name}
              className={`${sizes.tile} rounded-lg border-2 flex items-center justify-center transition-all overflow-hidden
                ${selected ? 'border-primary ring-2 ring-primary/50' : 'border-border/40 hover:border-primary/50'}`}
            >
              {champ.image_url
                ? <img src={champ.image_url} alt={champ.name} className="w-full h-full object-cover" />
                : <span className={sizes.fallback}>{size === 'lg' ? champ.name : champ.name?.[0]}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
