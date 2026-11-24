import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CartItem, Product, ProductVariant, Coupon } from '../types';
import { storage } from '../services/storage';
import { api } from '../services/api';
import { socket } from '../services/socketService';

export interface CustomCartItemOptions {
  price?: number;
  mrp?: number;
  variantLabel?: string;
  productName?: string;
  imageUrl?: string;
  idSuffix?: string;
}

export interface CartState {
  items: CartItem[];
  appliedCoupon: Coupon | null;
  freeDeliveryThreshold: number;
  deliveryFee: number;
  handlingFee: number;
  currentUserId: number | string | null;
  isSyncing: boolean;

  // Actions
  addItem: (product: Product, variant?: ProductVariant, customOptions?: CustomCartItemOptions) => void;
  incrementQuantity: (productId: number | string, variantId?: number, itemId?: string) => void;
  decrementQuantity: (productId: number | string, variantId?: number, itemId?: string) => void;
  removeItem: (productId: number | string, variantId?: number, itemId?: string) => void;
  clearCart: () => void;
  appendCartItems: (newItems: CartItem[]) => void;
  replaceCartItems: (newItems: CartItem[]) => void;
  applyCoupon: (coupon: Coupon) => boolean;
  removeCoupon: () => void;
  setCurrentUser: (userId: number | string | null) => Promise<void>;
  syncWithBackend: () => Promise<void>;
  loadUserCart: (userId: number | string | null) => Promise<void>;

  // Computed Selectors
  getItemQuantity: (productId: number, variantId?: number) => number;
  getTotalItemsCount: () => number;
  getSubtotal: () => number;
  getMrpTotal: () => number;
  getTotalSavings: () => number;
  getCouponDiscount: () => number;
  getFinalDeliveryFee: () => number;
  getGrandTotal: () => number;
  getFreeDeliveryProgress: () => number;
  getAmountNeededForFreeDelivery: () => number;
}

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not supported or permitted
    }
  }
};

const getCartStorageKey = (userId: number | string | null) => {
  return `vardhamrit_cart_${userId ?? 'guest'}`;
};

const persistCartData = (
  userId: number | string | null,
  items: CartItem[],
  appliedCoupon: Coupon | null
) => {
  try {
    const data = JSON.stringify({ items, appliedCoupon, updatedAt: Date.now() });
    const key = getCartStorageKey(userId);
    storage.setItemSync(key, data);
    storage.setItemSync('vardhamrit_cart_active', data);
    storage.setItem(key, data).catch(() => { });
    storage.setItem('vardhamrit_cart_active', data).catch(() => { });
  } catch (e) {
    console.warn('Failed to persist cart data:', e);
  }
};

let syncTimer: any = null;
const scheduleBackendSync = (userId: number | string | null, items: CartItem[]) => {
  if (!userId) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const token = await storage.getAccessToken();
      if (!token || token === 'demo_access_token') return;

      const payload = items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      }));
      await api.post('/cart/sync', { items: payload });
    } catch (e) {
      console.warn('Background cart sync error:', e);
    }
  }, 350);
};

// Helper to check if an applied coupon meets the minimum order value requirement
export const validateCouponEligibility = (items: CartItem[], coupon: Coupon | null): Coupon | null => {
  if (!coupon) return null;
  const min = Number(coupon.minOrderValue || 0);
  if (min <= 0) return coupon;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return subtotal >= min ? coupon : null;
};

// Initial synchronous load for Web
const initialUser = storage.getUserSync();
const initialUserId = initialUser?.id ?? null;
const initialStorageKey = getCartStorageKey(initialUserId);

let initialItems: CartItem[] = [];
let initialCoupon: Coupon | null = null;

try {
  const raw =
    storage.getItemSync(initialStorageKey) || storage.getItemSync('vardhamrit_cart_active');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) {
      initialItems = parsed.items;
    }
    const parsedCoupon = parsed.appliedCoupon || null;
    initialCoupon = validateCouponEligibility(initialItems, parsedCoupon);
  }
} catch {
  // Ignore synchronous parse error
}

