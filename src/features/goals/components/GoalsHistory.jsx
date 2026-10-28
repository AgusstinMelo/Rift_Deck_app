import { useState } from 'react';
import { History } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import GoalsCarousel from './GoalsCarousel';
import { useT } from '@/lib/LocaleContext';

/**
 * Panel de historial: objetivos finalizados (período cerrado o cancelados) y archivados.
 * La sub-selección queda fija y los objetivos se recorren en horizontal.
 * @param {{ finished: import('../model/goalLists').GoalItem[], archived: import('../model/goalLists').GoalItem[] }} props
 */
export default function GoalsHistory({ finished, archived }) {
  const t = useT();
  const [tab, setTab] = useState('finished');
  const rows = tab === 'finished' ? finished : archived;

  return (
    <section className="rd-goals-panel" aria-label={t('goals.history.aria')}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('goals.history.filterAria')}>
        {[
          { id: 'finished', label: t('goals.history.finished', { count: finished.length }) },
          { id: 'archived', label: t('goals.history.archived', { count: archived.length }) },
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

      {rows.length === 0 ? (
        <div className="rd-card p-4">
          <EmptyState
            icon={History}
            title={t(tab === 'finished' ? 'goals.history.noFinished' : 'goals.history.noArchived')}
            description={t(tab === 'finished' ? 'goals.history.noFinishedDescription' : 'goals.history.noArchivedDescription')}
            action={null}
          />
        </div>
      ) : (
        <GoalsCarousel key={tab} items={rows} label={t(tab === 'finished' ? 'goals.history.finishedList' : 'goals.history.archivedList')} />
      )}
    </section>
  );
}
