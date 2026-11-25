// En el navegador y en el build de Vite llega por import.meta.env; en los scripts de Node (sitemap, prerender), por process.env.
const envSiteUrl = import.meta.env?.VITE_SITE_URL
  || (typeof process !== 'undefined' ? process.env.VITE_SITE_URL : undefined);
export const SITE_URL = (envSiteUrl || 'https://www.riftdeckapp.com').replace(/\/+$/, '');
export const SOCIAL_IMAGE = `${SITE_URL}/riftdeck-final.png`;

export const LANDING_SEO = {
  title: 'Rift Deck | Builds, estadísticas y meta de Wild Rift',
  description: 'Analiza tus partidas de Wild Rift, consulta builds, campeones, tier lists, estadísticas y el meta actual para tomar mejores decisiones.',
  canonicalPath: '/',
  image: SOCIAL_IMAGE,
  imageAlt: 'Rift Deck, plataforma de análisis para Wild Rift',
};

export const CHAMPIONS_SEO = {
  title: 'Campeones de Wild Rift | Estadísticas y datos | Rift Deck',
  description: 'Consulta los campeones de Wild Rift, sus roles, líneas y estadísticas base disponibles en Rift Deck.',
  canonicalPath: '/campeones',
  image: SOCIAL_IMAGE,
  imageAlt: 'Campeones de Wild Rift disponibles en Rift Deck',
};

export const ITEMS_SEO = {
  title: 'Objetos de Wild Rift | Estadísticas y efectos | Rift Deck',
  description: 'Consulta los objetos de Wild Rift, sus estadísticas, efectos, precios y características disponibles en Rift Deck.',
  canonicalPath: '/objetos', image: SOCIAL_IMAGE,
  imageAlt: 'Objetos de Wild Rift disponibles en Rift Deck',
};

export const RUNES_SEO = {
  title: 'Runas de Wild Rift | Efectos y características | Rift Deck',
  description: 'Consulta las runas de Wild Rift, sus ramas, efectos y características disponibles en Rift Deck.',
  canonicalPath: '/runas', image: SOCIAL_IMAGE,
  imageAlt: 'Runas de Wild Rift disponibles en Rift Deck',
};

// Convocatoria de testers para la prueba cerrada de Google Play (se comparte por WhatsApp y
// redes: la imagen es la de la invitación).
export const TESTERS_SEO = {
  title: 'Sumate como tester de Rift Deck | 1 año de Premium gratis',
  description: 'Probá la app de Android de Rift Deck antes que nadie: unite a la prueba cerrada en 3 pasos y llevate 1 año de Premium gratis.',
  canonicalPath: '/testers',
  image: `${SITE_URL}/testers-og.jpg`,
  imageAlt: 'Rift Deck busca testers para su app de Android',
};

// Páginas legales públicas (las enlaza la ficha de Google Play). El texto queda en español,
// como el cuerpo de los documentos.
const LEGAL_SEO = {
  legal: { path: '/aviso-legal', title: 'Aviso legal', description: 'Datos del titular de Rift Deck e información legal del sitio.' },
  terms: { path: '/terminos', title: 'Términos y condiciones', description: 'Condiciones de uso de Rift Deck, la membresía premium, su renovación y cancelación.' },
  privacy: { path: '/privacidad', title: 'Política de privacidad', description: 'Qué datos trata Rift Deck, para qué, con quién se comparten y cómo ejercer tus derechos.' },
  cookies: { path: '/cookies', title: 'Política de cookies', description: 'El almacenamiento técnico que usa Rift Deck y el contenido de terceros.' },
  deletion: { path: '/eliminar-cuenta', title: 'Eliminar tu cuenta', description: 'Cómo eliminar tu cuenta de Rift Deck desde la web, la app o por correo, y qué datos se borran.' },
};

export const LEGAL_PATHS = Object.values(LEGAL_SEO).map(page => page.path);

export const getLegalSeo = type => {
  const page = LEGAL_SEO[type];
  return {
    title: `${page.title} | Rift Deck`,
    description: page.description,
    canonicalPath: page.path,
    image: SOCIAL_IMAGE,
    imageAlt: 'Rift Deck, plataforma de análisis para Wild Rift',
  };
};

export const getLegalSeoByPath = pathname => {
  const type = Object.keys(LEGAL_SEO).find(key => LEGAL_SEO[key].path === pathname);
  return type ? getLegalSeo(type) : null;
};

export const getItemSeo = (item, slug) => ({
  title: `${item.name} Wild Rift | Estadísticas y efectos | Rift Deck`,
  description: [
    `Consulta ${item.name} en Wild Rift`,
    item.price ? `su precio de ${item.price} de oro` : '',
    item.category ? `su categoría ${item.category}` : '',
    item.description ? item.description.replace(/\\n/g, ' ').replace(/[*_#]/g, '').trim() : '',
  ].filter(Boolean).join(', ').slice(0, 300) + '.',
  canonicalPath: `/objetos/${slug}`,
  image: item.image_url || SOCIAL_IMAGE,
  imageAlt: `${item.name} en Wild Rift`,
});

export const getRuneSeo = (rune, slug) => ({
  title: `${rune.name} Wild Rift | Efecto y características | Rift Deck`,
  description: [
    `Consulta ${rune.name} en Wild Rift`,
    rune.branch ? `su rama ${rune.branch}` : '',
    rune.description || '',
  ].filter(Boolean).join(', ').slice(0, 300) + '.',
  canonicalPath: `/runas/${slug}`,
  image: rune.image_url || SOCIAL_IMAGE,
  imageAlt: `${rune.name} en Wild Rift`,
});

export const getChampionSeo = (champion, slug, laneLabels, displayList, damageLabels) => {
  const parts = [`Consulta las estadísticas base de ${champion.name} en Wild Rift`];
  if (champion.roles) parts.push(`su rol de ${champion.roles.toLowerCase()}`);
  if (laneLabels.length) parts.push(`sus líneas ${displayList(laneLabels)}`);
  if (champion.damage_type) parts.push(`su perfil de ${damageLabels[champion.damage_type]?.toLowerCase() || champion.damage_type}`);
  if (champion.strategic_notes) parts.push('y sus datos estratégicos disponibles');
  return {
    title: `${champion.name} Wild Rift | Estadísticas, rol y datos | Rift Deck`,
    description: `${parts.join(', ')}.`,
    canonicalPath: `/campeones/${slug}`,
    image: champion.image_url_card || champion.image_url || SOCIAL_IMAGE,
    imageAlt: `${champion.name} en Wild Rift`,
  };
};
