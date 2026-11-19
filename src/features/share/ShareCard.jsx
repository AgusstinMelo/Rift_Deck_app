// Tarjeta compartible "Mi resumen en Rift Deck". Se dibuja a tamaño real (1080 px de
// ancho) para exportarla como PNG; la vista previa la muestra escalada.
// Estilos en línea a propósito: la imagen tiene que salir igual en cualquier pantalla,
// sin depender de los breakpoints de la app. Look de carta de juego: marco dorado con
// esquinas, destellos, título según el winrate y badges.
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crown, Crosshair, Flame, Skull, Swords, Trophy, Users } from 'lucide-react';
import logo from '@/assets/riftdeck-logo-horizontal.png';
import { DEFAULT_PALETTE, loadArtPalette, rgba } from './artPalette';

export const CARD_SIZES = {
  story: { width: 1080, height: 1920 },
  // Post vertical 4:5: el formato que más lugar ocupa en el feed de Instagram.
  square: { width: 1080, height: 1350 },
};

const GOLD = '#D4AF37';
// Dorado apagado: brilla en la imagen sin encandilar.
const GOLD_LIGHT = '#E2C46A';
const INK = '#F4EFE3';
const MUTED = 'rgba(244, 239, 227, 0.66)';
const PANEL = 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)';
const LINE = 'rgba(212, 175, 55, 0.32)';
const WIN = '#4ADE80';
const LOSS = '#F87171';
const TITLE_FONT = "'Unbounded Variable', 'Unbounded', sans-serif";
const BODY_FONT = "'Inter Variable', 'Inter', sans-serif";
const GOLD_GRADIENT = `linear-gradient(135deg, #D9BC63 0%, #BF9B35 55%, #8A6C20 100%)`;
const GLOW = '0 0 28px rgba(212,175,55,0.22)';

/**
 * Fondo: destellos de color, grilla triangular y rayos desde arriba. Las luces toman los
 * colores del splash del campeón (artPalette.js): la de arriba y los rayos, el dominante;
 * la de abajo a la izquierda y la del costado, el segundo. Sin campeón, dorado y violeta.
 */
function Backdrop({ palette }) {
  const layer = { position: 'absolute', inset: 0, pointerEvents: 'none' };
  const custom = palette !== DEFAULT_PALETTE;
  const top = palette.primary;
  // Los rayos, un poco más claros que la luz de arriba (como el dorado claro original).
  const rays = custom ? top.map(value => Math.round(value + (255 - value) * 0.3)) : [245, 215, 110];
  const bottom = palette.secondary;
  const side = custom ? palette.secondary : [56, 189, 248];
  // Un color del campeón se lee menos que el dorado sobre el azul noche: un poco más de luz.
  const [topAlpha, rayAlpha, bottomAlpha, sideAlpha] = custom ? [0.26, 0.1, 0.32, 0.12] : [0.12, 0.06, 0.28, 0.12];
  const ray = alpha => rgba(rays, alpha);
  return (
    <>
      <div style={{ ...layer, background: `radial-gradient(60% 40% at 100% 0%, ${rgba(top, topAlpha)} 0%, ${rgba(top, 0)} 70%)` }} />
      <div style={{ ...layer, background: `radial-gradient(70% 45% at 0% 100%, ${rgba(bottom, bottomAlpha)} 0%, ${rgba(bottom, 0)} 70%)` }} />
      <div style={{ ...layer, background: `radial-gradient(50% 30% at 0% 35%, ${rgba(side, sideAlpha)} 0%, ${rgba(side, 0)} 70%)` }} />
      <div style={{
        ...layer, opacity: 0.55,
        background: 'repeating-linear-gradient(60deg, rgba(212,175,55,0.05) 0 2px, transparent 2px 36px), repeating-linear-gradient(-60deg, rgba(212,175,55,0.05) 0 2px, transparent 2px 36px)',
      }} />
      <div style={{ ...layer, background: `conic-gradient(from 180deg at 50% -10%, transparent 0deg, ${ray(rayAlpha)} 8deg, transparent 16deg, transparent 28deg, ${ray(rayAlpha * 0.83)} 34deg, transparent 40deg, transparent 320deg, ${ray(rayAlpha * 0.83)} 326deg, transparent 332deg, transparent 344deg, ${ray(rayAlpha)} 350deg, transparent 358deg)` }} />
    </>
  );
}

