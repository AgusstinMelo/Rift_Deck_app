import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Los desplegables se renderizan en un portal con posición fija para que no queden
// recortados por las columnas con scroll interno; se abren hacia arriba si no hay lugar.
export function useFloatingPanel(open, anchorRef, preferredHeight) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open) { setStyle(null); return undefined; }
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 6;
      const margin = 12;
      const below = window.innerHeight - rect.bottom - gap - margin;
      const above = rect.top - gap - margin;
      // Ancho mínimo para anclas angostas (fichas del draft en smartphone horizontal),
      // sin salirse del viewport.
      const width = Math.min(Math.max(rect.width, 240), window.innerWidth - margin * 2);
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      // Si no entra ni arriba ni abajo (ancla alta en un viewport bajo), el panel usa
      // todo el alto disponible y tapa el ancla.
      if (Math.max(below, above) < 200) {
        setStyle({ position: 'fixed', left, width, top: margin, maxHeight: window.innerHeight - margin * 2, zIndex: 400 });
        return;
      }
      const placeAbove = below < Math.min(preferredHeight, 240) && above > below;
      const maxHeight = Math.max(160, Math.min(preferredHeight, placeAbove ? above : below));
      setStyle({
        position: 'fixed',
        left,
        width,
        maxHeight,
        zIndex: 400,
        ...(placeAbove ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, preferredHeight]);

  return style;
}

export function useCloseOnOutside(open, refs, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!refs.some(ref => ref.current?.contains(event.target))) onCloseRef.current();
    };
    const closeOnEscape = event => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
}
