// Compras con Google Play dentro de la app de Android (TWA), con la Digital Goods API y la
// Payment Request API. La compra la confirma el servidor (edge function google-play-verify).
//
// Dentro de la app de Play no se puede ofrecer otro medio de pago (política de pagos de Google
// Play): isInAndroidApp() decide si se muestra Google Play en lugar de Mercado Pago y PayPal.
import { invokeEdgeFunction } from '@/api/edgeFunctions';
import { formatLocale, tr } from '@/i18n/uiI18n';

export const PLAY_BILLING_METHOD = 'https://play.google.com/billing';
const ANDROID_APP_REFERRER = 'android-app://com.riftdeckapp.app';
// La app abre /?source=android-app (launchUrl en android/twa-manifest.json).
const SOURCE_PARAM = 'source';
const SOURCE_VALUE = 'android-app';
const SESSION_KEY = 'rd-android-app';

let inAndroidApp = null;

/**
 * Detecta si la web se abrió desde la app de Android y lo recuerda en la sesión de la pestaña
 * (sessionStorage: no se comparte con Chrome, aunque la TWA use su mismo almacenamiento).
 * Se llama al arrancar (main.jsx), antes de que una recarga o un login pierdan la marca.
 */
export function detectAndroidApp() {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const fromLaunchUrl = url.searchParams.get(SOURCE_PARAM) === SOURCE_VALUE;
  const fromReferrer = document.referrer.startsWith(ANDROID_APP_REFERRER);
  let remembered = false;
  try {
    if (fromLaunchUrl || fromReferrer) sessionStorage.setItem(SESSION_KEY, '1');
    remembered = sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    // Sin sessionStorage vale solo lo que se ve en esta carga.
  }
  if (fromLaunchUrl) {
    url.searchParams.delete(SOURCE_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  inAndroidApp = fromLaunchUrl || fromReferrer || remembered;
  return inAndroidApp;
}

/** ¿La web corre dentro de la app de Android? */
export function isInAndroidApp() {
  return inAndroidApp ?? detectAndroidApp();
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
