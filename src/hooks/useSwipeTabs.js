import { useRef } from 'react';
import { useMatchMedia } from './useMatchMedia';

// Pantallas táctiles: en escritorio con mouse no hay swipe.
const TOUCH_QUERY = '(pointer: coarse)';
const MIN_DISTANCE = 60;
const MAX_DURATION_MS = 700;
// Los bordes de la pantalla son del gesto "atrás" del sistema.
const EDGE_GUTTER = 24;

const IGNORED = 'input, textarea, select, [contenteditable="true"], [data-swipe-ignore]';

const EDGE_TOLERANCE = 2;

/**
 * Lo que hay bajo el dedo al empezar: null si es un campo o algo marcado con
 * data-swipe-ignore; si no, la lista de elementos con scroll horizontal (carruseles, tablas
 * anchas) y si cada uno ya estaba en su principio o en su final.
 */
function horizontalScrollersAt(target, boundary) {
  const scrollers = [];
  for (let el = target; el && el !== boundary; el = el.parentElement) {
    if (el.matches?.(IGNORED)) return null;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') {
        scrollers.push({
          atStart: el.scrollLeft <= EDGE_TOLERANCE,
          atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_TOLERANCE,
        });
      }
    }
  }
  return scrollers;
}

/**
 * Pestañas que se cambian deslizando el dedo en el celular. Del último pasa al primero y
 * al revés. Devuelve los handlers para el contenedor de la página: `<div {...swipe}>`.
 *
 * Un carrusel o una tabla que se desliza de costado tiene prioridad: primero se recorre y,
 * con el gesto que empieza ya en su final (o en su principio, hacia atrás), cambia la pestaña.
 * Lo mismo con un paginado propio (onInnerSwipe, recibe la dirección y el elemento donde
 * empezó el gesto): si devuelve true, el gesto pasó de página dentro de la pestaña y no la cambia.
 * @param {{ ids: string[], active: string, onChange: (id: string) => void, enabled?: boolean,
 *   onInnerSwipe?: (forward: boolean, target: Element) => boolean }} options
 */
export function useSwipeTabs({ ids, active, onChange, enabled = true, onInnerSwipe }) {
  const isTouch = useMatchMedia(TOUCH_QUERY);
  const start = useRef(null);

  if (!enabled || !isTouch || ids.length < 2) return {};

  return {
    onTouchStart(event) {
      start.current = null;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX < EDGE_GUTTER || touch.clientX > window.innerWidth - EDGE_GUTTER) return;
      const scrollers = horizontalScrollersAt(event.target, event.currentTarget);
      if (!scrollers) return;
      start.current = { x: touch.clientX, y: touch.clientY, time: Date.now(), scrollers, target: event.target };
    },
    onTouchEnd(event) {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (Date.now() - from.time > MAX_DURATION_MS) return;
      const forward = dx < 0;
      if (!from.scrollers.every(scroller => (forward ? scroller.atEnd : scroller.atStart))) return;
      if (onInnerSwipe?.(forward, from.target)) return;
      const index = Math.max(0, ids.indexOf(active));
      const next = (index + (forward ? 1 : -1) + ids.length) % ids.length;
      onChange(ids[next]);
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
