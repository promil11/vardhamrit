import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Platform,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { CartItem } from '../../types';
import { OrdersSkeleton } from '../../components/common/Skeleton';
import { fetchUserOrders } from '../../services/orderClientService';
import { api } from '../../services/api';
import { socket } from '../../services/socketService';
import { EmptyState } from '../../components/common/EmptyState';
import { getFullImageUrl } from '../../utils/imageUtils';
import { Icon } from '../../components/common/Icon';

interface OrderItemPreview {
  id: number;
  productId?: number;
  variantId?: number;
  name: string;
  variant: string;
  qty: number;
  price: number;
  imageUrl: string;
}

interface OrderRecord {
  id: string;
  rawId?: number;
  hasReviewed?: boolean;
  date: string;
  status: 'DELIVERED' | 'DISPATCHED' | 'PACKED' | 'CONFIRMED' | 'PLACED' | 'CANCELLED';
  statusLabel: string;
  eta: string;
  stepIndex: number; // 0: Cancelled, 1: Placed, 2: Packed, 3: In Transit, 4: Delivered
  deliveryAddress: string;
  items: OrderItemPreview[];
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  rejectionReason?: string;
}

type FilterTab = 'all' | 'active' | 'delivered' | 'cancelled';

export default function OrdersScreen() {
  const router = useRouter();
  const {
    items: currentCartItems,
    getTotalItemsCount,
    getSubtotal,
    appendCartItems,
    replaceCartItems,
  } = useCartStore();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reorder cup popup state
  const [reorderModalVisible, setReorderModalVisible] = useState(false);
  const [selectedReorderOrder, setSelectedReorderOrder] = useState<OrderRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await fetchUserOrders(1, 100);
      if (res && res.orders && res.orders.length > 0) {
        const mappedOrders: OrderRecord[] = res.orders.map((o: any) => {
          const rawStatus = String(o.order_status || o.status || 'PLACED').toUpperCase();
          let status: 'DELIVERED' | 'DISPATCHED' | 'PACKED' | 'CONFIRMED' | 'PLACED' | 'CANCELLED' = 'PLACED';
          let stepIndex = 1;
          let statusLabel = 'Waiting for Confirmation';
          let eta = 'Awaiting Admin Confirmation';

          if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') {
            status = 'CANCELLED';
            stepIndex = 0;
            statusLabel = 'Cancelled';
            eta = o.rejection_reason ? `Reason: ${o.rejection_reason}` : 'Order cancelled';
          } else if (rawStatus === 'DELIVERED') {
            status = 'DELIVERED';
            stepIndex = 4;
            statusLabel = 'Delivered to Doorstep';
            eta = 'Delivered Fresh';
          } else if (rawStatus === 'DISPATCHED') {
            status = 'DISPATCHED';
            stepIndex = 3;
            statusLabel = 'Out for Express Delivery';
            eta = o.tracking_number ? `Tracking: ${o.tracking_number}` : 'Arriving in ~20 mins';
          } else if (rawStatus === 'PACKED' || rawStatus === 'APPROVED') {
            status = 'PACKED';
            stepIndex = 2;
            statusLabel = 'Packed & Quality Verified';
            eta = 'Ready for dispatch';
          } else if (rawStatus === 'CONFIRMED') {
            status = 'CONFIRMED';
            stepIndex = 2;
            statusLabel = 'Order Confirmed';
            eta = 'Confirmed by estate';
          } else {
            status = 'PLACED';
            stepIndex = 1;
            statusLabel = 'Waiting for Confirmation';
            eta = 'Awaiting Admin Confirmation';
          }

          const addr = o.address_snapshot;
          const addressStr = addr
            ? `${addr.tag || 'Home'} • ${addr.line1 || addr.addressLine || ''}, ${addr.city || ''}`
            : 'Delivery Address';

          return {
            id: o.order_number || `VRD-${o.id}`,
            rawId: Number(o.id),
            date: new Date(o.created_at).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            status,
            statusLabel,
            eta,
            stepIndex,
            deliveryAddress: addressStr,
            items: (o.items || []).map((it: any) => ({
              id: it.id,
              productId: it.product_id,
              variantId: it.variant_id,
              name: it.product_name,
              variant: it.variant_label,
              qty: it.quantity,
              price: Number(it.unit_price),
              imageUrl: it.product_image || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
            })),
            total: Number(o.total_amount || o.total),
            hasReviewed: Boolean(o.has_reviewed || o.is_reviewed || o.review),
            paymentMethod: o.payment_method === 'ONLINE' ? 'Online UPI' : 'Cash on Delivery',
            paymentStatus: o.payment_status || (o.payment_method === 'COD' ? 'PENDING' : 'PAID'),
            rejectionReason: o.rejection_reason || undefined,
          };
        });
        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.warn('Error loading dynamic orders:', e);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Listen for real-time order status changes and new orders from socket
  useEffect(() => {
    const handleStatusUpdated = (data: any) => {
      try {
        if (!data) return;
        const targetId = String(data.orderNumber || (data.orderId ? `VRD-${data.orderId}` : ''));
        const rawStatus = String(data.status || '').toUpperCase();

        let newStatus: 'DELIVERED' | 'DISPATCHED' | 'PACKED' | 'CONFIRMED' | 'PLACED' | 'CANCELLED' = 'PLACED';
        let stepIndex = 1;
        let statusLabel = 'Waiting for Confirmation';
        let eta = 'Awaiting Admin Confirmation';

        if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') {
          newStatus = 'CANCELLED';
          stepIndex = 0;
          statusLabel = 'Cancelled';
          eta = data.rejectionReason ? `Reason: ${data.rejectionReason}` : 'Order cancelled';
        } else if (rawStatus === 'DELIVERED') {
          newStatus = 'DELIVERED';
          stepIndex = 4;
          statusLabel = 'Delivered to Doorstep';
          eta = 'Delivered Fresh';
        } else if (rawStatus === 'DISPATCHED') {
          newStatus = 'DISPATCHED';
          stepIndex = 3;
          statusLabel = 'Out for Express Delivery';
          eta = data.trackingNumber ? `Tracking: ${data.trackingNumber}` : 'Arriving in ~20 mins';
        } else if (rawStatus === 'PACKED' || rawStatus === 'APPROVED') {
          newStatus = 'PACKED';
          stepIndex = 2;
          statusLabel = 'Packed & Quality Verified';
          eta = 'Ready for dispatch';
        } else if (rawStatus === 'CONFIRMED') {
          newStatus = 'CONFIRMED';
          stepIndex = 2;
          statusLabel = 'Order Confirmed';
          eta = 'Confirmed by estate';
        } else {
          newStatus = 'PLACED';
          stepIndex = 1;
          statusLabel = 'Waiting for Confirmation';
          eta = 'Awaiting Admin Confirmation';
        }

        setOrders((prev) =>
          prev.map((ord) => {
            if (ord.id === targetId || ord.id === `VRD-${data.orderId}`) {
              return {
                ...ord,
                status: newStatus,
                stepIndex,
                statusLabel,
                eta,
                paymentStatus: data.paymentStatus || ord.paymentStatus,
                rejectionReason: data.rejectionReason || ord.rejectionReason,
              };
            }
            return ord;
          })
        );

        // Also refresh list to ensure address and any other server-computed values are in sync
        loadOrders();
      } catch (err) {
        console.warn('Socket order.status_updated error:', err);
      }
    };

    const handleOrderCreated = () => {
      loadOrders();
    };

    socket.on('order.status_updated', handleStatusUpdated);
    socket.on('order.created', handleOrderCreated);

    return () => {
      socket.off('order.status_updated', handleStatusUpdated);
      socket.off('order.created', handleOrderCreated);
    };
  }, []);

  const onRefresh = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    setRefreshing(true);
    loadOrders();
  };

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | number | null>(null);
  const [reviewItemName, setReviewItemName] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Strong Malty Kick');

  const reviewTags = [
    'Strong Malty Kick',
    'Perfect with Milk',
    'Fresh Cardamom Aroma',
    'Brisk Golden Color',
    'Fast 48 hrs Delivery',
  ];

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleOpenReorder = (order: OrderRecord) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }
    setSelectedReorderOrder(order);
    setReorderModalVisible(true);
  };

  const convertOrderToCartItems = (order: OrderRecord): CartItem[] => {
    return order.items.map((it) => {
      const pId = it.productId || it.id || 1;
      const vId = it.variantId || 1;
      const compositeId = `${pId}-${vId}`;

      return {
        id: compositeId,
        productId: pId,
        variantId: vId,
        productName: it.name,
        variantLabel: it.variant || 'Standard Pack',
        imageUrl:
          it.imageUrl ||
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
        price: it.price || 199,
        mrp: Math.round(Number(it.price || 199) * 1.25),
        quantity: it.qty || 1,
        maxStock: 50,
      };
    });
  };

  const handleAppendReorder = () => {
    if (!selectedReorderOrder) return;
    const newItems = convertOrderToCartItems(selectedReorderOrder);
    appendCartItems(newItems);
    setReorderModalVisible(false);
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    setToastMessage(`Appended ${newItems.length} item${newItems.length > 1 ? 's' : ''} to your cart! 🍵`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleReplaceReorder = () => {
    if (!selectedReorderOrder) return;
    const newItems = convertOrderToCartItems(selectedReorderOrder);
    replaceCartItems(newItems);
    setReorderModalVisible(false);
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    setToastMessage(`Cart replaced with order #${selectedReorderOrder.id}! ☕`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleHelp = (orderId: string) => {
    Alert.alert(
      `Support for Order #${orderId}`,
      'Our Tea Sommelier & Delivery Concierge is available 24/7. Would you like to call or chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Sommelier', onPress: () => { } },
        { text: 'Live Chat', onPress: () => { } },
      ]
    );
  };

  const activeOrders = useMemo(
    () => orders.filter((o) => ['PLACED', 'CONFIRMED', 'PACKED', 'DISPATCHED'].includes(o.status)),
    [orders]
  );
  const onTheWayOrders = useMemo(
    () => orders.filter((o) => o.status === 'DISPATCHED'),
    [orders]
  );
  const deliveredOrders = useMemo(
    () => orders.filter((o) => o.status === 'DELIVERED'),
    [orders]
  );
  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.status === 'CANCELLED'),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (activeTab === 'active' && !['PLACED', 'CONFIRMED', 'PACKED', 'DISPATCHED'].includes(o.status)) return false;
      if (activeTab === 'delivered' && o.status !== 'DELIVERED') return false;
      if (activeTab === 'cancelled' && o.status !== 'CANCELLED') return false;

      // Query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesItem = o.items.some((it) => it.name.toLowerCase().includes(q));
        return matchesId || matchesItem;
      }
      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Pagination State & Logic
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const flatListRef = useRef<FlatList>(null);

  const totalFilteredCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));

  // Reset page to 1 when tab, search query, or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, itemsPerPage]);

  // Ensure current page does not exceed total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFilteredCount);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    setCurrentPage(newPage);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const renderPaginationFooter = () => {
    if (totalFilteredCount === 0) return null;

    return (
      <View style={styles.paginationCard}>
        {/* Bottom Navigation Buttons */}
        {totalPages > 1 && (
          <View style={styles.paginationButtonsRow}>
            {/* Prev Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={[
                styles.pageNavBtn,
                currentPage === 1 && styles.pageNavBtnDisabled,
              ]}
            >
              <Icon
                name="chevron-left"
                size={16}
                color={currentPage === 1 ? '#9CA3AF' : theme.colors.primary}
              />
              <Text
                style={[
                  styles.pageNavBtnText,
                  currentPage === 1 && styles.pageNavBtnTextDisabled,
                ]}
              >
                Prev
              </Text>
            </TouchableOpacity>

            {/* Page Number Buttons */}
            <View style={styles.pageNumbersList}>
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <Text key={`ellipsis-${idx}`} style={styles.pageEllipsis}>
                      •••
                    </Text>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <TouchableOpacity
                    key={`page-${p}`}
                    activeOpacity={0.7}
                    onPress={() => handlePageChange(p)}
                    style={[
                      styles.pageNumberBtn,
                      isActive && styles.pageNumberBtnActive,
                    ]}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={['#1A5D38', '#2D8B55']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.pageNumberGradient}
                      >
                        <Text style={styles.pageNumberTextActive}>{p}</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.pageNumberText}>{p}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Next Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={[
                styles.pageNavBtn,
                currentPage === totalPages && styles.pageNavBtnDisabled,
              ]}
            >
              <Text
                style={[
                  styles.pageNavBtnText,
                  currentPage === totalPages && styles.pageNavBtnTextDisabled,
                ]}
              >
                Next
              </Text>
              <Icon
                name="chevron-right"
                size={16}
                color={currentPage === totalPages ? '#9CA3AF' : theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const activeOrdersCount = activeOrders.length;

  const renderOrderCard = ({ item }: { item: OrderRecord }) => {
    const isDispatched = item.status === 'DISPATCHED';
    const isPacked = item.status === 'PACKED';
    const isConfirmed = item.status === 'CONFIRMED';
    const isPlaced = item.status === 'PLACED';
    const isCancelled = item.status === 'CANCELLED';
    const isDelivered = item.status === 'DELIVERED';

    return (
      <View style={[styles.orderCard, isDispatched && styles.orderCardActive, isCancelled && styles.orderCardCancelled]}>
        {/* Card Accent Top Bar for Active Orders */}
        {isDispatched ? (
          <LinearGradient
            colors={theme.colors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.activeTopStrip}
          >
            <View style={styles.pulseContainer}>
              <View style={styles.radarPulse} />
              <View style={styles.radarDot} />
            </View>
            <Text style={styles.activeTopStripText}>
              LIVE DELIVERY • {item.eta.toUpperCase()}
            </Text>
          </LinearGradient>
        ) : null}

        {/* Header: Order ID, Date & Status Chip */}
        <View style={styles.orderHeader}>
          <View>
            <View style={styles.orderIdRow}>
              <Text style={styles.orderId}>#{item.id}</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Copied!', `Order ID #${item.id} copied to clipboard.`);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="copy" size={12} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.orderDate}>{item.date}</Text>
          </View>

          {isCancelled ? (
            <View style={[styles.statusBadge, styles.statusBadgeCancelled]}>
              <Icon name="x" size={12} color="#DC2626" />
              <Text style={[styles.statusBadgeText, styles.statusTextCancelled]}>
                Cancelled
              </Text>
            </View>
          ) : isPlaced ? (
            <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <Icon name="clock" size={12} color="#D97706" />
              <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
                {item.statusLabel}
              </Text>
            </View>
          ) : isDispatched ? (
            <View style={[styles.statusBadge, styles.statusBadgeDispatched]}>
              <Icon name="truck" size={12} color="#B45309" />
              <Text style={[styles.statusBadgeText, styles.statusTextDispatched]}>
                {item.statusLabel}
              </Text>
            </View>
          ) : isPacked ? (
            <View style={[styles.statusBadge, styles.statusBadgePacked]}>
              <Icon name="package" size={12} color="#2563EB" />
              <Text style={[styles.statusBadgeText, styles.statusTextPacked]}>
                {item.statusLabel}
              </Text>
            </View>
          ) : isDelivered ? (
            <View style={[styles.statusBadge, styles.statusBadgeDelivered]}>
              <Icon name="badge-check" size={12} color="#15803D" />
              <Text style={[styles.statusBadgeText, styles.statusTextDelivered]}>
                {item.statusLabel}
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusBadgeConfirmed]}>
              <Icon name="badge-check" size={12} color="#059669" />
              <Text style={[styles.statusBadgeText, styles.statusTextConfirmed]}>
                {item.statusLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Cancellation Notice if Cancelled */}
        {isCancelled && (
          <View style={styles.cancellationBanner}>
            <View style={styles.cancellationIconWrap}>
              <Icon name="alert-triangle" size={12} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cancellationTitle}>Order Cancelled by Estate</Text>
              {item.rejectionReason ? (
                <Text style={styles.cancellationReason}>Reason: {item.rejectionReason}</Text>
              ) : (
                <Text style={styles.cancellationReason}>Stock unavailable or harvest batch delayed.</Text>
              )}
            </View>
          </View>
        )}

        {/* Active Order Mini Stepper */}
        {isDispatched ? (
          <View style={styles.liveStepperContainer}>
            <View style={styles.stepperBarTrack}>
              <View style={[styles.stepperBarFill, { width: '75%' }]} />
            </View>
            <View style={styles.stepperStepsRow}>
              <Text style={styles.stepperStepDone}>Placed</Text>
              <Text style={styles.stepperStepDone}>Packed</Text>
              <Text style={styles.stepperStepActive}>On The Way</Text>
              <Text style={styles.stepperStepPending}>Doorstep</Text>
            </View>
          </View>
        ) : null}

        {/* Items List with Thumbnails */}
        <View style={styles.itemsList}>
          {item.items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Image
                source={{ uri: getFullImageUrl(it.imageUrl) }}
                style={styles.itemThumbnail}
                resizeMode="contain"
              />

              <View style={styles.itemInfoCol}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {it.name}
                </Text>
                <View style={styles.itemSubRow}>
                  <Text style={styles.itemVariantText}>{it.variant}</Text>
                  <Text style={styles.itemQtyText}>Qty: {it.qty}</Text>
                </View>
              </View>

              <View style={styles.itemPriceCol}>
                <Text style={styles.itemPrice}>₹{it.price * it.qty}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Destination & Payment Summary */}
        <View style={styles.orderMetaBar}>
          <View style={styles.metaAddressRow}>
            <Icon name="map-pin" size={11} color={theme.colors.textSecondary} />
            <Text style={styles.metaAddressText} numberOfLines={1}>
              {item.deliveryAddress}
            </Text>
          </View>
          <View style={styles.metaPaymentRow}>
            <Icon name="tag" size={11} color={theme.colors.textSecondary} />
            <Text style={styles.metaPaymentText}>
              {item.paymentMethod}
              {item.paymentStatus === 'PAID'
                ? ' • Paid'
                : item.paymentStatus === 'PENDING'
                  ? ' • Unpaid'
                  : ''}
            </Text>
          </View>
        </View>

        {/* Footer with Price and Primary Actions */}
        <View style={styles.orderFooter}>
          <View style={styles.orderFooterTop}>
            <View>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalAmount}>₹{item.total}</Text>
            </View>

            {/* Help Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleHelp(item.id)}
              style={styles.helpBtn}
            >
              <Icon name="sparkles" size={13} color={theme.colors.textSecondary} />
              <Text style={styles.helpBtnText}>Help</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionButtonsRow}>
            {/* Single Rate Order Button or Reviewed Badge for Delivered Orders */}
            {item.status === 'DELIVERED' ? (
              item.hasReviewed ? (
                <View style={styles.reviewedBadge}>
                  <Icon name="badge-check" size={14} color="#059669" />
                  <Text style={styles.reviewedBadgeText}>Order Rated</Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setReviewOrderId(item.rawId ? String(item.rawId) : item.id);
                    const names = item.items.map((i) => i.name).join(', ');
                    setReviewItemName(`Order #${item.id}${names ? ` • ${names}` : ''}`);
                    setReviewModalVisible(true);
                  }}
                  style={styles.rateOrderBtn}
                >
                  <Icon name="star" size={13} color="#D97706" fill="#D97706" />
                  <Text style={styles.rateOrderBtnText}>Rate Order</Text>
                </TouchableOpacity>
              )
            ) : null}

            {/* Live Track or Reorder */}
            {['PLACED', 'CONFIRMED', 'PACKED', 'DISPATCHED'].includes(item.status) ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: '/order-tracking',
                    params: { orderId: item.id, total: String(item.total) },
                  })
                }
                style={[
                  styles.trackOrderBtn,
                  isPlaced && { backgroundColor: '#D97706' },
                  (isConfirmed || isPacked) && { backgroundColor: '#2563EB' },
                ]}
              >
                <Icon
                  name={isDispatched ? 'zap' : isPlaced ? 'clock' : 'package'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.trackOrderText}>
                  {isDispatched ? 'Track Live' : isPlaced ? 'Track Status' : 'Track Order'}
                </Text>
              </TouchableOpacity>
            ) : isCancelled ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenReorder(item)}
                style={styles.reorderBtn}
              >
                <Icon name="refresh" size={13} color={theme.colors.primary} />
                <Text style={styles.reorderBtnText}>Order Again</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenReorder(item)}
                style={styles.reorderBtn}
              >
                <Icon name="coffee" size={14} color={theme.colors.primary} />
                <Text style={styles.reorderBtnText}>Reorder Cup</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP NAVBAR */}
      <View style={styles.topNav}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={16} color={theme.colors.textPrimary} />
          <Text style={styles.backText}>Shopping</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length} Harvest Shipments
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/cart')}
          style={styles.cartBtn}
        >
          <Icon name="shopping-bag" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 2. ON THE WAY CALLOUT BANNER (ONLY FOR DISPATCHED / ON THE WAY DELIVERIES) */}
      {onTheWayOrders.length > 0 ? (() => {
        const isMultiple = onTheWayOrders.length > 1;
        const bannerTitle = isMultiple
          ? `${onTheWayOrders.length} Tea Deliveries on the way!`
          : '1 Tea Delivery is on the way!';

        const bannerSubtitle = isMultiple
          ? `${onTheWayOrders.map((o) => '#' + o.id).join(' & ')} • Express delivery in progress`
          : `${onTheWayOrders[0]?.items?.[0]?.name || 'Fresh Garden Tea'}${(onTheWayOrders[0]?.items?.length || 0) > 1 ? ` +${onTheWayOrders[0].items.length - 1} more` : ''} • #${onTheWayOrders[0]?.id || ''}`;

        const handleTrackPress = () => {
          router.push({
            pathname: '/order-tracking',
            params: {
              orderIds: onTheWayOrders.map((o) => o.id).join(','),
              orderId: onTheWayOrders[0].id,
              total: String(onTheWayOrders[0].total),
            },
          });
        };

        return (
          <View style={styles.activeNoticeSection}>
            <LinearGradient
              colors={['#FFFBEB', '#FEF3C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeNoticeCard}
            >
              <View style={styles.activeNoticeIconCircle}>
                <Icon name="truck" size={16} color="#B45309" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.activeNoticeTitle} numberOfLines={1}>
                  {bannerTitle}
                </Text>
                <Text style={styles.activeNoticeSubtitle} numberOfLines={1}>
                  {bannerSubtitle}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTrackPress}
                style={styles.activeNoticePill}
              >
                <Text style={styles.activeNoticePillText}>Track</Text>
                <Icon name="chevron-right" size={11} color="#B45309" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        );
      })() : null}

      {/* 3. SEARCH & FILTER TABS */}
      <View style={styles.filterSection}>
        {/* Search input */}
        <View style={styles.searchBar}>
          <Icon name="search" size={13} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Order ID or tea name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            underlineColorAndroid="transparent"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={13} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab switcher */}
        <View style={styles.tabTrack}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('all')}
            style={[styles.tabChip, activeTab === 'all' && styles.tabChipActive]}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'all' && styles.tabChipTextActive,
              ]}
            >
              All Orders ({orders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('active')}
            style={[
              styles.tabChip,
              activeTab === 'active' && styles.tabChipActive,
            ]}
          >
            <View
              style={[
                styles.tabDot,
                activeTab === 'active' && styles.tabDotActive,
              ]}
            />
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'active' && styles.tabChipTextActive,
              ]}
            >
              In Transit ({activeOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('delivered')}
            style={[
              styles.tabChip,
              activeTab === 'delivered' && styles.tabChipActive,
            ]}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === 'delivered' && styles.tabChipTextActive,
              ]}
            >
              Delivered ({deliveredOrders.length})
            </Text>
          </TouchableOpacity>

          {cancelledOrders.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('cancelled')}
              style={[
                styles.tabChip,
                activeTab === 'cancelled' && styles.tabChipActive,
              ]}
            >
              <Text
                style={[
                  styles.tabChipText,
                  activeTab === 'cancelled' && styles.tabChipTextActive,
                ]}
              >
                Cancelled ({cancelledOrders.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Compact pagination summary bar at the top */}
        {totalFilteredCount > 0 && (
          <View style={styles.topPaginationBar}>
            <Text style={styles.topPaginationText}>
              Showing <Text style={styles.topPaginationBold}>{startIndex + 1}–{endIndex}</Text> of <Text style={styles.topPaginationBold}>{totalFilteredCount}</Text> orders
            </Text>
            {totalPages > 1 && (
              <View style={styles.topPageNavQuick}>
                <TouchableOpacity
                  disabled={currentPage === 1}
                  onPress={() => handlePageChange(currentPage - 1)}
                  style={[styles.topPageNavArrow, currentPage === 1 && { opacity: 0.35 }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="chevron-left" size={13} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.topPageNavStatus}>
                  Page {currentPage} of {totalPages}
                </Text>
                <TouchableOpacity
                  disabled={currentPage === totalPages}
                  onPress={() => handlePageChange(currentPage + 1)}
                  style={[styles.topPageNavArrow, currentPage === totalPages && { opacity: 0.35 }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="chevron-right" size={13} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 4. ORDERS LIST OR EMPTY STATE WITH PULL-TO-REFRESH */}
      {loading && orders.length === 0 ? (
        <OrdersSkeleton />
      ) : (
        <FlatList
          ref={flatListRef}
          data={paginatedOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderCard}
          contentContainerStyle={[
            styles.listContent,
            filteredOrders.length === 0 && { flexGrow: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor="#FFFFFF"
            />
          }
          ListFooterComponent={renderPaginationFooter}
          ListEmptyComponent={
            <EmptyState
              iconName="package"
              title="No Orders Found"
              subtitle={
                searchQuery.length > 0
                  ? `No orders matching "${searchQuery}". Try a different keyword.`
                  : 'Your fresh harvest chai orders will appear here.'
              }
              buttonLabel="Explore Fresh Teas"
              onButtonPress={() => router.push('/(tabs)')}
              style={{ marginTop: 32 }}
            />
          }
        />
      )}

      {/* 5. VERIFIED REVIEW MODAL */}
      <Modal visible={reviewModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="star" size={18} color="#D97706" fill="#D97706" />
                <Text style={styles.modalTitle}>Rate Your Order</Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                <Icon name="x" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalItemTitle}>{reviewItemName}</Text>

            {/* 5-Star Row */}
            <View style={styles.starPickerRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRating(s)}
                  style={{ padding: 6 }}
                >
                  <Icon
                    name="star"
                    size={32}
                    color={s <= rating ? '#D97706' : '#E5E7EB'}
                    fill={s <= rating ? '#D97706' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Brew Quality Tags */}
            <Text style={styles.tagsHeading}>How was your delivery & tea experience?</Text>
            <View style={styles.tagGrid}>
              {reviewTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setSelectedTag(tag)}
                    style={[
                      styles.reviewTagChip,
                      isSelected && styles.reviewTagChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reviewTagText,
                        isSelected && styles.reviewTagTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Tell other chai lovers how this batch brewed: aroma, color, boiling notes..."
              placeholderTextColor="#9CA3AF"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={async () => {
                setReviewModalVisible(false);
                const numId = Number(reviewOrderId);
                const safeOrderId = !isNaN(numId) && numId > 0 ? numId : (reviewOrderId || 'VRD-DEFAULT');
                try {
                  await api.post('/api/v1/reviews', {
                    orderId: safeOrderId,
                    rating,
                    title: selectedTag,
                    comment: reviewText.trim() || 'Wonderful brisk estate chai cup.',
                    reviewTags: [selectedTag],
                  });

                  // Mark order as reviewed immediately in UI state
                  setOrders((prev) =>
                    prev.map((ord) =>
                      ord.id === reviewOrderId || ord.rawId === numId || ord.id === String(safeOrderId)
                        ? { ...ord, hasReviewed: true }
                        : ord
                    )
                  );

                  Alert.alert(
                    'Review Submitted! 🌟',
                    'Thank you! Your verified feedback has been saved to the database.'
                  );
                } catch (e: any) {
                  const errorMsg = e?.response?.data?.message || 'Failed to submit review';
                  if (errorMsg.toLowerCase().includes('already submitted') || errorMsg.toLowerCase().includes('already reviewed')) {
                    setOrders((prev) =>
                      prev.map((ord) =>
                        ord.id === reviewOrderId || ord.rawId === numId || ord.id === String(safeOrderId)
                          ? { ...ord, hasReviewed: true }
                          : ord
                      )
                    );
                    Alert.alert('Notice', 'You have already submitted a review for this order.');
                  } else {
                    console.warn('Review API error:', e);
                    Alert.alert('Error', errorMsg);
                  }
                }
                setReviewText('');
              }}
              style={styles.submitReviewBtn}
            >
              <Text style={styles.submitReviewText}>Submit Verified Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 6. ATTRACTIVE REORDER CUP POPUP MODAL */}
      <Modal
        visible={reorderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReorderModalVisible(false)}
      >
        <View style={styles.reorderBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setReorderModalVisible(false)}
          />

          <View style={styles.reorderModalSheet}>
            {/* Grab handle */}
            <View style={styles.reorderHandleBar} />

            {/* Header */}
            <View style={styles.reorderHeader}>
              <View style={styles.reorderTitleWrap}>
                <View style={styles.reorderCupIconWrap}>
                  <Icon name="coffee" size={22} color="#0A3622" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.reorderTagBadge}>
                    <Text style={styles.reorderTagText}>FAST REORDER</Text>
                  </View>
                  <Text style={styles.reorderMainTitle}>Reorder Your Cup</Text>
                  <Text style={styles.reorderSubTitle}>
                    Order #{selectedReorderOrder?.id} • {selectedReorderOrder?.items.length || 0} item{(selectedReorderOrder?.items.length || 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.reorderCloseBtn}
                onPress={() => setReorderModalVisible(false)}
                activeOpacity={0.7}
              >
                <Icon name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current Cart Status Banner */}
            <View
              style={[
                styles.currentCartBanner,
                currentCartItems.length > 0
                  ? styles.currentCartBannerActive
                  : styles.currentCartBannerEmpty,
              ]}
            >
              <Icon
                name={currentCartItems.length > 0 ? 'shopping-bag' : 'check'}
                size={16}
                color={currentCartItems.length > 0 ? '#B45309' : '#15803D'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.currentCartBannerText,
                    currentCartItems.length > 0 ? { color: '#92400E' } : { color: '#166534' },
                  ]}
                >
                  {currentCartItems.length > 0
                    ? `Your cart currently has ${getTotalItemsCount()} item${getTotalItemsCount() > 1 ? 's' : ''} (₹${getSubtotal().toFixed(0)})`
                    : 'Your cart is currently empty'}
                </Text>
              </View>
            </View>

            {/* Items List Preview */}
            <View style={styles.reorderItemsBox}>
              <Text style={styles.reorderItemsHeaderTitle}>ORDER ITEMS TO ADD</Text>
              <FlatList
                data={selectedReorderOrder?.items || []}
                keyExtractor={(it) => String(it.id)}
                scrollEnabled={(selectedReorderOrder?.items?.length || 0) > 2}
                style={{ maxHeight: 150 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: it }) => (
                  <View style={styles.reorderItemRow}>
                    <Image
                      source={{ uri: it.imageUrl }}
                      style={styles.reorderItemThumb}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.reorderItemName} numberOfLines={1}>
                        {it.name}
                      </Text>
                      <Text style={styles.reorderItemVariant}>
                        {it.variant} • Qty: {it.qty}
                      </Text>
                    </View>
                    <Text style={styles.reorderItemPrice}>
                      ₹{(it.price * it.qty).toFixed(0)}
                    </Text>
                  </View>
                )}
              />
            </View>

            {/* Reorder Choices */}
            <View style={styles.reorderOptionsContainer}>
              {/* Option 1: Append in Cart */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleAppendReorder}
                style={styles.reorderActionCardAppend}
              >
                <View style={styles.reorderActionIconWrapAppend}>
                  <Icon name="layers" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <View style={styles.actionHeaderRow}>
                    <Text style={styles.reorderActionTitleAppend}>Append in Cart</Text>
                    <View style={styles.appendBadge}>
                      <Text style={styles.appendBadgeText}>Keep + Add</Text>
                    </View>
                  </View>
                  <Text style={styles.reorderActionDesc}>
                    Add items alongside your existing cart items without losing anything.
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color={theme.colors.primary} />
              </TouchableOpacity>

              {/* Option 2: Replace with Cart */}
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleReplaceReorder}
                style={styles.reorderActionCardReplace}
              >
                <View style={styles.reorderActionIconWrapReplace}>
                  <Icon name="refresh" size={20} color="#B45309" />
                </View>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <View style={styles.actionHeaderRow}>
                    <Text style={styles.reorderActionTitleReplace}>Replace with Cart</Text>
                    <View style={styles.replaceBadge}>
                      <Text style={styles.replaceBadgeText}>Fresh Start</Text>
                    </View>
                  </View>
                  <Text style={styles.reorderActionDesc}>
                    Clear existing cart and replace entirely with these order items.
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} color="#B45309" />
              </TouchableOpacity>
            </View>

            {/* Dismiss Footer */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setReorderModalVisible(false)}
              style={styles.reorderCancelBtn}
            >
              <Text style={styles.reorderCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastCard}>
            <Icon name="check" size={18} color="#FFFFFF" />
            <Text style={styles.toastText} numberOfLines={1}>
              {toastMessage}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/cart')}
              style={styles.toastCartBtn}
            >
              <Text style={styles.toastCartBtnText}>View Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topNav: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  backText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 10.5,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
    marginTop: 1,
  },
  cartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNoticeSection: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: 12,
    gap: 8,
  },
  activeNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  activePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  activeNoticeHeading: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  activeNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  activeNoticeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNoticeTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
  },
  activeNoticeSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
    marginTop: 1,
  },
  activeNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    gap: 3,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  activeNoticePillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
  },
  filterSection: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any)
      : {}),
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
      } as any)
      : {}),
  },
  tabTrack: {
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 5,
  },
  tabChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  tabDotActive: {
    backgroundColor: '#FFFFFF',
  },
  topPaginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  topPaginationText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  topPaginationBold: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  topPageNavQuick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  topPageNavArrow: {
    padding: 2,
  },
  topPageNavStatus: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  paginationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  paginationInfoRow: {
    display: "flex",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationSummary: {
    display: "flex",
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: "space-between",
    gap: 8,
  },
  paginationInfoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  paginationInfoBold: {
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  pageBadge: {
    backgroundColor: theme.colors.primaryMuted,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
  },
  pageBadgeText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  perPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  perPageLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginRight: 2,
  },
  perPagePill: {
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  perPagePillActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: theme.colors.primaryBorder || '#A5D6A7',
  },
  perPagePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  perPagePillTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  paginationButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryMuted,
  },
  pageNavBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  pageNavBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageNumbersList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumberBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pageNumberBtnActive: {
    borderColor: theme.colors.primary,
  },
  pageNumberGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  pageNumberTextActive: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
  pageEllipsis: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#9CA3AF',
    paddingHorizontal: 2,
  },
  listContent: {
    padding: theme.spacing.base,
    paddingBottom: 40,
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  orderCardActive: {
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
  },
  orderCardCancelled: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    backgroundColor: '#FFFDFD',
  },
  activeTopStrip: {
    marginHorizontal: -14,
    marginTop: -14,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseContainer: {
    position: 'relative',
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPulse: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  radarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  activeTopStripText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  orderId: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  orderDate: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  statusBadgeDispatched: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeDelivered: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgePacked: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusBadgeConfirmed: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
  },
  statusTextDispatched: {
    color: '#B45309',
  },
  statusTextDelivered: {
    color: '#15803D',
  },
  statusTextPacked: {
    color: '#2563EB',
  },
  statusTextConfirmed: {
    color: '#059669',
  },
  statusTextCancelled: {
    color: '#DC2626',
  },
  cancellationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  cancellationIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancellationTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  cancellationReason: {
    fontSize: 10,
    color: '#7F1D1D',
    marginTop: 1,
    lineHeight: 14,
  },
  liveStepperContainer: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperBarTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  stepperBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  stepperStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperStepDone: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#059669',
  },
  stepperStepActive: {
    fontSize: 9,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  stepperStepPending: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  itemsList: {
    paddingVertical: 8,
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  itemInfoCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemVariantText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  itemQtyText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.primary,
  },
  itemPriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemPrice: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  rateOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.2,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rateOrderBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: '#B45309',
  },
  reviewedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.2,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reviewedBadgeText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: '#065F46',
  },
  orderMetaBar: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
    gap: 4,
  },
  metaAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaAddressText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  metaPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaPaymentText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    marginTop: 6,
    gap: 10,
  },
  orderFooterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    marginTop: 1,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpBtnText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  trackOrderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  trackOrderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
  },
  reorderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  reorderBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  modalItemTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginVertical: 8,
  },
  starPickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
  },
  tagsHeading: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reviewTagChip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
  },
  reviewTagChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  reviewTagText: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  reviewTagTextActive: {
    color: '#92400E',
    fontWeight: theme.typography.weights.bold,
  },
  reviewInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 11.5,
    color: theme.colors.textPrimary,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  submitReviewBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitReviewText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
  },

  /* Reorder Modal & Action Styles */
  reorderBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  reorderModalSheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  reorderHandleBar: {
    width: 44,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  reorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reorderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  reorderCupIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderTagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 2,
  },
  reorderTagText: {
    color: '#B45309',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  reorderMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  reorderSubTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  reorderCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  currentCartBannerActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  currentCartBannerEmpty: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  currentCartBannerText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  reorderItemsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  reorderItemsHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  reorderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reorderItemThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  reorderItemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  reorderItemVariant: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  reorderItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A3622',
    marginLeft: 8,
  },
  reorderOptionsContainer: {
    gap: 12,
    marginBottom: 12,
  },
  reorderActionCardAppend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  reorderActionIconWrapAppend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  reorderActionTitleAppend: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  appendBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  appendBadgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '700',
  },
  reorderActionDesc: {
    fontSize: 11.5,
    color: '#475569',
    lineHeight: 16,
  },
  reorderActionCardReplace: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  reorderActionIconWrapReplace: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderActionTitleReplace: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  replaceBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  replaceBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },
  reorderCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A3622',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    gap: 10,
    maxWidth: 500,
    width: '100%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  toastCartBtn: {
    backgroundColor: '#E8B923',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toastCartBtnText: {
    color: '#0A3622',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
