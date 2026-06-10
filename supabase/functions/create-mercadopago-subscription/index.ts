import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function isValidEmail(value: unknown) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function addMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
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
    const mercadoPagoAccessToken = requireEnv("MERCADOPAGO_ACCESS_TOKEN");
    const publicAppUrl = requireEnv("PUBLIC_APP_URL");

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
    const mpEmail = typeof body.mp_email === "string" ? body.mp_email.trim() : "";

    if (!isValidEmail(mpEmail)) {
      return jsonResponse({ error: "Invalid mp_email" }, 400);
    }

    const { data: planData, error: planError } = await supabaseAdmin
      .from("membership_plans")
      .select("*")
      .eq("code", "premium")
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (planError) {
      return jsonResponse({
        error: "membership_plans query failed",
        details: planError.message,
      }, 500);
    }

    const accessFeatures = Array.isArray(planData?.access_features)
      ? planData.access_features
      : planData?.feature_key
      ? [planData.feature_key]
      : ["stats"];

    const plan = {
      amount_ars: Number(planData?.amount_ars || 2000),
      currency: planData?.currency || "ARS",
      access_features: accessFeatures,
    };

    const externalReference = `${user.id}:premium`;
    const backUrl = `${publicAppUrl.replace(/\/$/, "")}/stats`;
    const mpBody = {
      reason: "Rift Deck Premium",
      external_reference: externalReference,
      payer_email: mpEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.amount_ars,
        currency_id: "ARS",
      },
      back_url: backUrl,
      status: "pending",
    };

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    if (!mpResponse.ok) {
      return jsonResponse({
        error: "Mercado Pago preapproval failed",
        status: mpResponse.status,
        details: await mpResponse.text(),
      }, 502);
    }

    const rawText = await mpResponse.text();
    let raw: Record<string, unknown>;

    try {
      raw = JSON.parse(rawText);
    } catch {
      raw = { raw: rawText };
    }

    const checkoutUrl = String(raw.init_point || raw.sandbox_init_point || "");
    const providerSubscriptionId = raw.id ? String(raw.id) : "";

    if (!checkoutUrl || !providerSubscriptionId) {
      return jsonResponse({
        error: "Invalid Mercado Pago response",
        raw,
      }, 502);
    }

    const now = new Date();
    const membershipData = {
      user_id: user.id,
      user_email: user.email,
      plan_code: "premium",
      provider: "mercadopago",
      provider_subscription_id: providerSubscriptionId,
      external_reference: externalReference,
      amount_ars: plan.amount_ars,
      currency: plan.currency,
      access_features: plan.access_features,
      status: "pending",
      checkout_url: checkoutUrl,
      updated_at: now.toISOString(),
      expires_at: addMonth(now).toISOString(),
    };

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return jsonResponse({
        error: "memberships upsert failed",
        details: existingError.message,
      }, 500);
    }

    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("memberships")
        .update(membershipData)
        .eq("id", existing.id);

      if (updateError) {
        return jsonResponse({
          error: "memberships upsert failed",
          details: updateError.message,
        }, 500);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("memberships")
        .insert({
          ...membershipData,
          created_at: now.toISOString(),
        });

      if (insertError) {
        return jsonResponse({
          error: "memberships upsert failed",
          details: insertError.message,
        }, 500);
      }
    }

    return jsonResponse({
      checkout_url: checkoutUrl,
      provider_subscription_id: providerSubscriptionId,
      raw,
    });
  } catch (error) {
    console.error("create-mercadopago-subscription failed:", error);

    if (error instanceof MissingEnvError) {
      return jsonResponse({
        error: "Missing environment variable",
        missing: error.missing,
      }, 500);
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
