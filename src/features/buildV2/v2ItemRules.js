// Reglas del juego sobre objetos que ninguna build puede romper (también con temática):
// - las evoluciones no se compran: Muramaná sale de Manamune al cargar maná, Abrazo del
//   Serafín del Báculo del Arcángel, etc. Solo se arma el objeto base;
// - los objetos de Lágrima de la Diosa (cargan maná) son excluyentes: uno por build;
// - otros grupos que no se combinan (utils/exclusiveItems.js): Terminus, Recordatorio
//   Mortal, Rencor de Serylda y Lord Dominik; Báculo del Vacío, Criptorretoño y Maldición
//   de la Vampiresa; Cimitarra Mercurial y Fuerza del Viento;
// - en Support, el primer objeto es el objeto de soporte inicial ya completado (Guadaña de
//   Niebla Oscura o Baluarte de la Montaña), aunque en el catálogo figure como "Básico".

import { exclusiveGroupOf } from '../../utils/exclusiveItems.js';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Base → evolución cuando la descripción no lo dice (Llegada del Invierno no lo menciona). */
const KNOWN_EVOLUTIONS = {
  manamune: 'muramana',
  'baculo del arcangel': 'abrazo del serafin',
  'llegada del invierno': 'invierno nordico',
  'tiara susurrante': 'diadema musical',
};

/** Objetos de soporte inicial ya completados (la misión de la Hoz Espectral o del Escudo Reliquia). */
const KNOWN_SUPPORT_STARTERS = ['guadana de niebla oscura', 'baluarte de la montana'];

/** "transforma a Manamune en Muramaná", "se mejora automáticamente a Diadema Musical". */
const EVOLUTION_TEXT = /(?:transforma\w*(?:\s+a\s+[^.]+?)?\s+en|se mejora automaticamente a)\s+([^.,;]+)/;

/**
 * Reglas calculadas sobre la lista completa de objetos del parche.
 * @param {any[]} items  snapshot.items (con componentes).
 */
export function itemRulesFor(items = []) {
  const names = new Map(items.map(item => [normalize(item.name), item]));
  const evolutionOf = new Map();
  items.forEach(item => {
    const base = normalize(item.name);
    const match = normalize(item.description).match(EVOLUTION_TEXT);
    // Solo cuenta si la evolución es un objeto del catálogo; si el texto no lo nombra igual
    // ("Abrazo de Serafín" / "Abrazo Del Serafin"), se usa la lista conocida.
    const find = target => target && [...names.keys()].find(name => name === target || target.startsWith(name));
    const evolved = find(match && normalize(match[1])) || find(KNOWN_EVOLUTIONS[base]);
    if (evolved && evolved !== base && item.category === 'Mejorado') evolutionOf.set(base, evolved);
  });
  const evolved = new Set(evolutionOf.values());
  const starters = new Set(KNOWN_SUPPORT_STARTERS.filter(name => names.has(name)));
  // También los que nombran las misiones de los objetos de soporte iniciales.
  items.forEach(item => {
    const match = normalize(item.description).match(/transformalo en\s+([^.,;]+)/);
    if (match && names.has(normalize(match[1]))) starters.add(normalize(match[1]));
  });
  return {
    /** Forma evolucionada: no se compra. */
    isEvolved: item => evolved.has(normalize(item?.name)),
    /** Objeto de Lágrima de la Diosa: carga maná y evoluciona. Uno por build. */
    isTear: item => evolutionOf.has(normalize(item?.name)) || /limitado a un solo objeto de lagrima/.test(normalize(item?.description)),
    /**
     * Grupo de objetos que el juego no deja combinar (utils/exclusiveItems.js), o null. La
     * Lágrima de la Diosa va aparte (isTear), con su propia regla y mensaje.
     */
    exclusiveGroup: item => {
      const group = exclusiveGroupOf(item);
      return group && group !== 'lagrima' ? group : null;
    },
    /** Objeto de soporte inicial completado (Guadaña de Niebla Oscura, Baluarte de la Montaña). */
    isSupportStarter: item => starters.has(normalize(item?.name)),
    evolutionName: item => {
      const target = evolutionOf.get(normalize(item?.name));
      return target ? names.get(target)?.name?.trim() : null;
    },
  };
}
