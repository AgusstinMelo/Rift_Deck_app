import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Champion, Rune, WRItem } from '@/api/entitiesSupabase';
import { useSpells } from '@/hooks/useSpells';
import { preloadImages, shouldSkipPreload, whenIdle } from '@/lib/preloadImages';

/**
 * Precarga en segundo plano los íconos del catálogo (campeones, hechizos, runas y
 * objetos) apenas se entra a la app: al abrir la Tierlist, la Biblioteca, el creador de
 * builds o la carga de partidas, las imágenes ya están en memoria y se ven al instante.
 * Usa las mismas consultas que el buscador de la barra lateral (sin pedidos extra).
 */
export function useCatalogImagePreload() {
  const { data: champions } = useQuery({ queryKey: ['sidebar-search', 'champions'], queryFn: () => Champion.list('name') });
  const { data: items } = useQuery({ queryKey: ['sidebar-search', 'items'], queryFn: () => WRItem.list('name') });
  const { data: runes } = useQuery({ queryKey: ['sidebar-search', 'runes'], queryFn: () => Rune.list('name') });
  const { data: spells } = useSpells();
  const ready = Boolean(champions && items && runes && spells);

  useEffect(() => {
    if (!ready || shouldSkipPreload()) return undefined;
    let cancelPreload = () => {};
    const cancelIdle = whenIdle(() => {
      // Primero lo que más se repite en pantalla: campeones, después hechizos, runas y objetos.
      cancelPreload = preloadImages([
        ...champions.map(champion => champion.image_url),
        ...spells.map(spell => spell.image_url),
        ...runes.map(rune => rune.image_url),
        ...items.map(item => item.image_url),
      ]);
    });
    return () => {
      cancelIdle();
      cancelPreload();
    };
  }, [ready, champions, items, runes, spells]);
}
