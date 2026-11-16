import { lazy, Suspense } from 'react';

// recharts pesa ~500 KB sin minificar: se carga aparte para que la pantalla de objetivos
// abra sin esperarlo. Mientras llega, el espacio del gráfico queda reservado.
const GoalEvolutionChart = lazy(() => import('./GoalEvolutionChart'));

/** @param {{ goal: any, evaluation: any, compact?: boolean, className?: string }} props */
export default function LazyGoalEvolutionChart(props) {
  return (
    <Suspense fallback={<div className={props.className ?? 'h-56'} aria-hidden="true" />}>
      <GoalEvolutionChart {...props} />
    </Suspense>
  );
}
