import { supabase } from '@/lib/supabaseClient';

export async function getMyMembership(userId) {
  if (!userId) {
    return {
      hasAccess: false,
      status: 'inactive',
      membership: null,
    };
  }

  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const membership = data || null;
  const status = membership?.status || 'inactive';
  const expiresAt = membership?.expires_at ? new Date(membership.expires_at) : null;
  const periodEnd = membership?.current_period_end ? new Date(membership.current_period_end) : null;
  const accessUntil = expiresAt || periodEnd;
  const hasAccess =
    ['active', 'authorized'].includes(status) &&
    Array.isArray(membership?.access_features) &&
    membership.access_features.includes('stats') &&
    (!accessUntil || accessUntil > new Date());

  return {
    hasAccess,
    status,
    membership,
  };
}
