import { useMemo } from 'react';
import { Eye } from 'lucide-react';
import { evaluateGoal } from '../engine/evaluateGoal';
import { getMetric } from '../metrics/index';
import { LIFECYCLE, PERIOD_STATUS } from '../model/goalConstants';
import { formatDate } from '../texts';
import { toGoalRecord } from '../validation/goalSchema';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import GoalProgress from './GoalProgress';
import InsufficientSampleNotice from './InsufficientSampleNotice';

/**
 * Vista previa de un objetivo todavía no creado, evaluado con las partidas actuales.
 * @param {{ data: any, matches: any[] }} props  `data` es la entrada ya validada.
 */
export default function GoalPreview({ data, matches }) {
  const goal = useMemo(() => ({ ...toGoalRecord(data), id: 'preview', lifecycle: LIFECYCLE.ACTIVE }), [data]);
  const evaluation = useMemo(() => evaluateGoal(goal, { matches, checkins: [] }, new Date()), [goal, matches]);
  const isManual = getMetric(goal.metric).source === 'checkins';

  let context;
  if (isManual) {
    context = 'Arranca en 0: el progreso se suma con los check-ins que registres.';
  } else if (evaluation.periodStatus === PERIOD_STATUS.SCHEDULED) {
    context = `El período empieza el ${formatDate(evaluation.period.startDate)}. Cuentan las partidas con fecha de juego dentro del período.`;
  } else {
    const excluded = evaluation.excluded.length;
    context = `${evaluation.sampleSize} ${evaluation.sampleSize === 1 ? 'partida ya cuenta' : 'partidas ya cuentan'} para este objetivo`
      + (excluded ? ` y ${excluded} del período ${excluded === 1 ? 'queda excluida' : 'quedan excluidas'}.` : '.');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="rd-section-kicker flex items-center gap-2"><Eye size={14} /> Si lo creás ahora</p>
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
      </div>
      <GoalProgress goal={goal} evaluation={evaluation} />
      <InsufficientSampleNotice evaluation={evaluation} />
      <p className="text-xs text-muted-foreground">{context}</p>
    </div>
  );
}
