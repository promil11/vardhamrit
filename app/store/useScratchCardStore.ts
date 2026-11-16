import { create } from 'zustand';
import { storage } from '../services/storage';

const STORAGE_KEY = 'vardhamrit_scratch_cards_v1';

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
  loadCards: () => Promise<ScratchCardItem[]>;
  addCard: (card: Omit<ScratchCardItem, 'createdAt' | 'isClaimed'> & Partial<ScratchCardItem>) => Promise<void>;
  markScratched: (id: string) => Promise<void>;
  markClaimed: (id: string) => Promise<void>;
  getUnclaimedCards: () => ScratchCardItem[];
  getClaimedCards: () => ScratchCardItem[];
  syncWithOrders: (orders: any[]) => Promise<void>;
}

export const useScratchCardStore = create<ScratchCardState>((set, get) => ({
  cards: [],
  isLoading: false,

  loadCards: async () => {
    try {
      set({ isLoading: true });
      const raw = await storage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set({ cards: parsed, isLoading: false });
          return parsed;
        }
      }
      set({ isLoading: false });
      return [];
    } catch (e) {
      console.warn('Error loading scratch cards from storage:', e);
      set({ isLoading: false });
      return [];
    }
  },

  addCard: async (newCardData) => {
    try {
      const currentCards = get().cards.length > 0 ? get().cards : (await get().loadCards());
      const cardId = String(newCardData.id || newCardData.orderNumber);

      const existingIndex = currentCards.findIndex(
        (c) => String(c.id) === cardId || String(c.orderNumber) === String(newCardData.orderNumber)
      );

      let updatedCards: ScratchCardItem[];
      if (existingIndex >= 0) {
        // If already exists, do not overwrite if already claimed
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
      await storage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
    } catch (e) {
      console.warn('Error adding scratch card:', e);
    }
  },

  markScratched: async (id: string) => {
    try {
      const currentCards = get().cards;
      const updated = currentCards.map((c) =>
        String(c.id) === String(id) || String(c.orderNumber) === String(id)
          ? { ...c, isScratched: true }
          : c
      );
      set({ cards: updated });
      await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error marking card scratched:', e);
    }
  },

  markClaimed: async (id: string) => {
    try {
      const currentCards = get().cards;
      const updated = currentCards.map((c) =>
        String(c.id) === String(id) || String(c.orderNumber) === String(id)
          ? { ...c, isScratched: true, isClaimed: true, claimedAt: new Date().toISOString() }
          : c
      );
      set({ cards: updated });
      await storage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

  syncWithOrders: async (orders: any[]) => {
    try {
      if (!Array.isArray(orders) || orders.length === 0) return;
      const currentCards = get().cards.length > 0 ? get().cards : (await get().loadCards());

      let hasChanges = false;
      const updatedList = [...currentCards];

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

      if (hasChanges) {
        set({ cards: updatedList });
        await storage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      }
    } catch (e) {
      console.warn('Error syncing scratch cards with orders:', e);
    }
  },
}));
