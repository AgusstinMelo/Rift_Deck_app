import { supabase } from "@/lib/supabaseClient";

export async function getTierlistEntries(order = "-ranking_final", limit = 1000, filters = {}) {
  const orderConfig = order === "-updated_at"
    ? { column: "updated_at", ascending: false }
    : { column: "ranking_final", ascending: false };

  let query = supabase
    .from("tierlist_entries")
    .select("*")
    .order(orderConfig.column, { ascending: orderConfig.ascending });

  if (filters.patch) {
    query = query.eq("patch", filters.patch);
  }

  if (filters.patches?.length) {
    query = query.in("patch", filters.patches);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTierlistExecutions(limit = 10) {
  let query = supabase
    .from("tierlist_executions")
    .select("*")
    .order("executed_at", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getTierlistConfig() {
  const { data, error } = await supabase
    .from("tierlist_configs")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function saveTierlistConfig(payload) {
  const currentConfig = await getTierlistConfig();

  if (currentConfig?.id) {
    const { data, error } = await supabase
      .from("tierlist_configs")
      .update(payload)
      .eq("id", currentConfig.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("tierlist_configs")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function runTierlistUpdate(config) {
  const { data, error } = await supabase.functions.invoke("update-tierlist", {
    body: { config },
  });

  if (error) throw error;
  return data;
}

export const runTierlistUpdateStub = runTierlistUpdate;
