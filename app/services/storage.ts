import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'vardhamrit_access_token';
const REFRESH_TOKEN_KEY = 'vardhamrit_refresh_token';
const USER_KEY = 'vardhamrit_user';

export const storage = {
  getItemSync(key: string): string | null {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  },

  setItemSync(key: string, value: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        console.warn('Storage setItemSync error:', e);
      }
    }
  },

  removeItemSync(key: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.warn('Storage removeItemSync error:', e);
      }
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        this.setItemSync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Storage setItem error:', e);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return this.getItemSync(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('Storage getItem error:', e);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        this.removeItemSync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage removeItem error:', e);
    }
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.setItem(ACCESS_TOKEN_KEY, accessToken);
    await this.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return await this.getItem(ACCESS_TOKEN_KEY);
  },

  getAccessTokenSync(): string | null {
    return this.getItemSync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return await this.getItem(REFRESH_TOKEN_KEY);
  },

  async clearAuth(): Promise<void> {
    await this.removeItem(ACCESS_TOKEN_KEY);
    await this.removeItem(REFRESH_TOKEN_KEY);
    await this.removeItem(USER_KEY);
  },

  async setUser(user: any): Promise<void> {
    await this.setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const raw = await this.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  getUserSync(): any | null {
    const raw = this.getItemSync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
};
