import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'admin';
}

interface AuthContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('vardhamrit_admin_token');
    const savedUser = localStorage.getItem('vardhamrit_admin_user');

    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'admin') {
          setAdmin(parsed);
        } else {
          localStorage.clear();
        }
      } catch (e) {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (token: string, user: AdminUser) => {
    localStorage.setItem('vardhamrit_admin_token', token);
    localStorage.setItem('vardhamrit_admin_user', JSON.stringify(user));
    setAdmin(user);
  };

  const logout = () => {
    localStorage.removeItem('vardhamrit_admin_token');
    localStorage.removeItem('vardhamrit_admin_user');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
