import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GooglePlayError, getPackageName, syncGooglePlaySubscription } from "../_shared/googlePlay.ts";

// Notificaciones en tiempo real de Google Play (RTDN) por una suscripción push de Pub/Sub:
// renovaciones, cancelaciones, pagos fallidos, reembolsos. No se confía en el contenido del
// mensaje: con el purchase token se consulta el estado real a Google.
//
// Se despliega sin verificación de JWT de Supabase (Pub/Sub no lo manda) y se protege con un
// secreto en la URL del push: .../google-play-webhook?token=<GOOGLE_PLAY_WEBHOOK_TOKEN>
//
// Respuesta 2xx = Pub/Sub da el mensaje por entregado; otra cosa = lo reintenta.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const expectedToken = Deno.env.get("GOOGLE_PLAY_WEBHOOK_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
  if (!expectedToken || !supabaseUrl || !serviceRoleKey) {
    console.error("google-play-webhook: faltan variables de entorno");
    return jsonResponse({ error: "Not configured" }, 500);
  }

  const receivedToken = new URL(req.url).searchParams.get("token") || "";
  if (!timingSafeEqual(receivedToken, expectedToken)) return jsonResponse({ error: "Unauthorized" }, 401);

  const envelope = await req.json().catch(() => null);
  const message = envelope?.message;
  let notification: Record<string, any> | null = null;
  try {
    notification = message?.data ? JSON.parse(atob(message.data)) : null;
  } catch {
    notification = null;
  }
  // Mensaje ilegible: reintentarlo no lo arregla.
  if (!notification) return jsonResponse({ received: true, ignored: "invalid message" });

  if (notification.packageName && notification.packageName !== getPackageName()) {
    return jsonResponse({ received: true, ignored: "other package" });
  }
  // Prueba desde Play Console ("Enviar notificación de prueba").
  if (notification.testNotification) {
    console.log("google-play-webhook: notificación de prueba recibida");
    return jsonResponse({ received: true, test: true });
  }

  const purchaseToken = notification.subscriptionNotification?.purchaseToken
    || notification.voidedPurchaseNotification?.purchaseToken;
  if (!purchaseToken) return jsonResponse({ received: true, ignored: "not a subscription" });

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const eventId = `google_play:${message.messageId || message.message_id || crypto.randomUUID()}`;
  const eventType = notification.subscriptionNotification
    ? `subscription:${notification.subscriptionNotification.notificationType}`
    : "voided_purchase";

  const { data: existingEvent, error: eventLookupError } = await admin
    .from("payment_events")
    .select("id, processed")
    .eq("event_id", eventId)
    .limit(1)
    .maybeSingle();
  if (eventLookupError) {
    console.error("google-play-webhook: payment_events", eventLookupError);
    return jsonResponse({ error: "Database error" }, 500);
  }
  if (existingEvent?.processed) return jsonResponse({ received: true, duplicate: true });

  let eventRowId = existingEvent?.id;
  if (!eventRowId) {
    const { data: inserted, error: insertError } = await admin
      .from("payment_events")
      .insert({
        provider: "google_play",
        event_id: eventId,
        event_type: eventType,
        action: notification.subscriptionNotification?.subscriptionId || "",
        raw_payload: notification,
        processed: false,
        provider_subscription_id: purchaseToken,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError) {
      console.error("google-play-webhook: payment_events insert", insertError);
      return jsonResponse({ error: "Database error" }, 500);
    }
    eventRowId = inserted.id;
  }

  try {
    const membership = await syncGooglePlaySubscription(admin, purchaseToken);
    await admin
      .from("payment_events")
      .update({
        processed: true,
        user_id: membership?.user_id || null,
        user_email: membership?.user_email || null,
        provider_payment_id: membership?.provider_payment_id || null,
        status: membership?.status || null,
      })
      .eq("id", eventRowId);

    // Sin fila: la compra todavía no se verificó desde la app (llega enseguida y la crea).
    return jsonResponse({ received: true, synced: Boolean(membership) });
  } catch (error) {
    if (error instanceof GooglePlayError && (error.status === 400 || error.status === 404 || error.status === 410)) {
      console.warn("google-play-webhook: token inválido o producto desconocido", error.details);
      return jsonResponse({ received: true, ignored: "invalid token" });
    }
    console.error("google-play-webhook failed", error);
    return jsonResponse({ error: "Sync failed" }, 500);
  }
});
