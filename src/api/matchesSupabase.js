import { supabase } from "@/lib/supabaseClient";

// PostgREST devuelve como máximo 1000 filas por pedido: las partidas se piden por páginas.
const MATCH_PAGE_SIZE = 1000;
/** Tope de partidas que carga la app por usuario (protege de cuentas anómalas). */
export const MAX_USER_MATCHES = 10000;

/**
 * Todas las partidas del usuario usan esta query (Dashboard, Partidas, Estadísticas,
 * Objetivos, Sugeridor, Biblioteca): una sola descarga y una sola invalidación. Quien
 * necesite menos partidas las recorta con `select`, sin tocar la caché compartida.
 */
export const matchesQueryKey = user => ["matches", user?.id];

export function userMatchesQuery(user, { enabled = true, select } = {}) {
  return {
    queryKey: matchesQueryKey(user),
    queryFn: () => getUserMatches(user),
    enabled: enabled && Boolean(user?.id),
    ...(select ? { select } : {}),
  };
}

async function fetchMatchPages(column, value, limit) {
  const rows = [];
  while (rows.length < limit) {
    const from = rows.length;
    const to = Math.min(from + MATCH_PAGE_SIZE, limit) - 1;
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq(column, value)
      .order("date", { ascending: false })
      // Desempate estable: sin él, las partidas del mismo día podrían repetirse o
      // saltearse entre páginas.
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < to - from + 1) break;
  }
  return rows;
}

// Todas las partidas tienen user_id (las viejas, guardadas solo con email, se completaron
// en 202611170001_backfill_matches_user_id.sql): ya no se busca por created_by.
export async function getUserMatches(user, limit = MAX_USER_MATCHES) {
  if (!user?.id) return [];
  return fetchMatchPages("user_id", user.id, limit);
}

// Columnas agregadas por 202611160002_coach_history_and_team_kills.sql. Si la migración
// todavía no se aplicó, la partida se guarda igual sin ellas.
const OPTIONAL_COLUMNS = ["team_kills", "enemy_team_kills"];
const isMissingColumn = error => error?.code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(error?.message || "");
const withoutOptional = payload => Object.fromEntries(Object.entries(payload).filter(([key]) => !OPTIONAL_COLUMNS.includes(key)));
const hasOptional = payload => OPTIONAL_COLUMNS.some(key => key in payload);

export async function createMatch(user, payload) {
  if (!user?.id) {
    throw new Error("User id is required to create a match.");
  }

  const { client_request_id: _clientRequestId, ...matchPayload } = payload;

  const insert = row => supabase
    .from("matches")
    .insert({ ...row, user_id: user.id, created_by: user.email })
    .select()
    .single();

  let { data, error } = await insert(matchPayload);
  if (error && isMissingColumn(error) && hasOptional(matchPayload)) {
    ({ data, error } = await insert(withoutOptional(matchPayload)));
  }

  if (error) throw error;
  return data;
}

export async function updateMatch(id, payload) {
  const update = row => supabase
    .from("matches")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  let { data, error } = await update(payload);
  if (error && isMissingColumn(error) && hasOptional(payload)) {
    ({ data, error } = await update(withoutOptional(payload)));
  }

  if (error) throw error;
  return data;
}

export async function deleteMatch(id) {
  const { data, error } = await supabase
    .from("matches")
    .delete()
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
}

export async function deleteMatches(ids) {
  if (!ids?.length) return [];

  const { data, error } = await supabase
    .from("matches")
    .delete()
    .in("id", ids)
    .select();

  if (error) throw error;
  return data;
}
