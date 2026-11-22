// Piezas comunes de las fichas de la Biblioteca (campeón, objeto y runa): mismo lenguaje
// visual (clases .rd-cd-* de styles/16-library.css).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { userMatchesQuery } from '@/api/matchesSupabase';
import { keyOf } from '@/features/coach/catalog';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/LocaleContext';
import { championSlug } from '@/utils/championSlug';
import { entitySlug } from '@/utils/entitySlug';
import { DEFAULT_PALETTE, loadArtPalette } from '@/features/share/artPalette';

/**
 * Cuántos elementos de una lista en grilla entran en el alto que le deja su tarjeta
 * (columnas × filas completas), para llenar el espacio sin scroll. Mide cuando la lista tiene
 * alto fijo (styles/16-library.css: flex 1 1 0, min-height 0 y overflow hidden; en escritorio
 * y en las fichas del celular); si crece con su contenido (tablet) se muestran `fallback`.
 * @param {{ current: HTMLElement | null }} ref la lista (grid; sus hijos, una celda cada uno)
 * @param {number} total candidatos disponibles
 * @param {unknown[]} [deps] lo que cambia si la lista se monta (la pestaña del celular)
 */
export function useFitCount(ref, total, fallback, deps = []) {
  const [count, setCount] = useState(Math.min(total, fallback));
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const style = getComputedStyle(list);
      const first = list.firstElementChild;
      // Sin alto fijo (overflow visible) la lista crece: no hay espacio que llenar.
      if (!first || style.overflowY !== 'hidden') {
        setCount(Math.min(total, fallback));
        return;
      }
      const columns = style.gridTemplateColumns.trim().split(/\s+/).length;
      const gap = parseFloat(style.rowGap) || 0;
      const rows = Math.floor((list.clientHeight + gap) / (first.offsetHeight + gap));
      setCount(Math.max(columns, Math.min(total, rows * columns)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [ref, total, fallback, ...deps]);
  return count;
}

/**
 * Bloques opcionales al pie de una tarjeta que solo usan el alto que sobra: en escritorio
 * no suman al alto mínimo de la tarjeta (styles/16-library.css, .rd-ed-fill) y el bloque
 * que no entra entero se oculta, en vez de cortarse o empujar la página a scrollear. En
 * tablet y celular la tarjeta crece y se ven todos.
 */
export function FillSpace({ children, className = '' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const constrained = getComputedStyle(box).overflowY === 'hidden';
      const area = box.getBoundingClientRect();
      [...box.children].forEach(child => {
        const rect = child.getBoundingClientRect();
        const fits = rect.top >= area.top - 1 && rect.bottom <= area.bottom + 1;
        // visibility no cambia el layout: medir y ocultar no se realimenta.
        child.style.visibility = !constrained || fits ? '' : 'hidden';
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    [...box.children].forEach(child => observer.observe(child));
    return () => observer.disconnect();
  });
  return <div ref={ref} className={`rd-ed-fill ${className}`}>{children}</div>;
}

export function CardTitle({ children, extra }) {
  return (
    <div className="rd-cd-card-head">
      <h2 className="rd-cd-card-title">{children}</h2>
      {extra}
    </div>
  );
}

/**
 * Fila de matchups: campeones con su ícono y nombre. En la biblioteca pública cada uno
 * es un enlace a su ficha (navegación y enlaces internos para buscadores).
 */
export function MatchupRow({ icon: Icon, label, tone, champions, publicMode, emptyLabel }) {
  return (
    <div className="rd-cd-matchup" data-tone={tone}>
      <p className="rd-cd-matchup-label"><Icon size={13} aria-hidden="true" /> {label}</p>
      {champions.length ? <FaceList champions={champions} publicMode={publicMode} /> : <p className="rd-cd-empty">{emptyLabel}</p>}
    </div>
  );
}

/**
 * Caras de campeones con su nombre (y `caption` debajo, si se pasa). En la biblioteca
 * pública cada una enlaza a su ficha.
 * @param {{ champions: object[], publicMode: boolean, caption?: (champion: object) => string, className?: string }} props
 */
export function FaceList({ champions, publicMode, caption, className = '' }) {
  return (
    <ul className={`rd-cd-faces ${className}`}>
      {champions.map(champion => {
        const face = (
          <>
            {champion.image_url
              ? <img src={champion.image_url} alt="" loading="lazy" width="40" height="40" />
              : <span className="rd-cd-face-fallback">{champion.name[0]}</span>}
            <span className="rd-cd-face-name">{champion.name}</span>
            {caption && <span className="rd-cd-face-caption">{caption(champion)}</span>}
          </>
        );
        return (
          <li key={champion.id || champion.name} title={champion.name}>
            {publicMode
              ? <Link to={`/campeones/${championSlug(champion.name)}`} className="rd-cd-face">{face}</Link>
              : <span className="rd-cd-face">{face}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Íconos de objetos con el nombre en el title. En la biblioteca pública enlazan a la ficha
 * (`/objetos/<slug>`); en la privada, `onSelect` abre la ficha si la vista lo permite.
 * @param {{ items: object[], publicMode: boolean, nameOf: (item: object) => string, onSelect?: (item: object) => void }} props
 */
export function ItemIconList({ items, publicMode, nameOf, onSelect }) {
  return (
    <ul className="rd-ed-icon-list">
      {items.map(item => {
        const name = nameOf(item);
        const icon = item.image_url
          ? <img src={item.image_url} alt={name} loading="lazy" width="36" height="36" />
          : <span className="rd-ed-icon-fallback">{name[0]}</span>;
        return (
          <li key={item.id} title={name}>
            {publicMode ? (
              <Link to={`/objetos/${entitySlug(item.name)}`} className="rd-ed-icon-link">{icon}</Link>
            ) : onSelect ? (
              <button type="button" className="rd-ed-icon-link" onClick={() => onSelect(item)}>{icon}</button>
            ) : (
              <span className="rd-ed-icon-link">{icon}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Tu rendimiento con un objeto o una runa (ver personalUsage): winrate, récord, cómo te va
 * en el resto de tus partidas y los campeones con los que más lo usaste.
 * @param {{ usage: ReturnType<import('@/features/library/entityInsights').personalUsage>, champions: object[] }} props
 */
export function PersonalUsageBlock({ usage, champions }) {
  const t = useT();
  if (!usage) return null;
  const pct = value => `${Math.round(value * 100)}%`;
  const byName = new Map(champions.map(champion => [keyOf(champion.name), champion]));
  const faces = usage.champions.map(entry => ({ ...(byName.get(keyOf(entry.name)) || {}), name: entry.name, usage: entry }));
  return (
    <div className="rd-ed-profile-block rd-ed-usage">
      <p className="rd-ed-profile-label">{t('library.rendimientoPersonal')}</p>
      {usage.games === 0 ? (
        <p className="rd-cd-empty">{t('library.uso.sinPartidas')}</p>
      ) : (
        <div className="rd-ed-usage-body">
          <div className="rd-ed-usage-head">
            <p className="rd-ed-usage-wr">{pct(usage.wr)}</p>
            <div>
              <p className="rd-ed-usage-record">{t('library.uso.record', { games: usage.games, wins: usage.wins, losses: usage.games - usage.wins })}</p>
              {usage.without && (
                <p className="rd-ed-usage-compare" data-trend={usage.wr > usage.without.wr ? 'up' : usage.wr < usage.without.wr ? 'down' : 'flat'}>
                  {t('library.uso.sinEl', { wr: pct(usage.without.wr), games: usage.without.games })}
                </p>
              )}
            </div>
          </div>
          {faces.length > 0 && (
            <FaceList
              className="rd-ed-usage-faces"
              champions={faces}
              publicMode={false}
              caption={champion => t('library.uso.campeon', { games: champion.usage.games, wr: pct(champion.usage.wr) })}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Tus partidas (biblioteca privada); en la pública no se piden. */
export function usePersonalMatches(publicMode) {
  const { user } = useAuth();
  const { data = [] } = useQuery(userMatchesQuery(user, { enabled: !publicMode }));
  return publicMode ? [] : data;
}

/**
 * Luces de la ficha (variables --rd-cd-light-a/b) con los colores dominantes de una imagen,
 * como la tarjeta para compartir. `fallback` ([a, b] en RGB) se usa mientras carga o si la
 * imagen no da colores útiles.
 */
export function useArtLights(url, fallback = null) {
  const [palette, setPalette] = useState(null);
  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    loadArtPalette(url).then(result => {
      if (active) setPalette({ url, colors: result === DEFAULT_PALETTE ? null : [result.primary, result.secondary] });
    });
    return () => { active = false; };
  }, [url]);
  const colors = (palette?.url === url && palette.colors) || fallback;
  return colors ? {
    '--rd-cd-light-a': colors[0].join(', '),
    '--rd-cd-light-b': colors[1].join(', '),
  } : {};
}

/**
 * Separa un texto del catálogo en párrafos y, cuando la línea empieza con "Nombre: …"
 * (pasivas de objetos, bonus de runas), en etiqueta y texto.
 */
export function splitEffects(text) {
  return String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([^:.\d][^:]{1,38}):\s+(.+)$/);
      return match ? { label: match[1].trim(), text: match[2].trim() } : { label: null, text: line };
    });
}

/**
 * Dónde partir una lista de efectos en dos páginas: en el efecto con título cuyo corte deja
 * las dos mitades de texto más parejas; si ninguno tiene título, entre párrafos (0 si es uno solo).
 */
export function effectsSplitIndex(effects) {
  const sizes = effects.map(effect => (effect.label?.length || 0) + effect.text.length);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  let best = 0;
  let bestGap = Infinity;
  let before = 0;
  const anyBoundary = !effects.some((effect, index) => index > 0 && effect.label);
  sizes.forEach((size, index) => {
    if (index > 0 && (anyBoundary || effects[index].label)) {
      const gap = Math.abs(total - 2 * before);
      if (gap < bestGap) { best = index; bestGap = gap; }
    }
    before += size;
  });
  return best;
}

/**
 * Letra que llena su caja: busca el tamaño más grande (entre `min` y `max`, en px) con el que
 * el texto entra sin scroll en el alto que el layout le da al elemento, y lo recalcula cuando
 * cambia ese alto. La caja tiene que tener alto propio (no crecer con el texto). Con
 * `enabled` en false deja el tamaño del CSS. `onOverflow` se llama si ni con `min` entra.
 * @param {{ current: HTMLElement | null }} ref
 * @param {{ enabled: boolean, min?: number, max?: number, deps?: unknown[], onOverflow?: () => void }} options
 */
export function useFitText(ref, { enabled, min = 10, max = 18, deps = [], onOverflow }) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    if (!enabled || typeof ResizeObserver === 'undefined') {
      box.style.fontSize = '';
      return undefined;
    }
    let lastHeight = -1;
    let lastWidth = -1;
    const fit = () => {
      const { clientHeight: height, clientWidth: width } = box;
      if (!height || (height === lastHeight && width === lastWidth)) return;
      lastHeight = height;
      lastWidth = width;
      // Búsqueda binaria en medios píxeles: el tamaño más grande que no desborda.
      let low = min * 2;
      let high = max * 2;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        box.style.fontSize = `${mid / 2}px`;
        if (box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1) low = mid;
        else high = mid - 1;
      }
      box.style.fontSize = `${low / 2}px`;
      if (onOverflow && (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1)) onOverflow();
    };
    fit();
    // El tamaño de la caja no depende de la letra (alto fijo): observarla no se realimenta.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => {
      observer.disconnect();
      box.style.fontSize = '';
    };
  }, [ref, enabled, min, max, ...deps]);
}
