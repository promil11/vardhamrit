import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  Easing,
  Platform,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { Icon, IconName } from '../common/Icon';

export interface FilterState {
  categoryId: string; // 'all' or category id
  sortBy: 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc';
  maxPrice: number;   // 150 to 650
  minRating: number;  // 0, 4.0, 4.5
  bestsellerOnly: boolean;
  freshHarvestOnly: boolean;
  discountOnly: boolean;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  categoryId: 'all',
  sortBy: 'recommended',
  maxPrice: 650,
  minRating: 0,
  bestsellerOnly: false,
  freshHarvestOnly: false,
  discountOnly: false,
};

interface SideFilterDrawerProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  categories?: any[];
  products?: any[];
}

const PRICE_PRESETS = [
  { label: 'All', value: 650 },
  { label: '₹450', value: 450 },
  { label: '₹350', value: 350 },
  { label: '₹250', value: 250 },
  { label: '₹180', value: 180 },
];

const SORT_OPTIONS: { id: FilterState['sortBy']; label: string; icon: IconName }[] = [
  { id: 'recommended', label: 'Recommended / Popular', icon: 'sparkles' },
  { id: 'price_asc', label: 'Price: Low to High', icon: 'trending-up' },
  { id: 'price_desc', label: 'Price: High to Low', icon: 'tag' },
  { id: 'rating_desc', label: 'Highest Rated', icon: 'star' },
];

