import { useRef } from 'react';
import { useMatchMedia } from './useMatchMedia';

// Pantallas táctiles: en escritorio con mouse no hay swipe.
const TOUCH_QUERY = '(pointer: coarse)';
const MIN_DISTANCE = 60;
const MAX_DURATION_MS = 700;
// Los bordes de la pantalla son del gesto "atrás" del sistema.
const EDGE_GUTTER = 24;

const IGNORED = 'input, textarea, select, [contenteditable="true"], [data-swipe-ignore]';

/** ¿El toque arrancó en algo que ya usa el deslizamiento horizontal (carrusel, tabla, campo)? */
function startsInHorizontalGesture(target, boundary) {
  for (let el = target; el && el !== boundary; el = el.parentElement) {
    if (el.matches?.(IGNORED)) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Pestañas que se cambian deslizando el dedo en el celular. Del último pasa al primero y
 * al revés. Devuelve los handlers para el contenedor de la página: `<div {...swipe}>`.
 * @param {{ ids: string[], active: string, onChange: (id: string) => void, enabled?: boolean }} options
 */
export function useSwipeTabs({ ids, active, onChange, enabled = true }) {
  const isTouch = useMatchMedia(TOUCH_QUERY);
  const start = useRef(null);

  if (!enabled || !isTouch || ids.length < 2) return {};

  return {
    onTouchStart(event) {
      start.current = null;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX < EDGE_GUTTER || touch.clientX > window.innerWidth - EDGE_GUTTER) return;
      if (startsInHorizontalGesture(event.target, event.currentTarget)) return;
      start.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
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
      const index = Math.max(0, ids.indexOf(active));
      const next = (index + (dx < 0 ? 1 : -1) + ids.length) % ids.length;
      onChange(ids[next]);
    },
    onTouchCancel() {
      start.current = null;
    },
  };
}
