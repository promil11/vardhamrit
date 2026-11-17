import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ViewStyle,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Product, ProductVariant } from '../../types';
import { useWishlistStore } from '../../store/useWishlistStore';
import { AddButton } from './AddButton';
import { BottomSheetWrapper } from '../common/BottomSheetWrapper';
import { Icon } from '../common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';
import { useResponsive } from '../../utils/responsive';

interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
  style?: ViewStyle;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  layout = 'grid',
  style,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedVariantId, setSelectedVariantId] = useState<number | string | null>(
    product.variants?.[0]?.id ?? null
  );

  // Always resolve the active variant from product.variants to ensure real-time price & % OFF sync
  const selectedVariant = useMemo(() => {
    if (!product.variants || product.variants.length === 0) {
      return { id: 0, label: '250 g', price: 0, mrp: 0, stock: 0, weightGrams: 250 };
    }
    const found = product.variants.find(
      (v) => v.id === selectedVariantId || String(v.id) === String(selectedVariantId)
    );
    return found || product.variants[0];
  }, [product.variants, selectedVariantId]);

  const [variantSheetVisible, setVariantSheetVisible] = useState(false);
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const isFavorite = isInWishlist(product.id);

  const discount =
    selectedVariant.mrp > selectedVariant.price
      ? Math.round(
        ((selectedVariant.mrp - selectedVariant.price) / selectedVariant.mrp) *
        100
      )
      : null;

  const savings = Math.max(0, selectedVariant.mrp - selectedVariant.price);

  const handleCardPress = () => {
    router.push({
      pathname: '/product/[id]',
      params: { id: String(product.id), from: pathname || '' },
    });
  };

  const handleSelectVariant = (variant: ProductVariant) => {
    setSelectedVariantId(variant.id);
    setVariantSheetVisible(false);
  };

  const toggleFavorite = (e: any) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const isList = layout === 'list';
  const { isTablet, scale, productCardWidth, productImageHeight, scaleFont, scaleSize } =
    useResponsive();

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.93}
        onPress={handleCardPress}
        style={[
          styles.card,
          { width: isList ? '100%' : productCardWidth },
          isTablet && styles.cardTablet,
          isList && styles.cardList,
          style,
        ]}
      >
        {/* Image Showcase */}
        <View
          style={[
            styles.imageContainer,
            { height: isList ? (isTablet ? 130 : 108) : productImageHeight },
            isList && [styles.imageContainerList, isTablet && styles.imageContainerListTablet],
          ]}
        >
          <Image
            source={{
              uri: getFullImageUrl(
                product.imageUrl ||
                (product as any).image ||
                (product as any).primary_image ||
                (product.images && product.images[0])
              ),
            }}
            style={styles.image}
            resizeMode="contain"
          />

          {/* Top-Left: High-energy Discount Pill */}
          {discount ? (
            <LinearGradient
              colors={['#DC2626', '#E11D48']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.discountBadge, isTablet && styles.discountBadgeTablet]}
            >
              <Icon name="flame" size={isTablet ? 11 : 9} color="#FFFFFF" />
              <Text style={[styles.discountBadgeText, isTablet && { fontSize: scaleFont(9.5) }]}>
                {discount}% OFF
              </Text>
            </LinearGradient>
          ) : null}

          {/* Top-Right: Quick Wishlist / Save Heart */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleFavorite}
            style={[styles.favoriteButton, isTablet && styles.favoriteButtonTablet]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="heart"
              size={isTablet ? 16 : 13}
              color={isFavorite ? '#DC2626' : '#6B7280'}
              fill={isFavorite ? '#DC2626' : 'transparent'}
            />
          </TouchableOpacity>

          {/* Bottom of Image: Status Micro-Ribbon */}
          {product.isBestSeller ? (
            <View style={[styles.imageBottomBannerGold, isTablet && styles.imageBottomBannerTablet]}>
              <Icon name="crown" size={isTablet ? 11 : 9} color="#B45309" />
              <Text style={[styles.imageBottomBannerGoldText, isTablet && { fontSize: scaleFont(9.5) }]}>
                BESTSELLER
              </Text>
            </View>
          ) : product.isFreshHarvest ? (
            <View style={[styles.imageBottomBannerGreen, isTablet && styles.imageBottomBannerTablet]}>
              <Icon name="sprout" size={isTablet ? 11 : 9} color="#15803D" />
              <Text style={[styles.imageBottomBannerGreenText, isTablet && { fontSize: scaleFont(9.5) }]}>
                FRESH 2026
              </Text>
            </View>
          ) : null}
        </View>

        {/* Content Details */}
        <View
          style={[
            styles.detailsContainer,
            isList && styles.detailsContainerList,
          ]}
        >
          {/* Product Name (Bold) */}
          <Text
            style={[
              styles.name,
              isList && styles.nameList,
              isTablet && {
                fontSize: scaleFont(isList ? 15.5 : 14.5),
                lineHeight: scaleFont(isList ? 21 : 19),
                minHeight: isList ? 0 : scaleSize(38),
              },
            ]}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {/* Tagline / Tasting Notes */}
          {product.tagline ? (
            <Text
              style={[styles.tagline, isTablet && { fontSize: scaleFont(11.5) }]}
              numberOfLines={1}
            >
              {product.tagline}
            </Text>
          ) : null}

          {/* Rating & Reviews */}
          <View style={styles.ratingRow}>
            <View style={[styles.ratingPill, isTablet && styles.ratingPillTablet]}>
              <Icon name="star" size={isTablet ? 11.5 : 9.5} color="#D97706" />
              <Text style={[styles.ratingText, isTablet && { fontSize: scaleFont(11.5) }]}>
                {product.rating.toFixed(1)}
              </Text>
            </View>
            <Text style={[styles.reviewCountText, isTablet && { fontSize: scaleFont(11) }]}>
              ({product.reviewCount})
            </Text>
          </View>

          {/* Pack Size / Variant Selector Capsule */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setVariantSheetVisible(true)}
            style={[styles.variantCapsule, isTablet && styles.variantCapsuleTablet]}
          >
            <View>
              <Text
                style={[styles.variantCapsuleText, isTablet && { fontSize: scaleFont(13.5) }]}
              >
                {selectedVariant.label}
              </Text>
            </View>
            <View>
              {product.variants.length > 1 ? (
                <View style={styles.variantDropdownArrow}>
                  <Text
                    style={[styles.variantMultiCount, isTablet && { fontSize: scaleFont(13.5) }]}
                  >
                    {product.variants.length} sizes
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={isTablet ? 12 : 10}
                    color={theme.colors.textSecondary}
                  />
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* Price & Add to Cart Footer */}
          <View style={styles.footerRow}>
            <View style={styles.priceColumn}>
              <View style={styles.priceRow}>
                <Text style={[styles.sellingPrice, isTablet && { fontSize: scaleFont(18.5) }]}>
                  ₹{selectedVariant.price}
                </Text>
                {selectedVariant.mrp > selectedVariant.price ? (
                  <Text style={[styles.mrpPrice, isTablet && { fontSize: scaleFont(13) }]}>
                    ₹{selectedVariant.mrp}
                  </Text>
                ) : null}
              </View>
              {savings > 0 ? (
                <Text style={[styles.savingsLabel, isTablet && { fontSize: scaleFont(10.5) }]}>
                  Save ₹{savings}
                </Text>
              ) : null}
            </View>

            {/* Tactile Add / Stepper Button */}
            <AddButton
              product={product}
              variant={selectedVariant}
              size={isTablet ? 'md' : 'sm'}
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Modern Variant Selector Bottom Sheet */}
      <BottomSheetWrapper
        visible={variantSheetVisible}
        onClose={() => setVariantSheetVisible(false)}
        title="Select Pack Size"
        subtitle={product.name}
      >
        <View style={styles.sheetVariantsList}>
          {product.variants.map((v) => {
            const isSelected = v.id === selectedVariant.id;
            const variantSavings = Math.max(0, v.mrp - v.price);
            return (
              <TouchableOpacity
                key={v.id}
                activeOpacity={0.8}
                onPress={() => handleSelectVariant(v)}
                style={[
                  styles.variantOption,
                  isSelected && styles.variantOptionActive,
                ]}
              >
                <View style={styles.variantLeftCol}>
                  <View style={styles.variantTitleRow}>
                    <View
                      style={[
                        styles.radioIndicator,
                        isSelected && styles.radioIndicatorActive,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <Text style={styles.variantOptionLabel}>{v.label}</Text>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>SELECTED</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.variantOptionSavings}>
                    {variantSavings > 0
                      ? `Save ₹${variantSavings} (${Math.round((variantSavings / v.mrp) * 100)}% OFF)`
                      : 'Standard pack'}
                  </Text>
                </View>

                <View style={styles.variantRightCol}>
                  <Text style={styles.sheetVariantPrice}>₹{v.price}</Text>
                  {v.mrp > v.price ? (
                    <Text style={styles.sheetVariantMrp}>₹{v.mrp}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheetWrapper>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    width: theme.layout.productCardWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTablet: {
    padding: 12,
    borderRadius: 22,
  },
  cardList: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 12,
  },
  imageContainer: {
    width: '100%',
    height: theme.layout.productImageHeight || 136,
    borderRadius: 14,
    backgroundColor: '#FAF8F5',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainerList: {
    width: 108,
    height: 108,
    borderRadius: 14,
    marginRight: 12,
  },
  imageContainerListTablet: {
    width: 130,
    height: 130,
    borderRadius: 18,
    marginRight: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  discountBadgeTablet: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  favoriteButtonTablet: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  imageBottomBannerGold: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(254, 243, 199, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  imageBottomBannerTablet: {
    paddingVertical: 3.5,
    gap: 4,
  },
  imageBottomBannerGoldText: {
    fontSize: 8,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  imageBottomBannerGreen: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(220, 252, 231, 0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  imageBottomBannerGreenText: {
    fontSize: 8,
    fontWeight: theme.typography.weights.extraBold,
    color: '#166534',
    letterSpacing: 0.5,
  },
  detailsContainer: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  detailsContainerList: {
    marginTop: 0,
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 108,
  },
  variantCapsule: {
    flexDirection: 'row',
    justifyContent: "space-between",
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginBottom: 5,
    gap: 4,
  },
  variantCapsuleTablet: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginBottom: 8,
  },
  variantCapsuleText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  variantDropdownArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  variantMultiCount: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textSecondary,
  },
  name: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    lineHeight: 16.5,
    minHeight: 33,
  },
  nameList: {
    fontSize: 13.5,
    minHeight: 0,
    lineHeight: 18,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 4,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    gap: 2.5,
  },
  ratingPillTablet: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3.5,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
  },
  reviewCountText: {
    fontSize: 9.5,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
  },
  priceColumn: {
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sellingPrice: {
    fontSize: 15.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  mrpPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  savingsLabel: {
    fontSize: 9,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
    marginTop: 1,
  },
  sheetVariantsList: {
    gap: 9,
    paddingBottom: 28,
  },
  variantOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  variantOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  variantLeftCol: {
    flex: 1,
  },
  variantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioIndicatorActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  variantOptionLabel: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  selectedBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginLeft: 8,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
  },
  variantOptionSavings: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: theme.typography.weights.semiBold,
    marginTop: 2,
    marginLeft: 24,
  },
  variantRightCol: {
    alignItems: 'flex-end',
  },
  sheetVariantPrice: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  sheetVariantMrp: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
});

export default ProductCard;
