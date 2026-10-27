// Cliente mínimo de la API de PayPal y sincronización de suscripciones con memberships.
// Lo usan create-paypal-subscription y paypal-webhook.

// Margen sobre la fecha de cobro mientras PayPal reintenta un pago fallido.
const RENEWAL_GRACE_DAYS = 3;

export class PayPalError extends Error {
  status: number;
  details: string;

  constructor(message: string, status: number, details: string) {
    super(message);
    this.name = "PayPalError";
    this.status = status;
    this.details = details;
  }
}

export function getPayPalBaseUrl() {
  return Deno.env.get("PAYPAL_ENV") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new PayPalError("Missing PayPal credentials", 500, "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET");
  }

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new PayPalError("PayPal auth failed", response.status, await response.text());
  }

  const data = await response.json();
  cachedToken = {
    value: data.access_token,
    // Se renueva un minuto antes de que venza.
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };
  return cachedToken.value;
}

export async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new PayPalError(`PayPal ${init.method || "GET"} ${path} failed`, response.status, text);
  }

  return text ? JSON.parse(text) : null;
}

export function getPayPalSubscription(subscriptionId: string) {
  return paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

// PayPal recomienda reenviar el evento tal como llegó: se inserta el body crudo
// para no alterar la firma al re-serializarlo.
export async function verifyPayPalWebhook(headers: Headers, rawBody: string) {
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!webhookId) {
    throw new PayPalError("Missing PAYPAL_WEBHOOK_ID", 500, "PAYPAL_WEBHOOK_ID");
  }

  const fields = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
  };

  if (Object.values(fields).some((value) => !value)) return false;

  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody}}`;
  const result = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body,
  });

  return result?.verification_status === "SUCCESS";
}

function mapPayPalStatus(status: unknown) {
  const map: Record<string, string> = {
    APPROVAL_PENDING: "pending",
    APPROVED: "pending",
    ACTIVE: "active",
    SUSPENDED: "paused",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
  };

  return map[String(status)] || "pending";
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Copia el estado real de una suscripción de PayPal a su fila de memberships.
 * Con `userId` solo actualiza si la fila es de ese usuario.
 * Devuelve la fila previa y el estado aplicado, o null si la suscripción no es nuestra.
 */
// deno-lint-ignore no-explicit-any
export async function syncPayPalSubscription(supabaseAdmin: any, subscription: Record<string, any>, options: {
  paymentId?: string | null;
  userId?: string;
} = {}) {
  let query = supabaseAdmin
    .from("memberships")
    .select("*")
    .eq("provider", "paypal")
    .eq("provider_subscription_id", String(subscription.id));

  if (options.userId) query = query.eq("user_id", options.userId);

  const { data: membership, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!membership) return null;

  const now = new Date();
  const status = mapPayPalStatus(subscription.status);
  const update: Record<string, unknown> = {
    status,
    updated_at: now.toISOString(),
  };

  if (options.paymentId) update.provider_payment_id = options.paymentId;

  if (status === "active") {
    const { data: plan } = await supabaseAdmin
      .from("membership_plans")
      .select("interval_months")
      .eq("code", membership.plan_code)
      .maybeSingle();

    const nextBilling = subscription.billing_info?.next_billing_time
      ? new Date(subscription.billing_info.next_billing_time)
      : null;
    const periodEnd = nextBilling && !Number.isNaN(nextBilling.getTime()) && nextBilling > now
      ? nextBilling
      : addMonths(now, Number(plan?.interval_months) || 1);

    update.started_at = membership.started_at || now.toISOString();
    update.current_period_start = membership.current_period_end && new Date(membership.current_period_end) <= now
      ? now.toISOString()
      : membership.current_period_start || now.toISOString();
    update.current_period_end = periodEnd.toISOString();
    update.next_payment_date = periodEnd.toISOString();
    update.expires_at = addDays(periodEnd, RENEWAL_GRACE_DAYS).toISOString();
    update.access_features = Array.isArray(membership.access_features) && membership.access_features.length > 0
      ? membership.access_features
      : ["stats"];
  }

  if (status === "cancelled") {
    update.cancelled_at = membership.cancelled_at || now.toISOString();
    update.next_payment_date = null;
  }

  const { error: updateError } = await supabaseAdmin
    .from("memberships")
    .update(update)
    .eq("id", membership.id);

  if (updateError) throw updateError;
  return { membership, status };
}
