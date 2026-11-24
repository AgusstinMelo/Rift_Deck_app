import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GooglePlayError,
  isGooglePlayConfigured,
  PurchaseOwnedByOtherUserError,
  syncGooglePlaySubscription,
} from "../_shared/googlePlay.ts";

// Verificación de una compra de Google Play hecha desde la app de Android (Digital Goods API).
// La app manda el purchase token; acá se consulta a Google, se vincula al usuario y se da el
// acceso. También la usa la app al abrirse para recuperar compras (reinstalación, otro celular).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase environment variables" }, 500);
  }
  if (!isGooglePlayConfigured()) return jsonResponse({ error: "Google Play not configured" }, 503);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const purchaseToken = typeof body.purchase_token === "string" ? body.purchase_token.trim() : "";
  if (!purchaseToken || purchaseToken.length > 4096) return jsonResponse({ error: "Invalid purchase_token" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const membership = await syncGooglePlaySubscription(admin, purchaseToken, { userId: user.id, userEmail: user.email });
    return jsonResponse({ status: membership?.status || null });
  } catch (error) {
    if (error instanceof PurchaseOwnedByOtherUserError) {
      return jsonResponse({ error: "Purchase belongs to another account" }, 409);
    }
    if (error instanceof GooglePlayError) {
      console.error("google-play-verify: Google Play", error.status, error.details);
      // Token inexistente o de otra app: lo manda el cliente, no es un fallo nuestro.
      if (error.status === 400 || error.status === 404 || error.status === 410) {
        return jsonResponse({ error: "Invalid purchase_token" }, 400);
      }
      return jsonResponse({ error: "Google Play request failed" }, 502);
    }
    console.error("google-play-verify failed", error);
    return jsonResponse({ error: "Unexpected error" }, 500);
  }
});
