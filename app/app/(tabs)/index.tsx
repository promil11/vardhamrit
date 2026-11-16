import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Address, Product } from '../../types';
import { fetchCategories, fetchProducts, normalizeProduct } from '../../services/catalogService';
import { fetchBanners, fetchFlashDeals, fetchBrewingGuides, fetchTrustProps } from '../../services/contentService';
import { fetchUserAddresses, saveUserAddress } from '../../services/addressService';
import { socket } from '../../services/socketService';
import { HomeHeader } from '../../components/home/HomeHeader';
import { AddressBottomSheet } from '../../components/home/AddressBottomSheet';
import { AddAddressModal } from '../../components/checkout/AddAddressModal';
import { BannerCarousel, BannerItem } from '../../components/home/BannerCarousel';
import { CategoryTile, CategoryItem } from '../../components/home/CategoryTile';
import { SectionHeader } from '../../components/home/SectionHeader';
import { ProductCard } from '../../components/product/ProductCard';
import { ViewCartBar } from '../../components/cart/ViewCartBar';
import { HomeScreenSkeleton } from '../../components/common/Skeleton';
import { useAddressStore } from '../../store/useAddressStore';
import { useWishlistStore } from '../../store/useWishlistStore';
import { Icon } from '../../components/common/Icon';
import { useCartStore } from '../../store/useCartStore';
import { useAuth } from '../../store/authContext';
import { fetchUserOrders } from '../../services/orderClientService';
import { getFullImageUrl } from '../../utils/imageUtils';

const VALUE_PROPS = [
  { icon: 'zap' as const, title: '48 hrs Delivery', desc: 'Garden-fresh tea fast', color: '#D97706', bg: '#FEF3C7' },
  { icon: 'leaf' as const, title: 'Single Origin', desc: 'Assam & Darjeeling', color: '#15803D', bg: '#DCFCE7' },
  { icon: 'tag' as const, title: 'Garden Direct', desc: 'Save up to 30% fair', color: '#0284C7', bg: '#E0F2FE' },
  { icon: 'shield-check' as const, title: '100% Whole Leaf', desc: 'Zero artificial colors', color: '#7C3AED', bg: '#EDE9FE' },
];

const TASTE_FILTERS = [
  { id: 'all', label: 'All Teas', emoji: '✨' },
  { id: 'normal', label: 'Normal Chai', emoji: '☕' },
  { id: 'masala', label: 'Masala Chai', emoji: '🌶️' },
  { id: 'keser', label: 'Keser Chai', emoji: '👑' },
  { id: 'chocolate', label: 'Chocolate Chai', emoji: '🍫' },
];

function getCategoryFromBanner(banner: any): string {
  if (banner.category) return banner.category;
  const target = (banner.target_url || banner.targetUrl || '').toLowerCase();
  if (target.includes('category=')) {
    const match = target.match(/category=([a-z0-9_-]+)/i);
    if (match) return match[1];
  }
  const slug = (banner.slug || '').toLowerCase();
  const headline = (banner.headline || banner.title || '').toLowerCase();
  const tagline = (banner.tagline || '').toLowerCase();

  if (slug.includes('masala') || headline.includes('masala') || tagline.includes('masala')) return 'masala';
  if (slug.includes('keser') || headline.includes('keser') || tagline.includes('keser') || headline.includes('saffron')) return 'keser';
  if (slug.includes('chocolate') || headline.includes('chocolate') || tagline.includes('chocolate') || headline.includes('cocoa')) return 'chocolate';
  if (slug.includes('normal') || slug.includes('kadak') || headline.includes('normal') || headline.includes('kadak')) return 'normal';

  if (String(banner.id) === '1' || String(banner.id) === 'b1') return 'normal';
  if (String(banner.id) === '2' || String(banner.id) === 'b2') return 'masala';
  if (String(banner.id) === '3' || String(banner.id) === 'b3') return 'keser';
  if (String(banner.id) === '4' || String(banner.id) === 'b4') return 'chocolate';

  return 'all';
}

