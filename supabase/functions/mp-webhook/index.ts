import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
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

function errorResponse(error: unknown, status = 500) {
  console.error("mp-webhook error", error);

  return jsonResponse({
    error: error instanceof Error ? error.message : String(error),
  }, status);
}

function addMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function mapStatusToMembership(status: unknown) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  const map: Record<string, string> = {
    authorized: "active",
    active: "active",
    approved: "active",
    pending: "pending",
    paused: "paused",
    cancelled: "cancelled",
    canceled: "cancelled",
    rejected: "payment_failed",
    payment_failed: "payment_failed",
  };

  return map[normalized] || "pending";
}

function parseSignatureHeader(signatureHeader: string | null) {
  if (!signatureHeader) return null;

  return signatureHeader.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

async function validateMercadoPagoSignature(
  payload: Record<string, any>,
  signatureHeader: string | null,
  requestId: string | null,
  webhookSecret: string,
) {
  const parsedSignature = parseSignatureHeader(signatureHeader);
  const timestamp = parsedSignature?.ts;
  const receivedSignature = parsedSignature?.v1;
  const payloadId = payload.data?.id || payload.id;

  if (!timestamp || !receivedSignature || !requestId || !payloadId) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const manifest = `id:${payloadId};request-id:${requestId};ts:${timestamp};`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const expectedSignature = toHex(signature);

  return timingSafeEqual(expectedSignature, receivedSignature);
}

function buildEventId(payload: Record<string, any>, requestId: string | null) {
  if (payload.id) return String(payload.id);

  if (payload.data?.id && payload.type && payload.action) {
    return `${payload.data.id}:${payload.type}:${payload.action}`;
  }

  if (requestId) return requestId;

  return crypto.randomUUID();
}

async function getMPSubscription(subscriptionId: string, accessToken: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function getMPPayment(paymentId: string, accessToken: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ received: true });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const mercadoPagoAccessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const mercadoPagoWebhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    const signatureHeader = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Missing Supabase configuration");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const rawBody = await req.text();
    let payload: Record<string, any>;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    console.log("mp-webhook payload", payload);

    if (mercadoPagoWebhookSecret) {
      const isValidSignature = await validateMercadoPagoSignature(
        payload,
        signatureHeader,
        requestId,
        mercadoPagoWebhookSecret,
      );

      if (!isValidSignature) {
        return jsonResponse({ error: "Invalid Mercado Pago signature" }, 401);
      }
    } else {
      console.warn("MERCADOPAGO_WEBHOOK_SECRET missing; skipping signature validation");
    }

    const eventId = buildEventId(payload, requestId);
    const eventType = payload.type || payload.topic || "unknown";
    const action = payload.action || "";
    const resourceId = payload.data?.id || payload.id;

    const { data: existingEvent, error: existingEventError } = await supabaseAdmin
      .from("payment_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .limit(1)
      .maybeSingle();

    if (existingEventError) {
      return errorResponse(existingEventError);
    }

    if (existingEvent?.processed === true) {
      console.warn("mp-webhook duplicate", { eventId });
      return jsonResponse({ received: true, duplicate: true });
    }

    let paymentEvent = existingEvent;

    if (paymentEvent?.id) {
      const { data: updatedEvent, error: eventUpdateError } = await supabaseAdmin
        .from("payment_events")
        .update({
          event_type: eventType,
          action,
          raw_payload: payload,
          processed: false,
        })
        .eq("id", paymentEvent.id)
        .select("id, processed")
        .single();

      if (eventUpdateError) {
        return errorResponse(eventUpdateError);
      }

      paymentEvent = updatedEvent;
    } else {
      const { data: insertedEvent, error: eventInsertError } = await supabaseAdmin
        .from("payment_events")
        .insert({
          provider: "mercadopago",
          event_id: eventId,
          event_type: eventType,
          action,
          raw_payload: payload,
          processed: false,
          created_at: new Date().toISOString(),
        })
        .select("id, processed")
        .single();

      if (eventInsertError) {
        return errorResponse(eventInsertError);
      }

      paymentEvent = insertedEvent;
    }

    if (!mercadoPagoAccessToken || !resourceId) {
      console.warn("mp-webhook Mercado Pago lookup failed", { eventId, hasAccessToken: Boolean(mercadoPagoAccessToken), resourceId });
      return jsonResponse({ received: true, processed: false, warning: "Mercado Pago lookup failed" });
    }

    let subscriptionData: Record<string, any> | null = null;
    let paymentData: Record<string, any> | null = null;
    let lookupFailed = false;

    try {
      if (eventType === "subscription_preapproval" || eventType === "preapproval") {
        subscriptionData = await getMPSubscription(String(resourceId), mercadoPagoAccessToken);
        lookupFailed = !subscriptionData;
      } else if (eventType === "subscription_authorized_payment") {
        paymentData = await getMPPayment(String(resourceId), mercadoPagoAccessToken);
        lookupFailed = !paymentData;
        if (paymentData?.preapproval_id) {
          subscriptionData = await getMPSubscription(String(paymentData.preapproval_id), mercadoPagoAccessToken);
          lookupFailed = !subscriptionData;
        }
      } else if (eventType === "payment" || eventType === "payments") {
        paymentData = await getMPPayment(String(resourceId), mercadoPagoAccessToken);
        lookupFailed = !paymentData;
        if (paymentData?.preapproval_id) {
          subscriptionData = await getMPSubscription(String(paymentData.preapproval_id), mercadoPagoAccessToken);
          lookupFailed = !subscriptionData;
        } else if (paymentData?.metadata?.preapproval_id) {
          subscriptionData = await getMPSubscription(String(paymentData.metadata.preapproval_id), mercadoPagoAccessToken);
          lookupFailed = !subscriptionData;
        }
      }
    } catch (lookupError) {
      console.warn("mp-webhook Mercado Pago lookup failed", { eventId, eventType, resourceId, lookupError });
      return jsonResponse({ received: true, processed: false, warning: "Mercado Pago lookup failed" });
    }

    if (lookupFailed) {
      console.warn("mp-webhook Mercado Pago lookup failed", { eventId, eventType, resourceId });
      return jsonResponse({ received: true, processed: false, warning: "Mercado Pago lookup failed" });
    }

    const realStatus = subscriptionData?.status || paymentData?.status;
    const mappedStatus = mapStatusToMembership(realStatus);
    const providerSubscriptionId = subscriptionData?.id || paymentData?.preapproval_id;
    const providerPaymentId = paymentData?.id ? String(paymentData.id) : null;
    const externalReference =
      subscriptionData?.external_reference ||
      paymentData?.external_reference ||
      payload.external_reference;

    let membership: Record<string, any> | null = null;

    if (providerSubscriptionId) {
      const { data, error: membershipSelectError } = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("provider_subscription_id", String(providerSubscriptionId))
        .limit(1)
        .maybeSingle();

      if (membershipSelectError) {
        return errorResponse(membershipSelectError);
      }

      membership = data;
    }

    if (!membership && externalReference) {
      const { data, error: membershipSelectError } = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("external_reference", String(externalReference))
        .limit(1)
        .maybeSingle();

      if (membershipSelectError) {
        return errorResponse(membershipSelectError);
      }

      membership = data;
    }

    if (!membership && providerPaymentId) {
      const { data, error: membershipSelectError } = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("provider_payment_id", providerPaymentId)
        .limit(1)
        .maybeSingle();

      if (membershipSelectError) {
        return errorResponse(membershipSelectError);
      }

      membership = data;
    }

    if (membership?.id) {
      const now = new Date();
      const periodEnd = addMonth(now).toISOString();
      const update: Record<string, any> = {
        status: mappedStatus,
        updated_at: now.toISOString(),
      };

      if (providerSubscriptionId) {
        update.provider_subscription_id = String(providerSubscriptionId);
      }

      if (providerPaymentId) {
        update.provider_payment_id = providerPaymentId;
      }

      if (mappedStatus === "active") {
        update.started_at = membership.started_at || now.toISOString();
        update.current_period_start = now.toISOString();
        update.current_period_end = periodEnd;
        update.expires_at = periodEnd;
        update.access_features = Array.isArray(membership.access_features) && membership.access_features.length > 0
          ? membership.access_features
          : ["stats"];
      }

      const { error: membershipUpdateError } = await supabaseAdmin
        .from("memberships")
        .update(update)
        .eq("id", membership.id);

      if (membershipUpdateError) {
        return errorResponse(membershipUpdateError);
      }

      const { error: paymentEventUpdateError } = await supabaseAdmin
        .from("payment_events")
        .update({
          processed: true,
          user_id: membership.user_id,
          user_email: membership.user_email,
          provider_subscription_id: providerSubscriptionId ? String(providerSubscriptionId) : undefined,
          provider_payment_id: providerPaymentId || undefined,
          status: mappedStatus,
        })
        .eq("id", paymentEvent.id);

      if (paymentEventUpdateError) {
        return errorResponse(paymentEventUpdateError);
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
});
