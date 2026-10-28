import { Link, Route, Routes, useLocation, useMatch, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Crown, Plus, Target } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import MembershipGate from '@/components/membership/MembershipGate';
import { useGoalsAccess } from '@/features/goals/access';
import { useEvaluatedGoals } from '@/features/goals/hooks/useGoals';
import { countOpenGoals, partitionGoals } from '@/features/goals/model/goalLists';
import GoalsCarousel from '@/features/goals/components/GoalsCarousel';
import GoalsErrorBoundary from '@/features/goals/components/GoalsErrorBoundary';
import GoalDetail from '@/features/goals/components/GoalDetail';
import GoalEditor from '@/features/goals/components/GoalEditor';
import GoalsHistory from '@/features/goals/components/GoalsHistory';
import GoalsSummary from '@/features/goals/components/GoalsSummary';
import GoalWizard from '@/features/goals/components/wizard/GoalWizard';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '@/features/goals/components/goalUi';
import { useT } from '@/lib/LocaleContext';

function CreateGoalButton() {
  const t = useT();
  return (
    <Link to="/objetivos/nuevo" className="rd-action-card group px-4 py-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Plus size={18} className="text-primary" />
      </div>
      <div className="text-left">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary">{t('goals.page.newGoal')}</p>
        <p className="hidden sm:block text-xs text-muted-foreground">{t('goals.page.newGoalHint')}</p>
      </div>
    </Link>
  );
}

const OVERVIEW_TABS = [
  { id: 'activos', label: 'goals.page.activeTab' },
  { id: 'historial', label: 'goals.page.historyTab' },
];

/** Aviso de la cuenta free: 1 objetivo en curso; Premium, ilimitados. */
function FreePlanHint({ openCount, limit }) {
  const t = useT();
  return (
    <p className="text-xs text-muted-foreground mt-1">
      {t('goals.page.freePlan', { open: Math.min(openCount, limit), limit })}
      <Link to="/membresia" className="text-primary hover:underline">{t('goals.page.premiumUnlimited')}</Link>
    </p>
  );
}

function GoalLimitReached() {
  const t = useT();
  return (
    <div className="rd-card p-6">
      <EmptyState
        icon={Crown}
        title={t('goals.page.limitTitle')}
        description={t('goals.page.limitDescription')}
        action={(
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/membresia" className={BUTTON_PRIMARY}><Crown size={15} /> {t('goals.page.seePremium')}</Link>
            <Link to="/objetivos" className={BUTTON_SECONDARY}><ArrowLeft size={15} /> {t('goals.errorBoundary.back')}</Link>
          </div>
        )}
      />
    </div>
  );
}

function GoalsHeader({ limit }) {
  const t = useT();
  return (
    <header className="rd-goals-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="rd-page-kicker flex items-center gap-2 mb-1">
          <span className="w-8 h-px bg-primary/50" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">{t('goals.page.kicker')}</span>
        </div>
        <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{t('goals.page.title')}</h1>
        <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">{t('goals.page.subtitle')}</p>
        {limit && <FreePlanHint openCount={limit.openCount} limit={limit.max} />}
      </div>
      <CreateGoalButton />
    </header>
  );
}

/** Barra de pestañas de ancho completo, igual que en Estadísticas. */
function GoalsTabs({ activeTab, onTabChange, counts }) {
  const t = useT();
  return (
    <div className="rd-goals-header rd-panel-tabs" role="tablist" aria-label={t('goals.page.sectionsAria')}>
      {OVERVIEW_TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`rd-panel-tab ${activeTab === tab.id ? 'rd-panel-tab-active' : ''}`}
        >
          {t(tab.label)} ({counts[tab.id]})
        </button>
      ))}
    </div>
  );
}

function LoadingState() {
  const t = useT();
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t('goals.page.loading')}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="rd-card h-20 animate-pulse" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="rd-card h-48 animate-pulse" />)}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  const t = useT();
  return (
    <div className="rd-card p-6">
      <EmptyState
        icon={AlertCircle}
        title={t('goals.page.loadError')}
        description={t('common.loadError')}
        action={<button type="button" onClick={onRetry} className={BUTTON_SECONDARY}>{t('common.retry')}</button>}
      />
    </div>
  );
}

