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

// Columnas agregadas por migraciones recientes (202611160002: kills de equipo;
// 202611170002: build vinculada). Si la migración todavía no se aplicó, la partida se
// guarda igual sin ellas.
const OPTIONAL_COLUMNS = ["team_kills", "enemy_team_kills", "build_id"];
const isMissingColumn = error => error?.code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(error?.message || "");
const withoutOptional = payload => Object.fromEntries(Object.entries(payload).filter(([key]) => !OPTIONAL_COLUMNS.includes(key)));
const hasOptional = payload => OPTIONAL_COLUMNS.some(key => key in payload);

export async function createMatch(user, payload) {
  if (!user?.id) {
    throw new Error("User id is required to create a match.");
  }

  const { client_request_id: _clientRequestId, participants, ...matchPayload } = payload;

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
  if (participants?.length) await saveParticipants(user, data.id, participants);
  return data;
}

/**
 * Los 10 jugadores de una partida cargada con capturas (match_participants), para el
 * Coach. Es un extra: si falla (por ejemplo, la tabla todavía no existe) la partida ya
 * quedó guardada y solo se avisa en la consola.
 */
async function saveParticipants(user, matchId, participants) {
  const rows = participants.map(player => ({
    match_id: matchId,
    user_id: user.id,
    team: player.team,
    lane: player.lane || null,
    is_self: Boolean(player.is_self),
    champion: player.champion || null,
    kills: player.kills ?? null,
    deaths: player.deaths ?? null,
    assists: player.assists ?? null,
    gold: player.gold ?? null,
    spells: player.spells || [],
    items: player.items || [],
    runes: player.runes || [],
    // Pestaña DATOS (opcional).
    damage_dealt: player.damage_dealt ?? null,
    damage_taken: player.damage_taken ?? null,
    healing_shielding: player.healing_shielding ?? null,
    teamfight_participation: player.teamfight_participation ?? null,
  }));
  let { error } = await supabase.from("match_participants").insert(rows);
  // Sin la migración de DATOS (columnas nuevas) se guarda igual lo del marcador y las runas.
  if (error && isMissingColumn(error)) {
    const DATOS_COLUMNS = ["damage_dealt", "damage_taken", "healing_shielding", "teamfight_participation"];
    ({ error } = await supabase.from("match_participants").insert(rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !DATOS_COLUMNS.includes(key))))));
  }
  if (error) console.warn("No se guardaron los jugadores de la partida:", error.message || error);
}

const PARTICIPANT_COLUMNS = "match_id, team, lane, is_self, champion, kills, deaths, assists, gold, spells, items, runes, damage_dealt, damage_taken, healing_shielding, teamfight_participation";

/**
 * Jugadores guardados de las partidas del usuario (para el Coach), de a páginas de
 * MATCH_PAGE_SIZE filas. Si la tabla o las columnas de DATOS todavía no existen
 * (migración pendiente), devuelve lo que pueda o [] y el Coach sigue sin estos datos.
 */
export async function getUserMatchParticipants(user) {
  if (!user?.id) return [];
  const rows = [];
  for (let from = 0; from < MAX_USER_MATCHES * 10; from += MATCH_PAGE_SIZE) {
    let { data, error } = await supabase
      .from("match_participants")
      .select(PARTICIPANT_COLUMNS)
      .eq("user_id", user.id)
      .order("id", { ascending: true })
      .range(from, from + MATCH_PAGE_SIZE - 1);
    if (error && isMissingColumn(error)) {
      ({ data, error } = await supabase
        .from("match_participants")
        .select("match_id, team, lane, is_self, champion, kills, deaths, assists, gold, spells, items, runes")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(from, from + MATCH_PAGE_SIZE - 1));
    }
    if (error) return rows;
    rows.push(...(data || []));
    if (!data || data.length < MATCH_PAGE_SIZE) break;
  }
  return rows;
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
