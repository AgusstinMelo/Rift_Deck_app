// Idiomas del catálogo (objetos y runas). La base de datos guarda los textos en
// español latino; las traducciones viven en src/i18n/catalog/<locale>.json,
// indexadas por id de objeto/runa. Módulo sin dependencias de Vite para que
// también lo use scripts/i18n-catalog.mjs.

export const DEFAULT_LOCALE = 'es-419';

export const LOCALES = [
  { code: 'es-419', label: 'Español (Latinoamérica)', short: 'ES-LA' },
  { code: 'es-ES', label: 'Español (España)', short: 'ES' },
  { code: 'pt-BR', label: 'Português (Brasil)', short: 'PT' },
  { code: 'en', label: 'English', short: 'EN' },
];

export const TRANSLATED_LOCALES = LOCALES
  .map(locale => locale.code)
  .filter(code => code !== DEFAULT_LOCALE);

export const isSupportedLocale = code => LOCALES.some(locale => locale.code === code);

// Elige el idioma a partir de navigator.languages: es-ES solo para España,
// cualquier otra variante de español queda en latino.
export function detectLocale(languages = []) {
  for (const raw of languages) {
    const tag = String(raw || '').toLowerCase();
    if (tag === 'es-es') return 'es-ES';
    if (tag.startsWith('es')) return 'es-419';
    if (tag.startsWith('pt')) return 'pt-BR';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

// Las descripciones de la base usan "\n" literal (a veces "\\n") como salto de línea.
export const normalizeCatalogText = value => String(value ?? '').replace(/\\+n/g, '\n').trim();

// Huella (FNV-1a de 32 bits) del texto en español del que salió cada traducción:
// si el parche cambia la descripción original, la traducción queda desactualizada
// y se muestra el español hasta volver a traducirla.
export function catalogTextHash(value) {
  const text = normalizeCatalogText(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
