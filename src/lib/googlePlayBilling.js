// Compras con Google Play dentro de la app de Android (TWA), con la Digital Goods API y la
// Payment Request API. La compra la confirma el servidor (edge function google-play-verify).
//
// Dentro de la app de Play no se puede ofrecer otro medio de pago (política de pagos de Google
// Play): isInAndroidApp() decide si se muestra Google Play en lugar de Mercado Pago y PayPal.
import { invokeEdgeFunction } from '@/api/edgeFunctions';
import { formatLocale, tr } from '@/i18n/uiI18n';

export const PLAY_BILLING_METHOD = 'https://play.google.com/billing';
const ANDROID_APP_REFERRER = 'android-app://com.riftdeckapp.app';
const SESSION_KEY = 'rd-android-app';

/**
 * ¿La web corre dentro de la app de Android? La TWA abre la primera página con el referrer
 * android-app://<paquete>; se recuerda en la sesión porque al navegar el referrer cambia.
 */
export function isInAndroidApp() {
  if (typeof window === 'undefined') return false;
  try {
    if (document.referrer.startsWith(ANDROID_APP_REFERRER)) {
      sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return document.referrer.startsWith(ANDROID_APP_REFERRER);
  }
}

let servicePromise = null;

/** El servicio de Digital Goods, o null si no hay facturación de Play (web, APK sin Play). */
export function getPlayBillingService() {
  if (!servicePromise) {
    servicePromise = (async () => {
      if (typeof window === 'undefined' || !('getDigitalGoodsService' in window)) return null;
      try {
        return (await window.getDigitalGoodsService(PLAY_BILLING_METHOD)) || null;
      } catch {
        return null;
      }
    })();
  }
  return servicePromise;
}

function formatPrice(price) {
  if (!price?.currency) return null;
  try {
    return new Intl.NumberFormat(formatLocale(), { style: 'currency', currency: price.currency }).format(Number(price.value));
  } catch {
    return `${price.value} ${price.currency}`;
  }
}

/** Precios de Google Play (en la moneda del usuario), por id de producto. */
export async function getPlayPrices(productIds) {
  const service = await getPlayBillingService();
  if (!service || productIds.length === 0) return {};
  const details = await service.getDetails(productIds);
  return Object.fromEntries(details.map(item => [item.itemId, formatPrice(item.price)]));
}

function verifyPurchase(purchaseToken) {
  return invokeEdgeFunction('google-play-verify', { purchase_token: purchaseToken }, {
    messages: {
      'Purchase belongs to another account': tr('payments.playOtherAccount'),
      'Google Play not configured': tr('payments.playNotConfigured'),
    },
    fallback: tr('payments.playVerifyError'),
  });
}

/**
 * Abre el pago de Google Play para una suscripción. Devuelve true si se compró y el servidor
 * dio el acceso; false si el usuario cerró el pago.
 */
export async function purchasePlaySubscription(productId) {
  const request = new PaymentRequest(
    [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: productId } }],
    // Google Play ignora el total: el precio es el del producto.
    { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } },
  );

  let response;
  try {
    response = await request.show();
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    throw new Error(tr('payments.playStartError'));
  }

  const purchaseToken = response?.details?.purchaseToken || response?.details?.token;
  try {
    if (!purchaseToken) throw new Error(tr('payments.playVerifyError'));
    await verifyPurchase(purchaseToken);
    await response.complete('success');
    return true;
  } catch (error) {
    await response.complete('fail').catch(() => {});
    throw error;
  }
}

/**
 * Vincula a la cuenta las suscripciones de Google Play vigentes en este celular (reinstalación,
 * webhook demorado). Las de otra cuenta de Rift Deck se ignoran. Devuelve cuántas verificó.
 */
export async function restorePlayPurchases() {
  const service = await getPlayBillingService();
  if (!service) return 0;
  const purchases = await service.listPurchases().catch(() => []);
  let restored = 0;
  for (const purchase of purchases) {
    if (!purchase?.purchaseToken) continue;
    try {
      await verifyPurchase(purchase.purchaseToken);
      restored += 1;
    } catch {
      // Compra de otra cuenta o error puntual: no bloquea la pantalla.
    }
  }
  return restored;
}
