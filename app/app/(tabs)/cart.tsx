import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { useCartStore, getHandlingFeeTier } from '../../store/useCartStore';
import { useAddressStore } from '../../store/useAddressStore';
import { CartItem } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { CouponBottomSheet } from '../../components/cart/CouponBottomSheet';
import { AddressBottomSheet } from '../../components/home/AddressBottomSheet';
import { AddAddressModal } from '../../components/checkout/AddAddressModal';
import { CartSkeleton } from '../../components/common/Skeleton';
import { fetchUserAddresses, saveUserAddress } from '../../services/addressService';
import { Address } from '../../types';
import { Icon } from '../../components/common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';
import { api } from '../../services/api';
import { socket } from '../../services/socketService';
import { formatHeaderAddress } from '../../services/locationService';
import { useResponsive } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const {
    items,
    incrementQuantity,
    decrementQuantity,
    removeItem,
    appliedCoupon,
    removeCoupon,
    getSubtotal,
    getTotalSavings,
    getCouponDiscount,
    getFinalDeliveryFee,
    getGrandTotal,
    getFreeDeliveryProgress,
    getAmountNeededForFreeDelivery,
    getTotalItemsCount,
    isSyncing,
  } = useCartStore();

  const totalCount = getTotalItemsCount();
  const subtotal = getSubtotal();
  const totalSavings = getTotalSavings();
  const couponDiscount = getCouponDiscount();

  const [couponSheetVisible, setCouponSheetVisible] = useState(false);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [addAddressModalVisible, setAddAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<{
    distanceKm: number;
    deliveryFee: number;
    handlingFee: number;
    isServiceable: boolean;
    maxDistanceKm?: number;
    message?: string;
  } | null>(null);

  const {
    addresses,
    selectedAddress,
    setSelectedAddress,
    loadAddresses,
    addNewAddress,
    updateAddress,
  } = useAddressStore();

  useEffect(() => {
    let isCancelled = false;
    async function fetchDynamicFees() {
      if (!selectedAddress) {
        setDistanceInfo(null);
        return;
      }
      try {
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
        console.warn('Failed to calculate distance fees in cart:', err);
      }
    }

    fetchDynamicFees();
    return () => {
      isCancelled = true;
    };
  }, [selectedAddress, items]);

  const handleSaveAddress = async (savedAddr: Address) => {
    try {
      if (
        editingAddress?.id &&
        !String(editingAddress.id).startsWith('addr-') &&
        !String(editingAddress.id).startsWith('gps-')
      ) {
        const updated = await updateAddress(editingAddress.id, savedAddr);
        if (updated) {
          setSelectedAddress(updated);
        }
      } else {
        const saved = await addNewAddress(savedAddr);
        if (saved) {
          setSelectedAddress(saved);
          router.push({
            pathname: '/checkout',
            params: { addressId: String(saved.id) },
          });
        }
      }
    } catch (e) {
      console.warn('Error saving address in cart:', e);
    } finally {
      setEditingAddress(null);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  // Validate applied coupon against backend and cart value
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
          console.log(`Auto-removing disabled coupon "${appliedCoupon.code}":`, err.response?.data?.error || err.message);
          removeCoupon();
        });
    }
  }, [appliedCoupon?.code, subtotal]);

  // Real-time socket: If coupon is disabled by admin while viewing cart, remove it immediately
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

  // Dynamic distance-based fees with Free Delivery above ₹499 & Tiered Handling Fee (1-499: 5%, 500-999: 3%, 1000-1999: 2%, 2000+: 1.5%)
  const handlingTier = getHandlingFeeTier(subtotal);
  const currentDeliveryFee = distanceInfo
    ? (distanceInfo.isServiceable ? (subtotal >= 499 ? 0 : distanceInfo.deliveryFee) : 0)
    : getFinalDeliveryFee();
  const currentHandlingFee = distanceInfo
    ? (distanceInfo.isServiceable ? distanceInfo.handlingFee : handlingTier.fee)
    : handlingTier.fee;
  const currentGrandTotal = Math.max(0, subtotal - couponDiscount + currentDeliveryFee + currentHandlingFee);
  const freeProgress = getFreeDeliveryProgress();
  const amountNeeded = getAmountNeededForFreeDelivery();

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.itemCard}>
      <Image
        source={{ uri: getFullImageUrl(item.imageUrl) }}
        style={styles.itemImage}
        resizeMode="contain"
      />

      <View style={styles.itemDetails}>
        <View style={styles.itemTitleRow}>
          <Text style={[styles.itemName, isTablet && { fontSize: 16.5, lineHeight: 22 }]} numberOfLines={1}>
            {item.productName}
          </Text>
          <TouchableOpacity
            onPress={() => removeItem(item.productId, item.variantId, item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="trash" size={17} color={theme.colors.error} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.itemVariant, isTablet && { fontSize: 13.5 }]}>Pack: {item.variantLabel}</Text>

        <View style={styles.itemPriceRow}>
          <Text style={[styles.itemPrice, isTablet && { fontSize: 18 }]}>₹{item.price}</Text>
          {item.mrp > item.price ? (
            <Text style={[styles.itemMrp, isTablet && { fontSize: 14 }]}>₹{item.mrp}</Text>
          ) : null}
        </View>

        {/* Stepper + Line Total */}
        <View style={styles.itemFooter}>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => decrementQuantity(item.productId, item.variantId, item.id)}
              style={styles.stepperBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="minus" size={14} color={theme.colors.textInverse} />
            </TouchableOpacity>

            <Text style={[styles.stepperQty, isTablet && { fontSize: 15 }]}>{item.quantity}</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => incrementQuantity(item.productId, item.variantId, item.id)}
              disabled={item.quantity >= item.maxStock}
              style={styles.stepperBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="plus" size={14} color={theme.colors.textInverse} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.lineTotal, isTablet && { fontSize: 18 }]}>₹{item.price * item.quantity}</Text>
        </View>
      </View>
    </View>
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topNav, isTablet && { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[styles.backButton, isTablet && { paddingVertical: 8, paddingHorizontal: 16 }]}
        >
          <Icon name="arrow-left" size={isTablet ? 18 : 16} color={theme.colors.textPrimary} style={{ marginRight: 4 }} />
          <Text style={[styles.backText, isTablet && { fontSize: 13.5 }]}>Shopping</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isTablet && { fontSize: 19 }]}>My Cart ({totalCount})</Text>
          <Text style={[styles.headerSubtitle, isTablet && { fontSize: 13 }]}>Vardhamrit Tea Quick-Commerce</Text>
        </View>

        <View style={[styles.expressBadge, isTablet && { paddingHorizontal: 10, paddingVertical: 5 }]}>
          <Icon name="zap" size={isTablet ? 13 : 11} color={theme.colors.accentGoldDark} style={{ marginRight: 3 }} />
          <Text style={[styles.expressText, isTablet && { fontSize: 12 }]}>48 hrs</Text>
        </View>
      </View>

      {isSyncing && items.length === 0 ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          iconName="shopping-bag"
          title="Your Tea Cart is Empty"
          subtitle="Explore our freshly packed garden CTC, Elaichi & Himalayan whole leaf blends"
          buttonLabel="Explore Teas"
          onButtonPress={() => router.push('/(tabs)')}
        />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderCartItem}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(insets.bottom + 120, 150) },
            ]}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {/* 1. Delivery Time Banner */}
                <View style={styles.deliveryBanner}>
                  <View style={styles.deliveryBannerTopRow}>
                    <View style={styles.deliveryBannerTop}>
                      <Icon name="zap" size={16} color={theme.colors.primary} />
                      <Text style={[styles.deliveryBannerTitle, isTablet && { fontSize: 16.5 }]}>
                        Delivery in 48 hrs ({totalCount} {totalCount === 1 ? 'item' : 'items'})
                      </Text>
                    </View>
                    {distanceInfo ? (
                      <View
                        style={[
                          styles.distanceHeaderBadge,
                          !distanceInfo.isServiceable && styles.distanceHeaderBadgeError,
                        ]}
                      >
                        <Icon
                          name={distanceInfo.isServiceable ? 'map-pin' : 'alert-triangle'}
                          size={13}
                          color={distanceInfo.isServiceable ? '#047857' : '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.distanceHeaderBadgeText,
                            !distanceInfo.isServiceable && styles.distanceHeaderBadgeTextError,
                          ]}
                        >
                          {distanceInfo.distanceKm <= 0.5 ? '< 500m' : `${distanceInfo.distanceKm} km`}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAddressSheetVisible(true)}
                    style={styles.deliverToSelector}
                  >
                    <View style={styles.deliverToRow}>
                      <Icon name="map-pin" size={13} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.deliverToText, isTablet && { fontSize: 13.5 }]} numberOfLines={1}>
                        {selectedAddress
                          ? `Delivering to ${selectedAddress.tag === "Current Location" ? "Home" : selectedAddress.tag}: ${selectedAddress.line1}, ${selectedAddress.city}`
                          : 'Select or add delivery address'}
                      </Text>
                      <Text style={styles.dropdownArrow}>▾</Text>
                    </View>
                  </TouchableOpacity>

                  {distanceInfo && !distanceInfo.isServiceable ? (
                    <View style={styles.cartUnserviceableNotice}>
                      <Icon name="alert-triangle" size={12} color="#DC2626" />
                      <Text style={styles.cartUnserviceableNoticeText}>
                        {distanceInfo.message || `Address is ${distanceInfo.distanceKm} km away. We only deliver within 10 km.`}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* 2. Free Delivery Progress Bar */}
                <View style={styles.freeDeliveryCard}>
                  <View style={styles.freeDeliveryTitleRow}>
                    <Icon
                      name={amountNeeded === 0 ? 'sparkles' : 'truck'}
                      size={17}
                      color={amountNeeded === 0 ? theme.colors.accentGoldDark : theme.colors.primary}
                    />
                    <Text style={styles.freeDeliveryText}>
                      {amountNeeded === 0
                        ? 'Congratulations! You unlocked FREE Delivery!'
                        : `Add ₹${amountNeeded.toFixed(0)} more for FREE Delivery!`}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${freeProgress}%` as any },
                      ]}
                    />
                  </View>
                </View>
              </>
            }
            ListFooterComponent={
              <>
                {/* 3. "Savings on this order" Green Strip */}
                {totalSavings > 0 ? (
                  <View style={styles.savingsStrip}>
                    <Icon name="party-popper" size={16} color={theme.colors.success} />
                    <Text style={styles.savingsStripText}>
                      You are saving ₹{totalSavings.toFixed(0)} on this order!
                    </Text>
                  </View>
                ) : null}

                {/* 4. Apply Coupon Row */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setCouponSheetVisible(true)}
                  style={styles.couponRow}
                >
                  <View style={styles.couponLeft}>
                    <View style={styles.tagIconCircle}>
                      <Icon name="tag" size={16} color={theme.colors.primary} />
                    </View>
                    {appliedCoupon && (!appliedCoupon.minOrderValue || subtotal >= appliedCoupon.minOrderValue) ? (
                      <View>
                        <Text style={styles.couponCodeText}>
                          Coupon '{appliedCoupon.code}' Applied
                        </Text>
                        <Text style={styles.couponSavingsSub}>
                          Saved ₹{couponDiscount.toFixed(0)} with this code
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <Text style={[styles.couponRowTitle, isTablet && { fontSize: 16 }]}>Apply Coupon</Text>
                        <Text style={[styles.couponRowSub, isTablet && { fontSize: 13.5 }]}>
                          Save up to ₹100 on your harvest cup
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={styles.couponArrow}>
                      {appliedCoupon && (!appliedCoupon.minOrderValue || subtotal >= appliedCoupon.minOrderValue) ? 'Change' : 'View Offers'}
                    </Text>
                    <Icon name="chevron-right" size={14} color={theme.colors.primary} />
                  </View>
                </TouchableOpacity>

                {/* 5. Bill Summary Card */}
                <View style={styles.billCard}>
                  <Text style={[styles.billHeader, isTablet && { fontSize: 18.5 }]}>Bill Summary</Text>

                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, isTablet && { fontSize: 15 }]}>Item Total</Text>
                    <Text style={[styles.billVal, isTablet && { fontSize: 15.5 }]}>₹{subtotal.toFixed(0)}</Text>
                  </View>

                  {couponDiscount > 0 ? (
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: theme.colors.success }, isTablet && { fontSize: 15 }]}>
                        Coupon Discount ({appliedCoupon?.code})
                      </Text>
                      <Text style={[styles.billVal, { color: theme.colors.success }, isTablet && { fontSize: 15.5 }]}>
                        −₹{couponDiscount.toFixed(0)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.billRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.billLabel, isTablet && { fontSize: 15 }]}>Delivery Partner Fee</Text>
                      {distanceInfo ? (
                        <View style={styles.distanceTagPill}>
                          <Text style={styles.distanceTagPillText}>
                            {distanceInfo.distanceKm <= 0.5 ? '< 500m' : `${distanceInfo.distanceKm} km`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.billVal, isTablet && { fontSize: 15.5 }]}>
                      {currentDeliveryFee === 0 ? (
                        <Text style={[styles.freeText, isTablet && { fontSize: 14.5 }]}>FREE</Text>
                      ) : (
                        `₹${currentDeliveryFee}`
                      )}
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.billLabel, isTablet && { fontSize: 15 }]}>Handling & Packaging</Text>
                    </View>
                    <Text style={[styles.billVal, isTablet && { fontSize: 15.5 }]}>₹{currentHandlingFee}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.billRow}>
                    <Text style={[styles.toPayLabel, isTablet && { fontSize: 18.5 }]}>To Pay</Text>
                    <Text style={[styles.toPayVal, isTablet && { fontSize: 22 }]}>₹{currentGrandTotal.toFixed(0)}</Text>
                  </View>
                </View>

                {/* 6. Safety & Quality Guarantee */}
                <View style={styles.policyBox}>
                  <Icon name="shield-check" size={20} color={theme.colors.primary} />
                  <Text style={[styles.policyText, isTablet && { fontSize: 13.5, lineHeight: 18 }]}>
                    100% genuine tea guarantee direct from Upper Assam gardens. Vacuum sealed for peak freshness.
                  </Text>
                </View>
              </>
            }
          />

          {/* 7. Sticky Bottom Address + Proceed to Pay Bar */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 14) },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (addresses.length === 0) {
                  setAddAddressModalVisible(true);
                } else {
                  setAddressSheetVisible(true);
                }
              }}
              style={styles.bottomAddressSection}
            >
              <View style={styles.addressTagRow}>
                <Text style={[styles.bottomTagText, isTablet && { fontSize: 12.5 }]} numberOfLines={1} ellipsizeMode="tail">
                  {selectedAddress && addresses.length > 0
                    ? `DELIVER TO ${selectedAddress.tag}`
                    : selectedAddress?.tag === 'Current Location'
                      ? 'DELIVER TO CURRENT LOCATION'
                      : 'DELIVERY ADDRESS'}
                </Text>
              </View>
              <Text style={[styles.bottomAddrLine, isTablet && { fontSize: 13.5 }]} numberOfLines={1} ellipsizeMode="tail">
                {selectedAddress
                  ? formatHeaderAddress(selectedAddress)
                  : 'Tap to add delivery address'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                if (distanceInfo && !distanceInfo.isServiceable) {
                  Alert.alert(
                    'Delivery Unavailable',
                    distanceInfo.message ||
                    `This address is ${distanceInfo.distanceKm} km away. We only deliver within ${distanceInfo.maxDistanceKm || 10} km.`
                  );
                  return;
                }

                // If user has no saved addresses in database, open modal to add delivery address first
                const hasSavedAddress = addresses.length > 0 && selectedAddress && !String(selectedAddress.id).startsWith('gps-');
                if (!hasSavedAddress && (!selectedAddress || addresses.length === 0 || String(selectedAddress?.id).startsWith('gps-'))) {
                  setAddAddressModalVisible(true);
                  return;
                }

                if (selectedAddress?.id) {
                  router.push({
                    pathname: '/checkout',
                    params: { addressId: String(selectedAddress.id) },
                  });
                } else {
                  router.push('/checkout');
                }
              }}
              style={styles.proceedBtnWrapper}
            >
              <LinearGradient
                colors={
                  distanceInfo && !distanceInfo.isServiceable
                    ? (['#9CA3AF', '#6B7280'] as any)
                    : (theme.colors.primaryGradient as any)
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.proceedBtn}
              >
                <View>
                  <Text style={[styles.proceedPrice, isTablet && { fontSize: 16.5 }]}>₹{currentGrandTotal.toFixed(0)}</Text>
                </View>
                <View style={styles.proceedCta}>
                  <Text style={[styles.proceedBtnText, isTablet && { fontSize: 15 }]}>Proceed to Pay</Text>
                  <Icon name="arrow-right" size={15} color={theme.colors.textInverse} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Coupon Bottom Sheet */}
      <CouponBottomSheet
        visible={couponSheetVisible}
        onClose={() => setCouponSheetVisible(false)}
      />

      {/* Address Bottom Sheet */}
      <AddressBottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        selectedAddressId={selectedAddress?.id || ''}
        onSelectAddress={(addr) => setSelectedAddress(addr)}
        onAddNewPress={() => {
          setEditingAddress(null);
          setAddAddressModalVisible(true);
        }}
        onEditAddress={(addr) => {
          setEditingAddress(addr);
          setAddAddressModalVisible(true);
        }}
        addresses={addresses}
      />

      {/* Add Address Modal with Free & Accurate GPS Auto-Detect */}
      <AddAddressModal
        visible={addAddressModalVisible}
        initialAddress={editingAddress}
        onClose={() => {
          setAddAddressModalVisible(false);
          setEditingAddress(null);
        }}
        onSaveAddress={handleSaveAddress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
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
  expressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentGoldMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentGoldBorder,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  expressText: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.accentGoldDark,
  },
  listContent: {
    padding: theme.spacing.base,
    paddingBottom: 150,
  },
  deliveryBanner: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  deliveryBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deliveryBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  deliveryBannerTitle: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  distanceHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: theme.radius.pill,
  },
  distanceHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  distanceHeaderBadgeError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  distanceHeaderBadgeTextError: {
    color: '#DC2626',
  },
  deliverToSelector: {
    marginTop: 4,
  },
  deliverToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  deliverToText: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  distanceInlinePill: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 2,
  },
  distanceInlinePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  dropdownArrow: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginLeft: 2,
  },
  cartUnserviceableNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
  },
  cartUnserviceableNoticeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
    flex: 1,
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
  freeDeliveryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  freeDeliveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  freeDeliveryText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.subtle,
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  itemDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
    justifyContent: 'space-between',
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  itemVariant: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  itemPrice: {
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  itemMrp: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textHint,
    textDecorationLine: 'line-through',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 78,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.extraBold,
    minWidth: 16,
    textAlign: 'center',
  },
  lineTotal: {
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.successMuted,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
  },
  savingsStripText: {
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textSuccess,
    textAlign: 'center',
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  couponLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  tagIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponRowTitle: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  couponRowSub: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  couponCodeText: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  couponSavingsSub: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.success,
    fontWeight: theme.typography.weights.bold,
    marginTop: 1,
  },
  couponArrow: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  billCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  billHeader: {
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
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
    fontWeight: theme.typography.weights.medium,
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
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
  policyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  policyText: {
    flex: 1,
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.xs,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  bottomAddressSection: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  addressTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bottomTagText: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    letterSpacing: 0.5,
  },
  changeLink: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  bottomAddrLine: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  proceedBtnWrapper: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    flexShrink: 0,
    ...theme.shadows.card,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  proceedPrice: {
    color: theme.colors.textInverse,
    fontSize: 14.5,
    fontWeight: theme.typography.weights.extraBold,
  },
  proceedSub: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: theme.typography.scale.xs - 3,
    fontWeight: theme.typography.weights.bold,
  },
  proceedCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proceedBtnText: {
    color: theme.colors.textInverse,
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
  },
});
