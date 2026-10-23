import { useEffect, useState } from 'react';

// Mismo corte que el CSS de smartphone horizontal (index.css).
export const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)';
// Mismo corte que el CSS de smartphone vertical (index.css).
export const PHONE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 639px)';
// Mismo corte que el CSS de escritorio ajustado al viewport (index.css).
export const DESKTOP_FIT_QUERY = '(min-width: 1024px) and (min-height: 700px)';

// ssrSafe: en páginas prerenderizadas (biblioteca pública) el primer render tiene que
// coincidir con el HTML del servidor, así que arranca en false y se actualiza al montar.
export function useMatchMedia(query, { ssrSafe = false } = {}) {
  const [matches, setMatches] = useState(() => !ssrSafe && typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