/** Marco dorado con esquinas ornamentadas, como una carta. */
function Frame() {
  const inset = 20;
  const size = 84;
  const corner = (vertical, horizontal) => ({
    position: 'absolute', width: size, height: size, [vertical]: inset, [horizontal]: inset, boxSizing: 'border-box',
    [`border${vertical[0].toUpperCase()}${vertical.slice(1)}`]: `6px solid ${GOLD}`,
    [`border${horizontal[0].toUpperCase()}${horizontal.slice(1)}`]: `6px solid ${GOLD}`,
    [`border${vertical[0].toUpperCase()}${vertical.slice(1)}${horizontal[0].toUpperCase()}${horizontal.slice(1)}Radius`]: 36,
    filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.3))',
  });
  return (
    <>
      <div style={{ position: 'absolute', inset, border: `2px solid ${LINE}`, borderRadius: 36, boxShadow: 'inset 0 0 60px rgba(212,175,55,0.08)', pointerEvents: 'none' }} />
      <div style={corner('top', 'left')} />
      <div style={corner('top', 'right')} />
      <div style={corner('bottom', 'left')} />
      <div style={corner('bottom', 'right')} />
    </>
  );
}

const BADGE_SIZES = {
  lg: { padding: '14px 26px', fontSize: 28, icon: 34, gap: 12 },
  md: { padding: '12px 22px', fontSize: 24, icon: 28, gap: 12 },
  sm: { padding: '10px 18px', fontSize: 20, icon: 24, gap: 10 },
};

function Badge({ icon: Icon, children, background, color, size = 'md' }) {
  const metrics = BADGE_SIZES[size];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: metrics.gap, padding: metrics.padding,
      borderRadius: 999, background, color, fontFamily: TITLE_FONT, fontWeight: 700,
      fontSize: metrics.fontSize, textTransform: 'uppercase', letterSpacing: 1,
      boxShadow: '0 10px 30px rgba(0,0,0,0.45)', whiteSpace: 'nowrap',
    }}>
      <Icon size={metrics.icon} strokeWidth={2.6} />
      {children}
    </div>
  );
}

const DIVIDER = 'rgba(212, 175, 55, 0.18)';
const ASSIST = '#7DD3FC';

/**
 * Bloque de estadísticas: métricas en columnas separadas por líneas doradas y, abajo,
 * el K / D / A acumulado del período con cada número en su color.
 */
function StatsPanel({ metrics, totals, totalsLabel, compact }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0, background: PANEL, border: `2px solid ${LINE}`, borderRadius: 28, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: GOLD_GRADIENT }} />
      <div style={{ display: 'flex' }}>
        {metrics.map(({ icon: Icon, label, value }, index) => (
          <div
            key={label}
            style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              padding: compact ? '24px 10px 20px' : '30px 10px 26px',
              borderLeft: index ? `2px solid ${DIVIDER}` : 'none',
            }}
          >
            <Icon size={compact ? 28 : 32} color={GOLD} strokeWidth={2.4} />
            <div style={{ fontFamily: TITLE_FONT, fontSize: compact ? 52 : 60, fontWeight: 700, color: INK, lineHeight: 1, marginTop: compact ? 12 : 14 }}>{value}</div>
            <div style={{ marginTop: 10, fontSize: compact ? 18 : 19, color: MUTED, textTransform: 'uppercase', letterSpacing: 1.5, whiteSpace: 'nowrap' }}>{label}</div>
          </div>
        ))}
      </div>
      {totals && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
          borderTop: `2px solid ${DIVIDER}`, background: 'rgba(0,0,0,0.18)',
          padding: compact ? '18px 30px' : '22px 34px',
        }}>
          <div style={{ fontSize: compact ? 19 : 21, color: MUTED, textTransform: 'uppercase', letterSpacing: 2.5, whiteSpace: 'nowrap' }}>{totalsLabel}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: compact ? 12 : 16, fontFamily: TITLE_FONT, fontWeight: 700, fontSize: compact ? 40 : 46, whiteSpace: 'nowrap' }}>
            <span style={{ color: WIN }}>{totals.kills}</span>
            <span style={{ color: MUTED, fontSize: compact ? 30 : 34 }}>/</span>
            <span style={{ color: LOSS }}>{totals.deaths}</span>
            <span style={{ color: MUTED, fontSize: compact ? 30 : 34 }}>/</span>
            <span style={{ color: ASSIST }}>{totals.assists}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{
 *   summary: ReturnType<import('./periodSummary.js').summarizePeriod>,
 *   format: 'story' | 'square', championArt?: string, playerName?: string,
 *   texts: Record<string, string>, locale?: string,
 * }} props  `texts`: textos ya traducidos (período, rótulos, título según winrate, racha y pie).
 */
