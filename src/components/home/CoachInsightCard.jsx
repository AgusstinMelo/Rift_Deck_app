import { ArrowRight, ShieldCheck } from 'lucide-react';

// Mismo diseño que las cartas de la pantalla Coach (Estadísticas → Coach).
const insightTone = {
  positive: 'border-green-500/25 bg-green-500/[0.04]',
  opportunity: 'border-cyan-500/25 bg-cyan-500/[0.04]',
  warning: 'border-yellow-500/25 bg-yellow-500/[0.04]',
  critical: 'border-red-500/25 bg-red-500/[0.04]',
  neutral: 'border-border/70 bg-background/25',
};

const insightAccent = {
  positive: 'bg-green-400', opportunity: 'bg-cyan-400', warning: 'bg-yellow-400',
  critical: 'bg-red-400', neutral: 'bg-primary/60',
};

export default function CoachInsightCard({ index, domain, confidenceLabel, title, thesis, evidence = [], action, tone = 'neutral', className = '' }) {
  return (
    <article className={`relative flex flex-col rounded-2xl border p-5 overflow-hidden land:p-4 ${insightTone[tone] || insightTone.neutral} ${className}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${insightAccent[tone] || insightAccent.neutral}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 mb-3 land:mb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            {String(index).padStart(2, '0')} · {domain}
          </p>
          <h3 className="font-rajdhani text-xl font-bold leading-tight text-foreground land:text-base">{title}</h3>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
          <ShieldCheck size={11} aria-hidden="true" /> {confidenceLabel}
        </span>
      </div>

      <div className="mt-1">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5 land:hidden">Qué muestran los datos</p>
        <p className="text-sm text-foreground/85 leading-relaxed land:line-clamp-2 land:text-xs short:text-[13px] short:leading-snug">{thesis}</p>
      </div>

      {evidence.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-4 land:hidden short:mt-3">
          {evidence.map(item => (
            <li key={item} className="rounded-md bg-background/45 border border-border/50 px-2 py-1 text-[11px] text-muted-foreground">{item}</li>
          ))}
        </ul>
      )}

      <div className="min-h-4 flex-1 land:min-h-2" aria-hidden="true" />

      <div className="flex items-start gap-2 pt-4 border-t border-border/50 land:pt-3">
        <ArrowRight size={14} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground land:line-clamp-2"><span className="text-foreground font-medium">Consejo:</span> {action}</p>
      </div>
    </article>
  );
}
