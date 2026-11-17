import React from 'react'
import ReactDOM, { hydrateRoot } from 'react-dom/client'
import App from '@/App.jsx'
import { preparePublicRoutes } from '@/components/public/publicRoutesLoader'
import '@fontsource-variable/inter'
import '@fontsource-variable/unbounded'
import '@/index.css'

const root = document.getElementById('root');
const app = <App />;

// Vercel sirve todas las rutas de la app con index.html, que es el prerender de la home.
// Solo las páginas públicas (la home y la biblioteca) se hidratan sobre ese HTML; el resto
// (/stats, /matches, /login...) se dibuja de cero: hidratar la home ahí no coincide nunca.
const PUBLIC_PAGE = /^\/(campeones|objetos|runas)(\/|$)/;
const isPublicPage = window.location.pathname === '/' || PUBLIC_PAGE.test(window.location.pathname);

if (root.dataset.prerendered === 'true' && isPublicPage) {
  // Antes de hidratar, el código de las páginas públicas tiene que estar cargado. Mientras
  // tanto se ve el HTML prerenderizado.
  preparePublicRoutes().then(() => hydrateRoot(root, app));
} else {
  ReactDOM.createRoot(root).render(app);
}
