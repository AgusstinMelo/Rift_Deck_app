import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { championSlug, findChampionBySlug } from '../src/utils/championSlug.js';
import { entitySlug, findEntityBySlug } from '../src/utils/entitySlug.js';
import { DAMAGE_LABELS, displayList, getChampionLaneLabels } from '../src/utils/championPresentation.js';
import { CHAMPIONS_SEO, ITEMS_SEO, LANDING_SEO, RUNES_SEO, SITE_URL, getChampionSeo, getItemSeo, getRuneSeo } from '../src/seo/publicSeo.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

const renderHead = seo => {
  const canonicalUrl = `${SITE_URL}${seo.canonicalPath === '/' ? '/' : seo.canonicalPath}`;
  return `
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="${escapeHtml(seo.image)}" />
    <meta property="og:image:alt" content="${escapeHtml(seo.imageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(seo.image)}" />`;
};

const template = await readFile(resolve('dist/index.html'), 'utf8');
const publicData = JSON.parse(await readFile(resolve('.prerender/public-data.json'), 'utf8'));
const { champions, items, runes, executions, tierlist } = publicData;
const { renderPublicRoute } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href);
const paths = ['/', '/campeones', ...champions.map(champion => `/campeones/${championSlug(champion.name)}`), '/objetos', ...items.map(item => `/objetos/${entitySlug(item.name)}`), '/runas', ...runes.map(rune => `/runas/${entitySlug(rune.name)}`)];

for (const pathname of paths) {
  const champion = pathname.startsWith('/campeones/')
    ? findChampionBySlug(champions, pathname.split('/').pop())
    : null;
  if (pathname.startsWith('/campeones/') && !champion) throw new Error(`No se encontró champion para ${pathname}.`);
  const item = pathname.startsWith('/objetos/') ? findEntityBySlug(items, pathname.split('/').pop()) : null;
  const rune = pathname.startsWith('/runas/') ? findEntityBySlug(runes, pathname.split('/').pop()) : null;
  if (pathname.startsWith('/objetos/') && !item) throw new Error(`No se encontró objeto para ${pathname}.`);
  if (pathname.startsWith('/runas/') && !rune) throw new Error(`No se encontró runa para ${pathname}.`);

  const seo = pathname === '/'
    ? LANDING_SEO
    : pathname === '/campeones'
      ? CHAMPIONS_SEO
      : pathname === '/objetos' ? ITEMS_SEO
        : pathname === '/runas' ? RUNES_SEO
          : item ? getItemSeo(item, entitySlug(item.name))
            : rune ? getRuneSeo(rune, entitySlug(rune.name))
              : getChampionSeo(champion, championSlug(champion.name), getChampionLaneLabels(champion), displayList, DAMAGE_LABELS);
  const routeData = pathname === '/' ? undefined
    : pathname.startsWith('/objetos') ? { items }
      : pathname.startsWith('/runas') ? { runes }
        : { champions, executions, tierlist };
  const markup = renderPublicRoute(pathname, routeData);
  if (!markup.includes('<h1')) throw new Error(`El prerender de ${pathname} no contiene H1.`);

  const serializedData = routeData
    ? `<script>window.__RIFTDECK_PUBLIC_DATA__=${JSON.stringify(routeData).replace(/</g, '\\u003c')}</script>`
    : '';
  const html = template
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta name="robots"[^>]*>/, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `${renderHead(seo)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${markup}</div>${serializedData}`);

  const output = pathname === '/' ? resolve('dist/index.html') : resolve(`dist${pathname}.html`);
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, html, 'utf8');
}

await rm(resolve('dist-ssr'), { recursive: true, force: true });
console.log(`Prerender completado: ${paths.length} páginas públicas.`);