function ActiveGoalsPanel({ current, all }) {
  const t = useT();
  return (
    <section className="rd-goals-panel" aria-label={t('goals.page.activeTab')}>
      <GoalsSummary current={current} all={all} />
      {current.length === 0 ? (
        <div className="rd-card p-6">
          <EmptyState
            icon={Target}
            title={t('goals.page.noActive')}
            description={t('goals.page.noActiveDescription')}
            action={<CreateGoalButton />}
          />
        </div>
      ) : (
        <GoalsCarousel items={current} label={t('goals.page.activeTab')} />
      )}
    </section>
  );
}

function GoalsOverview({ items, limit }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'historial' ? 'historial' : 'activos';
  const { current, finished, archived } = partitionGoals(items);
  const changeTab = tab => setSearchParams(tab === 'activos' ? {} : { tab }, { replace: true });

  return (
    <>
      <GoalsHeader limit={limit} />
      <GoalsTabs
        activeTab={activeTab}
        onTabChange={changeTab}
        counts={{ activos: current.length, historial: finished.length + archived.length }}
      />
      {activeTab === 'activos'
        ? <ActiveGoalsPanel current={current} all={items} />
        : <GoalsHistory finished={finished} archived={archived} />}
    </>
  );
}

function NotFound() {
  const t = useT();
  return (
    <div className="rd-card p-6">
      <EmptyState
        icon={Target}
        title={t('goals.page.notFound')}
        description={t('goals.page.notFoundDescription')}
        action={<Link to="/objetivos" className={BUTTON_SECONDARY}><ArrowLeft size={15} /> {t('goals.errorBoundary.back')}</Link>}
      />
    </div>
  );
}

function GoalRoute({ items, matches, now, editing = false }) {
  const { goalId } = useParams();
  const item = items.find(entry => String(entry.goal.id) === goalId);
  if (!item) return <NotFound />;
  return editing
    ? <GoalEditor goal={item.goal} now={now} />
    : <GoalDetail item={item} matches={matches} now={now} />;
}

function NewGoal({ matches, limitReached }) {
  const t = useT();
  return (
    <div className="rd-goal-flow space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <Link to="/objetivos" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft size={14} /> {t('goals.goalsLink')}
          </Link>
          <h1 className="rd-page-title font-rajdhani font-bold text-3xl md:text-4xl text-foreground tracking-[-0.06em] uppercase">{t('goals.page.newGoal')}</h1>
        </div>
        <p className="rd-page-subtitle text-sm text-muted-foreground">{t('goals.page.newGoalSubtitle')}</p>
      </header>
      {limitReached ? <GoalLimitReached /> : <GoalWizard matches={matches} />}
    </div>
  );
}

export default function Goals() {
  const t = useT();
  const location = useLocation();
  const isOverview = Boolean(useMatch('/objetivos'));
  const access = useGoalsAccess();
  const { items, matches, now, isLoading, error, refetch } = useEvaluatedGoals();

  if (access.isLoading) return <div className="rd-page rd-dashboard"><LoadingState /></div>;
  if (!access.hasAccess) return <MembershipGate />;

  const limit = access.openGoalLimit === null
    ? null
    : { max: access.openGoalLimit, openCount: countOpenGoals(items.map(item => item.goal), now) };
  const limitReached = limit !== null && limit.openCount >= limit.max;

  let content;
  if (isLoading) content = <LoadingState />;
  else if (error) content = <ErrorState onRetry={refetch} />;
  else {
    content = (
      <GoalsErrorBoundary resetKey={location.pathname}>
      <Routes>
        <Route index element={<GoalsOverview items={items} limit={limit} />} />
        <Route path="nuevo" element={<NewGoal matches={matches} limitReached={limitReached} />} />
        <Route path=":goalId" element={<GoalRoute items={items} matches={matches} now={now} />} />
        <Route path=":goalId/editar" element={<GoalRoute items={items} matches={matches} now={now} editing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </GoalsErrorBoundary>
    );
  }

  // La vista general se ajusta al viewport; detalle, edición y creación scrollean normal.
  const layoutClass = isOverview && !isLoading && !error ? 'rd-goals-layout' : '';
  return <div className={`rd-page rd-dashboard ${layoutClass}`}>{content}</div>;
}
