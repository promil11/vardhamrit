import { create } from 'zustand';
import { storage } from '../services/storage';

export interface ScratchCardItem {
  id: string; // Order ID or unique card ID
  orderNumber: string;
  coinsEarned: number;
  totalAmount?: number | string;
  createdAt: string;
  isScratched: boolean;
  isClaimed: boolean;
  claimedAt?: string | null;
}

interface ScratchCardState {
  cards: ScratchCardItem[];
  isLoading: boolean;
  currentUserId: number | string | null;
  setCurrentUser: (userId: number | string | null) => Promise<void>;
  loadCards: (userId?: number | string | null) => Promise<ScratchCardItem[]>;
  clearCards: () => Promise<void>;
  addCard: (card: Omit<ScratchCardItem, 'createdAt' | 'isClaimed'> & Partial<ScratchCardItem>) => Promise<void>;
  markScratched: (id: string) => Promise<void>;
  markClaimed: (id: string) => Promise<void>;
  getUnclaimedCards: () => ScratchCardItem[];
  getClaimedCards: () => ScratchCardItem[];
  syncWithOrders: (orders: any[], userId?: number | string | null) => Promise<void>;
}

const getStorageKey = (userId?: number | string | null) => {
  if (!userId) return null;
  return `vardhamrit_scratch_cards_user_${userId}`;
};

