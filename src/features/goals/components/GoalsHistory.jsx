import { useState } from 'react';
import { History } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import GoalCard from './GoalCard';

/**
 * Panel de historial: objetivos finalizados (período cerrado o cancelados) y archivados.
 * La sub-selección queda fija y solo scrollea la grilla.
 * @param {{ finished: import('../model/goalLists').GoalItem[], archived: import('../model/goalLists').GoalItem[] }} props
 */
export default function GoalsHistory({ finished, archived }) {
  const [tab, setTab] = useState('finished');
  const rows = tab === 'finished' ? finished : archived;

  return (
    <section className="rd-goals-panel" aria-label="Historial de objetivos">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar historial">
        {[
          { id: 'finished', label: `Finalizados (${finished.length})` },
          { id: 'archived', label: `Archivados (${archived.length})` },
        ].map(option => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${tab === option.id
              ? 'border-primary/50 bg-primary/15 text-primary'
              : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rd-goals-scroll">
        {rows.length === 0 ? (
          <div className="rd-card p-4">
            <EmptyState
              icon={History}
              title={tab === 'finished' ? 'Sin objetivos finalizados' : 'Sin objetivos archivados'}
              description={tab === 'finished' ? 'Acá vas a ver los objetivos cuyo período cerró o que cancelaste.' : 'Archivá objetivos finalizados para ordenar tu historial.'}
              action={null}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(item => <GoalCard key={item.goal.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
