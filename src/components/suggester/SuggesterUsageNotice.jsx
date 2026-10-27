import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';

/** Ejecuciones diarias que le quedan a la cuenta free. Con Premium no muestra nada. */
export default function SuggesterUsageNotice({ usage }) {
  if (!usage.isLoaded || usage.isUnlimited) return null;

  const exhausted = usage.remaining === 0;

  return (
    <p className={`rounded-xl border px-3 py-2 text-xs ${exhausted ? 'border-amber-400/30 bg-amber-400/5 text-amber-200' : 'border-border/60 bg-secondary/30 text-muted-foreground'}`}>
      {exhausted
        ? 'Usaste las 5 ejecuciones de hoy de la cuenta free. Volvé mañana o '
        : `Te ${usage.remaining === 1 ? 'queda 1 ejecución' : `quedan ${usage.remaining} ejecuciones`} de ${usage.limit} hoy · `}
      <Link to="/membresia" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
        <Crown size={12} /> {exhausted ? 'pasate a Premium' : 'Premium: ilimitado'}
      </Link>
      {exhausted && '.'}
    </p>
  );
}
