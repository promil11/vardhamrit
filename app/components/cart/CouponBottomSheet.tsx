import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { BottomSheetWrapper } from '../common/BottomSheetWrapper';
import { Coupon } from '../../types';
import { useCartStore } from '../../store/useCartStore';
import { Icon } from '../common/Icon';
import { Skeleton } from '../common/Skeleton';
import { api } from '../../services/api';
import { socket } from '../../services/socketService';
import { useAuth } from '../../store/authContext';

interface CouponBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

function mapDbCoupon(c: any): Coupon & { isActive?: boolean; isFirstOrderOnly?: boolean } {
  const isActive = c.is_active !== undefined ? Boolean(Number(c.is_active) === 1 || c.is_active === true) : true;
  const isFirstOrderOnly = Boolean(c.is_first_order_only || c.isFirstOrderOnly || c.code === 'WELCOMEFIRST');
  return {
    code: c.code,
    title: c.title || (c.discount_type === 'PERCENT' ? `${Number(c.discount_value)}% OFF` : `Flat ₹${Number(c.discount_value)} OFF`),
    description: c.description || `Valid on orders above ₹${c.min_order_value || c.minOrderValue || 0}`,
    discountType: (c.discount_type || c.discountType || 'PERCENT').toUpperCase() as 'PERCENT' | 'FLAT',
    discountValue: Number(c.discount_value ?? c.discountValue ?? 0),
    minOrderValue: Number(c.min_order_value ?? c.minOrderValue ?? 0),
    maxDiscount: c.max_discount ? Number(c.max_discount) : (c.maxDiscount ? Number(c.maxDiscount) : undefined),
    isFirstOrderOnly,
    isActive,
  };
}

