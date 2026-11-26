import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import {
  useTourStore,
  TOUR_STEPS,
  measureTargetAsync,
  TargetRect,
} from '../../store/useTourStore';

interface AppTourGuideModalProps {
  currentScreen: 'home' | 'profile';
  onComplete: () => Promise<void>;
}

export const AppTourGuideModal: React.FC<AppTourGuideModalProps> = ({
  currentScreen,
  onComplete,
}) => {
  const router = useRouter();
  const { isActive, currentStepIndex, nextStep, dismissTour } = useTourStore();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const currentStep = TOUR_STEPS[currentStepIndex];

  // Dynamic measurement & scroll into view on step change
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.screen !== currentScreen) {
      return;
    }

    let isMounted = true;

    const measure = async () => {
      const rect = await measureTargetAsync(currentStep.id, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (isMounted) {
        setTargetRect(rect);
        animateIn();
      }

      // Re-verify coordinate after smooth scrolling or dynamic fonts settle
      setTimeout(async () => {
        if (!isMounted) return;
        const settledRect = await measureTargetAsync(currentStep.id, SCREEN_WIDTH, SCREEN_HEIGHT);
        setTargetRect(settledRect);
      }, 260);
    };

    measure();
    startGlowPulse();

    return () => {
      isMounted = false;
    };
  }, [isActive, currentStepIndex, currentScreen, SCREEN_WIDTH, SCREEN_HEIGHT]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    bounceAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startGlowPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Only render when the tour is active and matches current screen
  if (!isActive || !currentStep || currentStep.screen !== currentScreen) {
    return null;
  }

  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNextPress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    if (!isLast) {
      nextStep(router);
    } else {
      handleClosePress();
    }
  };

  const handleClosePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    dismissTour(onComplete, router);
  };

  // Compute spotlight cutout geometry
  const padX = currentStep.id === 'notifications' || currentStep.id === 'wishlist' ? 3 : 5;
  const padY = 4;

  const targetLeft = targetRect
    ? Math.max(4, targetRect.x - padX)
    : 16;
  const targetTop = targetRect
    ? Math.max(0, targetRect.y - padY)
    : 120;
  const targetWidth = targetRect
    ? Math.min(SCREEN_WIDTH - 8, targetRect.width + padX * 2)
    : SCREEN_WIDTH - 32;
  const targetHeight = targetRect
    ? targetRect.height + padY * 2
    : 54;
  const radius = Math.min(currentStep.borderRadius || 16, targetHeight / 2);

  // Dynamic Tooltip Placement:
  // If target is in the upper 52% of the screen, place tooltip below it with arrow pointing up.
  // If target is in lower part of the screen, place tooltip above it with arrow pointing down.
  const isTargetUpper = (targetTop + targetHeight / 2) < (SCREEN_HEIGHT * 0.52);

  let tooltipStyle: any = {};
  const arrowDirection: 'up' | 'down' = isTargetUpper ? 'up' : 'down';

  if (arrowDirection === 'up') {
    tooltipStyle = {
      top: Math.min(targetTop + targetHeight + 12, SCREEN_HEIGHT - 230),
    };
  } else {
    tooltipStyle = {
      bottom: Math.min(SCREEN_HEIGHT - targetTop + 12, SCREEN_HEIGHT - 230),
    };
  }

  // Horizontal position of the pointing arrow, anchored directly above/below the target center
  const targetCenterX = targetLeft + targetWidth / 2;
  const arrowLeft = Math.max(16, Math.min(SCREEN_WIDTH - 76, targetCenterX - 18 - 20));

  // Build SVG path with evenodd rule so the cutout is 100% transparent
  const r = radius;
  const cutoutPath = `
    M 0 0 
    H ${SCREEN_WIDTH} 
    V ${SCREEN_HEIGHT} 
    H 0 
    Z 
    M ${targetLeft + r} ${targetTop} 
    h ${Math.max(0, targetWidth - 2 * r)} 
    a ${r} ${r} 0 0 1 ${r} ${r} 
    v ${Math.max(0, targetHeight - 2 * r)} 
    a ${r} ${r} 0 0 1 -${r} ${r} 
    h -${Math.max(0, targetWidth - 2 * r)} 
    a ${r} ${r} 0 0 1 -${r} -${r} 
    v -${Math.max(0, targetHeight - 2 * r)} 
    a ${r} ${r} 0 0 1 ${r} -${r} 
    Z
  `;

  return (
    <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.85)" />

      <View style={styles.container}>
        {/* Fullscreen Dimmed Backdrop with Transparent Cutout Hole */}
        <Svg
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Path
            d={cutoutPath}
            fill="rgba(0, 0, 0, 0.82)"
            fillRule="evenodd"
          />
        </Svg>

        {/* Top-Right Circular Close Button (X) */}
        <TouchableOpacity
          onPress={handleClosePress}
          style={styles.closeBtn}
          activeOpacity={0.75}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="x" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Spotlight Frame around Target with Pulsing Glow Border */}
        <View
          style={[
            styles.spotlightHole,
            {
              top: targetTop,
              left: targetLeft,
              width: targetWidth,
              height: targetHeight,
              borderRadius: radius,
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[
              styles.spotlightGlowBorder,
              {
                borderRadius: radius,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        </View>

        {/* Swiggy-Style Tooltip Callout */}
        <Animated.View
          style={[
            styles.tooltipContainer,
            tooltipStyle,
            {
              opacity: fadeAnim,
              transform: [{ translateY: bounceAnim }],
            },
          ]}
        >
          {/* Arrow pointing UP (when tooltip is below target) */}
          {arrowDirection === 'up' && (
            <View style={[styles.arrowWrapperUp, { left: arrowLeft }]}>
              <Svg width="36" height="32" viewBox="0 0 36 32" fill="none">
                <Path
                  d="M 18 30 C 14 18, 18 10, 28 4 M 28 4 L 20 4 M 28 4 L 26 12"
                  stroke="#F97316"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}

          {/* Callout Card */}
          <View style={styles.cardContent}>
            <View style={styles.badgeRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{currentStep.badge}</Text>
              </View>
              <Text style={styles.counterText}>
                {currentStepIndex + 1} of {TOUR_STEPS.length}
              </Text>
            </View>

            <Text style={styles.greetingText}>{currentStep.greeting}</Text>
            <Text style={styles.titleText}>{currentStep.title}</Text>
            <Text style={styles.messageText}>{currentStep.message}</Text>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <View style={styles.dotsRow}>
                {TOUR_STEPS.map((s, idx) => (
                  <View
                    key={s.id}
                    style={[
                      styles.dot,
                      idx === currentStepIndex ? styles.dotActive : null,
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={handleNextPress}
                style={[styles.ctaBtn, isLast && styles.ctaBtnFinish]}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnText}>{currentStep.ctaText}</Text>
                {!isLast && <Icon name="arrow-right" size={13} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Arrow pointing DOWN (when tooltip is above target) */}
          {arrowDirection === 'down' && (
            <View style={[styles.arrowWrapperDown, { left: arrowLeft }]}>
              <Svg width="36" height="32" viewBox="0 0 36 32" fill="none">
                <Path
                  d="M 18 2 C 14 14, 18 22, 28 28 M 28 28 L 20 28 M 28 28 L 26 20"
                  stroke="#F97316"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  spotlightHole: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(249, 115, 22, 0.9)',
    backgroundColor: 'transparent',
    zIndex: 10,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  spotlightGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2.5,
    borderColor: '#F97316',
  },
  tooltipContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 20,
  },
  arrowWrapperUp: {
    marginBottom: -4,
    alignSelf: 'flex-start',
  },
  arrowWrapperDown: {
    marginTop: -4,
    alignSelf: 'flex-start',
  },
  cardContent: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  stepBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  stepBadgeText: {
    color: '#FB923C',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  counterText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
    textAlign: 'center',
  },
  titleText: {
    color: '#F97316',
    fontSize: 14.5,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  messageText: {
    color: '#E2E8F0',
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4.5,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#F97316',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F97316',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  ctaBtnFinish: {
    backgroundColor: '#059669',
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
