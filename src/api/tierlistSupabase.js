import { supabase } from "@/lib/supabaseClient";
import { normalizeTierlistSnapshotRecord } from '@/utils/tierlist';

export async function getTierlistEntries(order = "-ranking_final", limit = 1000, filters = {}) {
  const orderConfig = order === "-updated_at"
    ? { column: "updated_at", ascending: false }
    : { column: "ranking_final", ascending: false };

  const requestedSnapshotKeys = [filters.snapshotKey, ...(filters.snapshotKeys || [])].filter(Boolean);

  const buildQuery = ({ useSnapshotColumns = true, fallbackLimit = limit } = {}) => {
    let query = supabase
      .from("tierlist_entries")
      .select("*")
      .order(orderConfig.column, { ascending: orderConfig.ascending });

    if (filters.patch) query = query.eq("patch", filters.patch);
    if (filters.patches?.length) query = query.in("patch", filters.patches);

    if (useSnapshotColumns) {
      if (filters.snapshotKey) query = query.eq("snapshot_key", filters.snapshotKey);
      if (filters.snapshotKeys?.length) query = query.in("snapshot_key", filters.snapshotKeys);
      if (filters.snapshotDate) query = query.eq("snapshot_date", filters.snapshotDate);
    } else if (requestedSnapshotKeys.length) {
      const patches = [...new Set(requestedSnapshotKeys.map(key => key.split('::')[0]).filter(Boolean))];
      if (patches.length) {
        query = query.or(patches.map(patch => `patch.ilike.${patch}%`).join(','));
      }
    }

    if (fallbackLimit) query = query.limit(fallbackLimit);
    return query;
  };

  let { data, error } = await buildQuery();

  // Compatibility path for databases that have not backfilled snapshot_key yet.
  if (requestedSnapshotKeys.length && (error || !data?.length)) {
    const fallback = await buildQuery({
      useSnapshotColumns: false,
      fallbackLimit: Math.max(Number(limit) || 0, 5000),
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  let normalized = (data || []).map(normalizeTierlistSnapshotRecord);
  if (requestedSnapshotKeys.length) {
    const requested = new Set(requestedSnapshotKeys);
    normalized = normalized.filter(entry => requested.has(entry.snapshot_key));
  }
  if (filters.snapshotDate) {
    normalized = normalized.filter(entry => entry.snapshot_date === filters.snapshotDate);
  }

  return normalized;
}

export async function getTierlistExecutions(limit = 10) {
  let query = supabase
    .from("tierlist_executions")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .order("executed_at", { ascending: false });

  if (limit) {
    query = query.limit(limit * 3);
  }

  let { data, error } = await query;

  // Old schemas do not have snapshot_date yet. Keep the app readable while
  // the migration is being applied and derive the snapshot from legacy patch.
  if (error) {
    let fallbackQuery = supabase
      .from("tierlist_executions")
      .select("*")
      .order("executed_at", { ascending: false });
    if (limit) fallbackQuery = fallbackQuery.limit(limit * 3);
    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  const seenSnapshots = new Set();
  const uniqueExecutions = (data || []).map(normalizeTierlistSnapshotRecord).filter(execution => {
    const snapshotIdentity = execution.snapshot_key || String(execution.id);
    if (seenSnapshots.has(snapshotIdentity)) return false;
    seenSnapshots.add(snapshotIdentity);
    return true;
  });

  return limit ? uniqueExecutions.slice(0, limit) : uniqueExecutions;
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
