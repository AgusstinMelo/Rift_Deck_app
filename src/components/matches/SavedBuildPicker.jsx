import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Layers3, X } from 'lucide-react';
import { getBuildsForChampion } from '@/api/buildsSupabase';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/lib/LocaleContext';

/**
 * Precarga una build guardada del campeón y vincula la partida a ella (para medir cómo
 * rinde cada build). Con `compact` se muestra en una sola línea.
 * @param {{
 *   champion: any, patch: string, onApply: (build: any) => void, compact?: boolean,
 *   linkedBuildId?: string | number | null, onUnlink?: () => void,
 * }} props
 */
export default function SavedBuildPicker({ champion, patch, onApply, compact = false, linkedBuildId = null, onUnlink }) {
  const t = useT();
  const { user } = useAuth();
  const linkedValue = linkedBuildId != null ? String(linkedBuildId) : '';
  const [selectedBuildId, setSelectedBuildId] = useState(linkedValue);

  // Al vincular o desvincular desde afuera (otra build, cambio de parche), el selector lo sigue.
  useEffect(() => {
    setSelectedBuildId(linkedValue);
  }, [linkedValue]);

  const { data: builds = [], isLoading } = useQuery({
    queryKey: ['match-saved-builds', user?.id, champion?.id, champion?.name, patch],
    queryFn: () => getBuildsForChampion(user, champion, 1000),
    enabled: Boolean(user && champion),
  });
  // Las del parche de la partida, más la vinculada aunque sea de otro parche.
  const compatibleBuilds = builds.filter(build => !patch || build.patch === patch || String(build.id) === linkedValue);

  if (!champion) return null;

  const isLinked = Boolean(linkedValue) && selectedBuildId === linkedValue;

  const handleApply = () => {
    const build = builds.find(candidate => String(candidate.id) === selectedBuildId);
    if (build) onApply(build);
  };

  const picker = compatibleBuilds.length > 0 ? (
    <div className={`flex gap-2 ${compact ? 'min-w-0 flex-1' : 'flex-col sm:flex-row'}`}>
      <select
        value={selectedBuildId}
        onChange={event => setSelectedBuildId(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
      >
        <option value="">{t('matches.seleccionarBuildDe')} {champion.name}</option>
        {compatibleBuilds.map(build => (
          <option key={build.id} value={String(build.id)}>
            {build.name}{build.lane ? ` · ${build.lane}` : ''}
          </option>
        ))}
      </select>
      {isLinked ? (
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            title={t('matches.buildVinculadaAyuda')}
          >
            <Check size={14} /> {t('matches.buildVinculada')}
          </span>
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              title={t('matches.desvincularBuild')}
              aria-label={t('matches.desvincularBuild')}
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleApply}
          disabled={!selectedBuildId}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('matches.aplicarBuild')}
        </button>
      )}
    </div>
  ) : (
    <p className={`text-xs text-muted-foreground ${compact ? 'min-w-0 flex-1 truncate' : ''}`}>
      {isLoading ? t('matches.buscandoBuildsGuardadas') : t('matches.noTenesBuildsGuardadas', { name: champion.name })}
    </p>
  );

  if (compact) {
    return (
      <div className="rd-card flex items-center gap-3 border-primary/20 px-3 py-2.5" title={t('matches.precargaObjetosRunasY')}>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Layers3 size={16} />
        </div>
        <span className="hidden shrink-0 text-sm font-semibold text-foreground 2xl:inline">{t('matches.buildGuardada')}</span>
        {picker}
      </div>
    );
  }

  return (
    <div className="rd-card border-primary/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Layers3 size={17} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('matches.usarUnaBuildGuardada')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
           {t('matches.precargaObjetosRunasY')}
          </p>
        </div>
      </div>

      {picker}
    </div>
  );
}
