import { Languages } from 'lucide-react';
import { LOCALES } from '@/i18n/catalogI18n';
import { useLocale, useT } from '@/lib/LocaleContext';

export default function LanguageSelect({ compact = false, className = '' }) {
  const { locale, setLocale } = useLocale();
  const t = useT();

  return (
    <label
      className={`relative flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors ${className}`}
      title={t('common.language')}
    >
      <Languages size={14} className="shrink-0" aria-hidden="true" />
      <select
        value={locale}
        onChange={event => setLocale(event.target.value)}
        aria-label={t('common.language')}
        className="cursor-pointer appearance-none bg-transparent text-xs font-medium outline-none"
      >
        {LOCALES.map(option => (
          <option key={option.code} value={option.code} className="bg-popover text-foreground">
            {compact ? option.short : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
