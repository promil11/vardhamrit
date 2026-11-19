import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { useAuth } from '../store/authContext';
import { useCartStore } from '../store/useCartStore';
import { useAddressStore } from '../store/useAddressStore';
import { Address } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socketService';
import { fetchUserAddresses, saveUserAddress } from '../services/addressService';
import { fetchUserCoins } from '../services/userClientService';
import { AddressBottomSheet } from '../components/home/AddressBottomSheet';
import { AddAddressModal } from '../components/checkout/AddAddressModal';
import { GokwikUpiModal, GokwikSessionData } from '../components/checkout/GokwikUpiModal';
import { CheckoutSkeleton } from '../components/common/Skeleton';
import { Icon, IconName } from '../components/common/Icon';
import { TeaCoinIcon } from '../components/common/TeaCoinIcon';

export type PaymentMethodType = 'UPI' | 'CARDS' | 'NETBANKING' | 'COD';

export interface DistanceFeeInfo {
  distanceKm: number;
  deliveryFee: number;
  handlingFee: number;
  isServiceable: boolean;
  maxDistanceKm?: number;
  message?: string;
}

interface PaymentOption {
  id: PaymentMethodType;
  title: string;
  subtitle: string;
  iconName: IconName;
  tag?: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: 'UPI',
    title: 'UPI (Google Pay, PhonePe, Paytm)',
    subtitle: 'Powered by GoKwik • UPI & Dynamic QR',
    iconName: 'zap',
    tag: 'FASTEST • GOKWIK',
  },
  {
    id: 'COD',
    title: 'Cash on Delivery (COD)',
    subtitle: 'Pay cash or UPI upon delivery at your doorstep',
    iconName: 'banknote',
  },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { addressId } = useLocalSearchParams<{ addressId?: string }>();
  const { user, setCoinsBalance } = useAuth();
  const {
    items,
    appliedCoupon,
    removeCoupon,
    clearCart,
    getSubtotal,
    getTotalSavings,
    getCouponDiscount,
    getFinalDeliveryFee,
    getGrandTotal,
    getTotalItemsCount,
  } = useCartStore();

  const totalCount = getTotalItemsCount();
  const subtotal = getSubtotal();
  const baseSavings = getTotalSavings();
  const couponDiscount = getCouponDiscount();

  const {
    addresses,
    selectedAddress,
    setSelectedAddress,
    loadAddresses,
    addNewAddress,
    isLoading: loadingAddresses,
  } = useAddressStore();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('UPI');
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  // GoKwik UPI Modal State
  const [gokwikModalVisible, setGokwikModalVisible] = useState(false);
  const [gokwikSession, setGokwikSession] = useState<GokwikSessionData | null>(null);

  // Coins State (Zepto-style wallet coins)
  const [userCoins, setUserCoins] = useState<number>(user?.coins_balance ?? 0);
  const [useCoins, setUseCoins] = useState<boolean>(true); // default true if user has coins

  // Dynamic Distance Pricing State (< 500m => Delivery: ₹30, Handling: ₹5)
  const [distanceInfo, setDistanceInfo] = useState<DistanceFeeInfo>({
    distanceKm: 0.4,
    deliveryFee: 30,
    handlingFee: 5,
    isServiceable: true,
    maxDistanceKm: 10,
  });
  const [calculatingFees, setCalculatingFees] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    async function fetchDynamicFees() {
      if (!selectedAddress) return;
      try {
        setCalculatingFees(true);
        const orderItems = items.map((it) => ({
          variantId: Number(it.variantId || 1),
          quantity: it.quantity,
        }));
        const res = await api.post('/api/v1/orders/calculate-fees', {
          address: selectedAddress,
          subtotal: getSubtotal(),
          items: orderItems,
        });
        if (!isCancelled && res.data?.success && res.data?.data) {
          setDistanceInfo(res.data.data);
          const { dealPrices } = res.data.data;
          if (dealPrices && Object.keys(dealPrices).length > 0) {
            let hasPriceChange = false;
            const updatedItems = items.map((it) => {
              const vId = Number(it.variantId);
              if (dealPrices[vId] !== undefined && Number(it.price) !== Number(dealPrices[vId])) {
                hasPriceChange = true;
                return {
                  ...it,
                  price: Number(dealPrices[vId]),
                  mrp: it.mrp ? Math.max(Number(it.mrp), Number(dealPrices[vId])) : Number(dealPrices[vId]),
                };
              }
              return it;
            });
            if (hasPriceChange) {
              useCartStore.getState().replaceCartItems(updatedItems);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to calculate distance fees:', err);
      } finally {
        if (!isCancelled) setCalculatingFees(false);
      }
    }

    fetchDynamicFees();
    return () => {
      isCancelled = true;
    };
  }, [selectedAddress, items]);

  useEffect(() => {
    loadAddresses(addressId);
  }, [addressId]);

  // Sync user coins from API & socket
  useEffect(() => {
    fetchUserCoins().then((res) => {
      if (res?.balance !== undefined) {
        setUserCoins(res.balance);
        setCoinsBalance(res.balance);
      }
    });

    const handleCoinsUpdated = (data: any) => {
      if (data?.coinsBalance !== undefined) {
        setUserCoins(data.coinsBalance);
        setCoinsBalance(data.coinsBalance);
      }
    };

    socket.on('user.coins_updated', handleCoinsUpdated);
    return () => {
      socket.off('user.coins_updated', handleCoinsUpdated);
    };
  }, []);

  // Check validity of applied coupon on checkout mount and when subtotal changes
  useEffect(() => {
    if (appliedCoupon?.code) {
      const minVal = Number(appliedCoupon.minOrderValue || 0);
      if (minVal > 0 && subtotal < minVal) {
        removeCoupon();
        return;
      }
      api
        .post('/api/v1/coupons/validate', {
          code: appliedCoupon.code,
          subtotal: getSubtotal(),
        })
        .catch((err) => {
          console.log(`Auto-removing disabled coupon in checkout "${appliedCoupon.code}":`, err.response?.data?.error || err.message);
          removeCoupon();
        });
    }
  }, [appliedCoupon?.code, subtotal]);

  // Real-time socket: If coupon is disabled while user is on checkout screen, remove it immediately
  useEffect(() => {
    const handleCouponDeactivated = (coupon: any) => {
      if (!coupon || !coupon.code) return;
      const isActive = coupon.is_active !== undefined ? Boolean(Number(coupon.is_active) === 1 || coupon.is_active === true) : true;
      if (!isActive && appliedCoupon && appliedCoupon.code.toUpperCase() === String(coupon.code).toUpperCase()) {
        removeCoupon();
      }
    };

    socket.on('coupon.updated', handleCouponDeactivated);
    socket.on('coupons.updated', (data: any) => {
      if (data?.coupon) handleCouponDeactivated(data.coupon);
    });

    return () => {
      socket.off('coupon.updated', handleCouponDeactivated);
      socket.off('coupons.updated', handleCouponDeactivated);
    };
  }, [appliedCoupon]);

  const handleSaveNewAddress = async (newAddr: Address) => {
    try {
      await addNewAddress(newAddr);
    } catch (e) {
      console.warn('Error saving new address to DB:', e);
    }
  };

  // Dynamic fees based on distance (< 500m => Delivery: ₹30, Handling: ₹5)
  const deliveryFee = distanceInfo.isServiceable ? distanceInfo.deliveryFee : 0;
  const handlingFee = distanceInfo.isServiceable ? distanceInfo.handlingFee : 0;

  // Coins Calculation (1 Coin = ₹1 Discount)
  const remainingSubtotal = Math.max(0, subtotal - couponDiscount);
  const maxRedeemableCoins = Math.min(userCoins, Math.floor(remainingSubtotal));
  const coinsToRedeem = useCoins && maxRedeemableCoins > 0 ? maxRedeemableCoins : 0;
  const coinsDiscount = coinsToRedeem;

  const grandTotal = Math.max(0, remainingSubtotal - coinsDiscount + deliveryFee + handlingFee);
  const totalSavings = baseSavings + coinsDiscount;

  const handlePlaceOrder = async () => {
    if (processing) return;

    if (!distanceInfo.isServiceable) {
      Alert.alert(
        'Delivery Unavailable',
        distanceInfo.message ||
        `This address is ${distanceInfo.distanceKm} km away. We currently only deliver within ${distanceInfo.maxDistanceKm || 10} km.`
      );
      return;
    }

    const hasSavedAddress = addresses.length > 0 && selectedAddress && !String(selectedAddress.id).startsWith('gps-');
    if (!hasSavedAddress && (!selectedAddress || addresses.length === 0 || String(selectedAddress?.id).startsWith('gps-'))) {
      setAddModalVisible(true);
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Haptics fallback
      }
    }

    setProcessing(true);

    try {
      const orderItems = items.map((it) => ({
        variantId: Number(it.variantId || 1),
        quantity: it.quantity,
      }));

      // 1. If user chose UPI (GoKwik): Initiate Payment Session FIRST
      // IMPORTANT: NO ORDER ROW IS CREATED IN DATABASE UNTIL PAYMENT IS RECEIVED!
      if (paymentMethod === 'UPI') {
        const sessionRes = await api.post('/api/v1/payments/gokwik/create-session', {
          address: selectedAddress,
          couponCode: appliedCoupon?.code,
          coinsToRedeem: coinsToRedeem,
          items: orderItems.length > 0 ? orderItems : [{ variantId: 81, quantity: 1 }],
        });

        const sessionData = sessionRes.data?.data;
        setGokwikSession(sessionData);
        setGokwikModalVisible(true);
        setProcessing(false);
        return;
      }

      // 2. For COD / Direct checkout:
      const res = await api.post('/api/v1/orders', {
        address: selectedAddress,
        paymentMethod: 'COD',
        couponCode: appliedCoupon?.code,
        coinsToRedeem: coinsToRedeem,
        items: orderItems.length > 0 ? orderItems : [{ variantId: 81, quantity: 1 }],
      });

      const orderData = res.data?.data;
      const orderNumber = orderData?.order_number || `VRD-${orderData?.id}`;
      const finalTotal = orderData?.total_amount ? Number(orderData.total_amount) : grandTotal;

      // Update remaining coins in auth state
      if (orderData?.coins_balance !== undefined) {
        setUserCoins(orderData.coins_balance);
        setCoinsBalance(orderData.coins_balance);
      }

      const coinsEarned = orderData?.coins_earned ?? Math.max(5, Math.round(Number(finalTotal) * 0.02));

      clearCart();
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: orderNumber,
          total: String(finalTotal),
          paymentMethod: 'COD',
          coinsEarned: String(coinsEarned),
        },
      });
    } catch (err: any) {
      console.warn('Place order error:', err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to place order. Please verify items and try again.';
      Alert.alert('Order Failed', errMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/cart');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Top Navbar with Back Button */}
        <View style={styles.topNav}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleBack}
            style={styles.backButton}
          >
            <Icon name="arrow-left" size={18} color={theme.colors.primary} />
            <Text style={styles.backText}>Cart</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={styles.headerSubtitleRow}>
              <Icon name="zap" size={12} color={theme.colors.accentGoldDark} />
              <Text style={styles.headerSubtitle}>Guaranteed 48 hrs Delivery</Text>
            </View>
          </View>

          <View style={styles.secureBadge}>
            <Icon name="shield-check" size={12} color={theme.colors.primary} />
            <Text style={styles.secureBadgeText}>100% Safe</Text>
          </View>
        </View>

        {loadingAddresses && addresses.length === 0 ? (
          <CheckoutSkeleton />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* STEP 1: DELIVERY ADDRESS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.stepNumTitle}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Delivery Address</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (addresses.length === 0) {
                      setAddModalVisible(true);
                    } else {
                      setAddressSheetVisible(true);
                    }
                  }}
                >
                  <Text style={styles.changeActionText}>{addresses.length > 0 ? 'CHANGE' : 'ADD'}</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Address Display Card */}
              {selectedAddress ? (
                <View style={styles.selectedAddrBox}>
                  <View style={styles.addrTagRow}>
                    <Text style={styles.addrTag}>{selectedAddress.tag}</Text>
                    <Text style={styles.addrName}>{selectedAddress.name}</Text>
                    <View style={styles.phonePill}>
                      <Icon name="phone" size={10} color={theme.colors.textSecondary} />
                      <Text style={styles.phonePillText}>{selectedAddress.phone}</Text>
                    </View>
                  </View>

                  <Text style={styles.addrDetails} numberOfLines={2}>
                    {selectedAddress.line1}, {selectedAddress.line2 ? `${selectedAddress.line2}, ` : ''}
                    {selectedAddress.city} - {selectedAddress.pincode}
                  </Text>

                  {/* Dynamic Distance & Zone Badge */}
                  {!distanceInfo.isServiceable ? (
                    <View style={styles.unserviceableBadge}>
                      <Icon name="alert-triangle" size={13} color="#DC2626" />
                      <Text style={styles.unserviceableBadgeText}>
                        {distanceInfo.message || `Address is ${distanceInfo.distanceKm} km away (Max limit 10 km)`}
                      </Text>
                    </View>
                  ) : (
                    <></>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setAddModalVisible(true)}
                  style={[styles.selectedAddrBox, { alignItems: 'center', paddingVertical: 18 }]}
                >
                  <Icon name="plus" size={20} color={theme.colors.primary} />
                  <Text style={{ marginTop: 6, fontSize: 13, fontWeight: '700', color: theme.colors.primary }}>
                    Add Delivery Address
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* STEP 2: PAYMENT METHOD SELECTION */}
            <View style={styles.sectionCard}>
              <View style={styles.stepNumTitle}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.sectionTitle}>Payment Method</Text>
              </View>

              <View style={styles.paymentList}>
                {PAYMENT_OPTIONS.map((opt) => {
                  const isSelected = paymentMethod === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.85}
                      onPress={() => setPaymentMethod(opt.id)}
                      style={[
                        styles.paymentItem,
                        isSelected && styles.paymentItemSelected,
                      ]}
                    >
                      {/* Radio Indicator */}
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>

                      {/* Icon & Title */}
                      <View style={styles.paymentInfo}>
                        <View style={styles.paymentTitleRow}>
                          <Text style={styles.paymentTitle}>{opt.title}</Text>
                          {opt.tag ? (
                            <View style={styles.paymentTag}>
                              <Text style={styles.paymentTagText}>{opt.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.paymentSub}>{opt.subtitle}</Text>
                      </View>

                      <View style={styles.paymentIconBox}>
                        <Icon
                          name={opt.iconName}
                          size={20}
                          color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* TEA COINS REDEMPTION CARD (Zepto Style) */}
            <View style={styles.coinsRedeemCard}>
              <View style={styles.coinsCardTopRow}>
                <View style={styles.coinsCardLeft}>
                  <View style={styles.coinIconBadge}>
                    <TeaCoinIcon size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.coinsCardTitle}>Vardhamrit Tea Coins</Text>
                      <View style={[styles.coinBalanceCapsule, userCoins >= 500 && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                        <Text style={[styles.coinBalanceCapsuleText, userCoins >= 500 && { color: '#B45309' }]}>
                          {userCoins} Coins{userCoins >= 500 ? ' (MAX)' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.coinsCardSubtitle}>
                      {userCoins > 0
                        ? <View style={{ display: "flex" }}>
                          <Text>Wallet Balance: ₹{userCoins}</Text>
                          <Text>1 Coin = ₹1 instant discount</Text>
                        </View>
                        : 'Earn ₹50 coins for every friend who joins with your code!'}
                    </Text>
                  </View>
                </View>

                {maxRedeemableCoins > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch { }
                      }
                      setUseCoins(!useCoins);
                    }}
                    style={[
                      styles.coinSwitchTrack,
                      useCoins && styles.coinSwitchTrackActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.coinSwitchThumb,
                        useCoins && styles.coinSwitchThumbActive,
                      ]}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              {useCoins && coinsDiscount > 0 ? (
                <View style={styles.coinsAppliedBanner}>
                  <Icon name="badge-check" size={14} color="#047857" />
                  <Text style={styles.coinsAppliedBannerText}>
                    Saving ₹{coinsDiscount} on this order using {coinsToRedeem} Tea Coins!
                  </Text>
                </View>
              ) : maxRedeemableCoins > 0 ? (
                <TouchableOpacity
                  onPress={() => setUseCoins(true)}
                  style={styles.coinsTeaserHintRow}
                  activeOpacity={0.7}
                >
                  <Icon name="sparkles" size={12} color="#D97706" />
                  <Text style={styles.coinsTeaserHintText}>
                    Toggle switch to save ₹{maxRedeemableCoins} on this order
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* STEP 3: ORDER REVIEW */}
            <View style={styles.sectionCard}>
              <View style={styles.stepNumTitle}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.sectionTitle}>
                  Order Items ({totalCount} {totalCount === 1 ? 'item' : 'items'})
                </Text>
              </View>

              {/* Compact Item Review Rows */}
              <View style={styles.itemsReviewList}>
                {items.map((it) => (
                  <View key={it.id} style={styles.miniItemRow}>
                    <Text style={styles.miniItemName} numberOfLines={1}>
                      {it.quantity}x {it.productName}{' '}
                      <Text style={{ color: theme.colors.textSecondary }}>
                        ({it.variantLabel})
                      </Text>
                    </Text>
                    <Text style={styles.miniItemPrice}>₹{it.price * it.quantity}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              {/* Bill Summary */}
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billVal}>₹{subtotal.toFixed(0)}</Text>
              </View>

              {couponDiscount > 0 ? (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: theme.colors.success }]}>
                    Coupon Discount ({appliedCoupon?.code})
                  </Text>
                  <Text style={[styles.billVal, { color: theme.colors.success }]}>
                    −₹{couponDiscount.toFixed(0)}
                  </Text>
                </View>
              ) : null}

              {coinsDiscount > 0 ? (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: '#059669' }]}>
                    Tea Coins Redeemed ({coinsToRedeem})
                  </Text>
                  <Text style={[styles.billVal, { color: '#059669', fontWeight: '800' }]}>
                    −₹{coinsDiscount.toFixed(0)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.billRow}>
                <View style={styles.feeLabelRow}>
                  <Text style={styles.billLabel}>Delivery Partner Fee</Text>
                  <View style={styles.distanceTagPill}>
                    <Text style={styles.distanceTagPillText}>
                      {distanceInfo.distanceKm <= 0.5 ? '< 500m' : `${distanceInfo.distanceKm} km`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.billVal}>
                  {deliveryFee === 0 ? <Text style={styles.freeText}>FREE</Text> : `₹${deliveryFee}`}
                </Text>
              </View>

              <View style={styles.billRow}>
                <View style={styles.feeLabelRow}>
                  <Text style={styles.billLabel}>Handling & Packaging</Text>
                  <View style={styles.distanceTagPill}>
                    <Text style={styles.distanceTagPillText}>
                      {distanceInfo.distanceKm <= 0.5 ? 'Base ₹5' : `₹${handlingFee}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.billVal}>
                  {handlingFee === 0 ? <Text style={styles.freeText}>FREE</Text> : `₹${handlingFee}`}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.billRow}>
                <Text style={styles.toPayLabel}>Grand Total</Text>
                <Text style={styles.toPayVal}>₹{grandTotal.toFixed(0)}</Text>
              </View>

              {totalSavings > 0 ? (
                <View style={styles.savingsBanner}>
                  <Icon name="party-popper" size={16} color={theme.colors.success} />
                  <Text style={styles.savingsBannerText}>
                    You are saving ₹{totalSavings.toFixed(0)} on this order!
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* Sticky Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomTotalLabel}>Total Payable</Text>
            <Text style={styles.bottomTotalPrice}>₹{grandTotal.toFixed(0)}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePlaceOrder}
            disabled={processing || !distanceInfo.isServiceable}
            style={[styles.payNowBtnWrapper, (processing || !distanceInfo.isServiceable) && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={
                !distanceInfo.isServiceable
                  ? (['#9CA3AF', '#6B7280'] as any)
                  : (theme.colors.primaryGradient as any)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payNowBtn}
            >
              {processing ? (
                <ActivityIndicator color={theme.colors.textInverse} />
              ) : !distanceInfo.isServiceable ? (
                <View style={styles.payBtnContent}>
                  <Icon name="alert-triangle" size={14} color={theme.colors.textInverse} />
                  <Text style={styles.payNowBtnText}>Beyond 10 km (Unavailable)</Text>
                </View>
              ) : (
                <View style={styles.payBtnContent}>
                  {paymentMethod === 'COD' ? (
                    <>
                      <Text style={styles.payNowBtnText}>Confirm Order</Text>
                      <Icon name="package-check" size={16} color={theme.colors.textInverse} />
                    </>
                  ) : paymentMethod === 'UPI' ? (
                    <>
                      <Icon name="zap" size={14} color={theme.colors.textInverse} />
                      <Text style={styles.payNowBtnText}>Pay ₹{grandTotal.toFixed(0)} via GoKwik UPI</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="lock" size={14} color={theme.colors.textInverse} />
                      <Text style={styles.payNowBtnText}>Pay ₹{grandTotal.toFixed(0)}</Text>
                    </>
                  )}
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Address Selection Bottom Sheet */}
        <AddressBottomSheet
          visible={addressSheetVisible}
          onClose={() => setAddressSheetVisible(false)}
          selectedAddressId={selectedAddress?.id || ''}
          onSelectAddress={(addr) => setSelectedAddress(addr)}
          onAddNewPress={() => setAddModalVisible(true)}
          addresses={addresses}
        />

        {/* Add Address Modal with Pincode auto-fill */}
        <AddAddressModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          onSaveAddress={handleSaveNewAddress}
          initialAddress={selectedAddress}
        />

        {/* GoKwik UPI Payment Gateway Bottom Sheet */}
        <GokwikUpiModal
          visible={gokwikModalVisible}
          session={gokwikSession}
          onClose={() => {
            setGokwikModalVisible(false);
            setGokwikSession(null);
          }}
          onPaymentSuccess={(confirmedId, confirmedOrderNum, confirmedAmt) => {
            setGokwikModalVisible(false);
            setGokwikSession(null);
            clearCart();
            fetchUserCoins().then((res) => {
              if (res?.balance !== undefined) {
                setUserCoins(res.balance);
                setCoinsBalance(res.balance);
              }
            });
            const earnedCoins = Math.max(5, Math.round(Number(confirmedAmt) * 0.02));
            router.replace({
              pathname: '/order-success',
              params: {
                orderId: confirmedOrderNum,
                total: String(confirmedAmt),
                paymentMethod: 'UPI',
                coinsEarned: String(earnedCoins),
              },
            });
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topNav: {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.subtle,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
  },
  backArrow: {
    fontSize: 18,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginRight: 4,
  },
  backText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.successMuted,
    borderWidth: 1,
    borderColor: theme.colors.success,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  secureBadgeText: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textSuccess,
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: 120,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    ...theme.shadows.subtle,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  stepNumTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.extraBold,
  },
  sectionTitle: {
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  changeActionText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  selectedAddrBox: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  addrTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: 4,
  },
  addrTag: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  addrName: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
    marginLeft: 'auto',
  },
  phonePillText: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  addrDetails: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.xs,
  },
  paymentList: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  paymentItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  paymentInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  paymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentTitle: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  paymentTag: {
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.xs,
    marginLeft: theme.spacing.xs,
  },
  paymentTagText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.scale.xs - 3,
    fontWeight: theme.typography.weights.extraBold,
  },
  paymentSub: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  paymentIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  itemsReviewList: {
    marginTop: theme.spacing.sm,
    gap: 4,
  },
  miniItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniItemName: {
    flex: 1,
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
    marginRight: theme.spacing.sm,
  },
  miniItemPrice: {
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: theme.typography.scale.xs + 1,
    color: theme.colors.textSecondary,
  },
  billVal: {
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  freeText: {
    color: theme.colors.success,
    fontWeight: theme.typography.weights.extraBold,
  },
  toPayLabel: {
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  toPayVal: {
    fontSize: theme.typography.scale.lg,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.successMuted,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm + 2,
    marginTop: theme.spacing.md,
  },
  savingsBannerText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textSuccess,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  bottomTotalLabel: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  bottomTotalPrice: {
    fontSize: theme.typography.scale.xl,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  payNowBtnWrapper: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  payNowBtn: {
    paddingVertical: theme.spacing.md - 2,
    paddingHorizontal: theme.spacing.xl,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payNowBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.3,
  },

  // Zepto-style Tea Coins Redeem Card
  coinsRedeemCard: {
    backgroundColor: '#FFFDF5',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  coinsCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coinsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  coinIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinsCardTitle: {
    fontSize: theme.typography.scale.sm + 0.5,
    fontWeight: theme.typography.weights.bold,
    color: '#92400E',
  },
  coinBalanceCapsule: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  coinBalanceCapsuleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#78350F',
  },
  coinsCardSubtitle: {
    fontSize: theme.typography.scale.xs - 0.5,
    color: '#B45309',
    marginTop: 2,
  },
  coinSwitchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  coinSwitchTrackActive: {
    backgroundColor: '#059669',
  },
  coinSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  coinSwitchThumbActive: {
    transform: [{ translateX: 20 }],
  },
  coinsAppliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
  coinsAppliedBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  coinsTeaserHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
  },
  coinsTeaserHintText: {
    fontSize: 10.5,
    color: '#B45309',
    fontWeight: theme.typography.weights.medium,
  },
  distanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.xs,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignSelf: 'flex-start',
  },
  distanceBadgeText: {
    fontSize: theme.typography.scale.xs - 1,
    color: '#166534',
    fontWeight: theme.typography.weights.bold,
  },
  unserviceableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  unserviceableBadgeText: {
    fontSize: theme.typography.scale.xs - 1,
    color: '#DC2626',
    fontWeight: theme.typography.weights.bold,
    flex: 1,
  },
  feeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceTagPill: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  distanceTagPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
});
