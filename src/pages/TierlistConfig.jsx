import { useQuery } from '@tanstack/react-query';
import { getRecentTierlistRuns, getTierlistConfig, getTierlistPatchGroups } from '@/api/tierlistSupabase';
import {
  AlertCircle, CheckCircle, Clock, CalendarClock, Database, Globe2, Layers,
  Scale, ShieldAlert, TrendingDown,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import TierBadge from '@/components/ui/TierBadge';
import { useT } from '@/lib/LocaleContext';
import { formatLocale, tr } from '@/i18n/uiI18n';

const formatDate = (value) => (
  value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(formatLocale()) : '—'
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
  { key: 'winrate_weight', get label() { return tr('tierlist.weights.winrate'); }, get desc() { return tr('tierlist.weights.winrateDesc'); }, tone: 'bg-primary' },
  { key: 'pickrate_weight', get label() { return tr('tierlist.weights.pickrate'); }, get desc() { return tr('tierlist.weights.pickrateDesc'); }, tone: 'bg-primary/70' },
  { key: 'banrate_weight', get label() { return tr('tierlist.weights.banrate'); }, get desc() { return tr('tierlist.weights.banrateDesc'); }, tone: 'bg-primary/45' },
  { key: 'facilidad_weight', get label() { return tr('tierlist.weights.facilidad'); }, get desc() { return tr('tierlist.weights.facilidadDesc'); }, tone: 'bg-primary/25' },
];

const SOURCE_FIELDS = [
  { key: 'active_data_source', get label() { return tr('tierlist.sources.source'); }, icon: Database },
  { key: 'active_region', get label() { return tr('tierlist.sources.region'); }, icon: Globe2 },
  { key: 'active_elo', get label() { return tr('tierlist.sources.elo'); }, icon: Layers },
];

const isSuccessfulRun = run => run.status === 'success' || run.status === 'partial';

export default function TierlistConfig() {
  const t = useT();
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
          title={t('tierlist.comoCalculamosLaTierlist')}
          subtitle={t('tierlist.losPesosLasFuentes')}
        />

        <div className="rd-tierlist-method-grid grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Columna izquierda: cómo se calcula el score del día */}
          <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
            <section className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">{t('tierlist.paso1ScoreDel')}</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">{t('tierlist.pesosDelAlgoritmo')}</h2>
              <p className="text-xs leading-relaxed text-muted-foreground mt-1">
                {t('tierlist.cadaMetricaPasaA')}
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
                {t('tierlist.scoreWinrate')} {Number(values.winrate_weight).toFixed(2)}
                {' '}{t('tierlist.pickrate')} {Number(values.pickrate_weight).toFixed(2)}
                {' '}{t('tierlist.banrate')} {Number(values.banrate_weight).toFixed(2)}
                {' '}{t('tierlist.facilidad')} {Number(values.facilidad_weight).toFixed(2)}
              </p>
            </section>

            <section className="bg-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">{t('tierlist.paso3Tiers')}</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">{t('tierlist.delScoreAlTier')}</h2>
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
              <h2 className="font-rajdhani font-bold text-lg text-foreground">{t('tierlist.fuenteDeDatos')}</h2>
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
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary/80">{t('tierlist.paso2Ajustes')}</p>
              <h2 className="font-rajdhani font-bold text-lg text-foreground mt-0.5">{t('tierlist.penalizacionesYPromedio')}</h2>

              <ul className="mt-3 space-y-2.5">
                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-medium text-foreground">{t('tierlist.ausenciaEnElos')}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        penaltyActive
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-secondary text-muted-foreground border border-border/60'
                      }`}>
                        {!penaltyStartsOn
                          ? t('tierlist.sinFecha2')
                          : penaltyActive
                            ? t('tierlist.activaDesdeEl', { formatDate: formatDate(penaltyStartsOn) })
                            : t('tierlist.desdeEl', { formatDate: formatDate(penaltyStartsOn) })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t('tierlist.bajaElScoreDe')} {ELO_PENALTY_GRACE_DAYS / 7} {t('tierlist.semanasDespuesDeUn')}
                    </p>
                  </div>
                </li>

                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <Scale size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t('tierlist.promedioPonderadoPorParche')}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t('tierlist.laTierlistPromediadaJunta')} {AVERAGE_HALF_LIFE_DAYS} {t('tierlist.diasValeLaMitad')}
                    </p>
                  </div>
                </li>

                <li className="flex gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3.5 py-3">
                  <TrendingDown size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t('tierlist.diasAusentes')}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t('tierlist.siUnCampeonFalta')}
                    </p>
                  </div>
                </li>
              </ul>
            </section>

            <section className="rd-tierlist-method-runs bg-card border border-border rounded-xl p-4 flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-rajdhani font-bold text-lg text-foreground">{t('tierlist.actualizacionAutomatica')}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock size={13} className="text-primary" />
                    {t('tierlist.todosLosDiasA')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('tierlist.parcheEnCurso')}</p>
                  <p className="text-sm font-medium text-foreground">
                    {currentGroup
                      ? `${currentGroup.patch_group} · ${currentGroup.snapshots_count} ${currentGroup.snapshots_count === 1 ? t('tierlist.dia') : t('tierlist.dias')}`
                      : '—'}
                  </p>
                </div>
              </div>

              <p className="mt-4 mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">{t('tierlist.ultimasEjecuciones')}</p>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('tierlist.todaviaNoHayEjecuciones')}</p>
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
                            {formatDate(run.snapshot_date)} {t('tierlist.parche3')} {run.patch}
                          </p>
                          {run.champions_processed != null && (
                            <span className="shrink-0 text-xs text-muted-foreground">{run.champions_processed} {t('tierlist.entradas')}</span>
                          )}
                        </div>
                        {run.weights_used?.apply_elo_presence_penalty != null && (
                          <p className="text-xs text-muted-foreground">
                            {t('tierlist.penalizacionPorElos')} {run.weights_used.apply_elo_presence_penalty ? 'activa' : 'desactivada'}
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
