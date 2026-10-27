// Crea en PayPal el producto "Rift Deck Premium" y un plan de suscripción por cada
// plan de membership_plans, e imprime el SQL que guarda los paypal_plan_id.
//
// Uso (las credenciales no se guardan en el repo):
//   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_ENV=sandbox node scripts/paypal-create-plans.mjs
// Con PAYPAL_PRODUCT_ID se reutiliza un producto ya creado.

// Deben coincidir con amount_usd / interval_months de membership_plans.
const PLANS = [
  { code: 'premium', name: 'Rift Deck Premium Mensual', amountUsd: '2.00', intervalMonths: 1 },
  { code: 'premium_quarterly', name: 'Rift Deck Premium Trimestral', amountUsd: '5.50', intervalMonths: 3 },
  { code: 'premium_annual', name: 'Rift Deck Premium Anual', amountUsd: '20.00', intervalMonths: 12 },
];

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV = 'sandbox', PAYPAL_PRODUCT_ID } = process.env;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error('Faltan PAYPAL_CLIENT_ID y/o PAYPAL_CLIENT_SECRET.');
  process.exit(1);
}

if (!['sandbox', 'live'].includes(PAYPAL_ENV)) {
  console.error('PAYPAL_ENV tiene que ser "sandbox" o "live".');
  process.exit(1);
}

const baseUrl = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) throw new Error(`Autenticación con PayPal falló (${response.status}): ${await response.text()}`);
  return (await response.json()).access_token;
}

async function paypalPost(token, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`POST ${path} falló (${response.status}): ${await response.text()}`);
  return response.json();
}

const token = await getAccessToken();

let productId = PAYPAL_PRODUCT_ID;
if (!productId) {
  const product = await paypalPost(token, '/v1/catalogs/products', {
    name: 'Rift Deck Premium',
    description: 'Acceso premium a estadísticas avanzadas y objetivos ilimitados',
    type: 'SERVICE',
    category: 'SOFTWARE',
  });
  productId = product.id;
  console.log(`Producto creado: ${productId}`);
} else {
  console.log(`Usando producto existente: ${productId}`);
}

const sql = [];
for (const plan of PLANS) {
  const created = await paypalPost(token, '/v1/billing/plans', {
    product_id: productId,
    name: plan.name,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'MONTH', interval_count: plan.intervalMonths },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: plan.amountUsd, currency_code: 'USD' } },
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      payment_failure_threshold: 3,
    },
  });

  console.log(`Plan ${plan.code}: ${created.id}`);
  sql.push(`update public.membership_plans set paypal_plan_id = '${created.id}', updated_at = now() where code = '${plan.code}';`);
}

console.log(`\n-- SQL para el SQL Editor de Supabase (${PAYPAL_ENV}):\n${sql.join('\n')}`);