export default function HomeScreen() {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { user, isAuthenticated } = useAuth();

  const {
    addresses,
    selectedAddress,
    setSelectedAddress,
    loadAddresses,
    addNewAddress,
  } = useAddressStore();
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const [addAddressModalVisible, setAddAddressModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic database API state
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [flashDeals, setFlashDeals] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [catData, bannerData, prodData, dealsData, ordersData] = await Promise.all([
        fetchCategories(),
        fetchBanners(),
        fetchProducts(),
        fetchFlashDeals(),
        isAuthenticated ? fetchUserOrders(1, 50).catch(() => null) : Promise.resolve(null),
        loadAddresses(),
        useWishlistStore.getState().loadWishlist(),
      ]);

      setCategories(catData || []);
      setBanners(bannerData || []);
      setProducts(prodData?.items || []);
      setUserOrders(ordersData?.orders || []);
      setFlashDeals(dealsData || []);
    } catch (e) {
      console.warn('API error in HomeScreen:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch recent orders if user is authenticated (to populate "Buy Again")
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserOrders(1, 50)
        .then((res) => {
          setUserOrders(res?.orders || []);
        })
        .catch(() => {
          setUserOrders([]);
        });
    } else {
      setUserOrders([]);
    }
  }, [isAuthenticated, user?.id]);

  // Real-time Socket.IO catalog sync: new/updated/deleted products appear live without refresh
  useEffect(() => {
    const handleProductCreated = (rawProd: any) => {
      try {
        if (!rawProd || !rawProd.id) return;
        const newProd = normalizeProduct(rawProd);
        setProducts((prev) => {
          if (prev.some((p) => p.id === newProd.id)) {
            return prev.map((p) => (p.id === newProd.id ? newProd : p));
          }
          return [newProd, ...prev];
        });
      } catch (err) {
        console.warn('Socket product.created handling error:', err);
      }
    };

    const handleProductUpdated = (rawProd: any) => {
      try {
        if (!rawProd || !rawProd.id) return;
        const updatedProd = normalizeProduct(rawProd);
        setProducts((prev) =>
          prev.map((p) => (Number(p.id) === Number(updatedProd.id) ? updatedProd : p))
        );
      } catch (err) {
        console.warn('Socket product.updated handling error:', err);
      }
    };

    const handleProductDeleted = (data: { productId: number | string }) => {
      try {
        if (!data?.productId) return;
        const targetId = Number(data.productId);
        setProducts((prev) =>
          prev.filter((p) => p.id !== targetId && String(p.id) !== String(data.productId))
        );
      } catch (err) {
        console.warn('Socket product.deleted handling error:', err);
      }
    };

    const handleCatalogUpdated = (data: any) => {
      try {
        if (!data) return;
        if (data.action === 'created' && data.product) {
          handleProductCreated(data.product);
        } else if (data.action === 'updated' && data.product) {
          handleProductUpdated(data.product);
        } else if (data.action === 'deleted' && data.productId) {
          handleProductDeleted({ productId: data.productId });
        }
      } catch (err) {
        console.warn('Socket catalog.updated handling error:', err);
      }
    };

    const handleDealsUpdated = (data: any) => {
      try {
        if (Array.isArray(data)) {
          setFlashDeals(data.filter((d: any) => (d.remainingSeconds ?? 0) > 0));
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.promotions)) {
            setFlashDeals(data.promotions.filter((d: any) => (d.remainingSeconds ?? 0) > 0));
          } else if (Array.isArray(data.items)) {
            setFlashDeals(data.items.filter((d: any) => (d.remainingSeconds ?? 0) > 0));
          } else if ((data.remainingSeconds ?? 0) > 0) {
            setFlashDeals([data]);
          } else {
            setFlashDeals([]);
          }
        } else {
          setFlashDeals([]);
        }
      } catch (err) {
        console.warn('Socket deals.updated error:', err);
      }
    };

    socket.on('product.created', handleProductCreated);
    socket.on('product.updated', handleProductUpdated);
    socket.on('product.deleted', handleProductDeleted);
    socket.on('catalog.updated', handleCatalogUpdated);
    socket.on('deals.updated', handleDealsUpdated);
    socket.on('deal.updated', handleDealsUpdated);
    socket.on('flash_deal.updated', handleDealsUpdated);

    return () => {
      socket.off('product.created', handleProductCreated);
      socket.off('product.updated', handleProductUpdated);
      socket.off('product.deleted', handleProductDeleted);
      socket.off('catalog.updated', handleCatalogUpdated);
      socket.off('deals.updated', handleDealsUpdated);
      socket.off('deal.updated', handleDealsUpdated);
      socket.off('flash_deal.updated', handleDealsUpdated);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setFlashDeals((prev) => {
        if (!prev || prev.length === 0) return [];
        return prev
          .map((d) => ({
            ...d,
            remainingSeconds: Math.max(0, (d.remainingSeconds ?? 14400) - 1),
          }))
          .filter((d) => d.remainingSeconds > 0);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
  };

  // Filtered products if user typed in search bar
  const isSearching = searchQuery.trim().length > 0;
  const searchedProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.tagline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to determine if a product has an active discount
  const isDiscountProduct = (p: Product): boolean => {
    if (Number(p.discountPercentage || 0) > 0) return true;
    if (Number((p as any).discount_percentage || 0) > 0) return true;
    if (Array.isArray(p.variants) && p.variants.some((v: any) => Number(v.mrp || 0) > Number(v.price || 0))) {
      return true;
    }
    return false;
  };

  // Categorized product rails from dynamic API
  const bestSellers = products.filter((p) => p.isBestSeller || (p as any).is_bestseller);
  const freshStock = products.filter((p) => p.isFreshHarvest || (p as any).is_fresh_harvest);

  // Super Saver Combos: ONLY products that have a discount
  const comboDeals = useMemo(() => products.filter(isDiscountProduct), [products]);

  // Buy Again: ONLY populated if the user has previously ordered something
  const buyAgain = useMemo(() => {
    if (!isAuthenticated || !user || !userOrders || userOrders.length === 0) {
      return [];
    }
    const orderedProductIds: number[] = [];
    userOrders.forEach((o: any) => {
      const st = String(o.order_status || o.status || '').toUpperCase();
      if (st === 'CANCELLED' || st === 'REJECTED') {
        return;
      }
      (o.items || []).forEach((it: any) => {
        const pid = Number(it.productId ?? it.product_id);
        if (pid && !orderedProductIds.includes(pid)) {
          orderedProductIds.push(pid);
        }
      });
    });

    if (orderedProductIds.length === 0) return [];

    return orderedProductIds
      .map((id) => products.find((p) => Number(p.id) === id))
      .filter((p): p is Product => Boolean(p));
  }, [isAuthenticated, user, userOrders, products]);

  // Dynamic products matched to 2026 Sommelier taste filter (Strictly 4 flavours)
  const filterMatchedProducts = useMemo(() => {
    if (activeFilter === 'all') return [];
    if (activeFilter === 'normal' || activeFilter === 'kadak') {
      return products.filter(
        (p) =>
          p.category === 'normal' ||
          p.category === 'kadak' ||
          p.name.toLowerCase().includes('normal') ||
          p.name.toLowerCase().includes('kadak')
      );
    }
    if (activeFilter === 'masala') {
      return products.filter(
        (p) =>
          p.category === 'masala' ||
          p.name.toLowerCase().includes('masala') ||
          p.name.toLowerCase().includes('spice')
      );
    }
    if (activeFilter === 'keser') {
      return products.filter(
        (p) =>
          p.category === 'keser' ||
          p.name.toLowerCase().includes('keser') ||
          p.name.toLowerCase().includes('saffron')
      );
    }
    if (activeFilter === 'chocolate') {
      return products.filter(
        (p) =>
          p.category === 'chocolate' ||
          p.name.toLowerCase().includes('chocolate') ||
          p.name.toLowerCase().includes('cocoa')
      );
    }
    return products.filter((p) => p.category === activeFilter);
  }, [activeFilter, products]);

  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const DEAL_CARD_WIDTH =
    flashDeals.length > 1
      ? Math.min(SCREEN_WIDTH - 52, 380)
      : SCREEN_WIDTH - theme.spacing.base * 2;

  const onRefresh = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    setRefreshing(true);
    loadData();
  };

  const handleCategoryPress = (categoryId: string) => {
    if (activeFilter === categoryId) {
      setActiveFilter('all');
    } else {
      setActiveFilter(categoryId);
    }
  };

  const handleSaveNewAddress = async (newAddr: Address) => {
    try {
      await addNewAddress(newAddr);
    } catch (e) {
      console.warn('Error saving new address from Home:', e);
    }
  };

  const handleShopRecipeKit = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    const assam = products.find((p) => p.name.includes('Assam') || p.category === 'kadak') || products[0];
    const elaichi = products.find((p) => p.name.includes('Elaichi') || p.category === 'elaichi') || products[1] || products[0];
    if (assam && assam.variants?.length) addItem(assam, assam.variants[0]);
    if (elaichi && elaichi.variants?.length) addItem(elaichi, elaichi.variants[0]);
  };

  const handleClaimFlashDeal = (deal: any) => {
    if (!deal) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    const matchedProduct =
      (deal.productId ? products.find((p) => Number(p.id) === Number(deal.productId)) : null) ||
      products[0] ||
      null;

    if (!matchedProduct || !matchedProduct.variants?.length) return;
    const variants = matchedProduct.variants || [];
    const dealVariant =
      (deal.variantId
        ? variants.find((v) => Number(v.id) === Number(deal.variantId))
        : null) ||
      variants.find((v: any) => v.weightGrams === 500 || v.weight_grams === 500) ||
      variants[0];

    if (!dealVariant) return;

    const dealPrice = Number(deal.dealPrice) || Number(deal.price) || 249;
    const dealMrp = Number(deal.originalPrice) || Number(deal.mrp) || 385;
    const dealTitle = deal.title || matchedProduct.name;
    const dealImage =
      deal.image ||
      deal.imageUrl ||
      matchedProduct.imageUrl ||
      (matchedProduct as any)?.image ||
      (matchedProduct as any)?.primary_image ||
      (matchedProduct?.images && matchedProduct.images[0]) ||
      'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80';

    addItem(matchedProduct, dealVariant, {
      price: dealPrice,
      mrp: dealMrp,
      productName: dealTitle,
      variantLabel: `${deal.variantLabel || dealVariant?.label || 'Pack'} (Deal of the Day)`,
      imageUrl: dealImage,
      idSuffix: `deal-${deal.id || deal.productId}`,
    });
  };

  const renderProductRail = (railProducts: Product[]) => (
    <FlatList
      horizontal
      data={railProducts}
      keyExtractor={(item) => String(item.id)}
      extraData={products}
      renderItem={({ item }) => (
        <ProductCard product={item} style={styles.railCard} />
      )}
      contentContainerStyle={styles.railContent}
      showsHorizontalScrollIndicator={false}
    />
  );

  return (
    <View style={styles.container}>
      {/* Signature Home Header */}
      <HomeHeader
        selectedAddress={selectedAddress}
        onAddressPress={() => setAddressSheetVisible(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      {isLoading && products.length === 0 ? (
        <HomeScreenSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
          {isSearching ? (
            /* Search Results Grid */
            <View style={styles.searchResultsContainer}>
              <View style={styles.searchHeaderRow}>
                <Text style={styles.searchResultsTitle}>
                  Search Results ({searchedProducts.length})
                </Text>
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.searchClearBtn}>Clear Search</Text>
                </TouchableOpacity>
              </View>

              {searchedProducts.length === 0 ? (
                <View style={styles.noSearchFoundBox}>
                  <View style={styles.searchEmptyIconCircle}>
                    <Icon name="coffee" size={32} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.noSearchFoundTitle}>No teas matched your search</Text>
                  <Text style={styles.noSearchFoundSub}>
                    Try searching for 'Assam', 'Kadak', 'Elaichi', 'Ginger' or 'Masala'
                  </Text>
                </View>
              ) : (
                <View style={styles.searchGrid}>
                  {searchedProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      style={styles.searchGridItem}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <>
              {/* 1. Hero Offer Banner Carousel */}
              <BannerCarousel
                banners={banners}
                onBannerPress={(banner) => {
                  const targetCategory = getCategoryFromBanner(banner);
                  router.push({
                    pathname: '/(tabs)/categories',
                    params: { category: targetCategory },
                  });
                }}
              />

              {/* 2. 4-Pillar Quick Trust Value Props */}
              <View style={styles.valuePropsSection}>
                <View style={styles.valuePropsGrid}>
                  {VALUE_PROPS.map((prop) => (
                    <View key={prop.title} style={styles.valuePropCard}>
                      <View style={[styles.valuePropIconWrapper, { backgroundColor: prop.bg }]}>
                        <Icon name={prop.icon} size={15} color={prop.color} />
                      </View>
                      <View style={styles.valuePropTexts}>
                        <Text style={styles.valuePropTitle}>{prop.title}</Text>
                        <Text style={styles.valuePropDesc} numberOfLines={1}>
                          {prop.desc}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* 3. Horizontal Scrollable Category Explorer */}
              {/* <View style={styles.categorySection}>
              <View style={styles.categoryHeaderRow}>
                <View style={styles.categoryTitleGroup}>
                  <View style={styles.categoryBadgeRow}>
                    <Icon name="sparkles" size={12} color={theme.colors.primary} />
                    <Text style={styles.categorySectionTitle}>EXPLORE TEA GARDENS</Text>
                  </View>
                  <Text style={styles.categorySubtitle}>
                    Direct harvest whole leaves & authentic aroma blends
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/categories')}
                  style={styles.seeAllButton}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                  <Icon name="chevron-right" size={12} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContent}
              >
                {categories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    item={cat}
                    isSelected={activeFilter === cat.id}
                    onPress={handleCategoryPress}
                    style={styles.categoryScrollItem}
                  />
                ))}
              </ScrollView>
            </View> */}

              {/* Dynamic Filtered Grid (When taste filter or category is active) */}
              {activeFilter !== 'all' ? (
                <View style={styles.filteredSection}>
                  <View style={styles.filteredHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.filteredTitle}>
                        {TASTE_FILTERS.find((f) => f.id === activeFilter)?.label ||
                          categories.find((c) => c.id === activeFilter)?.label ||
                          'Selected Teas'}{' '}
                        ({filterMatchedProducts.length})
                      </Text>
                      <Text style={styles.filteredSubtitle}>
                        Direct garden harvest matching your selection
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('all')}
                      style={styles.resetFilterBtn}
                    >
                      <Text style={styles.resetFilterText}>All Teas</Text>
                      <Icon name="x" size={13} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {filterMatchedProducts.length === 0 ? (
                    <View style={styles.filterEmptyBox}>
                      <Icon name="coffee" size={28} color="#94A3B8" />
                      <Text style={styles.filterEmptyTitle}>No teas found in this category</Text>
                      <TouchableOpacity onPress={() => setActiveFilter('all')}>
                        <Text style={styles.filterEmptyCta}>Reset to All Teas</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.filteredGrid}>
                      {filterMatchedProducts.map((p) => (
                        <ProductCard key={p.id} product={p} style={styles.filteredGridItem} />
                      ))}
                    </View>
                  )}
                </View>
              ) : null}

              {/* 5. Horizontal Rail: Best Sellers */}
              <View style={styles.railSection}>
                <SectionHeader
                  title="Best Sellers"
                  subtitle="Most loved cups in Indian homes"
                  iconName="flame"
                  iconColor="#DC2626"
                  badge="TOP RATED"
                  badgeBg="#DC2626"
                  onSeeAllPress={() => router.push('/(tabs)/categories')}
                />
                {renderProductRail(bestSellers)}
              </View>

              {/* 6. HIGH-ENERGY FLASH DEAL OF THE DAY (Horizontal Rail) */}
              {flashDeals && flashDeals.length > 0 && (
                <View style={styles.flashDealsSectionContainer}>
                  <View style={styles.flashDealsHeaderRow}>
                    <View style={styles.flashSectionTitleRow}>
                      <View style={styles.flashHeaderFlame}>
                        <Icon name="flame" size={16} color="#DC2626" />
                      </View>
                      <View>
                        <Text style={styles.flashSectionTitle}>
                          DEALS OF THE DAY
                        </Text>
                        <Text style={styles.flashSectionSubtitle}>
                          {flashDeals.length > 1
                            ? `${flashDeals.length} live limited-stock offers today`
                            : 'Limited harvest flash pricing'}
                        </Text>
                      </View>
                    </View>
                    {flashDeals.length > 1 && (
                      <View style={styles.flashSwipeHint}>
                        <Text style={styles.flashSwipeHintText}>Swipe for more →</Text>
                      </View>
                    )}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.flashDealsScrollContent}
                    snapToInterval={DEAL_CARD_WIDTH + 14}
                    decelerationRate="fast"
                  >
                    {flashDeals.map((deal: any, index: number) => {
                      const matchedProduct =
                        (deal.productId ? products.find((p) => Number(p.id) === Number(deal.productId)) : null) ||
                        products[0] ||
                        null;
                      const dealPrice = Number(deal.dealPrice) || 249;
                      const dealMrp = Number(deal.originalPrice) || 385;
                      const dealDiscount =
                        Number(deal.discountPercent) ||
                        Math.round(((dealMrp - dealPrice) / dealMrp) * 100);
                      const dealTitle = deal.title || matchedProduct?.name || 'Vardhamrit Special Pack';
                      const dealSubtitle = deal.subtitle || deal.variantLabel || 'Fresh Garden Harvest • Limited Run';
                      const dealImage =
                        deal.image ||
                        deal.imageUrl ||
                        matchedProduct?.imageUrl ||
                        (matchedProduct as any)?.image ||
                        (matchedProduct as any)?.primary_image ||
                        (matchedProduct?.images && matchedProduct.images[0]) ||
                        'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80';
                      const remainingSec = deal.remainingSeconds ?? 0;
                      const claimedPct = deal.claimedPercent ?? 84;
                      const badgeText = deal.badgeText || 'LIMITED 2026 HARVEST';

                      return (
                        <View
                          key={deal.id || index}
                          style={[
                            styles.flashDealCardWrapper,
                            { width: DEAL_CARD_WIDTH },
                            index === flashDeals.length - 1 ? { marginRight: 0 } : { marginRight: 14 },
                          ]}
                        >
                          <LinearGradient
                            colors={theme.colors.darkLuxuryGradient as any}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.flashDealCard}
                          >
                            {/* Glowing Top Amber Accent Border */}
                            <View style={styles.flashDealGlowBorder} />

                            {/* Deal Header with Live Timer */}
                            <View style={styles.flashDealTopRow}>
                              <View style={styles.flashTagBadge}>
                                <Icon name="flame" size={12} color="#DC2626" />
                                <Text style={styles.flashTagText}>
                                  {flashDeals.length > 1 ? `DEAL #${index + 1}` : 'DEAL OF THE DAY'}
                                </Text>
                              </View>

                              <View style={styles.digitalTimerContainer}>
                                <View style={styles.digitBox}>
                                  <Text style={styles.digitText}>
                                    {String(Math.floor(remainingSec / 3600)).padStart(2, '0')}
                                  </Text>
                                  <Text style={styles.digitUnit}>HRS</Text>
                                </View>
                                <Text style={styles.digitColon}>:</Text>
                                <View style={styles.digitBox}>
                                  <Text style={styles.digitText}>
                                    {String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0')}
                                  </Text>
                                  <Text style={styles.digitUnit}>MIN</Text>
                                </View>
                                <Text style={styles.digitColon}>:</Text>
                                <View style={styles.digitBox}>
                                  <Text style={styles.digitText}>
                                    {String(remainingSec % 60).padStart(2, '0')}
                                  </Text>
                                  <Text style={styles.digitUnit}>SEC</Text>
                                </View>
                              </View>
                            </View>

                            {/* Deal Main Row */}
                            <View style={styles.flashDealContentRow}>
                              <View style={styles.flashDealLeft}>
                                <View style={styles.limitedHarvestBadge}>
                                  <Text style={styles.limitedHarvestText}>{badgeText}</Text>
                                </View>
                                <Text style={styles.flashDealHeadline} numberOfLines={2}>
                                  {dealTitle}
                                </Text>
                                <Text style={styles.flashDealSub} numberOfLines={1}>
                                  {dealSubtitle}
                                </Text>

                                <View style={styles.flashDealPriceRow}>
                                  <Text style={styles.flashDealPrice}>₹{dealPrice}</Text>
                                  <Text style={styles.flashDealMrp}>₹{dealMrp}</Text>
                                  <View style={styles.flashDealSavingsTag}>
                                    <Text style={styles.flashDealSavingsText}>{dealDiscount}% OFF</Text>
                                  </View>
                                </View>

                                {/* Scarcity Bar */}
                                <View style={styles.scarcityBox}>
                                  <View style={styles.scarcityBarBg}>
                                    <View style={[styles.scarcityBarFill, { width: `${claimedPct}%` }]} />
                                  </View>
                                  <Text style={styles.scarcityText}>• Limited Stock!</Text>
                                </View>

                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() => handleClaimFlashDeal(deal)}
                                  style={styles.flashDealClaimBtn}
                                >
                                  <LinearGradient
                                    colors={theme.colors.actionGradient as any}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.flashDealClaimGradient}
                                  >
                                    <Icon name="shopping-bag" size={13} color="#FFFFFF" />
                                    <Text style={styles.flashDealClaimText}>Claim Deal Now</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>

                              {/* Product Image Mock */}
                              <View style={styles.flashDealImageContainer}>
                                <Image
                                  source={{
                                    uri: getFullImageUrl(dealImage),
                                  }}
                                  style={styles.flashDealImage}
                                  resizeMode="contain"
                                />
                                <View style={styles.flashDealDiscountBadge}>
                                  <Text style={styles.flashDealDiscountBadgeText}>-{dealDiscount}%</Text>
                                </View>
                              </View>
                            </View>
                          </LinearGradient>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* 7. TEA MASTER BREWING GUIDE RECIPE CARD */}
              <View style={styles.brewingSection}>
                <View style={styles.brewingCard}>
                  <View style={styles.brewingHeaderRow}>
                    <View style={styles.brewingIconBadge}>
                      <Icon name="coffee" size={16} color="#0A3622" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.brewingHeading}>Chai Master's Golden Recipe</Text>
                      <Text style={styles.brewingSubtitle}>
                        3 precise steps to the thickest, briskest Kadak Chai
                      </Text>
                    </View>
                  </View>

                  <View style={styles.brewingStepsRow}>
                    <View style={styles.brewingStep}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={styles.stepTitle}>Crush & Boil</Text>
                      <Text style={styles.stepParamBadge}>95°C Water</Text>
                      <Text style={styles.stepDesc}>Water with crushed green cardamom pods</Text>
                    </View>

                    <View style={styles.stepConnector} />

                    <View style={styles.brewingStep}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={styles.stepTitle}>Steep CTC</Text>
                      <Text style={styles.stepParamBadge}>3.5 Mins</Text>
                      <Text style={styles.stepDesc}>1.5 spoons bold Upper Assam granules</Text>
                    </View>

                    <View style={styles.stepConnector} />

                    <View style={styles.brewingStep}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={styles.stepTitle}>Rolling Boils</Text>
                      <Text style={styles.stepParamBadge}>2 High Boils</Text>
                      <Text style={styles.stepDesc}>Add creamy milk & aerate froth</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleShopRecipeKit}
                    style={styles.brewingCtaRow}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="shopping-bag" size={13} color="#0A3622" />
                      <Text style={styles.brewingCtaText}>Add Recipe Essentials to Cart</Text>
                    </View>
                    <Icon name="arrow-right" size={13} color="#0A3622" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 8. Horizontal Rail: Fresh Stock 2026 */}
              <View style={styles.railSection}>
                <SectionHeader
                  title="Fresh Stock 2026"
                  subtitle="Packed within 48 hours of garden harvest"
                  iconName="sprout"
                  iconColor="#15803D"
                  badge="FRESH HARVEST"
                  badgeBg="#15803D"
                  onSeeAllPress={() => router.push('/(tabs)/categories')}
                />
                {renderProductRail(freshStock)}
              </View>

              {/* 9. Horizontal Rail: Combo Deals */}
              {comboDeals.length > 0 && (
                <View style={styles.railSection}>
                  <SectionHeader
                    title="Super Saver Combos"
                    subtitle="Up to 30% OFF on multi-packs"
                    iconName="tag"
                    iconColor="#0284C7"
                    badge="SAVE 30%"
                    badgeBg="#0284C7"
                    onSeeAllPress={() =>
                      router.push({
                        pathname: '/(tabs)/categories',
                        params: { category: 'all', discount: 'true' },
                      })
                    }
                  />
                  {renderProductRail(comboDeals)}
                </View>
              )}

              {/* 10. Horizontal Rail: Buy Again (Only displayed if user previously ordered something) */}
              {buyAgain.length > 0 && (
                <View style={styles.railSection}>
                  <SectionHeader
                    title="Buy Again"
                    subtitle="From your previous fresh tea orders"
                    iconName="refresh"
                    iconColor={theme.colors.primary}
                    badge="REORDER"
                    badgeBg={theme.colors.primary}
                    onSeeAllPress={() => router.push('/(tabs)/orders')}
                  />
                  {renderProductRail(buyAgain)}
                </View>
              )}

              {/* 11. Direct from Garden Transparency 4-Stat Strip */}
              <View style={styles.guaranteeSection}>
                <LinearGradient
                  colors={theme.colors.surfaceGradient as any}
                  style={styles.guaranteeCard}
                >
                  <View style={styles.guaranteeHeader}>
                    <View style={styles.guaranteeIconCircle}>
                      <Icon name="mountain" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.guaranteeTitleRow}>
                        <Text style={styles.guaranteeTitle}>Direct Garden Guarantee</Text>
                        <Icon name="badge-check" size={15} color="#15803D" />
                      </View>
                      <Text style={styles.guaranteeSubtitle}>100% Single Origin Upper Assam</Text>
                    </View>
                  </View>

                  {/* 4 Stat Pills */}
                  <View style={styles.statGrid}>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>48h</Text>
                      <Text style={styles.statLabel}>Garden to Vacuum Pack</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>0%</Text>
                      <Text style={styles.statLabel}>Colors or Dust Additives</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>700m+</Text>
                      <Text style={styles.statLabel}>High Altitude Estate</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>4.9 ★</Text>
                      <Text style={styles.statLabel}>24,000+ Verified Buyers</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* 12. Social Proof Community Marquee Strip */}
              <View style={styles.socialProofStrip}>
                <View style={styles.socialProofCard}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Icon key={s} name="star" size={13} color="#F59E0B" fill="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.socialProofText}>
                    "The thickest, most brisk chai I've tasted in 20 years. Fresh garden leaves make all the difference!"
                  </Text>
                  <Text style={styles.socialProofAuthor}>
                    — Rajesh K., Pune • Verified Tea Sommelier Review
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Signature Floating View Cart Bar */}
      <ViewCartBar bottomOffset={theme.spacing.base} />

      {/* Address Selection Bottom Sheet */}
      <AddressBottomSheet
        visible={addressSheetVisible}
        onClose={() => setAddressSheetVisible(false)}
        selectedAddressId={selectedAddress?.id || ''}
        onSelectAddress={(addr) => setSelectedAddress(addr)}
        onAddNewPress={() => {
          setAddAddressModalVisible(true);
        }}
        addresses={addresses}
      />

      {/* Add Address Modal with Free & Accurate GPS Auto-Detect */}
      <AddAddressModal
        visible={addAddressModalVisible}
        onClose={() => setAddAddressModalVisible(false)}
        onSaveAddress={handleSaveNewAddress}
      />
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F4EF',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  valuePropsSection: {
    paddingHorizontal: theme.spacing.base,
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  valuePropsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  valuePropCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  valuePropIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropTexts: {
    flex: 1,
  },
  valuePropTitle: {
    fontSize: 11,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  valuePropDesc: {
    fontSize: 9.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  categorySection: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.base,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  categoryTitleGroup: {
    flex: 1,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categorySectionTitle: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
    color: theme.colors.textPrimary,
  },
  categorySubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primaryMuted,
    gap: 3,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  categoryScrollContent: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 4,
    gap: 12,
  },
  categoryScrollItem: {
    width: 76,
  },
  flashDealsSectionContainer: {
    marginBottom: theme.spacing.lg,
  },
  flashDealsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: 10,
  },
  flashSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flashHeaderFlame: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashSectionTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
  },
  flashSectionSubtitle: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  flashSwipeHint: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  flashSwipeHintText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  flashDealsScrollContent: {
    paddingHorizontal: theme.spacing.base,
    paddingBottom: 4,
  },
  flashDealCardWrapper: {
    borderRadius: 20,
  },
  flashDealSection: {
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  flashDealCard: {
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  flashDealTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  flashTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  flashTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.6,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
  },
  countdownText: {
    color: '#FBBF24',
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  flashDealContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flashDealLeft: {
    flex: 1,
    paddingRight: 10,
  },
  flashDealHeadline: {
    fontSize: 14.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    lineHeight: 19,
  },
  flashDealSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },
  flashDealPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  flashDealPrice: {
    fontSize: 18,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
  },
  flashDealMrp: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  flashDealSavingsTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  flashDealSavingsText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
  },
  flashDealClaimBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  flashDealClaimGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  flashDealClaimText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
  },
  flashDealImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  flashDealImage: {
    width: '100%',
    height: '100%',
  },
  flashDealImageGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  brewingSection: {
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  brewingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  brewingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  brewingIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brewingHeading: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  brewingSubtitle: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  brewingStepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  brewingStep: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
  },
  stepTitle: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  stepDesc: {
    fontSize: 8.5,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  stepConnector: {
    width: 16,
    height: 1,
    backgroundColor: '#D1D5DB',
  },
  brewingCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 5,
  },
  brewingCtaText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  railSection: {
    marginBottom: theme.spacing.lg,
  },
  railContent: {
    paddingHorizontal: theme.spacing.base,
    gap: theme.spacing.md,
  },
  railCard: {
    marginRight: theme.spacing.sm,
  },
  guaranteeSection: {
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  guaranteeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  guaranteeLeft: {
    alignItems: 'center',
  },
  guaranteeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guaranteeCenter: {
    flex: 1,
  },
  guaranteeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  guaranteeText: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    lineHeight: 14.5,
    marginTop: 2,
  },
  searchResultsContainer: {
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.md,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  searchResultsTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  searchClearBtn: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  searchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.md,
  },
  searchGridItem: {
    width: '48%',
  },
  noSearchFoundBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  searchEmptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  noSearchFoundTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  noSearchFoundSub: {
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },

  /* 2026 Modern Upgrades */
  tasteFilterSection: {
    marginBottom: theme.spacing.md,
  },
  tasteFilterContent: {
    paddingHorizontal: theme.spacing.base,
    gap: 8,
  },
  tasteFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tasteFilterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
  },
  tasteFilterEmoji: {
    fontSize: 13,
  },
  tasteFilterText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
  },
  tasteFilterTextActive: {
    color: '#FFFFFF',
  },
  filterCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  filteredSection: {
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  filteredHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filteredTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  filteredSubtitle: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  resetFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  resetFilterText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  filterEmptyBox: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    gap: 8,
  },
  filterEmptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterEmptyCta: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  filteredGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: theme.spacing.md,
  },
  filteredGridItem: {
    width: '48%',
  },
  flashDealGlowBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F59E0B',
  },
  digitalTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  digitBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
    minWidth: 28,
  },
  digitText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  digitUnit: {
    color: '#9CA3AF',
    fontSize: 7,
    fontWeight: '800',
  },
  digitColon: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '900',
  },
  limitedHarvestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  limitedHarvestText: {
    color: '#FBBF24',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scarcityBox: {
    marginVertical: 8,
  },
  scarcityBarBg: {
    height: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  scarcityBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 2.5,
  },
  scarcityText: {
    color: '#FDE68A',
    fontSize: 9.5,
    fontWeight: '700',
  },
  flashDealDiscountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flashDealDiscountBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  stepParamBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
    fontSize: 8.5,
    fontWeight: '800',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginVertical: 2,
    overflow: 'hidden',
  },
  guaranteeHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  guaranteeSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A3622',
  },
  statLabel: {
    fontSize: 8.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  socialProofStrip: {
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.lg,
  },
  socialProofCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 6,
  },
  socialProofText: {
    fontSize: 11.5,
    color: '#334155',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 4,
  },
  socialProofAuthor: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0A3622',
  },
});
