import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
// Add page imports here
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Library from '@/pages/Library';
import Tierlist from '@/pages/Tierlist';
import BuildCalculator from '@/pages/BuildCalculator';
import Matches from '@/pages/Matches';
import Stats from '@/pages/Stats';
import Suggester from '@/pages/Suggester';
import TierlistConfig from '@/pages/TierlistConfig';
import Profile from '@/pages/Profile';
import MembresiaResultado from '@/pages/MembresiaResultado';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();

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
    <Routes>
      {/* Public: landing/login */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Landing />} />

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