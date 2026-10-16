import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { getPublishedGamePatches } from '@/api/gameCatalogSupabase';
import { buildPatchOptions } from '@/utils/patches';

/**
 * Catálogos que usan los formularios y las partidas de Objetivos.
 * Comparte las query keys de la página Partidas para reutilizar la caché.
 * @param {any[]} [matches]
 */
export function useGoalCatalog(matches = []) {
  const championsQuery = useQuery({ queryKey: ['champions'], queryFn: () => Champion.list('name') });
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: () => WRItem.list('name') });
  const patchesQuery = useQuery({ queryKey: ['game-patches', 'published'], queryFn: getPublishedGamePatches });

  /** @type {any[]} */
  const champions = championsQuery.data || [];
  /** @type {any[]} */
  const items = itemsQuery.data || [];
  /** @type {any[]} */
  const gamePatches = patchesQuery.data || [];

  const patchOptions = useMemo(
    () => buildPatchOptions([...matches.map(match => match.patch), ...gamePatches.map(patch => patch.version)])
      .map(option => ({ value: option.value, label: option.label })),
    [matches, gamePatches],
  );

  return { champions, items, gamePatches, patchOptions };
}
