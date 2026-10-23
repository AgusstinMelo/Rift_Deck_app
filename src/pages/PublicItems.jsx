import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WRItem } from '@/api/entitiesSupabase';
import ItemLibrary from '@/components/library/ItemLibrary';
import PublicLibraryLayout from '@/components/public/PublicLibraryLayout';
import Seo from '@/components/Seo';
import { findEntityBySlug } from '@/utils/entitySlug';
import { ITEMS_SEO, getItemSeo } from '@/seo/publicSeo';
import { publicCatalogQueryOptions } from '@/lib/publicCatalogQuery';

export default function PublicItems({ initialItems, initialChampions }) {
  const { slug } = useParams();
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['writems'], queryFn: () => WRItem.list('type'), initialData: initialItems,
    ...publicCatalogQueryOptions,
  });
  const item = slug ? findEntityBySlug(items, slug) : null;
  const notFound = Boolean(slug && !isLoading && (isError || !item));
  const seo = item ? getItemSeo(item, slug) : ITEMS_SEO;

  if (notFound) {
    return (
      <PublicLibraryLayout activeTab="items" isDetail>
        <Seo title="Objeto no encontrado | Rift Deck" canonicalPath="/objetos" indexable={false} />
        <div className="rd-card flex flex-col items-center px-5 py-16 text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h2 className="mt-2 font-rajdhani text-4xl font-bold">Objeto no encontrado</h2>
          <p className="mt-3 text-muted-foreground">No existe un objeto asociado a esta URL.</p>
          <Link to="/objetos" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver objetos</Link>
        </div>
      </PublicLibraryLayout>
    );
  }

  return (
    <PublicLibraryLayout
      activeTab="items"
      isDetail={Boolean(slug)}
      srTitle={item ? `${item.name} en Wild Rift` : 'objetos de Wild Rift'}
    >
      <Seo {...seo} indexable />
      <ItemLibrary
        key={slug || 'catalog'}
        initialItems={items}
        initialChampions={initialChampions}
        selectedSlug={slug}
        publicBasePath="/objetos"
      />
    </PublicLibraryLayout>
  );
}
