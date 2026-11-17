// Perfil público (/p/<nombre>): lo ve cualquiera que tenga el link, con o sin cuenta.
// Muestra winrate y récord, campeones y líneas (por tipo de partida) y las builds que el
// dueño marcó como públicas. No se indexa (noindex) y no hay rankings entre usuarios.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Swords, Trophy, Percent, UserX, Wrench } from 'lucide-react';
import { getPublicProfile } from '@/api/publicProfileSupabase';
import { Champion, WRItem } from '@/api/entitiesSupabase';
import { availableTypes, summarizePublicStats } from '@/features/publicProfile/publicProfile';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import PublicHeader from '@/components/public/PublicHeader';
import AnimatedBackground from '@/components/AnimatedBackground';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import LaneBadge from '@/components/ui/LaneBadge';

const TYPE_ORDER = MATCH_TYPES.map(option => option.value);
const CHAMPIONS_SHOWN = 10;

/** Fuera de los buscadores: la página es solo para quien tiene el link. */
function useNoIndex(title) {
  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.querySelector('meta[name="robots"]');
    const previousRobots = meta?.getAttribute('content');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
    if (title) document.title = title;
    return () => {
      document.title = previousTitle;
      if (previousRobots) meta.setAttribute('content', previousRobots);
      else meta.remove();
    };
  }, [title]);
}

