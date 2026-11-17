import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { Icon } from '../common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';

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
  const { width: windowWidth } = useWindowDimensions();
  const BANNER_GAP = 14;
  const bannerWidth = Math.min(windowWidth - 44, 480);
  const snapInterval = bannerWidth + BANNER_GAP;

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isDraggingRef = useRef(false);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = setInterval(() => {
      if (isDraggingRef.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        try {
          flatListRef.current?.scrollToOffset({
            offset: next * snapInterval,
            animated: true,
          });
        } catch {
          // ignore
        }
        return next;
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [banners.length, snapInterval]);

  const handleMomentumScrollEnd = (event: any) => {
    isDraggingRef.current = false;
    const offsetX = event.nativeEvent.contentOffset.x;
    const slide = Math.round(offsetX / snapInterval);
    if (slide >= 0 && slide < banners.length) {
      setActiveIndex(slide);
    }
  };

  const handleScrollBeginDrag = () => {
    isDraggingRef.current = true;
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
        style={[styles.bannerTouchable, { width: bannerWidth, marginRight: BANNER_GAP }]}
      >
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerGradient}
        >
          {/* Decorative Ambient Aura Shapes */}
          <View style={styles.ambientCircleBackdrop} pointerEvents="none" />
          <View style={styles.ambientArcBackdrop} pointerEvents="none" />

          {/* Left Text Block */}
          <View style={styles.textContainer}>
            {badgeText ? (
              <View style={styles.bannerBadge}>
                <Icon name="sparkles" size={10} color="#FDE68A" />
                <Text style={styles.bannerBadgeText}>{badgeText}</Text>
              </View>
            ) : null}

            <Text style={styles.tagline} numberOfLines={1}>
              {tagline}
            </Text>
            <Text style={styles.headline} numberOfLines={2}>
              {headline}
            </Text>
            <Text style={styles.subheadline} numberOfLines={1}>
              {subheadline}
            </Text>

            <View style={styles.shopNowRow}>
              <View style={styles.shopNowPill}>
                <Text style={styles.shopNowText}>Shop Blend</Text>
                <Icon name="arrow-right" size={11} color="#0A3622" />
              </View>
            </View>
          </View>

          {/* Right Product Hero Presentation */}
          <View style={styles.productContainer}>
            {/* Ambient circular glow aura */}
            <View style={styles.productGlowAura} pointerEvents="none" />
            {/* Soft grounded shadow base */}
            <View style={styles.productShadowBase} pointerEvents="none" />
            <Image
              source={{ uri: imageUrl }}
              style={styles.bannerProductImage}
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
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        contentContainerStyle={styles.flatListContent}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
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
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#062817',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 14,
    borderRadius: 22,
    height: 168,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientCircleBackdrop: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  ambientArcBackdrop: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
    justifyContent: 'center',
    zIndex: 2,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.42)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginBottom: 6,
  },
  bannerBadgeText: {
    color: '#FDE68A',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.72)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headline: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  subheadline: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    lineHeight: 15,
  },
  shopNowRow: {
    marginTop: 10,
  },
  shopNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 20,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  shopNowText: {
    color: '#0A3622',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  productContainer: {
    width: 116,
    height: 146,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  productGlowAura: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  productShadowBase: {
    position: 'absolute',
    bottom: 8,
    width: 76,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  bannerProductImage: {
    width: 110,
    height: 136,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#D1D5DB',
  },
});

export default BannerCarousel;
