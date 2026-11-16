import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Product } from '../../types';
import { CategoryItem } from '../../components/home/CategoryTile';
import { fetchCategories, fetchProducts, fetchCategoryDetail, normalizeProduct } from '../../services/catalogService';
import { socket } from '../../services/socketService';
import { CategoryTile, CATEGORY_IMAGE_FALLBACKS } from '../../components/home/CategoryTile';
import { ProductCard } from '../../components/product/ProductCard';
import { ViewCartBar } from '../../components/cart/ViewCartBar';
import { Icon, IconName } from '../../components/common/Icon';
import { EmptyState } from '../../components/common/EmptyState';
import { CatalogSkeleton } from '../../components/common/Skeleton';
import { getFullImageUrl } from '../../utils/imageUtils';
import {
  SideFilterDrawer,
  FilterState,
  DEFAULT_FILTER_STATE,
} from '../../components/category/SideFilterDrawer';

interface QuickFilterOption {
  id: 'bestseller' | 'fresh' | 'top_rated' | 'under_250' | 'under_400' | 'discount';
  label: string;
  iconName: IconName;
}

const QUICK_FILTERS: QuickFilterOption[] = [
  { id: 'bestseller', label: 'Bestsellers', iconName: 'crown' },
  { id: 'top_rated', label: 'Rated 4.5+', iconName: 'star' },
  { id: 'fresh', label: 'Fresh Harvest', iconName: 'leaf' },
  { id: 'under_250', label: 'Under ₹250', iconName: 'tag' },
  { id: 'under_400', label: 'Under ₹400', iconName: 'layers' },
  { id: 'discount', label: 'Discounts', iconName: 'flame' },
];

interface CategoryHeroMeta {
  title: string;
  subtitle: string;
  origin: string;
  notes: string[];
  gradient: [string, string];
  icon: IconName;
  badge: string;
}

