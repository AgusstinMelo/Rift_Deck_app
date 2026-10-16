import { describeGoal } from '../texts';

/**
 * Explicación en lenguaje natural de un objetivo: qué se busca y cómo se calcula.
 * @param {{ goal: any, period: { startDate: string, endDate: string, timezone: string } }} props
 */
export default function GoalExplanation({ goal, period }) {
  const text = describeGoal(goal, period);
  return (
    <div className="space-y-3">
      <p className="font-rajdhani text-xl font-bold leading-snug text-foreground">{text.objective}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {text.calculation.map(line => <li key={line}>{line}</li>)}
      </ul>
      <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground/90">{text.definitive}</p>
    </div>
  );
}
