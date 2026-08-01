import { createContext, useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import type { AuthUser } from '@/types/auth';
import * as authService from '@/services/auth';
import { setSessionExpiredHandler } from '@/lib/api-client';
import { toast } from 'sonner';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  invalidateSession: () => void;
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const redirectedRef = useRef(false);

  const invalidateSession = useCallback(() => {
    authService.clearToken();
    setToken(null);
    setUser(null);
    if (!redirectedRef.current) {
      redirectedRef.current = true;
      toast.error('Your session has expired. Please sign in again.');
      setTimeout(() => { window.location.href = '/login'; }, 500);
    }
  }, []);

  const logout = useCallback(() => {
    authService.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(invalidateSession);

    const storedToken = authService.getStoredToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }
    setToken(storedToken);
    authService
      .getCurrentUser()
      .then((res) => {
        setUser(res.data);
        redirectedRef.current = false;
      })
      .catch(() => {
        authService.clearToken();
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [invalidateSession]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authService.login({ username, password });
    authService.storeToken(res.data.accessToken);
    setToken(res.data.accessToken);
    setUser(res.data.user);
    redirectedRef.current = false;
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        invalidateSession,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
