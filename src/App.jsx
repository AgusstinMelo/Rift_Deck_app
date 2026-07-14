import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Seo from '@/components/Seo';
import PublicRoutes from '@/components/public/PublicRoutes';

const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const Layout = lazy(() => import('@/components/Layout'));
const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Library = lazy(() => import('@/pages/Library'));
const Tierlist = lazy(() => import('@/pages/Tierlist'));
const BuildCalculator = lazy(() => import('@/pages/BuildCalculator'));
const Matches = lazy(() => import('@/pages/Matches'));
const Stats = lazy(() => import('@/pages/Stats'));
const Suggester = lazy(() => import('@/pages/Suggester'));
const TierlistConfig = lazy(() => import('@/pages/TierlistConfig'));
const Profile = lazy(() => import('@/pages/Profile'));
const MembresiaResultado = lazy(() => import('@/pages/MembresiaResultado'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const RouteFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const usesPageSeo = ['/campeones', '/objetos', '/runas'].some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const publicData = typeof window !== 'undefined' ? window.__RIFTDECK_PUBLIC_DATA__ : undefined;

  if (usesPageSeo) {
    return <PublicRoutes publicData={publicData} />;
  }

  if (location.pathname === '/' && (isLoadingPublicSettings || isLoadingAuth || !isAuthenticated)) {
    return <PublicRoutes />;
  }

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <>
      {!usesPageSeo && <Seo isAuthenticated={isAuthenticated} />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
      {/* Public: landing/login */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Landing />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      {isAuthenticated ? (
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/library" element={<Library />} />
          <Route path="/tierlist" element={<Tierlist />} />
          <Route path="/build-calculator" element={<BuildCalculator />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/suggester" element={<Suggester />} />
          <Route path="/admin/tierlist-config" element={user?.role === 'admin' ? <TierlistConfig /> : <Navigate to="/" replace />} />
          <Route path="/membresia/resultado" element={<MembresiaResultado />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>
      ) : (
        <>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
