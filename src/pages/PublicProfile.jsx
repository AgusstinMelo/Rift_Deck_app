// Perfil público (/p/<nombre>): lo ve cualquiera que tenga el link, con o sin cuenta.
// Es una vitrina, no un espacio de trabajo: entra entera en la pantalla (escritorio y
// celular), con la estética de la tarjeta para compartir.
//   - Banner: avatar, nombre, winrate, récord y tipos de partida.
//   - Pool de campeones en burbujas (tamaño = partidas, color = winrate). Al tocar uno,
//     el foco muestra su mejor y peor matchup directo y su mejor y peor sinergia.
//   - Radar de winrate por línea (el mismo de Estadísticas) y últimas partidas.
// En celular, el banner queda arriba y los paneles van en pestañas al pie.
// No se indexa (noindex) y no hay rankings entre usuarios.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Crosshair, HeartHandshake, Loader2, Swords, UserX, History, Radar, Sparkles } from 'lucide-react';
import { getPublicProfile } from '@/api/publicProfileSupabase';
import { Champion } from '@/api/entitiesSupabase';
import {
  availableTypes, bestStreak, championFocus, packBubbles, recentMatches, sideSummary, summarizePublicStats,
} from '@/features/publicProfile/publicProfile';
import { DEFAULT_MATCH_TYPE, MATCH_TYPES } from '@/constants/matchTypes';
import { formatLocale } from '@/i18n/uiI18n';
import { useAuth } from '@/lib/AuthContext';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import PublicHeader from '@/components/public/PublicHeader';
import AnimatedBackground from '@/components/AnimatedBackground';
import ProfileAvatar from '@/components/ui/ProfileAvatar';
import LaneBadge from '@/components/ui/LaneBadge';
import { LaneBarChart } from '@/components/stats/StatsSections';

const TYPE_ORDER = MATCH_TYPES.map(option => option.value);
const POOL_SIZE = 14;
// "Últimas partidas": cada fila ocupa RECENT_ROW (alto + espacio), para calcular cuántas entran.
const RECENT_GAP = 6;
const RECENT_ROW = 46;

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

/** Color según winrate: verde arriba de 55, dorado en el medio, rojo abajo de 45. */
const wrColor = winrate => (winrate >= 55 ? '#4ADE80' : winrate >= 45 ? '#E2C46A' : '#F87171');

/**
 * Cuántas filas de `rowHeight` (incluido el espacio `gap` entre filas) entran en el
 * elemento; se recalcula al cambiar de tamaño. `ready`: el elemento ya está en pantalla
 * (mientras carga el perfil no existe).
 */
function useRowsThatFit(ref, rowHeight, gap, ready) {
  const [rows, setRows] = useState(6);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!ready || !element) return undefined;
    const measure = () => setRows(Math.max(1, Math.floor((element.clientHeight + gap) / rowHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rowHeight, gap, ready]);
  return rows;
}

/** Número del banner: rótulo, valor y detalle, alineados con el bloque del récord. */
function HeroStat({ label, value, sub, tone }) {
  return (
    <div className={`rd-pp-stat ${tone ? `rd-pp-stat-${tone}` : ''}`}>
      <span className="rd-pp-record-label">{label}</span>
      <span className="rd-pp-stat-value">{value}</span>
      <span className="rd-pp-record-games">{sub || ' '}</span>
    </div>
  );
}

function Panel({ icon: Icon, title, hint, className = '', children }) {
  return (
    <section className={`rd-pp-panel ${className}`}>
      <header className="rd-pp-panel-head">
        <Icon size={15} />
        <h2>{title}</h2>
        {hint && <span className="rd-pp-panel-hint">{hint}</span>}
      </header>
      <div className="rd-pp-panel-body">{children}</div>
    </section>
  );
}

