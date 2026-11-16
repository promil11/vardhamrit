import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { fetchProducts } from '../services/catalogService';
import { Product } from '../types';
import { useWishlistStore } from '../store/useWishlistStore';
import { useCartStore } from '../store/useCartStore';
import { ProductCard } from '../components/product/ProductCard';
import { ViewCartBar } from '../components/cart/ViewCartBar';
import { Icon } from '../components/common/Icon';
import { WishlistSkeleton } from '../components/common/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterType = 'all' | 'kadak' | 'elaichi' | 'masala' | 'offers';

interface FilterTab {
  id: FilterType;
  label: string;
  emoji: string;
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all', label: 'All Saved', emoji: '✨' },
  { id: 'kadak', label: 'Kadak Assam', emoji: '🔥' },
  { id: 'elaichi', label: 'Royal Elaichi', emoji: '🌿' },
  { id: 'masala', label: '12-Spice', emoji: '🌶️' },
  { id: 'offers', label: 'On Sale', emoji: '💰' },
];

export default function WishlistScreen() {
  const router = useRouter();
  const { wishlistIds, clearWishlist, loadWishlist } = useWishlistStore();
  const { addItem, items: cartItems } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync wishlist and products with database on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadWishlist(),
      fetchProducts(),
    ])
      .then(([_, res]) => {
        setProducts(res?.items || []);
      })
      .catch((e) => console.warn('Error fetching dynamic products in wishlist:', e))
      .finally(() => setLoading(false));
  }, []);

  // Filter products that are in wishlist
  const wishlistProducts = useMemo(() => {
    return products.filter((p) => wishlistIds.includes(Number(p.id)));
  }, [products, wishlistIds]);

  const totalCount = wishlistProducts.length;

  // Filter based on active category/flavor tab
  const displayedProducts = useMemo(() => {
    if (selectedFilter === 'all') return wishlistProducts;
    if (selectedFilter === 'offers') {
      return wishlistProducts.filter(
        (p) =>
          (p.discountPercentage || 0) > 0 ||
          (p.variants?.[0]?.mrp && p.variants?.[0]?.price && p.variants[0].mrp > p.variants[0].price)
      );
    }
    return wishlistProducts.filter(
      (p) =>
        p.category === selectedFilter ||
        p.name.toLowerCase().includes(selectedFilter) ||
        (p.tagline || '').toLowerCase().includes(selectedFilter)
    );
  }, [wishlistProducts, selectedFilter]);

  // Financial calculations
  const totalValue = useMemo(() => {
    return wishlistProducts.reduce((sum, p) => sum + (p.variants?.[0]?.price || 199), 0);
  }, [wishlistProducts]);

  const totalMrp = useMemo(() => {
    return wishlistProducts.reduce(
      (sum, p) => sum + (p.variants?.[0]?.mrp || (p.variants?.[0]?.price ? p.variants[0].price * 1.25 : 249)),
      0
    );
  }, [wishlistProducts]);

  const totalSavings = Math.max(0, Math.round(totalMrp - totalValue));

  // Pairing / Complementary recommendations
  const recommendedProducts = useMemo(() => {
    return products.filter((p) => !wishlistIds.includes(Number(p.id))).slice(0, 4);
  }, [products, wishlistIds]);

  const handleClearAll = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }
    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all saved teas from your personal cellar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearWishlist();
            setToastMessage('Wishlist cleared');
            setTimeout(() => setToastMessage(null), 2500);
          },
        },
      ]
    );
  };

  const handleAddAllToCart = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    displayedProducts.forEach((product) => {
      if (product.variants?.length) {
        addItem(product, product.variants[0]);
      }
    });
    setToastMessage(`Added ${displayedProducts.length} blends to your cart! 🍵`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShareWishlist = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch { }
    }
    Alert.alert(
      'Tea Collection Shared 🍵',
      `Your curated collection of ${totalCount} estate blends has been copied to clipboard. Share with fellow tea lovers!`
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* 1. LUXURY 2026 GRADIENT HEADER */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topHeader}
        >
          {/* Top Brand Hallmark */}
          <View style={styles.brandHallmarkRow}>
            <View style={styles.brandBadge}>
              <Icon name="coffee" size={12} color="#F59E0B" />
              <Text style={styles.brandTitle}>VARDHAMRIT</Text>
              <View style={styles.brandDot} />
              <Text style={styles.brandSubtitle}>PRIVATE CELLAR</Text>
            </View>
            <View style={styles.liveFreshBadge}>
              <View style={styles.liveFreshDot} />
              <Text style={styles.liveFreshText}>100% ESTATE FRESH</Text>
            </View>
          </View>

          {/* Navigation & Title Bar */}
          <View style={styles.headerMainRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleBack}
              style={styles.backButton}
            >
              <Icon name="arrow-left" size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <View style={styles.titleRow}>
                <View style={styles.heartIconWrap}>
                  <Icon name="heart" size={15} color="#F87171" fill="#DC2626" />
                </View>
                <Text style={styles.headerTitle}>My Wishlist</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {totalCount > 0
                  ? `${totalCount} handpicked blend${totalCount > 1 ? 's' : ''} saved`
                  : 'Curate your favorite brews'}
              </Text>
            </View>

            {/* Header Right Actions: View Toggle & Clear */}
            <View style={styles.headerRightActions}>
              {totalCount > 0 ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    style={styles.viewToggleBtn}
                  >
                    <Icon
                      name={viewMode === 'grid' ? 'layers' : 'grid'}
                      size={15}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleClearAll}
                    style={styles.clearBtn}
                  >
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ width: 36 }} />
              )}
            </View>
          </View>

        </LinearGradient>

        {/* 2. MAIN SCROLL AREA */}
        {loading && products.length === 0 ? (
          <WishlistSkeleton />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {totalCount > 0 ? (
              <>
                {/* SAVINGS & ACTIONS HERO CARD */}
                <View style={styles.heroSummaryCard}>
                  <View style={styles.heroSummaryTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroSummaryLabel}>ESTIMATED VALUE</Text>
                      <View style={styles.heroPriceRow}>
                        <Text style={styles.heroTotalValue}>₹{totalValue}</Text>
                        {totalSavings > 0 && (
                          <Text style={styles.heroTotalMrp}>₹{totalMrp}</Text>
                        )}
                        {totalSavings > 0 && (
                          <View style={styles.heroSavingsPill}>
                            <Text style={styles.heroSavingsPillText}>
                              Save ₹{totalSavings}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.expressBadgeBox}>
                      <Icon name="zap" size={13} color="#D97706" />
                      <Text style={styles.expressBadgeText}>48 hrs Fast Dispatch</Text>
                    </View>
                  </View>

                  {/* Dual Action Buttons */}
                  <View style={styles.heroActionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={handleAddAllToCart}
                      style={styles.heroAddAllBtn}
                    >
                      <LinearGradient
                        colors={theme.colors.actionGradient as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroAddAllGradient}
                      >
                        <Icon name="shopping-bag" size={15} color="#FFFFFF" />
                        <Text style={styles.heroAddAllText}>
                          Add All to Cart ({displayedProducts.length})
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handleShareWishlist}
                      style={styles.heroShareBtn}
                    >
                      <Icon name="share" size={15} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* PRODUCTS LIST / GRID */}
                {displayedProducts.length === 0 ? (
                  <View style={styles.filterNoMatchBox}>
                    <Icon name="coffee" size={32} color="#94A3B8" />
                    <Text style={styles.filterNoMatchTitle}>
                      No items in this category
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedFilter('all')}>
                      <Text style={styles.filterNoMatchCta}>View All Saved Teas</Text>
                    </TouchableOpacity>
                  </View>
                ) : viewMode === 'grid' ? (
                  <View style={styles.productsGrid}>
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        layout="grid"
                        style={styles.productGridCard}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.productsList}>
                    {displayedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        layout="list"
                        style={styles.productListCard}
                      />
                    ))}
                  </View>
                )}

                {/* PAIRING RECOMMENDATIONS SECTION */}
                {recommendedProducts.length > 0 && (
                  <View style={styles.recommendSection}>
                    <View style={styles.recommendHeader}>
                      <View style={styles.recommendTitleRow}>
                        <Icon name="sparkles" size={13} color="#D97706" />
                        <Text style={styles.recommendTitle}>COMPLETE YOUR CHAI RITUAL</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/categories')}
                      >
                        <Text style={styles.recommendSeeAll}>Explore All</Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.recommendRail}
                    >
                      {recommendedProducts.map((item) => (
                        <ProductCard
                          key={item.id}
                          product={item}
                          layout="grid"
                          style={styles.recommendCard}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            ) : (
              /* 3. RE-ENGINEERED COMPACT LUXURY EMPTY STATE */
              <>
                <View style={styles.emptyHeroContainer}>
                  <View style={styles.emptyCard}>
                    <View style={styles.emptyIconHalo}>
                      <LinearGradient
                        colors={['#FEF2F2', '#FEE2E2']}
                        style={styles.emptyIconGradient}
                      >
                        <Icon name="heart" size={26} color="#DC2626" fill="#DC2626" />
                      </LinearGradient>
                    </View>

                    <Text style={styles.emptyTitle}>Your Wishlist is Empty</Text>
                    <Text style={styles.emptySubtitle}>
                      Explore our handpicked estate harvests and save your favorites here for quick 1-tap reordering.
                    </Text>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={() => router.push('/(tabs)/categories')}
                      style={styles.emptyExploreBtnWrapper}
                    >
                      <LinearGradient
                        colors={theme.colors.actionGradient as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.emptyExploreBtn}
                      >
                        <Icon name="sparkles" size={15} color="#FFFFFF" />
                        <Text style={styles.emptyExploreBtnText}>Explore Tea Gardens</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* POPULAR STARTERS TO BEGIN COLLECTION */}
                {products.length > 0 && (
                  <View style={styles.starterSection}>
                    <View style={styles.starterHeader}>
                      <View style={styles.starterHeaderLeft}>
                        <Icon name="flame" size={15} color="#DC2626" />
                        <Text style={styles.starterTitle}>POPULAR HARVESTS TO SAVE</Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => router.push('/(tabs)/categories')}
                      >
                        <Text style={styles.starterSeeAll}>See All</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.productsGrid}>
                      {products.slice(0, 6).map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          layout="grid"
                          style={styles.productGridCard}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* 4. FLOATING TOAST NOTIFICATION */}
        {toastMessage && (
          <View style={styles.toastContainer}>
            <View style={styles.toastCard}>
              <Icon name="check" size={16} color="#FFFFFF" />
              <Text style={styles.toastText} numberOfLines={1}>
                {toastMessage}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/cart')}
                style={styles.toastCartBtn}
              >
                <Text style={styles.toastCartBtnText}>View Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 5. FLOATING VIEW CART BAR */}
        <ViewCartBar bottomOffset={theme.spacing.base} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: 14,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  brandHallmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 5,
  },
  brandTitle: {
    color: '#FDE68A',
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  brandSubtitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.6,
  },
  liveFreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    gap: 4.5,
  },
  liveFreshDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveFreshText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heartIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(220, 38, 38, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    paddingVertical: 5.5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#FECACA',
  },
  filterTabsTrack: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  filterTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    gap: 5,
  },
  filterTabChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterTabEmoji: {
    fontSize: 11.5,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterTabTextActive: {
    color: theme.colors.primary,
  },
  tabCountBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  heroSummaryCard: {
    marginHorizontal: theme.spacing.base,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  heroSummaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroSummaryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.7,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  heroTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  heroTotalMrp: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  heroSavingsPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroSavingsPillText: {
    color: '#15803D',
    fontSize: 10.5,
    fontWeight: '800',
  },
  expressBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  expressBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroAddAllBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  heroAddAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  heroAddAllText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  heroShareBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.2,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    rowGap: 14,
  },
  productGridCard: {
    width: '48.2%',
  },
  productsList: {
    paddingHorizontal: theme.spacing.base,
    gap: 12,
  },
  productListCard: {
    width: '100%',
  },
  filterNoMatchBox: {
    alignItems: 'center',
    padding: 36,
    backgroundColor: '#FFFFFF',
    marginHorizontal: theme.spacing.base,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E3D7',
    gap: 8,
  },
  filterNoMatchTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterNoMatchCta: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  recommendSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  recommendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: 10,
  },
  recommendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recommendTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  recommendSeeAll: {
    fontSize: 11.5,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  recommendRail: {
    paddingHorizontal: theme.spacing.base,
    gap: 12,
    paddingVertical: 4,
  },
  recommendCard: {
    width: 160,
  },
  emptyHeroContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: 16,
    paddingBottom: 6,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E3D7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconHalo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 290,
  },
  emptyExploreBtnWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    gap: 6,
  },
  emptyExploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  starterSection: {
    marginTop: 16,
  },
  starterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: 12,
  },
  starterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starterTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  starterSeeAll: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#062316',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    gap: 10,
    maxWidth: 500,
    width: '100%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  toastCartBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toastCartBtnText: {
    color: '#062316',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
