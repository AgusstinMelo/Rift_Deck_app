import { useState } from 'react';
import { History } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import GoalCard from './GoalCard';

/**
 * Historial de objetivos finalizados (período cerrado o cancelados) y archivados.
 * @param {{ finished: import('../model/goalLists').GoalItem[], archived: import('../model/goalLists').GoalItem[] }} props
 */
export default function GoalsHistory({ finished, archived }) {
  const [tab, setTab] = useState('finished');
  const rows = tab === 'finished' ? finished : archived;

  return (
    <section className="space-y-3" aria-label="Historial de objetivos">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-px w-4 bg-primary/50" />
          <h2 className="rd-card-title">Historial</h2>
        </div>
        <div className="rd-panel-tabs" role="tablist" aria-label="Historial">
          <button type="button" role="tab" aria-selected={tab === 'finished'} onClick={() => setTab('finished')}
            className={`rd-panel-tab ${tab === 'finished' ? 'rd-panel-tab-active' : ''}`}>
            Finalizados ({finished.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'archived'} onClick={() => setTab('archived')}
            className={`rd-panel-tab ${tab === 'archived' ? 'rd-panel-tab-active' : ''}`}>
            Archivados ({archived.length})
          </button>
        </div>
      </div>

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
    </section>
  );
}
