import { useLayoutEffect } from 'react';

// Tierlist "Por Tier" (escritorio y celular): busca el tamaño de imagen más grande con el
// que todas las tiers entran en el alto de la zona de scroll y lo deja en
// --rd-tile sobre el contenedor de grupos (el CSS lo usa para la grilla).
// Mide paddings, gaps y la altura del riel de cada tier en el DOM, así que sigue
// funcionando si cambian los estilos. Sin `enabled` vuelve al tamaño fijo del CSS.
// Si ni con `minTile` entra, queda en ese tamaño y la lista scrollea.
export function useTierTileSize({ scrollRef, groupsRef, enabled, layoutKey, minTile = 40, maxTile = 120 }) {
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
      // Las tiers van una debajo de otra (margen entre ellas) o, en el celular horizontal, en
      // una grilla de varias columnas: ahí cada fila mide lo que su tier más alta.
      const groupsStyle = getComputedStyle(groups);
      const groupCols = groupsStyle.display === 'grid'
        ? groupsStyle.gridTemplateColumns.split(' ').filter(Boolean).length
        : 1;
      const groupGap = groupCols > 1
        ? parseFloat(groupsStyle.rowGap) || 0
        : groupEls.length > 1 ? parseFloat(getComputedStyle(groupEls[1]).marginTop) || 0 : 0;
      const groupRows = Math.ceil(groupEls.length / groupCols);

      // Alto mínimo de cada tier: el de su riel más los bordes. En escritorio el badge va al
      // lado del título y los promedios; en el celular, encima de la cantidad (en columna).
      const groupMins = groupEls.map(group => {
        const head = group.querySelector('.rd-tier-group-head');
        const border = group.offsetHeight - group.clientHeight;
        if (!head) return border;
        const headStyle = getComputedStyle(head);
        const padding = parseFloat(headStyle.paddingTop) + parseFloat(headStyle.paddingBottom);
        const visible = [...head.children].filter(el => el.offsetHeight > 0);
        if (headStyle.display === 'flex' && headStyle.flexDirection === 'column') {
          const stacked = visible.reduce((sum, el) => sum + el.offsetHeight, 0)
            + (parseFloat(headStyle.rowGap) || 0) * Math.max(0, visible.length - 1);
          return border + stacked + padding;
        }
        const [badge, ...rest] = visible;
        const textHeight = rest.reduce((sum, el) => sum + el.offsetHeight, 0)
          + (parseFloat(headStyle.rowGap) || 0) * Math.max(0, rest.length - 1);
        return border + Math.max(badge?.offsetHeight || 0, textHeight) + padding;
      });
      const counts = grids.map(grid => grid.children.length);
      const available = scroll.clientHeight - groupGap * (groupRows - 1);

      let size = minTile;
      for (let s = Math.min(maxTile, Math.floor(width)); s >= minTile; s -= 1) {
        const cols = Math.max(1, Math.floor((width + gap) / (s + gap)));
        const heights = counts.map((count, i) => {
          const rows = Math.ceil(count / cols);
          const border = groupEls[i].offsetHeight - groupEls[i].clientHeight;
          return Math.max(groupMins[i], rows * s + (rows - 1) * gap + padY + border);
        });
        let total = 0;
        for (let row = 0; row < groupRows; row += 1) {
          total += Math.max(...heights.slice(row * groupCols, (row + 1) * groupCols));
        }
        if (total <= available) {
          size = s;
          break;
        }
      }

      groups.style.setProperty('--rd-tile', `${size}px`);

      // Verificación con el layout real: si igual hay que scrollear (redondeos, estilos que
      // cambiaron), se achica de a 1 px hasta que entre todo.
      while (size > minTile && scroll.scrollHeight > scroll.clientHeight) {
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
  }, [scrollRef, groupsRef, enabled, layoutKey, minTile, maxTile]);
}
