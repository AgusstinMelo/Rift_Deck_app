import { useQuery } from '@tanstack/react-query';
import { getRecentTierlistRuns, getTierlistConfig, getTierlistPatchGroups } from '@/api/tierlistSupabase';
import {
  AlertCircle, CheckCircle, Clock, CalendarClock, Database, Globe2, Layers,
  Scale, ShieldAlert, TrendingDown,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TierBadge from '@/components/ui/TierBadge';

const formatDate = (value) => (
  value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('es-ES') : '—'
);

const getLocalDateInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const DEFAULT_CONFIG = {
  // Mismos pesos por defecto que DEFAULT_WEIGHTS en la Edge Function update-tierlist.
  winrate_weight: 0.50,
  pickrate_weight: 0.37,
  banrate_weight: 0.08,
  facilidad_weight: 0.05,
  active_data_source: 'https://lolm.qq.com/',
  active_region: 'China',
  active_elo: 'All elos',
};

// Mismos valores que usa la Edge Function update-tierlist.
const AVERAGE_HALF_LIFE_DAYS = 3;
const ELO_PENALTY_GRACE_DAYS = 21;
const TIER_THRESHOLDS = [
  { tier: 'S+', range: '≥ 85' },
  { tier: 'S', range: '70 – 85' },
  { tier: 'A', range: '45 – 70' },
  { tier: 'B', range: '20 – 45' },
  { tier: 'C', range: '< 20' },
];

const WEIGHT_FIELDS = [
  { key: 'winrate_weight', label: 'Winrate', desc: 'Cuánto gana', tone: 'bg-primary' },
  { key: 'pickrate_weight', label: 'Pickrate', desc: 'Popularidad', tone: 'bg-primary/70' },
  { key: 'banrate_weight', label: 'Banrate', desc: 'Presión en el meta', tone: 'bg-primary/45' },
  { key: 'facilidad_weight', label: 'Facilidad', desc: 'Bonus si es fácil', tone: 'bg-primary/25' },
];

const SOURCE_FIELDS = [
  { key: 'active_data_source', label: 'Fuente', icon: Database },
  { key: 'active_region', label: 'Región', icon: Globe2 },
  { key: 'active_elo', label: 'Elo', icon: Layers },
];

const isSuccessfulRun = run => run.status === 'success' || run.status === 'partial';

export default function TierlistConfig() {
  const { data: config = null } = useQuery({
    queryKey: ['tierlist-config'],
    queryFn: () => getTierlistConfig(),
  });

  const { data: patchGroups = [] } = useQuery({
    queryKey: ['tierlist-patch-groups', 'config'],
    queryFn: () => getTierlistPatchGroups(1),
  });

  const { data: recentRuns = [] } = useQuery({
    queryKey: ['tierlist-recent-runs'],
    queryFn: () => getRecentTierlistRuns(10),
  });

  const currentGroup = patchGroups[0] || null;
  const penaltyStartsOn = currentGroup?.elo_penalty_starts_on || null;
  const penaltyActive = Boolean(penaltyStartsOn) && getLocalDateInput() >= penaltyStartsOn;

  // Página de solo lectura: muestra la configuración guardada (o la de por defecto).
  const values = Object.fromEntries(
    Object.entries(DEFAULT_CONFIG).map(([key, fallback]) => [key, config?.[key] ?? fallback])
  );

  return (
    <div className="rd-page">
      <div className="rd-tierlist-method">
        <PageHeader
          title="Cómo calculamos la Tierlist"
          subtitle="Los pesos, las fuentes y las reglas que usamos para armar la tierlist del día y el promedio por parche."
        />

        <div className="rd-tierlist-method-grid grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Columna izquierda: cómo se calcula el score del día */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
            <section className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Paso 1 · Score del día</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">Pesos del algoritmo</h2>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">
                Cada métrica pasa a percentil (0–100) dentro de su línea, con más peso en los elos altos, y se combina con estos pesos:
              </p>

              {/* Composición del score: cada segmento es el peso de una métrica */}
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                {WEIGHT_FIELDS.map(({ key, tone }) => (
                  <span key={key} className={`${tone} h-full`} style={{ width: `${Number(values[key]) * 100}%` }} />
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
                {WEIGHT_FIELDS.map(({ key, label, desc, tone }) => (
                  <div key={key} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className={`h-2.5 w-2.5 rounded-sm ${tone}`} aria-hidden="true" />
                        {label}
                      </span>
                      <span className="font-rajdhani text-lg font-semibold leading-none text-primary">
                        {Math.round(Number(values[key]) * 100)}%
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>

              <p className="mt-2.5 rounded-lg bg-secondary/40 border border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
                Score = Winrate × {Number(values.winrate_weight).toFixed(2)}
                {' '}+ Pickrate × {Number(values.pickrate_weight).toFixed(2)}
                {' '}+ Banrate × {Number(values.banrate_weight).toFixed(2)}
                {' '}+ Facilidad × {Number(values.facilidad_weight).toFixed(2)}
              </p>
            </section>

            <section className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Paso 3 · Tiers</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">Del score al tier</h2>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {TIER_THRESHOLDS.map(({ tier, range }) => (
                  <div key={tier} className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-secondary/30 py-2">
                    <TierBadge tier={tier} size="sm" />
                    <span className="text-xs text-muted-foreground">{range}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-rajdhani font-bold text-lg text-foreground">Fuente de datos</h2>
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {SOURCE_FIELDS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-2.5 min-w-0">
                    <Icon size={16} className="shrink-0 text-primary" />
                    <div className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="truncate text-sm font-medium text-foreground" title={values[key] || undefined}>
                        {values[key] || '—'}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Columna derecha: ajustes, promedio y actualización automática */}
          <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
            <section className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Paso 2 · Ajustes</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">Penalizaciones y promedio</h2>

              <ul className="mt-3 space-y-2.5">
                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-foreground">Ausencia en elos</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        penaltyActive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-secondary text-muted-foreground border border-border/60'
                      }`}>
                        {!penaltyStartsOn
                          ? 'Sin fecha'
                          : penaltyActive
                            ? `Activa desde el ${formatDate(penaltyStartsOn)}`
                            : `Desde el ${formatDate(penaltyStartsOn)}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Baja el score de los campeones que no aparecen en todos los elos. Se activa {ELO_PENALTY_GRACE_DAYS / 7} semanas
                      después de un parche de número nuevo (las letras no la reinician).
                    </p>
                  </div>
                </li>

                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <Scale size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Promedio ponderado por parche</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      La tierlist promediada junta todos los días del parche (7.3, 7.3a, 7.3b… cuentan como 7.3).
                      Un día de hace {AVERAGE_HALF_LIFE_DAYS} días vale la mitad que el de hoy.
                    </p>
                  </div>
                </li>

                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <TrendingDown size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Días ausentes</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Si un campeón falta algunos días del parche en su línea, su promedio baja (más si faltó hace poco).
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            <section className="rd-tierlist-method-runs bg-card border border-border rounded-xl p-4 flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-rajdhani font-bold text-lg text-foreground">Actualización automática</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock size={13} className="text-primary" />
                    Todos los días a las 06:00 (hora de España)
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parche en curso</p>
                  <p className="text-sm font-medium text-foreground">
                    {currentGroup
                      ? `${currentGroup.patch_group} · ${currentGroup.snapshots_count} ${currentGroup.snapshots_count === 1 ? 'día' : 'días'}`
                      : '—'}
                  </p>
                </div>
              </div>

              <p className="mt-4 mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Últimas ejecuciones</p>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay ejecuciones registradas.</p>
              ) : (
                <ul className="rd-tierlist-method-runlist -mx-1 space-y-0.5 overflow-y-auto px-1">
                  {recentRuns.map(run => (
                    <li key={run.id} className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/30">
                      {isSuccessfulRun(run) ? (
                        <CheckCircle size={15} className="mt-0.5 shrink-0 text-green-400" />
                      ) : run.status === 'running' ? (
                        <Clock size={15} className="mt-0.5 shrink-0 text-yellow-400" />
                      ) : (
                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-foreground">
                            {formatDate(run.snapshot_date)} · Parche {run.patch}
                          </p>
                          {run.champions_processed != null && (
                            <span className="shrink-0 text-xs text-muted-foreground">{run.champions_processed} entradas</span>
                          )}
                        </div>
                        {run.weights_used?.apply_elo_presence_penalty != null && (
                          <p className="text-xs text-muted-foreground">
                            Penalización por elos {run.weights_used.apply_elo_presence_penalty ? 'activa' : 'desactivada'}
                          </p>
                        )}
                        {run.error_message && (
                          <p className="text-xs text-red-400 break-words">{run.error_message}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
