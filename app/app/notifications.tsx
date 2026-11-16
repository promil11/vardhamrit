import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Icon } from '../components/common/Icon';
import { useNotificationStore, NotificationItem } from '../store/useNotificationStore';
import { useAuth } from '../store/authContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'deals' | 'chai' | 'orders' | 'rewards';

interface FilterTab {
  id: FilterType;
  label: string;
  emoji: string;
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'All', emoji: '🔔' },
  { id: 'deals', label: 'Flash Deals', emoji: '⚡' },
  { id: 'chai', label: 'Chai Time', emoji: '☕' },
  { id: 'orders', label: 'Orders', emoji: '📦' },
  { id: 'rewards', label: 'Rewards', emoji: '🎁' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    initSocketListeners,
  } = useNotificationStore();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
    if (user?.id) {
      const cleanup = initSocketListeners(user.id);
      return cleanup;
    }
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleCardPress = (item: NotificationItem) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    if (!item.is_read) {
      markAsRead(item.id);
    }

    if (item.action_route && item.action_route !== '' && item.action_route !== '/') {
      router.push(item.action_route as any);
    } else {
      router.push('/(tabs)');
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'deals') {
      return notifications.filter((n) => n.type === 'FLASH_SALE' || n.type === 'CART_REMINDER');
    }
    if (activeFilter === 'chai') {
      return notifications.filter((n) => n.type === 'CHAI_TIME');
    }
    if (activeFilter === 'orders') {
      return notifications.filter((n) => n.type === 'ORDER_UPDATE');
    }
    if (activeFilter === 'rewards') {
      return notifications.filter((n) => n.type === 'PROMO' || n.type === 'ANNOUNCEMENT');
    }
    return notifications;
  }, [notifications, activeFilter]);

  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  const getCategoryTheme = (type: string) => {
    switch (type) {
      case 'FLASH_SALE':
        return {
          bg: '#FEF3C7',
          border: '#FDE68A',
          iconColor: '#D97706',
          iconName: 'flame' as const,
          label: 'Flash Deal',
        };
      case 'CHAI_TIME':
        return {
          bg: '#D1FAE5',
          border: '#A7F3D0',
          iconColor: '#059669',
          iconName: 'coffee' as const,
          label: 'Chai Time',
        };
      case 'ORDER_UPDATE':
        return {
          bg: '#E0F2FE',
          border: '#BAE6FD',
          iconColor: '#0284C7',
          iconName: 'package' as const,
          label: 'Order Update',
        };
      case 'CART_REMINDER':
        return {
          bg: '#EDE9FE',
          border: '#DDD6FE',
          iconColor: '#7C3AED',
          iconName: 'shopping-bag' as const,
          label: 'Cart Alert',
        };
      default:
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          iconColor: '#E11D48',
          iconName: 'sparkles' as const,
          label: 'Special Offer',
        };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <LinearGradient
        colors={theme.colors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadChip}>
                <Text style={styles.unreadChipText}>{unreadCount} New</Text>
              </View>
            ) : null}
          </View>

          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.markAllBtn}
              activeOpacity={0.8}
            >
              <Icon name="check" size={13} color="#D1FAE5" />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                  }
                  setActiveFilter(tab.id);
                }}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={styles.filterEmoji}>{tab.emoji}</Text>
                <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Main List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accentGold} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Icon name="bell" size={40} color={theme.colors.accentGold} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptySubtitle}>
              No notifications here. We'll alert you with real-time flash deals, chai hours, and order tracking.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)')}
              style={styles.emptyBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Explore Fresh Chai</Text>
              <Icon name="arrow-right" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const meta = getCategoryTheme(item.type);
            const isUnread = !item.is_read;

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleCardPress(item)}
                activeOpacity={0.92}
                style={[styles.card, isUnread && styles.cardUnread]}
              >
                {/* Category & Status Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.categoryBadgeWrap}>
                    <View style={[styles.iconCircle, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                      <Icon name={meta.iconName} size={13} color={meta.iconColor} />
                    </View>
                    <Text style={[styles.categoryLabel, { color: meta.iconColor }]}>{meta.label}</Text>
                  </View>

                  <View style={styles.cardMetaRight}>
                    <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
                    {isUnread && <View style={styles.unreadDot} />}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteNotification(item.id);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.deleteBtn}
                    >
                      <Icon name="close" size={13} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Card Title & Body */}
                <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]}>
                  {item.title}
                </Text>
                <Text style={styles.cardBody}>{item.body}</Text>

                {/* Rich Banner Image (if available) */}
                {item.image_url ? (
                  <View style={styles.bannerImageContainer}>
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.bannerImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}

                {/* Bottom Action CTA Row */}
                <View style={styles.cardFooter}>
                  <View style={styles.ctaPill}>
                    <Text style={styles.ctaText}>{item.cta_text || 'View Details'}</Text>
                    <Icon name="arrow-right" size={12} color="#059669" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  unreadChip: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  markAllText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
  },
  filterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterEmoji: {
    fontSize: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  filterLabelActive: {
    color: theme.colors.primary,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: {
    borderColor: '#A7F3D0',
    backgroundColor: '#FAFCFB',
    shadowColor: '#059669',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  deleteBtn: {
    padding: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 20,
  },
  cardTitleUnread: {
    color: '#0F172A',
    fontWeight: '900',
  },
  cardBody: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 4,
  },
  bannerImageContainer: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  bannerImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#E2E8F0',
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
