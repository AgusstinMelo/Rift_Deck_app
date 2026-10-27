import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayPalSubscription, PayPalError, paypalFetch, syncPayPalSubscription } from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new MissingEnvError(name);
  }

  return value;
}

class MissingEnvError extends Error {
  missing: string;

  constructor(missing: string) {
    super("Missing environment variable");
    this.name = "MissingEnvError";
    this.missing = missing;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SERVICE_ROLE_KEY");
    const publicAppUrl = requireEnv("PUBLIC_APP_URL").replace(/\/$/, "");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
      return jsonResponse({
        error: "getUser failed",
        details: authError?.message || "Unauthorized",
      }, 401);
    }

    const body = await req.json().catch(() => ({}));

    // Al volver de PayPal se sincroniza en el momento, sin esperar al webhook.
    if (body.action === "sync") {
      const subscriptionId = typeof body.subscription_id === "string" ? body.subscription_id : "";
      if (!subscriptionId) {
        return jsonResponse({ error: "Invalid subscription_id" }, 400);
      }

      const subscription = await getPayPalSubscription(subscriptionId);
      const result = await syncPayPalSubscription(supabaseAdmin, subscription, { userId: user.id });

      return jsonResponse({ synced: Boolean(result), status: result?.status || null });
    }

    const planCode = typeof body.plan_code === "string" ? body.plan_code : "premium";

    const { data: planData, error: planError } = await supabaseAdmin
      .from("membership_plans")
      .select("*")
      .eq("code", planCode)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (planError) {
      return jsonResponse({
        error: "membership_plans query failed",
        details: planError.message,
      }, 500);
    }

    if (!planData || planCode === "trial") {
      return jsonResponse({ error: "Invalid plan_code" }, 400);
    }

    if (!planData.paypal_plan_id) {
      return jsonResponse({ error: "PayPal plan not configured" }, 503);
    }

    // Una suscripción paga vigente no se duplica; la prueba gratis sí puede convivir.
    const { data: activePaid, error: activePaidError } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .neq("provider", "trial")
      .in("status", ["active", "authorized"])
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (activePaidError) {
      return jsonResponse({
        error: "memberships query failed",
        details: activePaidError.message,
      }, 500);
    }

    if (activePaid?.id) {
      return jsonResponse({ error: "Membership already active" }, 409);
    }

    const accessFeatures = Array.isArray(planData.access_features)
      ? planData.access_features
      : planData.feature_key
      ? [planData.feature_key]
      : ["stats"];
    const intervalMonths = Number(planData.interval_months) || 1;
    const externalReference = `${user.id}:paypal:${planCode}`;

    const subscription = await paypalFetch("/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        plan_id: planData.paypal_plan_id,
        custom_id: externalReference,
        application_context: {
          brand_name: "Rift Deck",
          locale: "es-AR",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${publicAppUrl}/membresia/resultado?provider=paypal`,
          cancel_url: `${publicAppUrl}/membresia`,
        },
      }),
    });

    const checkoutUrl = String(
      subscription?.links?.find((link: { rel: string; href: string }) => link.rel === "approve")?.href || "",
    );
    const providerSubscriptionId = subscription?.id ? String(subscription.id) : "";

    if (!checkoutUrl || !providerSubscriptionId) {
      return jsonResponse({
        error: "Invalid PayPal response",
        raw: subscription,
      }, 502);
    }

    const now = new Date();
    const membershipData = {
      user_id: user.id,
      user_email: user.email,
      plan_code: planCode,
      provider: "paypal",
      provider_subscription_id: providerSubscriptionId,
      external_reference: externalReference,
      // memberships solo tiene amount_ars; currency indica que el monto es en dólares.
      amount_ars: Number(planData.amount_usd),
      currency: "USD",
      access_features: accessFeatures,
      status: "pending",
      checkout_url: checkoutUrl,
      updated_at: now.toISOString(),
      expires_at: addMonths(now, intervalMonths).toISOString(),
    };

    // Solo se reutiliza un checkout abandonado; la prueba y el historial no se pisan.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "paypal")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({
        error: "memberships upsert failed",
        details: existingError.message,
      }, 500);
    }

    const { error: writeError } = existing?.id
      ? await supabaseAdmin.from("memberships").update(membershipData).eq("id", existing.id)
      : await supabaseAdmin.from("memberships").insert({ ...membershipData, created_at: now.toISOString() });

    if (writeError) {
      return jsonResponse({
        error: "memberships upsert failed",
        details: writeError.message,
      }, 500);
    }

    return jsonResponse({
      checkout_url: checkoutUrl,
      provider_subscription_id: providerSubscriptionId,
    });
  } catch (error) {
    console.error("create-paypal-subscription failed:", error);

    if (error instanceof MissingEnvError) {
      return jsonResponse({
        error: "Missing environment variable",
        missing: error.missing,
      }, 500);
    }

    if (error instanceof PayPalError) {
      return jsonResponse({
        error: "PayPal request failed",
        status: error.status,
        details: error.details,
      }, 502);
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
