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
import { useT } from '@/lib/LocaleContext';

/**
 * Vista previa de un objetivo todavía no creado, evaluado con las partidas actuales.
 * @param {{ data: any, matches: any[] }} props  `data` es la entrada ya validada.
 */
export default function GoalPreview({ data, matches }) {
  const t = useT();
  const goal = useMemo(() => ({ ...toGoalRecord(data), id: 'preview', lifecycle: LIFECYCLE.ACTIVE }), [data]);
  const evaluation = useMemo(() => evaluateGoal(goal, { matches, checkins: [] }, new Date()), [goal, matches]);
  const isManual = getMetric(goal.metric).source === 'checkins';

  let context;
  if (isManual) {
    context = t('goals.preview.manual');
  } else if (evaluation.periodStatus === PERIOD_STATUS.SCHEDULED) {
    context = t('goals.preview.scheduled', { date: formatDate(evaluation.period.startDate) });
  } else {
    const excluded = evaluation.excluded.length;
    context = t(evaluation.sampleSize === 1 ? 'goals.preview.countOne' : 'goals.preview.countOther', { count: evaluation.sampleSize })
      + (excluded ? t(excluded === 1 ? 'goals.preview.excludedOne' : 'goals.preview.excludedOther', { count: excluded }) : '.');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="rd-section-kicker flex items-center gap-2"><Eye size={14} /> {t('goals.preview.title')}</p>
        <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} size="sm" />
      </div>
      <GoalProgress goal={goal} evaluation={evaluation} />
      <InsufficientSampleNotice evaluation={evaluation} />
      <p className="text-xs text-muted-foreground">{context}</p>
    </div>
  );
}
