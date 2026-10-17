import { CheckCheck } from 'lucide-react';
import { LIFECYCLE } from '../model/goalConstants';
import { isFinished } from '../model/goalLists';
import { FINISHED_LABEL, LIFECYCLE_LABELS, OUTCOME_LABELS } from '../texts';
import { OUTCOME_TONES } from './goalUi';

/**
 * Estado y resultado del objetivo: "Finalizado · Alcanzado", "En curso · Provisional", etc.
 * Un objetivo cancelado no muestra resultado.
 * @param {{ lifecycle: string, evaluation: import('../model/goalConstants').GoalEvaluation, size?: 'sm' | 'md' }} props
 */
export default function GoalOutcomeBadge({ lifecycle, evaluation, size = 'md' }) {
  const text = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  if (lifecycle === LIFECYCLE.CANCELLED) {
    return (
      <span className={`inline-flex items-center rounded border border-border bg-secondary/80 px-2 py-0.5 font-bold uppercase tracking-wide text-muted-foreground ${text}`}>
        {LIFECYCLE_LABELS[lifecycle]}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {isFinished(evaluation) && (
        <span className={`inline-flex items-center gap-1 rounded border border-border bg-secondary/80 px-2 py-0.5 font-bold uppercase tracking-wide text-foreground/80 ${text}`}>
          <CheckCheck size={size === 'sm' ? 11 : 12} /> {FINISHED_LABEL}
        </span>
      )}
      <span className={`inline-flex items-center rounded border px-2 py-0.5 font-bold uppercase tracking-wide ${OUTCOME_TONES[evaluation.outcome]} ${text}`}>
        {OUTCOME_LABELS[evaluation.outcome]}
      </span>
      {evaluation.provisional && (
        <span
          className={`inline-flex items-center rounded border border-dashed border-primary/40 px-2 py-0.5 font-semibold text-primary/90 ${text}`}
          title="El resultado puede cambiar hasta que cierre el período."
        >
          Provisional
        </span>
      )}
      {lifecycle === LIFECYCLE.ARCHIVED && (
        <span className={`inline-flex items-center rounded border border-border px-2 py-0.5 text-muted-foreground ${text}`}>
          {LIFECYCLE_LABELS[lifecycle]}
        </span>
      )}
    </span>
  );
}
