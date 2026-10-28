import { invokeEdgeFunction } from '@/api/edgeFunctions';
import { tr } from '@/i18n/uiI18n';

export function createPayPalSubscription(planCode = 'premium') {
  return invokeEdgeFunction('create-paypal-subscription', { plan_code: planCode }, {
    messages: { 'PayPal plan not configured': tr('payments.paypalNotConfigured') },
    fallback: tr('payments.paypalStartError'),
  });
}

/** Confirma la suscripción al volver de PayPal, sin esperar al webhook. */
export function syncPayPalSubscription(subscriptionId) {
  return invokeEdgeFunction('create-paypal-subscription', { action: 'sync', subscription_id: subscriptionId }, {
    fallback: tr('payments.paypalSyncError'),
  });
}
