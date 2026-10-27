import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayPalSubscription, syncPayPalSubscription, verifyPayPalWebhook } from "../_shared/paypal.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(error: unknown, status = 500) {
  console.error("paypal-webhook error", error);

  return jsonResponse({
    error: error instanceof Error ? error.message : String(error),
  }, status);
}

// Eventos de suscripción traen la suscripción en resource; PAYMENT.SALE.* trae el
// cobro y la suscripción en billing_agreement_id.
function getSubscriptionId(eventType: string, resource: Record<string, any>) {
  if (eventType.startsWith("BILLING.SUBSCRIPTION.")) return resource?.id ? String(resource.id) : null;
  return resource?.billing_agreement_id ? String(resource.billing_agreement_id) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ received: true });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

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

    if (!await verifyPayPalWebhook(req.headers, rawBody)) {
      return jsonResponse({ error: "Invalid PayPal signature" }, 401);
    }

    const eventId = String(payload.id || crypto.randomUUID());
    const eventType = String(payload.event_type || "unknown");
    const resource = payload.resource || {};
    const subscriptionId = getSubscriptionId(eventType, resource);
    const paymentId = eventType === "PAYMENT.SALE.COMPLETED" && resource.id ? String(resource.id) : null;

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
      return jsonResponse({ received: true, duplicate: true });
    }

    let paymentEventId = existingEvent?.id || null;

    if (!paymentEventId) {
      const { data: insertedEvent, error: eventInsertError } = await supabaseAdmin
        .from("payment_events")
        .insert({
          provider: "paypal",
          event_id: eventId,
          event_type: eventType,
          action: resource.status || "",
          raw_payload: payload,
          processed: false,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      // El registro es auditoría: si falla, el evento se procesa igual.
      if (eventInsertError) {
        console.error("paypal-webhook payment_events insert failed", eventInsertError);
      }
      paymentEventId = insertedEvent?.id || null;
    }

    if (!subscriptionId) {
      return jsonResponse({ received: true, ignored: eventType });
    }

    // El estado se toma siempre de la API: los eventos pueden llegar desordenados.
    const subscription = await getPayPalSubscription(subscriptionId);
    const result = await syncPayPalSubscription(supabaseAdmin, subscription, { paymentId });

    if (!result) {
      console.warn("paypal-webhook subscription without membership", { eventId, subscriptionId });
    }

    if (paymentEventId && result) {
      const { error: paymentEventUpdateError } = await supabaseAdmin
        .from("payment_events")
        .update({
          processed: true,
          user_id: result.membership.user_id,
          user_email: result.membership.user_email,
          provider_subscription_id: subscriptionId,
          provider_payment_id: paymentId || undefined,
          status: result.status,
        })
        .eq("id", paymentEventId);

      if (paymentEventUpdateError) {
        console.error("paypal-webhook payment_events update failed", paymentEventUpdateError);
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    // Un 500 hace que PayPal reintente el evento más tarde.
    return errorResponse(error);
  }
});
