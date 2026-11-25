import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Icon } from '../components/common/Icon';
import { useAuth } from '../store/authContext';
import { useStockAlertStore } from '../store/useStockAlertStore';
import {
  fetchMyStockAlerts,
  unsubscribeStockAlert,
  StockAlertItem,
} from '../services/catalogService';
import { socket } from '../services/socketService';
import { getFullImageUrl } from '../utils/imageUtils';
import { useResponsive } from '../utils/responsive';

type FilterTab = 'all' | 'in_progress' | 'in_stock';

export default function StockAlertsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<StockAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<StockAlertItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Collapsible Blinkit-style header animation
  const [headerHeight, setHeaderHeight] = useState(Platform.OS === 'ios' ? 148 : 130);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderHidden = useRef(false);
  const lastScrollY = useRef(0);

  const showHeader = useCallback(() => {
    if (isHeaderHidden.current) {
      isHeaderHidden.current = false;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [headerTranslateY]);

  const hideHeader = useCallback(() => {
    if (!isHeaderHidden.current) {
      isHeaderHidden.current = true;
      Animated.timing(headerTranslateY, {
        toValue: -headerHeight,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [headerTranslateY, headerHeight]);

  const handleScroll = (e: any) => {
    const currentScrollY = e.nativeEvent.contentOffset.y;
    const contentHeight = e.nativeEvent.contentSize?.height || 0;
    const layoutHeight = e.nativeEvent.layoutMeasurement?.height || 0;

    // Keep header visible near the top
    if (currentScrollY <= 15) {
      showHeader();
      lastScrollY.current = currentScrollY;
      return;
    }

    // Do not hide near bottom bounce
    if (contentHeight > 0 && currentScrollY + layoutHeight >= contentHeight - 30) {
      lastScrollY.current = currentScrollY;
      return;
    }

    const diff = currentScrollY - lastScrollY.current;
    if (Math.abs(diff) < 6) return;

    if (diff > 0 && currentScrollY > 50) {
      hideHeader();
    } else if (diff < 0) {
      showHeader();
    }
    lastScrollY.current = currentScrollY;
  };

  const loadAlerts = useCallback(async () => {
    try {
      const contactVal = user?.email || user?.phone || null;
      const data = await fetchMyStockAlerts(contactVal);
      setAlerts(data);
      // Mark as viewed so notification dot clears
      useStockAlertStore.getState().markAlertsAsViewed(user?.id);
    } catch (err) {
      console.warn('Error loading stock alerts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.email, user?.phone, user?.id]);

  useEffect(() => {
    loadAlerts();

    // Listen to real-time socket events so admin restock and "Alert All" auto-reflect immediately
    const handleRealTimeStockAlert = () => {
      loadAlerts();
    };

    socket.on('stock_alert.updated', handleRealTimeStockAlert);
    socket.on('stock_alert.notified', handleRealTimeStockAlert);
    socket.on('stock_alert.restocked', handleRealTimeStockAlert);
    socket.on('stock_alert.removed', handleRealTimeStockAlert);
    socket.on('catalog.updated', handleRealTimeStockAlert);
    socket.on('product.updated', handleRealTimeStockAlert);

    if (user?.id) {
      socket.on(`stock_alert.user_updated:${user.id}`, handleRealTimeStockAlert);
      socket.on(`user_notification:${user.id}`, handleRealTimeStockAlert);
    }

    // Auto-sync polling every 8s while screen is mounted for guaranteed consistency
    const pollInterval = setInterval(() => {
      loadAlerts();
    }, 8000);

    return () => {
      socket.off('stock_alert.updated', handleRealTimeStockAlert);
      socket.off('stock_alert.notified', handleRealTimeStockAlert);
      socket.off('stock_alert.restocked', handleRealTimeStockAlert);
      socket.off('stock_alert.removed', handleRealTimeStockAlert);
      socket.off('catalog.updated', handleRealTimeStockAlert);
      socket.off('product.updated', handleRealTimeStockAlert);

      if (user?.id) {
        socket.off(`stock_alert.user_updated:${user.id}`, handleRealTimeStockAlert);
        socket.off(`user_notification:${user.id}`, handleRealTimeStockAlert);
      }
      clearInterval(pollInterval);
    };
  }, [loadAlerts, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const handleRemove = (item: StockAlertItem) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    // Open dedicated confirmation modal with Agree / Cancel
    setConfirmRemoveItem(item);
  };

  const onConfirmAgreeRemove = async () => {
    if (!confirmRemoveItem) return;
    setIsRemoving(true);
    setRemovingId(confirmRemoveItem.subscription_id);

    try {
      const contactVal = user?.email || user?.phone || null;
      const success = await unsubscribeStockAlert(
        confirmRemoveItem.subscription_id,
        confirmRemoveItem.variant_id,
        contactVal
      );

      // Remove from active state immediately
      setAlerts((prev) => prev.filter((a) => a.subscription_id !== confirmRemoveItem.subscription_id));
      setConfirmRemoveItem(null);

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { }
      }
    } catch (err) {
      console.warn('Error during unsubscribe:', err);
      // Still remove locally to satisfy user's explicit action
      setAlerts((prev) => prev.filter((a) => a.subscription_id !== confirmRemoveItem.subscription_id));
      setConfirmRemoveItem(null);
    } finally {
      setIsRemoving(false);
      setRemovingId(null);
    }
  };

  const handleOpenProduct = (productId: number) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    router.push({
      pathname: '/product/[id]',
      params: { id: String(productId) },
    });
  };

  const filteredAlerts = useMemo(() => {
    if (activeTab === 'in_stock') {
      return alerts.filter((a) => a.stock_quantity > 0 || Boolean(a.is_notified));
    }
    if (activeTab === 'in_progress') {
      return alerts.filter((a) => a.stock_quantity <= 0 && !Boolean(a.is_notified));
    }
    return alerts;
  }, [alerts, activeTab]);

  const formatSubDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Recently';
    try {
      let dateVal = dateStr;
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        dateVal = dateStr.replace(' ', 'T') + 'Z';
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* 1. Signature Luxury Collapsible Header */}
        <Animated.View
          style={[
            styles.headerWrapper,
            {
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - headerHeight) > 1) {
              setHeaderHeight(h);
            }
          }}
        >
          <LinearGradient
            colors={theme.colors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Navigation & Title Bar */}
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.7}
                style={styles.backBtn}
                accessibilityLabel="Go back"
              >
                <Icon name="arrow-left" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerTitleCol}>
                <Text style={styles.headerTitle}>Restock & Stock Alerts</Text>
                <Text style={styles.headerSubtitle}>
                  {alerts.length === 0
                    ? 'Priority fresh estate harvest notification'
                    : `${alerts.length} package size${alerts.length === 1 ? '' : 's'} under priority watch`}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onRefresh}
                style={styles.refreshBtn}
                accessibilityLabel="Refresh alerts"
              >
                <Icon name="bell-ring" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 12 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressViewOffset={Platform.OS === 'android' ? headerHeight + 10 : headerHeight}
            />
          }
        >
          {/* 3. Main Content List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Syncing fresh estate harvest inventory...</Text>
            </View>
          ) : filteredAlerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Icon name="bell" size={32} color="#D97706" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'in_stock'
                  ? 'No Restocked Items Yet'
                  : activeTab === 'in_progress'
                    ? 'No Pending Harvests'
                    : 'No Active Stock Alerts'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Whenever a specific blend or package size (e.g. 500g or 1kg Saver Pack) is sold out, tap "Notify Me When Available" on the product page. Your active alerts will be tracked right here.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/categories')}
                style={styles.exploreBtn}
              >
                <Text style={styles.exploreBtnText}>Explore Tea Blends</Text>
                <Icon name="chevron-right" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {filteredAlerts.map((item) => {
                const isAlerted = Boolean(item.is_notified);
                const isInStock = item.stock_quantity > 0 || isAlerted;
                const imageUrl = getFullImageUrl(item.product_image);
                const savings = Math.max(0, item.mrp - item.price);

                return (
                  <View key={item.subscription_id} style={styles.alertCard}>
                    {/* Card Header Tag Row */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.vipTag}>
                        <Icon name="sparkles" size={10} color="#B45309" />
                        <Text style={styles.vipTagText}>VIP RESTOCK PRIORITY</Text>
                      </View>
                      <Text style={styles.subDateText}>
                        Requested {formatSubDate(item.created_at)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => handleOpenProduct(item.product_id)}
                      style={styles.cardMainRow}
                    >
                      {/* High-End Thumbnail with Pack Overlay */}
                      <View style={styles.imageWrapper}>
                        <Image source={{ uri: imageUrl }} style={styles.productImage} />
                        <View style={styles.imageSizePill}>
                          <Text style={styles.imageSizePillText}>{item.variant_label}</Text>
                        </View>
                      </View>

                      {/* Details Column */}
                      <View style={styles.productDetailsCol}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {item.product_name}
                        </Text>

                        {/* Pricing Row */}
                        <View style={styles.priceRow}>
                          <Text style={styles.priceText}>₹{item.price}</Text>
                          {item.mrp > item.price ? (
                            <Text style={styles.mrpText}>₹{item.mrp}</Text>
                          ) : null}
                          {savings > 0 ? (
                            <View style={styles.savingsPill}>
                              <Text style={styles.savingsPillText}>Save ₹{savings}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Live Harvest Status Capsule */}
                        {isInStock ? (
                          <View style={styles.inStockBadge}>
                            <View style={styles.greenPulseDot} />
                            <Icon name="badge-check" size={13} color="#0F5132" />
                            <Text style={styles.inStockBadgeText}>
                              {item.stock_quantity > 0
                                ? 'Fresh Harvest In Stock!'
                                : 'Back in Stock Alert Dispatched!'}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.outOfStockBadge}>
                            <View style={styles.amberPulseDot} />
                            <Icon name="clock" size={12} color="#92400E" />
                            <Text style={styles.outOfStockBadgeText}>
                              Estate Packing in Progress
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Channel Info Pill */}
                    <View style={styles.channelContainer}>
                      <View style={styles.channelPill}>
                        <Icon name="bell" size={11} color="#065F46" />
                        <Text style={styles.channelText} numberOfLines={1}>
                          Alert via {item.contact_type.toLowerCase()}:{' '}
                          <Text style={styles.channelValue}>
                            {item.contact_value || 'In-App Notification'}
                          </Text>
                        </Text>
                      </View>
                    </View>

                    {/* Card Bottom Actions */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleRemove(item)}
                        disabled={removingId === item.subscription_id}
                        style={styles.removeAlertBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {removingId === item.subscription_id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <>
                            <Icon name="trash-2" size={13} color="#DC2626" />
                            <Text style={styles.removeAlertText}>Remove Alert</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleOpenProduct(item.product_id)}
                        style={[
                          styles.actionCtaBtn,
                          isInStock && styles.actionCtaBtnInStock,
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionCtaText,
                            isInStock && styles.actionCtaTextInStock,
                          ]}
                        >
                          {isInStock ? 'Order Fresh Harvest' : 'View Blend Details'}
                        </Text>
                        <Icon
                          name="chevron-right"
                          size={12}
                          color={isInStock ? '#FFFFFF' : theme.colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>

        {/* Remove Stock Alert Confirmation Modal Popup */}
        <Modal
          visible={Boolean(confirmRemoveItem)}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmRemoveItem(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconCircle}>
                <Icon name="trash-2" size={26} color="#DC2626" />
              </View>

              <Text style={styles.modalTitle}>Remove Stock Alert?</Text>

              <Text style={styles.modalDescription}>
                Are you sure you want to stop receiving back-in-stock alerts when{' '}
                <Text style={styles.modalHighlight}>
                  {confirmRemoveItem?.product_name} ({confirmRemoveItem?.variant_label})
                </Text>{' '}
                arrives at the estate?
              </Text>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setConfirmRemoveItem(null)}
                  disabled={isRemoving}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onConfirmAgreeRemove}
                  disabled={isRemoving}
                  style={styles.modalAgreeBtn}
                >
                  {isRemoving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="check" size={14} color="#FFFFFF" />
                      <Text style={styles.modalAgreeText}>Agree & Remove</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 18,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  brandHallmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  brandTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  brandSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FEF3C7',
    letterSpacing: 0.5,
  },
  liveWatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(22, 163, 74, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveWatchText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D1FAE5',
    letterSpacing: 0.6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 2,
    paddingRight: 24,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  tabPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  tabPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '900',
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: 80,
  },
  pipelineCard: {
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    marginBottom: theme.spacing.base,
    ...theme.shadows.subtle,
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pipelineTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pipelineIconDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineTitle: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
    color: '#065F46',
  },
  pipelineSubtitle: {
    fontSize: 10.5,
    color: '#047857',
    marginTop: 1,
  },
  purityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  purityBadgeText: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#065F46',
    letterSpacing: 0.3,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  stepItem: {
    alignItems: 'center',
    gap: 3,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: '#10B981',
  },
  stepDotActive: {
    backgroundColor: '#F59E0B',
  },
  stepInnerPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 9.5,
    color: '#6B7280',
    fontWeight: theme.typography.weights.medium,
  },
  stepLabelActive: {
    color: '#92400E',
    fontWeight: theme.typography.weights.bold,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
    marginBottom: 12,
  },
  stepConnectorActive: {
    flex: 1,
    height: 2,
    backgroundColor: '#10B981',
    marginHorizontal: 6,
    marginBottom: 12,
  },
  pipelineFooterNote: {
    fontSize: 10.5,
    color: '#047857',
    marginTop: 8,
    lineHeight: 14.5,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 10,
    gap: 12,
    ...theme.shadows.subtle,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: theme.radius.pill,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
  },
  alertsList: {
    gap: 14,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    ...theme.shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  vipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vipTagText: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
    letterSpacing: 0.3,
  },
  subDateText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: theme.typography.weights.medium,
  },
  cardMainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageWrapper: {
    position: 'relative',
    width: 82,
    height: 82,
    borderRadius: theme.radius.sm,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imageSizePill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 81, 50, 0.88)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  imageSizePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
  },
  productDetailsCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  productName: {
    fontSize: 13.5,
    fontWeight: theme.typography.weights.bold,
    color: '#1E293B',
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginVertical: 2,
  },
  priceText: {
    fontSize: 14.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  mrpText: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  savingsPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  savingsPillText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#15803D',
  },
  inStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    marginTop: 2,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  inStockBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  outOfStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    marginTop: 2,
  },
  amberPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  outOfStockBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
  },
  channelContainer: {
    marginTop: 10,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  channelText: {
    fontSize: 10.5,
    color: '#475569',
  },
  channelValue: {
    fontWeight: theme.typography.weights.bold,
    color: '#0F172A',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  removeAlertText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: theme.typography.weights.medium,
  },
  actionCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: theme.radius.pill,
  },
  actionCtaBtnInStock: {
    backgroundColor: theme.colors.primary,
  },
  actionCtaText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  actionCtaTextInStock: {
    color: '#FFFFFF',
  },
  perksCard: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  perksCardTitle: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  perkText: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: theme.typography.weights.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  modalHighlight: {
    color: '#0F172A',
    fontWeight: '700',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalAgreeBtn: {
    flex: 1.2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalAgreeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
