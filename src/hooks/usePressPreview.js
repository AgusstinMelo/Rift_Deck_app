import { useEffect, useRef } from 'react';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

// Estilos para que la pulsación larga no abra el menú nativo ("guardar imagen",
// selección de texto) en iOS/Android.
export const PRESS_PREVIEW_STYLE = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};

/**
 * Descripción emergente de objetos, runas y hechizos:
 * - con mouse aparece al pasar por encima (como siempre);
 * - con el dedo solo al mantener presionado y se oculta al soltar. El toque corto
 *   sigue eligiendo; la pulsación larga no elige. Deslizar (scroll) la cancela.
 *
 * `bind({ onShow, onHide })` devuelve los handlers para el elemento disparador;
 * `onShow` recibe ese elemento (para ubicar el cuadro). Un solo timer por
 * componente alcanza: no hay dos pulsaciones a la vez.
 */
export function usePressPreview() {
  const timer = useRef(null);
  const origin = useRef(null);
  const fired = useRef(false);

  const clearTimer = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const bind = ({ onShow, onHide }) => ({
    onPointerEnter: event => {
      if (event.pointerType === 'mouse') onShow(event.currentTarget);
    },
    onPointerLeave: event => {
      if (event.pointerType === 'mouse') onHide();
    },
    onPointerDown: event => {
      if (event.pointerType === 'mouse') return;
      fired.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      const element = event.currentTarget;
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onShow(element);
      }, LONG_PRESS_MS);
    },
    onPointerMove: event => {
      if (event.pointerType === 'mouse' || !origin.current || !timer.current) return;
      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) clearTimer();
    },
    onPointerUp: event => {
      if (event.pointerType === 'mouse') return;
      clearTimer();
      origin.current = null;
      if (fired.current) onHide();
    },
    onPointerCancel: event => {
      if (event.pointerType === 'mouse') return;
      clearTimer();
      origin.current = null;
      fired.current = false;
      onHide();
    },
    // La pulsación larga solo muestra la descripción: no elige el elemento.
    onClickCapture: event => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: event => {
      if (event.nativeEvent?.pointerType !== 'mouse' && (fired.current || timer.current)) {
        event.preventDefault();
      }
    },
  });

  return { bind };
}
