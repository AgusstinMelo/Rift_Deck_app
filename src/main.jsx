import React from 'react'
import ReactDOM, { hydrateRoot } from 'react-dom/client'
import App from '@/App.jsx'
import { preparePublicRoutes } from '@/components/public/publicRoutesLoader'
import { detectAndroidApp } from '@/lib/googlePlayBilling'
import '@fontsource-variable/inter'
import '@fontsource-variable/unbounded'
import '@/index.css'

// Antes que nada: la marca de la app de Android (?source=android-app) se lee y se limpia de la URL.
detectAndroidApp();

const root = document.getElementById('root');
const app = <App />;

// Vercel sirve todas las rutas de la app con index.html, que es el prerender de la home.
// Solo las páginas públicas (la home y la biblioteca) se hidratan sobre ese HTML; el resto
// (/stats, /matches, /login...) se dibuja de cero: hidratar la home ahí no coincide nunca.
const PUBLIC_PAGE = /^\/(campeones|objetos|runas)(\/|$)/;
const isPublicPage = window.location.pathname === '/' || PUBLIC_PAGE.test(window.location.pathname);

// Service worker: solo muestra una página "sin conexión" (ver public/sw.js). En desarrollo no,
// para no interferir con el servidor de Vite.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

if (root.dataset.prerendered === 'true' && isPublicPage) {
  // Antes de hidratar, el código de las páginas públicas tiene que estar cargado. Mientras
  // tanto se ve el HTML prerenderizado.
  preparePublicRoutes().then(() => hydrateRoot(root, app));
} else {
  ReactDOM.createRoot(root).render(app);
}
