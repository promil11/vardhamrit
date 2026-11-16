import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Product } from '../types';
import { toggleProductWishlist, fetchWishlistItems } from '../services/userClientService';

interface WishlistState {
  wishlistIds: number[];
  isLoading: boolean;
  loadWishlist: () => Promise<void>;
  toggleWishlist: (productId: number) => void;
  isInWishlist: (productId: number) => boolean;
  removeFromWishlist: (productId: number) => void;
  clearWishlist: () => void;
  getWishlistCount: () => number;
}

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics fallback
    }
  }
};

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlistIds: [],
  isLoading: false,

  loadWishlist: async () => {
    try {
      set({ isLoading: true });
      const items = await fetchWishlistItems();
      if (items && Array.isArray(items)) {
        set({ wishlistIds: items.map((it: any) => Number(it.id)), isLoading: false });
      } else {
        set({ wishlistIds: [], isLoading: false });
      }
    } catch (e) {
      console.warn('Error syncing wishlist with DB:', e);
      set({ wishlistIds: [], isLoading: false });
    }
  },

  toggleWishlist: (productId: number) => {
    triggerHaptic();

    // Optimistic UI update
    set((state) => {
      const exists = state.wishlistIds.includes(productId);
      return {
        wishlistIds: exists
          ? state.wishlistIds.filter((id) => id !== productId)
          : [...state.wishlistIds, productId],
      };
    });

    // Persist to MySQL database via REST API
    toggleProductWishlist(productId).catch((err) => {
      console.warn('Wishlist API toggle sync error:', err);
    });
  },

  isInWishlist: (productId: number) => {
    return get().wishlistIds.includes(productId);
  },

  removeFromWishlist: (productId: number) => {
    triggerHaptic();
    set((state) => ({
      wishlistIds: state.wishlistIds.filter((id) => id !== productId),
    }));
    toggleProductWishlist(productId).catch(() => {});
  },

  clearWishlist: () => {
    triggerHaptic();
    set({ wishlistIds: [] });
  },

  getWishlistCount: () => {
    return get().wishlistIds.length;
  },
}));
