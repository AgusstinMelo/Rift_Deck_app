import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getMyMembership } from '@/api/membershipSupabase';

/**
 * Política de acceso a Objetivos. La página es libre; la cuenta free puede tener
 * `freeOpenGoalLimit` objetivos en curso y Premium (o un admin) ilimitados.
 * El límite también lo aplica la base (personal_goals_enforce_free_limit).
 */
export const GOALS_ACCESS_POLICY = Object.freeze({
  requiresMembership: false,
  freeOpenGoalLimit: 1,
});

/** @returns {{ hasAccess: boolean, isLoading: boolean, isPremium: boolean, openGoalLimit: number | null }} */
export function useGoalsAccess(policy = GOALS_ACCESS_POLICY) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [state, setState] = useState({ isPremium: isAdmin, isLoading: !isAdmin });

  useEffect(() => {
    if (isAdmin) {
      setState({ isPremium: true, isLoading: false });
      return undefined;
    }
    let cancelled = false;
    setState({ isPremium: false, isLoading: true });
    getMyMembership(user?.id)
      .then(result => !cancelled && setState({ isPremium: result.hasAccess === true, isLoading: false }))
      .catch(() => !cancelled && setState({ isPremium: false, isLoading: false }));
    return () => { cancelled = true; };
  }, [isAdmin, user?.id]);

  return {
    hasAccess: !policy.requiresMembership || state.isPremium,
    isLoading: state.isLoading,
    isPremium: state.isPremium,
    openGoalLimit: state.isPremium ? null : policy.freeOpenGoalLimit,
  };
}
