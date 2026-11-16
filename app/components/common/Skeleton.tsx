import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, ScrollView } from 'react-native';
import { theme } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = theme.radius.sm,
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const ProductCardSkeleton: React.FC<{ layout?: 'grid' | 'list' }> = ({ layout = 'grid' }) => {
  if (layout === 'list') {
    return (
      <View style={styles.listCardSkeleton}>
        <Skeleton width={96} height={96} borderRadius={theme.radius.md} />
        <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-between' }}>
          <Skeleton width="40%" height={14} borderRadius={theme.radius.pill} />
          <Skeleton width="90%" height={16} style={{ marginTop: 4 }} />
          <Skeleton width="60%" height={13} style={{ marginTop: 2 }} />
          <View style={styles.footerRow}>
            <Skeleton width={70} height={20} />
            <Skeleton width={72} height={32} borderRadius={theme.radius.sm} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cardSkeleton}>
      <Skeleton width="100%" height={130} borderRadius={theme.radius.md} />
      <View style={{ marginTop: theme.spacing.sm }}>
        <Skeleton width={60} height={16} borderRadius={theme.radius.pill} />
        <Skeleton width="90%" height={15} style={{ marginTop: 6 }} />
        <Skeleton width="65%" height={13} style={{ marginTop: 4 }} />
        <View style={styles.footerRow}>
          <Skeleton width={65} height={20} />
          <Skeleton width={68} height={32} borderRadius={theme.radius.sm} />
        </View>
      </View>
    </View>
  );
};

export const CategoryTileSkeleton: React.FC = () => {
  return (
    <View style={styles.categoryTileSkeleton}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <Skeleton width={52} height={12} style={{ marginTop: 8 }} />
    </View>
  );
};

export const BannerSkeleton: React.FC = () => {
  return (
    <View style={styles.bannerSkeleton}>
      <Skeleton width="100%" height={175} borderRadius={16} />
    </View>
  );
};

export const HomeScreenSkeleton: React.FC = () => {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenContainer}>
      {/* Top Address & Search Bar */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={200} height={18} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={40} height={40} borderRadius={20} />
      </View>

      {/* Hero Carousel Banner */}
      <View style={{ marginTop: 16 }}>
        <BannerSkeleton />
      </View>

      {/* Categories Row */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={140} height={20} />
        <Skeleton width={60} height={14} />
      </View>
      <View style={styles.horizontalRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <CategoryTileSkeleton key={i} />
        ))}
      </View>

      {/* Flash Deal / Highlight Card */}
      <View style={{ marginTop: 20 }}>
        <Skeleton width="100%" height={120} borderRadius={16} />
      </View>

      {/* Product Section */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={160} height={20} />
        <Skeleton width={50} height={14} />
      </View>
      <View style={styles.gridRow}>
        {[1, 2, 3, 4].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </View>
    </ScrollView>
  );
};

export const CatalogSkeleton: React.FC = () => {
  return (
    <View style={styles.catalogContainer}>
      {/* Search Header */}
      <View style={{ padding: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E5E7EB' }}>
        <Skeleton width="100%" height={42} borderRadius={10} />
      </View>

      {/* Category Pills Filter Bar */}
      <View style={{ flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#FFFFFF' }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={80} height={32} borderRadius={16} />
        ))}
      </View>

      {/* Grid of Products */}
      <ScrollView contentContainerStyle={styles.catalogGrid}>
        <View style={styles.gridRow}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Large Product Hero Image */}
        <Skeleton width="100%" height={320} borderRadius={0} />

        <View style={{ padding: 16 }}>
          {/* Badge & Rating */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={90} height={22} borderRadius={theme.radius.pill} />
            <Skeleton width={60} height={22} borderRadius={theme.radius.pill} />
          </View>

          {/* Title & Tagline */}
          <Skeleton width="85%" height={24} style={{ marginTop: 14 }} />
          <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />

          {/* Price Box */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 10 }}>
            <Skeleton width={90} height={32} />
            <Skeleton width={60} height={20} />
            <Skeleton width={80} height={22} borderRadius={4} />
          </View>

          {/* Variant Chips */}
          <Skeleton width={130} height={16} style={{ marginTop: 24 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width={90} height={42} borderRadius={10} />
            ))}
          </View>

          {/* Description Lines */}
          <Skeleton width="100%" height={14} style={{ marginTop: 26 }} />
          <Skeleton width="95%" height={14} style={{ marginTop: 8 }} />
          <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />

          {/* Brewing Guide Box */}
          <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 }}>
            <Skeleton width={140} height={18} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} width={70} height={50} borderRadius={8} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Floating Bar */}
      <View style={styles.bottomBarSkeleton}>
        <View>
          <Skeleton width={60} height={14} />
          <Skeleton width={90} height={22} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={140} height={46} borderRadius={12} />
      </View>
    </View>
  );
};

