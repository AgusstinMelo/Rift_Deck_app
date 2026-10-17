import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getUserMatches } from '@/api/matchesSupabase';
import {
  createCheckin, createGoal, deleteCheckin, listGoals, listUserCheckins, setGoalLifecycle, updateCheckin, updateGoal,
} from '@/api/goalsSupabase';
import { evaluateGoal } from '../engine/evaluateGoal';
import { playedDateOf } from '../engine/matchFacts';
import { periodDates } from '../engine/period';
import { getMetric } from '../metrics/index';

/** Límite con el que la app ya carga las partidas del usuario (getUserMatches). */
export const MATCH_FETCH_LIMIT = 1000;

export const goalKeys = {
  goals: userId => ['goals', userId],
  checkins: userId => ['goal-checkins', userId],
};

/** Fecha actual que se refresca periódicamente para que los períodos abran y cierren solos. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = globalThis.setInterval(() => setNow(new Date()), intervalMs);
    return () => globalThis.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Partidas del usuario con la misma query (y por lo tanto la misma invalidación) que el resto de la app. */
export function useUserMatches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => (user?.email ? getUserMatches(user, MATCH_FETCH_LIMIT) : []),
    enabled: !!user?.email,
  });
}

export function useGoalsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: goalKeys.goals(user?.id),
    queryFn: () => listGoals(user?.id),
    enabled: !!user?.id,
  });
}

export function useUserCheckins({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: goalKeys.checkins(user?.id),
    queryFn: () => listUserCheckins(user?.id),
    enabled: !!user?.id && enabled,
  });
}

function groupCheckinsByGoal(checkins) {
  const byGoal = new Map();
  checkins.forEach(checkin => {
    if (!byGoal.has(checkin.goal_id)) byGoal.set(checkin.goal_id, []);
    byGoal.get(checkin.goal_id).push(checkin);
  });
  return byGoal;
}

/** La carga de partidas pudo cortarse antes del inicio del período. */
function isPossiblyTruncated(goal, matches, timeZone) {
  if (getMetric(goal.metric).source !== 'matches' || matches.length < MATCH_FETCH_LIMIT) return false;
  const oldest = matches
    .map(match => playedDateOf(match, timeZone)?.date)
    .filter(Boolean)
    .sort()[0];
  return !oldest || oldest > periodDates(goal).startDate;
}

/**
 * Objetivos del usuario con su evaluación derivada de las partidas y los check-ins.
 * Se recalcula solo cuando cambian las queries (crear/editar/eliminar partidas o check-ins).
 */
export function useEvaluatedGoals() {
  const now = useNow();
  const goalsQuery = useGoalsList();
  const goals = goalsQuery.data || [];
  const hasManual = goals.some(goal => getMetric(goal.metric).source === 'checkins');
  const matchesQuery = useUserMatches();
  const checkinsQuery = useUserCheckins({ enabled: hasManual });

  const matches = matchesQuery.data;
  const checkins = checkinsQuery.data;

  const items = useMemo(() => {
    const checkinsByGoal = groupCheckinsByGoal(checkins || []);
    const allMatches = matches || [];
    return goals.map(goal => {
      const goalCheckins = checkinsByGoal.get(goal.id) || [];
      return {
        goal,
        checkins: goalCheckins,
        evaluation: evaluateGoal(goal, { matches: allMatches, checkins: goalCheckins }, now),
        truncated: isPossiblyTruncated(goal, allMatches, goal.timezone),
      };
    });
  }, [goals, matches, checkins, now]);

  return {
    items,
    matches: matches || [],
    now,
    isLoading: goalsQuery.isLoading || matchesQuery.isLoading || (hasManual && checkinsQuery.isLoading),
    error: goalsQuery.error || matchesQuery.error || checkinsQuery.error || null,
    refetch: () => {
      goalsQuery.refetch();
      matchesQuery.refetch();
      if (hasManual) checkinsQuery.refetch();
    },
  };
}

export function useGoalMutations() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const invalidateGoals = () => qc.invalidateQueries({ queryKey: goalKeys.goals(user?.id) });
  const invalidateCheckins = () => qc.invalidateQueries({ queryKey: goalKeys.checkins(user?.id) });

  return {
    create: useMutation({
      mutationFn: (/** @type {any} */ input) => createGoal(user?.id, input),
      onSuccess: invalidateGoals,
    }),
    update: useMutation({
      mutationFn: (/** @type {{ goal: any, input: any }} */ { goal, input }) => updateGoal(goal, input),
      onSuccess: invalidateGoals,
    }),
    setLifecycle: useMutation({
      mutationFn: (/** @type {{ goal: any, lifecycle: string }} */ { goal, lifecycle }) => setGoalLifecycle(goal, lifecycle),
      onSuccess: invalidateGoals,
    }),
    createCheckin: useMutation({
      mutationFn: (/** @type {{ goal: any, input: any }} */ { goal, input }) => createCheckin(goal, input),
      onSuccess: invalidateCheckins,
    }),
    updateCheckin: useMutation({
      mutationFn: (/** @type {{ goal: any, checkinId: string, input: any }} */ { goal, checkinId, input }) =>
        updateCheckin(goal, checkinId, input),
      onSuccess: invalidateCheckins,
    }),
    deleteCheckin: useMutation({
      mutationFn: (/** @type {string} */ checkinId) => deleteCheckin(checkinId),
      onSuccess: invalidateCheckins,
    }),
  };
}
