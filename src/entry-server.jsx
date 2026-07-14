import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { AuthProvider } from '@/lib/AuthContext';
import PublicRoutes from '@/components/public/PublicRoutes';

export function renderPublicRoute(pathname, publicData) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
  });

  return renderToString(
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <StaticRouter location={pathname}>
          <PublicRoutes publicData={publicData} />
        </StaticRouter>
      </QueryClientProvider>
    </AuthProvider>,
  );
}
