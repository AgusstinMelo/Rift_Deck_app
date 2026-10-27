import { invokeEdgeFunction } from '@/api/edgeFunctions';

export function createPayPalSubscription(planCode = 'premium') {
  return invokeEdgeFunction('create-paypal-subscription', { plan_code: planCode }, {
    messages: { 'PayPal plan not configured': 'PayPal todavía no está disponible para este plan.' },
    fallback: 'No pudimos iniciar el pago con PayPal. Intentá de nuevo en unos minutos.',
  });
}

/** Confirma la suscripción al volver de PayPal, sin esperar al webhook. */
export function syncPayPalSubscription(subscriptionId) {
  return invokeEdgeFunction('create-paypal-subscription', { action: 'sync', subscription_id: subscriptionId }, {
    fallback: 'No pudimos confirmar la suscripción de PayPal.',
  });
}
