export const SITE_URL = 'https://riftdeck.com.ar';
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
