// Ficha de runa, con el mismo lenguaje que la de campeón (styles/16-library.css): héroe con
// el ícono y las luces de su rama, la descripción y el árbol completo de la rama con la runa
// resaltada (cada runa del árbol lleva a su ficha). La tarjeta "Para quién y contra qué"
// explica fits_classes y counters del catálogo (los mismos datos que usan el Coach y Build V2).
import { ArrowLeft, Flame, Gem, Shield, Sparkles, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { entitySlug } from '@/utils/entitySlug';
import { useCatalogText, useT } from '@/lib/LocaleContext';
import { runeBranchLabel } from '@/utils/runeBranches';
import { CardTitle, splitEffects } from '@/components/library/detailParts';
import { COUNTER_TAGS, FIT_CLASSES, RUNE_BENEFIT_TAGS, RUNE_TRIGGER_TAGS } from '@/features/coach/taxonomy';

export const BRANCH_ICONS = {
  Clave: Sparkles,
  Precisión: Gem,
  Dominación: Flame,
  Valor: Shield,
  Brujería: Wand2,
};

// Luces de cada rama (RGB): el color de la rama y uno de acompañamiento.
const BRANCH_LIGHTS = {
  Clave: [[234, 179, 8], [212, 175, 55]],
  Precisión: [[59, 130, 246], [212, 175, 55]],
  Dominación: [[239, 68, 68], [124, 58, 237]],
  Valor: [[34, 197, 94], [212, 175, 55]],
  Brujería: [[168, 85, 247], [59, 130, 246]],
};

/**
 * @param {{
 *   rune: object, runes: object[], publicBasePath?: string,
 *   onBack: () => void, onSelectRune: (rune: object) => void,
 * }} props
 */
export default function RuneDetail({ rune, runes, publicBasePath, onBack, onSelectRune }) {
  const t = useT();
  const { entityName, entityDescription, compareNames } = useCatalogText();
  const publicMode = Boolean(publicBasePath);
  const BranchIcon = BRANCH_ICONS[rune.branch] || Gem;
  const lights = BRANCH_LIGHTS[rune.branch];
  const lightStyle = {
    ...(rune.image_url ? { '--rd-ed-art': `url(${JSON.stringify(rune.image_url)})` } : {}),
    ...(lights ? {
      '--rd-cd-light-a': lights[0].join(', '),
      '--rd-cd-light-b': lights[1].join(', '),
    } : {}),
  };

  const fitClasses = new Set(rune.fits_classes || []);
  // Solo los valores conocidos (la lista cerrada del Coach), en su orden.
  const counters = COUNTER_TAGS.filter(tag => (rune.counters || []).includes(tag));
  // Qué da y qué la activa: todas las runas los tienen (las que no responden a nada del
  // rival igual tienen un propósito).
  const benefits = RUNE_BENEFIT_TAGS.filter(tag => (rune.benefit_tags || []).includes(tag));
  const triggers = RUNE_TRIGGER_TAGS.filter(tag => (rune.trigger_tags || []).includes(tag));
  const hasProfile = fitClasses.size > 0 || counters.length > 0 || benefits.length > 0 || triggers.length > 0;

  const description = entityDescription(rune) || '';
  const effects = splitEffects(description);
  const isKeystone = rune.branch === 'Clave';
  const rowLabel = group => (isKeystone ? t('library.runasClave') : t('library.filaRunas', { n: group }));

  // Árbol de la rama: una fila por grupo (las claves son una sola fila).
  const rows = Object.entries(
    runes
      .filter(other => other.branch === rune.branch)
      .reduce((acc, other) => {
        const group = Number(other.group || 1);
        (acc[group] ||= []).push(other);
        return acc;
      }, {})
  )
    .map(([group, list]) => [Number(group), [...list].sort(compareNames)])
    .sort(([a], [b]) => a - b);

  return (
    <article className="rd-cd rd-ed" data-kind="rune" data-length={description.length > 550 ? "long" : "normal"} data-branch={rune.branch || undefined} style={lightStyle}>
      <header className="rd-cd-hero rd-ed-hero">
        {rune.image_url && <img className="rd-ed-hero-glow" src={rune.image_url} alt="" aria-hidden="true" />}
        <div className="rd-cd-hero-shade" aria-hidden="true" />

        {publicMode ? (
          <Link to={publicBasePath} className="rd-cd-back">
            <ArrowLeft size={14} aria-hidden="true" /> {t('library.volverARunas')}
          </Link>
        ) : (
          <button type="button" onClick={onBack} className="rd-cd-back">
            <ArrowLeft size={14} aria-hidden="true" /> {t('library.volverARunas')}
          </button>
        )}

        <div className="rd-cd-hero-main">
          <div className="rd-ed-identity">
            <span className="rd-ed-icon rd-ed-icon-round">
              {rune.image_url
                ? <img src={rune.image_url} alt="" width="96" height="96" />
                : <BranchIcon size={38} aria-hidden="true" />}
            </span>
            <div className="rd-cd-identity">
              {rune.branch && <p className="rd-cd-role">{runeBranchLabel(rune.branch)}</p>}
              <h1 className="rd-cd-name rd-ed-name">{entityName(rune)}</h1>
              <ul className="rd-cd-chips">
                <li className="rd-cd-chip rd-ed-branch-chip"><BranchIcon size={13} aria-hidden="true" /> {runeBranchLabel(rune.branch)}</li>
                <li className="rd-cd-chip">{rowLabel(Number(rune.group || 1))}</li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <div className="rd-cd-grid">
        <section className="rd-cd-card rd-ed-effects">
          <CardTitle>{t('library.descripcion')}</CardTitle>
          {effects.length ? (
            <ul className="rd-ed-effect-list">
              {effects.map((effect, index) => (
                <li key={index} data-labeled={effect.label ? 'yes' : 'no'}>
                  {effect.label && <strong>{effect.label}</strong>}
                  <span>{effect.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rd-cd-empty">{t('library.sinDescripcion')}</p>
          )}
        </section>

        {hasProfile && (
          <section className="rd-cd-card rd-ed-profile">
            <CardTitle>{t('library.runePerfil.titulo')}</CardTitle>
            {fitClasses.size > 0 && (
              <div className="rd-ed-profile-block">
                <p className="rd-ed-profile-label">{t('library.runePerfil.leSirveA')}</p>
                <ul className="rd-ed-classes">
                  {FIT_CLASSES.map(cls => (
                    <li key={cls} data-fit={fitClasses.has(cls) ? 'yes' : 'no'}>{t(`library.${cls}`)}</li>
                  ))}
                </ul>
              </div>
            )}
            {benefits.length > 0 && (
              <div className="rd-ed-profile-block">
                <p className="rd-ed-profile-label">{t('library.runePerfil.teDa')}</p>
                <ul className="rd-ed-tags" data-kind="benefit">
                  {benefits.map(tag => <li key={tag}>{t(`library.runePerfil.beneficios.${tag}`)}</li>)}
                </ul>
              </div>
            )}
            {triggers.length > 0 && (
              <div className="rd-ed-profile-block">
                <p className="rd-ed-profile-label">{t('library.runePerfil.seActiva')}</p>
                <ul className="rd-ed-tags" data-kind="trigger">
                  {triggers.map(tag => <li key={tag}>{t(`library.runePerfil.activadores.${tag}`)}</li>)}
                </ul>
              </div>
            )}
            <div className="rd-ed-profile-block">
              <p className="rd-ed-profile-label">{t('library.runePerfil.rindeContra')}</p>
              <ul className="rd-ed-counters">
                {counters.length > 0 ? counters.map(tag => (
                  <li key={tag}>
                    <strong>{t(`library.runePerfil.counters.${tag}.nombre`)}</strong>
                    <span>{t(`library.runePerfil.counters.${tag}.texto`)}</span>
                  </li>
                )) : (
                  // Sin counters del catálogo: rinde contra cualquier equipo, por lo que le da a tu campeón.
                  <li>
                    <strong>{t('library.runePerfil.cualquierRival.nombre')}</strong>
                    <span>{t('library.runePerfil.cualquierRival.texto')}</span>
                  </li>
                )}
              </ul>
            </div>
          </section>
        )}

        <section className="rd-cd-card rd-ed-tree">
          <CardTitle>{t('library.runasDeLaMisma')}</CardTitle>
          <div className="rd-ed-tree-rows" data-keystone={isKeystone ? 'yes' : 'no'}>
            {rows.map(([group, list]) => (
              <div key={group} className="rd-ed-tree-row">
                <p className="rd-ed-tree-label">{rowLabel(group)}</p>
                <ul>
                  {list.map(other => {
                    const current = other.id === rune.id;
                    const content = (
                      <>
                        {other.image_url
                          ? <img src={other.image_url} alt="" width="48" height="48" loading="lazy" />
                          : <span className="rd-ed-tree-fallback"><BranchIcon size={16} aria-hidden="true" /></span>}
                        <span className="rd-ed-tree-name">{entityName(other)}</span>
                      </>
                    );
                    return (
                      <li key={other.id}>
                        {current ? (
                          <span className="rd-ed-tree-node" aria-current="true">{content}</span>
                        ) : publicMode ? (
                          <Link to={`${publicBasePath}/${entitySlug(other.name)}`} className="rd-ed-tree-node">{content}</Link>
                        ) : (
                          <button type="button" onClick={() => onSelectRune(other)} className="rd-ed-tree-node">{content}</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
