'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<{ confirmationRequired: boolean }>;
  logout: () => Promise<void>;
  loginDemo: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const storedToken = localStorage.getItem('healthsync_token');
      const storedUser = localStorage.getItem('healthsync_user');

      // Sanitize malformed stored token (e.g., token without 3 segments)
      if (storedToken && !storedToken.startsWith('demo-') && storedToken.split('.').length !== 3) {
        localStorage.removeItem('healthsync_token');
        localStorage.removeItem('healthsync_user');
        api.clearToken();
      }

      const activeToken = localStorage.getItem('healthsync_token');
      const activeUser = localStorage.getItem('healthsync_user');

      if (activeToken) {
        setToken(activeToken);
        if (activeUser) {
          try {
            setUser(JSON.parse(activeUser));
          } catch {
            // parse error
          }
        }

        // Verify with backend
        try {
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem('healthsync_user', JSON.stringify(profile));
        } catch (err: any) {
          // If token expired or invalid, clear and fallback to demo if applicable
          if (activeToken !== 'demo-jwt-token-healthsync-ai') {
            api.clearToken();
            setToken(null);
            setUser(null);
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setToken(res.access_token);
      const userProfile: UserProfile = {
        id: res.user_id,
        email: res.email,
        full_name: email.split('@')[0],
      };
      setUser(userProfile);
      localStorage.setItem('healthsync_user', JSON.stringify(userProfile));
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ confirmationRequired: boolean }> => {
    setIsLoading(true);
    try {
      const res = await api.register(email, password, fullName);

      // Check if an active authenticated session was returned (e.g. if email confirmation was disabled)
      if (res.session?.access_token) {
        setToken(res.session.access_token);
        const userProfile: UserProfile = {
          id: res.session.user_id,
          email: res.session.email,
          full_name: fullName || email.split('@')[0],
        };
        setUser(userProfile);
        localStorage.setItem('healthsync_user', JSON.stringify(userProfile));
        router.push('/dashboard');
        return { confirmationRequired: false };
      }

      // Supabase Email Confirmation is ON: No authenticated session is issued.
      // Explicitly prevent auto-login. Do NOT mark user as authenticated.
      // Ensure token and user state remain clean.
      setToken(null);
      setUser(null);
      api.clearToken();
      return { confirmationRequired: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setToken(null);
      setUser(null);
      api.clearToken();
      setIsLoading(false);
      router.push('/');
    }
  };

  const loginDemo = () => {
    const demoUser: UserProfile = {
      id: 'demo-patient-001',
      email: 'alex.morgan@healthsync.ai',
      full_name: 'Alex Morgan',
      date_of_birth: '1988-04-12',
      gender: 'Non-binary',
      created_at: new Date().toISOString(),
    };
    const demoToken = 'demo-jwt-token-healthsync-ai';
    api.setToken(demoToken);
    setToken(demoToken);
    setUser(demoUser);
    localStorage.setItem('healthsync_user', JSON.stringify(demoUser));
    router.push('/dashboard');
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
      localStorage.setItem('healthsync_user', JSON.stringify(profile));
    } catch {
      // keep current user
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        loginDemo,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
