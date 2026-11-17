import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { Icon } from '../common/Icon';
import { useResponsive } from '../../utils/responsive';

interface ViewCartBarProps {
  bottomOffset?: number;
}

export const ViewCartBar: React.FC<ViewCartBarProps> = ({
  bottomOffset = theme.spacing.base,
}) => {
  const router = useRouter();
  const { items, getTotalItemsCount, getSubtotal } = useCartStore();
  const { isTablet } = useResponsive();

  const totalCount = getTotalItemsCount();
  const subtotal = getSubtotal();
  const isVisible = totalCount > 0;

  const slideAnim = useRef(new Animated.Value(100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  if (!isVisible && (slideAnim as any)._value === 100) {
    return null;
  }

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    router.push('/(tabs)/cart');
  };

  const previewImages = items.slice(0, 3).map((i) => i.imageUrl);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
          opacity: opacityAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePress}
        style={styles.pillContainer}
      >
        <LinearGradient
          colors={theme.colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientPill, isTablet && styles.gradientPillTablet]}
        >
          {/* Left: Thumbnail Stack + Item Count & Subtotal */}
          <View style={styles.leftSection}>
            <View style={[styles.thumbnailStack, isTablet && { width: 44, height: 44 }]}>
              {previewImages.length > 0 ? (
                previewImages.map((uri, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.thumbnailCircle,
                      isTablet && styles.thumbnailCircleTablet,
                      { left: idx * (isTablet ? 18 : 16), zIndex: 10 - idx },
                    ]}
                  >
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                  </View>
                ))
              ) : (
                <View style={[styles.bagIconFallback, isTablet && { width: 38, height: 38, borderRadius: 19 }]}>
                  <Icon name="shopping-bag" size={isTablet ? 22 : 18} color={theme.colors.textInverse} />
                </View>
              )}
            </View>

            <View style={[styles.textDetails, { marginLeft: Math.max(1, previewImages.length) * (isTablet ? 18 : 16) + 10 }]}>
              <Text style={[styles.itemCountText, isTablet && { fontSize: 11 }]}>
                {totalCount} {totalCount === 1 ? 'ITEM' : 'ITEMS'}
              </Text>
              <Text style={[styles.subtotalText, isTablet && { fontSize: 17 }]}>₹{subtotal.toFixed(0)}</Text>
            </View>
          </View>

          {/* Right: View Cart Action */}
          <View style={styles.rightSection}>
            <Text style={[styles.viewCartText, isTablet && { fontSize: 16 }]}>View Cart</Text>
            <View style={[styles.arrowCircle, isTablet && { width: 30, height: 30, borderRadius: 15 }]}>
              <Icon name="arrow-right" size={isTablet ? 16 : 14} color={theme.colors.textInverse} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: theme.spacing.base,
    right: theme.spacing.base,
    alignItems: 'center',
    zIndex: 999,
  },
  pillContainer: {
    width: '100%',
    maxWidth: 560,
    borderRadius: theme.radius.pill,
    ...theme.shadows.viewCartBar,
  },
  gradientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radius.pill,
    height: theme.layout.viewCartBarHeight,
  },
  gradientPillTablet: {
    height: 60,
    paddingHorizontal: theme.spacing.lg,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailStack: {
    width: 38,
    height: 38,
    position: 'relative',
    justifyContent: 'center',
  },
  thumbnailCircle: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    overflow: 'hidden',
    backgroundColor: theme.colors.tintKadak,
  },
  thumbnailCircleTablet: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  bagIconFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textDetails: {
    justifyContent: 'center',
  },
  itemCountText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
  },
  subtotalText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.extraBold,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
  },
  viewCartText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.3,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ViewCartBar;
