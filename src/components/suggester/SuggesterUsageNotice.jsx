import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useT } from '@/lib/LocaleContext';

/** Ejecuciones diarias que le quedan a la cuenta free. Con Premium no muestra nada. */
export default function SuggesterUsageNotice({ usage }) {
  const t = useT();
  if (!usage.isLoaded || usage.isUnlimited) return null;

  const exhausted = usage.remaining === 0;

  return (
    <p className={`rounded-xl border px-3 py-2 text-xs ${exhausted ? 'border-amber-400/30 bg-amber-400/5 text-amber-200' : 'border-border/60 bg-secondary/30 text-muted-foreground'}`}>
      {exhausted
        ? t('suggester.usage.exhausted')
        : t(usage.remaining === 1 ? 'suggester.usage.remainingOne' : 'suggester.usage.remainingOther', { remaining: usage.remaining, limit: usage.limit })}
      <Link to="/membresia" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
        <Crown size={12} /> {t(exhausted ? 'suggester.usage.goPremium' : 'suggester.usage.premiumUnlimited')}
      </Link>
      {exhausted && '.'}
    </p>
  );
}
