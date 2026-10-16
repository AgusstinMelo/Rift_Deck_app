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
      const placeAbove = below < Math.min(preferredHeight, 240) && above > below;
      const maxHeight = Math.max(160, Math.min(preferredHeight, placeAbove ? above : below));
      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
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
