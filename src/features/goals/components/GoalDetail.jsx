import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, Ban, CalendarDays, Pencil } from 'lucide-react';
import { deleteMatch } from '@/api/matchesSupabase';
import { toast } from '@/components/ui/use-toast';
import MatchForm from '@/components/matches/MatchForm';
import { getMetric } from '../metrics/index';
import { LIFECYCLE } from '../model/goalConstants';
import { useGoalCatalog } from '../hooks/useGoalCatalog';
import { useGoalMutations } from '../hooks/useGoals';
import { isCurrent } from '../model/goalLists';
import { editPermissions } from '../validation/goalSchema';
import { describeGoal, formatPeriod } from '../texts';
import ConfirmDialog from './ConfirmDialog';
import GoalCheckinsPanel from './GoalCheckinsPanel';
import GoalEvolutionChart from './GoalEvolutionChart';
import GoalExplanation from './GoalExplanation';
import GoalMatchesPanel from './GoalMatchesPanel';
import GoalOutcomeBadge from './GoalOutcomeBadge';
import GoalProgress from './GoalProgress';
import InsufficientSampleNotice from './InsufficientSampleNotice';
import { BUTTON_SECONDARY } from './goalUi';

const LIFECYCLE_ACTIONS = {
  [LIFECYCLE.CANCELLED]: {
    title: 'Cancelar objetivo',
    description: 'El objetivo deja de seguirse y pasa al historial sin resultado. No se puede reactivar.',
    confirmLabel: 'Cancelar objetivo',
    done: 'Objetivo cancelado',
  },
  [LIFECYCLE.ARCHIVED]: {
    title: 'Archivar objetivo',
    description: 'El objetivo se guarda en Archivados con su resultado.',
    confirmLabel: 'Archivar',
    done: 'Objetivo archivado',
  },
};

/**
 * Detalle de un objetivo: progreso, explicación, evolución y trazabilidad.
 * @param {{ item: import('../model/goalLists').GoalItem, matches: any[], now: Date }} props
 */
export default function GoalDetail({ item, matches, now }) {
  const { goal, evaluation, checkins, truncated } = item;
  const metric = getMetric(goal.metric);
  const permissions = editPermissions(goal, now);
  const qc = useQueryClient();
  const { champions, items, gamePatches } = useGoalCatalog(matches);
  const { setLifecycle } = useGoalMutations();

  const [pendingLifecycle, setPendingLifecycle] = useState(/** @type {string|null} */ (null));
  const [editingMatch, setEditingMatch] = useState(/** @type {any} */ (null));
  const [matchToDelete, setMatchToDelete] = useState(/** @type {any} */ (null));

  const deleteMatchMutation = useMutation({
    mutationFn: id => deleteMatch(id),
    onSuccess: () => {
      setMatchToDelete(null);
      qc.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  const confirmLifecycle = () => setLifecycle.mutate({ goal, lifecycle: pendingLifecycle }, {
    onSuccess: () => {
      toast({ title: LIFECYCLE_ACTIONS[pendingLifecycle].done });
      setPendingLifecycle(null);
    },
    onError: error => toast({ variant: 'destructive', title: 'No se pudo actualizar el objetivo', description: error?.message || 'Intentá nuevamente.' }),
  });

  if (editingMatch) {
    return (
      <MatchForm
        match={editingMatch}
        patches={gamePatches}
        defaultPatch=""
        onClose={() => setEditingMatch(null)}
        onSaved={() => {
          setEditingMatch(null);
          qc.invalidateQueries({ queryKey: ['matches'] });
        }}
      />
    );
  }

  const action = pendingLifecycle ? LIFECYCLE_ACTIONS[pendingLifecycle] : null;
  const period = { ...evaluation.period, timezone: goal.timezone };
  const objective = describeGoal(goal, period).objective;

  return (
    <div className="rd-goal-detail space-y-4">
      {/* Encabezado compacto: identidad, estado y acciones en una franja. */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link to={isCurrent(item) ? '/objetivos' : '/objetivos?tab=historial'} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
              <ArrowLeft size={14} /> Objetivos
            </Link>
            <span className="text-border">/</span>
            <span className="rd-label">{metric.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="font-rajdhani text-3xl font-bold uppercase tracking-[-0.06em] text-foreground md:text-4xl break-words">{goal.name}</h1>
            <GoalOutcomeBadge lifecycle={goal.lifecycle} evaluation={evaluation} />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays size={13} /> {formatPeriod(evaluation.period)}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 lg:line-clamp-1" title={objective}>
            {objective}{goal.description ? ` · ${goal.description}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`/objetivos/${goal.id}/editar`} className={BUTTON_SECONDARY}><Pencil size={15} /> Editar</Link>
          {permissions.canCancel && (
            <button type="button" onClick={() => setPendingLifecycle(LIFECYCLE.CANCELLED)} className={BUTTON_SECONDARY}><Ban size={15} /> Cancelar</button>
          )}
          {permissions.canArchive && (
            <button type="button" onClick={() => setPendingLifecycle(LIFECYCLE.ARCHIVED)} className={BUTTON_SECONDARY}><Archive size={15} /> Archivar</button>
          )}
        </div>
      </header>

      {/* Franja de tres tarjetas de alto fijo: progreso, evolución y método de cálculo. */}
      <div className="rd-goal-detail-strip grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="rd-card rd-card-watermark flex flex-col gap-3 p-4">
          <p className="rd-label">Progreso</p>
          <GoalProgress goal={goal} evaluation={evaluation} compact />
          <InsufficientSampleNotice evaluation={evaluation} compact />
        </section>

        <section className="rd-card flex min-h-[13rem] flex-col gap-1 p-4">
          <p className="rd-label">Evolución</p>
          <GoalEvolutionChart goal={goal} evaluation={evaluation} compact={false} className="min-h-0 flex-1" />
        </section>

        <section className="rd-card rd-goal-detail-explanation flex flex-col gap-2 p-4 md:col-span-2 lg:col-span-1">
          <p className="rd-label">Cómo se calcula</p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <GoalExplanation goal={goal} period={period} compact />
          </div>
        </section>
      </div>

      {metric.source === 'checkins' ? (
        <GoalCheckinsPanel goal={goal} checkins={checkins} />
      ) : (
        <GoalMatchesPanel
          evaluation={evaluation}
          matches={matches}
          champions={champions}
          items={items}
          truncated={truncated}
          onEditMatch={setEditingMatch}
          onDeleteMatch={id => setMatchToDelete(matches.find(match => String(match.id) === String(id)) || null)}
        />
      )}

      <ConfirmDialog
        open={!!action}
        title={action?.title || ''}
        description={action?.description || ''}
        confirmLabel={action?.confirmLabel || ''}
        tone={pendingLifecycle === LIFECYCLE.CANCELLED ? 'danger' : 'primary'}
        pending={setLifecycle.isPending}
        onCancel={() => setPendingLifecycle(null)}
        onConfirm={confirmLifecycle}
      />

      <ConfirmDialog
        open={!!matchToDelete}
        title="Eliminar partida"
        description={`Se eliminará la partida de ${matchToDelete?.own_champion_name || 'este campeón'} de tu historial y se recalcularán tus objetivos.`}
        confirmLabel="Eliminar"
        tone="danger"
        pending={deleteMatchMutation.isPending}
        onCancel={() => setMatchToDelete(null)}
        onConfirm={() => deleteMatchMutation.mutate(matchToDelete.id)}
      />
    </div>
  );
}
