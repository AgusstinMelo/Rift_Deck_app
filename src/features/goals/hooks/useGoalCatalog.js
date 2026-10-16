import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { getPublishedGamePatches } from '@/api/gameCatalogSupabase';

/**
 * Catálogos que usan los formularios y las partidas de Objetivos.
 * Comparte las query keys de la página Partidas para reutilizar la caché.
 */
export function useGoalCatalog() {
  const championsQuery = useQuery({ queryKey: ['champions'], queryFn: () => Champion.list('name') });
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: () => WRItem.list('name') });
  const patchesQuery = useQuery({ queryKey: ['game-patches', 'published'], queryFn: getPublishedGamePatches });

  /** @type {any[]} */
  const champions = championsQuery.data || [];
  /** @type {any[]} */
  const items = itemsQuery.data || [];
  /** Parches publicados: los necesita el formulario de edición de partidas. @type {any[]} */
  const gamePatches = patchesQuery.data || [];

  return { champions, items, gamePatches };
}
