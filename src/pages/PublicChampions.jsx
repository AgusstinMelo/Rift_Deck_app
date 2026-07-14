import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Champion } from '@/api/entitiesSupabase';
import PublicHeader from '@/components/public/PublicHeader';
import Seo from '@/components/Seo';
import { championSlug } from '@/utils/championSlug';
import { getChampionLaneLabels } from '@/utils/championPresentation';
import { CHAMPIONS_SEO } from '@/seo/publicSeo';

export default function PublicChampions({ initialChampions }) {
  const { data: champions = [], isLoading, isError } = useQuery({
    queryKey: ['public-champions'],
    queryFn: () => Champion.list('name'),
    initialData: initialChampions,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        {...CHAMPIONS_SEO}
        indexable
      />
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-5 py-10 md:py-14">
        <header className="mb-8 max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.26em] text-primary">Biblioteca pública</p>
          <h1 className="font-rajdhani text-4xl font-bold uppercase tracking-tight md:text-5xl">Campeones de Wild Rift</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            Explorá los roles, líneas y estadísticas base registradas para cada campeón en Rift Deck.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
            {Array.from({ length: 14 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        ) : isError ? (
          <div className="rd-card p-6 text-sm text-red-400">No se pudo cargar el listado de campeones.</div>
        ) : (
          <section aria-label="Listado de campeones" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7">
            {champions.map((champion, index) => (
              <article key={champion.id} className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
                <Link to={`/campeones/${championSlug(champion.name)}`} className="group block h-full">
                  {champion.image_url ? (
                    <img
                      src={champion.image_url}
                      alt={`${champion.name} en Wild Rift`}
                      width="160"
                      height="160"
                      loading={index < 7 ? 'eager' : 'lazy'}
                      className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-secondary text-3xl font-bold text-primary">{champion.name?.[0]}</div>
                  )}
                  <div className="p-3">
                    <h2 className="font-rajdhani text-lg font-bold text-foreground">{champion.name}</h2>
                    {(champion.roles || champion.lane) && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[champion.roles, ...getChampionLaneLabels(champion)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
