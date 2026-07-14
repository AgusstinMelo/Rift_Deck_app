import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Rune } from '@/api/entitiesSupabase';
import RuneLibrary from '@/components/library/RuneLibrary';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import { findEntityBySlug } from '@/utils/entitySlug';
import { RUNES_SEO, getRuneSeo } from '@/seo/publicSeo';

export default function PublicRunes({ initialRunes }) {
  const { slug } = useParams();
  const { data: runes, isLoading, isError } = useQuery({ queryKey: ['runes'], queryFn: () => Rune.list('branch'), initialData: initialRunes, staleTime: 5 * 60 * 1000 });
  const rune = slug ? findEntityBySlug(runes, slug) : null;
  if (slug && !isLoading && (isError || !rune)) return <div className="min-h-screen bg-background text-foreground"><Seo title="Runa no encontrada | Rift Deck" canonicalPath="/runas" indexable={false} /><PublicHeader /><main className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="text-sm font-semibold text-primary">404</p><h1 className="mt-2 font-rajdhani text-4xl font-bold">Runa no encontrada</h1><p className="mt-3 text-muted-foreground">No existe una runa asociada a esta URL.</p><Link to="/runas" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ArrowLeft size={16} /> Ver runas</Link></main></div>;
  return <div className="min-h-screen bg-background text-foreground"><Seo {...(rune ? getRuneSeo(rune, slug) : RUNES_SEO)} indexable /><PublicHeader /><main className="mx-auto w-full max-w-[1800px] px-5 py-8 md:py-12">{!slug && <><h1 className="font-rajdhani text-4xl font-bold uppercase tracking-[-0.08em] md:text-5xl">Runas de Wild Rift</h1><p className="mb-6 mt-1 text-sm text-muted-foreground">Ramas, efectos y características de las runas disponibles.</p></>}<RuneLibrary initialRunes={runes} selectedSlug={slug} publicBasePath="/runas" /></main></div>;
}
