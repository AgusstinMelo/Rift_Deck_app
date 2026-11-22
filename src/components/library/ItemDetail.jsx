// Ficha de objeto, con el mismo lenguaje que la de campeón (styles/16-library.css):
// héroe con el ícono y luces sacadas de sus colores, y debajo Efectos, Estadísticas,
// Enfrentamientos y objetos del mismo tipo. En escritorio entra todo sin scroll.
import { useMemo, useRef, useState } from 'react';
import { useMatchMedia, PHONE_LANDSCAPE_QUERY, PHONE_PORTRAIT_QUERY } from '@/hooks/useMatchMedia';
import { ArrowLeft, Ban, CheckCircle2, Coins, Sword } from 'lucide-react';
import { Link } from 'react-router-dom';
import { entitySlug } from '@/utils/entitySlug';
import { usesUnifiedLifesteal } from '@/lib/gamePatch';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { itemCategoryLabel, itemTypeLabel } from '@/utils/itemLabels';
import {
  CardTitle, FaceList, FillSpace, ItemIconList, MatchupRow, PersonalUsageBlock, effectsSplitIndex, splitEffects, useArtLights, useFitCount, useFitText, usePersonalMatches,
} from '@/components/library/detailParts';
import { championsForItem, inferredItemClasses, itemCountersFor, personalUsage } from '@/features/library/entityInsights';
import { itemProfile } from '@/features/coach/catalog';
import { COUNTER_TAGS, FIT_CLASSES } from '@/features/coach/taxonomy';
import { itemCounters } from '@/features/buildV2/itemCounters';

const STAT_KEYS = [
  ['life', 'builds.vida', 'life', ''],
  ['life_reg', 'builds.regVida', 'life', ''],
  ['mana', 'builds.mana', 'mana', ''],
  ['mana_reg', 'builds.regMana', 'mana', ''],
  ['attack_damage', 'library.danoDeAtaque', 'physical', ''],
  ['attack_speed', 'library.velAtaque', 'speed', '%'],
  ['ability_power', 'library.poderDeHabilidad', 'magic', ''],
  ['armor', 'builds.armadura', 'defense', ''],
  ['magic_res', 'library.resistMagica', 'defense', ''],
  ['flat_movement', 'library.velMov', 'move', ''],
  ['percentage_movement', 'library.velMov2', 'move', '%'],
  ['critical_impact', 'library.tasaDeCriticos', 'crit', '%'],
  ['critical_damage', 'library.danoCritico', 'crit', '%'],
  ['lifesteal', 'library.roboDeVida', 'vamp', '%'],
  ['physic_vamp', 'library.vampFisico', 'vamp', '%'],
  ['magic_vamp', 'library.vampMagico', 'vamp', '%'],
  ['flat_armor_penetration', 'library.penArmadura', 'physical', ''],
  ['percentage_armor_penetration', 'library.penArmadura2', 'physical', '%'],
  ['flat_magic_penetration', 'library.penMagica', 'magic', ''],
  ['percentage_magic_penetration', 'library.penMagica2', 'magic', '%'],
  ['ability_haste', 'library.aceleracionDeHabilidad', 'haste', ''],
  ['tenacity', 'builds.tenacidad', 'life', '%'],
  ['healing_and_shield', 'library.curacionEscudo', 'life', '%'],
];

/** Candidatos a "objetos del mismo tipo": la columna muestra los que entren. */
const MAX_RELATED = 24;
/** Campeones que lo aprovechan (una fila: se ven los que entren según el ancho). */
const MAX_FANS = 12;

const normalizeKey = value => String(value ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '');

/** Objetos de soporte inicial: los mismos que UNIQUE_ITEMS en builds y partidas. */
const SUPPORT_STARTERS = ['escudo reliquia', 'hoz espectral', 'guadaña de niebla oscura', 'baluarte de la montaña'].map(normalizeKey);

export const getItemTypes = value => {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[,/|+&]+|\s+y\s+/i);
  return list.map(type => String(type).trim()).filter(Boolean);
};

/**
 * @param {{
 *   item: object, items: object[], champions: object[],
 *   publicBasePath?: string, onBack: () => void, onSelectItem: (item: object) => void,
 * }} props
 * Pública (`publicBasePath`): volver y los objetos relacionados son enlaces; privada: botones.
 */
