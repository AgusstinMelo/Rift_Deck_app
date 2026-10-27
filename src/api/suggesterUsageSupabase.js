import { supabase } from '@/lib/supabaseClient';

/**
 * Ejecuciones de hoy de cada sugeridor. `limit` es null con Premium (ilimitado).
 * @returns {Promise<{ limit: number | null, build: number, champions: number }>}
 */
export async function getSuggesterUsage() {
  const { data, error } = await supabase.rpc('get_my_suggester_usage');
  if (error) throw error;
  return {
    limit: data?.limit ?? null,
    build: Number(data?.build) || 0,
    champions: Number(data?.champions) || 0,
  };
}

/** Identificador de una ejecución: sus reintentos lo comparten y cuentan una sola vez. */
export function newSuggesterRequestId() {
  return crypto.randomUUID();
}
