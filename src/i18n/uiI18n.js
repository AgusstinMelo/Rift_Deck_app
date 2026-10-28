// Textos de la interfaz (títulos, botones, avisos). Separados del catálogo de
// objetos y runas: viven en src/i18n/ui/<locale>.json, agrupados por sección
// ("nav", "common", ...). es-419.json es la referencia: toda clave nueva se
// agrega primero ahí. Módulo sin dependencias de Vite para que también lo usen
// los scripts y los tests de Node.
import baseMessages from './ui/es-419.json' with { type: 'json' };

export { baseMessages };

export function lookup(messages, key) {
  let node = messages;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

// "{name}" se reemplaza por vars.name; las llaves sin variable quedan tal cual.
export function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] != null ? String(vars[name]) : match));
}

export function translate(messages, fallback, key, vars) {
  const text = lookup(messages, key) ?? lookup(fallback, key) ?? key;
  return interpolate(text, vars);
}

// Idioma activo para el código que no es componente (etiquetas, validaciones,
// textos armados en helpers). Lo actualiza LocaleProvider; sin él (SSR, tests)
// queda el español latino. Los componentes que muestran estos textos tienen que
// usar useT() para volver a renderizar al cambiar de idioma.
let activeMessages = null;
let activeLocale = 'es-419';

export function setActiveMessages(messages, locale) {
  activeMessages = messages;
  activeLocale = locale;
}

export const getActiveLocale = () => activeLocale;

// Idioma en que la IA tiene que escribir sus textos (va dentro de un prompt en
// español). null para el español latino: el prompt ya está en ese idioma.
const RESPONSE_LANGUAGES = { 'es-ES': 'español de España', 'pt-BR': 'portugués de Brasil', en: 'inglés' };
export const responseLanguage = (locale = activeLocale) => RESPONSE_LANGUAGES[locale] || null;

// Locale para Intl (números y fechas). El español latino se formatea como es-AR
// (coma decimal), como hasta ahora.
export const formatLocale = (locale = activeLocale) => (locale === 'es-419' ? 'es-AR' : locale);

export const tr = (key, vars) => translate(activeMessages, baseMessages, key, vars);

// Objeto de etiquetas que se traduce al leerlo: labels({ win: 'matches.win' }).win
// devuelve el texto del idioma activo. Sirve para mapas de etiquetas que se
// definen una sola vez al importar el módulo.
export function labels(keys) {
  const result = {};
  for (const [name, key] of Object.entries(keys)) {
    Object.defineProperty(result, name, { enumerable: true, get: () => tr(key) });
  }
  return result;
}

// Lista plana de claves ("nav.library", ...) para comparar idiomas.
export function flattenKeys(messages, prefix = '') {
  return Object.entries(messages || {}).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? flattenKeys(value, fullKey) : [fullKey];
  });
}
