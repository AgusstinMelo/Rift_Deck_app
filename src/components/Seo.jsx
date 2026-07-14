import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LANDING_SEO, SITE_URL, SOCIAL_IMAGE } from '@/seo/publicSeo';


const setMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
};

const setLink = (rel, href) => {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
};

export default function Seo({
  isAuthenticated,
  title: titleOverride,
  description: descriptionOverride,
  canonicalPath,
  image = SOCIAL_IMAGE,
  imageAlt = 'Rift Deck, plataforma de análisis para Wild Rift',
  indexable,
}) {
  const { pathname } = useLocation();
  const isPublicLanding = pathname === '/' && !isAuthenticated;
  const shouldIndex = indexable ?? isPublicLanding;
  const resolvedPath = canonicalPath ?? (isPublicLanding ? '/' : pathname);
  const canonicalUrl = `${SITE_URL}${resolvedPath === '/' ? '/' : resolvedPath}`;
  const title = titleOverride || (isPublicLanding ? LANDING_SEO.title : `Rift Deck | Área personal de Wild Rift`);
  const description = descriptionOverride || (isPublicLanding
    ? LANDING_SEO.description
    : 'Área personal de Rift Deck para analizar partidas y rendimiento en Wild Rift.');
  const socialImage = image?.startsWith('http') ? image : `${SITE_URL}${image}`;

  useEffect(() => {
    document.title = title;
    document.documentElement.lang = 'es-AR';
    setLink('canonical', canonicalUrl);
    setMeta('meta[name="description"]', { name: 'description', content: description });
    setMeta('meta[name="robots"]', {
      name: 'robots',
      content: shouldIndex ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: imageAlt });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage });
  }, [canonicalUrl, description, imageAlt, shouldIndex, socialImage, title]);

  return null;
}
