import { supabase } from '@/lib/supabaseClient';

export async function createMercadoPagoSubscription(mpEmail) {
  const { data, error } = await supabase.functions.invoke('create-mercadopago-subscription', {
    body: { mp_email: mpEmail },
  });

  if (error) throw error;
  return data;
}
