// Service worker de Rift Deck. A propósito NO cachea la app: cada deploy se ve al instante,
// como en la web. Solo responde con una página "sin conexión" cuando una navegación falla por
// falta de red (la app de Android, una TWA, lo necesita para funcionar offline).
//
// La página se arma acá mismo (sin offline.html): con cleanUrls, Vercel redirige *.html y una
// respuesta redirigida no sirve para una navegación.

const MESSAGES = {
  es: { title: 'Sin conexión', body: 'Rift Deck necesita internet para cargar tus partidas y estadísticas. Revisá tu conexión e intentá de nuevo.', retry: 'Reintentar' },
  'es-ES': { title: 'Sin conexión', body: 'Rift Deck necesita internet para cargar tus partidas y estadísticas. Revisa tu conexión e inténtalo de nuevo.', retry: 'Reintentar' },
  pt: { title: 'Sem conexão', body: 'O Rift Deck precisa de internet para carregar suas partidas e estatísticas. Verifique sua conexão e tente novamente.', retry: 'Tentar novamente' },
  en: { title: 'You are offline', body: 'Rift Deck needs an internet connection to load your matches and stats. Check your connection and try again.', retry: 'Try again' },
};

const pickMessages = () => {
  const language = (self.navigator.language || 'es').toLowerCase();
  if (language === 'es-es') return MESSAGES['es-ES'];
  return MESSAGES[language.slice(0, 2)] || MESSAGES.es;
};

const offlinePage = () => {
  const text = pickMessages();
  const html = `<!doctype html>
<html lang="${(self.navigator.language || 'es').slice(0, 2)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#09090b">
<title>Rift Deck · ${text.title}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    background: #0c0e12; color: #f4f4f5; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center; }
  main { max-width: 360px; }
  img { width: 72px; height: 72px; border-radius: 18px; }
  h1 { margin: 20px 0 8px; font-size: 22px; letter-spacing: .02em; text-transform: uppercase; color: #d4af37; }
  p { margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #a1a1aa; }
  button { border: 0; border-radius: 12px; padding: 12px 22px; font-size: 15px; font-weight: 600; background: #d4af37; color: #09090b; cursor: pointer; }
</style>
</head>
<body>
<main>
  <img src="/riftdeck-icon-192.png?v=3" alt="Rift Deck" onerror="this.remove()">
  <h1>${text.title}</h1>
  <p>${text.body}</p>
  <button type="button" onclick="location.reload()">${text.retry}</button>
</main>
</body>
</html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
};

const ICON_CACHE = 'rd-offline-v1';
const ICON_URL = '/riftdeck-icon-192.png?v=3';

self.addEventListener('install', event => {
  // El ícono de la página offline; si falla, la página igual funciona sin él.
  event.waitUntil(caches.open(ICON_CACHE).then(cache => cache.add(ICON_URL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('rd-') && name !== ICON_CACHE).map(name => caches.delete(name)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return (await event.preloadResponse) || (await fetch(request));
      } catch {
        return offlinePage();
      }
    })());
    return;
  }

  // Ícono de la página offline: desde la caché si no hay red.
  if (request.method === 'GET' && new URL(request.url).pathname === '/riftdeck-icon-192.png') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(ICON_URL)) || Response.error()));
  }
});
