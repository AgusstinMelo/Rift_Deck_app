import { useMemo, useState } from 'react';
import { Info, Swords } from 'lucide-react';
import MatchCard from '@/components/matches/MatchCard';
import EmptyState from '@/components/ui/EmptyState';
import { exclusionLabel } from '../texts';
import { BUTTON_SECONDARY } from './goalUi';
import { useT } from '@/lib/LocaleContext';

const PAGE_SIZE = 15;

function MatchList({ rows, champions, items, onEditMatch, onDeleteMatch, renderBadge = null }) {
  const t = useT();
  const [visible, setVisible] = useState(PAGE_SIZE);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      {rows.slice(0, visible).map(({ match, exclusion }) => (
        <div key={match.id} className="rd-card overflow-visible">
          {renderBadge && renderBadge(exclusion)}
          <MatchCard match={match} champions={champions} items={items} onEdit={onEditMatch} onDelete={onDeleteMatch} compact />
        </div>
      ))}
      {rows.length > visible && (
        <button type="button" onClick={() => setVisible(count => count + PAGE_SIZE)} className={`${BUTTON_SECONDARY} w-full`}>
          {t('goals.matchesPanel.showMore', { count: rows.length - visible })}
        </button>
      )}
    </div>
  );
}

/**
 * Partidas que sustentan el progreso y partidas excluidas con su motivo.
 * @param {{ evaluation: import('../model/goalConstants').GoalEvaluation, matches: any[], champions: any[], items: any[],
 *   truncated: boolean, onEditMatch: (match: any) => void, onDeleteMatch: (id: string) => void }} props
 */
export default function GoalMatchesPanel({ evaluation, matches, champions, items, truncated, onEditMatch, onDeleteMatch }) {
  const t = useT();
  const [tab, setTab] = useState('included');

  const { included, excluded } = useMemo(() => {
    const byId = new Map(matches.map(match => [String(match.id), match]));
    return {
      included: [...evaluation.includedIds].reverse().map(id => ({ match: byId.get(id), exclusion: null })).filter(row => row.match),
      excluded: evaluation.excluded.map(exclusion => ({ match: byId.get(exclusion.id), exclusion })).filter(row => row.match),
    };
  }, [matches, evaluation]);

  const reasonSummary = Object.values(evaluation.excluded.reduce((acc, exclusion) => {
    const label = exclusionLabel(exclusion);
    acc[label] = { label, count: (acc[label]?.count || 0) + 1 };
    return acc;
  }, {}));

  const handleDelete = id => onDeleteMatch(id);

  return (
    <section className="rd-card rd-goal-panel p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="rd-card-title">{t('goals.matchesPanel.title')}</h2>
        <div className="rd-panel-tabs" role="tablist" aria-label={t('goals.matchesPanel.title')}>
          <button type="button" role="tab" aria-selected={tab === 'included'} onClick={() => setTab('included')}
            className={`rd-panel-tab ${tab === 'included' ? 'rd-panel-tab-active' : ''}`}>
            {t('goals.matchesPanel.included', { count: included.length })}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'excluded'} onClick={() => setTab('excluded')}
            className={`rd-panel-tab ${tab === 'excluded' ? 'rd-panel-tab-active' : ''}`}>
            {t('goals.matchesPanel.excluded', { count: excluded.length })}
          </button>
        </div>
      </div>

      {(evaluation.outOfPeriodCount > 0 || truncated) && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {evaluation.outOfPeriodCount > 0 && t('goals.matchesPanel.outOfPeriod', { count: evaluation.outOfPeriodCount })}
            {truncated && t('goals.matchesPanel.truncated')}
          </span>
        </p>
      )}

      <div className="rd-goal-panel-scroll">
      {tab === 'included' && (
        included.length === 0
          ? <EmptyState icon={Swords} title={t('goals.matchesPanel.noIncludedTitle')} description={t('goals.matchesPanel.noIncludedDescription')} action={null} />
          : <MatchList rows={included} champions={champions} items={items} onEditMatch={onEditMatch} onDeleteMatch={handleDelete} />
      )}

      {tab === 'excluded' && (
        excluded.length === 0
          ? <EmptyState icon={Swords} title={t('goals.matchesPanel.noExcludedTitle')} description={t('goals.matchesPanel.noExcludedDescription')} action={null} />
          : (
            <div className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {reasonSummary.map(({ label, count }) => (
                  <li key={label} className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground">
                    {label}: <span className="font-semibold text-foreground">{count}</span>
                  </li>
                ))}
              </ul>
              <MatchList
                rows={excluded}
                champions={champions}
                items={items}
                onEditMatch={onEditMatch}
                onDeleteMatch={handleDelete}
                renderBadge={exclusion => (
                  <p className="border-b border-border/60 px-4 py-1 text-[11px] font-semibold text-amber-300">{exclusionLabel(exclusion)}</p>
                )}
              />
            </div>
          )
      )}
      </div>
    </section>
  );
}
