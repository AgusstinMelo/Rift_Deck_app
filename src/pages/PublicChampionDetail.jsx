import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Champion } from '@/api/entitiesSupabase';
import ChampionLibrary from '@/components/library/ChampionLibrary';
import PublicLibraryLayout from '@/components/public/PublicLibraryLayout';
import Seo from '@/components/Seo';
import { findChampionBySlug } from '@/utils/championSlug';
import {
  DAMAGE_LABELS,
  displayList,
  getChampionLaneLabels,
} from '@/utils/championPresentation';
import { getChampionSeo } from '@/seo/publicSeo';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';

export default function PublicChampionDetail({ initialChampions, initialTierlist }) {
  const { slug } = useParams();
  const { data: champions, isLoading, isError } = useQuery({
    queryKey: ['public-champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    ...publicCatalogQueryOptions,
  });
  const champion = findChampionBySlug(champions, slug);

  if (isLoading) {
    return (
      <PublicLibraryLayout activeTab="champions" isDetail>
        <Seo title="Campeón de Wild Rift | Rift Deck" canonicalPath={`/campeones/${slug}`} indexable={false} />
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
      </PublicLibraryLayout>
    );
  }

  if (isError || !champion) {
    return (
      <PublicLibraryLayout activeTab="champions" isDetail>
        <Seo title="Campeón no encontrado | Rift Deck" description="La página de campeón solicitada no existe en Rift Deck." canonicalPath={`/campeones/${slug}`} indexable={false} />
        <div className="rd-card flex flex-col items-center px-5 py-16 text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h2 className="mt-2 font-rajdhani text-4xl font-bold">Campeón no encontrado</h2>
          <p className="mt-3 text-muted-foreground">No existe un campeón asociado a esta URL.</p>
          <Link to="/campeones" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver campeones</Link>
        </div>
      </PublicLibraryLayout>
    );
  }

  const seo = getChampionSeo(champion, slug, getChampionLaneLabels(champion), displayList, DAMAGE_LABELS);

  return (
    <PublicLibraryLayout activeTab="champions" isDetail srTitle={`${champion.name} en Wild Rift`}>
      <Seo {...seo} indexable />
      <ChampionLibrary
        key={slug}
        selectedSlug={slug}
        initialChampions={champions}
        initialTierlist={initialTierlist}
        publicBasePath="/campeones"
      />
    </PublicLibraryLayout>
  );
}
