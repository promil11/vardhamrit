import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Icon } from '../components/common/Icon';
import { EmptyState } from '../components/common/EmptyState';
import { OrderTrackingSkeleton } from '../components/common/Skeleton';
import { fetchUserOrders } from '../services/orderClientService';
import { socket } from '../services/socketService';

interface Step {
  id: number;
  title: string;
  subtitle: string;
  time: string;
  completed: boolean;
  current: boolean;
}

interface OrderItemPreview {
  id: number;
  name: string;
  variant: string;
  qty: number;
  price: number;
  imageUrl: string;
}

interface TrackedOrder {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  statusLabel: string;
  eta: string;
  trackingNumber: string;
  deliveryAddress: string;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  rider: {
    name: string;
    fleet: string;
    rating: string;
    phone: string;
    otp: string;
  };
  items: OrderItemPreview[];
  steps: Step[];
}

const FALLBACK_TRACKING_ORDERS: Record<string, TrackedOrder> = {
  'VRD-781902': {
    id: 'VRD-781902',
    orderNumber: 'VRD-781902',
    date: 'Today, 04:30 PM',
    status: 'DISPATCHED',
    statusLabel: 'Out for Express Delivery',
    eta: 'Arriving in ~18 mins',
    trackingNumber: 'EXP-BLR-781902',
    deliveryAddress: 'Home • Flat 402, Green Glen Layout, Bangalore',
    total: 458,
    paymentMethod: 'UPI • Google Pay',
    rider: {
      name: 'Suresh Kumar',
      fleet: 'Vardhamrit Express Fleet',
      rating: '4.9 ★ (1.2k deliveries)',
      phone: '+91 98765 43210',
      otp: '4921',
    },
    items: [
      {
        id: 1,
        name: 'Vardhamrit Royal Assam CTC Chai',
        variant: '500 g Granules',
        qty: 1,
        price: 279,
        imageUrl:
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&q=80',
      },
      {
        id: 2,
        name: 'Royal Elaichi Green Cardamom Chai',
        variant: '250 g Whole Pods',
        qty: 1,
        price: 179,
        imageUrl:
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=300&q=80',
      },
    ],
    steps: [
      {
        id: 1,
        title: 'Order Placed & Confirmed',
        subtitle: 'Fresh estate harvest batch reserved',
        time: '04:30 PM',
        completed: true,
        current: false,
      },
      {
        id: 2,
        title: 'Packed at Siliguri Hub',
        subtitle: 'Sealed with aroma-lock technology',
        time: '04:38 PM',
        completed: true,
        current: false,
      },
      {
        id: 3,
        title: 'Out for Quick Delivery',
        subtitle: 'Assigned to your express rider Suresh Kumar',
        time: 'Est. 18 mins',
        completed: true,
        current: true,
      },
      {
        id: 4,
        title: 'Delivered at Doorstep',
        subtitle: 'Brisk golden cup at your door',
        time: 'Est. ~04:55 PM',
        completed: false,
        current: false,
      },
    ],
  },
  'VRD-265100': {
    id: 'VRD-265100',
    orderNumber: 'VRD-265100',
    date: 'Today, 04:15 PM',
    status: 'DISPATCHED',
    statusLabel: 'Out for Express Delivery',
    eta: 'Arriving in ~25 mins',
    trackingNumber: 'EXP-BLR-265100',
    deliveryAddress: 'Home • Flat 402, Green Glen Layout, Bangalore',
    total: 362,
    paymentMethod: 'UPI • Google Pay',
    rider: {
      name: 'Ramesh Patel',
      fleet: 'Vardhamrit Express Fleet',
      rating: '4.8 ★ (890 deliveries)',
      phone: '+91 98123 45678',
      otp: '3180',
    },
    items: [
      {
        id: 4,
        name: 'Vardhamrit Single Estate CTC Gold',
        variant: '250 g Granules',
        qty: 2,
        price: 169,
        imageUrl:
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&q=80',
      },
    ],
    steps: [
      {
        id: 1,
        title: 'Order Placed & Confirmed',
        subtitle: 'Single estate batch verified',
        time: '04:15 PM',
        completed: true,
        current: false,
      },
      {
        id: 2,
        title: 'Packed & Quality Verified',
        subtitle: 'Vacuum sealed for peak briskness',
        time: '04:22 PM',
        completed: true,
        current: false,
      },
      {
        id: 3,
        title: 'Out for Quick Delivery',
        subtitle: 'Assigned to Ramesh Patel on transit route',
        time: 'Est. 25 mins',
        completed: true,
        current: true,
      },
      {
        id: 4,
        title: 'Delivered at Doorstep',
        subtitle: 'Fresh artisanal chai delivery',
        time: 'Est. ~04:50 PM',
        completed: false,
        current: false,
      },
    ],
  },
};

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string;
    orderIds?: string;
    total?: string;
  }>();

  const [activeFilterTab, setActiveFilterTab] = useState<string>('all');
  const [dynamicOrders, setDynamicOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Parse requested IDs
  const requestedOrderIds = useMemo(() => {
    if (params.orderIds && params.orderIds.trim().length > 0) {
      return params.orderIds.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (params.orderId && params.orderId.trim().length > 0) {
      return [params.orderId.trim()];
    }
    return [];
  }, [params.orderIds, params.orderId]);

  useEffect(() => {
    async function loadOrdersFromBackend() {
      try {
        setLoading(true);
        const res = await fetchUserOrders(1, 50);
        if (res.orders && res.orders.length > 0) {
          const mapped: TrackedOrder[] = res.orders
            .filter((o: any) => {
              const oId = String(o.order_number || `VRD-${o.id}`);
              const rawStatus = String(o.order_status || o.status || '').toUpperCase();
              return (
                requestedOrderIds.includes(oId) ||
                ['PLACED', 'CONFIRMED', 'PACKED', 'DISPATCHED'].includes(rawStatus)
              );
            })
            .map((o: any, idx: number) => {
              const id = o.order_number || `VRD-${o.id}`;
              const fallbackRiders = [
                {
                  name: 'Suresh Kumar',
                  fleet: 'Vardhamrit Express Fleet',
                  rating: '4.9 ★ (1.2k deliveries)',
                  phone: '+91 98765 43210',
                  otp: '4921',
                },
                {
                  name: 'Ramesh Patel',
                  fleet: 'Vardhamrit Express Fleet',
                  rating: '4.8 ★ (890 deliveries)',
                  phone: '+91 98123 45678',
                  otp: '3180',
                },
              ];
              const rider = fallbackRiders[idx % fallbackRiders.length];
              const addr = o.address_snapshot;
              const addressStr = addr
                ? `${addr.tag || 'Home'} • ${addr.line1 || addr.addressLine || ''}, ${addr.city || ''}`
                : 'Home • Flat 402, Green Glen Layout, Bangalore';

              const rawStatus = String(o.order_status || o.status || 'PLACED').toUpperCase();

              let status = 'PLACED';
              let statusLabel = 'Waiting for Confirmation';
              let eta = 'Verification in progress';
              let steps: Step[] = [];

              if (rawStatus === 'CANCELLED' || rawStatus === 'REJECTED') {
                status = 'CANCELLED';
                statusLabel = 'Order Cancelled';
                eta = o.rejection_reason ? `Reason: ${o.rejection_reason}` : 'Cancelled';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch received',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Cancelled',
                    subtitle: o.rejection_reason || 'Order was cancelled or rejected by estate',
                    time: 'Cancelled',
                    completed: false,
                    current: true,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: 'Shipment halted',
                    time: 'N/A',
                    completed: false,
                    current: false,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Not delivered',
                    time: 'N/A',
                    completed: false,
                    current: false,
                  },
                ];
              } else if (rawStatus === 'DELIVERED') {
                status = 'DELIVERED';
                statusLabel = 'Delivered to Doorstep';
                eta = 'Delivered Fresh';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch reserved',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Confirmed & Packed',
                    subtitle: 'Aroma-lock technology sealed',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: `Delivered by express fleet ${rider.name}`,
                    time: 'Completed',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Brisk mountain tea at your door',
                    time: 'Delivered',
                    completed: true,
                    current: true,
                  },
                ];
              } else if (rawStatus === 'DISPATCHED') {
                status = 'DISPATCHED';
                statusLabel = 'Out for Express Delivery';
                eta = o.tracking_number ? `Tracking: ${o.tracking_number}` : idx === 0 ? 'Arriving in ~18 mins' : 'Arriving in ~25 mins';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch reserved',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Confirmed & Packed',
                    subtitle: 'Aroma-lock technology sealed',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: `Assigned to ${rider.name}`,
                    time: idx === 0 ? 'Est. ~18 mins' : 'Est. ~25 mins',
                    completed: true,
                    current: true,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Brisk mountain tea at your door',
                    time: 'Upcoming',
                    completed: false,
                    current: false,
                  },
                ];
              } else if (rawStatus === 'PACKED' || rawStatus === 'APPROVED') {
                status = 'PACKED';
                statusLabel = 'Packed & Ready for Dispatch';
                eta = 'Ready for Courier Pickup';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch reserved',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Confirmed & Packed',
                    subtitle: 'Aroma-lock technology sealed',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: 'Preparing for courier assignment',
                    time: 'Next',
                    completed: false,
                    current: true,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Brisk mountain tea at your door',
                    time: 'Upcoming',
                    completed: false,
                    current: false,
                  },
                ];
              } else if (rawStatus === 'CONFIRMED') {
                status = 'CONFIRMED';
                statusLabel = 'Order Confirmed by Estate';
                eta = 'Preparing for Packaging';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch reserved',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Confirmed & Packed',
                    subtitle: 'Confirmed by estate • Packing in progress',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: 'Courier partner will be assigned upon dispatch',
                    time: 'Upcoming',
                    completed: false,
                    current: true,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Brisk mountain tea at your door',
                    time: 'Upcoming',
                    completed: false,
                    current: false,
                  },
                ];
              } else {
                // rawStatus === 'PLACED' (or default / pending confirmation)
                status = 'PLACED';
                statusLabel = 'Waiting for Confirmation';
                eta = 'Est. ~24 hrs';
                steps = [
                  {
                    id: 1,
                    title: 'Order Placed',
                    subtitle: 'Fresh estate harvest batch reserved',
                    time: 'Verified',
                    completed: true,
                    current: false,
                  },
                  {
                    id: 2,
                    title: 'Order Confirmation',
                    subtitle: 'Waiting for tea estate admin to verify & confirm',
                    time: 'In Review',
                    completed: false,
                    current: true,
                  },
                  {
                    id: 3,
                    title: 'Out for Quick Delivery',
                    subtitle: 'Courier partner will be assigned once confirmed',
                    time: 'Upcoming',
                    completed: false,
                    current: false,
                  },
                  {
                    id: 4,
                    title: 'Delivered at Doorstep',
                    subtitle: 'Brisk mountain tea at your door',
                    time: 'Upcoming',
                    completed: false,
                    current: false,
                  },
                ];
              }

              return {
                id,
                orderNumber: id,
                date: new Date(o.created_at).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                status,
                statusLabel,
                eta,
                trackingNumber: o.tracking_number || (status === 'DISPATCHED' ? `EXP-BLR-${id.replace(/\D/g, '') || '91823'}` : 'Pending assignment'),
                deliveryAddress: addressStr,
                total: Number(o.total_amount || o.total),
                paymentMethod: o.payment_method === 'ONLINE' ? 'UPI • Online' : 'Cash on Delivery',
                paymentStatus: o.payment_status || (o.payment_method === 'COD' ? 'PENDING' : 'PAID'),
                rider,
                items: (o.items || []).map((it: any) => ({
                  id: it.id,
                  name: it.product_name,
                  variant: it.variant_label,
                  qty: it.quantity,
                  price: Number(it.unit_price),
                  imageUrl:
                    it.product_image ||
                    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&q=80',
                })),
                steps,
              };
            });

          if (mapped.length > 0) {
            setDynamicOrders(mapped);
          } else {
            setDynamicOrders([]);
          }
        } else {
          setDynamicOrders([]);
        }
      } catch (e) {
        console.warn('Error loading dynamic tracking orders:', e);
        setDynamicOrders([]);
      } finally {
        setLoading(false);
      }
    }
    loadOrdersFromBackend();

    const handleStatusUpdated = () => {
      loadOrdersFromBackend();
    };

    socket.on('order.status_updated', handleStatusUpdated);
    socket.on('order.created', handleStatusUpdated);
    return () => {
      socket.off('order.status_updated', handleStatusUpdated);
      socket.off('order.created', handleStatusUpdated);
    };
  }, [requestedOrderIds]);

  // Combine dynamic orders or use fallback mock orders
  const allOnTheWayOrders: TrackedOrder[] = useMemo(() => {
    if (dynamicOrders.length > 0) {
      if (requestedOrderIds.length > 0) {
        const matching = dynamicOrders.filter((o) =>
          requestedOrderIds.includes(o.id)
        );
        if (matching.length > 0) return matching;
      }
      return dynamicOrders.slice(0, 2);
    }

    if (requestedOrderIds.length > 0) {
      const matchedFallback = requestedOrderIds
        .map((id) => FALLBACK_TRACKING_ORDERS[id])
        .filter(Boolean);
      if (matchedFallback.length > 0) {
        return matchedFallback;
      }
    }

    return [];
  }, [dynamicOrders, requestedOrderIds]);

  // Filter based on active tab
  const displayedOrders = useMemo(() => {
    if (activeFilterTab === 'all') return allOnTheWayOrders;
    return allOnTheWayOrders.filter((o) => o.id === activeFilterTab);
  }, [allOnTheWayOrders, activeFilterTab]);

  const isMultiple = allOnTheWayOrders.length > 1;

  const handleCallRider = (riderName: string, phone: string) => {
    Alert.alert(
      `Call Express Courier`,
      `Dialing express delivery partner ${riderName} (${phone})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Now', onPress: () => { } },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* 1. TOP NAVIGATION NAVBAR */}
        <View style={styles.topNav}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.replace('/(tabs)/orders')}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={16} color={theme.colors.primary} />
            <Text style={styles.backText}>Orders</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {isMultiple
                ? `${allOnTheWayOrders.length} Active Deliveries`
                : allOnTheWayOrders.length > 0
                  ? `Order #${allOnTheWayOrders[0]?.id}`
                  : 'Order Tracking'}
            </Text>
            <View style={styles.headerSubtitleRow}>
              <Icon name="zap" size={11} color={theme.colors.accentGoldDark} />
              <Text style={styles.headerSubtitle}>Live 48 hrs Express Tracking</Text>
            </View>
          </View>

          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {loading && allOnTheWayOrders.length === 0 ? (
          <OrderTrackingSkeleton />
        ) : allOnTheWayOrders.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <EmptyState
              iconName="truck"
              title="No Active Shipments"
              subtitle="You don't have any tea deliveries on the way right now."
              buttonLabel="View All Orders"
              onButtonPress={() => router.replace('/(tabs)/orders')}
            />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 2. HERO CALLOUT BANNER */}
            {(() => {
              const currentOrder = displayedOrders[0];
              const isOrderPlaced = currentOrder?.status === 'PLACED';
              const isOrderConfirmed = currentOrder?.status === 'CONFIRMED' || currentOrder?.status === 'PACKED';
              const isOrderDispatched = currentOrder?.status === 'DISPATCHED';
              const isOrderDelivered = currentOrder?.status === 'DELIVERED';

              const bannerBadge = isOrderPlaced
                ? 'AWAITING ADMIN CONFIRMATION'
                : isOrderConfirmed
                  ? 'ORDER CONFIRMED & PACKING'
                  : isOrderDispatched
                    ? 'EXPRESS FLEET DISPATCHED'
                    : isOrderDelivered
                      ? 'DELIVERY COMPLETED'
                      : 'ORDER UPDATE';

              const bannerTitle = isOrderPlaced
                ? 'Order Placed — Waiting for Confirmation'
                : isOrderConfirmed
                  ? 'Order Confirmed by Estate!'
                  : isOrderDispatched
                    ? (isMultiple ? `${allOnTheWayOrders.length} Tea Deliveries On The Way!` : '1 Tea Delivery On The Way!')
                    : isOrderDelivered
                      ? 'Delivered to Your Doorstep!'
                      : 'Order Status Update';

              const bannerSub = isOrderPlaced
                ? 'We have received your tea order. Our estate admin will review and confirm it shortly.'
                : isOrderConfirmed
                  ? 'Your order is confirmed and being sealed with aroma-lock technology for dispatch.'
                  : isOrderDispatched
                    ? (isMultiple ? 'All shipments are dispatched with our express tea riders.' : 'Your fresh harvest chai is arriving hot & brisk at your door.')
                    : isOrderDelivered
                      ? 'Your fresh harvest chai was safely delivered. Enjoy your exquisite tea cup!'
                      : 'Status has been updated by the team.';

              const bannerIcon = isOrderPlaced
                ? 'clock'
                : isOrderConfirmed
                  ? 'package'
                  : isOrderDispatched
                    ? 'truck'
                    : isOrderDelivered
                      ? 'badge-check'
                      : 'info';

              return (
                <LinearGradient
                  colors={
                    isOrderPlaced
                      ? ['#644f27ff', '#53410fff']
                      : isOrderConfirmed
                        ? ['#0C2548', '#143C73']
                        : ['#08281B', '#145338']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroBanner}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.heroBadgeRow}>
                      <View
                        style={[
                          styles.heroPulseCircle,
                          isOrderPlaced && { backgroundColor: '#F59E0B' },
                          isOrderConfirmed && { backgroundColor: '#38BDF8' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.heroBadgeText,
                          isOrderPlaced && { color: '#FDE68A' },
                          isOrderConfirmed && { color: '#BAE6FD' },
                        ]}
                      >
                        {bannerBadge}
                      </Text>
                    </View>
                    <Text style={styles.heroTitle}>{bannerTitle}</Text>
                    <Text style={styles.heroSub}>{bannerSub}</Text>
                  </View>

                  <View style={styles.heroIconCircle}>
                    <Icon
                      name={bannerIcon as any}
                      size={24}
                      color={isOrderPlaced ? '#FDE68A' : isOrderConfirmed ? '#BAE6FD' : '#FDE68A'}
                    />
                  </View>
                </LinearGradient>
              );
            })()}

            {/* 3. MULTI-ORDER SELECTOR TABS (IF MORE THAN 1 ORDER) */}
            {isMultiple && (
              <View style={styles.orderSwitcherRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveFilterTab('all')}
                  style={[
                    styles.switcherTab,
                    activeFilterTab === 'all' && styles.switcherTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.switcherTabText,
                      activeFilterTab === 'all' && styles.switcherTabTextActive,
                    ]}
                  >
                    All ({allOnTheWayOrders.length})
                  </Text>
                </TouchableOpacity>

                {allOnTheWayOrders.map((o) => {
                  const isActive = activeFilterTab === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      activeOpacity={0.8}
                      onPress={() => setActiveFilterTab(o.id)}
                      style={[
                        styles.switcherTab,
                        isActive && styles.switcherTabActive,
                      ]}
                    >
                      <Icon
                        name="truck"
                        size={12}
                        color={isActive ? '#FFFFFF' : '#B45309'}
                      />
                      <Text
                        style={[
                          styles.switcherTabText,
                          isActive && styles.switcherTabTextActive,
                        ]}
                      >
                        #{o.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* 4. BRIEF STATUS CARDS FOR THE 2 ON-THE-WAY ORDERS */}
            {displayedOrders.map((order, orderIdx) => {
              return (
                <View key={order.id} style={styles.briefCard}>
                  {/* Brief Card Header */}
                  <View style={styles.briefCardHeader}>
                    <View style={styles.briefHeaderLeftCol}>
                      <View style={styles.briefOrderIdRow}>
                        <Text style={styles.briefOrderId}>#{order.id}</Text>
                      </View>
                      <Text style={styles.briefOrderDate}>Placed {order.date}</Text>
                    </View>

                    <View
                      style={[
                        styles.etaBadge,
                        order.status === 'CONFIRMED' && {
                          backgroundColor: '#EFF6FF',
                          borderColor: '#BFDBFE',
                        },
                        order.status === 'DELIVERED' && {
                          backgroundColor: '#ECFDF5',
                          borderColor: '#A7F3D0',
                        },
                        order.status === 'CANCELLED' && {
                          backgroundColor: '#FEF2F2',
                          borderColor: '#FECACA',
                        },
                      ]}
                    >
                      <Icon
                        name={
                          order.status === 'DELIVERED'
                            ? 'badge-check'
                            : order.status === 'CANCELLED'
                              ? 'x'
                              : 'clock'
                        }
                        size={11}
                        color={
                          order.status === 'CONFIRMED'
                            ? '#1D4ED8'
                            : order.status === 'DELIVERED'
                              ? '#065F46'
                              : order.status === 'CANCELLED'
                                ? '#DC2626'
                                : '#92400E'
                        }
                      />
                      <Text
                        style={[
                          styles.etaBadgeText,
                          order.status === 'CONFIRMED' && { color: '#1D4ED8' },
                          order.status === 'DELIVERED' && { color: '#065F46' },
                          order.status === 'CANCELLED' && { color: '#DC2626' },
                        ]}
                        numberOfLines={1}
                      >
                        {order.eta}
                      </Text>
                    </View>
                  </View>

                  {/* Items Brief Preview */}
                  <View style={styles.itemsBriefContainer}>
                    {order.items.map((item) => (
                      <View key={item.id} style={styles.itemBriefRow}>
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.itemBriefThumb}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemBriefName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemBriefVariant}>
                            {item.variant} • Qty: {item.qty}
                          </Text>
                        </View>
                        <Text style={styles.itemBriefPrice}>
                          ₹{item.price * item.qty}
                        </Text>
                      </View>
                    ))}

                    <View style={styles.orderSummaryRow}>
                      <Text style={styles.summaryLabel}>
                        Total: <Text style={styles.summaryTotal}>₹{order.total}</Text>
                      </Text>
                      <Text style={styles.summaryMethod}>
                        {order.paymentMethod}
                        {order.paymentStatus === 'PAID' ? ' • Paid' : ' • Unpaid (COD)'}
                      </Text>
                    </View>
                  </View>

                  {/* Delivery Address Brief */}
                  <View style={styles.addressBriefRow}>
                    <Icon name="map-pin" size={14} color={theme.colors.primary} />
                    <Text style={styles.addressBriefText} numberOfLines={1}>
                      {order.deliveryAddress}
                    </Text>
                  </View>

                  {/* Courier / Rider Card OR Status Notice Card */}
                  {order.status === 'DISPATCHED' ? (
                    <View style={styles.riderBox}>
                      <View style={styles.riderAvatar}>
                        <Icon name="user" size={20} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={styles.riderNameLine}>
                          <Text style={styles.riderNameText}>
                            {order.rider.name}
                          </Text>
                          <View style={styles.otpPill}>
                            <Text style={styles.otpPillText}>
                              OTP: {order.rider.otp}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.riderFleetText}>
                          {order.rider.fleet} • {order.rider.rating}
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          handleCallRider(order.rider.name, order.rider.phone)
                        }
                        style={styles.callRiderButton}
                      >
                        <Icon name="phone" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : order.status === 'PLACED' ? (
                    <View style={styles.statusNoticeBox}>
                      <View style={[styles.statusNoticeIconWrap, { backgroundColor: '#FEF3C7' }]}>
                        <Icon name="clock" size={18} color="#D97706" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.statusNoticeTitle, { color: '#92400E' }]}>
                          Waiting for Order Confirmation
                        </Text>
                        <Text style={styles.statusNoticeSub}>
                          Our tea masters will verify your order. Once confirmed, packaging begins and an express delivery partner will be assigned.
                        </Text>
                      </View>
                    </View>
                  ) : order.status === 'CONFIRMED' || order.status === 'PACKED' ? (
                    <View style={styles.statusNoticeBox}>
                      <View style={[styles.statusNoticeIconWrap, { backgroundColor: '#EFF6FF' }]}>
                        <Icon name="package" size={18} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.statusNoticeTitle, { color: '#1D4ED8' }]}>
                          Order Confirmed & Preparing
                        </Text>
                        <Text style={styles.statusNoticeSub}>
                          Your tea has been verified by the estate and is being aroma-sealed for dispatch. Express rider will be assigned shortly.
                        </Text>
                      </View>
                    </View>
                  ) : order.status === 'DELIVERED' ? (
                    <View style={styles.statusNoticeBox}>
                      <View style={[styles.statusNoticeIconWrap, { backgroundColor: '#ECFDF5' }]}>
                        <Icon name="badge-check" size={18} color="#059669" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.statusNoticeTitle, { color: '#065F46' }]}>
                          Delivered to Doorstep
                        </Text>
                        <Text style={styles.statusNoticeSub}>
                          Your artisanal tea has been safely delivered. Thank you for drinking Vardhamrit!
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* 4-Step Connected Journey Timeline */}
                  <View style={styles.journeyTimelineBox}>
                    <Text style={styles.journeyHeading}>
                      DELIVERY JOURNEY ({order.steps.filter((s) => s.completed).length}/4 COMPLETE)
                    </Text>

                    <View style={styles.stepsFlow}>
                      {order.steps.map((st, sIdx) => {
                        const isLast = sIdx === order.steps.length - 1;
                        return (
                          <View key={st.id} style={styles.stepFlowRow}>
                            <View style={styles.flowNodeCol}>
                              <View
                                style={[
                                  styles.flowNodeCircle,
                                  st.completed && styles.flowNodeCompleted,
                                  st.current && styles.flowNodeCurrent,
                                ]}
                              >
                                {st.completed ? (
                                  <Icon
                                    name="check"
                                    size={11}
                                    color="#FFFFFF"
                                    strokeWidth={3}
                                  />
                                ) : (
                                  <View style={styles.flowDotInactive} />
                                )}
                              </View>
                              {!isLast && (
                                <View
                                  style={[
                                    styles.flowConnector,
                                    st.completed && styles.flowConnectorCompleted,
                                  ]}
                                />
                              )}
                            </View>

                            <View style={styles.flowStepContent}>
                              <View style={styles.flowTitleRow}>
                                <Text
                                  style={[
                                    styles.flowStepTitle,
                                    st.current && styles.flowStepTitleCurrent,
                                  ]}
                                >
                                  {st.title}
                                </Text>
                                <Text style={styles.flowStepTime}>{st.time}</Text>
                              </View>
                              <Text style={styles.flowStepSub}>{st.subtitle}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* 5. LIVE SOMMELIER / CONCIERGE HELP */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                Alert.alert(
                  'Tea Delivery Support',
                  'Our 24/7 Sommelier Concierge is available for real-time delivery assistance.',
                  [{ text: 'Close' }, { text: 'Live Chat', onPress: () => { } }]
                )
              }
              style={styles.helpCard}
            >
              <View style={styles.helpIconCircle}>
                <Icon name="message-square" size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.helpTitle}>Need help with these deliveries?</Text>
                <Text style={styles.helpSub}>
                  Connect directly with our 24/7 Tea Concierge team
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            {/* 6. BACK TO ALL ORDERS BUTTON */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.replace('/(tabs)/orders')}
              style={styles.returnOrdersBtn}
            >
              <Text style={styles.returnOrdersBtnText}>
                View All Orders History
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  backText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    color: theme.colors.accentGoldDark,
    fontWeight: theme.typography.weights.bold,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    color: '#15803D',
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: 40,
    gap: 14,
  },

  // Hero Callout
  heroBanner: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#08281B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroPulseCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  heroBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FDE68A',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    lineHeight: 16,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // Switcher Tabs
  orderSwitcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switcherTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  switcherTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  switcherTabText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  switcherTabTextActive: {
    color: '#FFFFFF',
  },

  // Brief Order Card
  briefCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    gap: 14,
  },
  briefCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  briefHeaderLeftCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  briefOrderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  briefOrderId: {
    fontSize: 14.5,
    fontWeight: theme.typography.weights.extraBold,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: theme.colors.textPrimary,
  },
  dispatchedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 4,
  },
  pulsingDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D97706',
  },
  dispatchedPillText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.bold,
    color: '#92400E',
    textTransform: 'uppercase',
  },
  briefOrderDate: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 3,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    gap: 4,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  etaBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#92400E',
  },

  // Items Brief
  itemsBriefContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemBriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemBriefThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemBriefName: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  itemBriefVariant: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 1,
  },
  itemBriefPrice: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#4B5563',
  },
  summaryTotal: {
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  summaryMethod: {
    fontSize: 10.5,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Address
  addressBriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  addressBriefText: {
    fontSize: 11,
    color: '#4B5563',
    flex: 1,
  },

  // Rider Card
  riderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 10,
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
  },
  statusNoticeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusNoticeTitle: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
  },
  statusNoticeSub: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 14,
  },
  riderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riderNameText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  otpPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  otpPillText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#B45309',
  },
  riderFleetText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  callRiderButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Journey Timeline Box
  journeyTimelineBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  journeyHeading: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  stepsFlow: {
    paddingLeft: 4,
  },
  stepFlowRow: {
    flexDirection: 'row',
  },
  flowNodeCol: {
    alignItems: 'center',
    width: 24,
  },
  flowNodeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  flowNodeCompleted: {
    backgroundColor: theme.colors.primary,
  },
  flowNodeCurrent: {
    backgroundColor: '#D97706',
    borderWidth: 3,
    borderColor: '#FEF3C7',
  },
  flowDotInactive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#9CA3AF',
  },
  flowConnector: {
    width: 2,
    height: 38,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
  flowConnectorCompleted: {
    backgroundColor: theme.colors.primary,
  },
  flowStepContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  flowTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flowStepTitle: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#4B5563',
  },
  flowStepTitleCurrent: {
    color: '#B45309',
    fontWeight: theme.typography.weights.extraBold,
  },
  flowStepTime: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  flowStepSub: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 1,
  },

  // Support Card
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  helpIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  helpSub: {
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 1,
  },

  // Return button
  returnOrdersBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnOrdersBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
});
