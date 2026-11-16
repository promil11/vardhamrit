import { create } from 'zustand';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import { socket } from '../services/socketService';

export interface NotificationItem {
  id: number;
  campaign_id?: number | null;
  user_id: number;
  title: string;
  body: string;
  image_url?: string | null;
  type: 'PROMO' | 'FLASH_SALE' | 'CHAI_TIME' | 'CART_REMINDER' | 'ORDER_UPDATE' | 'ANNOUNCEMENT' | string;
  action_route: string;
  cta_text?: string;
  data?: any;
  is_read: boolean | number;
  created_at: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  addIncomingNotification: (notif: NotificationItem) => void;
  initSocketListeners: (userId: number) => () => void;
}

const triggerHaptic = (type: 'light' | 'success' = 'light') => {
  if (Platform.OS !== 'web') {
    try {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics fallback
    }
  }
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async () => {
    try {
      set({ isLoading: true });
      const res = await api.get('/notifications?limit=40');
      if (res.data?.success && res.data?.data) {
        set({
          notifications: res.data.data.notifications || [],
          unreadCount: res.data.data.unreadCount || 0,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      console.warn('Error loading notifications:', e);
      set({ isLoading: false });
    }
  },

  loadUnreadCount: async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      if (res.data?.success && res.data?.data) {
        set({ unreadCount: Number(res.data.data.unreadCount || 0) });
      }
    } catch (e) {
      // Ignore background unread check errors silently
    }
  },

  markAsRead: async (id: number) => {
    // Optimistic UI update
    set((state) => {
      let decremented = false;
      const updated = state.notifications.map((n) => {
        if (n.id === id && !n.is_read) {
          decremented = true;
          return { ...n, is_read: true };
        }
        return n;
      });
      return {
        notifications: updated,
        unreadCount: decremented ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (e) {
      console.warn('Failed to mark notification read on backend:', e);
    }
  },

  markAllAsRead: async () => {
    triggerHaptic('success');
    // Optimistic UI update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));

    try {
      await api.patch('/notifications/mark-all-read');
    } catch (e) {
      console.warn('Failed to mark all read on backend:', e);
    }
  },

  deleteNotification: async (id: number) => {
    triggerHaptic('light');
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      const wasUnread = target && !target.is_read;
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });

    try {
      await api.delete(`/notifications/${id}`);
    } catch (e) {
      console.warn('Failed to delete notification on backend:', e);
    }
  },

  addIncomingNotification: (notif: NotificationItem) => {
    triggerHaptic('success');
    set((state) => ({
      notifications: [notif, ...state.notifications.filter((n) => n.id !== notif.id)],
      unreadCount: state.unreadCount + 1,
    }));
  },

  initSocketListeners: (userId: number) => {
    if (!socket) return () => {};

    const handleUserNotification = (data: any) => {
      get().addIncomingNotification(data);
    };

    const handleBroadcast = (data: any) => {
      get().addIncomingNotification({
        id: data.id || Date.now(),
        user_id: userId,
        title: data.title,
        body: data.body,
        image_url: data.imageUrl,
        type: data.type || 'PROMO',
        action_route: data.actionRoute || '/',
        cta_text: data.ctaText || 'View Now',
        is_read: false,
        created_at: data.createdAt || new Date().toISOString(),
      });
    };

    socket.on(`user_notification:${userId}`, handleUserNotification);
    socket.on('broadcast_notification', handleBroadcast);

    return () => {
      socket.off(`user_notification:${userId}`, handleUserNotification);
      socket.off('broadcast_notification', handleBroadcast);
    };
  },
}));