export const SideFilterDrawer: React.FC<SideFilterDrawerProps> = ({
  visible,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  categories = [],
  products = [],
}) => {
  // Screen dimensions
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.min(screenWidth * 0.86, 420);

  // Local draft state for drawer adjustments
  const [draft, setDraft] = useState<FilterState>(filters);
  const [modalVisible, setModalVisible] = useState(visible);

  // Animations
  const animValue = useRef(new Animated.Value(0)).current;
  const sliderWidthRef = useRef<number>(drawerWidth - 48);

  // Synchronize when opened
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setModalVisible(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible, filters]);

  const handleClose = () => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setModalVisible(false);
      onClose();
    });
  };

  const handleApply = () => {
    onApplyFilters(draft);
    handleClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_FILTER_STATE);
    onResetFilters();
  };

  // Slider touch/drag handler
  const handleSliderTouch = (e: GestureResponderEvent) => {
    const touchX = e.nativeEvent.locationX;
    const width = sliderWidthRef.current || 280;
    const ratio = Math.max(0, Math.min(1, touchX / width));
    // Range 150 to 650
    const calculated = Math.round(150 + ratio * (650 - 150));
    // Snap to nearest 10
    const snapped = Math.round(calculated / 10) * 10;
    setDraft((prev) => ({ ...prev, maxPrice: snapped }));
  };

  const sliderPercent = Math.max(
    0,
    Math.min(100, ((draft.maxPrice - 150) / (650 - 150)) * 100)
  );

  // Calculate live matching products count for the Apply button
  let matchingProducts = draft.categoryId === 'all'
    ? [...products]
    : products.filter((p) => p.category === draft.categoryId || (p as any).category_slug === draft.categoryId);

  if (draft.bestsellerOnly) {
    matchingProducts = matchingProducts.filter((p) => p.isBestSeller);
  }
  if (draft.freshHarvestOnly) {
    matchingProducts = matchingProducts.filter((p) => p.isFreshHarvest);
  }
  if (draft.discountOnly) {
    matchingProducts = matchingProducts.filter(
      (p) =>
        Number(p.discountPercentage || 0) > 0 ||
        Number((p as any).discount_percentage || 0) > 0 ||
        (p.variants || []).some((v: any) => Number(v.mrp || 0) > Number(v.price || 0))
    );
  }
  if (draft.minRating > 0) {
    matchingProducts = matchingProducts.filter((p) => p.rating >= draft.minRating);
  }
  if (draft.maxPrice < 650) {
    matchingProducts = matchingProducts.filter((p) => (p.variants[0]?.price ?? 0) <= draft.maxPrice);
  }

  // Active filters count
  const activeCount =
    (draft.categoryId !== 'all' ? 1 : 0) +
    (draft.sortBy !== 'recommended' ? 1 : 0) +
    (draft.maxPrice < 650 ? 1 : 0) +
    (draft.minRating > 0 ? 1 : 0) +
    (draft.bestsellerOnly ? 1 : 0) +
    (draft.freshHarvestOnly ? 1 : 0) +
    (draft.discountOnly ? 1 : 0);

  if (!modalVisible) return null;

  // Interpolated animation values
  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const drawerTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerWidth, 0],
  });

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        {/* Semi-transparent Dimmed Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
        </TouchableWithoutFeedback>

        {/* Side Filter Drawer (Slides from Right) */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: drawerWidth,
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}
        >
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerLeft}>
              <LinearGradient
                colors={theme.colors.primaryGradient}
                style={styles.headerBadge}
              >
                <Icon name="sliders" size={15} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.drawerTitle}>Filters & Sort</Text>
                  {activeCount > 0 ? (
                    <View style={styles.activeCounterBadge}>
                      <Text style={styles.activeCounterText}>{activeCount} Active</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.drawerSubtitle}>
                  Refine tea blends & price range
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {activeCount > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleReset}
                  style={styles.resetButton}
                >
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleClose}
                style={styles.closeButton}
              >
                <Icon name="x" size={16} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Drawer Body (Scrollable Sections) */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.drawerScrollBody}
          >
            {/* 1. INTERACTIVE PRICE SLIDER SECTION */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionHeading}>BUDGET & PRICE SLIDER</Text>
                  <Text style={styles.sectionSubtext}>Slide track or tap presets</Text>
                </View>
                <View style={styles.priceValueBadge}>
                  <Text style={styles.priceValueText}>
                    {draft.maxPrice >= 650 ? 'All (₹650+)' : `Up to ₹${draft.maxPrice}`}
                  </Text>
                </View>
              </View>

              {/* Slider Track Component */}
              <View
                style={styles.sliderTouchBox}
                onLayout={(e: LayoutChangeEvent) => {
                  sliderWidthRef.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={handleSliderTouch}
                onResponderMove={handleSliderTouch}
              >
                <View style={styles.sliderTrackBg}>
                  {/* Active progress fill */}
                  <LinearGradient
                    colors={theme.colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.sliderTrackActive, { width: `${sliderPercent}%` }]}
                  />

                  {/* Circular Draggable Knob */}
                  <View
                    style={[
                      styles.sliderKnob,
                      { left: `${Math.max(0, Math.min(93, sliderPercent - 3.5))}%` },
                    ]}
                  >
                    <View style={styles.sliderKnobDot} />
                  </View>
                </View>
              </View>

              {/* Scale Labels */}
              <View style={styles.scaleRow}>
                <Text style={styles.scaleLabel}>₹150</Text>
                <Text style={styles.scaleLabel}>₹300</Text>
                <Text style={styles.scaleLabel}>₹450</Text>
                <Text style={styles.scaleLabel}>₹650+</Text>
              </View>

              {/* Quick 1-Tap Presets */}
              <View style={styles.presetsRow}>
                {PRICE_PRESETS.map((p) => {
                  const isPreset = draft.maxPrice === p.value;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      activeOpacity={0.7}
                      onPress={() => setDraft((prev) => ({ ...prev, maxPrice: p.value }))}
                      style={[styles.presetBtn, isPreset && styles.presetBtnActive]}
                    >
                      <Text
                        style={[
                          styles.presetBtnText,
                          isPreset && styles.presetBtnTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* 2. CHAI BLEND / CATEGORY SELECTION */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>CHAI VARIETY & COLLECTION</Text>
              <View style={styles.categoryWrap}>
                {/* <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDraft((prev) => ({ ...prev, categoryId: 'all' }))}
                  style={[
                    styles.categoryChip,
                    draft.categoryId === 'all' && styles.categoryChipActive,
                  ]}
                >
                  <Icon
                    name="sparkles"
                    size={13}
                    color={draft.categoryId === 'all' ? '#FFFFFF' : theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      draft.categoryId === 'all' && styles.categoryChipTextActive,
                    ]}
                  >
                    All Teas
                  </Text>
                </TouchableOpacity> */}

                {categories.map((cat) => {
                  const isCatSelected = draft.categoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.7}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          categoryId: isCatSelected ? 'all' : cat.id,
                        }))
                      }
                      style={[
                        styles.categoryChip,
                        isCatSelected && styles.categoryChipActive,
                      ]}
                    >
                      <Icon
                        name={cat.iconName || 'coffee'}
                        size={13}
                        color={isCatSelected ? '#FFFFFF' : cat.iconColor || theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isCatSelected && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* 3. SORT BY SELECTION */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>SORT PRODUCTS BY</Text>
              <View style={styles.sortList}>
                {SORT_OPTIONS.map((opt) => {
                  const isSortSelected = draft.sortBy === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.7}
                      onPress={() => setDraft((prev) => ({ ...prev, sortBy: opt.id }))}
                      style={[
                        styles.sortOptionRow,
                        isSortSelected && styles.sortOptionRowActive,
                      ]}
                    >
                      <View style={styles.sortOptionLeft}>
                        <Icon
                          name={opt.icon}
                          size={14}
                          color={isSortSelected ? theme.colors.primary : theme.colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.sortOptionText,
                            isSortSelected && styles.sortOptionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          isSortSelected && styles.radioCircleActive,
                        ]}
                      >
                        {isSortSelected ? <View style={styles.radioInnerDot} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

          </ScrollView>

          {/* Sticky Drawer Footer Actions */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleReset}
              style={styles.footerClearBtn}
            >
              <Text style={styles.footerClearText}>Clear All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleApply}
              style={styles.footerApplyBtnWrapper}
            >
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.footerApplyBtn}
              >
                <Text style={styles.footerApplyText}>
                  Apply ({matchingProducts.length} Blends)
                </Text>
                <Icon name="check" size={15} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  drawerContainer: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 20,
    zIndex: 100,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 48 : 20,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  activeCounterBadge: {
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  activeCounterText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  drawerSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScrollBody: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    paddingBottom: 24,
  },
  sectionBlock: {
    marginVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleGroup: {
    flex: 1,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.7,
    color: theme.colors.textHint,
    marginBottom: 2,
  },
  sectionSubtext: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
  },
  priceValueBadge: {
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(15, 81, 50, 0.15)',
  },
  priceValueText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  sliderTouchBox: {
    paddingVertical: 14,
    justifyContent: 'center',
  },
  sliderTrackBg: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    justifyContent: 'center',
  },
  sliderTrackActive: {
    height: '100%',
    borderRadius: 3.5,
  },
  sliderKnob: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 3.5,
    elevation: 4,
    top: -8.5,
  },
  sliderKnobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 12,
  },
  scaleLabel: {
    fontSize: 10,
    color: theme.colors.textHint,
    fontWeight: theme.typography.weights.semiBold,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  presetBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  presetBtnText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 5,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },
  sortList: {
    gap: 7,
    marginTop: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sortOptionRowActive: {
    backgroundColor: theme.colors.primaryMuted,
    borderColor: 'rgba(15, 81, 50, 0.25)',
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortOptionText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  sortOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ratingChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  ratingChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  ratingChipText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  ratingChipTextActive: {
    color: '#FFFFFF',
  },
  specialTagsGrid: {
    flexDirection: 'column',
    gap: 7,
    marginTop: 8,
  },
  specialTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 7,
  },
  specialTagChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  specialTagText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.textPrimary,
  },
  specialTagTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.bold,
  },
  drawerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  footerClearBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerClearText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: '#4B5563',
  },
  footerApplyBtnWrapper: {
    flex: 1,
  },
  footerApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  footerApplyText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
  },
});
