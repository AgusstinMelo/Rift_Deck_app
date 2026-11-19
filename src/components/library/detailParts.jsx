// Piezas comunes de las fichas de la Biblioteca (campeón, objeto y runa): mismo lenguaje
// visual (clases .rd-cd-* de styles/16-library.css).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { championSlug } from '@/utils/championSlug';
import { DEFAULT_PALETTE, loadArtPalette } from '@/features/share/artPalette';

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
      {champions.length ? (
        <ul className="rd-cd-faces">
          {champions.map(champion => {
            const face = (
              <>
                {champion.image_url
                  ? <img src={champion.image_url} alt="" loading="lazy" width="40" height="40" />
                  : <span className="rd-cd-face-fallback">{champion.name[0]}</span>}
                <span className="rd-cd-face-name">{champion.name}</span>
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
      ) : (
        <p className="rd-cd-empty">{emptyLabel}</p>
      )}
    </div>
  );
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