const CATEGORY_HERO_DATA: Record<string, CategoryHeroMeta> = {
  all: {
    title: 'Complete 4-Flavour Reserve',
    subtitle: 'Discover our pure Normal, Masala, Keser and Chocolate signature chai blends',
    origin: 'Assam & Kashmir Valley',
    notes: ['☕ 4 Pure Flavours', '🌱 100% Direct Estate', '✨ Zero Artificial Essence'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'sparkles',
    badge: 'ALL 4 BLENDS',
  },
  normal: {
    title: 'Classic Normal Kadak Chai',
    subtitle: 'Single-estate bold Assam CTC tea granules with rich malty body & authentic daily tea room strength',
    origin: 'Dibrugarh & Jorhat Gardens, Upper Assam',
    notes: ['🔥 High Morning Kick', '🥛 Ideal with Creamy Milk', '🍯 Malty Sweetness'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'coffee',
    badge: 'CLASSIC CTC',
  },
  kadak: {
    title: 'Classic Normal Kadak Chai',
    subtitle: 'Single-estate bold Assam CTC tea granules with rich malty body & authentic daily tea room strength',
    origin: 'Dibrugarh & Jorhat Gardens, Upper Assam',
    notes: ['🔥 High Morning Kick', '🥛 Ideal with Creamy Milk', '🍯 Malty Sweetness'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'coffee',
    badge: 'CLASSIC CTC',
  },
  masala: {
    title: 'Grand Royal Masala Chai',
    subtitle: 'Aromatic blend of crushed cinnamon, cloves, green cardamom, black pepper & dry ginger',
    origin: 'Malabar Coast & Nilgiris',
    notes: ['🌶️ 7 Royal Spices', '🛡️ Ayurvedic Immunity', '☕ Warm Spiced Sip'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'sparkles',
    badge: 'ROYAL SPICES',
  },
  keser: {
    title: 'Regal Kashmiri Keser Chai',
    subtitle: 'Grade-A whole saffron stigmas with green cardamom pods & crunchy roasted almond slivers',
    origin: 'Pampore, Kashmir Valley',
    notes: ['👑 Mogra Royal Stigmas', '🍯 Golden Liquid Color', '✨ Aristocratic Sip'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'crown',
    badge: 'KASHMIRI KESER',
  },
  chocolate: {
    title: 'Artisan Chocolate Chai',
    subtitle: 'Real roasted cocoa nibs & Dutch dark chocolate blended with bold black tea for a dessert cup',
    origin: 'Single-Estate Cocoa & Assam CTC',
    notes: ['🍫 Real Cocoa Nibs', '🥛 Velvety Body', '☕ Warm Dessert Sip'],
    gradient: theme.colors.primaryGradient as any,
    icon: 'coffee',
    badge: 'CHOCOLATE CHAI',
  },
};

type ViewMode = 'grid' | 'list';

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string; discount?: string; filter?: string }>();
  const initialCategory = params.category ? String(params.category).toLowerCase().trim() : 'all';
  const initialDiscount = params.discount === 'true' || params.filter === 'discount';

  const [filterState, setFilterState] = useState<FilterState>({
    ...DEFAULT_FILTER_STATE,
    categoryId: initialCategory,
    discountOnly: initialDiscount,
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Synchronize category & discount filters whenever navigation params change
  useEffect(() => {
    const isDiscount = params.discount === 'true' || params.filter === 'discount';
    setFilterState((prev) => {
      let changed = false;
      let nextCategory = prev.categoryId;
      if (params.category !== undefined) {
        const cat = String(params.category).toLowerCase().trim();
        if (cat && cat !== prev.categoryId) {
          nextCategory = cat;
          changed = true;
        }
      }

      let nextDiscount = prev.discountOnly;
      if (params.discount !== undefined || params.filter !== undefined) {
        if (isDiscount !== prev.discountOnly) {
          nextDiscount = isDiscount;
          changed = true;
        }
      }

      if (!changed) return prev;
      return {
        ...prev,
        categoryId: nextCategory,
        discountOnly: nextDiscount,
      };
    });
  }, [params.category, params.discount, params.filter]);

  // Dynamic database API state
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [dynamicHero, setDynamicHero] = useState<any>(null);

  const handleRefresh = async () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setRefreshing(true);
    try {
      const [cats, prods] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
      ]);
      setCategoriesList((cats || []) as any);
      setAllProducts((prods?.items || []) as any);
      if (filterState.categoryId !== 'all') {
        const catDetail = await fetchCategoryDetail(filterState.categoryId);
        if (catDetail?.hero) setDynamicHero(catDetail.hero);
      }
    } catch (e) {
      console.warn('Error refreshing categories screen from database:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load: fetch all categories and all products from database API
  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchCategories(),
      fetchProducts(),
    ])
      .then(([cats, prods]) => {
        setCategoriesList((cats || []) as any);
        setAllProducts((prods?.items || []) as any);
      })
      .catch((err) => console.warn('Error fetching initial category data from database:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Real-time Socket.IO catalog sync for categories view
  useEffect(() => {
    const handleProductCreated = (rawProd: any) => {
      try {
        if (!rawProd || !rawProd.id) return;
        const newProd = normalizeProduct(rawProd);
        setAllProducts((prev) => {
          if (prev.some((p) => Number(p.id) === Number(newProd.id))) {
            return prev.map((p) => (Number(p.id) === Number(newProd.id) ? newProd : p));
          }
          return [newProd, ...prev];
        });
      } catch (err) {
        console.warn('Socket product.created handling error in categories:', err);
      }
    };

    const handleProductUpdated = (rawProd: any) => {
      try {
        if (!rawProd || !rawProd.id) return;
        const updatedProd = normalizeProduct(rawProd);
        setAllProducts((prev) =>
          prev.map((p) => (Number(p.id) === Number(updatedProd.id) ? updatedProd : p))
        );
      } catch (err) {
        console.warn('Socket product.updated handling error in categories:', err);
      }
    };

    const handleProductDeleted = (data: { productId: number | string }) => {
      try {
        if (!data?.productId) return;
        const targetId = Number(data.productId);
        setAllProducts((prev) =>
          prev.filter((p) => p.id !== targetId && String(p.id) !== String(data.productId))
        );
      } catch (err) {
        console.warn('Socket product.deleted handling error in categories:', err);
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
        console.warn('Socket catalog.updated handling error in categories:', err);
      }
    };

    socket.on('product.created', handleProductCreated);
    socket.on('product.updated', handleProductUpdated);
    socket.on('product.deleted', handleProductDeleted);
    socket.on('catalog.updated', handleCatalogUpdated);

    return () => {
      socket.off('product.created', handleProductCreated);
      socket.off('product.updated', handleProductUpdated);
      socket.off('product.deleted', handleProductDeleted);
      socket.off('catalog.updated', handleCatalogUpdated);
    };
  }, []);

  // Sync category hero details when selected category changes
  useEffect(() => {
    if (filterState.categoryId !== 'all') {
      fetchCategoryDetail(filterState.categoryId).then((cat) => {
        if (cat?.hero) setDynamicHero(cat.hero);
      });
    } else {
      setDynamicHero(null);
    }
  }, [filterState.categoryId]);

  // Robust category matcher supporting exact IDs, slugs, and canonical flavour aliases
  const matchesCategory = (p: any, selectedCatId: string): boolean => {
    if (!selectedCatId || selectedCatId === 'all') return true;
    const target = selectedCatId.toLowerCase().trim();
    const cat = (p.category || '').toLowerCase().trim();
    const slug = (p.category_slug || '').toLowerCase().trim();
    const catName = (p.category_name || '').toLowerCase().trim();
    const name = (p.name || '').toLowerCase().trim();

    if (target === 'normal' || target === 'kadak') {
      return (
        cat === 'normal' ||
        cat === 'kadak' ||
        slug === 'normal' ||
        slug === 'kadak' ||
        catName.includes('normal') ||
        catName.includes('kadak') ||
        name.includes('normal') ||
        name.includes('kadak') ||
        name.includes('assam')
      );
    }
    if (target === 'masala') {
      return (
        cat === 'masala' ||
        slug === 'masala' ||
        catName.includes('masala') ||
        name.includes('masala') ||
        name.includes('spice')
      );
    }
    if (target === 'keser') {
      return (
        cat === 'keser' ||
        slug === 'keser' ||
        catName.includes('keser') ||
        catName.includes('saffron') ||
        name.includes('keser') ||
        name.includes('saffron')
      );
    }
    if (target === 'chocolate') {
      return (
        cat === 'chocolate' ||
        slug === 'chocolate' ||
        catName.includes('chocolate') ||
        catName.includes('cocoa') ||
        name.includes('chocolate') ||
        name.includes('cocoa')
      );
    }
    return cat === target || slug === target;
  };

  // Filter products by all active criteria + search query (with allProducts in dependencies!)
  const filteredProducts = useMemo(() => {
    let result = allProducts.filter((p) => matchesCategory(p, filterState.categoryId));

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tagline?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          (p as any).category_name?.toLowerCase().includes(q)
      );
    }

    if (filterState.bestsellerOnly) {
      result = result.filter((p) => p.isBestSeller);
    }
    if (filterState.freshHarvestOnly) {
      result = result.filter((p) => p.isFreshHarvest);
    }
    if (filterState.discountOnly) {
      result = result.filter(
        (p) =>
          Number(p.discountPercentage || 0) > 0 ||
          Number((p as any).discount_percentage || 0) > 0 ||
          (p.variants || []).some((v: any) => Number(v.mrp || 0) > Number(v.price || 0))
      );
    }
    if (filterState.minRating > 0) {
      result = result.filter((p) => p.rating >= filterState.minRating);
    }
    if (filterState.maxPrice < 650) {
      result = result.filter((p) => (p.variants?.[0]?.price ?? 0) <= filterState.maxPrice);
    }

    // Sort
    if (filterState.sortBy === 'price_asc') {
      result.sort((a, b) => (a.variants?.[0]?.price ?? 0) - (b.variants?.[0]?.price ?? 0));
    } else if (filterState.sortBy === 'price_desc') {
      result.sort((a, b) => (b.variants?.[0]?.price ?? 0) - (a.variants?.[0]?.price ?? 0));
    } else if (filterState.sortBy === 'rating_desc') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return result;
  }, [allProducts, filterState, searchQuery]);

  // Active filters count
  const activeCount =
    (filterState.categoryId !== 'all' ? 1 : 0) +
    (filterState.sortBy !== 'recommended' ? 1 : 0) +
    (filterState.maxPrice < 650 ? 1 : 0) +
    (filterState.minRating > 0 ? 1 : 0) +
    (filterState.bestsellerOnly ? 1 : 0) +
    (filterState.freshHarvestOnly ? 1 : 0) +
    (filterState.discountOnly ? 1 : 0) +
    (searchQuery.trim().length > 0 ? 1 : 0);

  const resetAllFilters = () => {
    setFilterState(DEFAULT_FILTER_STATE);
    setSearchQuery('');
  };

  const handleCategorySelect = (categoryId: string) => {
    setFilterState((prev) => ({
      ...prev,
      categoryId: prev.categoryId === categoryId ? 'all' : categoryId,
    }));
  };

  const handleQuickFilterToggle = (id: QuickFilterOption['id']) => {
    setFilterState((prev) => {
      switch (id) {
        case 'bestseller':
          return { ...prev, bestsellerOnly: !prev.bestsellerOnly };
        case 'fresh':
          return { ...prev, freshHarvestOnly: !prev.freshHarvestOnly };
        case 'top_rated':
          return { ...prev, minRating: prev.minRating === 4.5 ? 0 : 4.5 };
        case 'under_250':
          return { ...prev, maxPrice: prev.maxPrice === 250 ? 650 : 250 };
        case 'under_400':
          return { ...prev, maxPrice: prev.maxPrice === 400 ? 650 : 400 };
        case 'discount':
          return { ...prev, discountOnly: !prev.discountOnly };
        default:
          return prev;
      }
    });
  };

  const isQuickFilterActive = (id: QuickFilterOption['id']): boolean => {
    switch (id) {
      case 'bestseller':
        return filterState.bestsellerOnly;
      case 'fresh':
        return filterState.freshHarvestOnly;
      case 'top_rated':
        return filterState.minRating >= 4.5;
      case 'under_250':
        return filterState.maxPrice === 250;
      case 'under_400':
        return filterState.maxPrice === 400;
      case 'discount':
        return filterState.discountOnly;
      default:
        return false;
    }
  };

  const fallbackHero = CATEGORY_HERO_DATA[filterState.categoryId] || CATEGORY_HERO_DATA['all'];
  const currentHero = {
    ...fallbackHero,
    ...(dynamicHero || {}),
    gradient: theme.colors.primaryGradient,
    notes: dynamicHero?.notes || fallbackHero.notes || [],
    icon: filterState.discountOnly ? ('tag' as IconName) : (fallbackHero.icon || 'sparkles'),
    badge: filterState.discountOnly ? 'SPECIAL OFFERS' : (dynamicHero?.badge || fallbackHero.badge || 'ESTATE TEA'),
    origin: dynamicHero?.origin || fallbackHero.origin || 'Direct Harvest • Assam & Darjeeling',
    title: filterState.discountOnly
      ? 'Special Discount Blends'
      : (dynamicHero?.title || fallbackHero.title || 'Estate Reserve Collection'),
    subtitle: filterState.discountOnly
      ? 'All discounted and super saver multi-packs'
      : (dynamicHero?.subtitle || fallbackHero.subtitle || 'Direct harvest orthodox leaves'),
  };

  const selectedCategoryItem = categoriesList.find((c) => c.id === filterState.categoryId);
  const rawHeroImage =
    selectedCategoryItem?.imageUrl ||
    (selectedCategoryItem as any)?.image ||
    CATEGORY_IMAGE_FALLBACKS[filterState.categoryId] ||
    CATEGORY_IMAGE_FALLBACKS['all'];
  const selectedHeroImage = rawHeroImage ? getFullImageUrl(rawHeroImage) : null;

  return (
    <View style={styles.container}>
      {/* 1. TOP APP HEADER & SEARCH BAR */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Tea Collection</Text>
            <Text style={styles.headerSubtitle}>
              Direct harvest orthodox leaves & single-origin CTC
            </Text>
          </View>

          {/* Quick Drawer Button with Badge */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsDrawerOpen(true)}
            style={[styles.headerFilterBtn, activeCount > 0 && styles.headerFilterBtnActive]}
          >
            <Icon
              name="sliders"
              size={13}
              color={activeCount > 0 ? '#FFFFFF' : theme.colors.primary}
            />
            <Text
              style={[
                styles.headerFilterBtnText,
                activeCount > 0 && styles.headerFilterBtnTextActive,
              ]}
            >
              Filter
            </Text>
            {activeCount > 0 ? (
              <View style={styles.headerFilterBadge}>
                <Text style={styles.headerFilterBadgeText}>{activeCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBarContainer}>
          <Icon name="search" size={14} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search within blends, ingredients..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="x" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading && allProducts.length === 0 ? (
        <CatalogSkeleton />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor="#FFFFFF"
            />
          }
        >
        {/* 2. HORIZONTAL CATEGORY SCROLL RAIL */}
        <View style={styles.categorySection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWithDot}>
              <View style={styles.pulsingIndicator} />
              <Text style={styles.sectionMiniTitle}>CHOOSE BLEND CATEGORY</Text>
            </View>
            <Text style={styles.sectionCountText}>
              {categoriesList.length} Collections
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollTrack}
          >
            {categoriesList.map((cat) => (
              <CategoryTile
                key={cat.id}
                item={cat}
                isSelected={filterState.categoryId === cat.id}
                onPress={handleCategorySelect}
                style={styles.categoryRailItem}
              />
            ))}
          </ScrollView>
        </View>

        {/* 3. DYNAMIC AMBIENT CATEGORY HERO BANNER (Fixed Stable Royal Theme Background) */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={theme.colors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadgeCapsule}>
                <Icon name="sparkles" size={9} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{currentHero.badge}</Text>
              </View>
              <Text style={styles.heroOriginText}>{currentHero.origin}</Text>
            </View>

            <View style={styles.heroContentRow}>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>{currentHero.title}</Text>
                <Text style={styles.heroSubtitle}>{currentHero.subtitle}</Text>

                {/* Tasting notes chips */}
                <View style={styles.heroNotesTrack}>
                  {(currentHero.notes as string[]).map((note: string, index: number) => (
                    <View key={index} style={styles.heroNoteChip}>
                      <Text style={styles.heroNoteChipText}>{note}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Glowing Real Image Disc */}
              <View style={styles.heroIconDisc}>
                {selectedHeroImage ? (
                  <Image
                    source={{ uri: selectedHeroImage }}
                    style={styles.heroRealImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name={currentHero.icon} size={28} color="#FFFFFF" />
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* 4. HORIZONTAL QUICK FILTER & SLIDER BAR */}
        <View style={styles.quickFilterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsTrack}
          >
            {/* Filter Slider Trigger */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsDrawerOpen(true)}
              style={[
                styles.filterPill,
                styles.filterDrawerPill,
                activeCount > 0 && styles.filterPillActive,
              ]}
            >
              <Icon
                name="sliders"
                size={13}
                color={activeCount > 0 ? '#FFFFFF' : theme.colors.primary}
              />
              <Text
                style={[
                  styles.filterPillText,
                  activeCount > 0 && styles.filterPillTextActive,
                ]}
              >
                {filterState.maxPrice < 650 ? `Max ₹${filterState.maxPrice}` : 'Price & Filters'}
              </Text>
              {activeCount > 0 ? (
                <View style={styles.activePillDot} />
              ) : (
                <Icon name="chevron-right" size={11} color={theme.colors.primary} />
              )}
            </TouchableOpacity>

            {/* Quick Filters */}
            {QUICK_FILTERS.map((f) => {
              const isSelected = isQuickFilterActive(f.id);
              return (
                <TouchableOpacity
                  key={f.id}
                  activeOpacity={0.8}
                  onPress={() => handleQuickFilterToggle(f.id)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                >
                  <Icon
                    name={f.iconName}
                    size={12}
                    color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                  {isSelected ? (
                    <Icon name="x" size={10} color="#FFFFFF" style={{ marginLeft: 2 }} />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {/* Reset Pill */}
            {activeCount > 0 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={resetAllFilters}
                style={[styles.filterPill, styles.resetPill]}
              >
                <Icon name="refresh" size={11} color="#EF4444" />
                <Text style={styles.resetPillText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>

        {/* 5. RESULTS SUMMARY & VIEW SWITCHER BAR */}
        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.resultsTitle}>
              {currentHero.title.split(' ')[0]} Blends ({filteredProducts.length})
            </Text>
            <Text style={styles.resultsSubtitle}>
              {filterState.maxPrice < 650 ? `Capped at ₹${filterState.maxPrice} • ` : ''}
              {filterState.sortBy === 'price_asc'
                ? 'Sorted: Low to High'
                : filterState.sortBy === 'price_desc'
                ? 'Sorted: High to Low'
                : filterState.sortBy === 'rating_desc'
                ? 'Sorted: Top Rated'
                : 'Garden Fresh Order'}
            </Text>
          </View>

          {/* View Mode Toggle: Grid ⊞ vs List ☰ */}
          <View style={styles.viewToggleGroup}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode('grid')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'grid' && styles.viewToggleBtnActive,
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon
                name="grid"
                size={13}
                color={viewMode === 'grid' ? theme.colors.primary : '#9CA3AF'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode('list')}
              style={[
                styles.viewToggleBtn,
                viewMode === 'list' && styles.viewToggleBtnActive,
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon
                name="layers"
                size={13}
                color={viewMode === 'list' ? theme.colors.primary : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. PRODUCTS LIST OR 2-COLUMN GRID */}
        {filteredProducts.length > 0 ? (
          viewMode === 'grid' ? (
            <View style={styles.productsGrid}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  layout="grid"
                  style={styles.productCardGridItem}
                />
              ))}
            </View>
          ) : (
            <View style={styles.productsList}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  layout="list"
                  style={styles.productCardListItem}
                />
              ))}
            </View>
          )
        ) : (
          <EmptyState
            iconName="coffee"
            title="No Matching Blends"
            subtitle="No teas match your current filter and price criteria. Try adjusting the filter slider to explore more teas."
            buttonLabel="Reset All Filters"
            onButtonPress={resetAllFilters}
            style={{ marginTop: 24, paddingVertical: 32 }}
          />
        )}
      </ScrollView>
      )}

      {/* Floating View Cart Bar */}
      <ViewCartBar bottomOffset={theme.spacing.base} />

      {/* 7. SIDE FILTER DRAWER (SLIDES IN FROM RIGHT) */}
      <SideFilterDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        filters={filterState}
        categories={categoriesList}
        products={allProducts}
        onApplyFilters={(newFilters) => setFilterState(newFilters)}
        onResetFilters={resetAllFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: theme.typography.scale.lg,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  headerFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 81, 50, 0.18)',
    gap: 4,
  },
  headerFilterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  headerFilterBtnText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  headerFilterBtnTextActive: {
    color: '#FFFFFF',
  },
  headerFilterBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  headerFilterBadgeText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        } as any)
      : {}),
  },
  scrollContent: {
    paddingBottom: 110,
  },
  categorySection: {
    marginTop: theme.spacing.sm + 2,
    marginBottom: theme.spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    marginBottom: 8,
  },
  sectionTitleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  sectionMiniTitle: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
    color: theme.colors.textHint,
  },
  sectionCountText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.semiBold,
  },
  categoryScrollTrack: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 4,
    gap: 12,
  },
  categoryRailItem: {
    width: 76,
  },
  heroSection: {
    paddingHorizontal: theme.spacing.base,
    marginTop: theme.spacing.sm,
    marginBottom: 4,
  },
  heroCard: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroBadgeCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  heroOriginText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 9.5,
    fontWeight: theme.typography.weights.medium,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    marginBottom: 8,
  },
  heroNotesTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroNoteChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroNoteChipText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: theme.typography.weights.semiBold,
  },
  heroIconDisc: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
  },
  heroRealImage: {
    width: '100%',
    height: '100%',
  },
  quickFilterSection: {
    marginVertical: theme.spacing.sm,
  },
  filterPillsTrack: {
    paddingHorizontal: theme.spacing.base,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  filterDrawerPill: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: 'rgba(15, 81, 50, 0.2)',
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginLeft: 1,
  },
  resetPill: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  resetPillText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#EF4444',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    marginBottom: theme.spacing.sm,
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 13.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  resultsSubtitle: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  viewToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    rowGap: theme.spacing.md,
  },
  productCardGridItem: {
    width: '48%',
  },
  productsList: {
    paddingHorizontal: theme.spacing.base,
  },
  productCardListItem: {
    width: '100%',
  },
});
