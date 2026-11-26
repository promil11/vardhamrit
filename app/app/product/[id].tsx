import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Animated,
  Easing,
  TextInput,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { theme } from '../../theme';
import {
  fetchProductDetail,
  subscribeToStockNotification,
  checkStockNotificationSubscription,
} from '../../services/catalogService';
import { Product, ProductVariant } from '../../types';
import { AddButton } from '../../components/product/AddButton';
import { RatingChip } from '../../components/common/RatingChip';
import { Badge } from '../../components/common/Badge';
import { ViewCartBar } from '../../components/cart/ViewCartBar';
import { ProductDetailSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { useCartStore } from '../../store/useCartStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useAuth } from '../../store/authContext';
import { BottomSheetWrapper } from '../../components/common/BottomSheetWrapper';
import { Icon } from '../../components/common/Icon';
import { getFullImageUrl } from '../../utils/imageUtils';
import { useResponsive } from '../../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { CHAI_REELS, getReelForProduct } from '../../constants/chaiReels';
import { ChaiReelsViewerModal } from '../../components/common/ChaiReelsViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const parseVariantLabel = (rawLabel: string) => {
  if (!rawLabel) return { size: 'Pack', tag: null };
  const label = rawLabel.trim();

  // Pattern 1: e.g. "500 g (Family Pack)" or "1 kg (Saver Pack)"
  const parenMatch = label.match(/^([^(]+?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    return { size: parenMatch[1].trim(), tag: parenMatch[2].trim() };
  }

  // Pattern 2: e.g. "1 kg Saver" or "500 g Value Pack"
  const tagKeywords = ['Saver Pack', 'Super Saver', 'Saver', 'Family Pack', 'Value Pack', 'Combo', 'Trial'];
  for (const kw of tagKeywords) {
    const reg = new RegExp(`^(.*?)\\s+(${kw}.*)$`, 'i');
    const m = label.match(reg);
    if (m && m[1].trim()) {
      return { size: m[1].trim(), tag: m[2].trim() };
    }
  }

  return { size: label, tag: null };
};

const getUnitPrice = (v: any, rawSize: string): string | null => {
  let grams = v.weightGrams;
  if (!grams || grams <= 0) {
    const kgMatch = rawSize.match(/([\d.]+)\s*kg/i);
    if (kgMatch) grams = parseFloat(kgMatch[1]) * 1000;
    else {
      const gMatch = rawSize.match(/([\d.]+)\s*g/i);
      if (gMatch) grams = parseFloat(gMatch[1]);
    }
  }
  if (grams && grams > 0 && v.price > 0) {
    const rate = Math.round((v.price / grams) * 100);
    return `(₹${rate}/100g)`;
  }
  return null;
};

export default function ProductDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const { isTablet } = useResponsive();

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
  const [reelsModalVisible, setReelsModalVisible] = useState(false);

  const matchingReel = React.useMemo(() => {
    return getReelForProduct(product);
  }, [product]);

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

  const { user, isAuthenticated } = useAuth();
  const [isSubscribedStock, setIsSubscribedStock] = useState(false);
  const [subscribingStock, setSubscribingStock] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [contactType, setContactType] = useState<'PHONE' | 'EMAIL'>('PHONE');
  const [stockAlertToast, setStockAlertToast] = useState<string | null>(null);

  const triggerHaptic = (feedbackStyle: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(feedbackStyle);
      } catch {
        // Haptics fallback
      }
    }
  };

  const isCurrentOutOfStock = selectedVariant ? (selectedVariant.stock !== undefined && selectedVariant.stock <= 0) : false;

  useEffect(() => {
    if (selectedVariant && isCurrentOutOfStock) {
      const contactVal = user?.email || user?.phone || null;
      checkStockNotificationSubscription(selectedVariant.id, contactVal)
        .then((sub) => setIsSubscribedStock(sub))
        .catch(() => setIsSubscribedStock(false));
    } else {
      setIsSubscribedStock(false);
    }
  }, [selectedVariant?.id, isCurrentOutOfStock, isAuthenticated, user?.email, user?.phone]);

  const handleNotifyMePress = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    if (isSubscribedStock) {
      setStockAlertToast("You're already on the priority restock list! 🍃");
      setTimeout(() => setStockAlertToast(null), 3500);
      return;
    }

    if (isAuthenticated && (user?.phone || user?.email)) {
      if (!product || !selectedVariant) return;
      setSubscribingStock(true);
      const res = await subscribeToStockNotification(product.id, selectedVariant.id, {
        email: user.email || undefined,
        phone: user.phone || undefined,
        contactType: user.phone ? 'PHONE' : 'EMAIL',
      });
      setSubscribingStock(false);
      if (res.success) {
        setIsSubscribedStock(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        setStockAlertToast(res.message);
        setTimeout(() => setStockAlertToast(null), 4000);
      } else {
        Alert.alert('Stock Notification', res.message);
      }
    } else {
      setContactInput(user?.phone || user?.email || '');
      setShowContactModal(true);
    }
  };

  const handleSubmitContactAlert = async () => {
    if (!contactInput.trim()) {
      Alert.alert('Required', contactType === 'PHONE' ? 'Please enter your phone number' : 'Please enter your email address');
      return;
    }

    if (contactType === 'PHONE') {
      const cleaned = contactInput.replace(/\D/g, '');
      if (cleaned.length < 10) {
        Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactInput.trim())) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
    }

    if (!product || !selectedVariant) return;
    setSubscribingStock(true);
    const payload = contactType === 'PHONE'
      ? { phone: contactInput.trim(), contactType: 'PHONE' as const }
      : { email: contactInput.trim(), contactType: 'EMAIL' as const };

    const res = await subscribeToStockNotification(product.id, selectedVariant.id, payload);
    setSubscribingStock(false);

    if (res.success) {
      setShowContactModal(false);
      setIsSubscribedStock(true);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      setStockAlertToast(res.message);
      setTimeout(() => setStockAlertToast(null), 4000);
    } else {
      Alert.alert('Stock Notification', res.message);
    }
  };

  // Collapsible Blinkit-style header animation
  const [headerHeight, setHeaderHeight] = useState(Platform.OS === 'ios' ? 88 : 62);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const isHeaderHidden = useRef(false);
  const lastScrollY = useRef(0);

  const showHeader = useCallback(() => {
    if (isHeaderHidden.current) {
      isHeaderHidden.current = false;
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [headerTranslateY]);

  const hideHeader = useCallback(() => {
    if (!isHeaderHidden.current) {
      isHeaderHidden.current = true;
      Animated.timing(headerTranslateY, {
        toValue: -headerHeight,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [headerTranslateY, headerHeight]);

  const handleVerticalScroll = (e: any) => {
    const currentScrollY = e.nativeEvent.contentOffset.y;
    const contentHeight = e.nativeEvent.contentSize?.height || 0;
    const layoutHeight = e.nativeEvent.layoutMeasurement?.height || 0;

    // Keep header visible near the top
    if (currentScrollY <= 15) {
      showHeader();
      lastScrollY.current = currentScrollY;
      return;
    }

    // Do not hide near bottom bounce
    if (contentHeight > 0 && currentScrollY + layoutHeight >= contentHeight - 30) {
      lastScrollY.current = currentScrollY;
      return;
    }

    const diff = currentScrollY - lastScrollY.current;
    if (Math.abs(diff) < 6) return;

    if (diff > 0 && currentScrollY > 50) {
      hideHeader();
    } else if (diff < 0) {
      showHeader();
    }
    lastScrollY.current = currentScrollY;
  };

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
        {/* Floating Top Nav (Back Button & Cart Button) (Collapsible) */}
        <Animated.View
          style={[
            styles.topNav,
            {
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - headerHeight) > 1) {
              setHeaderHeight(h);
            }
          }}
        >
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
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
          scrollEventThrottle={16}
          onScroll={handleVerticalScroll}
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
          <View style={[styles.sectionCard, isTablet && { padding: 20 }]}>
            <View style={styles.brandRow}>
              <Text style={[styles.brandTag, isTablet && { fontSize: 12 }]}>VARDHAMRIT GARDEN FRESH</Text>
              <RatingChip rating={product.rating} reviewCount={product.reviewCount} size="md" />
            </View>

            <Text style={[styles.productTitle, isTablet && { fontSize: 24, lineHeight: 30 }]}>{product.name}</Text>
            <Text style={[styles.productTagline, isTablet && { fontSize: 14.5, lineHeight: 20 }]}>{product.tagline}</Text>

            {/* Price Block */}
            <View style={styles.priceRow}>
              <Text style={[styles.priceCurrent, isTablet && { fontSize: 26 }]}>₹{selectedVariant.price}</Text>
              {selectedVariant.mrp > selectedVariant.price ? (
                <Text style={[styles.priceMrp, isTablet && { fontSize: 16 }]}>₹{selectedVariant.mrp}</Text>
              ) : null}
              <Text style={[styles.priceTaxHint, isTablet && { fontSize: 12 }]}>(Inclusive of all taxes)</Text>
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
              <View style={styles.packHeaderLeft}>
                <View style={styles.packHeaderIconBadge}>
                  <Icon name="package" size={15} color="#0F5132" />
                </View>
                <Text style={styles.cardHeaderTitle}>Select Pack Size</Text>
              </View>
              <View style={styles.packOptionsCounterBadge}>
                <Text style={styles.packOptionsCounterText}>
                  {product.variants.length} options available
                </Text>
              </View>
            </View>

            <View style={styles.variantsGrid}>
              {product.variants.map((v) => {
                const isSelected = v.id === selectedVariant.id;
                const isOutOfStock = v.stock !== undefined && v.stock <= 0;
                const vSavings = Math.max(0, v.mrp - v.price);
                const parsed = parseVariantLabel(v.label);
                const unitPrice = getUnitPrice(v, parsed.size);

                return (
                  <TouchableOpacity
                    key={v.id}
                    activeOpacity={0.82}
                    onPress={() => setSelectedVariant(v)}
                    style={[
                      styles.variantGridCard,
                      isSelected && styles.variantGridCardSelected,
                      isOutOfStock && styles.variantGridCardOutOfStock,
                      isSelected && isOutOfStock && styles.variantGridCardOutOfStockSelected,
                    ]}
                  >
                    {/* Top Row: Check Circle + Size + Savings / Sold Out Badge */}
                    <View style={styles.variantCardTopRow}>
                      <View style={styles.variantSizeRow}>
                        <View
                          style={[
                            styles.checkCircle,
                            isSelected && styles.checkCircleSelected,
                            isOutOfStock && styles.checkCircleOutOfStock,
                          ]}
                        >
                          {isSelected ? (
                            <Icon name="check" size={10} color="#FFFFFF" strokeWidth={3} />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.variantSizeText,
                            isSelected && styles.variantSizeTextSelected,
                            isOutOfStock && styles.variantSizeTextOutOfStock,
                          ]}
                          numberOfLines={1}
                        >
                          {parsed.size}
                        </Text>
                      </View>

                      {isOutOfStock ? (
                        <View style={styles.soldOutBadge}>
                          <Text style={styles.soldOutBadgeText}>Sold Out</Text>
                        </View>
                      ) : vSavings > 0 ? (
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

                    {/* Bottom Row: Price + Strikethrough MRP + Unit Rate */}
                    <View style={styles.variantCardBottomRow}>
                      <View style={styles.variantPriceContainer}>
                        <Text
                          style={[
                            styles.variantPriceText,
                            isSelected && styles.variantPriceTextSelected,
                            isOutOfStock && styles.variantPriceTextOutOfStock,
                          ]}
                        >
                          ₹{v.price}
                        </Text>
                        {v.mrp > v.price ? (
                          <Text style={styles.variantMrpText}>₹{v.mrp}</Text>
                        ) : null}
                      </View>

                      {unitPrice && !isOutOfStock ? (
                        <Text
                          style={[
                            styles.variantUnitRate,
                            isSelected && styles.variantUnitRateSelected,
                          ]}
                        >
                          {unitPrice}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Smart "Out of Stock" Notify Me Banner for selected variant */}
            {isCurrentOutOfStock ? (
              <View style={styles.restockNoticeCard}>
                <View style={styles.restockNoticeAccent} />

                <View style={styles.restockNoticeContent}>
                  <View style={styles.restockNoticeHeader}>
                    <View style={styles.restockNoticeIconWrapper}>
                      <Icon name="bell" size={16} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.restockNoticeTitleRow}>
                        <Text style={styles.restockNoticeTitle}>
                          {selectedVariant.label} is currently sold out
                        </Text>
                        <View style={styles.restockSoldOutPill}>
                          <Text style={styles.restockSoldOutText}>Sold Out</Text>
                        </View>
                      </View>
                      <Text style={styles.restockNoticeSub}>
                        {isSubscribedStock
                          ? "You're on the priority list! We'll alert you the moment fresh garden harvest arrives 🍃"
                          : "Fresh garden inventory is being harvested at our estate. Get alerted the moment it arrives!"}
                      </Text>
                    </View>
                  </View>

                  {!isSubscribedStock ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleNotifyMePress}
                      disabled={subscribingStock}
                      style={styles.restockNoticeBtn}
                    >
                      {subscribingStock ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="bell" size={14} color="#FFFFFF" />
                          <Text style={styles.restockNoticeBtnText}>Notify Me When Available</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.restockNoticeActiveBadge}>
                      <Icon name="badge-check" size={15} color="#059669" />
                      <Text style={styles.restockNoticeActiveText}>Priority Stock Notification Active 🍃</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>

          {/* 4. Quick Highlights & Info Chips */}
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeaderTitle}>Tea Characteristics</Text>
            <View style={styles.infoChipsGrid}>
              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="sprout" size={16} color={theme.colors.primary} />
                </View>
                <View style={styles.infoChipTextContainer}>
                  <Text style={styles.infoChipTitle} numberOfLines={2}>100% Fresh Harvest</Text>
                  <Text style={styles.infoChipSub} numberOfLines={1}>Packed within 48h</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="flame" size={16} color={theme.colors.accentGoldDark} />
                </View>
                <View style={styles.infoChipTextContainer}>
                  <Text style={styles.infoChipTitle} numberOfLines={2}>Strong Kadak Aroma</Text>
                  <Text style={styles.infoChipSub} numberOfLines={1}>Amber rich liquor</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="zap" size={16} color={theme.colors.accentGoldDark} />
                </View>
                <View style={styles.infoChipTextContainer}>
                  <Text style={styles.infoChipTitle} numberOfLines={2}>48 hrs Fast Delivery</Text>
                  <Text style={styles.infoChipSub} numberOfLines={1}>Direct to doorstep</Text>
                </View>
              </View>

              <View style={styles.infoChip}>
                <View style={styles.infoChipIconWrapper}>
                  <Icon name="leaf" size={16} color={theme.colors.primary} />
                </View>
                <View style={styles.infoChipTextContainer}>
                  <Text style={styles.infoChipTitle} numberOfLines={2}>Zero Artificial Color</Text>
                  <Text style={styles.infoChipSub} numberOfLines={1}>Pure organic leaves</Text>
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

          {/* Chai Story & Mini Garden Reel Showcase Card */}
          {matchingReel && (
            <View style={styles.asmrCardContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setReelsModalVisible(true)}
                style={styles.asmrCardTouchable}
              >
                <View style={styles.asmrCardInner}>
                  {/* Left Column: Story details & action */}
                  <View style={styles.asmrCardLeftCol}>
                    <View style={styles.asmrCardBadgeRow}>
                      <View style={styles.asmrReelBadge}>
                        <Icon name="play" size={9} color="#059669" fill="#059669" />
                        <Text style={styles.asmrReelBadgeText}>10s CHAI STORY</Text>
                      </View>
                      <View style={styles.asmrSoundBadge}>
                        <Icon name="headphones" size={10} color="#B45309" />
                        <Text style={styles.asmrSoundBadgeText}>ASMR</Text>
                      </View>
                    </View>

                    <Text style={styles.asmrCardHeading} numberOfLines={1}>
                      {matchingReel.title}
                    </Text>
                    <Text style={styles.asmrCardSubtext} numberOfLines={2}>
                      {matchingReel.tagline}
                    </Text>

                    <View style={styles.asmrPlayButton}>
                      <View style={styles.asmrPlayIconCircle}>
                        <Icon name="play" size={10} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 1 }} />
                      </View>
                      <Text style={styles.asmrPlayButtonText}>Experience Brew</Text>
                    </View>
                  </View>

                  {/* Right Column: Thumbnail with frosted glass play button */}
                  <View style={styles.asmrCardThumbWrapper}>
                    <Image
                      source={{ uri: getFullImageUrl(matchingReel.posterUrl) }}
                      style={styles.asmrCardThumb}
                      resizeMode="cover"
                    />
                    {/* Dark gradient vignette over thumbnail for contrast */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.45)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    {/* Centered glassmorphic play button */}
                    <View style={styles.thumbCenterPlay}>
                      <Icon name="play" size={14} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
                    </View>
                    {/* Bottom duration chip */}
                    <View style={styles.asmrDurationChip}>
                      <Text style={styles.asmrDurationText}>0:10</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.bottomPrice, isCurrentOutOfStock && styles.bottomPriceOutOfStock]}>
                ₹{selectedVariant.price}
              </Text>
              {selectedVariant.mrp > selectedVariant.price ? (
                <Text style={styles.bottomMrp}>₹{selectedVariant.mrp}</Text>
              ) : null}
              {isCurrentOutOfStock ? (
                <View style={styles.bottomOutOfStockBadge}>
                  <Text style={styles.bottomOutOfStockBadgeText}>Out of stock</Text>
                </View>
              ) : null}
            </View>
          </View>

          {isCurrentOutOfStock ? (
            isSubscribedStock ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  triggerHaptic();
                  setStockAlertToast("You're on the priority list! We'll alert you 🍃");
                  setTimeout(() => setStockAlertToast(null), 3000);
                }}
                style={styles.subscribedBottomBtn}
              >
                <Icon name="badge-check" size={17} color="#0F5132" />
                <Text style={styles.subscribedBottomBtnText}>Alert Set 🍃</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleNotifyMePress}
                disabled={subscribingStock}
                style={styles.notifyBottomBtn}
              >
                {subscribingStock ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="bell" size={16} color="#FFFFFF" />
                    <Text style={styles.notifyBottomBtnText}>Notify Me</Text>
                  </>
                )}
              </TouchableOpacity>
            )
          ) : (
            <AddButton
              product={product}
              variant={selectedVariant}
              size="lg"
              style={styles.bottomAddBtn}
            />
          )}
        </View>

        {/* Floating View Cart Bar if items exist */}
        <ViewCartBar bottomOffset={84} />

        {/* Floating Toast Notification */}
        {stockAlertToast ? (
          <View style={styles.toastBanner}>
            <Icon name="badge-check" size={16} color="#FFFFFF" />
            <Text style={styles.toastBannerText}>{stockAlertToast}</Text>
          </View>
        ) : null}

        {/* Contact Input Modal / BottomSheetWrapper */}
        <BottomSheetWrapper
          visible={showContactModal}
          onClose={() => setShowContactModal(false)}
          title="Stock Alert"
          subtitle={`${product.name} (${selectedVariant.label})`}
        >
          <View style={styles.sheetContactContainer}>
            <View style={styles.sheetInfoBanner}>
              <Icon name="sprout" size={18} color={theme.colors.primary} />
              <Text style={styles.sheetInfoText}>
                We will notify you the moment fresh garden inventory arrives in stock for this pack size.
              </Text>
            </View>

            <View style={styles.contactTypeTabs}>
              <TouchableOpacity
                onPress={() => setContactType('PHONE')}
                style={[
                  styles.contactTypeTab,
                  contactType === 'PHONE' && styles.contactTypeTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.contactTypeTabText,
                    contactType === 'PHONE' && styles.contactTypeTabTextActive,
                  ]}
                >
                  WhatsApp / SMS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setContactType('EMAIL')}
                style={[
                  styles.contactTypeTab,
                  contactType === 'EMAIL' && styles.contactTypeTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.contactTypeTabText,
                    contactType === 'EMAIL' && styles.contactTypeTabTextActive,
                  ]}
                >
                  Email Notification
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputFieldLabel}>
              {contactType === 'PHONE' ? 'Phone / WhatsApp Number' : 'Email Address'}
            </Text>
            <TextInput
              style={styles.contactTextInput}
              value={contactInput}
              onChangeText={setContactInput}
              placeholder={
                contactType === 'PHONE' ? 'e.g. 9876543210' : 'e.g. yourname@gmail.com'
              }
              placeholderTextColor="#9CA3AF"
              keyboardType={contactType === 'PHONE' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
            />

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSubmitContactAlert}
              disabled={subscribingStock}
              style={styles.submitAlertBtn}
            >
              {subscribingStock ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="bell" size={15} color="#FFFFFF" />
                  <Text style={styles.submitAlertBtnText}>Set Restock Notification</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetWrapper>

        {matchingReel && (
          <ChaiReelsViewerModal
            visible={reelsModalVisible}
            initialReelId={matchingReel.id}
            product={product}
            showProductRate={true}
            onClose={() => setReelsModalVisible(false)}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  asmrCardContainer: {
    marginHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  asmrCardTouchable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1E8D9',
    shadowColor: '#1A3826',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  asmrCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
    backgroundColor: '#FFFFFF',
  },
  asmrCardLeftCol: {
    flex: 1,
    justifyContent: 'center',
  },
  asmrCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  asmrReelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  asmrReelBadgeText: {
    color: '#065F46',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  asmrSoundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  asmrSoundBadgeText: {
    color: '#92400E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  asmrCardHeading: {
    color: '#0F172A',
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  asmrCardSubtext: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
    fontWeight: '500',
  },
  asmrPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F5132',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#0F5132',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  asmrPlayIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  asmrPlayButtonText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  asmrCardThumbWrapper: {
    width: 86,
    height: 108,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  asmrCardThumb: {
    width: '100%',
    height: '100%',
  },
  thumbCenterPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -15,
    marginLeft: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  asmrDurationChip: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  asmrDurationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
    backgroundColor: '#FFFFFF',
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
  packHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packHeaderIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packOptionsCounterBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  packOptionsCounterText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
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
    marginTop: 12,
  },
  variantGridCard: {
    width: '48.5%',
    marginBottom: 11,
    minHeight: 82,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  variantGridCardSelected: {
    borderColor: '#0F5132',
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    shadowColor: '#0F5132',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2.5,
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
  checkCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: '#0F5132',
    backgroundColor: '#0F5132',
  },
  checkCircleOutOfStock: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  variantSizeTextSelected: {
    color: '#0F5132',
    fontWeight: '900',
  },
  variantSavingsBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#FECACA',
  },
  variantSavingsBadgeActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  variantSavingsText: {
    color: '#DC2626',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  variantSavingsTextActive: {
    color: '#FFFFFF',
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
    fontSize: 16.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  variantPriceTextSelected: {
    color: '#0F5132',
  },
  variantMrpText: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  variantUnitRate: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  variantUnitRateSelected: {
    color: '#15803D',
    fontWeight: '700',
  },
  variantTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FEF3C7',
    borderWidth: 0.8,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  variantTagBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  variantTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  variantTagTextActive: {
    color: '#0F5132',
  },
  infoChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
    overflow: 'hidden',
  },
  infoChipIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoChipTextContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  infoChipTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    lineHeight: 14,
  },
  infoChipSub: {
    fontSize: 9.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: 12,
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
  variantGridCardOutOfStock: {
    backgroundColor: '#FAFAFC',
    borderColor: '#E2E8F0',
    opacity: 0.88,
  },
  variantGridCardOutOfStockSelected: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  radioCircleOutOfStock: {
    borderColor: '#CBD5E1',
  },
  radioDotOutOfStock: {
    backgroundColor: '#F59E0B',
  },
  variantSizeTextOutOfStock: {
    color: '#94A3B8',
  },
  variantPriceTextOutOfStock: {
    color: '#94A3B8',
  },
  soldOutBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 0.8,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soldOutBadgeText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  restockNoticeCard: {
    marginTop: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  restockNoticeAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#D97706',
  },
  restockNoticeContent: {
    padding: 14,
    paddingLeft: 16,
    gap: 12,
  },
  restockNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  restockNoticeIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restockNoticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  restockNoticeTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  restockSoldOutPill: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  restockSoldOutText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
    textTransform: 'uppercase',
  },
  restockNoticeSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
    fontWeight: '500',
  },
  restockNoticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F5132',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignSelf: 'flex-start',
    shadowColor: '#0F5132',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  restockNoticeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  restockNoticeActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  restockNoticeActiveText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomPriceOutOfStock: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  bottomOutOfStockBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bottomOutOfStockBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  notifyBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F5132',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.pill,
    minWidth: 140,
    ...theme.shadows.subtle,
  },
  notifyBottomBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.3,
  },
  subscribedBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
    borderRadius: theme.radius.pill,
    minWidth: 140,
  },
  subscribedBottomBtnText: {
    color: '#0F5132',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 75,
    left: theme.spacing.base,
    right: theme.spacing.base,
    backgroundColor: '#0F5132',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 100,
    ...theme.shadows.card,
  },
  toastBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: '#FFFFFF',
  },
  sheetContactContainer: {
    padding: theme.spacing.base,
    gap: 14,
  },
  sheetInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  sheetInfoText: {
    flex: 1,
    fontSize: 11.5,
    color: '#0F5132',
    lineHeight: 16,
  },
  contactTypeTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  contactTypeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  contactTypeTabActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  contactTypeTabText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textSecondary,
  },
  contactTypeTabTextActive: {
    color: '#0F5132',
    fontWeight: theme.typography.weights.bold,
  },
  inputFieldLabel: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  contactTextInput: {
    fontSize: 12,
    fontWeight: 'normal',
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    marginTop: 6,
  },
  submitAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
  },
});
