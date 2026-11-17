import { useLayoutEffect } from 'react';

const MIN_TILE = 40;
const MAX_TILE = 120;

// Tierlist "Por Tier" en escritorio: busca el tamaño de imagen más grande con el
// que todas las tiers entran en el alto de la zona de scroll y lo deja en
// --rd-tile sobre el contenedor de grupos (index.css lo usa para la grilla).
// Mide paddings, gaps y la altura del riel de cada tier en el DOM, así que sigue
// funcionando si cambian los estilos. Sin `enabled` vuelve al tamaño fijo del CSS.
export function useTierTileSize({ scrollRef, groupsRef, enabled, layoutKey }) {
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const groups = groupsRef.current;
    if (!scroll || !groups) return undefined;

    if (!enabled) {
      groups.style.removeProperty('--rd-tile');
      return undefined;
    }

    const fit = () => {
      const groupEls = [...groups.children];
      const grids = groupEls.map(group => group.querySelector('.rd-tier-group-grid')).filter(Boolean);
      if (!grids.length) return;

      const gridStyle = getComputedStyle(grids[0]);
      const gap = parseFloat(gridStyle.columnGap) || 0;
      const padY = parseFloat(gridStyle.paddingTop) + parseFloat(gridStyle.paddingBottom);
      // Ancho real con decimales (clientWidth redondea): con el entero, en el límite se
      // calculaba una columna más de las que entran y una tier pasaba a dos filas.
      const width = grids[0].getBoundingClientRect().width
        - parseFloat(gridStyle.borderLeftWidth || 0) - parseFloat(gridStyle.borderRightWidth || 0)
        - parseFloat(gridStyle.paddingLeft) - parseFloat(gridStyle.paddingRight) - 0.5;
      const groupGap = groupEls.length > 1 ? parseFloat(getComputedStyle(groupEls[1]).marginTop) || 0 : 0;

      // Alto mínimo de cada tier: el de su riel (badge al lado de título + promedios) más los bordes.
      const groupMins = groupEls.map(group => {
        const head = group.querySelector('.rd-tier-group-head');
        const border = group.offsetHeight - group.clientHeight;
        if (!head) return border;
        const headStyle = getComputedStyle(head);
        const [badge, ...rest] = head.children;
        const textHeight = rest.reduce((sum, el) => sum + el.offsetHeight, 0)
          + (parseFloat(headStyle.rowGap) || 0) * Math.max(0, rest.length - 1);
        return border + Math.max(badge?.offsetHeight || 0, textHeight)
          + parseFloat(headStyle.paddingTop) + parseFloat(headStyle.paddingBottom);
      });
      const counts = grids.map(grid => grid.children.length);
      const available = scroll.clientHeight - groupGap * (groupEls.length - 1);

      let size = MIN_TILE;
      for (let s = Math.min(MAX_TILE, Math.floor(width)); s >= MIN_TILE; s -= 1) {
        const cols = Math.max(1, Math.floor((width + gap) / (s + gap)));
        const total = counts.reduce((sum, count, i) => {
          const rows = Math.ceil(count / cols);
          const border = groupEls[i].offsetHeight - groupEls[i].clientHeight;
          return sum + Math.max(groupMins[i], rows * s + (rows - 1) * gap + padY + border);
        }, 0);
        if (total <= available) {
          size = s;
          break;
        }
      }

      groups.style.setProperty('--rd-tile', `${size}px`);

      // Verificación con el layout real: si igual hay que scrollear (redondeos, estilos que
      // cambiaron), se achica de a 1 px hasta que entre todo.
      while (size > MIN_TILE && scroll.scrollHeight > scroll.clientHeight + 1) {
        size -= 1;
        groups.style.setProperty('--rd-tile', `${size}px`);
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(scroll);
    // Las fuentes cambian el alto de los rótulos de cada tier: se recalcula cuando cargan.
    let active = true;
    document.fonts?.ready.then(() => active && fit());
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [scrollRef, groupsRef, enabled, layoutKey]);
}
