import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getSuggesterUsage } from '@/api/suggesterUsageSupabase';

/**
 * Uso diario de un sugeridor ('build' | 'champions'). El límite lo aplica el servidor;
 * esto solo informa y deshabilita el botón cuando no quedan ejecuciones.
 * @param {'build' | 'champions'} feature
 */
export function useSuggesterUsage(feature) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['suggester-usage', user?.id];
  const { data } = useQuery({
    queryKey,
    queryFn: getSuggesterUsage,
    enabled: Boolean(user?.id),
  });

  const limit = data ? data.limit : null;
  const used = data ? data[feature] : 0;

  return {
    isLoaded: Boolean(data),
    isUnlimited: Boolean(data) && limit === null,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    refresh: () => queryClient.invalidateQueries({ queryKey }),
  };
}
