// Selector de parche de la tarjeta compartible, con el estilo de las barras del diálogo
// (el <select> nativo no se puede estilizar). Cerrado ocupa una sola línea aunque haya
// muchos parches; abierto, la lista tiene un alto máximo y se desplaza.
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * @param {{ value: string, options: string[], onChange: (value: string) => void,
 *   label: string, optionLabel: (value: string) => string }} props
 */
export default function PatchSelect({ value, options, onChange, label, optionLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    // Al abrir, el foco va al parche elegido para moverse con las flechas.
    const selected = optionRefs.current[options.indexOf(value)];
    selected?.focus();
    selected?.scrollIntoView({ block: 'nearest' });
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open, options, value]);

  const choose = option => {
    onChange(option);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = event => {
    const index = optionRefs.current.indexOf(document.activeElement);
    const focusAt = next => optionRefs.current[(next + options.length) % options.length]?.focus();
    if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusAt(0); }
    else if (event.key === 'End') { event.preventDefault(); focusAt(options.length - 1); }
    else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="rd-panel-tabs w-full">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(current => !current)}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={`${label}: ${optionLabel(value)}`}
          className="rd-panel-tab rd-panel-tab-active flex flex-1 items-center justify-between gap-2"
        >
          <span className="truncate">{optionLabel(value)}</span>
          <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[370] max-h-56 overflow-y-auto rounded-xl border border-primary/20 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-md [scrollbar-width:thin]"
        >
          {options.map((option, index) => {
            const selected = option === value;
            return (
              <li key={option} role="presentation">
                <button
                  ref={element => { optionRefs.current[index] = element; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center gap-2.5 rounded-lg min-h-[38px] px-3 py-1.5 text-left text-[0.8rem] font-semibold outline-none transition-colors
                    focus-visible:bg-primary/10 focus-visible:ring-1 focus-visible:ring-primary/30
                    ${selected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-primary/5'}`}
                >
                  <span className="min-w-0 flex-1 truncate">{optionLabel(option)}</span>
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
