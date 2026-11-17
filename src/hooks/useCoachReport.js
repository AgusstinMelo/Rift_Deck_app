import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCoachHistory, logCoachInsights } from '@/api/coachSupabase';
import { getUserBuilds } from '@/api/buildsSupabase';
import { getUserMatchParticipants } from '@/api/matchesSupabase';
import { computeInsightReport } from '@/hooks/useInsights';
import { useCatalogText } from '@/lib/LocaleContext';

// Referencia estable para el valor por defecto (evita recalcular el informe en cada render).
const EMPTY = [];

/**
 * Informe del Coach con historial: marca lo nuevo, arma el seguimiento y registra los
 * consejos nuevos. El registro no invalida la consulta a propósito: así la etiqueta
 * "Nuevo" se mantiene durante la visita y desaparece en la próxima.
 * @param {any} user
 * @param {{ matches: any[], wrItems: any[], champions: any[], runes: any[], tierlist?: any[], limit?: number }} input
 * @param {any[]} deps  Dependencias extra del cálculo (por ejemplo, el idioma).
 */
export function useCoachReport(user, { matches, wrItems, champions, runes, tierlist = EMPTY, limit = 8 }, deps = []) {
  const { data: history = [], isFetched } = useQuery({
    queryKey: ['coach-history', user?.id],
    queryFn: () => getCoachHistory(user),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
  const historyReady = isFetched || !user?.id;
  // Builds guardadas: el Coach compara las que tienen partidas vinculadas.
  const { data: builds = [] } = useQuery({
    queryKey: ['coach-builds', user?.id],
    queryFn: () => getUserBuilds(user),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
  // Los 10 jugadores de las partidas cargadas con capturas (daño, oro, builds rivales).
  const { data: participants = EMPTY } = useQuery({
    queryKey: ['coach-participants', user?.id, matches?.length || 0],
    queryFn: () => getUserMatchParticipants(user),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
  });
  // Notas estratégicas de los campeones en el idioma activo (plan de juego con tu main).
  const { championNotes } = useCatalogText();

  const report = useMemo(
    () => computeInsightReport({ matches, wrItems, champions, runes, builds, tierlist, participants, history, championNotes, limit }),
    [matches, wrItems, champions, runes, builds, tierlist, participants, history, championNotes, limit, ...deps],
  );

  const logged = useRef(new Set());
  useEffect(() => {
    if (!historyReady || !user?.id) return;
    const fresh = report.insights.filter(insight => insight.isNew && !logged.current.has(insight.id));
    if (!fresh.length) return;
    fresh.forEach(insight => logged.current.add(insight.id));
    logCoachInsights(user, fresh).catch(() => {});
  }, [report, historyReady, user]);

  // Hasta tener el historial, todo parecería nuevo: la UI solo marca novedades con historyReady.
  return { ...report, historyReady };
}
