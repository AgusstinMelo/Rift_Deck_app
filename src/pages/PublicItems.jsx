import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WRItem } from '@/api/entitiesSupabase';
import ItemLibrary from '@/components/library/ItemLibrary';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import { findEntityBySlug } from '@/utils/entitySlug';
import { ITEMS_SEO, getItemSeo } from '@/seo/publicSeo';

export default function PublicItems({ initialItems, initialChampions }) {
  const { slug } = useParams();
  const { data: items, isLoading, isError } = useQuery({
    queryKey: ['writems'], queryFn: () => WRItem.list('type'), initialData: initialItems,
    staleTime: 5 * 60 * 1000,
  });
  const item = slug ? findEntityBySlug(items, slug) : null;
  const notFound = Boolean(slug && !isLoading && (isError || !item));
  const seo = item ? getItemSeo(item, slug) : ITEMS_SEO;

  if (notFound) return <NotFound type="objeto" basePath="/objetos" />;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo {...seo} indexable />
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1800px] px-5 py-8 md:py-12">
        {!slug && <><h1 className="font-rajdhani text-4xl font-bold uppercase tracking-[-0.08em] md:text-5xl">Objetos de Wild Rift</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Estadísticas, efectos y precios de los objetos disponibles.</p></>}
        <ItemLibrary initialItems={items} initialChampions={initialChampions} selectedSlug={slug} publicBasePath="/objetos" />
      </main>
    </div>
  );
}

function NotFound({ type, basePath }) {
  return <div className="min-h-screen bg-background text-foreground"><Seo title="Objeto no encontrado | Rift Deck" canonicalPath={basePath} indexable={false} /><PublicHeader /><main className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="text-sm font-semibold text-primary">404</p><h1 className="mt-2 font-rajdhani text-4xl font-bold">Objeto no encontrado</h1><p className="mt-3 text-muted-foreground">No existe un {type} asociado a esta URL.</p><Link to={basePath} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver objetos</Link></main></div>;
}
