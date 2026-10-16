import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { periodDates, todayIn } from '../engine/period';
import { useGoalMutations } from '../hooks/useGoals';
import { GOAL_LIMITS } from '../model/goalConstants';
import { formatDate, formatMetricValue } from '../texts';
import { validateCheckinInput } from '../validation/checkinSchema';
import ConfirmDialog from './ConfirmDialog';
import Field from './form/Field';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT_CLASS } from './goalUi';

function defaultDate(goal) {
  const today = todayIn(goal.timezone);
  const { startDate, endDate } = periodDates(goal);
  if (today < startDate) return startDate;
  return today > endDate ? endDate : today;
}

function CheckinForm({ goal, initial, pending, onSubmit, onCancel }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }));

  const submit = event => {
    event.preventDefault();
    const result = validateCheckinInput(goal, values);
    if (result.success === false) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(values, setErrors);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[8rem_10rem_minmax(0,1fr)_auto] sm:items-start">
      <Field label={`Cantidad (${goal.unit})`} error={errors.amount}>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" value={values.amount}
          onChange={event => set('amount', event.target.value)} className={INPUT_CLASS} aria-label="Cantidad" />
      </Field>
      <Field label="Fecha" error={errors.date}>
        <input type="date" value={values.date} onChange={event => set('date', event.target.value)} className={INPUT_CLASS} aria-label="Fecha" />
      </Field>
      <Field label="Nota (opcional)" error={errors.note}>
        <input value={values.note} maxLength={GOAL_LIMITS.NOTE_MAX} onChange={event => set('note', event.target.value)}
          className={INPUT_CLASS} aria-label="Nota" />
      </Field>
      <div className="flex gap-2 sm:pt-5">
        {onCancel && <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>Cancelar</button>}
        <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
          <Plus size={15} /> {pending ? 'Guardando...' : initial.id ? 'Guardar' : 'Registrar'}
        </button>
      </div>
    </form>
  );
}

/**
 * Check-ins de un objetivo manual: alta, edición y baja.
 * @param {{ goal: any, checkins: any[] }} props
 */
export default function GoalCheckinsPanel({ goal, checkins }) {
  const mutations = useGoalMutations();
  const [editingId, setEditingId] = useState(/** @type {string|null} */ (null));
  const [toDelete, setToDelete] = useState(/** @type {any} */ (null));
  const [formKey, setFormKey] = useState(0);
  const sorted = [...checkins].sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));

  const onError = setErrors => error => {
    if (error?.errors) setErrors(error.errors);
    toast({ variant: 'destructive', title: 'No se pudo guardar el check-in', description: error?.message || 'Intentá nuevamente.' });
  };

  const create = (values, setErrors) => mutations.createCheckin.mutate({ goal, input: values }, {
    onSuccess: () => setFormKey(key => key + 1),
    onError: onError(setErrors),
  });

  const update = id => (values, setErrors) => mutations.updateCheckin.mutate({ goal, checkinId: id, input: values }, {
    onSuccess: () => setEditingId(null),
    onError: onError(setErrors),
  });

  return (
    <section className="rd-card rd-goal-panel p-4 space-y-4">
      <h2 className="rd-card-title">Check-ins</h2>

      <CheckinForm
        key={formKey}
        goal={goal}
        initial={{ id: null, amount: '', date: defaultDate(goal), note: '' }}
        pending={mutations.createCheckin.isPending}
        onSubmit={create}
        onCancel={null}
      />

      <div className="rd-goal-panel-scroll">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no registraste check-ins.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {sorted.map(checkin => (
            <li key={checkin.id} className="py-3">
              {editingId === checkin.id ? (
                <CheckinForm
                  goal={goal}
                  initial={{ id: checkin.id, amount: String(checkin.amount), date: checkin.checkin_date, note: checkin.note || '' }}
                  pending={mutations.updateCheckin.isPending}
                  onSubmit={update(checkin.id)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{formatMetricValue(goal, Number(checkin.amount))}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(checkin.checkin_date)}{checkin.note ? ` · ${checkin.note}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditingId(checkin.id)} className="rounded-lg p-2 text-muted-foreground hover:text-primary" aria-label="Editar check-in">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => setToDelete(checkin)} className="rounded-lg p-2 text-muted-foreground hover:text-red-400" aria-label="Eliminar check-in">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar check-in"
        description="El progreso del objetivo se recalcula al eliminarlo."
        confirmLabel="Eliminar"
        tone="danger"
        pending={mutations.deleteCheckin.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => mutations.deleteCheckin.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </section>
  );
}
