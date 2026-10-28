import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { notify } from '@/features/goals/notify';
import { useGoalCatalog } from '../hooks/useGoalCatalog';
import { useGoalMutations } from '../hooks/useGoals';
import { editPermissions, goalToInput, validateGoalUpdate } from '../validation/goalSchema';
import GoalConfigForm from './form/GoalConfigForm';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from './goalUi';
import { useT } from '@/lib/LocaleContext';

/**
 * Edición de un objetivo según las reglas de período y ciclo de vida.
 * @param {{ goal: any, now: Date }} props
 */
export default function GoalEditor({ goal, now }) {
  const t = useT();
  const navigate = useNavigate();
  const { champions } = useGoalCatalog();
  const { update } = useGoalMutations();
  const permissions = editPermissions(goal, now);
  const [draft, setDraft] = useState(() => goalToInput(goal));
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));

  const save = () => {
    const input = permissions.canEditConfig ? draft : { name: draft.name, description: draft.description };
    const result = validateGoalUpdate(goal, input, { now: new Date() });
    if (result.success === false) {
      setErrors(result.errors);
      return;
    }
    update.mutate({ goal, input }, {
      onSuccess: () => {
        notify({ title: t('goals.editor.updated'), description: t('goals.editor.updatedDescription') });
        navigate(`/objetivos/${goal.id}`);
      },
      onError: error => {
        if (/** @type {any} */ (error)?.errors) setErrors(/** @type {any} */ (error).errors);
        notify({ variant: 'destructive', title: t('goals.editor.saveError'), description: error?.message || t('common.tryAgain') });
      },
    });
  };

  return (
    <div className="rd-goal-flow space-y-4">
      <div className="space-y-1">
        <Link to={`/objetivos/${goal.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft size={14} /> {t('goals.editor.backToGoal')}
        </Link>
        <h1 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.06em] text-foreground md:text-4xl">{t('goals.editor.title')}</h1>
      </div>

      <section className="rd-card rd-goal-flow-body rd-goal-step flex flex-col gap-4 p-4 md:p-5">
        <div className="rd-goal-step-content">
          <GoalConfigForm
            value={draft}
            onChange={setDraft}
            errors={errors}
            mode="edit"
            canEditConfig={permissions.canEditConfig}
            championOptions={champions}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
          <Link to={`/objetivos/${goal.id}`} className={BUTTON_SECONDARY}>{t('common.cancel')}</Link>
          <button type="button" onClick={save} disabled={update.isPending} className={BUTTON_PRIMARY}>
            <Save size={15} /> {update.isPending ? t('common.saving') : t('common.saveChanges')}
          </button>
        </div>
      </section>
    </div>
  );
}
