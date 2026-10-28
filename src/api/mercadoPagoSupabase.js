import { invokeEdgeFunction } from '@/api/edgeFunctions';
import { tr } from '@/i18n/uiI18n';

export function createMercadoPagoSubscription(mpEmail, planCode = 'premium') {
  return invokeEdgeFunction('create-mercadopago-subscription', { mp_email: mpEmail, plan_code: planCode }, {
    messages: { 'Invalid mp_email': tr('payments.mpInvalidEmail') },
    fallback: tr('payments.mpStartError'),
  });
}
