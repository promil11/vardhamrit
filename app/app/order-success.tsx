import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { GradientButton } from '../components/common/GradientButton';
import { Icon } from '../components/common/Icon';
import { TeaCoinIcon } from '../components/common/TeaCoinIcon';
import { useAuth } from '../store/authContext';
import { fetchUserCoins, claimScratchCardReward } from '../services/userClientService';
import { ScratchCardModal } from '../components/checkout/ScratchCardModal';
import { useScratchCardStore } from '../store/useScratchCardStore';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { setCoinsBalance } = useAuth();
  const {
    orderId = 'VRD-582914',
    total = '423',
    paymentMethod = 'UPI',
    coinsEarned,
  } = useLocalSearchParams<{
    orderId: string;
    total: string;
    paymentMethod: string;
    coinsEarned?: string;
  }>();

  const [scratchModalVisible, setScratchModalVisible] = useState(false);
  const [rewardClaimed, setRewardClaimed] = useState(false);

  // Fallback 2% min 5 coins if not passed from backend
  const parsedCoins =
    coinsEarned !== undefined && Number(coinsEarned) > 0
      ? Number(coinsEarned)
      : Math.max(5, Math.round(Number(total) * 0.02));

  // Celebration scale & bounce animations
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics fallback
      }
    }

    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(badgeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    // Zepto / Blinkit style: pop up mystery scratch card shortly after order confirmed!
    useScratchCardStore.getState().addCard({
      id: orderId,
      orderNumber: orderId,
      coinsEarned: parsedCoins,
      totalAmount: total,
      isScratched: false,
      isClaimed: false,
    });

    const timer = setTimeout(() => {
      setScratchModalVisible(true);
    }, 550);

    return () => clearTimeout(timer);
  }, []);

  const handleClaimReward = async () => {
    setRewardClaimed(true);
    const claimRes = await claimScratchCardReward({
      orderNumber: orderId,
      coinsEarned: parsedCoins,
    });
    await useScratchCardStore.getState().markClaimed(orderId);
    if (claimRes?.newBalance !== undefined) {
      setCoinsBalance(claimRes.newBalance);
    } else {
      fetchUserCoins().then((res) => {
        if (res?.balance !== undefined) {
          setCoinsBalance(res.balance);
        }
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentCard}>
          {/* Animated Celebration Icon */}
          <Animated.View
            style={[
              styles.iconCircle,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Icon name="badge-check" size={54} color={theme.colors.success} />
          </Animated.View>

          <Text style={styles.title}>Order Placed Successfully!</Text>
          <Text style={styles.subtitle}>
            Your order has been received and is waiting for confirmation from our tea estate admin.
          </Text>

          {/* Estimated Delivery Time Pill */}
          <View style={styles.timerPill}>
            <Icon name="clock" size={14} color={theme.colors.accentGoldDark} />
            <Text style={styles.timerText}>Awaiting Order Confirmation</Text>
          </View>

          {/* ZEPTO / BLINKIT STYLE SCRATCH CARD REWARD TEASER BANNER */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setScratchModalVisible(true)}
            style={styles.scratchTeaserWrapper}
          >
            <LinearGradient
              colors={
                rewardClaimed
                  ? (['#ECFDF5', '#D1FAE5'] as any)
                  : (['#FFFBEB', '#FEF3C7'] as any)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scratchTeaserCard}
            >
              <View
                style={[
                  styles.scratchTeaserIconBox,
                  rewardClaimed && { backgroundColor: '#A7F3D0', borderColor: '#34D399' },
                ]}
              >
                {rewardClaimed ? (
                  <TeaCoinIcon size={26} />
                ) : (
                  <Icon name="gift" size={24} color="#B45309" />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.scratchTeaserTitle,
                      rewardClaimed && { color: '#065F46' },
                    ]}
                  >
                    {rewardClaimed
                      ? `Claimed +${parsedCoins} Tea Coins!`
                      : 'You Won a Scratch Card!'}
                  </Text>
                  <View
                    style={[
                      styles.scratchTeaserPill,
                      rewardClaimed && { backgroundColor: '#A7F3D0' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scratchTeaserPillText,
                        rewardClaimed && { color: '#047857' },
                      ]}
                    >
                      {rewardClaimed ? 'CLAIMED ✓' : 'TAP TO SCRATCH'}
                    </Text>
                  </View>
                </View>
              </View>

              <Icon
                name="chevron-right"
                size={16}
                color={rewardClaimed ? '#059669' : '#D97706'}
              />
            </LinearGradient>
          </TouchableOpacity>

          {/* Order Details Badge */}
          <Animated.View style={[styles.detailsBox, { opacity: badgeAnim }]}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Order Reference</Text>
              <Text style={styles.orderIdText}>#{orderId}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {paymentMethod === 'COD' ? 'Pay on Delivery' : 'Amount Paid'}
              </Text>
              <Text style={styles.amountText}>₹{total}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.paymentMethodText}>
                {paymentMethod === 'COD' ? 'Cash on Delivery (Unpaid)' : paymentMethod}
              </Text>
            </View>
          </Animated.View>

          {/* Packing Notification Banner */}
          <View style={styles.noticeBox}>
            <Icon name="coffee" size={20} color={theme.colors.primary} />
            <Text style={styles.noticeText}>
              Our tea masters will review & confirm your order. Once confirmed, fresh chai packaging begins.
            </Text>
          </View>

          {/* Action Buttons */}
          <GradientButton
            label="Track Delivery Status"
            onPress={() => {
              router.replace({
                pathname: '/order-tracking',
                params: { orderId, total },
              });
            }}
            size="lg"
            style={styles.trackBtn}
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.replace('/(tabs)')}
            style={styles.continueBtn}
          >
            <Text style={styles.continueText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Zepto/Blinkit Animated Scratch Card Popup Modal */}
      <ScratchCardModal
        visible={scratchModalVisible}
        onClose={() => setScratchModalVisible(false)}
        coinsEarned={parsedCoins}
        orderNumber={orderId}
        onClaim={handleClaimReward}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.base,
    paddingVertical: 40,
  },
  contentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sheet,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 2,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.base,
  },
  title: {
    fontSize: theme.typography.scale.lg + 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.scale.xs + 0.5,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    lineHeight: theme.typography.lineHeights.xs,
    maxWidth: 290,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentGoldMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentGoldBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
    marginTop: theme.spacing.sm + 4,
    gap: 4,
  },
  timerText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.accentGoldDark,
    letterSpacing: 0.3,
  },

  // Zepto / Blinkit Style Scratch Card Banner
  scratchTeaserWrapper: {
    width: '100%',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    ...theme.shadows.subtle,
  },
  scratchTeaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  scratchTeaserIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scratchTeaserTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  scratchTeaserPill: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  scratchTeaserPillText: {
    fontSize: 9,
    padding: 3,
    fontWeight: '800',
    color: '#78350F',
    letterSpacing: 0.3,
  },
  scratchTeaserSubtitle: {
    fontSize: 10.5,
    color: '#B45309',
    fontWeight: '500',
    marginTop: 2,
  },

  detailsBox: {
    width: '100%',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  detailLabel: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  orderIdText: {
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 6,
  },
  amountText: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  paymentMethodText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semiBold,
    lineHeight: 15,
  },
  trackBtn: {
    marginBottom: theme.spacing.sm,
  },
  continueBtn: {
    paddingVertical: theme.spacing.sm,
  },
  continueText: {
    fontSize: theme.typography.scale.xs + 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
});
