import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { theme } from '../../theme';
import { Address } from '../../types';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useAddressStore } from '../../store/useAddressStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Icon } from '../common/Icon';
import { useResponsive } from '../../utils/responsive';
import { formatHeaderAddress } from '../../services/locationService';

const PLACEHOLDERS = [
  "Search 'Normal Kadak chai'...",
  "Search 'Grand Masala chai'...",
  "Search 'Royal Keser saffron chai'...",
  "Search 'Artisan chocolate chai'...",
];

interface HomeHeaderProps {
  selectedAddress?: Address | null;
  onAddressPress: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  selectedAddress,
  onAddressPress,
  searchQuery,
  onSearchChange,
}) => {
  const router = useRouter();
  const { isTablet, scaleFont } = useResponsive();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const { wishlistIds, loadWishlist } = useWishlistStore();
  const { unreadCount, loadUnreadCount } = useNotificationStore();
  const isLocating = useAddressStore((state) => state.isLocating);
  const wishlistCount = wishlistIds.length;

  useEffect(() => {
    loadWishlist();
    loadUnreadCount();
  }, [loadWishlist, loadUnreadCount]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  return (
    <LinearGradient
      colors={theme.colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.headerContainer}
    >
      {/* Brand & Express Hallmark */}
      <View style={styles.brandRow}>
        <View style={styles.brandBadge}>
          <Icon name="coffee" size={12} color="#F59E0B" />
          <Text style={styles.brandTitle}>VARDHAMRIT</Text>
          <View style={styles.brandDot} />
          <Text style={styles.brandSubtitle}>ESTATE HARVEST</Text>
        </View>
        <View style={styles.liveDeliveryBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.liveDeliveryText}>EXPRESS 48 hrs</Text>
        </View>
      </View>

      {/* Top Location & Delivery Time Row */}
      <View style={styles.topRow}>
        <View style={styles.addressSection}>

          {/* Address Dropdown */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onAddressPress}
            style={styles.addressDropdown}
          >
            <View style={styles.deliverToRow}>
              <Icon name="map-pin" size={isTablet ? 14 : 12} color="rgba(255, 255, 255, 0.85)" />
              <Text style={[styles.deliverToLabel, isTablet && { fontSize: scaleFont(11.5) }]} numberOfLines={1}>
                {isLocating
                  ? 'Detecting Location...'
                  : selectedAddress
                    ? `Deliver to ${selectedAddress.tag || 'Current Location'}`
                    : 'Select Delivery Location'}
              </Text>
            </View>
            <View style={styles.addressTitleRow}>
              <Text
                style={[
                  styles.addressText,
                  isTablet && { fontSize: scaleFont(15) },
                ]}
                numberOfLines={1}
              >
                {isLocating
                  ? 'Fetching GPS location...'
                  : formatHeaderAddress(selectedAddress)}
              </Text>
              <Icon name="chevron-down" size={isTablet ? 18 : 16} color={theme.colors.textInverse} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Right Actions: Notifications Bell, Wishlist Heart & Profile Avatar */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/notifications')}
            style={styles.headerIconBtn}
          >
            <View style={[styles.headerIconCircle, isTablet && styles.headerIconCircleTablet]}>
              <Icon name="bell" size={isTablet ? 20 : 17} color={theme.colors.textInverse} />
              {unreadCount > 0 ? (
                <View style={[styles.headerBadgeDot, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.headerBadgeDotText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/wishlist')}
            style={styles.headerIconBtn}
          >
            <View style={[styles.headerIconCircle, isTablet && styles.headerIconCircleTablet]}>
              <Icon name="heart" size={isTablet ? 20 : 17} color={theme.colors.textInverse} />
              {wishlistCount > 0 ? (
                <View style={styles.headerBadgeDot}>
                  <Text style={styles.headerBadgeDotText}>
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileBtn}
          >
            <View style={[styles.profileAvatar, isTablet && styles.profileAvatarTablet]}>
              <Icon name="user" size={isTablet ? 21 : 18} color={theme.colors.textInverse} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rounded White Search Bar with Rotating Placeholder */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, isTablet && styles.searchBarTablet]}>
          <Icon name="search" size={isTablet ? 21 : 18} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isTablet && { fontSize: scaleFont(16) }]}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            placeholderTextColor={theme.colors.textHint}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCorrect={false}
            underlineColorAndroid="transparent"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => onSearchChange('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={16} color={theme.colors.textHint} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderBottomLeftRadius: theme.radius.banner,
    borderBottomRightRadius: theme.radius.banner,
    ...theme.shadows.card,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
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
  liveDeliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    gap: 4.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveDeliveryText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  addressSection: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  deliveryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentGold,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  deliveryPillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  addressDropdown: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  deliverToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliverToLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.medium,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  addressText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm + 1,
    fontWeight: theme.typography.weights.extraBold,
    flexShrink: 1,
    maxWidth: 320,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    borderRadius: 19,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconCircleTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    minWidth: 18,
    height: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  headerBadgeDotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    textAlign: 'center',
    lineHeight: 11,
  },
  profileBtn: {
    borderRadius: 20,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchSection: {
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 46,
    borderWidth: 0,
    borderColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any)
      : {}),
    ...theme.shadows.subtle,
  },
  searchBarTablet: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 18,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.weights.medium,
    height: '100%',
    padding: 0,
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
  trendingTagsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 2,
  },
  trendingLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingRight: 2,
  },
  trendingLabelText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  trendingTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  trendingTagText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#FFFFFF',
  },
});

export default HomeHeader;
