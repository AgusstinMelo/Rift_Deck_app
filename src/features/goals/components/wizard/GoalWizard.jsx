import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { notify } from '@/features/goals/notify';
import { detectTimeZone } from '../../engine/period';
import { useGoalMutations } from '../../hooks/useGoals';
import { useGoalCatalog } from '../../hooks/useGoalCatalog';
import { blankDraft, buildSuggestions } from '../../suggestions';
import { validateGoalInput } from '../../validation/goalSchema';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../goalUi';
import GoalConfigForm from '../form/GoalConfigForm';
import GoalExplanation from '../GoalExplanation';
import GoalPreview from '../GoalPreview';
import StepSelect from './StepSelect';
import { useT } from '@/lib/LocaleContext';

const STEPS = [
  { id: 'select', label: 'goals.wizard.select' },
  { id: 'configure', label: 'goals.wizard.configure' },
  { id: 'confirm', label: 'goals.wizard.confirm' },
];

function StepIndicator({ current }) {
  const t = useT();
  const index = STEPS.findIndex(step => step.id === current);
  return (
    <ol className="flex gap-2" aria-label={t('goals.wizard.steps')}>
      {STEPS.map((step, i) => (
        <li key={step.id} className="flex-1">
          <div className={`h-1 rounded-full ${i <= index ? 'bg-primary' : 'bg-border'}`} />
          <p className={`mt-1.5 text-[11px] font-semibold uppercase tracking-wide ${i === index ? 'text-primary' : 'text-muted-foreground'}`}>
            {i + 1}. {t(step.label)}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Acciones del paso: quedan fijas abajo mientras el contenido scrollea. */
function StepFooter({ children }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-between">
      {children}
    </div>
  );
}

/**
 * Flujo de creación de objetivos en tres pasos.
 * @param {{ matches: any[] }} props
 */
export default function GoalWizard({ matches }) {
  const t = useT();
  const navigate = useNavigate();
  const timezone = useMemo(() => detectTimeZone(), []);
  const suggestions = useMemo(() => buildSuggestions({ timezone, matches }), [timezone, matches]);
  const { champions } = useGoalCatalog();
  const { create } = useGoalMutations();

  const [step, setStep] = useState('select');
  const [draft, setDraft] = useState(/** @type {any} */ (null));
  const [validated, setValidated] = useState(/** @type {any} */ (null));
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));

  const startFrom = input => {
    setDraft(input);
    setErrors({});
    setStep('configure');
  };

  const goToConfirm = () => {
    const result = validateGoalInput(draft);
    if (result.success === false) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setValidated(result.data);
    setStep('confirm');
  };

  const submit = () => {
    create.mutate(draft, {
      onSuccess: goal => {
        notify({ title: t('goals.wizard.created'), description: t('goals.wizard.createdDescription') });
        navigate(`/objetivos/${goal.id}`);
      },
      onError: error => {
        if (error?.name === 'GoalValidationError') {
          setErrors(/** @type {any} */ (error).errors);
          setStep('configure');
        }
        notify({ variant: 'destructive', title: t('goals.wizard.createError'), description: error?.message || t('common.tryAgain') });
      },
    });
  };

  return (
    <div className="rd-goal-flow-body flex flex-col gap-4">
      <StepIndicator current={step} />

      {step === 'select' && (
        <div className="rd-goal-step-fill">
          <StepSelect
            suggestions={suggestions}
            onPickSuggestion={suggestion => startFrom({ ...suggestion.input })}
            onPickCustom={metricId => startFrom(blankDraft(metricId, { timezone }))}
          />
        </div>
      )}

      {step === 'configure' && draft && (
        <section className="rd-card rd-goal-step flex flex-col gap-4 p-4 md:p-5">
          <div className="rd-goal-step-content">
            <GoalConfigForm
              value={draft}
              onChange={setDraft}
              errors={errors}
              mode="create"
              championOptions={champions}
            />
          </div>
          <StepFooter>
            <button type="button" onClick={() => setStep('select')} className={BUTTON_SECONDARY}>
              <ArrowLeft size={15} /> {t('common.back')}
            </button>
            <button type="button" onClick={goToConfirm} className={BUTTON_PRIMARY}>
              {t('goals.wizard.review')} <ArrowRight size={15} />
            </button>
          </StepFooter>
        </section>
      )}

      {step === 'confirm' && validated && (
        <section className="rd-card rd-goal-step flex flex-col gap-4 p-4 md:p-5">
          <div className="rd-goal-step-content rd-goal-form grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="rd-goal-form-pane space-y-4">
              <div>
                <p className="rd-section-kicker">{t('goals.wizard.summary')}</p>
                <h2 className="mt-1 font-rajdhani text-2xl font-bold text-foreground">{validated.name}</h2>
                {validated.description && <p className="mt-1 text-sm text-muted-foreground">{validated.description}</p>}
              </div>
              <GoalExplanation goal={validated} period={validated} />
            </div>
            <div className="rd-goal-form-pane rd-goal-form-filters">
              <GoalPreview data={validated} matches={matches} />
            </div>
          </div>
          <StepFooter>
            <button type="button" onClick={() => setStep('configure')} className={BUTTON_SECONDARY}>
              <ArrowLeft size={15} /> {t('common.edit')}
            </button>
            <button type="button" onClick={submit} disabled={create.isPending} className={BUTTON_PRIMARY}>
              <Check size={15} /> {create.isPending ? t('goals.wizard.creating') : t('goals.wizard.create')}
            </button>
          </StepFooter>
        </section>
      )}
    </div>
  );
}
