import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { useCartStore } from './useCartStore';
import { useWishlistStore } from './useWishlistStore';
import { useAddressStore } from './useAddressStore';

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'customer' | 'admin';
  pushToken?: string | null;
  coins_balance?: number;
  referral_code?: string;
  referred_by?: number | null;
  preferred_blend?: string;
  favorite_morning_cup?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<any>;
  loginWithPhone: (phone: string, otp?: string) => Promise<any>;
  loginAsGuest: () => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
    inviteCode?: string,
    preferredBlend?: string
  ) => Promise<{ inviteBonusAwarded?: boolean; user?: User; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setCoinsBalance: (coins: number) => void;
  setPreferredBlend: (blend: string) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const registerPushToken = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (tokenData?.data) {
        await api.patch('/auth/push-token', { pushToken: tokenData.data });
      }
    } catch (e) {
      console.warn('Could not register push token:', e);
    }
  };

  const checkAuth = async () => {
    try {
      const storedUser = await storage.getUser();
      if (storedUser) {
        setUser(storedUser);
        useCartStore.getState().setCurrentUser(storedUser.id);
        useWishlistStore.getState().loadWishlist();
      }

      const token = await storage.getAccessToken();
      if (token && token !== 'demo_access_token') {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setUser(res.data.data);
          await storage.setUser(res.data.data);
          useCartStore.getState().setCurrentUser(res.data.data.id);
          useWishlistStore.getState().loadWishlist();
          registerPushToken();
        }
      } else if (!storedUser) {
        useWishlistStore.getState().loadWishlist();
      }
    } catch (e) {
      // If network fails, retain storedUser for offline browsing
      const cached = await storage.getUser();
      if (!cached) {
        await storage.clearAuth();
        setUser(null);
        useCartStore.getState().setCurrentUser(null);
        useWishlistStore.getState().clearWishlist();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
    }
  };

  const sendPhoneOtp = async (phone: string) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data;
  };

  const loginWithPhone = async (phone: string, otp: string = '1234') => {
    const res = await api.post('/auth/verify-otp', { phone, otp });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
      return userData;
    }
    throw new Error(res.data?.error || 'Verification failed');
  };

  const loginAsGuest = async () => {
    const guestUser: User = {
      id: 9999,
      name: 'Guest Chai Lover',
      email: null,
      phone: null,
      role: 'customer',
    };
    await storage.setUser(guestUser);
    setUser(guestUser);
    useCartStore.getState().setCurrentUser(null);
    useWishlistStore.getState().loadWishlist();
    useAddressStore.getState().clearAddresses();
    useAddressStore.getState().loadAddresses();
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    inviteCode?: string,
    preferredBlend?: string
  ) => {
    const res = await api.post('/auth/register', {
      name,
      email: email || undefined,
      phone: phone || undefined,
      password,
      inviteCode: inviteCode && inviteCode.trim() ? inviteCode.trim().toUpperCase() : undefined,
      preferredBlend: preferredBlend || 'Upper Assam Kadak',
      favoriteMorningCup: preferredBlend || 'Upper Assam Kadak',
    });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken, inviteBonusAwarded } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
      return { inviteBonusAwarded, user: userData, message: res.data.message };
    }
    return {};
  };

  const setCoinsBalance = (coins: number) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, coins_balance: Math.max(0, coins) };
      storage.setUser(updated);
      return updated;
    });
  };

  const setPreferredBlend = (blend: string) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        preferred_blend: blend,
        favorite_morning_cup: blend,
      };
      storage.setUser(updated);
      return updated;
    });
  };

  const logout = async () => {
    await storage.clearAuth();
    setUser(null);
    useCartStore.getState().setCurrentUser(null);
    useCartStore.getState().clearCart();
    useWishlistStore.getState().clearWishlist();
    useAddressStore.getState().clearAddresses();
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.data);
        await storage.setUser(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        sendPhoneOtp,
        loginWithPhone,
        loginAsGuest,
        register,
        logout,
        refreshUser,
        setCoinsBalance,
        setPreferredBlend,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
