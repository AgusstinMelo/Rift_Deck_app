import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Eliminación de cuenta (RGPD art. 17): borra los datos del usuario autenticado y
// después su usuario de Supabase Auth. Si algún borrado falla, no elimina el usuario
// para que la operación pueda reintentarse sin dejar datos huérfanos.

const CONFIRM_TEXT = "ELIMINAR MI CUENTA";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// [tabla, columna, valor]: "id" usa el id del usuario; "email", su correo
// (registros antiguos que solo guardaban el email del autor).
const DELETIONS: Array<[string, string, "id" | "email"]> = [
  ["personal_goal_checkins", "user_id", "id"],
  ["personal_goals", "user_id", "id"],
  ["matches", "user_id", "id"],
  ["matches", "created_by", "email"],
  ["builds", "user_id", "id"],
  ["builds", "created_by", "email"],
  ["bug_reports", "user_id", "id"],
  ["bug_reports", "user_email", "email"],
  // Pagos aún no activos. Cuando lo estén, los datos de facturación deberán
  // conservarse (anonimizados) durante el plazo legal en lugar de borrarse.
  ["payment_events", "user_id", "id"],
  ["memberships", "user_id", "id"],
  ["profiles", "id", "id"],
];

// Tabla o columna inexistente en este proyecto: se omite ese paso.
const MISSING_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== CONFIRM_TEXT) {
    return jsonResponse({ error: "Falta la confirmación para eliminar la cuenta." }, 400);
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const failures: string[] = [];

  for (const [table, column, valueKind] of DELETIONS) {
    const value = valueKind === "email" ? user.email : user.id;
    if (!value) continue;

    const { error } = await admin.from(table).delete().eq(column, value);
    if (error && !MISSING_CODES.has(error.code || "")) {
      failures.push(`${table}.${column}: ${error.message}`);
    }
  }

  if (failures.length) {
    console.error("delete-account: fallaron borrados", user.id, failures);
    return jsonResponse({ error: "No se pudieron eliminar todos tus datos. Inténtalo de nuevo o escríbenos." }, 500);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("delete-account: no se pudo eliminar el usuario", user.id, deleteUserError);
    return jsonResponse({ error: "Tus datos se eliminaron, pero no se pudo cerrar la cuenta. Escríbenos para completarlo." }, 500);
  }

  return jsonResponse({ status: "deleted" });
});
