import { useState } from 'react';
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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [search, setSearch] = useState('');
  const [laneFilter, setLaneFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const qc = useQueryClient();
  const { user } = useAuth();

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

  const latestTierlistPatch = tierlistExecutions.find(
    execution => execution.status === 'success' || execution.status === 'partial'
  )?.patch || '';

  const createMatchMutation = useMutation({
    mutationFn: (data) => createMatch(user, data),
    onSuccess: () => {
      setShowForm(false);
      qc.invalidateQueries(['matches']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteMatch(id),
    onSuccess: () => {
      setMatchToDelete(null);
      qc.invalidateQueries(['matches']);
    },
  });

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

      return matchSearch && matchLane && matchResult;
    })
    .sort((a, b) => {
      const dateA = `${a.date || ''}T${a.hour || '00:00'}`;
      const dateB = `${b.date || ''}T${b.hour || '00:00'}`;
      return dateB.localeCompare(dateA);
    });

  if (showForm && !editing) {
    return (
      <div className="w-full max-w-none mx-0 p-5 md:p-6 rd-dashboard">
        <MatchBuilder
          champions={champions}
          defaultPatch={latestTierlistPatch}
          onSave={(data) => createMatchMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="w-full max-w-none mx-0 p-5 md:p-6 rd-dashboard">
        <MatchForm
          match={editing}
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
    <div className="w-full max-w-none mx-0 p-5 md:p-6 space-y-6 rd-dashboard">

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-px bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">
              Registro de Partidas
            </span>
          </div>

          <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">
            Partidas
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            {matches.length} partidas registradas en tu historial competitivo.
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
                  Eliminar todas las partidas
                </p>
                <p className="text-xs text-muted-foreground">
                  Borrar historial completo
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
                Nueva Partida
              </p>
              <p className="text-xs text-muted-foreground">
                Registrar resultado
              </p>
            </div>
          </button>
        </div>

        {/* Modal de confirmación */}
        {confirmDeleteAll && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rd-card p-6 w-full max-w-sm mx-4 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-lg text-foreground">¿Eliminar todo?</p>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Se eliminarán <span className="text-foreground font-semibold">{matches.length} partidas</span> permanentemente. Para confirmar, escribí <span className="text-red-400 font-semibold">Eliminar Todas</span> abajo.
              </p>

              <input
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Eliminar Todas"
                className="w-full bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-red-500/50 transition-all"
              />

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setConfirmDeleteAll(false); setDeleteConfirmText(''); }}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteAllMutation.mutate()}
                  disabled={deleteConfirmText !== 'Eliminar Todas' || deleteAllMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteAllMutation.isPending ? 'Eliminando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {matchToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rd-card p-5 w-full max-w-xs mx-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-lg text-foreground">Eliminar partida</p>
                  <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer.</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                ¿Querés eliminar la partida de <span className="text-foreground font-semibold">{matchToDelete.own_champion_name || 'este campeón'}</span>?
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMatchToDelete(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(matchToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MatchMetric
            label="Partidas"
            value={filtered.length}
            sub="según filtros activos"
            icon={Swords}
            tone="primary"
          />

          <MatchMetric
            label="Winrate"
            value={wr !== null ? `${wr}%` : '—'}
            sub={wr !== null ? 'rendimiento filtrado' : 'sin muestra'}
            icon={Trophy}
            tone={wrTone}
          />

          <MatchMetric
            label="Record"
            value={`${wins}V / ${losses}D`}
            sub="victorias y derrotas"
            icon={Number(wr) >= 50 ? Shield : Skull}
            tone={Number(wr) >= 50 ? 'green' : 'red'}
          />
        </div>
      )}

      <div className="rd-card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por campeón..."
              className="w-full bg-secondary/70 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <select
            value={laneFilter}
            onChange={e => setLaneFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">Todas las líneas</option>
            <option value="top">Top</option>
            <option value="jungler">Jungler</option>
            <option value="mid">Mid</option>
            <option value="adc">ADC</option>
            <option value="support">Support</option>
          </select>

          <select
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            className="bg-secondary/70 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          >
            <option value="all">Todos los resultados</option>
            <option value="win">Victorias</option>
            <option value="loss">Derrotas</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="rd-card h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rd-card p-6">
          <EmptyState
            icon={Swords}
            title="Sin partidas registradas"
            description="Registrá tu primera partida para comenzar a trackear tu rendimiento."
            action={
              <button
                onClick={() => setShowForm(true)}
                className="rd-action-card group px-4 py-3 mt-3"
              >
                <Plus size={16} className="text-primary" />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                  Registrar Partida
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
  );
}
