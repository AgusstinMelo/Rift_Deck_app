import { supabase } from '@/lib/supabaseClient';
import { LIFECYCLE } from '@/features/goals/model/goalConstants';
import { toGoalRecord, validateGoalInput, validateGoalUpdate } from '@/features/goals/validation/goalSchema';
import { toCheckinRecord, validateCheckinInput } from '@/features/goals/validation/checkinSchema';

/** Error de validación con mensajes por campo, para mostrarlos en el formulario. */
export class GoalValidationError extends Error {
  /** @param {Record<string, string>} errors */
  constructor(errors) {
    super(Object.values(errors)[0] || 'Los datos del objetivo no son válidos.');
    this.name = 'GoalValidationError';
    this.errors = errors;
  }
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listGoals(userId) {
  if (!userId) return [];
  return unwrap(await supabase
    .from('personal_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }));
}

export async function createGoal(userId, input, { now = new Date() } = {}) {
  if (!userId) throw new Error('Se requiere un usuario para crear objetivos.');
  const result = validateGoalInput(input, { now });
  if (result.success === false) throw new GoalValidationError(result.errors);

  return unwrap(await supabase
    .from('personal_goals')
    .insert({ ...toGoalRecord(result.data), user_id: userId })
    .select()
    .single());
}

export async function updateGoal(goal, input, { now = new Date() } = {}) {
  const result = validateGoalUpdate(goal, input, { now });
  if (result.success === false) throw new GoalValidationError(result.errors);

  return unwrap(await supabase
    .from('personal_goals')
    .update(result.patch)
    .eq('id', goal.id)
    .select()
    .single());
}

export async function setGoalLifecycle(goal, lifecycle) {
  if (!Object.values(LIFECYCLE).includes(lifecycle)) throw new Error(`Ciclo de vida inválido: ${lifecycle}`);
  return unwrap(await supabase
    .from('personal_goals')
    .update({ lifecycle })
    .eq('id', goal.id)
    .select()
    .single());
}

export async function listUserCheckins(userId) {
  if (!userId) return [];
  return unwrap(await supabase
    .from('personal_goal_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false }));
}

export async function createCheckin(goal, input, { now = new Date() } = {}) {
  const result = validateCheckinInput(goal, input, { now });
  if (result.success === false) throw new GoalValidationError(result.errors);

  return unwrap(await supabase
    .from('personal_goal_checkins')
    .insert({ ...toCheckinRecord(result.data), goal_id: goal.id, user_id: goal.user_id })
    .select()
    .single());
}

export async function updateCheckin(goal, checkinId, input, { now = new Date() } = {}) {
  const result = validateCheckinInput(goal, input, { now });
  if (result.success === false) throw new GoalValidationError(result.errors);

  return unwrap(await supabase
    .from('personal_goal_checkins')
    .update(toCheckinRecord(result.data))
    .eq('id', checkinId)
    .select()
    .single());
}

export async function deleteCheckin(checkinId) {
  return unwrap(await supabase
    .from('personal_goal_checkins')
    .delete()
    .eq('id', checkinId)
    .select());
}
