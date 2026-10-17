import { describeGoal } from '../texts';

/**
 * Explicación en lenguaje natural de un objetivo: qué se busca y cómo se calcula.
 * En modo compacto omite la frase principal (ya visible en el encabezado) y usa texto más chico.
 * @param {{ goal: any, period: { startDate: string, endDate: string, timezone: string }, compact?: boolean }} props
 */
export default function GoalExplanation({ goal, period, compact = false }) {
  const text = describeGoal(goal, period);
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && <p className="font-rajdhani text-xl font-bold leading-snug text-foreground">{text.objective}</p>}
      <ul className={`list-disc space-y-1.5 pl-5 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
        {text.calculation.map(line => <li key={line}>{line}</li>)}
      </ul>
      <p className={`rounded-xl border border-primary/20 bg-primary/5 text-foreground/90 ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}`}>
        {text.definitive}
      </p>
    </div>
  );
}
