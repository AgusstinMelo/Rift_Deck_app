import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  const buildUser = (authUser, profile) => ({
    ...profile,
    id: authUser.id,
    email: authUser.email,
    full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
    visible_name: profile?.visible_name || '',
    role: profile?.role || 'user',
  });

  const getOrCreateProfile = async (authUser) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (existingProfile) return existingProfile;

    const profilePayload = {
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || '',
      visible_name: authUser.user_metadata?.visible_name || '',
      role: 'user',
    };

    const { data: createdProfile, error: createError } = await supabase
      .from('profiles')
      .insert(profilePayload)
      .select('*')
      .single();

    if (createError) throw createError;
    return createdProfile;
  };

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return null;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const authUser = userData.user;
      if (!authUser) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return null;
      }

      const profile = await getOrCreateProfile(authUser);
      const currentUser = buildUser(authUser, profile);

      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return currentUser;
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({
        type: error.status === 401 || error.status === 403 ? 'auth_required' : 'unknown',
        message: error.message || 'Authentication failed',
      });
      return null;
    }
  }, []);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'supabase', public_settings: {} });
      await checkUserAuth();
    } catch (error) {
      console.error('App state check failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to load app',
      });
    } finally {
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkUserAuth();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkAppState, checkUserAuth]);

  const updateUser = async (data) => {
    const visibleName = typeof data?.visible_name === 'string' ? data.visible_name.trim() : '';
    if (!visibleName) {
      throw new Error('Nombre de usuario requerido.');
    }

    if (!user?.id) {
      throw new Error('Usuario no autenticado.');
    }

    const { error } = await supabase
      .from('profiles')
      .update({ visible_name: visibleName })
      .eq('id', user.id);

    if (error) throw error;

    const updatedUser = await checkUserAuth();
    setUser(updatedUser);
    return updatedUser;
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  const refreshUser = checkUserAuth;

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      refreshUser,
      checkAppState,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
