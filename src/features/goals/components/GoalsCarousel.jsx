import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GoalCard from './GoalCard';

const ARROW_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/70 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed';

/** Rango de tarjetas visibles (1-based) dentro del carril. */
function visibleRange(track) {
  const cards = [...track.children];
  const left = track.scrollLeft;
  const right = left + track.clientWidth;
  const visible = cards
    .map((card, index) => ({ index, start: card.offsetLeft, end: card.offsetLeft + card.clientWidth }))
    .filter(card => card.end > left + 8 && card.start < right - 8);
  if (visible.length === 0) return { first: 0, last: 0 };
  return { first: visible[0].index + 1, last: visible[visible.length - 1].index + 1 };
}

/**
 * Carril horizontal de objetivos: ocupa el alto disponible y se recorre con flechas, swipe o teclado.
 * @param {{ items: import('../model/goalLists').GoalItem[], label: string }} props
 */
export default function GoalsCarousel({ items, label }) {
  const trackRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const [nav, setNav] = useState({ canPrev: false, canNext: false, first: 0, last: 0 });

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setNav({
      canPrev: track.scrollLeft > 4,
      canNext: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
      ...visibleRange(track),
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => observer.disconnect();
  }, [update, items.length]);

  const scrollPage = direction => {
    const track = trackRef.current;
    track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
  };

  const onKeyDown = event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); scrollPage(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); scrollPage(-1); }
  };

  return (
    <div className="rd-goals-carousel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {nav.first === nav.last ? `${nav.first}` : `${nav.first}–${nav.last}`} de {items.length}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => scrollPage(-1)} disabled={!nav.canPrev} className={ARROW_CLASS} aria-label="Objetivos anteriores">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => scrollPage(1)} disabled={!nav.canNext} className={ARROW_CLASS} aria-label="Objetivos siguientes">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={update}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label={label}
        className="rd-goals-track relative flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl"
      >
        {items.map(item => (
          <div
            key={item.goal.id}
            className="shrink-0 snap-start basis-[85%] sm:basis-[calc((100%-0.75rem)/2)] xl:basis-[calc((100%-1.5rem)/3)]"
          >
            <GoalCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
