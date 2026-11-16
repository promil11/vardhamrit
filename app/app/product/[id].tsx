import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { theme } from '../../theme';
import { fetchProductDetail } from '../../services/catalogService';
import { Product, ProductVariant } from '../../types';
import { AddButton } from '../../components/product/AddButton';
import { RatingChip } from '../../components/common/RatingChip';
import { Badge } from '../../components/common/Badge';
import { ViewCartBar } from '../../components/cart/ViewCartBar';
import { ProductDetailSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useCartStore } from '../../store/useCartStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { Icon } from '../../components/common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const parseVariantLabel = (rawLabel: string) => {
  if (!rawLabel) return { size: 'Pack', tag: null };
  const label = rawLabel.trim();

  // Pattern 1: e.g. "400 g (Twin Pack)" or "1 kg (Saver Pack)"
  const parenMatch = label.match(/^([^(]+?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    return { size: parenMatch[1].trim(), tag: parenMatch[2].trim() };
  }

  // Pattern 2: e.g. "1 kg Saver" or "500 g Value Pack"
  const tagKeywords = ['Saver Pack', 'Super Saver', 'Saver', 'Twin Pack', 'Family Pack', 'Value Pack', 'Combo', 'Trial'];
  for (const kw of tagKeywords) {
    const reg = new RegExp(`^(.*?)\\s+(${kw}.*)$`, 'i');
    const m = label.match(reg);
    if (m && m[1].trim()) {
      return { size: m[1].trim(), tag: m[2].trim() };
    }
  }

  return { size: label, tag: null };
};

export default function ProductDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (from && typeof from === 'string' && from.trim().length > 0) {
      router.replace(from as any);
    } else {
      router.replace('/(tabs)/categories');
    }
  };

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [aboutExpanded, setAboutExpanded] = useState(true);
  const [brewingExpanded, setBrewingExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchProductDetail(id)
        .then((data) => {
          if (data) {
            setProduct(data as any);
            if (data.variants && data.variants.length > 0) {
              setSelectedVariant(data.variants[0]);
            }
          } else {
            setProduct(null);
          }
        })
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const isWishlisted = product ? isInWishlist(product.id) : false;

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveImageIndex(slide);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.topNav}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleBack}
              style={styles.navCircleBtn}
            >
              <Icon name="arrow-left" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ProductDetailSkeleton />
        </View>
      </>
    );
  }

  if (!product || !selectedVariant) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <EmptyState
            iconName="coffee"
            title="Product Not Found"
            subtitle="The tea you are looking for is unavailable or has been archived from the catalog."
            buttonLabel="Return to Catalog"
            onButtonPress={() => router.replace('/(tabs)/categories')}
          />
        </View>
      </>
    );
  }

  const images = product.images && product.images.length > 0
    ? product.images
    : [product.imageUrl];

  const savings = Math.max(0, selectedVariant.mrp - selectedVariant.price);
  const discountPercent = selectedVariant.mrp > selectedVariant.price
    ? Math.round((savings / selectedVariant.mrp) * 100)
    : 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Floating Top Nav (Back Button & Cart Button) */}
        <View style={styles.topNav}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBack}
            style={styles.navCircleBtn}
          >
            <Icon name="arrow-left" size={18} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navRight}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => toggleWishlist(product.id)}
              style={styles.navCircleBtn}
            >
              <Icon
                name="heart"
                size={18}
                color={isWishlisted ? '#DC2626' : theme.colors.textPrimary}
                fill={isWishlisted ? '#DC2626' : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/cart')}
              style={styles.navCircleBtn}
            >
              <Icon name="shopping-bag" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 1. Full-Width Image Carousel */}
          <View style={styles.carouselContainer}>
            <FlatList
              data={images}
              keyExtractor={(_, index) => String(index)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              renderItem={({ item }) => (
                <View style={styles.imageSlide}>
                  <Image
                    source={{ uri: getFullImageUrl(item) }}
                    style={styles.carouselImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            />

            {/* Badges on top of image */}
            <View style={styles.floatingBadgesRow}>
              {discountPercent > 0 ? (
                <Badge
                  label={`${discountPercent}% OFF`}
                  variant="discount"
                  style={styles.heroDiscountBadge}
                />
              ) : null}
              <View style={styles.deliveryBadge}>
                <Icon name="zap" size={11} color={theme.colors.accentGoldDark} />
                <Text style={styles.deliveryBadgeText}>48 hrs DELIVERY</Text>
              </View>
            </View>

            {/* Pagination Dots */}
            {images.length > 1 ? (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === activeImageIndex ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {/* 2. Product Headline & Rating Section */}
          <View style={styles.sectionCard}>
            <View style={styles.brandRow}>
              <Text style={styles.brandTag}>VARDHAMRIT GARDEN FRESH</Text>
              <RatingChip rating={product.rating} reviewCount={product.reviewCount} size="md" />
            </View>

            <Text style={styles.productTitle}>{product.name}</Text>
            <Text style={styles.productTagline}>{product.tagline}</Text>

            {/* Price Block */}
            <View style={styles.priceRow}>
              <Text style={styles.priceCurrent}>₹{selectedVariant.price}</Text>
              {selectedVariant.mrp > selectedVariant.price ? (
                <Text style={styles.priceMrp}>₹{selectedVariant.mrp}</Text>
              ) : null}
              <Text style={styles.priceTaxHint}>(Inclusive of all taxes)</Text>
            </View>

            {/* Berry "You Save Rs.X" Highlight Strip */}
            {savings > 0 ? (
              <View style={styles.savingsStrip}>
                <Icon name="party-popper" size={14} color={theme.colors.accentBerry} />
                <Text style={styles.savingsStripText}>
                  You save ₹{savings} ({discountPercent}% OFF) on this pack!
                </Text>
              </View>
            ) : null}
          </View>

          {/* 3. Variant Selector 2-Column Responsive Grid */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>Select Pack Size</Text>
              <Text style={styles.cardHeaderSubtitle}>
                {product.variants.length} options available
              </Text>
            </View>

            <View style={styles.variantsGrid}>
              {product.variants.map((v) => {
                const isSelected = v.id === selectedVariant.id;
                const vSavings = Math.max(0, v.mrp - v.price);
                const parsed = parseVariantLabel(v.label);

                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.82}
                    onPress={() => setSelectedVariant(v)}
                    style={[
                      styles.variantGridCard,
                      isSelected && styles.variantGridCardSelected,
                    ]}
                  >
                    {/* Top Row: Radio + Size + Savings Badge */}
                    <View style={styles.variantCardTopRow}>
                      <View style={styles.variantSizeRow}>
                        <View
                          style={[
                            styles.radioCircle,
                            isSelected && styles.radioCircleSelected,
                          ]}
                        >
                          {isSelected ? <View style={styles.radioDot} /> : null}
                        </View>
                        <Text
                          style={[
                            styles.variantSizeText,
                            isSelected && styles.variantSizeTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {parsed.size}
                        </Text>
                      </View>

                      {vSavings > 0 ? (
                        <View
                          style={[
                            styles.variantSavingsBadge,
                            isSelected && styles.variantSavingsBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.variantSavingsText,
                              isSelected && styles.variantSavingsTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            SAVE ₹{vSavings}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Bottom Row: Price + Strikethrough MRP + Optional Tag */}
                    <View style={styles.variantCardBottomRow}>
                      <View style={styles.variantPriceContainer}>
                        <Text
                          style={[
                            styles.variantPriceText,
                            isSelected && styles.variantPriceTextSelected,
                          ]}
                        >
                          ₹{v.price}
                        </Text>
                        {v.mrp > v.price ? (
                          <Text style={styles.variantMrpText}>₹{v.mrp}</Text>
                        ) : null}
                      </View>

                      {parsed.tag ? (
                        <View
                          style={[
                            styles.variantTagBadge,
                            isSelected && styles.variantTagBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.variantTagText,
                              isSelected && styles.variantTagTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {parsed.tag}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. Quick Highlights & Info Chips */}
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeaderTitle}>Tea Characteristics</Text>
            <View style={styles.infoChipsGrid}>
              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="sprout" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.infoChipTitle}>100% Fresh Harvest</Text>
                  <Text style={styles.infoChipSub}>Packed within 48h</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="flame" size={18} color={theme.colors.accentGoldDark} />
                </View>
                <View>
                  <Text style={styles.infoChipTitle}>Strong Kadak Aroma</Text>
                  <Text style={styles.infoChipSub}>Amber rich liquor</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="zap" size={18} color={theme.colors.accentGoldDark} />
                </View>
                <View>
                  <Text style={styles.infoChipTitle}>48 hrs Fast Delivery</Text>
                  <Text style={styles.infoChipSub}>Direct to doorstep</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="leaf" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.infoChipTitle}>Zero Artificial Color</Text>
                  <Text style={styles.infoChipSub}>Pure organic leaves</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 5. Collapsible Section: About This Product */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAboutExpanded(!aboutExpanded)}
              style={styles.accordionHeader}
            >
              <Text style={styles.cardHeaderTitle}>About This Product</Text>
              <Icon
                name={aboutExpanded ? 'chevron-down' : 'chevron-right'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {aboutExpanded ? (
              <View style={styles.accordionBody}>
                <Text style={styles.descriptionText}>{product.description}</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Estate: Upper Assam & Darjeeling Himalayan Slopes</Text>
                  <Text style={styles.bulletItem}>• Grade: Premium Granular CTC & Whole Tips</Text>
                  <Text style={styles.bulletItem}>• Processing: Traditional CTC with CTC roller cuts</Text>
                  <Text style={styles.bulletItem}>• Shelf Life: 12 months in sealed vacuum packaging</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 6. Collapsible Section: Master Brewer's Guide */}
          <View style={styles.sectionCard}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setBrewingExpanded(!brewingExpanded)}
              style={styles.accordionHeader}
            >
              <Text style={styles.cardHeaderTitle}>Master Brewer's Guide</Text>
              <Icon
                name={brewingExpanded ? 'chevron-down' : 'chevron-right'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {brewingExpanded ? (
              <View style={styles.accordionBody}>
                <View style={styles.brewStep}>
                  <Text style={styles.brewStepNum}>1</Text>
                  <Text style={styles.brewStepText}>
                    Boil 1 cup of water and whole milk (50:50 ratio) in a saucepan.
                  </Text>
                </View>
                <View style={styles.brewStep}>
                  <Text style={styles.brewStepNum}>2</Text>
                  <Text style={styles.brewStepText}>
                    Add 1 teaspoon of Vardhamrit tea granules and your preferred sweetener.
                  </Text>
                </View>
                <View style={styles.brewStep}>
                  <Text style={styles.brewStepNum}>3</Text>
                  <Text style={styles.brewStepText}>
                    Simmer for 3-4 minutes on medium flame until rich caramel color develops.
                  </Text>
                </View>
                <View style={styles.brewStep}>
                  <Text style={styles.brewStepNum}>4</Text>
                  <Text style={styles.brewStepText}>
                    Strain into a clay kulhad or cup and savor the brisk mountain aroma!
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 7. Rating Summary Breakdown */}
          <View style={[styles.sectionCard, { marginBottom: theme.spacing.lg }]}>
            <Text style={styles.cardHeaderTitle}>Ratings & Reviews</Text>
            <View style={styles.ratingSummaryRow}>
              <View style={styles.ratingScoreCircle}>
                <Text style={styles.bigRatingScore}>{product.rating.toFixed(1)}</Text>
                <View style={styles.starClusterRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Icon
                      key={i}
                      name="star"
                      size={12}
                      color={theme.colors.accentGoldDark}
                      fill={theme.colors.accentGoldDark}
                    />
                  ))}
                </View>
                <Text style={styles.verifiedBuyersText}>
                  {product.reviewCount} verified buyers
                </Text>
              </View>

              <View style={styles.breakdownBars}>
                {[
                  { star: '5', pct: '85%' },
                  { star: '4', pct: '11%' },
                  { star: '3', pct: '3%' },
                  { star: '2', pct: '1%' },
                  { star: '1', pct: '0%' },
                ].map((b, idx) => (
                  <View key={idx} style={styles.barRow}>
                    <View style={styles.barStarLabel}>
                      <Text style={styles.barLabel}>{b.star}</Text>
                      <Icon
                        name="star"
                        size={9}
                        color={theme.colors.accentGoldDark}
                        fill={theme.colors.accentGoldDark}
                      />
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: b.pct as any }]} />
                    </View>
                    <Text style={styles.barPct}>{b.pct}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 8. Sticky Bottom Add to Cart Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarDetails}>
            <Text style={styles.bottomPackLabel}>{selectedVariant.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.bottomPrice}>₹{selectedVariant.price}</Text>
              {selectedVariant.mrp > selectedVariant.price ? (
                <Text style={styles.bottomMrp}>₹{selectedVariant.mrp}</Text>
              ) : null}
            </View>
          </View>

          <AddButton
            product={product}
            variant={selectedVariant}
            size="lg"
            style={styles.bottomAddBtn}
          />
        </View>

        {/* Floating View Cart Bar if items exist */}
        <ViewCartBar bottomOffset={84} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 10,
    paddingHorizontal: theme.spacing.base,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  navRight: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 88 : 62,
    paddingBottom: 120,
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: 330,
    backgroundColor: '#FAF8F5',
    position: 'relative',
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    height: 330,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  floatingBadgesRow: {
    position: 'absolute',
    bottom: theme.spacing.base,
    left: theme.spacing.base,
    right: theme.spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroDiscountBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    ...theme.shadows.subtle,
  },
  deliveryBadgeText: {
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  dotsRow: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.primary,
  },
  dotInactive: {
    width: 6,
    backgroundColor: theme.colors.borderStrong,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.base,
    marginHorizontal: theme.spacing.base,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.subtle,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  brandTag: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  productTitle: {
    fontSize: theme.typography.scale.xl - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeights.lg,
  },
  productTagline: {
    fontSize: theme.typography.scale.xs + 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  priceCurrent: {
    fontSize: theme.typography.scale.xxl,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  priceMrp: {
    fontSize: theme.typography.scale.md,
    color: theme.colors.textHint,
    textDecorationLine: 'line-through',
  },
  priceTaxHint: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.textSecondary,
  },
  savingsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.accentBerryMuted,
    borderWidth: 1,
    borderColor: theme.colors.accentBerryBorder,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  savingsStripText: {
    color: theme.colors.accentBerry,
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.extraBold,
    textAlign: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  cardHeaderTitle: {
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  cardHeaderSubtitle: {
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  variantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  variantGridCard: {
    width: '48%',
    marginBottom: 10,
    minHeight: 74,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  variantGridCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.8,
    ...theme.shadows.subtle,
  },
  variantCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.8,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  variantSizeText: {
    fontSize: theme.typography.scale.xs + 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  variantSizeTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.extraBold,
  },
  variantSavingsBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: theme.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  variantSavingsBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  variantSavingsText: {
    color: '#DC2626',
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.2,
  },
  variantSavingsTextActive: {
    color: theme.colors.textInverse,
  },
  variantCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  variantPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  variantPriceText: {
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  variantPriceTextSelected: {
    color: theme.colors.primary,
  },
  variantMrpText: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.textHint,
    textDecorationLine: 'line-through',
    fontWeight: theme.typography.weights.medium,
  },
  variantTagBadge: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  variantTagBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  variantTagText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  variantTagTextActive: {
    color: '#15803D',
  },
  infoChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  infoChipIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoChipTitle: {
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  infoChipSub: {
    fontSize: theme.typography.scale.xs - 3,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionIcon: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  accordionBody: {
    marginTop: theme.spacing.md,
  },
  descriptionText: {
    fontSize: theme.typography.scale.xs + 1,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeights.sm,
  },
  bulletList: {
    marginTop: theme.spacing.sm,
    gap: 4,
  },
  bulletItem: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
  },
  brewStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  brewStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.xs - 1,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    lineHeight: 22,
    marginRight: theme.spacing.sm,
  },
  brewStepText: {
    flex: 1,
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeights.xs,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  ratingScoreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: theme.spacing.md,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  bigRatingScore: {
    fontSize: theme.typography.scale.xxl + 4,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  starClusterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  verifiedBuyersText: {
    fontSize: theme.typography.scale.xs - 2,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  breakdownBars: {
    flex: 1,
    gap: 4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  barStarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 20,
    gap: 2,
  },
  barLabel: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
    width: 24,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  barPct: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textHint,
    width: 28,
    textAlign: 'right',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.card,
  },
  bottomBarDetails: {
    justifyContent: 'center',
  },
  bottomPackLabel: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  bottomPrice: {
    fontSize: theme.typography.scale.xl,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  bottomMrp: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textHint,
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  bottomAddBtn: {
    minWidth: 130,
  },
});
