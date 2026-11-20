// Límite diario de los sugeridores: se consume una ejecución antes de llamar a la IA
// y se devuelve si la IA falla. Ver 202610270004_suggester_daily_limit.sql.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SuggesterFeature = "build" | "champions";

export const DAILY_LIMIT_MESSAGE =
  "Llegaste al límite de 5 ejecuciones diarias de la cuenta free. Volvé mañana o pasate a Premium para usarlo sin límite.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase configuration");
  return createClient(supabaseUrl, serviceRoleKey);
}

/** El cliente manda un request_id por ejecución; si no viene o es inválido se genera uno. */
export function normalizeRequestId(value: unknown) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : crypto.randomUUID();
}

export async function consumeSuggesterRun(userId: string, feature: SuggesterFeature, requestId: string) {
  const { data, error } = await getAdminClient().rpc("consume_suggester_run", {
    p_user_id: userId,
    p_feature: feature,
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as { allowed: boolean; reason?: string; used: number; limit: number | null };
}

export type SuggesterRunStatus = "running" | "success" | "failed" | "usage_limit";

export interface SuggesterRunRecord {
  status: SuggesterRunStatus;
  errorKind?: string | null;
  errorMessage?: string | null;
  model?: string | null;
  durationMs?: number | null;
  meta?: Record<string, unknown>;
}

/**
 * Registro de la ejecución en suggester_runs (202611200025_suggester_runs.sql). Nunca rompe
 * la respuesta al usuario: si falla, solo queda en los logs de la función.
 */
export async function recordSuggesterRun(userId: string, feature: SuggesterFeature, requestId: string, run: SuggesterRunRecord) {
  try {
    const { error } = await getAdminClient().rpc("record_suggester_run", {
      p_user_id: userId,
      p_feature: feature,
      p_request_id: requestId,
      p_status: run.status,
      p_error_kind: run.errorKind ?? null,
      p_error_message: run.errorMessage ?? null,
      p_model: run.model ?? null,
      p_duration_ms: run.durationMs == null ? null : Math.round(run.durationMs),
      p_meta: run.meta ?? {},
    });
    if (error) console.error("record_suggester_run failed", { feature, requestId, error });
  } catch (error) {
    console.error("record_suggester_run failed", { feature, requestId, error });
  }
}

/** Solo los datos de contexto conocidos y cortos que manda el cliente (campeón, línea...). */
export function runMeta(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? String(source[key]).slice(0, 60) : undefined);
  return {
    champion: text("champion"),
    role: text("role"),
    patch_version: text("patch_version"),
    themed: typeof source.themed === "boolean" ? source.themed : undefined,
  };
}

export async function refundSuggesterRun(userId: string, feature: SuggesterFeature, requestId: string) {
  const { error } = await getAdminClient().rpc("refund_suggester_run", {
    p_user_id: userId,
    p_feature: feature,
    p_request_id: requestId,
  });
  if (error) console.error("refund_suggester_run failed", { feature, requestId, error });
}
