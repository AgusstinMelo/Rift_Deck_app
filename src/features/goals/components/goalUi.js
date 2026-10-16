// Clases visuales compartidas por los componentes de Objetivos (mismo lenguaje que Partidas).
import { OUTCOME } from '../model/goalConstants';

export const INPUT_CLASS =
  'w-full bg-secondary/70 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

export const BUTTON_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed';

export const BUTTON_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed';

/** Acción principal destacada (dorado sólido). */
export const BUTTON_GOLD =
  'inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-[0_0_18px_rgba(212,175,55,.25)] hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(212,175,55,.35)] transition-all';

export const BUTTON_DANGER =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed';

export const CHIP_BASE = 'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all';
export const CHIP_ON = 'border-primary/50 bg-primary/15 text-primary';
export const CHIP_OFF = 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/30';

export const OUTCOME_TONES = {
  [OUTCOME.SCHEDULED]: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  [OUTCOME.IN_PROGRESS]: 'border-primary/30 bg-primary/10 text-primary',
  [OUTCOME.ACHIEVED]: 'border-green-400/30 bg-green-500/10 text-green-400',
  [OUTCOME.NOT_ACHIEVED]: 'border-red-400/30 bg-red-500/10 text-red-400',
  [OUTCOME.INCONCLUSIVE]: 'border-zinc-400/30 bg-zinc-500/10 text-zinc-300',
};

export const OUTCOME_BAR = {
  [OUTCOME.SCHEDULED]: 'bg-sky-400',
  [OUTCOME.IN_PROGRESS]: 'bg-primary',
  [OUTCOME.ACHIEVED]: 'bg-green-400',
  [OUTCOME.NOT_ACHIEVED]: 'bg-red-400',
  [OUTCOME.INCONCLUSIVE]: 'bg-zinc-400',
};
