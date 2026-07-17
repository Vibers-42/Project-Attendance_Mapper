'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SuperAdminUser } from '@/types/auth';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface AuthContextType {
  user: SuperAdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: SuperAdminUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SuperAdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Rehydrate session from localStorage on mount
    const storedUser = localStorage.getItem('auth_user');
    const storedToken = localStorage.getItem('auth_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    
    setIsLoading(false);
  }, []);

  const login = (newUser: SuperAdminUser, token: string) => {
    setUser(newUser);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    localStorage.setItem('auth_token', token);
    
    // Set a cookie so Next.js middleware can read it on the server
    Cookies.set('auth_token', token, { expires: 1, path: '/' });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    Cookies.remove('auth_token', { path: '/' });
    
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