export const CouponBottomSheet: React.FC<CouponBottomSheetProps> = ({
  visible,
  onClose,
}) => {
  const { appliedCoupon, applyCoupon, removeCoupon, getSubtotal } = useCartStore();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const subtotal = getSubtotal();

  // Load active and eligible coupons from backend database
  const loadCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/coupons', {
        params: user?.id ? { userId: user.id } : {},
      });
      if (res.data?.success && res.data?.data?.coupons) {
        const fetchedCoupons = res.data.data.coupons
          .filter((c: any) => c.is_active === undefined || Number(c.is_active) === 1 || c.is_active === true)
          .map(mapDbCoupon);
        setCoupons(fetchedCoupons);

        // If currently applied coupon is WELCOMEFIRST but backend excluded it (user not eligible), remove it
        const existingCodes = new Set(fetchedCoupons.map((c: Coupon) => c.code.toUpperCase()));
        if (appliedCoupon?.code?.toUpperCase() === 'WELCOMEFIRST' && !existingCodes.has('WELCOMEFIRST')) {
          removeCoupon();
        }
      } else {
        setCoupons([]);
      }
    } catch (e) {
      console.warn('Error fetching live coupons from database:', e);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadCoupons();
      setCustomCode('');
      setErrorMsg(null);
    }
  }, [visible, user?.id]);

  // Clear promo code text input whenever an applied coupon changes
  useEffect(() => {
    setCustomCode('');
  }, [appliedCoupon?.code]);

  // Auto-remove applied coupon if subtotal falls below minimum order value
  useEffect(() => {
    if (appliedCoupon) {
      const minVal = Number(appliedCoupon.minOrderValue || 0);
      if (minVal > 0 && subtotal < minVal) {
        removeCoupon();
      }
    }
  }, [subtotal, appliedCoupon]);

  useEffect(() => {
    loadCoupons();
  }, [user?.id]);

  // Listen for real-time coupon creation/updates from Admin
  useEffect(() => {
    const handleCouponCreated = (rawCoupon: any) => {
      try {
        if (!rawCoupon || !rawCoupon.code) return;
        const isActive = rawCoupon.is_active !== undefined ? Boolean(Number(rawCoupon.is_active) === 1 || rawCoupon.is_active === true) : true;
        if (!isActive) return;
        // If it's a first-order coupon, reload with user context to verify eligibility before showing
        if (rawCoupon.is_first_order_only || rawCoupon.code === 'WELCOMEFIRST') {
          loadCoupons();
          return;
        }
        const mapped = mapDbCoupon(rawCoupon);
        setCoupons((prev) => {
          if (prev.some((c) => c.code === mapped.code)) {
            return prev.map((c) => (c.code === mapped.code ? mapped : c));
          }
          return [mapped, ...prev];
        });
      } catch (err) {
        console.warn('Socket coupon.created error:', err);
      }
    };

    const handleCouponUpdated = (rawCoupon: any) => {
      try {
        if (!rawCoupon || !rawCoupon.code) return;
        const isActive = rawCoupon.is_active !== undefined ? Boolean(Number(rawCoupon.is_active) === 1 || rawCoupon.is_active === true) : true;
        const codeUpper = String(rawCoupon.code).toUpperCase();

        if (!isActive) {
          // Instantly remove disabled coupon from available list without refresh
          setCoupons((prev) => prev.filter((c) => c.code.toUpperCase() !== codeUpper));
          // If the disabled coupon is currently applied, remove it from cart immediately!
          if (appliedCoupon && appliedCoupon.code.toUpperCase() === codeUpper) {
            removeCoupon();
            setErrorMsg(`Coupon "${rawCoupon.code}" has been disabled by the store.`);
          }
          return;
        }

        // Coupon is active, add or update in list
        const mapped = mapDbCoupon(rawCoupon);
        setCoupons((prev) => {
          if (prev.some((c) => c.code.toUpperCase() === codeUpper)) {
            return prev.map((c) => (c.code.toUpperCase() === codeUpper ? mapped : c));
          }
          return [mapped, ...prev];
        });
      } catch (err) {
        console.warn('Socket coupon.updated error:', err);
      }
    };

    const handleCouponsUpdated = (data: any) => {
      try {
        if (data?.action === 'created' && data.coupon) {
          handleCouponCreated(data.coupon);
        } else if (data?.action === 'updated' && data.coupon) {
          handleCouponUpdated(data.coupon);
        } else {
          loadCoupons();
        }
      } catch (err) {
        console.warn('Socket coupons.updated error:', err);
      }
    };

    socket.on('coupon.created', handleCouponCreated);
    socket.on('coupon.updated', handleCouponUpdated);
    socket.on('coupons.updated', handleCouponsUpdated);

    return () => {
      socket.off('coupon.created', handleCouponCreated);
      socket.off('coupon.updated', handleCouponUpdated);
      socket.off('coupons.updated', handleCouponsUpdated);
    };
  }, [appliedCoupon]);

  const handleApplyCoupon = async (coupon: Coupon) => {
    setCustomCode('');
    if (subtotal < coupon.minOrderValue) {
      setErrorMsg(`Minimum order value for ${coupon.code} is ₹${coupon.minOrderValue}`);
      return;
    }
    setErrorMsg(null);
    setIsApplying(true);

    try {
      // Validate live with backend API
      const res = await api.post('/api/v1/coupons/validate', {
        code: coupon.code,
        subtotal,
      });

      if (res.data?.success) {
        applyCoupon(coupon);
        setCustomCode('');
        onClose();
      } else {
        setErrorMsg(res.data?.error || `Coupon ${coupon.code} is not valid.`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || `Coupon ${coupon.code} is currently disabled or invalid.`;
      setErrorMsg(msg);
      // Remove disabled coupon from list so it cannot be clicked again
      setCoupons((prev) => prev.filter((c) => c.code.toUpperCase() !== coupon.code.toUpperCase()));
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyCustomCode = async () => {
    if (!customCode.trim() || isApplying) return;
    const clean = customCode.trim().toUpperCase();
    setErrorMsg(null);
    setIsApplying(true);

    try {
      const res = await api.post('/api/v1/coupons/validate', {
        code: clean,
        subtotal,
      });

      if (res.data?.success && res.data?.data) {
        const valData = res.data.data;
        const validCoupon: Coupon = {
          code: clean,
          title: valData.type === 'PERCENT' ? `${valData.value}% OFF` : `Flat ₹${valData.value} OFF`,
          description: valData.message || `Saved ₹${valData.discountAmount}`,
          discountType: valData.type,
          discountValue: Number(valData.value),
          minOrderValue: Number(valData.min_order_value || valData.minOrderValue || 0),
          maxDiscount: valData.max_discount ? Number(valData.max_discount) : undefined,
        };
        applyCoupon(validCoupon);
        setCustomCode('');
        onClose();
      } else {
        setErrorMsg(res.data?.error || `Coupon code "${clean}" is not valid or has expired.`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || `Coupon code "${clean}" is not valid or has expired.`;
      setErrorMsg(msg);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <BottomSheetWrapper
      visible={visible}
      onClose={onClose}
      title="Apply Promo & Offers"
      subtitle="Save more on your fresh mountain harvest"
    >
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
        {/* Custom Coupon Input Row */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter promo code (e.g. WELCOMEFIRST)"
            placeholderTextColor={theme.colors.textHint}
            value={customCode}
            onChangeText={(txt) => {
              setCustomCode(txt);
              if (errorMsg) setErrorMsg(null);
            }}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleApplyCustomCode}
            style={[styles.applyBtn, !customCode.trim() && styles.applyBtnDisabled]}
            disabled={!customCode.trim()}
          >
            <Text style={styles.applyBtnText}>APPLY</Text>
          </TouchableOpacity>
        </View>

        {errorMsg ? (
          <View style={styles.errorContainer}>
            <Icon name="alert-triangle" size={14} color={theme.colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Applied Coupon Strip if active */}
        {appliedCoupon && (!appliedCoupon.minOrderValue || subtotal >= appliedCoupon.minOrderValue) ? (
          <View style={styles.appliedCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.appliedTitleRow}>
                <Icon name="ticket" size={16} color={theme.colors.primary} />
                <Text style={styles.appliedCode}>{appliedCoupon.code} Applied</Text>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.appliedDesc}>{appliedCoupon.description}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                removeCoupon();
                setCustomCode('');
                setErrorMsg(null);
              }}
              style={styles.removeBtn}
            >
              <Text style={styles.removeText}>REMOVE</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>AVAILABLE COUPONS</Text>

        {/* Coupons List */}
        <View style={styles.couponsList}>
          {loading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[styles.couponCard, { padding: 14 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Skeleton width={110} height={26} borderRadius={6} />
                    <Skeleton width={65} height={22} borderRadius={4} />
                  </View>
                  <Skeleton width="75%" height={14} style={{ marginTop: 10 }} />
                  <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
          ) : coupons.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Icon name="tag" size={32} color="#9CA3AF" />
              <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280', fontWeight: '500' }}>
                No active promotional coupons available right now
              </Text>
            </View>
          ) : (
            coupons.map((coupon) => {
              const isEligible = subtotal >= Number(coupon.minOrderValue || 0);
              const isApplied = appliedCoupon?.code === coupon.code && isEligible;

              return (
                <View
                  key={coupon.code}
                  style={[
                    styles.couponCard,
                    isApplied && styles.couponCardApplied,
                  ]}
                >
                  <View style={styles.couponTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeText}>{coupon.code}</Text>
                      </View>
                      {(coupon.code === 'WELCOMEFIRST' || (coupon as any).isFirstOrderOnly) ? (
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#92400E' }}>FIRST ORDER</Text>
                        </View>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setCustomCode('');
                        setErrorMsg(null);
                        if (isApplied) {
                          removeCoupon();
                        } else {
                          handleApplyCoupon(coupon);
                        }
                      }}
                      style={[
                        styles.tapApplyBtn,
                        !isEligible && !isApplied && styles.tapApplyBtnDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tapApplyText,
                          isApplied && { color: theme.colors.error },
                        ]}
                      >
                        {isApplied ? 'REMOVE' : isEligible ? 'APPLY' : 'LOCKED'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.couponTitle}>{coupon.title}</Text>
                  <Text style={styles.couponSub}>{coupon.description}</Text>

                  {!isEligible && !isApplied ? (
                    <Text style={styles.ineligibleNotice}>
                      Add ₹{(coupon.minOrderValue - subtotal).toFixed(0)} more to unlock this deal
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </BottomSheetWrapper>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  applyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.semiBold,
  },
  appliedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.successMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  appliedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  appliedCode: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  activeTag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.xs,
  },
  activeTagText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs - 3,
    fontWeight: theme.typography.weights.extraBold,
  },
  appliedDesc: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  removeText: {
    color: theme.colors.error,
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
  },
  sectionTitle: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
    color: theme.colors.textHint,
    marginVertical: theme.spacing.md,
  },
  couponsList: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  couponCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  couponCardApplied: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  couponTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  codeBadge: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderStyle: 'dashed',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
  },
  codeText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  tapApplyBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  tapApplyBtnDisabled: {
    opacity: 0.45,
  },
  tapApplyText: {
    color: theme.colors.primary,
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  couponTitle: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  couponSub: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  ineligibleNotice: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.accentBerry,
    fontWeight: theme.typography.weights.bold,
    marginTop: theme.spacing.xs,
  },
});

export default CouponBottomSheet;
