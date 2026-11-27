import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { useCartStore } from './useCartStore';
import { useWishlistStore } from './useWishlistStore';
import { useAddressStore } from './useAddressStore';
import { useScratchCardStore } from './useScratchCardStore';

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'customer' | 'admin';
  avatar_url?: string | null;
  pushToken?: string | null;
  coins_balance?: number;
  referral_code?: string;
  referred_by?: number | null;
  preferred_blend?: string;
  favorite_morning_cup?: string;
  has_completed_tour?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  sendPhoneOtp: (phone: string, purpose?: string) => Promise<any>;
  loginWithPhone: (
    phone: string,
    otp: string,
    extra?: { name?: string; email?: string; inviteCode?: string; avatarUrl?: string; purpose?: string }
  ) => Promise<any>;
  loginWithFirebasePhone: (
    phone: string,
    idToken?: string,
    name?: string,
    extra?: { email?: string; inviteCode?: string; avatarUrl?: string }
  ) => Promise<any>;
  sendEmailOtp: (email: string, purpose?: string) => Promise<any>;
  loginWithEmailOtp: (
    email: string,
    otp: string,
    extra?: { name?: string; phone?: string; inviteCode?: string; avatarUrl?: string; purpose?: string } | string
  ) => Promise<any>;
  loginAsGuest: () => Promise<void>;
  register: (
    name: string,
    email: string,
    phone: string,
    inviteCode?: string,
    preferredBlend?: string,
    avatarUrl?: string
  ) => Promise<{ inviteBonusAwarded?: boolean; user?: User; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  completeTour: () => Promise<void>;
  updateUserProfile: (data: {
    name?: string;
    email?: string;
    phone?: string;
    preferred_blend?: string;
    favorite_morning_cup?: string;
    avatar_url?: string | null;
    avatarUrl?: string | null;
  }) => Promise<User>;
  setCoinsBalance: (coins: number) => void;
  setPreferredBlend: (blend: string) => void;
  pendingPreferences: boolean;
  setPendingPreferences: (pending: boolean) => void;
}

const PENDING_PREFS_KEY = 'vardhamrit_pending_preferences';

let pendingPreferencesSync = storage.getItemSync(PENDING_PREFS_KEY) === '1';

