import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, AuthUser } from '@/lib/api';

interface User extends AuthUser {
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, persona?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = await api.getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userData = await api.getMe();
      setUser(userData);
    } catch {
      setUser(null);
      await api.clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setUser(data.user);
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string, persona?: string) => {
    const data = await api.signup(email, password, name, persona);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
