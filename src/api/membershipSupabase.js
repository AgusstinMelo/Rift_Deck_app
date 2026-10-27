import { supabase } from '@/lib/supabaseClient';

export const TRIAL_DAYS = 45;

const NO_MEMBERSHIP = Object.freeze({
  hasAccess: false,
  status: 'inactive',
  membership: null,
  accessUntil: null,
  trialAvailable: false,
  trialEndsAt: null,
});

const toDate = (value) => (value ? new Date(value) : null);

// El acceso se calcula en la base (get_my_membership), considerando todas las
// filas del usuario: prueba gratis, suscripción paga y cancelaciones con período vigente.
export async function getMyMembership(userId) {
  if (!userId) return NO_MEMBERSHIP;

  const { data, error } = await supabase.rpc('get_my_membership');
  if (error) throw error;

  return {
    hasAccess: data?.has_access === true,
    status: data?.status || 'inactive',
    membership: data?.membership || null,
    accessUntil: toDate(data?.access_until),
    trialAvailable: data?.trial_available === true,
    trialEndsAt: toDate(data?.trial_ends_at),
  };
}

export async function startMembershipTrial() {
  const { error } = await supabase.rpc('start_membership_trial');
  if (error) throw new Error(error.message || 'No pudimos activar la prueba gratis.');
}

export async function getMembershipPlans() {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('code, name, amount_ars, amount_usd, interval_months, sort_order')
    .eq('active', true)
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
