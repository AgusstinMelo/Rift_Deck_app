import { AlertTriangle } from 'lucide-react';
import { METRIC_KIND, PERIOD_STATUS } from '../model/goalConstants';

/**
 * Aviso de evidencia insuficiente en objetivos de rendimiento.
 * @param {{ evaluation: import('../model/goalConstants').GoalEvaluation }} props
 */
export default function InsufficientSampleNotice({ evaluation }) {
  if (evaluation.kind !== METRIC_KIND.PERFORMANCE) return null;
  if (evaluation.periodStatus === PERIOD_STATUS.SCHEDULED) return null;
  const missing = evaluation.minSample - evaluation.sampleSize;
  if (missing <= 0) return null;

  const closed = evaluation.periodStatus === PERIOD_STATUS.CLOSED;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
      <p>
        {closed
          ? `Evidencia insuficiente: el período cerró con ${evaluation.sampleSize} de ${evaluation.minSample} partidas válidas necesarias, así que el resultado no es concluyente.`
          : `Evidencia insuficiente: faltan ${missing} ${missing === 1 ? 'partida válida' : 'partidas válidas'} para llegar a la muestra mínima de ${evaluation.minSample}.`}
      </p>
    </div>
  );
}
