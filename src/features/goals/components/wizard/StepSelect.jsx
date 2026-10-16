import { CalendarCheck, Crosshair, PenLine, Sparkles, Users } from 'lucide-react';
import { listMetrics } from '../../metrics/index';
import { METRIC_KIND } from '../../model/goalConstants';
import { GOAL_CATEGORIES } from '../../suggestions';

const CATEGORY_ICONS = { constancia: CalendarCheck, resultados: Crosshair, pool: Users, habitos: PenLine };

/**
 * Paso 1: categorías con objetivos sugeridos u objetivo personalizado.
 * @param {{ suggestions: any[], onPickSuggestion: (suggestion: any) => void, onPickCustom: (metricId: string) => void }} props
 */
export default function StepSelect({ suggestions, onPickSuggestion, onPickCustom }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {GOAL_CATEGORIES.map(category => {
          const Icon = CATEGORY_ICONS[category.id] || Sparkles;
          const items = suggestions.filter(suggestion => suggestion.category === category.id);
          return (
            <section key={category.id} className="rd-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="rd-card-title">{category.label}</h2>
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Registrá partidas para recibir sugerencias de esta categoría.</p>
              ) : (
                <div className="space-y-2">
                  {items.map(suggestion => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => onPickSuggestion(suggestion)}
                      className="rd-action-card group w-full justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary">{suggestion.title}</span>
                      <Sparkles size={14} className="shrink-0 text-primary/70" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="rd-card p-4 space-y-3">
        <div>
          <h2 className="rd-card-title">Objetivo personalizado</h2>
          <p className="text-xs text-muted-foreground">Elegí la métrica y configurá todo a tu medida.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {listMetrics().map(metric => (
            <button
              key={metric.id}
              type="button"
              onClick={() => onPickCustom(metric.id)}
              className="rd-action-card group flex-col items-start gap-1 px-3 py-3 text-left"
            >
              <span className="text-sm font-semibold text-foreground group-hover:text-primary">{metric.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {metric.kind === METRIC_KIND.CUMULATIVE ? 'Acumulativa' : 'Rendimiento'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
