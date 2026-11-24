// Cliente mínimo de la Google Play Developer API (Android Publisher) y sincronización de las
// suscripciones de Google Play con memberships. Lo usan google-play-verify,
// google-play-webhook y delete-account.
//
// Variables de entorno:
//   GOOGLE_PLAY_SERVICE_ACCOUNT  JSON completo de la clave de una cuenta de servicio con acceso
//                                a la app en Play Console (permiso "Ver datos financieros" y
//                                "Gestionar pedidos y suscripciones").
//   GOOGLE_PLAY_PACKAGE_NAME     opcional; por defecto com.riftdeckapp.app

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

// Margen sobre el vencimiento mientras llega la notificación de la renovación.
const RENEWAL_GRACE_DAYS = 1;

export class GooglePlayError extends Error {
  status: number;
  details: string;

  constructor(message: string, status: number, details = "") {
    super(message);
    this.name = "GooglePlayError";
    this.status = status;
    this.details = details;
  }
}

/** El purchase token ya está vinculado a otra cuenta de Rift Deck. */
export class PurchaseOwnedByOtherUserError extends Error {
  constructor() {
    super("Purchase belongs to another account");
    this.name = "PurchaseOwnedByOtherUserError";
  }
}

export function getPackageName() {
  return Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") || "com.riftdeckapp.app";
}

export function isGooglePlayConfigured() {
  return Boolean(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT"));
}

// --- Autenticación con la cuenta de servicio (JWT firmado RS256 → access token) ---

const base64Url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
  if (!raw) throw new GooglePlayError("Google Play not configured", 503, "GOOGLE_PLAY_SERVICE_ACCOUNT");

  const account = JSON.parse(raw);
  const pem = String(account.private_key || "")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new GooglePlayError("Google auth failed", response.status, await response.text());

  const data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return cachedToken.value;
}

async function playFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${API}/${encodeURIComponent(getPackageName())}${path}`, {
    ...init,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new GooglePlayError("Google Play request failed", response.status, text);
  return text ? JSON.parse(text) : {};
}

// --- API de suscripciones ---

export function getSubscription(purchaseToken: string) {
  return playFetch(`/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
}

function acknowledgeSubscription(productId: string, purchaseToken: string) {
  return playFetch(
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    { method: "POST", body: "{}" },
  );
}

/** Cancela la renovación; el acceso sigue hasta el final del período pagado. */
export function cancelSubscription(productId: string, purchaseToken: string) {
  return playFetch(
    `/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:cancel`,
    { method: "POST", body: "{}" },
  );
}

// --- Sincronización con memberships ---

// Estado de Google Play → estado de memberships (ver membership_access_until).
function mapState(state: string) {
  switch (state) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "active";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "cancelled";
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return "payment_failed";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_PENDING":
      return "pending";
    default:
      // EXPIRED, PENDING_PURCHASE_CANCELED y estados desconocidos: sin acceso.
      return "expired";
  }
}

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

function latestLineItem(subscription: Record<string, any>) {
  const items: Record<string, any>[] = subscription.lineItems || [];
  return items.reduce<Record<string, any> | null>((latest, item) => (
    !latest || new Date(item.expiryTime || 0) > new Date(latest.expiryTime || 0) ? item : latest
  ), null);
}

function recurringPrice(item: Record<string, any> | null) {
  const price = item?.autoRenewingPlan?.recurringPrice;
  if (!price?.currencyCode) return null;
  return { amount: Number(price.units || 0) + Number(price.nanos || 0) / 1e9, currency: String(price.currencyCode) };
}

type SyncOptions = {
  /** Usuario que reclama la compra (verificación desde la app). Sin él, solo se actualiza una fila existente. */
  userId?: string;
  userEmail?: string | null;
};

/**
 * Lee la suscripción en Google Play y crea o actualiza su fila en memberships. Confirma
 * (acknowledge) la compra si hace falta: sin eso, Google la reembolsa a los 3 días.
 * Devuelve la fila guardada, o null si la compra todavía no tiene dueño en Rift Deck.
 */
