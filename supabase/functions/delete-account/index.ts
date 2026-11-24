import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paypalFetch } from "../_shared/paypal.ts";
import { cancelSubscription as cancelGooglePlaySubscription } from "../_shared/googlePlay.ts";

// Eliminación de cuenta (RGPD art. 17): borra los datos del usuario autenticado y
// después su usuario de Supabase Auth. Si algún borrado falla, no elimina el usuario
// para que la operación pueda reintentarse sin dejar datos huérfanos.
//
// Antes cancela las suscripciones que se renuevan (si no, se le seguiría cobrando) y
// conserva anonimizados los datos de facturación (obligación fiscal, hasta 6 años): las
// membresías pagas y los eventos de pago quedan sin email ni datos del pagador, y al borrar
// el usuario su user_id pasa a null (ON DELETE SET NULL).

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
  ["coach_insight_log", "user_id", "id"],
  ["matches", "user_id", "id"],
  ["matches", "created_by", "email"],
  ["builds", "user_id", "id"],
  ["builds", "created_by", "email"],
  ["bug_reports", "user_id", "id"],
  ["bug_reports", "user_email", "email"],
  ["profiles", "id", "id"],
];

// Estados en los que una suscripción todavía puede cobrar.
const RENEWING_STATUSES = ["active", "authorized", "pending", "paused", "payment_failed"];

type MembershipRow = {
  id: string;
  provider: string;
  status: string;
  plan_code: string;
  provider_subscription_id: string | null;
};

async function cancelMercadoPago(subscriptionId: string) {
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN missing");
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscriptionId)}`, {
    method: "PUT",
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" }),
  });
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${await response.text()}`);
}

async function cancelPayPal(subscriptionId: string) {
  try {
    await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cuenta de Rift Deck eliminada" }),
    });
  } catch (error) {
    // 422: ya estaba cancelada o vencida.
    if ((error as { status?: number })?.status !== 422) throw error;
  }
}

/** Cancela la renovación de cada suscripción del usuario. Devuelve los errores. */
async function cancelRenewingSubscriptions(admin: any, userId: string) {
  const { data, error } = await admin
    .from("memberships")
    .select("id, provider, status, plan_code, provider_subscription_id")
    .eq("user_id", userId)
    .in("provider", ["mercadopago", "paypal", "google_play"])
    .in("status", RENEWING_STATUSES)
    .not("provider_subscription_id", "is", null);
  if (error) return [`memberships: ${error.message}`];

  const rows: MembershipRow[] = data || [];
  const failures: string[] = [];

  for (const row of rows) {
    const subscriptionId = String(row.provider_subscription_id);
    try {
      if (row.provider === "mercadopago") await cancelMercadoPago(subscriptionId);
      else if (row.provider === "paypal") await cancelPayPal(subscriptionId);
      else if (row.provider === "google_play") {
        const { data: plan } = await admin
          .from("membership_plans")
          .select("google_play_product_id")
          .eq("code", row.plan_code)
          .maybeSingle();
        if (!plan?.google_play_product_id) throw new Error(`plan ${row.plan_code} sin producto de Google Play`);
        await cancelGooglePlaySubscription(plan.google_play_product_id, subscriptionId);
      }

      await admin
        .from("memberships")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), next_payment_date: null })
        .eq("id", row.id);
    } catch (cancelError) {
      // Un checkout nunca completado no cobra: si no se puede cancelar, no frena la baja.
      if (row.status === "pending") continue;
      failures.push(`${row.provider} ${row.id}: ${cancelError instanceof Error ? cancelError.message : cancelError}`);
    }
  }

  return failures;
}

/** Borra las pruebas gratis y anonimiza lo que se conserva por obligación fiscal. */
async function anonymizeBilling(admin: any, userId: string) {
  const failures: string[] = [];
  const steps = [
    admin.from("memberships").delete().eq("user_id", userId).eq("provider", "trial"),
    admin.from("memberships").update({ user_email: null, checkout_url: null }).eq("user_id", userId),
    // raw_payload trae datos del pagador (email, nombre): queda solo un marcador.
    admin.from("payment_events").update({ user_email: null, raw_payload: { anonymized: true } }).eq("user_id", userId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error && !MISSING_CODES.has(error.code || "")) failures.push(error.message);
  }
  return failures;
}

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

  const cancelFailures = await cancelRenewingSubscriptions(admin, user.id);
  if (cancelFailures.length) {
    console.error("delete-account: no se pudieron cancelar suscripciones", user.id, cancelFailures);
    return jsonResponse({ error: "No pudimos cancelar tu suscripción. Cancélala desde tu medio de pago y vuelve a intentarlo, o escríbenos." }, 502);
  }

  const failures: string[] = await anonymizeBilling(admin, user.id);

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
