import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { Icon } from '../common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - theme.spacing.base * 2;

export interface BannerItem {
  id: string;
  tagline: string;
  headline: string;
  subheadline: string;
  gradient: readonly [string, string, ...string[]];
  imageUrl: string;
  badgeText?: string;
  badgeVariant?: 'discount' | 'express' | 'gold';
  target_url?: string;
  targetUrl?: string;
  category?: string;
}

interface BannerCarouselProps {
  banners: BannerItem[];
  onBannerPress?: (banner: BannerItem) => void;
  style?: ViewStyle;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  banners,
  onBannerPress,
  style,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll every 4.5 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [banners.length]);

  const handleMomentumScrollEnd = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / BANNER_WIDTH);
    setActiveIndex(slide);
  };

  const renderBanner = ({ item }: { item: BannerItem }) => {
    const gradientColors =
      item.gradient && item.gradient.length >= 2
        ? item.gradient
        : theme.colors.primaryGradient;

    const headline = item.headline || (item as any).title || 'Upper Assam Royal CTC';
    const subheadline = item.subheadline || (item as any).subtitle || 'Direct from tea gardens';
    const tagline = item.tagline || 'HARVEST RELEASE 2026';
    const rawImg = item.imageUrl || (item as any).image;
    const imageUrl = getFullImageUrl(rawImg);
    const badgeText = item.badgeText || (item as any).badge;

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onBannerPress?.(item)}
        style={styles.bannerTouchable}
      >
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerGradient}
        >
          {/* Left Text Block */}
          <View style={styles.textContainer}>
            {badgeText ? (
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>{badgeText}</Text>
              </View>
            ) : null}

            <Text style={styles.tagline}>{tagline}</Text>
            <Text style={styles.headline} numberOfLines={2}>
              {headline}
            </Text>
            <Text style={styles.subheadline} numberOfLines={1}>
              {subheadline}
            </Text>

            <View style={styles.shopNowRow}>
              <View style={styles.shopNowPill}>
                <Text style={styles.shopNowText}>Shop Blend</Text>
                <Icon name="arrow-right" size={10} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Right Product Hero Image */}
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.bannerImage}
              resizeMode="contain"
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={styles.flatListContent}
        snapToInterval={BANNER_WIDTH}
        decelerationRate="fast"
      />

      {/* Dots Indicator */}
      {banners.length > 1 ? (
        <View style={styles.dotsRow}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  flatListContent: {
    paddingHorizontal: theme.spacing.base,
  },
  bannerTouchable: {
    width: BANNER_WIDTH,
    borderRadius: theme.radius.banner,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.banner,
    height: 156,
  },
  textContainer: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentBerry,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
    marginBottom: theme.spacing.xs,
  },
  bannerBadgeText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.accentGold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: theme.typography.scale.md + 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textInverse,
    lineHeight: theme.typography.lineHeights.md + 2,
    marginVertical: 4,
  },
  subheadline: {
    fontSize: theme.typography.scale.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: theme.typography.weights.medium,
  },
  shopNowRow: {
    marginTop: 8,
  },
  shopNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  shopNowText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.3,
  },
  imageWrapper: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 20,
    backgroundColor: theme.colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: theme.colors.borderStrong,
  },
});

export default BannerCarousel;
