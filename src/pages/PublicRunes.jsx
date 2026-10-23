import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Rune } from '@/api/entitiesSupabase';
import RuneLibrary from '@/components/library/RuneLibrary';
import PublicLibraryLayout from '@/components/public/PublicLibraryLayout';
import Seo from '@/components/Seo';
import { findEntityBySlug } from '@/utils/entitySlug';
import { RUNES_SEO, getRuneSeo } from '@/seo/publicSeo';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';

export default function PublicRunes({ initialRunes }) {
  const { slug } = useParams();
  const { data: runes, isLoading, isError } = useQuery({ queryKey: ['runes'], queryFn: () => Rune.list('branch'), initialData: initialRunes, ...publicCatalogQueryOptions });
  const rune = slug ? findEntityBySlug(runes, slug) : null;

  if (slug && !isLoading && (isError || !rune)) {
    return (
      <PublicLibraryLayout activeTab="runes" isDetail>
        <Seo title="Runa no encontrada | Rift Deck" canonicalPath="/runas" indexable={false} />
        <div className="rd-card flex flex-col items-center px-5 py-16 text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h2 className="mt-2 font-rajdhani text-4xl font-bold">Runa no encontrada</h2>
          <p className="mt-3 text-muted-foreground">No existe una runa asociada a esta URL.</p>
          <Link to="/runas" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver runas</Link>
        </div>
      </PublicLibraryLayout>
    );
  }

  return (
    <PublicLibraryLayout
      activeTab="runes"
      isDetail={Boolean(slug)}
      srTitle={rune ? `${rune.name} en Wild Rift` : 'runas de Wild Rift'}
    >
      <Seo {...(rune ? getRuneSeo(rune, slug) : RUNES_SEO)} indexable />
      <RuneLibrary key={slug || 'catalog'} initialRunes={runes} selectedSlug={slug} publicBasePath="/runas" />
    </PublicLibraryLayout>
  );
}
