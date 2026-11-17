import { renderToString } from 'react-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { AppShell } from '@/App';
import PublicRoutes from '@/components/public/PublicRoutes';
import { registerPublicRoutes } from '@/components/public/publicRoutesLoader';

// En el servidor las páginas públicas ya están cargadas (sin React.lazy), igual que en el
// navegador después de preparePublicRoutes().
registerPublicRoutes(PublicRoutes);

// Renderiza el mismo árbol que el navegador (AppShell): así el HTML prerenderizado coincide
// con el primer render del cliente y la hidratación no falla.
export function renderPublicRoute(pathname, publicData) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });

  return renderToString(
    <AppShell
      router={StaticRouter}
      routerProps={{ location: pathname }}
      queryClient={queryClient}
      publicData={publicData}
    />,
  );
}