export default function ItemDetail({ item, items, champions, publicBasePath, onBack, onSelectItem }) {
  const t = useT();
  const { entityName, entityDescription, compareNames } = useCatalogText();
  const publicMode = Boolean(publicBasePath);
  const lightStyle = useArtLights(item.image_url);
  // Celular: pestañas con dos tarjetas cada una (como la ficha de campeón), todo dentro de la
  // pantalla. La ficha pública se prerenderiza: arranca en escritorio y ajusta al montar.
  const isPhoneLandscape = useMatchMedia(PHONE_LANDSCAPE_QUERY, { ssrSafe: publicMode });
  const isPhonePortrait = useMatchMedia(PHONE_PORTRAIT_QUERY, { ssrSafe: publicMode });
  const usePanels = isPhoneLandscape || isPhonePortrait;
  const [section, setSection] = useState('effects');

  const unifiedLifesteal = usesUnifiedLifesteal(item.patch_version);
  const stats = STAT_KEYS.filter(([key]) => {
    if (unifiedLifesteal && (key === 'physic_vamp' || key === 'magic_vamp')) return false;
    if (!unifiedLifesteal && key === 'lifesteal') return false;
    const value = Number(item[key]);
    return !Number.isNaN(value) && value !== 0;
  });

  const types = getItemTypes(item.type);
  const typeKeys = types.map(normalizeKey);
  const tags = String(item.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const description = entityDescription(item) || '';
  const effects = splitEffects(description);
  // Objetos con misión (soporte): textos de más de 900 caracteres; Efectos toma toda la columna.
  const longText = description.length > 400;
  // Objetos con misión (soporte, más de 900 caracteres): Efectos todavía más ancho y, sin
  // estadísticas, sin la tarjeta de relacionados (no queda alto para ella).
  const veryLongText = description.length > 900;

  // Para quién y contra qué: sus clases (fits_classes) y las señales del rival a las que
  // responde por sus efectos (la misma tabla que usa Build V2).
  // Objetos de soporte inicial (con misión): solo los usa el support. Sus fits_classes dicen
  // para qué tipo de support son (Build V2 elige con eso el inicial), así que van aparte,
  // como "Ideal para supports".
  const supportItem = SUPPORT_STARTERS.includes(normalizeKey(item.name));
  // Botas sin fits_classes cargado: las clases se deducen de lo que dan (inferredItemClasses).
  const loadedClasses = new Set(item.fits_classes || []);
  const fitClasses = supportItem ? new Set(['soporte'])
    : !loadedClasses.size && itemProfile(item)?.boots ? inferredItemClasses(item) : loadedClasses;
  const supportKinds = supportItem ? FIT_CLASSES.filter(cls => cls !== 'soporte' && loadedClasses.has(cls)) : [];
  const counters = itemCounters(item, COUNTER_TAGS);

  const championsByName = new Map(champions.map(champion => [normalizeKey(champion.name), champion]));
  const resolveChampions = values => (Array.isArray(values) ? values : [])
    .map(name => championsByName.get(normalizeKey(name)))
    .filter(Boolean);

  // Objetos que comparten algún tipo, del más parecido al menos: misma categoría, tipos,
  // clases a las que sirve y efectos en común. Se muestran tantos como entren en la columna.
  const relatedCandidates = useMemo(() => {
    const ownClasses = item.fits_classes || [];
    const ownEffects = item.effect_tags || [];
    const shared = (list, own) => (Array.isArray(list) ? list.filter(value => own.includes(value)).length : 0);
    const affinity = other => (other.category === item.category ? 4 : 0)
      + 2 * getItemTypes(other.type).filter(type => typeKeys.includes(normalizeKey(type))).length
      + shared(other.fits_classes, ownClasses)
      + shared(other.effect_tags, ownEffects);
    return items
      .filter(other => other.id !== item.id && other.active !== false)
      .filter(other => getItemTypes(other.type).some(type => typeKeys.includes(normalizeKey(type))))
      .map(other => ({ other, score: affinity(other) }))
      .sort((a, b) => b.score - a.score || compareNames(a.other, b.other))
      .slice(0, MAX_RELATED)
      .map(entry => entry.other);
  }, [item, items, compareNames]);
  // Campeones que lo aprovechan, cómo se contrarresta y tu rendimiento con él.
  const fans = useMemo(() => championsForItem(item, champions, MAX_FANS), [item, champions]);
  const answers = useMemo(() => itemCountersFor(item, items), [item, items]);
  // En escritorio va al pie de la columna de relacionados (con su rótulo); en el celular es
  // una tarjeta propia, con el rótulo como título.
  const answersList = withLabel => answers.length > 0 && (
    <div className="rd-ed-profile-block rd-ed-answers">
      {withLabel && <p className="rd-ed-profile-label">{t('library.contraObjeto.titulo')}</p>}
      {answers.map(group => (
        <div key={group.key} className="rd-ed-answer">
          <p>{t(`library.contraObjeto.${group.key}`)}</p>
          <ItemIconList items={group.items} publicMode={publicMode} nameOf={entityName} onSelect={onSelectItem} />
        </div>
      ))}
    </div>
  );
  const answersBlock = answersList(true);
  const matches = usePersonalMatches(publicMode);
  const usage = useMemo(() => (publicMode ? null : personalUsage(matches, item.name, 'items_used')), [publicMode, matches, item.name]);

  const relatedListRef = useRef(null);
  // La pestaña del celular se conoce más abajo; con `section` alcanza para volver a medir
  // cuando la lista se monta al cambiar de pestaña.
  const related = relatedCandidates.slice(0, useFitCount(relatedListRef, relatedCandidates.length, 8, [section, usePanels]));

  const icon = (src, size) => (src
    ? <img src={src} alt="" width={size} height={size} />
    : <Sword size={Math.round(size / 2.5)} aria-hidden="true" />);

  // En escritorio la tarjeta de la derecha no va con texto muy largo y sin estadísticas (no
  // queda alto).
  const showRelatedCard = !(veryLongText && !stats.length);
  // Celular: de a dos tarjetas por pestaña (efectos con estadísticas, perfil con cómo se
  // contrarresta, enfrentamientos con tu rendimiento). Sin rendimiento (ficha pública, u
  // objeto que no usaste), enfrentamientos va con los objetos del mismo tipo; si no, esos
  // tienen su pestaña. Una tarjeta sola en su pestaña ocupa todo el alto.
  const phonePanel = {
    effects: 'effects', stats: 'effects', profile: 'profile', answers: 'profile',
    matchups: 'matchups', usage: 'matchups', related: usage ? 'related' : 'matchups',
  };
  // Objetos con misión (más de 900 caracteres, sin estadísticas): ni con la letra más chica
  // entran; los efectos se reparten en dos pestañas, cortando donde quedan más parejas.
  const effectsSplit = usePanels && veryLongText ? effectsSplitIndex(effects) : 0;
  const shownEffects = effectsSplit
    ? (activePanelId => (activePanelId === 'effectsMore' ? effects.slice(effectsSplit) : effects.slice(0, effectsSplit)))
    : () => effects;
  const panelTabs = [
    ['effects', t('library.efectos')],
    ...(effectsSplit ? [['effectsMore', t('library.masEfectos')]] : []),
    ['profile', t('bugReport.pages.Perfil')],
    ['matchups', t('library.enfrentamientos')],
    ...(usage && related.length > 0 ? [['related', t('library.relacionados')]] : []),
  ];
  const activePanel = panelTabs.some(([id]) => id === section) ? section : 'effects';
  const show = id => !usePanels || phonePanel[id] === activePanel;
  // Celular: la letra de los efectos se ajusta a su extensión y llena el espacio de la tarjeta.
  const effectsRef = useRef(null);
  // Si ni con la letra más chica entran en su mitad, las estadísticas se achican a lo que
  // ocupan y le dejan el resto a los efectos (data-effects="tight"). Queda así hasta cambiar
  // de objeto: si volviera atrás al agrandarse la caja, se realimentaría.
  const [tightEffects, setTightEffects] = useState(null);
  useFitText(effectsRef, {
    enabled: usePanels,
    min: tightEffects === item.id ? 9 : 10,
    max: 16,
    deps: [activePanel, description],
    onOverflow: () => setTightEffects(item.id),
  });

  return (
    <article className="rd-cd rd-ed" data-panels={usePanels ? 'on' : 'off'} data-kind="item" data-length={longText ? "long" : "normal"} data-text={veryLongText ? "xlong" : undefined} data-stats={stats.length ? "yes" : "none"} data-effects={tightEffects === item.id ? 'tight' : undefined} style={lightStyle}>
      <header className="rd-cd-hero rd-ed-hero">
        {item.image_url && <img className="rd-ed-hero-glow" src={item.image_url} alt="" aria-hidden="true" />}
        <div className="rd-cd-hero-shade" aria-hidden="true" />

        {publicMode ? (
          <Link to={publicBasePath} className="rd-cd-back">
            <ArrowLeft size={14} aria-hidden="true" /> {t('library.volverAObjetos')}
          </Link>
        ) : (
          <button type="button" onClick={onBack} className="rd-cd-back">
            <ArrowLeft size={14} aria-hidden="true" /> {t('library.volverAObjetos')}
          </button>
        )}

        <div className="rd-cd-hero-main">
          <div className="rd-ed-identity">
            <span className="rd-ed-icon">{icon(item.image_url, 96)}</span>
            <div className="rd-cd-identity">
              {item.category && <p className="rd-cd-role">{itemCategoryLabel(item.category)}</p>}
              <h1 className="rd-cd-name rd-ed-name">{entityName(item)}</h1>
              {types.length > 0 && (
                <ul className="rd-cd-chips">
                  {types.map(type => <li key={type} className="rd-cd-chip">{itemTypeLabel(type)}</li>)}
                </ul>
              )}
            </div>
          </div>

          {item.price ? (
            <div className="rd-cd-hero-meta rd-ed-price">
              <Coins size={22} aria-hidden="true" />
              <div>
                <p className="rd-cd-hero-meta-label">{t('library.precio')}</p>
                <p className="rd-ed-price-value">{item.price} <span>{t('builds.oro')}</span></p>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {usePanels && (
        <div className="rd-panel-tabs rd-cd-tabs" role="tablist" aria-label={t('library.seccionesDelObjeto')}>
          {panelTabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={activePanel === id} onClick={() => setSection(id)} className={`rd-panel-tab ${activePanel === id ? 'rd-panel-tab-active' : ''}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="rd-cd-grid">
        {(show('effects') || (effectsSplit > 0 && activePanel === 'effectsMore')) && (
        <section className="rd-cd-card rd-ed-effects">
          <CardTitle>{t('library.efectos')}</CardTitle>
          {effects.length ? (
            <ul ref={effectsRef} className="rd-ed-effect-list">
              {shownEffects(activePanel).map((effect, index) => (
                <li key={index} data-labeled={effect.label ? 'yes' : 'no'}>
                  {effect.label && <strong>{effect.label}</strong>}
                  <span>{effect.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rd-cd-empty">{t('library.sinDescripcion')}</p>
          )}
          {tags.length > 0 && !(effectsSplit > 0 && activePanel === 'effects') && (
            <ul className="rd-cd-tags">
              {tags.map(tag => <li key={tag}>{tag}</li>)}
            </ul>
          )}
        </section>
        )}

        {stats.length > 0 && show('stats') && (
        <section className="rd-cd-card rd-ed-stats">
          <CardTitle>{usePanels ? t('nav.stats') : t('library.estadisticasDelObjeto')}</CardTitle>
            <dl className="rd-ed-stat-list" data-many={stats.length > 3 ? 'yes' : undefined}>
              {stats.map(([key, label, tone, unit]) => (
                <div key={key} className="rd-ed-stat" data-tone={tone}>
                  <dt title={t(label)}>{t(label)}</dt>
                  <dd>+{item[key]}{unit}</dd>
                </div>
              ))}
            </dl>
        </section>
        )}

        {show('profile') && (
        <section className="rd-cd-card rd-ed-profile">
          <CardTitle>{t('library.runePerfil.titulo')}</CardTitle>
          {fitClasses.size > 0 && (
            <div className="rd-ed-profile-block">
              <p className="rd-ed-profile-label">{t('library.itemPerfil.leSirveA')}</p>
              <ul className="rd-ed-classes">
                {FIT_CLASSES.map(cls => (
                  <li key={cls} data-fit={fitClasses.has(cls) ? 'yes' : 'no'}>{t(`library.${cls}`)}</li>
                ))}
              </ul>
            </div>
          )}
          {supportKinds.length > 0 && (
            <div className="rd-ed-profile-block">
              <p className="rd-ed-profile-label">{t('library.itemPerfil.idealSupports')}</p>
              <ul className="rd-ed-tags" data-kind="benefit">
                {supportKinds.map(cls => <li key={cls}>{t(`library.${cls}`)}</li>)}
              </ul>
            </div>
          )}
          <div className="rd-ed-profile-block">
            <p className="rd-ed-profile-label">{t('library.runePerfil.rindeContra')}</p>
            <ul className="rd-ed-tags" data-kind="counter">
              {counters.length > 0 ? counters.map(tag => (
                <li key={tag} title={t(`library.runePerfil.counters.${tag}.texto`)}>{t(`library.runePerfil.counters.${tag}.nombre`)}</li>
              )) : (
                <li title={t('library.runePerfil.cualquierRival.texto')}>{t('library.runePerfil.cualquierRival.nombre')}</li>
              )}
            </ul>
          </div>
          {fans.length > 0 && (
            <FillSpace>
              <div className="rd-ed-profile-block rd-ed-fans">
                <p className="rd-ed-profile-label">{t('library.campeonesQueLoAprovechan')}</p>
                <FaceList champions={fans} publicMode={publicMode} />
              </div>
            </FillSpace>
          )}
        </section>
        )}

        {show('matchups') && (
        <section className="rd-cd-card rd-cd-matchups rd-ed-matchups">
          <CardTitle>{t('library.enfrentamientos')}</CardTitle>
          <MatchupRow icon={CheckCircle2} tone="green" label={t('library.recomendadoVs')} champions={resolveChampions(item.good_against)} publicMode={publicMode} emptyLabel={t('library.sinDatos')} />
          <MatchupRow icon={Ban} tone="red" label={t('library.evitarVs')} champions={resolveChampions(item.avoid_against)} publicMode={publicMode} emptyLabel={t('library.sinDatos')} />
        </section>
        )}

        {/* Celular: cómo se contrarresta y tu rendimiento, cada uno en su tarjeta. */}
        {usePanels && answers.length > 0 && show('answers') && (
          <section className="rd-cd-card rd-ed-answers-card">
            <CardTitle>{t('library.contraObjeto.titulo')}</CardTitle>
            {answersList(false)}
          </section>
        )}

        {usePanels && usage && show('usage') && (
          <section className="rd-cd-card rd-ed-usage-card">
            <CardTitle>{t('library.rendimiento')}</CardTitle>
            <div className="rd-ed-foot"><PersonalUsageBlock usage={usage} champions={champions} /></div>
          </section>
        )}

        {/* Columna de la derecha: objetos del mismo tipo (tantos como entren), cómo se
            contrarresta y tu rendimiento. Es la que absorbe el alto: lo nuevo nunca agranda
            las filas de las otras tarjetas. En el celular va solo la lista (lo demás tiene su
            tarjeta). */}
        {(usePanels ? related.length > 0 && show('related') : showRelatedCard && (related.length > 0 || answersBlock || usage)) && (
          <section className="rd-cd-card rd-ed-related">
            {related.length > 0 && <CardTitle>{t('library.objetosDelMismoTipo')}</CardTitle>}
            {related.length > 0 && (
            <ul ref={relatedListRef} className="rd-cd-related-list rd-ed-related-list">
              {related.map(other => {
                const content = (
                  <>
                    <span className="rd-ed-related-icon">{icon(other.image_url, 40)}</span>
                    <h3>{entityName(other)}</h3>
                  </>
                );
                return (
                  <li key={other.id}>
                    {publicMode ? (
                      <Link to={`${publicBasePath}/${entitySlug(other.name)}`} className="rd-cd-related-item" title={entityName(other)}>{content}</Link>
                    ) : (
                      <button type="button" onClick={() => onSelectItem(other)} className="rd-cd-related-item" title={entityName(other)}>{content}</button>
                    )}
                  </li>
                );
              })}
            </ul>
            )}
            {!usePanels && answersBlock}
            {!usePanels && usage && <div className="rd-ed-foot"><PersonalUsageBlock usage={usage} champions={champions} /></div>}
          </section>
        )}
      </div>
    </article>
  );
}