/** Pool de campeones: burbujas en un SVG que se escala para ocupar el panel. */
function ChampionPool({ champions, selected, onSelect, imageOf, labelOf }) {
  // Proporción del panel (redondeada, para no reacomodar en cada píxel): las burbujas se
  // reparten con esa forma y llenan el espacio, sea apaisado o alto.
  const boxRef = useRef(null);
  const [aspect, setAspect] = useState(1.25);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => {
      if (!box.clientWidth || !box.clientHeight) return;
      setAspect(Math.round((box.clientWidth / box.clientHeight) * 10) / 10);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const { bubbles, bounds } = useMemo(
    () => packBubbles(champions, { minRadius: 18, maxRadius: 58, gap: 6, aspect }),
    [champions, aspect],
  );
  if (!bubbles.length) return null;
  const pad = 6;
  return (
    <div ref={boxRef} className="rd-pp-pool-box">
    <svg
      className="rd-pp-pool-svg"
      viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      role="list"
    >
      <defs>
        {bubbles.map((bubble, index) => (
          <clipPath key={bubble.name} id={`rd-pp-clip-${index}`}>
            <circle cx={bubble.x} cy={bubble.y} r={bubble.r - 2.5} />
          </clipPath>
        ))}
      </defs>
      {bubbles.map((bubble, index) => {
        const active = bubble.name === selected;
        const color = wrColor(bubble.winrate);
        const image = imageOf(bubble.name);
        const label = labelOf(bubble.name);
        return (
          <g
            key={bubble.name}
            role="listitem"
            tabIndex={0}
            className={`rd-pp-bubble ${active ? 'is-active' : ''}`}
            onClick={() => onSelect(bubble.name)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(bubble.name); } }}
            aria-label={`${label}: ${bubble.games} · ${bubble.winrate}%`}
          >
            <title>{`${label} · ${bubble.games} · ${bubble.winrate}%`}</title>
            
            <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill="#141A29" />
            {image && (
              <image
                href={image}
                x={bubble.x - bubble.r}
                y={bubble.y - bubble.r}
                width={bubble.r * 2}
                height={bubble.r * 2}
                clipPath={`url(#rd-pp-clip-${index})`}
                preserveAspectRatio="xMidYMid slice"
              />
            )}
            <circle cx={bubble.x} cy={bubble.y} r={bubble.r - 1.5} fill="none" stroke={color} strokeWidth="1" />
            {/* Winrate en una pastilla abajo de la burbuja (solo si entra). */}
            {bubble.r >= 26 && (
              <g>
                <rect x={bubble.x - 19} y={bubble.y + bubble.r - 15} width="38" height="15" rx="7.5" fill="rgba(11,15,26,.88)" stroke={color} strokeWidth="1" />
                <text x={bubble.x} y={bubble.y + bubble.r - 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{bubble.winrate}%</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** Una de las cuatro casillas del foco: matchup o sinergia, con el campeón y su récord. */
function FocusTile({ icon: Icon, label, entry, tone, imageOf, labelOf, emptyText, gamesLabel }) {
  return (
    <div className={`rd-pp-tile rd-pp-tile-${tone}`}>
      <div className="rd-pp-tile-label"><Icon size={13} /> {label}</div>
      {entry ? (
        <div className="rd-pp-tile-body">
          <div className="rd-pp-tile-avatar">
            {imageOf(entry.name) && <img src={imageOf(entry.name)} alt="" />}
          </div>
          <div className="min-w-0">
            <div className="rd-pp-tile-name">{labelOf(entry.name)}</div>
            <div className="rd-pp-tile-meta">
              <strong style={{ color: wrColor(entry.winrate) }}>{entry.winrate}%</strong> · {gamesLabel(entry.games)}
            </div>
          </div>
        </div>
      ) : (
        <div className="rd-pp-tile-empty">{emptyText}</div>
      )}
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
  // Misma consulta que el resto de la app: los íconos salen de la caché si ya se cargaron.
  const { data: catalog = [] } = useQuery({ queryKey: ['sidebar-search', 'champions'], queryFn: () => Champion.list('name') });

  useNoIndex(profile?.name ? `${profile.name} · Rift Deck` : 'Rift Deck');

  const types = useMemo(() => availableTypes(profile?.stats, TYPE_ORDER), [profile]);
  // Arranca como Estadísticas (Clasificatoria) si hay; si no, con todos los tipos cargados.
  const [selectedTypes, setSelectedTypes] = useState(null);
  const activeTypes = useMemo(
    () => selectedTypes || (types.includes(DEFAULT_MATCH_TYPE) ? [DEFAULT_MATCH_TYPE] : types),
    [selectedTypes, types],
  );
  const toggleType = type => setSelectedTypes(current => {
    const base = current || activeTypes;
    if (!base.includes(type)) return [...base, type];
    return base.length > 1 ? base.filter(entry => entry !== type) : base;
  });

  const summary = useMemo(() => summarizePublicStats(profile?.stats, activeTypes), [profile, activeTypes]);
  const sides = useMemo(() => sideSummary(profile?.sides, activeTypes), [profile, activeTypes]);
  const patchStreak = useMemo(() => bestStreak(profile?.patch_results, activeTypes), [profile, activeTypes]);
  // KDA con dos decimales y el separador del idioma (3,45), como en Estadísticas.
  const kdaFormat = new Intl.NumberFormat(formatLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pool = summary.champions.slice(0, POOL_SIZE);
  const [picked, setPicked] = useState(null);
  const focusName = pool.some(entry => entry.name === picked) ? picked : pool[0]?.name || null;
  const focusEntry = pool.find(entry => entry.name === focusName) || null;
  const focus = useMemo(() => (focusName ? championFocus(profile, focusName, activeTypes) : null), [profile, focusName, activeTypes]);

  const [tab, setTab] = useState('pool');
  const recentRef = useRef(null);
  const recentRows = useRowsThatFit(recentRef, RECENT_ROW, RECENT_GAP, Boolean(profile));
  const recent = recentMatches(profile?.recent, activeTypes, recentRows);

  const championRow = name => catalog.find(entry => entry.name?.toLowerCase() === String(name || '').toLowerCase());
  const imageOf = name => championRow(name)?.image_url || null;
  const splashOf = name => { const row = championRow(name); return row?.image_url_splash || row?.image_url_card || null; };
  const labelOf = name => { const row = championRow(name); return row ? entityName(row) : name; };
  const gamesLabel = count => t(count === 1 ? 'publicProfile.page.gamesCountOne' : 'publicProfile.page.gamesCount', { count });
  const dateFormat = new Intl.DateTimeFormat(formatLocale(), { day: 'numeric', month: 'short' });
  const dateLabel = iso => {
    if (!iso) return '';
    const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number);
    return dateFormat.format(new Date(year, month - 1, day));
  };
  const laneArr = summary.lanes.map(entry => ({ lane: entry.lane, wr: entry.winrate, games: entry.games }));

  const shell = content => (
    <div className="rd-pp">
      <AnimatedBackground />
      <div className="rd-pp-frame">
        <PublicHeader />
        {content}
      </div>
    </div>
  );

  if (isLoading) {
    return shell(
      <main className="rd-pp-main rd-pp-center">
        <Loader2 size={16} className="animate-spin" /> {t('publicProfile.page.loading')}
      </main>,
    );
  }

  if (isError || !profile) {
    return shell(
      <main className="rd-pp-main rd-pp-center">
        <div className="rd-pp-panel max-w-md items-center p-8 text-center">
          <UserX size={32} className="mx-auto text-muted-foreground" />
          <h1 className="mt-3 font-rajdhani text-2xl font-bold uppercase text-foreground">{t('publicProfile.page.notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('publicProfile.page.notFoundText')}</p>
        </div>
      </main>,
    );
  }

  return shell(
    <main className="rd-pp-main" data-tab={tab}>
      {/* Banner con la estética de la tarjeta para compartir: arriba quién es (y los tipos
          de partida); abajo una franja de números en columnas iguales, alineados en tres
          líneas (rótulo, valor y detalle). */}
      <section className="rd-pp-hero">
        <div className="rd-pp-hero-top">
          <div className="rd-pp-hero-id">
            <div className="rd-pp-avatar">
              <ProfileAvatar src={profile.avatar_url} alt={profile.name} iconSize={26} />
            </div>
            <div className="min-w-0">
              <div className="rd-pp-kicker"><span />{t('publicProfile.page.kicker')}</div>
              <h1 className="rd-pp-name">{profile.name}</h1>
            </div>
          </div>

          {(types.length > 1 || !isAuthenticated) && (
            <div className="rd-pp-hero-side">
              {types.length > 1 && (
                <div className="rd-panel-tabs rd-pp-types" role="group" aria-label={t('publicProfile.page.typeLabel')}>
                  {types.map(type => {
                    const active = activeTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleType(type)}
                        className={`rd-panel-tab inline-flex min-w-0 flex-1 items-center justify-center gap-1 ${active ? 'rd-panel-tab-active' : ''}`}
                      >
                        {active && <Check size={12} strokeWidth={3} className="shrink-0" />}
                        <span className="truncate">{t(`share.type.${type}`)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!isAuthenticated && (
                <Link to="/registro" className="rd-pp-cta"><Sparkles size={14} /> {t('publicProfile.page.ctaButton')}</Link>
              )}
            </div>
          )}
        </div>

        <div className="rd-pp-strip">
          <HeroStat
            label={t('publicProfile.page.winrate')}
            value={summary.games ? `${summary.winrate}%` : '—'}
            tone="gold"
            sub={gamesLabel(summary.games)}
          />
          <HeroStat
            label={t('publicProfile.page.record')}
            value={(
              <>
                <span className="text-green-400">{t('share.card.winsShort', { wins: summary.wins })}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-red-400">{t('share.card.lossesShort', { losses: summary.losses })}</span>
              </>
            )}
          />
          <HeroStat label={t('publicProfile.page.kda')} value={summary.kda === null ? '—' : kdaFormat.format(summary.kda)} sub={t('publicProfile.page.kdaSub')} />
          <HeroStat
            label={t('publicProfile.page.streak')}
            value={patchStreak ? `${patchStreak}` : '—'}
            tone={patchStreak >= 3 ? 'fire' : undefined}
            sub={profile.patch ? t('publicProfile.page.streakSub', { patch: profile.patch }) : ''}
          />
          <HeroStat label={t('publicProfile.page.blueSide')} value={sides.blue.winrate === null ? '—' : `${sides.blue.winrate}%`} tone="blue" sub={gamesLabel(sides.blue.games)} />
          <HeroStat label={t('publicProfile.page.redSide')} value={sides.red.winrate === null ? '—' : `${sides.red.winrate}%`} tone="red" sub={gamesLabel(sides.red.games)} />
        </div>
      </section>

      <Panel icon={Swords} title={t('publicProfile.page.pool')} hint={t('publicProfile.page.poolHint')} className="rd-pp-pool" >
        {pool.length ? (
          <ChampionPool champions={pool} selected={focusName} onSelect={setPicked} imageOf={imageOf} labelOf={labelOf} />
        ) : (
          <p className="rd-pp-empty">{t('publicProfile.page.noMatches')}</p>
        )}
      </Panel>

      <section className="rd-pp-panel rd-pp-focus">
        {focusEntry ? (
          <>
            <header className="rd-pp-focus-head">
              {/* Splash del campeón de fondo (en escritorio), como en la tarjeta. */}
              {splashOf(focusEntry.name) && (
                <img key={splashOf(focusEntry.name)} src={splashOf(focusEntry.name)} alt="" className="rd-pp-focus-splash" />
              )}
              <div className="rd-pp-focus-avatar" style={{ borderColor: wrColor(focusEntry.winrate) }}>
                {imageOf(focusEntry.name) && <img src={imageOf(focusEntry.name)} alt="" />}
              </div>
              <div className="min-w-0">
                <div className="rd-pp-focus-name">{labelOf(focusEntry.name)}</div>
                <div className="rd-pp-focus-meta">
                  {t(focusEntry.games === 1 ? 'publicProfile.page.focusGamesOne' : 'publicProfile.page.focusGames', { count: focusEntry.games, winrate: focusEntry.winrate })}
                </div>
              </div>
            </header>
            <div className="rd-pp-tiles">
              {[
                ['bestMatchup', Crosshair, 'good', focus?.bestMatchup],
                ['worstMatchup', Crosshair, 'bad', focus?.worstMatchup],
                ['bestSynergy', HeartHandshake, 'good', focus?.bestSynergy],
                ['worstSynergy', HeartHandshake, 'bad', focus?.worstSynergy],
              ].map(([key, icon, tone, entry]) => (
                <FocusTile
                  key={key}
                  icon={icon}
                  tone={tone}
                  label={t(`publicProfile.page.${key}`)}
                  entry={entry}
                  imageOf={imageOf}
                  labelOf={labelOf}
                  gamesLabel={gamesLabel}
                  emptyText={t('publicProfile.page.noData')}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="rd-pp-empty">{t('publicProfile.page.noMatches')}</p>
        )}
      </section>

      <Panel icon={Radar} title={t('publicProfile.page.lanesTitle')} className="rd-pp-lanes">
        <LaneBarChart laneArr={laneArr} />
      </Panel>

      <Panel icon={History} title={t('publicProfile.page.recent')} className="rd-pp-recent">
        <ul ref={recentRef} className="rd-pp-recent-list">
          {recent.map((match, index) => {
            const won = match.result === 'win';
            return (
              <li key={`${match.date}-${index}`} className="rd-pp-recent-row" style={{ height: RECENT_ROW - RECENT_GAP }}>
                <span className={`rd-pp-result ${won ? 'is-win' : 'is-loss'}`}>{t(won ? 'publicProfile.page.win' : 'publicProfile.page.loss')}</span>
                <span className="rd-pp-recent-avatar">{imageOf(match.champion) && <img src={imageOf(match.champion)} alt="" />}</span>
                <span className="rd-pp-recent-main">
                  <span className="rd-pp-recent-name">{labelOf(match.champion)}</span>
                  {match.opponent && (
                    <span className="rd-pp-recent-vs">{t('publicProfile.page.vs')} {labelOf(match.opponent)}</span>
                  )}
                </span>
                {match.lane && <span className="rd-pp-recent-lane"><LaneBadge lane={match.lane} /></span>}
                <span className="rd-pp-recent-kda">
                  {[match.kills, match.deaths, match.assists].every(value => value !== null && value !== undefined)
                    ? `${match.kills}/${match.deaths}/${match.assists}` : '—'}
                </span>
                <span className="rd-pp-recent-date">{dateLabel(match.date)}</span>
              </li>
            );
          })}
          {!recent.length && <li className="rd-pp-empty">{t('publicProfile.page.noMatches')}</li>}
        </ul>
      </Panel>

      {/* Celular: un panel a la vez, con las pestañas al alcance del pulgar. */}
      <nav className="rd-pp-tabs rd-panel-tabs" aria-label={t('publicProfile.page.kicker')}>
        {[['pool', Swords, 'tabPool'], ['lanes', Radar, 'tabLanes'], ['recent', History, 'tabRecent']].map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`rd-panel-tab inline-flex flex-1 items-center justify-center gap-1.5 ${tab === id ? 'rd-panel-tab-active' : ''}`}
          >
            <Icon size={14} /> {t(`publicProfile.page.${label}`)}
          </button>
        ))}
      </nav>
    </main>,
  );
}