function Metric({ icon: Icon, label, children }) {
  return (
    <div className="rd-card flex flex-col items-center gap-1 p-4 text-center">
      <Icon size={18} className="text-primary" />
      <div className="font-rajdhani text-3xl font-bold leading-none text-foreground md:text-4xl">{children}</div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}

function WinrateBar({ winrate }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full ${winrate >= 50 ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${winrate}%` }} />
    </div>
  );
}

export default function PublicProfile() {
  const t = useT();
  const { slug = '' } = useParams();
  const { isAuthenticated } = useAuth();
  const { entityName } = useCatalogText();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['public-profile', slug.toLowerCase()],
    queryFn: () => getPublicProfile(slug),
    staleTime: 60 * 1000,
  });
  // Mismas consultas que el resto de la app: los íconos salen de la caché si ya se cargaron.
  const { data: champions = [] } = useQuery({ queryKey: ['sidebar-search', 'champions'], queryFn: () => Champion.list('name') });
  const { data: items = [] } = useQuery({ queryKey: ['sidebar-search', 'items'], queryFn: () => WRItem.list('name') });

  useNoIndex(profile?.name ? `${profile.name} · Rift Deck` : 'Rift Deck');

  const types = useMemo(() => availableTypes(profile?.stats, TYPE_ORDER), [profile]);
  // Arranca como Estadísticas (Clasificatoria) si hay; si no, con todos los tipos cargados.
  const [selectedTypes, setSelectedTypes] = useState(null);
  const activeTypes = selectedTypes || (types.includes(DEFAULT_MATCH_TYPE) ? [DEFAULT_MATCH_TYPE] : types);
  const toggleType = type => setSelectedTypes(current => {
    const base = current || activeTypes;
    if (!base.includes(type)) return [...base, type];
    return base.length > 1 ? base.filter(entry => entry !== type) : base;
  });
  const summary = useMemo(() => summarizePublicStats(profile?.stats, activeTypes), [profile, activeTypes]);

  const championByName = name => champions.find(entry => entry.name === name);
  const itemByName = name => items.find(entry => entry.name === name);
  const gamesLabel = count => t(count === 1 ? 'publicProfile.page.gamesCountOne' : 'publicProfile.page.gamesCount', { count });

  const shell = content => (
    <>
      <AnimatedBackground scrollSelector=".rd-main-content" />
      <div className="relative z-10 flex h-dvh min-h-0 flex-col text-foreground">
        <PublicHeader />
        <main className="rd-main-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="rd-page mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">{content}</div>
        </main>
      </div>
    </>
  );

  if (isLoading) {
    return shell(
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> {t('publicProfile.page.loading')}
      </div>,
    );
  }

  if (isError || !profile) {
    return shell(
      <div className="rd-card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <UserX size={32} className="text-muted-foreground" />
        <h1 className="font-rajdhani text-2xl font-bold uppercase text-foreground">{t('publicProfile.page.notFoundTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('publicProfile.page.notFoundText')}</p>
      </div>,
    );
  }

  const shownChampions = summary.champions.slice(0, CHAMPIONS_SHOWN);

  return shell(
    <>
      {/* Encabezado: avatar y nombre. */}
      <div className="rd-card flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_18px_rgba(212,175,55,.12)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
          <ProfileAvatar src={profile.avatar_url} alt={profile.name} iconSize={26} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-primary/80">{t('publicProfile.page.kicker')}</span>
          </div>
          <h1 className="truncate font-rajdhani text-3xl font-bold uppercase tracking-[-0.06em] text-foreground md:text-4xl">{profile.name}</h1>
        </div>
      </div>

      {/* Tipos de partida: se prenden y apagan como en la tarjeta para compartir. */}
      {types.length > 1 && (
        <div className="space-y-2">
          <p className="rd-label">{t('publicProfile.page.typeLabel')}</p>
          <div className="rd-panel-tabs w-full" role="group" aria-label={t('publicProfile.page.typeLabel')}>
            {types.map(type => {
              const active = activeTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleType(type)}
                  className={`rd-panel-tab inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 ${active ? 'rd-panel-tab-active' : ''}`}
                >
                  {active && <Check size={14} strokeWidth={3} className="shrink-0" />}
                  <span className="truncate">{t(`share.type.${type}`)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {summary.games ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon={Swords} label={t('publicProfile.page.games')}>{summary.games}</Metric>
            <Metric icon={Percent} label={t('publicProfile.page.winrate')}>
              <span className={summary.winrate >= 50 ? 'text-green-400' : 'text-red-400'}>{summary.winrate}%</span>
            </Metric>
            <Metric icon={Trophy} label={t('publicProfile.page.record')}>
              <span className="text-green-400">{t('share.card.winsShort', { wins: summary.wins })}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-red-400">{t('share.card.lossesShort', { losses: summary.losses })}</span>
            </Metric>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="rd-card p-5">
              <h2 className="rd-card-title mb-4">{t('publicProfile.page.champions')}</h2>
              <ul className="space-y-3">
                {shownChampions.map(entry => {
                  const champion = championByName(entry.name);
                  return (
                    <li key={entry.name} className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                        {champion?.image_url && <img src={champion.image_url} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold text-foreground">{champion ? entityName(champion) : entry.name}</span>
                          <span className={`shrink-0 text-sm font-bold ${entry.winrate >= 50 ? 'text-green-400' : 'text-red-400'}`}>{entry.winrate}%</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <WinrateBar winrate={entry.winrate} />
                          <span className="shrink-0 text-xs text-muted-foreground">{gamesLabel(entry.games)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rd-card p-5">
              <h2 className="rd-card-title mb-4">{t('publicProfile.page.lanes')}</h2>
              <ul className="space-y-3">
                {summary.lanes.map(entry => (
                  <li key={entry.lane} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <LaneBadge lane={entry.lane} />
                      <span className="text-xs text-muted-foreground">
                        {gamesLabel(entry.games)} · <span className={entry.winrate >= 50 ? 'text-green-400' : 'text-red-400'}>{entry.winrate}%</span>
                      </span>
                    </div>
                    <WinrateBar winrate={entry.winrate} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : (
        <div className="rd-card p-6 text-center text-sm text-muted-foreground">{t('publicProfile.page.noMatches')}</div>
      )}

      {/* Builds que el dueño marcó como públicas. */}
      <section className="rd-card p-5">
        <h2 className="rd-card-title mb-4">{t('publicProfile.page.builds')}</h2>
        {profile.builds?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.builds.map(build => {
              const champion = championByName(build.champion_name);
              return (
                <article key={build.id} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                      {champion?.image_url
                        ? <img src={champion.image_url} alt="" className="h-full w-full object-cover" />
                        : <Wrench size={16} className="m-3 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{build.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{champion ? entityName(champion) : build.champion_name}</span>
                        {build.lane && <LaneBadge lane={build.lane} />}
                        {build.patch && <span>· {build.patch}</span>}
                      </div>
                    </div>
                  </div>
                  {build.items?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {build.items.map((name, index) => {
                        const item = itemByName(name);
                        const label = item ? entityName(item) : name;
                        return item?.image_url ? (
                          <img key={`${name}-${index}`} src={item.image_url} alt={label} title={label} className="h-9 w-9 rounded-md border border-border object-cover" />
                        ) : (
                          <span key={`${name}-${index}`} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{label}</span>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('publicProfile.page.noBuilds')}</p>
        )}
      </section>

      {/* Invitación para quien llega sin cuenta. */}
      {!isAuthenticated && (
        <div className="rd-card flex flex-col items-start gap-3 border-primary/25 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-rajdhani text-xl font-bold uppercase text-foreground">{t('publicProfile.page.ctaTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('publicProfile.page.ctaText')}</p>
          </div>
          <Link to="/registro" className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            {t('publicProfile.page.ctaButton')}
          </Link>
        </div>
      )}
    </>,
  );
}
