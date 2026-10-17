import { Check } from 'lucide-react';

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

// Barra de pasos del sugeridor. Con `locked`, sólo el primer paso es accesible;
// `available` (opcional) deshabilita pasos puntuales con `false`.
export default function StepNav({ steps, step, completed, locked, onStep, available, label = 'Pasos' }) {
  return <nav aria-label={label} className="rd-card p-1.5">
    <ol className={`grid gap-1 ${COLUMNS[steps.length] || 'grid-cols-3'}`}>{steps.map((name, index) => {
      const active = index === step;
      const disabled = (index > 0 && locked) || available?.[index] === false;
      return <li key={name}><button type="button" aria-current={active ? 'step' : undefined} disabled={disabled} onClick={() => onStep(index)} className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${active ? 'border-primary bg-primary text-primary-foreground' : completed[index] ? 'border-primary/50 text-primary' : 'border-border'}`}>{completed[index] && !active ? <Check size={12} /> : index + 1}</span>
        {name}
      </button></li>;
    })}</ol>
  </nav>;
}
