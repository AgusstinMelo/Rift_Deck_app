import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTierlistConfig, runTierlistUpdate, saveTierlistConfig } from '@/api/tierlistSupabase';
import { Play, Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

const getLocalDateInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const DEFAULT_FORM = {
  winrate_weight: 0.47,
  pickrate_weight: 0.37,
  banrate_weight: 0.11,
  facilidad_weight: 0.05,
  active_patch: '',
  active_snapshot_date: getLocalDateInput(),
  active_data_source: 'https://lolm.qq.com/',
  active_region: 'China',
  active_elo: 'All elos',
  apply_elo_presence_penalty: true,
};

export default function TierlistConfig() {
  const qc = useQueryClient();

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: config = null } = useQuery({
    queryKey: ['tierlist-config'],
    queryFn: () => getTierlistConfig(),
  });

  const currentConfig = config || {};

  useEffect(() => {
    if (!currentConfig?.id) return;

    setForm({
      winrate_weight: currentConfig.winrate_weight ?? 0.50,
      pickrate_weight: currentConfig.pickrate_weight ?? 0.30,
      banrate_weight: currentConfig.banrate_weight ?? 0.15,
      facilidad_weight: currentConfig.facilidad_weight ?? 0.05,
      active_patch: currentConfig.active_patch || '',
      active_snapshot_date: currentConfig.active_snapshot_date || getLocalDateInput(),
      active_data_source: currentConfig.active_data_source || '',
      active_region: currentConfig.active_region || '',
      active_elo: currentConfig.active_elo || '',
      apply_elo_presence_penalty: currentConfig.apply_elo_presence_penalty ?? true,
    });
  }, [currentConfig?.id]);

  const set = (key, val) => {
    setForm(currentForm => ({
      ...currentForm,
      [key]: val,
    }));
  };

  const totalWeightNumber =
    Number(form.winrate_weight) +
    Number(form.pickrate_weight) +
    Number(form.banrate_weight) +
    Number(form.facilidad_weight);

  const totalWeight = totalWeightNumber.toFixed(2);
  const weightsOk = Math.abs(totalWeightNumber - 1.0) < 0.01;

  const saveMutation = useMutation({
    mutationFn: async (data) => saveTierlistConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tierlist-config'] });
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);
    },
  });

  const handleRun = async () => {
    if (!weightsOk) return;

    setRunning(true);
    setRunResult(null);

    try {
      const result = await runTierlistUpdate(form);

      setRunResult(result);
      qc.invalidateQueries({ queryKey: ['tierlist-full'] });
      qc.invalidateQueries({ queryKey: ['tierlist-all'] });
      qc.invalidateQueries({ queryKey: ['tierlist'] });
      qc.invalidateQueries({ queryKey: ['executions'] });
    } catch (error) {
      setRunResult({
        status: 'failed',
        error_message: error.message || 'Error desconocido al ejecutar la actualización.',
      });
    } finally {
      setRunning(false);
    }
  };

  const weightFields = [
    {
      key: 'winrate_weight',
      label: 'Peso Winrate',
      desc: 'Impacto del winrate dentro del ranking final',
    },
    {
      key: 'pickrate_weight',
      label: 'Peso Pickrate',
      desc: 'Impacto de la popularidad y consistencia del campeón',
    },
    {
      key: 'banrate_weight',
      label: 'Peso Banrate',
      desc: 'Impacto de la presión del campeón dentro del meta',
    },
    {
      key: 'facilidad_weight',
      label: 'Peso Facilidad',
      desc: 'Bonus para campeones más fáciles de ejecutar en ranked',
    },
  ];

  const sourceFields = [
    {
      key: 'active_patch',
      label: 'Parche Activo',
      placeholder: 'ej: 7.1h',
    },
    {
      key: 'active_snapshot_date',
      label: 'Fecha de la Tierlist',
      type: 'date',
      placeholder: '',
    },
    {
      key: 'active_data_source',
      label: 'Fuente de Datos',
      placeholder: 'ej: Tencent / mlol.qt.qq.com',
    },
    {
      key: 'active_region',
      label: 'Región',
      placeholder: 'ej: global',
    },
    {
      key: 'active_elo',
      label: 'Elo',
      placeholder: 'ej: Diamante+',
    },
  ];

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6">
      <PageHeader
        title="Configuración de Tierlist"
        subtitle="Gestionar pesos y fuentes de datos para el cálculo automático"
      />

      {/* Weights */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-rajdhani font-bold text-lg text-foreground mb-4">
          Pesos del Algoritmo
        </h2>

        <div className="space-y-4">
          {weightFields.map(({ key, label, desc }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1 gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {desc}
                  </p>
                </div>

                <span className="text-primary font-semibold font-rajdhani text-lg">
                  {Number(form[key]).toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={form[key]}
                onChange={e => set(key, parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>

        <div
          className={`
            mt-4 p-3 rounded-lg border
            ${weightsOk
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'}
          `}
        >
          <p
            className={`
              text-sm font-medium
              ${weightsOk ? 'text-green-400' : 'text-red-400'}
            `}
          >
            {weightsOk
              ? '✓ Los pesos WR + PR + BR + Facilidad suman 1.00'
              : `⚠ La suma de pesos debe ser 1.00 (actual: ${totalWeight})`}
          </p>
        </div>

        <div className="mt-4 rounded-lg bg-secondary/40 border border-border/60 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fórmula actual: ranking final = Winrate × {Number(form.winrate_weight).toFixed(2)}
            {' '}+ Pickrate × {Number(form.pickrate_weight).toFixed(2)}
            {' '}+ Banrate × {Number(form.banrate_weight).toFixed(2)}
            {' '}+ Facilidad × {Number(form.facilidad_weight).toFixed(2)}.
          </p>
        </div>
      </div>

      {/* Source Config */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-rajdhani font-bold text-lg text-foreground mb-4">
          Fuente de Datos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sourceFields.map(({ key, label, placeholder, type = 'text' }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1 uppercase tracking-wide">
                {label}
              </label>

              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Calculation options */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="font-rajdhani font-bold text-lg text-foreground mb-4">
          Opciones de Cálculo
        </h2>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-secondary/40 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Penalización por ausencia en elos
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Reduce el ranking de los campeones que no aparecen en todos los elos analizados, con mayor peso para los elos altos.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={form.apply_elo_presence_penalty}
            aria-label="Activar penalización por ausencia en elos"
            onClick={() => set('apply_elo_presence_penalty', !form.apply_elo_presence_penalty)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
              form.apply_elo_presence_penalty ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                form.apply_elo_presence_penalty ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-secondary border border-border text-foreground px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {saved ? (
            <CheckCircle size={16} className="text-green-400" />
          ) : (
            <Save size={16} />
          )}

          {saved ? '¡Guardado!' : 'Guardar Config'}
        </button>

        <button
          onClick={handleRun}
          disabled={running || !weightsOk}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Ejecutando...
            </>
          ) : (
            <>
              <Play size={16} />
              Ejecutar Actualización
            </>
          )}
        </button>
      </div>

      {/* Run Result */}
      {runResult && (
        <div
          className={`
            rounded-xl p-5 border
            ${runResult.status === 'success'
              ? 'bg-green-500/5 border-green-500/20'
              : runResult.status === 'pending_migration'
              ? 'bg-yellow-500/5 border-yellow-500/20'
              : 'bg-red-500/5 border-red-500/20'}
          `}
        >
          <div className="flex items-center gap-2 mb-3">
            {runResult.status === 'success' ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : runResult.status === 'pending_migration' ? (
              <AlertCircle size={18} className="text-yellow-400" />
            ) : (
              <AlertCircle size={18} className="text-red-400" />
            )}

            <h3
              className={`
                font-rajdhani font-bold text-lg
                ${runResult.status === 'success'
                  ? 'text-green-400'
                  : runResult.status === 'pending_migration'
                  ? 'text-yellow-400'
                  : 'text-red-400'}
              `}
            >
              {runResult.status === 'success'
                ? 'Tierlist Actualizada Correctamente'
                : runResult.status === 'pending_migration'
                ? 'Actualización Pendiente de Migración'
                : 'Error en la Actualización'}
            </h3>
          </div>

          {runResult.champions_processed != null && (
            <p className="text-sm text-foreground mb-1">
              {runResult.champions_processed} campeones procesados
            </p>
          )}

          {runResult.patch && (
            <p className="text-sm text-muted-foreground mb-1">
              Parche procesado: {runResult.patch}
            </p>
          )}

          {runResult.snapshot_date && (
            <p className="text-sm text-muted-foreground mb-1">
              Fecha de la tierlist: {new Date(`${runResult.snapshot_date}T00:00:00`).toLocaleDateString('es-ES')}
            </p>
          )}

          {runResult.error_message && (
            <p className="text-sm text-red-400">
              {runResult.error_message}
            </p>
          )}

          {runResult.message && (
            <p className="text-sm text-muted-foreground">
              {runResult.message}
            </p>
          )}

          {runResult.logs && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Ver logs detallados
              </summary>

              <pre className="text-xs text-muted-foreground mt-2 bg-secondary/50 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                {runResult.logs}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