const ShareCard = forwardRef(function ShareCard({ summary, format, championArt, fallbackArt, playerName, texts, locale = 'es-AR' }, ref) {
  // Si el splash en alta no carga, se usa el arte del catálogo.
  const [failedArt, setFailedArt] = useState(null);
  const art = championArt && championArt !== failedArt ? championArt : fallbackArt;
  // Luces con los colores del arte que se ve (memorizadas por URL: al exportar ya están).
  const [palette, setPalette] = useState({ art: null, colors: DEFAULT_PALETTE });
  useEffect(() => {
    let active = true;
    loadArtPalette(art).then(colors => { if (active) setPalette({ art, colors }); });
    return () => { active = false; };
  }, [art]);
  const lights = palette.art === art ? palette.colors : DEFAULT_PALETTE;
  const { width, height } = CARD_SIZES[format];
  const story = format === 'story';
  // El arte del campeón ocupa el alto que dejan los demás bloques (con un mínimo): así
  // la tarjeta nunca se desborda, aunque los textos midan distinto según el idioma o el
  // CSS de la página.
  const heroMinHeight = story ? 460 : 320;
  // Historia: zona segura de Instagram, medida sobre una historia publicada. Arriba van la
  // barra de progreso, el avatar y el usuario (~120 px de 1920) y abajo la caja de
  // comentario (desde ~1800 px): el contenido queda adentro, con un margen de resguardo.
  // El fondo y el marco siguen ocupando toda la imagen.
  const contentPadding = story ? '170px 72px 150px' : '60px 60px';
  // Un decimal con el separador del idioma (3,8 en español).
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fixed = value => (value === null || value === undefined ? '—' : decimal.format(value));
  // El KDA con dos decimales, como en Estadísticas (3,68).
  const twoDecimals = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kda = value => (value === null || value === undefined ? '—' : twoDecimals.format(value));
  const winShare = summary.games ? (summary.wins / summary.games) * 100 : 0;

  // Fila del winrate: número, récord y etiquetas en una línea. El número arranca grande y
  // se achica de a poco hasta que la fila entra (100%, títulos largos en otros idiomas).
  const winrateRow = useRef(null);
  const maxWinrateSize = summary.winrate >= 100 ? (story ? 128 : 104) : (story ? 160 : 124);
  const [winrateSize, setWinrateSize] = useState(maxWinrateSize);
  useLayoutEffect(() => {
    const row = winrateRow.current;
    if (!row) return undefined;
    const fit = () => {
      let size = maxWinrateSize;
      row.firstChild.style.fontSize = `${size}px`;
      while (size > 72 && row.scrollWidth > row.clientWidth) {
        size -= 4;
        row.firstChild.style.fontSize = `${size}px`;
      }
      setWinrateSize(size);
    };
    fit();
    // Con las fuentes cargadas cambian los anchos: se vuelve a medir.
    let active = true;
    document.fonts?.ready.then(() => active && fit());
    return () => { active = false; };
  }, [maxWinrateSize, texts.tier, texts.streakBadge, texts.winsShort, texts.lossesShort, texts.winrate]);

  return (
    <div
      ref={ref}
      style={{
        width, height, boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 80% at 50% 0%, #1D2540 0%, #0B0F1A 60%, #07090F 100%)',
        color: INK, fontFamily: BODY_FONT, lineHeight: 1.2, letterSpacing: 'normal',
      }}
    >
      <Backdrop palette={lights} />
      <Frame />

      <div style={{
        position: 'relative', height: '100%', boxSizing: 'border-box', padding: contentPadding,
        display: 'flex', flexDirection: 'column', gap: story ? 30 : 26,
      }}>
        {/* Encabezado: marca y período. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
          <img src={logo} alt="Rift Deck" style={{ height: 52, width: 'auto', flexShrink: 0, filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.18))' }} />
          <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', border: `2px solid ${LINE}`, background: 'rgba(212,175,55,0.08)', borderRadius: 999, padding: '14px 26px', fontSize: 24, color: GOLD_LIGHT, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {texts.period}
          </div>
        </div>

        {/* Campeón destacado sobre su arte, con título según el winrate y racha. */}
        <div style={{
          position: 'relative', flex: '1 1 0', minHeight: heroMinHeight, borderRadius: 40, overflow: 'hidden',
          border: `3px solid rgba(212,175,55,0.75)`, background: '#141A29',
          boxShadow: '0 0 40px rgba(212,175,55,0.10), inset 0 0 0 2px rgba(255,255,255,0.05)',
        }}>
          {art && (
            <img
              key={art}
              src={art}
              alt=""
              crossOrigin="anonymous"
              onError={() => setFailedArt(art)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%' }}
            />
          )}
          {/* Brillo diagonal y degradé para que el texto se lea. */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.10) 48%, transparent 58%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(11,15,26,0.35) 0%, rgba(11,15,26,0) 25%, rgba(11,15,26,0) 45%, rgba(11,15,26,0.95) 100%)' }} />

          <div style={{ position: 'absolute', left: 48, right: 48, bottom: 40 }}>
            <div style={{ fontSize: story ? 28 : 24, color: GOLD_LIGHT, letterSpacing: 4, textTransform: 'uppercase' }}>{texts.featured}</div>
            <div style={{ fontFamily: TITLE_FONT, fontSize: story ? 108 : 78, fontWeight: 800, lineHeight: 1.02, textTransform: 'uppercase', letterSpacing: -2, marginTop: 8, textShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
              {summary.topChampion?.name || '—'}
            </div>
            {summary.topChampion && (
              <div style={{ fontSize: story ? 32 : 26, color: INK, opacity: 0.85, marginTop: 10 }}>{texts.featuredRecord}</div>
            )}
          </div>
        </div>

        {/* Winrate con resplandor, récord y barra de victorias / derrotas. */}
        <div style={{ flexShrink: 0 }}>
          <div ref={winrateRow} style={{ display: 'flex', alignItems: 'flex-end', gap: story ? 30 : 36 }}>
            <div style={{ flexShrink: 0, fontFamily: TITLE_FONT, fontSize: winrateSize, fontWeight: 800, lineHeight: 0.9, color: GOLD_LIGHT, letterSpacing: -6, textShadow: GLOW }}>
              {summary.winrate}%
            </div>
            <div style={{ flexShrink: 0, paddingBottom: story ? 14 : 10 }}>
              <div style={{ fontSize: story ? 28 : 24, color: MUTED, textTransform: 'uppercase', letterSpacing: 4 }}>{texts.winrate}</div>
              <div style={{ fontFamily: TITLE_FONT, fontSize: story ? 46 : 40, fontWeight: 700, marginTop: 8, whiteSpace: 'nowrap' }}>
                <span style={{ color: WIN }}>{texts.winsShort}</span>
                <span style={{ color: MUTED }}> · </span>
                <span style={{ color: LOSS }}>{texts.lossesShort}</span>
              </div>
            </div>
            {/* Título según el winrate y racha, apilados a la derecha: acá y no sobre el arte,
                donde tapaban la cara del campeón. */}
            <div style={{ marginLeft: 'auto', alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: story ? 14 : 12, flexShrink: 0 }}>
              <Badge icon={Crown} background={GOLD_GRADIENT} color="#1A1405" size="sm">{texts.tier}</Badge>
              {texts.streakBadge && (
                <Badge icon={Flame} background="linear-gradient(135deg, #FB923C 0%, #EF4444 100%)" color="#FFF7ED" size="sm">{texts.streakBadge}</Badge>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', height: story ? 18 : 14, marginTop: story ? 28 : 20, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.05)' }}>
            <div style={{ width: `${winShare}%`, background: `linear-gradient(90deg, #16A34A, ${WIN})`, boxShadow: '0 0 18px rgba(74,222,128,0.6)' }} />
            <div style={{ flex: 1, background: `linear-gradient(90deg, ${LOSS}, #B91C1C)` }} />
          </div>
        </div>

        {/* Números del período. */}
        <StatsPanel
          compact={!story}
          metrics={[
            { icon: Swords, label: texts.games, value: summary.games },
            { icon: Crosshair, label: texts.kda, value: kda(summary.kda) },
            { icon: Users, label: texts.championsUsed, value: summary.championCount ?? '—' },
            { icon: Skull, label: texts.deaths, value: fixed(summary.avgDeaths) },
          ]}
          totals={summary.totals}
          totalsLabel={texts.kdaTotal}
        />

        {summary.bestMatch && (
          <div style={{ position: 'relative', flexShrink: 0, background: 'linear-gradient(90deg, rgba(212,175,55,0.10) 0%, rgba(212,175,55,0.02) 70%)', border: `2px solid ${LINE}`, borderRadius: 28, padding: story ? '26px 32px' : '22px 28px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: story ? 84 : 70, height: story ? 84 : 70, borderRadius: 999, background: GOLD_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 18px rgba(212,175,55,0.2)' }}>
              <Trophy size={story ? 44 : 36} color="#1A1405" strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: story ? 25 : 22, color: MUTED, textTransform: 'uppercase', letterSpacing: 3 }}>{texts.bestMatch}</div>
              <div style={{ fontFamily: TITLE_FONT, fontSize: story ? 42 : 36, fontWeight: 700, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.bestMatch.champion}</div>
            </div>
            <div style={{ fontFamily: TITLE_FONT, fontSize: story ? 62 : 52, fontWeight: 800, color: GOLD_LIGHT, whiteSpace: 'nowrap', textShadow: GLOW }}>
              {summary.bestMatch.kills}/{summary.bestMatch.deaths}/{summary.bestMatch.assists}
            </div>
          </div>
        )}

        {/* Pie: jugador y sitio. */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, borderTop: `2px solid ${LINE}`, paddingTop: story ? 28 : 22 }}>
          <div style={{ fontSize: story ? 32 : 26, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playerName || ''}</div>
          <div style={{ fontSize: story ? 28 : 24, color: GOLD_LIGHT, letterSpacing: 1, whiteSpace: 'nowrap', fontWeight: 600 }}>riftdeckapp.com</div>
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
