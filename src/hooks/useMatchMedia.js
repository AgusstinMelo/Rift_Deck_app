import { useEffect, useState } from 'react';

// Mismo corte que el CSS de smartphone horizontal (index.css).
export const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)';
// Mismo corte que el CSS de smartphone vertical (index.css).
export const PHONE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 639px)';

export function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
