import { invokeEdgeFunction } from '@/api/edgeFunctions';

export function createMercadoPagoSubscription(mpEmail, planCode = 'premium') {
  return invokeEdgeFunction('create-mercadopago-subscription', { mp_email: mpEmail, plan_code: planCode }, {
    messages: { 'Invalid mp_email': 'Ingresá un email de Mercado Pago válido.' },
    fallback: 'No pudimos iniciar el pago. Intentá de nuevo en unos minutos.',
  });
}
