import { supabase } from "@/lib/supabaseClient";

export async function getUserMatches(user, limit = 1000) {
  if (!user) return [];

  let data = [];

  if (user.id) {
    const { data: userMatches, error } = await supabase
      .from("matches")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = userMatches || [];
  }

  if (data.length === 0 && user.email) {
    const { data: legacyMatches, error } = await supabase
      .from("matches")
      .select("*")
      .eq("created_by", user.email)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;
    data = legacyMatches || [];
  }

  return data;
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
