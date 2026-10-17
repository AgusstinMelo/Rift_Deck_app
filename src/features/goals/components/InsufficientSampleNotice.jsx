import { AlertTriangle } from 'lucide-react';
import { METRIC_KIND, PERIOD_STATUS } from '../model/goalConstants';

/**
 * Aviso de evidencia insuficiente en objetivos de rendimiento.
 * En modo compacto (tarjetas) usa una sola línea corta.
 * @param {{ evaluation: import('../model/goalConstants').GoalEvaluation, compact?: boolean }} props
 */
export default function InsufficientSampleNotice({ evaluation, compact = false }) {
  if (evaluation.kind !== METRIC_KIND.PERFORMANCE) return null;
  if (evaluation.periodStatus === PERIOD_STATUS.SCHEDULED) return null;
  const missing = evaluation.minSample - evaluation.sampleSize;
  if (missing <= 0) return null;

  const closed = evaluation.periodStatus === PERIOD_STATUS.CLOSED;
  const partidas = missing === 1 ? 'partida válida' : 'partidas válidas';

  if (compact) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
        <AlertTriangle size={13} className="shrink-0 text-amber-300" />
        <span className="line-clamp-1">
          {closed
            ? `Evidencia insuficiente: cerró con ${evaluation.sampleSize}/${evaluation.minSample} partidas.`
            : `Evidencia insuficiente: faltan ${missing} ${partidas}.`}
        </span>
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-300" />
      <p>
        {closed
          ? `Evidencia insuficiente: el período cerró con ${evaluation.sampleSize} de ${evaluation.minSample} partidas válidas necesarias, así que el resultado no es concluyente.`
          : `Evidencia insuficiente: faltan ${missing} ${partidas} para llegar a la muestra mínima de ${evaluation.minSample}.`}
      </p>
    </div>
  );
}
