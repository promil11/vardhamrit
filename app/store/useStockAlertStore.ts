import { create } from 'zustand';
import { storage } from '../services/storage';
import { fetchMyStockAlerts, StockAlertItem } from '../services/catalogService';
import { socket } from '../services/socketService';

interface StockAlertState {
  alerts: StockAlertItem[];
  isLoading: boolean;
  hasUnreadRestock: boolean;
  unreadRestockCount: number;
  viewedAlertKeys: string[];
  currentUserId: number | string | null;
  loadAlerts: (contactVal?: string | null, userId?: number | string | null) => Promise<StockAlertItem[]>;
  markAlertsAsViewed: (userId?: number | string | null) => Promise<void>;
  initSocketListeners: (userId?: number | string | null, contactVal?: string | null) => () => void;
}

const getStorageKey = (userId?: number | string | null) => {
  return `vardhamrit_viewed_stock_alerts_v1_${userId || 'guest'}`;
};

const getAlertSignature = (item: StockAlertItem): string => {
  return `${item.subscription_id}_${item.is_notified ? 1 : 0}_${item.stock_quantity > 0 ? 1 : 0}`;
};

export const useStockAlertStore = create<StockAlertState>((set, get) => ({
  alerts: [],
  isLoading: false,
  hasUnreadRestock: false,
  unreadRestockCount: 0,
  viewedAlertKeys: [],
  currentUserId: null,

  loadAlerts: async (contactVal?: string | null, userId?: number | string | null) => {
    try {
      set({ isLoading: true, currentUserId: userId || null });

      const storeKey = getStorageKey(userId);
      let viewed: string[] = [];
      try {
        const stored = storage.getItemSync(storeKey) || (await storage.getItem(storeKey));
        if (stored) {
          viewed = JSON.parse(stored);
          if (!Array.isArray(viewed)) viewed = [];
        }
      } catch {
        viewed = [];
      }

      const items = await fetchMyStockAlerts(contactVal);

      // Check how many items have changes (back in stock or notified by admin) that haven't been opened
      let unreadCount = 0;
      items.forEach((item) => {
        const hasChange = item.stock_quantity > 0 || Boolean(item.is_notified);
        if (hasChange) {
          const sig = getAlertSignature(item);
          if (!viewed.includes(sig)) {
            unreadCount += 1;
          }
        }
      });

      set({
        alerts: items,
        viewedAlertKeys: viewed,
        unreadRestockCount: unreadCount,
        hasUnreadRestock: unreadCount > 0,
        isLoading: false,
      });

      return items;
    } catch (err) {
      console.warn('Error in loadAlerts store:', err);
      set({ isLoading: false });
      return [];
    }
  },

  markAlertsAsViewed: async (userId?: number | string | null) => {
    try {
      const { alerts, viewedAlertKeys, currentUserId } = get();
      const resolvedUserId = userId ?? currentUserId;
      const storeKey = getStorageKey(resolvedUserId);

      const activeKeys = new Set<string>(viewedAlertKeys);
      alerts.forEach((item) => {
        if (item.stock_quantity > 0 || Boolean(item.is_notified)) {
          activeKeys.add(getAlertSignature(item));
        }
      });

      const updatedViewed = Array.from(activeKeys);
      await storage.setItem(storeKey, JSON.stringify(updatedViewed));

      set({
        viewedAlertKeys: updatedViewed,
        unreadRestockCount: 0,
        hasUnreadRestock: false,
      });
    } catch (err) {
      console.warn('Error marking alerts as viewed:', err);
      set({
        unreadRestockCount: 0,
        hasUnreadRestock: false,
      });
    }
  },

  initSocketListeners: (userId?: number | string | null, contactVal?: string | null) => {
    const handleStockUpdate = () => {
      get().loadAlerts(contactVal, userId);
    };

    socket.on('stock_alert.updated', handleStockUpdate);
    socket.on('stock_alert.notified', handleStockUpdate);
    socket.on('stock_alert.restocked', handleStockUpdate);
    socket.on('stock_alert.removed', handleStockUpdate);
    socket.on('catalog.updated', handleStockUpdate);
    socket.on('product.updated', handleStockUpdate);

    const userChannel = userId ? `stock_alert.user_updated:${userId}` : null;
    const notifChannel = userId ? `user_notification:${userId}` : null;

    if (userChannel) socket.on(userChannel, handleStockUpdate);
    if (notifChannel) socket.on(notifChannel, handleStockUpdate);

    // Initial load
    get().loadAlerts(contactVal, userId);

    return () => {
      socket.off('stock_alert.updated', handleStockUpdate);
      socket.off('stock_alert.notified', handleStockUpdate);
      socket.off('stock_alert.restocked', handleStockUpdate);
      socket.off('stock_alert.removed', handleStockUpdate);
      socket.off('catalog.updated', handleStockUpdate);
      socket.off('product.updated', handleStockUpdate);

      if (userChannel) socket.off(userChannel, handleStockUpdate);
      if (notifChannel) socket.off(notifChannel, handleStockUpdate);
    };
  },
}));