/**
 * Tiered Handling & Packaging Fee:
 * - ₹1 to ₹499: 5%
 * - ₹500 to ₹999: 3%
 * - ₹1000 to ₹1999: 2%
 * - ₹2000 and above: 1.5%
 */
export function getHandlingFeeTier(subtotal: number): { percentage: number; fee: number } {
  if (subtotal <= 0) return { percentage: 0, fee: 0 };
  let percentage = 1.5;
  if (subtotal <= 499) {
    percentage = 5;
  } else if (subtotal <= 999) {
    percentage = 3;
  } else if (subtotal <= 1999) {
    percentage = 2;
  } else {
    percentage = 1.5;
  }
  const fee = Math.max(1, Math.round((subtotal * percentage) / 100));
  return { percentage, fee };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: initialItems,
  appliedCoupon: initialCoupon,
  freeDeliveryThreshold: 499,
  deliveryFee: 0,
  handlingFee: 0,
  currentUserId: initialUserId,
  isSyncing: false,

  addItem: (product, variant, customOptions) => {
    triggerHaptic();
    const targetVariant = variant || product.variants[0];
    const compositeId = customOptions?.idSuffix
      ? `${product.id}-${targetVariant.id}-${customOptions.idSuffix}`
      : `${product.id}-${targetVariant.id}`;

    set((state) => {
      let updatedItems: CartItem[];
      const existing = state.items.find((i) => i.id === compositeId);

      if (existing) {
        updatedItems = state.items.map((i) =>
          i.id === compositeId
            ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
            : i
        );
      } else {
        const effectivePrice =
          customOptions?.price !== undefined ? customOptions.price : targetVariant.price;
        const effectiveMrp =
          customOptions?.mrp !== undefined ? customOptions.mrp : targetVariant.mrp;

        const newItem: CartItem = {
          id: compositeId,
          productId: product.id,
          variantId: targetVariant.id,
          productName: customOptions?.productName || product.name,
          variantLabel: customOptions?.variantLabel || targetVariant.label,
          imageUrl: customOptions?.imageUrl || product.imageUrl,
          price: effectivePrice,
          mrp: effectiveMrp,
          quantity: 1,
          maxStock: targetVariant.stock || (targetVariant as any).stock_quantity || 10,
        };
        updatedItems = [...state.items, newItem];
      }

      persistCartData(state.currentUserId, updatedItems, state.appliedCoupon);
      scheduleBackendSync(state.currentUserId, updatedItems);
      return { items: updatedItems };
    });
  },

  incrementQuantity: (productId, variantId, itemId) => {
    triggerHaptic();
    set((state) => {
      const updatedItems = state.items.map((item) => {
        const isMatch =
          (itemId && item.id === itemId) ||
          item.id === String(productId) ||
          (variantId !== undefined && item.id === `${productId}-${variantId}`) ||
          (variantId !== undefined && item.productId === Number(productId) && item.variantId === variantId);
        if (isMatch) {
          const nextQty = Math.min(item.quantity + 1, item.maxStock);
          return { ...item, quantity: nextQty };
        }
        return item;
      });

      persistCartData(state.currentUserId, updatedItems, state.appliedCoupon);
      scheduleBackendSync(state.currentUserId, updatedItems);
      return { items: updatedItems };
    });
  },

  decrementQuantity: (productId, variantId, itemId) => {
    triggerHaptic();
    set((state) => {
      const existing = state.items.find(
        (item) =>
          (itemId && item.id === itemId) ||
          item.id === String(productId) ||
          (variantId !== undefined && item.id === `${productId}-${variantId}`) ||
          (variantId !== undefined && item.productId === Number(productId) && item.variantId === variantId)
      );
      if (!existing) return state;

      let updatedItems: CartItem[];
      if (existing.quantity <= 1) {
        updatedItems = state.items.filter((i) => i.id !== existing.id);
      } else {
        updatedItems = state.items.map((i) =>
          i.id === existing.id ? { ...i, quantity: i.quantity - 1 } : i
        );
      }

      const validCoupon = validateCouponEligibility(updatedItems, state.appliedCoupon);
      persistCartData(state.currentUserId, updatedItems, validCoupon);
      scheduleBackendSync(state.currentUserId, updatedItems);
      return { items: updatedItems, appliedCoupon: validCoupon };
    });
  },

  removeItem: (productId, variantId, itemId) => {
    triggerHaptic();
    set((state) => {
      const updatedItems = state.items.filter(
        (item) =>
          !(
            (itemId && item.id === itemId) ||
            item.id === String(productId) ||
            (variantId !== undefined && item.id === `${productId}-${variantId}`) ||
            (variantId !== undefined && item.productId === Number(productId) && item.variantId === variantId)
          )
      );

      const validCoupon = validateCouponEligibility(updatedItems, state.appliedCoupon);
      persistCartData(state.currentUserId, updatedItems, validCoupon);
      scheduleBackendSync(state.currentUserId, updatedItems);
      return { items: updatedItems, appliedCoupon: validCoupon };
    });
  },

  clearCart: () => {
    const { currentUserId } = get();
    persistCartData(currentUserId, [], null);
    set({ items: [], appliedCoupon: null });

    // Clear backend cart if authenticated
    if (currentUserId) {
      storage.getAccessToken().then((token) => {
        if (token && token !== 'demo_access_token') {
          api.delete('/cart').catch(() => { });
        }
      });
    }
  },

  appendCartItems: (newItems: CartItem[]) => {
    triggerHaptic();
    set((state) => {
      const updated = [...state.items];
      for (const item of newItems) {
        const existingIndex = updated.findIndex((i) => i.id === item.id);
        if (existingIndex >= 0) {
          const current = updated[existingIndex];
          const newQty = Math.min(current.quantity + item.quantity, current.maxStock || 10);
          updated[existingIndex] = { ...current, quantity: newQty };
        } else {
          updated.push({ ...item });
        }
      }
      const validCoupon = validateCouponEligibility(updated, state.appliedCoupon);
      persistCartData(state.currentUserId, updated, validCoupon);
      scheduleBackendSync(state.currentUserId, updated);
      return { items: updated, appliedCoupon: validCoupon };
    });
  },

  replaceCartItems: (newItems: CartItem[]) => {
    triggerHaptic();
    const { currentUserId } = get();
    persistCartData(currentUserId, newItems, null);
    scheduleBackendSync(currentUserId, newItems);
    set({ items: [...newItems], appliedCoupon: null });
  },

  applyCoupon: (coupon) => {
    const subtotal = get().getSubtotal();
    if (subtotal < coupon.minOrderValue) {
      return false;
    }
    triggerHaptic();
    set((state) => {
      persistCartData(state.currentUserId, state.items, coupon);
      return { appliedCoupon: coupon };
    });
    return true;
  },

  removeCoupon: () => {
    set((state) => {
      persistCartData(state.currentUserId, state.items, null);
      return { appliedCoupon: null };
    });
  },

  setCurrentUser: async (userId: number | string | null) => {
    const previousUserId = get().currentUserId;
    if (userId === previousUserId) return;

    // Save previous user cart
    persistCartData(previousUserId, get().items, get().appliedCoupon);

    // If migrating from guest to logged-in user
    if (!previousUserId && userId) {
      const guestKey = getCartStorageKey(null);
      const guestRaw = await storage.getItem(guestKey);
      let guestItems: CartItem[] = [];
      if (guestRaw) {
        try {
          guestItems = JSON.parse(guestRaw).items || [];
        } catch { }
      }

      const userKey = getCartStorageKey(userId);
      const userRaw = await storage.getItem(userKey);
      let userItems: CartItem[] = [];
      if (userRaw) {
        try {
          userItems = JSON.parse(userRaw).items || [];
        } catch { }
      }

      // Merge guest items into user items
      if (guestItems.length > 0) {
        for (const gItem of guestItems) {
          const existIdx = userItems.findIndex((u) => u.id === gItem.id);
          if (existIdx >= 0) {
            userItems[existIdx].quantity = Math.min(
              userItems[existIdx].quantity + gItem.quantity,
              userItems[existIdx].maxStock || 10
            );
          } else {
            userItems.push(gItem);
          }
        }
        await storage.removeItem(guestKey);
      }

      set({ currentUserId: userId, items: userItems });
      persistCartData(userId, userItems, get().appliedCoupon);
      await get().syncWithBackend();
      return;
    }

    // Otherwise load the user's cart
    await get().loadUserCart(userId);
  },

  loadUserCart: async (userId: number | string | null) => {
    try {
      const key = getCartStorageKey(userId);
      const raw = await storage.getItem(key);
      let loadedItems: CartItem[] = [];
      let loadedCoupon: Coupon | null = null;

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          loadedItems = Array.isArray(parsed.items) ? parsed.items : [];
          const parsedCoupon = parsed.appliedCoupon || null;
          loadedCoupon = validateCouponEligibility(loadedItems, parsedCoupon);
        } catch { }
      }

      set({
        currentUserId: userId,
        items: loadedItems,
        appliedCoupon: loadedCoupon,
      });

      if (userId) {
        await get().syncWithBackend();
      }
    } catch (e) {
      console.warn('Error loading user cart:', e);
    }
  },

  syncWithBackend: async () => {
    const { currentUserId, items } = get();
    if (!currentUserId) return;

    try {
      const token = await storage.getAccessToken();
      if (!token || token === 'demo_access_token') return;

      set({ isSyncing: true });
      const res = await api.get('/cart');

      if (res.data?.success) {
        const backendItems: any[] = res.data.data.items || [];
        if (backendItems.length > 0) {
          // Map backend items to local CartItem structure
          const mappedBackendItems: CartItem[] = backendItems.map((bi) => ({
            id: `${bi.product_id}-${bi.variant_id}`,
            productId: Number(bi.product_id),
            variantId: Number(bi.variant_id),
            productName: bi.product_name,
            variantLabel: bi.variant_label,
            imageUrl: bi.product_image,
            price: Number(bi.price),
            mrp: Number(bi.price) * 1.25,
            quantity: Number(bi.quantity),
            maxStock: Number(bi.stock) || 10,
            dbCartId: Number(bi.id),
          }));

          // Preserve any custom deals or merged items
          const finalItems = [...mappedBackendItems];
          for (const localItem of items) {
            if (!finalItems.some((fi) => fi.id === localItem.id)) {
              finalItems.push(localItem);
            }
          }

          const validCoupon = validateCouponEligibility(finalItems, get().appliedCoupon);
          set({ items: finalItems, appliedCoupon: validCoupon });
          persistCartData(currentUserId, finalItems, validCoupon);
        } else if (items.length > 0) {
          // If backend has no items but frontend has local items, push them to backend
          const payload = items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          }));
          await api.post('/cart/sync', { items: payload });
        }
      }
    } catch (e) {
      console.warn('Failed to sync cart with backend:', e);
    } finally {
      set({ isSyncing: false });
    }
  },

  getItemQuantity: (productId, variantId) => {
    const { items } = get();
    if (variantId !== undefined) {
      const found = items.find((i) => i.productId === productId && i.variantId === variantId);
      return found ? found.quantity : 0;
    }
    return items
      .filter((i) => i.productId === productId)
      .reduce((sum, i) => sum + i.quantity, 0);
  },

  getTotalItemsCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getMrpTotal: () => {
    return get().items.reduce((sum, item) => sum + item.mrp * item.quantity, 0);
  },

  getTotalSavings: () => {
    const subtotal = get().getSubtotal();
    const mrpTotal = get().getMrpTotal();
    const couponDiscount = get().getCouponDiscount();
    return Math.max(0, mrpTotal - subtotal) + couponDiscount;
  },

  getCouponDiscount: () => {
    const { appliedCoupon } = get();
    if (!appliedCoupon) return 0;
    const subtotal = get().getSubtotal();
    const minOrderValue = Number(appliedCoupon.minOrderValue || 0);
    if (minOrderValue > 0 && subtotal < minOrderValue) {
      return 0;
    }

    if (appliedCoupon.discountType === 'PERCENT') {
      const discount = (subtotal * appliedCoupon.discountValue) / 100;
      return appliedCoupon.maxDiscount ? Math.min(discount, appliedCoupon.maxDiscount) : discount;
    }

    return Math.min(appliedCoupon.discountValue, subtotal);
  },

  getFinalDeliveryFee: () => {
    const subtotal = get().getSubtotal();
    const threshold = get().freeDeliveryThreshold || 499;
    if (subtotal === 0 || subtotal >= threshold) {
      return 0;
    }
    return get().deliveryFee || 30;
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal();
    if (subtotal === 0) return 0;
    const discount = get().getCouponDiscount();
    const delivery = get().getFinalDeliveryFee();
    const handling = getHandlingFeeTier(subtotal).fee;
    return Math.max(0, subtotal - discount + delivery + handling);
  },

  getFreeDeliveryProgress: () => {
    const subtotal = get().getSubtotal();
    const threshold = get().freeDeliveryThreshold || 499;
    return Math.min(100, Math.round((subtotal / threshold) * 100));
  },

  getAmountNeededForFreeDelivery: () => {
    const subtotal = get().getSubtotal();
    const threshold = get().freeDeliveryThreshold || 499;
    return Math.max(0, threshold - subtotal);
  },
}));