export const useScratchCardStore = create<ScratchCardState>((set, get) => ({
  cards: [],
  isLoading: false,
  currentUserId: null,

  setCurrentUser: async (userId: number | string | null) => {
    // Purge legacy global key that leaked previous account's scratch cards
    try {
      await storage.removeItem('vardhamrit_scratch_cards_v1');
    } catch { }

    set({ currentUserId: userId });

    if (!userId) {
      set({ cards: [] });
      return;
    }

    await get().loadCards(userId);
  },

  loadCards: async (userId?: number | string | null) => {
    const effectiveUserId = userId ?? get().currentUserId;
    if (!effectiveUserId) {
      set({ cards: [], isLoading: false });
      return [];
    }

    try {
      set({ isLoading: true });
      // Clean up legacy global key
      await storage.removeItem('vardhamrit_scratch_cards_v1').catch(() => {});

      const key = getStorageKey(effectiveUserId);
      if (!key) {
        set({ cards: [], isLoading: false });
        return [];
      }

      const raw = await storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ cards: parsed, currentUserId: effectiveUserId, isLoading: false });
          return parsed;
        }
      }
      set({ cards: [], currentUserId: effectiveUserId, isLoading: false });
      return [];
    } catch (e) {
      console.warn('Error loading scratch cards from storage:', e);
      set({ cards: [], isLoading: false });
      return [];
    }
  },

  clearCards: async () => {
    const effectiveUserId = get().currentUserId;
    if (effectiveUserId) {
      const key = getStorageKey(effectiveUserId);
      if (key) {
        await storage.removeItem(key).catch(() => {});
      }
    }
    // Also remove legacy key
    await storage.removeItem('vardhamrit_scratch_cards_v1').catch(() => {});
    set({ cards: [], currentUserId: null });
  },

  addCard: async (newCardData) => {
    try {
      const effectiveUserId = get().currentUserId;
      if (!effectiveUserId) return;
      const key = getStorageKey(effectiveUserId);
      if (!key) return;

      const currentCards = get().cards;
      const cardId = String(newCardData.id || newCardData.orderNumber);

      const existingIndex = currentCards.findIndex(
        (c) => String(c.id) === cardId || String(c.orderNumber) === String(newCardData.orderNumber)
      );

      let updatedCards: ScratchCardItem[];
      if (existingIndex >= 0) {
        const existing = currentCards[existingIndex];
        if (existing.isClaimed) {
          return;
        }
        updatedCards = [...currentCards];
        updatedCards[existingIndex] = {
          ...existing,
          ...newCardData,
          coinsEarned: newCardData.coinsEarned || existing.coinsEarned,
        };
      } else {
        const newCard: ScratchCardItem = {
          id: cardId,
          orderNumber: String(newCardData.orderNumber || cardId),
          coinsEarned: Number(newCardData.coinsEarned) || 5,
          totalAmount: newCardData.totalAmount,
          createdAt: newCardData.createdAt || new Date().toISOString(),
          isScratched: Boolean(newCardData.isScratched),
          isClaimed: Boolean(newCardData.isClaimed),
          claimedAt: newCardData.claimedAt || null,
        };
        updatedCards = [newCard, ...currentCards];
      }

      set({ cards: updatedCards });
      await storage.setItem(key, JSON.stringify(updatedCards));
    } catch (e) {
      console.warn('Error adding scratch card:', e);
    }
  },

  markScratched: async (id: string) => {
    try {
      const effectiveUserId = get().currentUserId;
      const key = getStorageKey(effectiveUserId);
      const currentCards = get().cards;
      const updated = currentCards.map((c) =>
        String(c.id) === String(id) || String(c.orderNumber) === String(id)
          ? { ...c, isScratched: true }
          : c
      );
      set({ cards: updated });
      if (key) {
        await storage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Error marking card scratched:', e);
    }
  },

  markClaimed: async (id: string) => {
    try {
      const effectiveUserId = get().currentUserId;
      const key = getStorageKey(effectiveUserId);
      const currentCards = get().cards;
      const updated = currentCards.map((c) =>
        String(c.id) === String(id) || String(c.orderNumber) === String(id)
          ? { ...c, isScratched: true, isClaimed: true, claimedAt: new Date().toISOString() }
          : c
      );
      set({ cards: updated });
      if (key) {
        await storage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Error marking card claimed:', e);
    }
  },

  getUnclaimedCards: () => {
    return get().cards.filter((c) => !c.isClaimed);
  },

  getClaimedCards: () => {
    return get().cards.filter((c) => c.isClaimed);
  },

  syncWithOrders: async (orders: any[], userId?: number | string | null) => {
    try {
      const effectiveUserId = userId ?? get().currentUserId;
      if (!effectiveUserId) {
        set({ cards: [] });
        return;
      }

      const key = getStorageKey(effectiveUserId);
      if (!key) return;

      // If user has NO orders (e.g. newly registered account), cards must be empty
      if (!Array.isArray(orders) || orders.length === 0) {
        set({ cards: [], currentUserId: effectiveUserId });
        await storage.setItem(key, JSON.stringify([]));
        return;
      }

      const currentCards = get().cards;
      const validOrderNums = new Set(orders.map((o) => String(o.order_number || o.id)));

      // Keep only cards that belong to this user's actual orders (prevents cross-account leak)
      const validExistingCards = currentCards.filter((c) =>
        validOrderNums.has(String(c.orderNumber)) || validOrderNums.has(String(c.id))
      );

      let hasChanges = validExistingCards.length !== currentCards.length;
      const updatedList = [...validExistingCards];

      for (const ord of orders) {
        const orderNum = String(ord.order_number || ord.id);
        const cardId = String(ord.id || ord.order_number);

        const exists = updatedList.some(
          (c) => String(c.id) === cardId || String(c.orderNumber) === orderNum
        );

        if (!exists) {
          const grandTotal = Number(ord.total_amount || ord.total || 0);
          const coins = Math.max(5, Math.round(grandTotal * 0.02));
          updatedList.push({
            id: cardId,
            orderNumber: orderNum,
            coinsEarned: coins,
            totalAmount: grandTotal,
            createdAt: ord.created_at || new Date().toISOString(),
            isScratched: false,
            isClaimed: false,
            claimedAt: null,
          });
          hasChanges = true;
        }
      }

      if (hasChanges || updatedList.length !== currentCards.length) {
        set({ cards: updatedList, currentUserId: effectiveUserId });
        await storage.setItem(key, JSON.stringify(updatedList));
      }
    } catch (e) {
      console.warn('Error syncing scratch cards with orders:', e);
    }
  },
}));
