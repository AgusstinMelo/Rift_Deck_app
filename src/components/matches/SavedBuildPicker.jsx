import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers3 } from 'lucide-react';
import { getBuildsForChampion } from '@/api/buildsSupabase';
import { useAuth } from '@/lib/AuthContext';

export default function SavedBuildPicker({ champion, onApply }) {
  const { user } = useAuth();
  const [selectedBuildId, setSelectedBuildId] = useState('');

  const { data: builds = [], isLoading } = useQuery({
    queryKey: ['match-saved-builds', user?.id, champion?.id, champion?.name],
    queryFn: () => getBuildsForChampion(user, champion, 1000),
    enabled: Boolean(user && champion),
  });

  if (!champion) return null;

  const handleApply = () => {
    const build = builds.find(candidate => String(candidate.id) === selectedBuildId);
    if (build) onApply(build);
  };

  return (
    <div className="rd-card border-primary/20 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Layers3 size={17} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Usar una build guardada</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Precarga objetos, runas y hechizos. Después podés modificar cualquier selección.
          </p>
        </div>
      </div>

      {builds.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedBuildId}
            onChange={event => setSelectedBuildId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
          >
            <option value="">Seleccionar build de {champion.name}</option>
            {builds.map(build => (
              <option key={build.id} value={String(build.id)}>
                {build.name}{build.lane ? ` · ${build.lane}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selectedBuildId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar build
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Buscando builds guardadas...' : `No tenés builds guardadas para ${champion.name}.`}
        </p>
      )}
    </div>
  );
}
