import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Platform,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Icon } from '../common/Icon';
import { TeaCoinIcon } from '../common/TeaCoinIcon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScratchCardModalProps {
  visible: boolean;
  onClose: () => void;
  coinsEarned: number;
  orderNumber?: string;
  onClaim?: () => void;
}

const CONFETTI_COLORS = [
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EC4899',
  '#8B5CF6',
  '#FBBF24',
  '#059669',
  '#EF4444',
  '#F472B6',
  '#38BDF8',
];

export const ScratchCardModal: React.FC<ScratchCardModalProps> = ({
  visible,
  onClose,
  coinsEarned,
  orderNumber,
  onClaim,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  // Animations
  const modalScaleAnim = useRef(new Animated.Value(0.7)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;
  const foilOpacity = useRef(new Animated.Value(1)).current;
  const foilScale = useRef(new Animated.Value(1)).current;
  const rewardScaleAnim = useRef(new Animated.Value(0.8)).current;
  const coinBounceAnim = useRef(new Animated.Value(0)).current;

  // Shimmer Sweep Animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Bobbing 3D Gift Icon Animation
  const bobAnim = useRef(new Animated.Value(0)).current;

  // Pulse Button Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Slow Rotating Sunburst Rays
  const sunburstAnim = useRef(new Animated.Value(0)).current;

  // 30 Confetti particles with random angles, shapes & distances
  const confettiAnims = useRef(
    Array.from({ length: 30 }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
      targetX: (Math.random() - 0.5) * (SCREEN_WIDTH * 0.85),
      targetY: -Math.random() * (SCREEN_HEIGHT * 0.42) - 45,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.floor(Math.random() * 8) + 6,
      isRound: Math.random() > 0.5,
    }))
  ).current;

  // Scratch progress tracker via touch points
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const totalScratchedDistance = useRef<number>(0);

  // PanResponder to track finger scratching
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isRevealed,
      onMoveShouldSetPanResponder: () => !isRevealed,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        lastTouchRef.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt) => {
        if (isRevealed) return;
        const { locationX, locationY } = evt.nativeEvent;
        if (lastTouchRef.current) {
          const dx = locationX - lastTouchRef.current.x;
          const dy = locationY - lastTouchRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 5) {
            totalScratchedDistance.current += dist;
            lastTouchRef.current = { x: locationX, y: locationY };

            // Calculate progress (target ~ 300px of finger swiping)
            const progress = Math.min(100, Math.round((totalScratchedDistance.current / 300) * 100));
            setScratchProgress(progress);

            // Subtle tactile haptic vibration while scratching
            if (Platform.OS !== 'web' && progress % 8 === 0) {
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch { }
            }

            // Partially dissolve foil
            foilOpacity.setValue(Math.max(0.12, 1 - progress / 55));

            // Auto-trigger full reveal when scratched past 30%
            if (progress >= 30) {
              triggerFullReveal();
            }
          }
        }
      },
      onPanResponderRelease: () => {
        lastTouchRef.current = null;
      },
    })
  ).current;

  // Lifecycle animations
  useEffect(() => {
    if (visible) {
      setIsRevealed(false);
      setScratchProgress(0);
      totalScratchedDistance.current = 0;
      foilOpacity.setValue(1);
      foilScale.setValue(1);
      rewardScaleAnim.setValue(0.8);
      coinBounceAnim.setValue(0);
      shimmerAnim.setValue(0);
      bobAnim.setValue(0);
      pulseAnim.setValue(1);
      sunburstAnim.setValue(0);

      // Entrance spring
      Animated.parallel([
        Animated.spring(modalScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous shimmering light sweep
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Gentle bobbing gift icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(bobAnim, {
            toValue: -8,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bobAnim, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Subtle pulse button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 850,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotating sunburst
      Animated.loop(
        Animated.timing(sunburstAnim, {
          toValue: 1,
          duration: 14000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [visible]);

  // Full reveal celebratory explosion
  const triggerFullReveal = () => {
    if (isRevealed) return;
    setIsRevealed(true);
    setScratchProgress(100);

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    // Foil dissolve and reward bounce
    Animated.parallel([
      Animated.timing(foilOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(foilScale, {
        toValue: 1.15,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(rewardScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(coinBounceAnim, {
          toValue: -18,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(coinBounceAnim, {
          toValue: 0,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Burst 30 confetti particles
    confettiAnims.forEach((c) => {
      c.scale.setValue(1);
      c.opacity.setValue(1);
      Animated.parallel([
        Animated.timing(c.x, {
          toValue: c.targetX,
          duration: 950,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(c.y, {
          toValue: c.targetY,
          duration: 950,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(c.rotate, {
          toValue: (Math.random() - 0.5) * 10,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(580),
          Animated.timing(c.opacity, {
            toValue: 0,
            duration: 370,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  };

  const handleClose = () => {
    if (isRevealed && onClaim) {
      onClaim();
    }
    onClose();
  };

  const handleClaim = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }
    Animated.parallel([
      Animated.timing(modalOpacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(modalScaleAnim, {
        toValue: 0.85,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClaim) onClaim();
      onClose();
    });
  };

  if (!visible) return null;

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 320],
  });

  const sunburstRotate = sunburstAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        {/* Animated Confetti Particles Shower */}
        {isRevealed && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {confettiAnims.map((c, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.confettiPiece,
                  {
                    backgroundColor: c.color,
                    width: c.size,
                    height: c.isRound ? c.size : c.size * 1.5,
                    borderRadius: c.isRound ? c.size / 2 : 2,
                    transform: [
                      { translateX: c.x },
                      { translateY: c.y },
                      {
                        rotate: c.rotate.interpolate({
                          inputRange: [-10, 10],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                      { scale: c.scale },
                    ],
                    opacity: c.opacity,
                  },
                ]}
              />
            ))}
          </View>
        )}

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: modalOpacityAnim,
              transform: [{ scale: modalScaleAnim }],
            },
          ]}
        >
          {/* Close Pill Icon */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Icon name="x" size={17} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Top Header */}
          <View style={styles.headerContainer}>
            <View style={styles.mysteryPill}>
              <Icon name="sparkles" size={12} color="#FBBF24" />
              <Text style={styles.mysteryPillText}>
                {isRevealed ? 'REWARD UNLOCKED' : 'ORDER REWARD UNLOCKED'}
              </Text>
            </View>
            <Text style={styles.cardMainTitle}>
              {isRevealed ? 'Congratulations!' : 'Mystery Scratch Card'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isRevealed
                ? 'Your order cashback coins have been revealed!'
                : 'Scratch the card below to reveal your surprise cashback!'}
            </Text>
          </View>

          {/* THE SCRATCH CARD FRAME */}
          <View style={styles.scratchFrameContainer}>
            {/* UNDERNEATH LAYER: The Revealed Reward */}
            <Animated.View
              style={[
                styles.rewardCardUnderneath,
                { transform: [{ scale: rewardScaleAnim }] },
              ]}
            >
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7', '#FDE68A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rewardGradient}
              >
                {/* 3D Bouncing Coin Badge */}
                <Animated.View
                  style={[
                    styles.coinBadgeContainer,
                    { transform: [{ translateY: coinBounceAnim }] },
                  ]}
                >
                  <View style={styles.coinBadgeContainer}>
                    <TeaCoinIcon size={46} />
                  </View>
                </Animated.View>

                <Text style={styles.rewardWonTitle}>YOU HAVE WON</Text>

                <View style={styles.coinAmountRow}>
                  <Text style={styles.coinAmountNumber}>+{coinsEarned}</Text>
                  <Text style={styles.coinAmountLabel}>Tea Coins</Text>
                </View>

              </LinearGradient>
            </Animated.View>

            {/* TOP LAYER: Radiant Holographic Gold Scratch Foil */}
            {!isRevealed && (
              <Animated.View
                {...panResponder.panHandlers}
                style={[
                  styles.scratchFoilOverlay,
                  {
                    opacity: foilOpacity,
                    transform: [{ scale: foilScale }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#78350F', '#B45309', '#D97706', '#F59E0B', '#D97706', '#92400E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.foilGradient}
                >
                  {/* Continuous Shimmer Light Sweep */}
                  <Animated.View
                    style={[
                      styles.foilShimmerBeam,
                      {
                        transform: [{ translateX: shimmerTranslateX }, { rotate: '25deg' }],
                      },
                    ]}
                  />

                  {/* Corner Sparkle Accents */}
                  <View style={styles.cornerSparkleTL}>
                    <Icon name="sparkles" size={13} color="rgba(255, 255, 255, 0.4)" />
                  </View>
                  <View style={styles.cornerSparkleBR}>
                    <Icon name="sparkles" size={13} color="rgba(255, 255, 255, 0.4)" />
                  </View>

                  {/* Bobbing 3D Gift Medallion */}
                  <Animated.View
                    style={[
                      styles.foilMedallionBox,
                      { transform: [{ translateY: bobAnim }] },
                    ]}
                  >
                    <View style={styles.foilMedallionInner}>
                      <Icon name="gift" size={36} color="#FEF3C7" />
                    </View>
                  </Animated.View>

                  <Text style={styles.foilTitle}>SCRATCH HERE</Text>
                  <Text style={styles.foilSub}>
                    {scratchProgress > 0
                      ? `Scratching... ${scratchProgress}%`
                      : 'Swipe with your finger to scratch'}
                  </Text>

                  {/* Scratch Progress Bar (fills while swiping) */}
                  {scratchProgress > 0 && (
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(100, scratchProgress * 3)}%` },
                        ]}
                      />
                    </View>
                  )}

                  {/* Quick Action Button for 1-Tap Reveal with Pulse */}
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={triggerFullReveal}
                      style={styles.oneTapRevealBtn}
                    >
                      <Icon name="sparkles" size={13} color="#78350F" />
                      <Text style={styles.oneTapRevealText}>Tap to Scratch</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </LinearGradient>
              </Animated.View>
            )}
          </View>

          {/* BOTTOM CLAIM BUTTON */}
          {isRevealed ? (
            <Animated.View
              style={[
                styles.claimButtonWrapper,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleClaim}
                style={styles.claimButtonTouchable}
              >
                <LinearGradient
                  colors={theme.colors.actionGradient as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.claimButton}
                >
                  <Text style={styles.claimButtonText}>Claim & Add to Wallet</Text>
                  <Icon name="arrow-right" size={16} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Text style={styles.footerHintText}>
              Powered by Vardhamrit Quick-Commerce Loyalty Rewards
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 346,
    backgroundColor: '#061D15',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  mysteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 14,
    marginBottom: 8,
  },
  mysteryPillText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FDE68A',
    letterSpacing: 0.6,
  },
  cardMainTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: '#A7F3D0',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  scratchFrameContainer: {
    width: '100%',
    height: 280,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 10,
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  rewardCardUnderneath: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  rewardGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
  },
  sunburstWrapper: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.22,
  },
  sunburstRay1: {
    position: 'absolute',
    width: 300,
    height: 24,
    backgroundColor: '#F59E0B',
    transform: [{ rotate: '0deg' }],
  },
  sunburstRay2: {
    position: 'absolute',
    width: 300,
    height: 24,
    backgroundColor: '#F59E0B',
    transform: [{ rotate: '45deg' }],
  },
  sunburstRay3: {
    position: 'absolute',
    width: 300,
    height: 24,
    backgroundColor: '#F59E0B',
    transform: [{ rotate: '90deg' }],
  },
  sunburstRay4: {
    position: 'absolute',
    width: 300,
    height: 24,
    backgroundColor: '#F59E0B',
    transform: [{ rotate: '135deg' }],
  },
  coinBadgeContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#D97706',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 6,
  },
  coinBadgeGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinEmoji: {
    fontSize: 34,
  },
  rewardWonTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#92400E',
    letterSpacing: 1,
  },
  coinAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 1,
  },
  coinAmountNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: -0.5,
  },
  coinAmountLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  cashbackPillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  cashbackPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  couponVoucherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: '100%',
  },
  couponLeft: {
    flex: 1,
  },
  couponVoucherTag: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 0.5,
  },
  couponVoucherCode: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  couponVoucherSub: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  couponCopyBtn: {
    backgroundColor: '#059669',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SCRATCH FOIL OVERLAY
  scratchFoilOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 5,
  },
  foilGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  foilShimmerBeam: {
    position: 'absolute',
    top: -50,
    width: 55,
    height: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  cornerSparkleTL: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  cornerSparkleBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  foilMedallionBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  foilMedallionInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  foilTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FEF3C7',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  foilSub: {
    fontSize: 11,
    color: '#FDE68A',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 10,
  },
  progressBarTrack: {
    width: 140,
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FEF3C7',
    borderRadius: 3,
  },
  oneTapRevealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  oneTapRevealText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
    letterSpacing: 0.2,
  },

  claimButtonWrapper: {
    width: '100%',
    marginTop: 6,
  },
  claimButtonTouchable: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footerHintText: {
    fontSize: 9.5,
    color: '#6EE7B7',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  confettiPiece: {
    position: 'absolute',
    top: '42%',
    left: '50%',
  },
});
