import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  catalogTextHash,
  detectLocale,
  isSupportedLocale,
  normalizeCatalogText,
} from '@/i18n/catalogI18n';

const STORAGE_KEY = 'riftdeck.locale';

// Cada idioma se descarga solo cuando se elige.
const CATALOG_LOADERS = {
  'es-ES': () => import('@/i18n/catalog/es-ES.json'),
  'pt-BR': () => import('@/i18n/catalog/pt-BR.json'),
  en: () => import('@/i18n/catalog/en.json'),
};

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  catalog: null,
});

function readStoredLocale() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    // Sin acceso a localStorage (modo privado, cookies bloqueadas).
  }
  return detectLocale(window.navigator?.languages || [window.navigator?.language]);
}

export function LocaleProvider({ children }) {
  // Arranca en español para que coincida con el HTML prerenderizado; el idioma
  // guardado se aplica al montar.
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  useEffect(() => {
    const load = CATALOG_LOADERS[locale];
    if (!load) {
      setCatalog(null);
      return undefined;
    }

    let cancelled = false;
    load()
      .then(module => { if (!cancelled) setCatalog(module.default); })
      .catch(() => { if (!cancelled) setCatalog(null); });
    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback(next => {
    if (!isSupportedLocale(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Se aplica igual en esta sesión.
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale, catalog }), [locale, setLocale, catalog]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const hashCache = new Map();
const cachedHash = text => {
  if (!hashCache.has(text)) hashCache.set(text, catalogTextHash(text));
  return hashCache.get(text);
};

// Textos visibles de objetos y runas en el idioma elegido. `name` y
// `description` de la entidad no se tocan: builds y partidas guardan el nombre
// en español como identificador.
export function useCatalogText() {
  const { locale, catalog } = useLocale();

  return useMemo(() => {
    const entryFor = entity => {
      if (!catalog || entity?.id == null) return null;
      const id = String(entity.id);
      return catalog.items?.[id] || catalog.runes?.[id] || null;
    };

    const entityName = entity => entryFor(entity)?.name || entity?.name || '';

    // Siempre con saltos de línea reales (la base guarda "\n" literal).
    const entityDescription = entity => {
      const original = normalizeCatalogText(entity?.description);
      const entry = entryFor(entity);
      if (!original || !entry?.description) return original;
      // Traducción de otra versión del texto (otro parche): mejor el original.
      return entry.source === cachedHash(original) ? entry.description : original;
    };

    // Búsqueda: acepta tanto el nombre traducido como el original.
    const matchesName = (entity, query, normalize = value => String(value || '').toLowerCase()) => {
      const needle = normalize(query);
      if (!needle) return true;
      return normalize(entityName(entity)).includes(needle) || normalize(entity?.name).includes(needle);
    };

    const compareNames = (a, b) => entityName(a).localeCompare(entityName(b), locale, {
      sensitivity: 'base',
      numeric: true,
    });

    return { locale, entityName, entityDescription, matchesName, compareNames };
  }, [catalog, locale]);
}
