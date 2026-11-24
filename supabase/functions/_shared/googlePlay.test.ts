// deno test --allow-env supabase/functions/_shared/googlePlay.test.ts
import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { PurchaseOwnedByOtherUserError, syncGooglePlaySubscription } from "./googlePlay.ts";

// --- Base de datos simulada (solo lo que usa syncGooglePlaySubscription) ---
type Row = Record<string, any>;

function fakeAdmin(tables: Record<string, Row[]>) {
  let nextId = 1;
  return {
    tables,
    from(table: string) {
      const rows = tables[table] ||= [];
      const filters: [string, unknown][] = [];
      let mode: "select" | "update" | "insert" = "select";
      let payload: Row = {};
      const matching = () => rows.filter((row) => filters.every(([key, value]) => row[key] === value));
      const builder: any = {
        select: () => builder,
        limit: () => builder,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
        update: (data: Row) => { mode = "update"; payload = data; return builder; },
        insert: (data: Row) => { mode = "insert"; payload = data; return builder; },
        maybeSingle: async () => ({ data: matching()[0] || null, error: null }),
        single: async () => {
          if (mode === "insert") {
            const row = { id: `m${nextId++}`, ...payload };
            rows.push(row);
            return { data: row, error: null };
          }
          const row = matching()[0];
          Object.assign(row, payload);
          return { data: row, error: null };
        },
      };
      return builder;
    },
  };
}

// --- Google simulado ---
const keyPair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----\n`;
Deno.env.set("GOOGLE_PLAY_SERVICE_ACCOUNT", JSON.stringify({ client_email: "sa@test.iam.gserviceaccount.com", private_key: pem }));

let subscriptions: Record<string, Row> = {};
let acknowledged: string[] = [];
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }));
  }
  const ack = url.match(/subscriptions\/([^/]+)\/tokens\/([^:]+):acknowledge$/);
  if (ack) {
    acknowledged.push(decodeURIComponent(ack[2]));
    return new Response("");
  }
  const get = url.match(/subscriptionsv2\/tokens\/(.+)$/);
  const subscription = get && subscriptions[decodeURIComponent(get[1])];
  return subscription ? new Response(JSON.stringify(subscription)) : new Response("not found", { status: 404 });
}) as typeof fetch;

const PLANS = [{ code: "premium", amount_usd: 2, access_features: ["stats"], google_play_product_id: "premium_monthly" }];
const inOneMonth = () => new Date(Date.now() + 30 * 86400000).toISOString();

function activeSubscription(extra: Row = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    startTime: new Date().toISOString(),
    latestOrderId: "GPA.1",
    lineItems: [{
      productId: "premium_monthly",
      expiryTime: inOneMonth(),
      autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: "EUR", units: "2", nanos: 490000000 } },
    }],
    ...extra,
  };
}

Deno.test("una compra nueva verificada desde la app crea la membresía, da acceso y se confirma", async () => {
  subscriptions = { tok1: activeSubscription() };
  acknowledged = [];
  const admin = fakeAdmin({ membership_plans: [...PLANS], memberships: [] });

  const saved = await syncGooglePlaySubscription(admin, "tok1", { userId: "u1", userEmail: "a@b.c" });

  assertEquals(saved?.user_id, "u1");
  assertEquals(saved?.status, "active");
  assertEquals(saved?.plan_code, "premium");
  assertEquals(saved?.currency, "EUR");
  assertEquals(saved?.amount_ars, 2.49);
  assertEquals(new Date(saved?.expires_at) > new Date(saved?.current_period_end), true);
  assertEquals(acknowledged, ["tok1"]);
});

Deno.test("el webhook sin dueño conocido no crea nada", async () => {
  subscriptions = { tok2: activeSubscription() };
  const admin = fakeAdmin({ membership_plans: [...PLANS], memberships: [] });

  assertEquals(await syncGooglePlaySubscription(admin, "tok2"), null);
  assertEquals(admin.tables.memberships.length, 0);
});

Deno.test("una compra de otra cuenta no se puede reclamar", async () => {
  subscriptions = { tok3: activeSubscription({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" }) };
  const admin = fakeAdmin({
    membership_plans: [...PLANS],
    memberships: [{ id: "x", user_id: "u1", provider: "google_play", provider_subscription_id: "tok3", status: "active" }],
  });

  await assertRejects(() => syncGooglePlaySubscription(admin, "tok3", { userId: "u2" }), PurchaseOwnedByOtherUserError);
});

Deno.test("la cancelación conserva el acceso hasta el vencimiento y no renueva", async () => {
  subscriptions = { tok4: activeSubscription({
    subscriptionState: "SUBSCRIPTION_STATE_CANCELED",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  }) };
  acknowledged = [];
  const admin = fakeAdmin({
    membership_plans: [...PLANS],
    memberships: [{ id: "x", user_id: "u1", provider: "google_play", provider_subscription_id: "tok4", status: "active" }],
  });

  const saved = await syncGooglePlaySubscription(admin, "tok4");

  assertEquals(saved?.status, "cancelled");
  assertEquals(saved?.next_payment_date, null);
  assertEquals(typeof saved?.cancelled_at, "string");
  assertEquals(saved?.current_period_end, subscriptions.tok4.lineItems[0].expiryTime);
  assertEquals(acknowledged, []);
});

Deno.test("un token nuevo enlazado (resuscripción) hereda el dueño del anterior", async () => {
  subscriptions = { tokNew: activeSubscription({ linkedPurchaseToken: "tokOld" }) };
  const admin = fakeAdmin({
    membership_plans: [...PLANS],
    memberships: [{ id: "x", user_id: "u9", user_email: "u9@b.c", provider: "google_play", provider_subscription_id: "tokOld", status: "expired" }],
  });

  const saved = await syncGooglePlaySubscription(admin, "tokNew");

  assertEquals(saved?.user_id, "u9");
  assertEquals(saved?.user_email, "u9@b.c");
  assertEquals(admin.tables.memberships.length, 2);
});

Deno.test("en espera por pago fallido no da acceso", async () => {
  subscriptions = { tok5: activeSubscription({
    subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  }) };
  const admin = fakeAdmin({
    membership_plans: [...PLANS],
    memberships: [{ id: "x", user_id: "u1", provider: "google_play", provider_subscription_id: "tok5", status: "active" }],
  });

  const saved = await syncGooglePlaySubscription(admin, "tok5");
  assertEquals(saved?.status, "payment_failed");
});
