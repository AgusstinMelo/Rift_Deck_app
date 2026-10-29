import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { LOCALES } from '@/i18n/catalogI18n';
import { useLocale, useT } from '@/lib/LocaleContext';
import LocaleFlag from '@/components/LocaleFlag';

// "Español (Latinoamérica)" -> idioma y región por separado, para que entren en el sidebar.
const splitLabel = label => {
  const match = label.match(/^(.*?)\s*\((.*)\)$/);
  return match ? { name: match[1], region: match[2] } : { name: label, region: '' };
};

// Selector de idioma con el estilo de la app (el <select> nativo no se puede estilizar).
// `compact` muestra solo el código (ES-LA, EN...) para encabezados angostos; `flagOnly`, solo la bandera.
export default function LanguageSelect({ compact = false, flagOnly = false, className = '' }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();
  const narrow = compact || flagOnly;
  const current = LOCALES.find(option => option.code === locale) || LOCALES[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    // Al abrir, el foco va al idioma activo para poder moverse con las flechas.
    optionRefs.current[LOCALES.indexOf(current)]?.focus();
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, current]);

  const choose = code => {
    setLocale(code);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = event => {
    const index = optionRefs.current.indexOf(document.activeElement);
    const focusAt = next => optionRefs.current[(next + LOCALES.length) % LOCALES.length]?.focus();
    if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusAt(0); }
    else if (event.key === 'End') { event.preventDefault(); focusAt(LOCALES.length - 1); }
    else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${narrow ? '' : 'mb-2'} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${t('common.language')}: ${current.label}`}
        title={t('common.language')}
        // Solo texto, sin recuadro: ocupa una línea y no compite con el buscador.
        className={`flex max-w-full items-center gap-1.5 text-xs font-medium transition-colors
          ${narrow ? '' : 'px-3 py-1'}
          ${open ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
      >
        <LocaleFlag locale={current.code} />
        {!flagOnly && (
          <>
            <span className="truncate">
              {compact ? current.short : current.label}
            </span>
            <ChevronDown
              size={12}
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('common.language')}
          onKeyDown={onListKeyDown}
          className={`absolute top-[calc(100%+6px)] z-[370] rounded-xl border border-primary/20 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md
            ${narrow ? 'right-0 w-56' : 'left-0 right-0'}`}
        >
          {LOCALES.map((option, index) => {
            const selected = option.code === locale;
            const { name, region } = splitLabel(option.label);
            return (
              <li key={option.code} role="presentation">
                <button
                  ref={element => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(option.code)}
                  className={`flex w-full items-center gap-2.5 rounded-lg min-h-[44px] px-2.5 py-1.5 text-left text-sm outline-none transition-colors
                    focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-primary/30
                    ${selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-primary/5'}`}
                >
                  <LocaleFlag
                    locale={option.code}
                    className={`h-[18px] w-[27px] transition-opacity ${selected ? 'ring-primary/60' : 'opacity-80 ring-white/15'}`}
                  />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate">{name}</span>
                    {region && <span className={`block truncate text-[11px] ${selected ? 'text-primary/70' : 'text-muted-foreground'}`}>{region}</span>}
                  </span>
                  {selected && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
