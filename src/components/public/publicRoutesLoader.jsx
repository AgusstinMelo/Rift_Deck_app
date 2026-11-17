// Las páginas públicas (home y biblioteca de campeones, objetos y runas) van en su propio
// archivo: un usuario logueado que entra a /stats no baja su código.
//
// - Páginas públicas prerenderizadas: main.jsx llama a preparePublicRoutes() antes de
//   hidratar, así el componente ya está cargado y el primer render coincide con el HTML del
//   servidor (sin Suspense, que el servidor no renderiza).
// - Navegando desde la app a una página pública: se carga en ese momento (React.lazy).
import { lazy, Suspense } from 'react';

const importPublicRoutes = () => import('./PublicRoutes');

let preloaded = null;

/** Prerender (entry-server.jsx): las páginas públicas ya vienen importadas. */
export function registerPublicRoutes(component) {
  preloaded = component;
}

/** Carga las páginas públicas antes de hidratar (main.jsx). */
export async function preparePublicRoutes() {
  preloaded = (await importPublicRoutes()).default;
}

const LazyPublicRoutes = lazy(importPublicRoutes);

const Fallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
  </div>
);

export default function PublicRoutesSlot(props) {
  if (preloaded) {
    const PublicRoutes = preloaded;
    return <PublicRoutes {...props} />;
  }
  return (
    <Suspense fallback={<Fallback />}>
      <LazyPublicRoutes {...props} />
    </Suspense>
  );
}