// Asynchronous rehydration fallback for Native platforms
if (Platform.OS !== 'web') {
  (async () => {
    try {
      const user = await storage.getUser();
      const userId = user?.id ?? null;
      const key = getCartStorageKey(userId);
      const raw =
        (await storage.getItem(key)) || (await storage.getItem('vardhamrit_cart_active'));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          useCartStore.setState((prev) => ({
            items: prev.items.length === 0 ? parsed.items : prev.items,
            appliedCoupon: prev.appliedCoupon || parsed.appliedCoupon || null,
            currentUserId: userId,
          }));
        }
      }
      if (userId) {
        useCartStore.getState().syncWithBackend();
      }
    } catch (e) {
      console.warn('Native cart rehydration error:', e);
    }
  })();
}

// Real-time Socket.IO listener for coupons:
// If an applied coupon is disabled or updated by admin, instantly remove or update in cart without refresh!
try {
  const handleCouponDeactivated = (coupon: any) => {
    if (!coupon || !coupon.code) return;
    const currentApplied = useCartStore.getState().appliedCoupon;
    if (currentApplied && currentApplied.code.toUpperCase() === String(coupon.code).toUpperCase()) {
      const isInactive = !coupon.is_active || Number(coupon.is_active) === 0;
      if (isInactive) {
        console.log(`⚡ [CartStore] Applied coupon "${coupon.code}" was disabled by admin. Auto-removing from cart.`);
        useCartStore.getState().removeCoupon();
      }
    }
  };

  socket.on('coupon.updated', handleCouponDeactivated);
  socket.on('coupons.updated', (data: any) => {
    if (data?.coupon) {
      handleCouponDeactivated(data.coupon);
    }
  });
} catch (e) {
  console.warn('Socket listener init error in useCartStore:', e);
}

export default useCartStore;
