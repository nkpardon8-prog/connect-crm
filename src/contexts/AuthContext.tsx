import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User } from '@/types/crm';
import { mockUsers, mockCredentials } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((email: string, password: string) => {
    const cred = mockCredentials.find(c => c.email === email && c.password === password);
    if (cred) {
      const foundUser = mockUsers.find(u => u.id === cred.userId);
      if (foundUser) {
        setUser(foundUser);
        return true;
      }
    }
    return false;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