export const CartSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Delivery Address Pill */}
      <Skeleton width="100%" height={64} borderRadius={14} />

      {/* Items Section */}
      <Skeleton width={130} height={20} style={{ marginTop: 20 }} />
      {[1, 2].map((i) => (
        <View key={i} style={[styles.listCardSkeleton, { marginTop: 12 }]}>
          <Skeleton width={70} height={70} borderRadius={10} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="50%" height={13} style={{ marginTop: 4 }} />
            <View style={[styles.footerRow, { marginTop: 10 }]}>
              <Skeleton width={60} height={18} />
              <Skeleton width={80} height={30} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}

      {/* Promo Code Box */}
      <Skeleton width="100%" height={50} borderRadius={12} style={{ marginTop: 20 }} />

      {/* Bill Details Box */}
      <View style={{ marginTop: 20, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Skeleton width={120} height={18} />
        <View style={{ marginTop: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={50} height={14} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={100} height={14} />
            <Skeleton width={60} height={14} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={90} height={14} />
            <Skeleton width={50} height={14} />
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width={110} height={18} />
            <Skeleton width={70} height={18} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export const OrdersSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={75} height={32} borderRadius={16} />
        ))}
      </View>

      {/* Order Cards */}
      {[1, 2].map((i) => (
        <View key={i} style={styles.orderCardSkeleton}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Skeleton width={110} height={16} />
              <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
            </View>
            <Skeleton width={90} height={24} borderRadius={12} />
          </View>

          {/* Stepper Preview */}
          <Skeleton width="100%" height={38} borderRadius={8} style={{ marginTop: 14 }} />

          {/* Items Preview */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' }}>
            <Skeleton width={44} height={44} borderRadius={8} />
            <View style={{ flex: 1 }}>
              <Skeleton width="75%" height={14} />
              <Skeleton width="45%" height={12} style={{ marginTop: 4 }} />
            </View>
            <Skeleton width={50} height={16} />
          </View>

          {/* Total & Action Bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#F3F4F6' }}>
            <Skeleton width={100} height={16} />
            <Skeleton width={85} height={32} borderRadius={8} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Profile Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Skeleton width={68} height={68} borderRadius={34} />
        <View style={{ flex: 1 }}>
          <Skeleton width={140} height={20} />
          <Skeleton width={110} height={14} style={{ marginTop: 6 }} />
          <Skeleton width={80} height={18} borderRadius={theme.radius.pill} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Coins Card */}
      <Skeleton width="100%" height={90} borderRadius={16} style={{ marginTop: 20 }} />

      {/* 4 Stat Boxes */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="22%" height={70} borderRadius={12} />
        ))}
      </View>

      {/* Addresses Section */}
      <View style={{ marginTop: 24, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Skeleton width={130} height={18} />
        <Skeleton width="100%" height={56} borderRadius={10} style={{ marginTop: 12 }} />
        <Skeleton width="100%" height={56} borderRadius={10} style={{ marginTop: 10 }} />
      </View>
    </ScrollView>
  );
};

export const CheckoutSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Delivery Address Box */}
      <Skeleton width="100%" height={100} borderRadius={16} />

      {/* Order Items Preview Box */}
      <Skeleton width="100%" height={140} borderRadius={16} style={{ marginTop: 16 }} />

      {/* Payment Options Box */}
      <Skeleton width="100%" height={130} borderRadius={16} style={{ marginTop: 16 }} />

      {/* Summary Box */}
      <Skeleton width="100%" height={120} borderRadius={16} style={{ marginTop: 16 }} />
    </ScrollView>
  );
};

export const WishlistSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width={85} height={32} borderRadius={16} />
        ))}
      </View>

      {/* 2-Column Product Grid */}
      <View style={styles.gridRow}>
        {[1, 2, 3, 4].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </View>
    </ScrollView>
  );
};

export const OrderTrackingSkeleton: React.FC = () => {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Dispatched Hero Banner */}
      <Skeleton width="100%" height={120} borderRadius={16} />

      {/* Rider Box */}
      <Skeleton width="100%" height={80} borderRadius={14} style={{ marginTop: 16 }} />

      {/* Journey Timeline */}
      <View style={{ marginTop: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Skeleton width={140} height={16} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <Skeleton width={20} height={20} borderRadius={10} />
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="40%" height={11} style={{ marginTop: 4 }} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E2E8F0',
  },
  cardSkeleton: {
    flex: 1,
    minWidth: 155,
    maxWidth: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  listCardSkeleton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    alignItems: 'center',
  },
  categoryTileSkeleton: {
    alignItems: 'center',
    marginRight: 16,
  },
  bannerSkeleton: {
    width: '100%',
  },
  screenContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
  },
  horizontalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  catalogContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  catalogGrid: {
    padding: 12,
    paddingBottom: 80,
  },
  bottomBarSkeleton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  orderCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
});

export default Skeleton;
