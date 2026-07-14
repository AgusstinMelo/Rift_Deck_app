import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Champion } from '@/api/entitiesSupabase';
import { getTierlistEntries, getTierlistExecutions } from '@/api/tierlistSupabase';
import ChampionDetail from '@/components/library/ChampionDetail';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import { findChampionBySlug } from '@/utils/championSlug';
import {
  DAMAGE_LABELS,
  displayList,
  getChampionLaneLabels,
  getChampionLanes,
} from '@/utils/championPresentation';
import { getChampionSeo } from '@/seo/publicSeo';
import { getCurrentTierlistEntries, getTierEntriesForChampion } from '@/utils/tierlist';

export default function PublicChampionDetail({ initialChampions, initialExecutions, initialTierlist }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: champions, isLoading, isError } = useQuery({
    queryKey: ['public-champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    staleTime: 5 * 60 * 1000,
  });
  const champion = findChampionBySlug(champions, slug);
  const { data: executions = [] } = useQuery({
    queryKey: ['executions'],
    queryFn: () => getTierlistExecutions(10),
    initialData: initialExecutions,
    staleTime: 5 * 60 * 1000,
  });
  const currentSnapshotKey = executions.find(execution =>
    execution.status === 'success' || execution.status === 'partial'
  )?.snapshot_key;
  const { data: tierlist = [] } = useQuery({
    queryKey: ['tierlist', currentSnapshotKey],
    queryFn: () => getTierlistEntries('-updated_at', 1000, { snapshotKey: currentSnapshotKey }),
    initialData: initialTierlist,
    enabled: Boolean(currentSnapshotKey),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-background"><Seo title="Campeón de Wild Rift | Rift Deck" canonicalPath={`/campeones/${slug}`} indexable={false} /><PublicHeader /><main className="mx-auto max-w-6xl px-5 py-12"><div className="h-80 animate-pulse rounded-2xl border border-border bg-card" /></main></div>;
  }

  if (isError || !champion) {
    return <div className="min-h-screen bg-background text-foreground"><Seo title="Campeón no encontrado | Rift Deck" description="La página de campeón solicitada no existe en Rift Deck." canonicalPath={`/campeones/${slug}`} indexable={false} /><PublicHeader /><main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center"><p className="text-sm font-semibold text-primary">404</p><h1 className="mt-2 font-rajdhani text-4xl font-bold">Campeón no encontrado</h1><p className="mt-3 text-muted-foreground">No existe un campeón asociado a esta URL.</p><Link to="/campeones" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver campeones</Link></main></div>;
  }

  const currentTierlist = getCurrentTierlistEntries(tierlist, executions);
  const tierData = getTierEntriesForChampion(champion, currentTierlist);
  const lanes = getChampionLanes(champion);
  const relatedChampions = (champions || [])
    .filter(candidate => candidate.id !== champion.id)
    .map(candidate => {
      const sharedLane = getChampionLanes(candidate).some(lane => lanes.includes(lane));
      const sharedRole = Boolean(champion.roles && candidate.roles === champion.roles);
      return { candidate, score: Number(sharedLane) + Number(sharedRole) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, 6)
    .map(({ candidate }) => candidate);
  const seo = getChampionSeo(champion, slug, getChampionLaneLabels(champion), displayList, DAMAGE_LABELS);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo {...seo} indexable />
      <PublicHeader />
      <main className="mx-auto w-full max-w-none px-5 py-8 md:px-6 md:py-12">
        <ChampionDetail
          champion={champion}
          champions={champions}
          tierData={tierData}
          relatedChampions={relatedChampions}
          publicMode
          onBack={() => navigate('/campeones')}
        />
      </main>
    </div>
  );
}
