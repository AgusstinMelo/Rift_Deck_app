import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getBuildsForChampion, deleteBuild } from '@/api/buildsSupabase';
import { Plus, Trash2, Wrench, ChevronRight, GitCompare, ArrowLeft } from 'lucide-react';
import LaneBadge from '@/components/ui/LaneBadge';

export default function ChampionBuilds({ champion, onNewBuild, onEditBuild, onBack, onCompare }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: allBuilds = [], isLoading } = useQuery({
    queryKey: ['builds', champion.id, champion.name, user?.email],
    queryFn: () => user?.email
      ? getBuildsForChampion(user, champion, 1000)
      : [],
    enabled: !!user?.email,
  });

  const builds = allBuilds.filter(b =>
    b.champion_id === champion.id ||
    b.champion_name?.toLowerCase() === champion.name?.toLowerCase()
  );

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteBuild(id),
    onSuccess: () => qc.invalidateQueries(['builds', champion.id]),
  });

  return (
    <div className="w-full max-w-none mx-0 p-5 md:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors mb-5">
        <ArrowLeft size={15} /> Cambiar campeón
      </button>

      <div className="rd-card p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_18px_rgba(212,175,55,.10)] shrink-0">
            {champion.image_url
              ? <img src={champion.image_url} alt={champion.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-bold text-xl text-primary bg-secondary">{champion.name[0]}</div>}
          </div>
          <div className="flex-1">
            <h1 className="font-rajdhani font-bold text-4xl md:text-5xl text-foreground tracking-[-0.08em] uppercase">{champion.name}</h1>
            <p className="text-muted-foreground text-sm">Builds guardadas</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={onCompare}
              className="flex items-center justify-center gap-2 bg-secondary/70 border border-border text-foreground px-4 py-2 rounded-xl font-medium text-sm hover:border-primary/40 transition-all w-full sm:w-auto"
            >
              <GitCompare size={16} /> Comparar
            </button>

            <button
              onClick={onNewBuild}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors w-full sm:w-auto"
            >
              <Plus size={16} /> Nueva Build
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="rd-card h-20 animate-pulse" />
          ))}
        </div>
      ) : builds.length === 0 ? (
        <div className="rd-card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Wrench size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-rajdhani font-bold text-lg text-foreground mb-1">Sin builds guardadas</h3>
          <p className="text-muted-foreground text-sm mb-4">No hay builds para {champion.name} todavía.</p>
          <button onClick={onNewBuild} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Crear primera build
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {builds.map(build => (
            <div key={build.id} onClick={() => onEditBuild(build)}
              className="rd-card p-4 flex items-center gap-4 hover:border-primary/30 cursor-pointer group transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{build.name}</p>
                  {build.lane && <LaneBadge lane={build.lane} />}
                  {build.patch && <span className="text-xs text-muted-foreground bg-secondary/60 border border-border/50 px-2 py-0.5 rounded-md">Parche {build.patch}</span>}
                </div>
                {build.items?.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">{build.items.join(' · ')}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(build.id); }}
                  className="w-8 h-8 rounded-lg bg-secondary/50 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-all">
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
