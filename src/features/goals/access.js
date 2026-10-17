import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getMyMembership } from '@/api/membershipSupabase';

/**
 * Política de acceso a Objetivos. Hoy es libre; para ponerlo detrás de la
 * membresía basta con cambiar `requiresMembership` a true. La página y el
 * widget del Dashboard ya consultan este hook.
 */
export const GOALS_ACCESS_POLICY = Object.freeze({
  requiresMembership: false,
});

/** @returns {{ hasAccess: boolean, isLoading: boolean }} */
export function useGoalsAccess(policy = GOALS_ACCESS_POLICY) {
  const { user } = useAuth();
  const isOpen = !policy.requiresMembership || user?.role === 'admin';
  const [state, setState] = useState({ hasAccess: isOpen, isLoading: !isOpen });

  useEffect(() => {
    if (isOpen) {
      setState({ hasAccess: true, isLoading: false });
      return undefined;
    }
    let cancelled = false;
    setState({ hasAccess: false, isLoading: true });
    getMyMembership(user?.id)
      .then(result => !cancelled && setState({ hasAccess: result.hasAccess === true, isLoading: false }))
      .catch(() => !cancelled && setState({ hasAccess: false, isLoading: false }));
    return () => { cancelled = true; };
  }, [isOpen, user?.id]);

  return state;
}