export async function syncGooglePlaySubscription(supabaseAdmin: any, purchaseToken: string, options: SyncOptions = {}) {
  try {
    return await syncOnce(supabaseAdmin, purchaseToken, options);
  } catch (error) {
    // La app y el webhook pueden crear la misma fila a la vez: el índice único deja pasar una
    // y la otra se repite como actualización.
    if ((error as { code?: string })?.code === "23505") return syncOnce(supabaseAdmin, purchaseToken, options);
    throw error;
  }
}

async function syncOnce(supabaseAdmin: any, purchaseToken: string, options: SyncOptions) {
  const subscription = await getSubscription(purchaseToken);
  const item = latestLineItem(subscription);
  const productId = item?.productId ? String(item.productId) : "";
  if (!productId) throw new GooglePlayError("Subscription without line items", 502, JSON.stringify(subscription));

  const { data: plan, error: planError } = await supabaseAdmin
    .from("membership_plans")
    .select("code, amount_usd, access_features")
    .eq("google_play_product_id", productId)
    .limit(1)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) throw new GooglePlayError("Unknown Google Play product", 400, productId);

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("memberships")
    .select("*")
    .eq("provider", "google_play")
    .eq("provider_subscription_id", purchaseToken)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  // Una suscripción renovada después de vencer, o un cambio de plan, trae un token nuevo que
  // apunta al anterior: hereda su dueño.
  let linkedOwner: { user_id: string | null; user_email: string | null } | null = null;
  if (!existing && subscription.linkedPurchaseToken) {
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("user_id, user_email")
      .eq("provider", "google_play")
      .eq("provider_subscription_id", String(subscription.linkedPurchaseToken))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    linkedOwner = data;
  }

  const ownerId = existing?.user_id || linkedOwner?.user_id || options.userId || null;
  if (options.userId && ownerId !== options.userId) throw new PurchaseOwnedByOtherUserError();
  // Una fila anonimizada (cuenta eliminada) o una compra sin reclamar: no hay a quién darle acceso.
  if (!ownerId) return null;

  const status = mapState(String(subscription.subscriptionState || ""));
  const now = new Date();
  const expiry = item?.expiryTime ? new Date(item.expiryTime) : now;
  const autoRenew = item?.autoRenewingPlan?.autoRenewEnabled === true;
  const price = recurringPrice(item);

  const row: Record<string, any> = {
    user_id: ownerId,
    user_email: existing?.user_email || linkedOwner?.user_email || options.userEmail || null,
    plan_code: plan.code,
    provider: "google_play",
    provider_subscription_id: purchaseToken,
    provider_payment_id: subscription.latestOrderId ? String(subscription.latestOrderId) : existing?.provider_payment_id || null,
    external_reference: existing?.external_reference || `${ownerId}:google_play:${productId}:${now.getTime()}`,
    amount_ars: price ? price.amount : Number(plan.amount_usd),
    currency: price ? price.currency : "USD",
    access_features: Array.isArray(plan.access_features) && plan.access_features.length > 0 ? plan.access_features : ["stats"],
    status,
    started_at: existing?.started_at || subscription.startTime || now.toISOString(),
    current_period_end: expiry.toISOString(),
    next_payment_date: status === "active" && autoRenew ? expiry.toISOString() : null,
    expires_at: status === "active" ? addDays(expiry, RENEWAL_GRACE_DAYS).toISOString() : expiry.toISOString(),
    cancelled_at: status === "cancelled" ? existing?.cancelled_at || now.toISOString() : existing?.cancelled_at || null,
    updated_at: now.toISOString(),
  };
  if (status === "active" && existing?.status !== "active") row.current_period_start = now.toISOString();

  const { data: saved, error: writeError } = existing?.id
    ? await supabaseAdmin.from("memberships").update(row).eq("id", existing.id).select("*").single()
    : await supabaseAdmin.from("memberships").insert({ ...row, created_at: now.toISOString() }).select("*").single();
  if (writeError) throw writeError;

  if (status === "active" && subscription.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
    await acknowledgeSubscription(productId, purchaseToken);
  }

  return saved;
}
