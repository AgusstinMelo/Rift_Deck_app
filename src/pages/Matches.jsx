import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { getUserMatches, createMatch, deleteMatch, deleteMatches } from '@/api/matchesSupabase';
import { getTierlistExecutions } from '@/api/tierlistSupabase';
import { Plus, Swords, Search, Trophy, Shield, Skull, Trash2 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import MatchForm from '@/components/matches/MatchForm';
import MatchBuilder from '@/components/matches/MatchBuilder';
import MatchCard from '@/components/matches/MatchCard';
import { useAuth } from '@/lib/AuthContext';
import { MATCH_TYPES } from '@/constants/matchTypes';
import { toast } from '@/components/ui/use-toast';
import { getPublishedGamePatches } from '@/api/gameCatalogSupabase';
import { PHONE_PORTRAIT_QUERY, useMatchMedia } from '@/hooks/useMatchMedia';
import { useT } from '@/lib/LocaleContext';

const showTemporaryToast = (options) => {
  const notification = toast(options);
  globalThis.setTimeout(() => notification.dismiss(), 3000);
};

function MatchMetric({ label, value, sub, icon: Icon, tone = 'primary' }) {
  const toneClass = {
    primary: 'text-primary',
    green: 'text-green-400',
    red: 'text-red-400',
    accent: 'text-accent',
  }[tone];

  return (
    <div className="rd-card rd-card-watermark p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        {Icon && <Icon size={16} className={toneClass} />}
        <span className="rd-label">{label}</span>
      </div>

      <p className={`font-rajdhani font-bold text-3xl tracking-[-0.08em] ${toneClass}`}>
        {value}
      </p>

      {sub && (
        <p className="text-xs text-muted-foreground mt-1">
          {sub}
        </p>
      )}
    </div>
  );
}

export default function Matches() {
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState('all');
  const qc = useQueryClient();
  const { user } = useAuth();
  const createInFlightRef = useRef(false);
  // En smartphone vertical los tres selectores comparten una fila: textos cortos.
  const compactFilters = useMatchMedia(PHONE_PORTRAIT_QUERY);

  const { data: champions = [] } = useQuery({
    queryKey: ['champions'],
    queryFn: () => Champion.list('name'),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['items'],
    queryFn: () => WRItem.list('name'),
  });

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches', user?.email],
    queryFn: () => user?.email
      ? getUserMatches(user, 1000)
      : [],
    enabled: !!user?.email,
  });

  const { data: tierlistExecutions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
  });

  const { data: gamePatches = [] } = useQuery({
    queryKey: ['game-patches', 'published'],
    queryFn: getPublishedGamePatches,
  });

  const latestTierlistPatch = gamePatches.find(patch => patch.status === 'active')?.version || tierlistExecutions.find(
    execution => execution.status === 'success' || execution.status === 'partial'
  )?.patch || '';

  const createMatchMutation = useMutation({
    mutationFn: (data) => createMatch(user, data),
    onSuccess: () => {
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['matches', user?.email] });
      showTemporaryToast({
        title: 'Partida guardada',
        description: 'La partida se agregó correctamente a tu historial.',
      });
    },
    onError: (error) => {
      console.error('No se pudo guardar la partida:', error);
      showTemporaryToast({
        variant: 'destructive',
        title: 'No se pudo guardar la partida',
        description: error?.message || 'Ocurrió un error inesperado. Intentá nuevamente.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMatch(id),
    onSuccess: () => {
      setMatchToDelete(null);
      qc.invalidateQueries(['matches']);
    },
  });

  const handleCreateMatch = (data) => {
    if (createInFlightRef.current) return;

    createInFlightRef.current = true;
    createMatchMutation.mutate(data, {
      onSettled: () => {
        createInFlightRef.current = false;
      },
    });
  };

  const deleteAllMutation = useMutation({
    mutationFn: () => deleteMatches(matches.map(m => m.id)),
    onSuccess: () => {
      setConfirmDeleteAll(false);
      setDeleteConfirmText('');
      qc.invalidateQueries(['matches']);
    },
  });

  const filtered = matches
    .filter(m => {
      const normalizedSearch = search.toLowerCase();

      const matchSearch =
        !search ||
        m.own_champion_name?.toLowerCase().includes(normalizedSearch) ||
        m.enemy_champion_name?.toLowerCase().includes(normalizedSearch);

      const matchLane = laneFilter === 'all' || m.lane === laneFilter;
      const matchResult = resultFilter === 'all' || m.result === resultFilter;
      const matchType = matchTypeFilter === 'all' || (m.type || 'ranked') === matchTypeFilter;

      return matchSearch && matchLane && matchResult && matchType;
    })
    .sort((a, b) => {
      const dateA = `${a.date || ''}T${a.hour || '00:00'}`;
      const dateB = `${b.date || ''}T${b.hour || '00:00'}`;
      return dateB.localeCompare(dateA);
    });

  if (showForm && !editing) {
    return (
      <div className="rd-page rd-dashboard">
        <MatchBuilder
          champions={champions}
          patches={gamePatches}
          defaultPatch={latestTierlistPatch}
          onSave={handleCreateMatch}
          onCancel={() => setShowForm(false)}
          isSaving={createMatchMutation.isPending}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rd-page rd-dashboard">
        <MatchForm
          match={editing}
          patches={gamePatches}
          defaultPatch={latestTierlistPatch}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries(['matches']);
          }}
        />
      </div>
    );
  }

  const wins = filtered.filter(m => m.result === 'win').length;
  const losses = filtered.length - wins;
  const wr = filtered.length > 0 ? ((wins / filtered.length) * 100).toFixed(1) : null;

  const wrTone =
    wr === null ? 'primary' :
    Number(wr) >= 55 ? 'green' :
    Number(wr) >= 45 ? 'primary' :
    'red';

  return (
    <div className="rd-page rd-dashboard rd-matches-layout">

      <div className="rd-matches-header flex items-start justify-between gap-4">
        <div>
          <div className="rd-page-kicker flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
             {t('matches.registroDePartidas')}
            </span>
          </div>

          <h1 className="rd-page-title font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
           {t('nav.matches')}
          </h1>

          <p className="rd-page-subtitle text-muted-foreground text-sm mt-1">
            {matches.length} {t('matches.partidasRegistradasEnTu')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            <button
              onClick={() => { setConfirmDeleteAll(true); setDeleteConfirmText(''); }}
              className="rd-action-card group px-4 py-3 border-red-500/20 hover:border-red-500/40"
            >
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-semibold text-sm text-foreground group-hover:text-red-400">
                 {t('matches.eliminarTodasLasPartidas')}
                </p>
                <p className="text-xs text-muted-foreground">
                 {t('matches.borrarHistorialCompleto')}
                </p>
              </div>
            </button>
          )}

          <button
            onClick={() => setShowForm(true)}
            className="rd-action-card group px-4 py-3"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Plus size={18} className="text-primary" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-semibold text-sm text-foreground group-hover:text-primary">
               {t('matches.nuevaPartida')}
              </p>
              <p className="text-xs text-muted-foreground">
               {t('matches.registrarResultado')}
              </p>
            </div>
          </button>
        </div>

        {/* Modal de confirmación */}
        {confirmDeleteAll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rd-card rd-modal-panel overflow-y-auto p-6 w-full max-w-sm mx-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-lg text-foreground">{t('matches.eliminarTodo')}</p>
                  <p className="text-xs text-muted-foreground">{t('builds.estaAccionNoSe')}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
               {t('matches.seEliminaran')} <span className="text-foreground font-semibold">{matches.length} {t('goals.unit.partidas')}</span> {t('matches.permanentementeParaConfirmarEscribi')} <span className="text-red-400 font-semibold">{t('matches.eliminarTodas')}</span> {t('matches.abajo')}
              </p>

              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={t('matches.eliminarTodas')}
                className="w-full bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-500/50 transition-all"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setConfirmDeleteAll(false); setDeleteConfirmText(''); }}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                 {t('common.cancel')}
                </button>
                <button
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteConfirmText !== t('matches.eliminarTodas') || deleteAllMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteAllMutation.isPending ? t('builds.eliminando') : t('matches.confirmar')}
                </button>
              </div>
            </div>
          </div>
        )}

        {matchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rd-card rd-modal-panel overflow-y-auto p-5 w-full max-w-xs mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-lg text-foreground">{t('goals.actions.deleteMatch')}</p>
                  <p className="text-xs text-muted-foreground">{t('builds.estaAccionNoSe')}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
               {t('matches.queresEliminarLaPartida')} <span className="text-foreground font-semibold">{matchToDelete.own_champion_name || t('common.thisChampion')}</span>?
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMatchToDelete(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                 {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(matchToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteMutation.isPending ? t('builds.eliminando') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="rd-matches-metrics grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MatchMetric
            label={t('nav.matches')}
            value={filtered.length}
            sub={t('matches.segunFiltrosActivos')}
            icon={Swords}
            tone="primary"
          />

          <MatchMetric
            label={t('goals.metric.winrate')}
            value={wr !== null ? `${wr}%` : '—'}
            sub={wr !== null ? t('matches.rendimientoFiltrado') : t('matches.sinMuestra')}
            icon={Trophy}
            tone={wrTone}
          />

          <MatchMetric
            label={t('matches.record')}
            value={`${wins}V / ${losses}D`}
            sub={t('matches.victoriasYDerrotas')}
            icon={Number(wr) >= 50 ? Shield : Skull}
            tone={Number(wr) >= 50 ? 'green' : 'red'}
          />
        </div>
      )}

      <div className="rd-matches-filters rd-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('matches.buscarPorCampeon')}
              className="w-full bg-secondary/70 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <select
            value={laneFilter}
            onChange={e => setLaneFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">{compactFilters ? t('goals.filterLabels.lanes') : t('library.todasLasLineas')}</option>
            <option value="top">{t('lanes.top')}</option>
            <option value="jungler">{t('builds.jungler')}</option>
            <option value="mid">{t('lanes.mid')}</option>
            <option value="adc">{t('lanes.adc')}</option>
            <option value="support">{t('lanes.support')}</option>
          </select>

          <select
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">{compactFilters ? t('matches.resultado') : t('matches.todosLosResultados')}</option>
            <option value="win">{t('goals.stat.victorias')}</option>
            <option value="loss">{t('matches.derrotas')}</option>
          </select>

          <select
            value={matchTypeFilter}
            onChange={e => setMatchTypeFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">{compactFilters ? t('matches.tipo') : t('matches.todosLosTipos')}</option>
            {MATCH_TYPES.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rd-matches-scroll">
        {isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="rd-card h-24 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rd-card rd-matches-empty p-6">
            <EmptyState
              icon={Swords}
              title={t('matches.sinPartidasRegistradas')}
              description={t('matches.registraTuPrimeraPartida')}
              action={
                <button
                  onClick={() => setShowForm(true)}
                  className="rd-action-card group px-4 py-3 mt-3"
                >
                  <Plus size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                   {t('matches.registrarPartida')}
                  </span>
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(match => (
              <div key={match.id} className="rd-card overflow-visible">
                <MatchCard
                  match={match}
                  champions={champions}
                  items={items}
                  onEdit={setEditing}
                  onDelete={(id) => setMatchToDelete(matches.find(match => match.id === id) || null)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