export const isPendingPreferences = () => pendingPreferencesSync;

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingPreferences, setPendingPreferencesState] = useState<boolean>(() => {
    return pendingPreferencesSync;
  });

  const setPendingPreferences = (pending: boolean) => {
    pendingPreferencesSync = pending;
    if (pending) {
      storage.setItemSync(PENDING_PREFS_KEY, '1');
      storage.setItem(PENDING_PREFS_KEY, '1');
    } else {
      storage.removeItemSync(PENDING_PREFS_KEY);
      storage.removeItem(PENDING_PREFS_KEY);
    }
    setPendingPreferencesState(pending);
  };

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
        useScratchCardStore.getState().setCurrentUser(storedUser.id);
        useWishlistStore.getState().loadWishlist();
      }

      const token = await storage.getAccessToken();
      if (token && token !== 'demo_access_token') {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setUser(res.data.data);
          await storage.setUser(res.data.data);
          useCartStore.getState().setCurrentUser(res.data.data.id);
          useScratchCardStore.getState().setCurrentUser(res.data.data.id);
          useWishlistStore.getState().loadWishlist();
          registerPushToken();
        }
      } else if (!storedUser) {
        useCartStore.getState().setCurrentUser(null);
        useScratchCardStore.getState().setCurrentUser(null);
        useWishlistStore.getState().loadWishlist();
      }
    } catch (e) {
      // If network fails, retain storedUser for offline browsing
      const cached = await storage.getUser();
      if (!cached) {
        await storage.clearAuth();
        setUser(null);
        useCartStore.getState().setCurrentUser(null);
        useScratchCardStore.getState().setCurrentUser(null);
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
      useScratchCardStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
    }
  };

  const sendPhoneOtp = async (phone: string, purpose: string = 'login') => {
    const res = await api.post('/auth/send-otp', { phone, purpose });
    return res.data;
  };

  const loginWithPhone = async (
    phone: string,
    otp: string,
    extra?: { name?: string; email?: string; inviteCode?: string; avatarUrl?: string; purpose?: string }
  ) => {
    const res = await api.post('/auth/verify-otp', {
      phone,
      otp,
      purpose: extra?.purpose || 'login',
      name: extra?.name,
      email: extra?.email,
      inviteCode: extra?.inviteCode,
      avatarUrl: extra?.avatarUrl,
    });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useScratchCardStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
      return res.data.data;
    }
    throw new Error(res.data?.error || 'Verification failed');
  };

  const loginWithFirebasePhone = async (
    phone: string,
    idToken?: string,
    name?: string,
    extra?: { email?: string; inviteCode?: string; avatarUrl?: string }
  ) => {
    const res = await api.post('/auth/firebase-login', {
      phone,
      idToken,
      name,
      email: extra?.email,
      inviteCode: extra?.inviteCode,
      avatarUrl: extra?.avatarUrl,
    });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useScratchCardStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
      return res.data.data;
    }
    throw new Error(res.data?.error || 'Firebase phone verification failed');
  };

  const sendEmailOtp = async (email: string, purpose: string = 'login') => {
    const res = await api.post('/auth/send-email-otp', { email: email.trim().toLowerCase(), purpose });
    return res.data;
  };

  const loginWithEmailOtp = async (
    email: string,
    otp: string,
    extra?: { name?: string; phone?: string; inviteCode?: string; avatarUrl?: string; purpose?: string } | string
  ) => {
    const extraObj = typeof extra === 'string' ? { name: extra } : extra;
    const res = await api.post('/auth/verify-email-otp', {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      purpose: extraObj?.purpose || 'login',
      name: extraObj?.name,
      phone: extraObj?.phone,
      inviteCode: extraObj?.inviteCode,
      avatarUrl: extraObj?.avatarUrl,
    });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useScratchCardStore.getState().setCurrentUser(userData.id);
      useWishlistStore.getState().loadWishlist();
      useAddressStore.getState().clearAddresses();
      useAddressStore.getState().loadAddresses();
      registerPushToken();
      return res.data.data;
    }
    throw new Error(res.data?.error || 'Email OTP verification failed');
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
    useScratchCardStore.getState().setCurrentUser(null);
    useWishlistStore.getState().loadWishlist();
    useAddressStore.getState().clearAddresses();
    useAddressStore.getState().loadAddresses();
  };

  const register = async (
    name: string,
    email: string,
    phone: string,
    inviteCode?: string,
    preferredBlend?: string,
    avatarUrl?: string
  ) => {
    const res = await api.post('/auth/register', {
      name,
      email: email || undefined,
      phone: phone || undefined,
      inviteCode: inviteCode && inviteCode.trim() ? inviteCode.trim().toUpperCase() : undefined,
      preferredBlend: preferredBlend || 'Upper Assam Kadak',
      favoriteMorningCup: preferredBlend || 'Upper Assam Kadak',
      avatarUrl: avatarUrl || undefined,
    });
    if (res.data?.success) {
      const { user: userData, accessToken, refreshToken, inviteBonusAwarded } = res.data.data;
      await storage.setTokens(accessToken, refreshToken);
      await storage.setUser(userData);
      setUser(userData);
      useCartStore.getState().setCurrentUser(userData.id);
      useScratchCardStore.getState().setCurrentUser(userData.id);
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
    useScratchCardStore.getState().setCurrentUser(null);
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

  const updateUserProfile = async (data: {
    name?: string;
    email?: string;
    phone?: string;
    preferred_blend?: string;
    favorite_morning_cup?: string;
    avatar_url?: string | null;
    avatarUrl?: string | null;
  }) => {
    const res = await api.put('/api/v1/user/profile', {
      name: data.name,
      email: data.email,
      phone: data.phone,
      preferredBlend: data.preferred_blend || data.favorite_morning_cup,
      favoriteMorningCup: data.favorite_morning_cup || data.preferred_blend,
      avatarUrl: data.avatar_url || data.avatarUrl,
    });
    if (res.data?.success && res.data?.data?.user) {
      const updatedUser = res.data.data.user;
      await storage.setUser(updatedUser);
      setUser(updatedUser);
      return updatedUser;
    }
    throw new Error(res.data?.error || 'Failed to update profile');
  };

  const completeTour = async () => {
    try {
      if (user?.id) {
        await storage.setItem(`@vardhamrit_tour_done_${user.id}`, 'true');
      }
      await api.post('/auth/complete-tour');
    } catch (err) {
      console.warn('Could not mark tour complete on backend:', err);
    } finally {
      setUser((prev) => (prev ? { ...prev, has_completed_tour: true } : null));
      if (user) {
        const updatedUser = { ...user, has_completed_tour: true };
        await storage.setUser(updatedUser);
      }
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
        loginWithFirebasePhone,
        sendEmailOtp,
        loginWithEmailOtp,
        loginAsGuest,
        register,
        logout,
        refreshUser,
        completeTour,
        updateUserProfile,
        setCoinsBalance,
        setPreferredBlend,
        pendingPreferences,
        setPendingPreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
