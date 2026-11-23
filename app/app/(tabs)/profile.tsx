import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  RefreshControl,
  Share,
  Animated,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Address } from '../../types';
import { fetchUserProfile, fetchUserCoins, updateUserTasteProfile } from '../../services/userClientService';
import { fetchUserAddresses, saveUserAddress, removeUserAddress } from '../../services/addressService';
import { fetchUserOrders } from '../../services/orderClientService';
import { AddAddressModal } from '../../components/checkout/AddAddressModal';
import { DeleteAddressModal } from '../../components/address/DeleteAddressModal';
import { EditProfileModal } from '../../components/profile/EditProfileModal';
import { useScratchCardStore } from '../../store/useScratchCardStore';
import { Icon } from '../../components/common/Icon';
import { ProfileSkeleton } from '../../components/common/Skeleton';
import { useAuth } from '../../store/authContext';
import { useWishlistStore } from '../../store/useWishlistStore';
import { useAddressStore } from '../../store/useAddressStore';
import { useResponsive } from '../../utils/responsive';
import { Image } from 'expo-image';
import { getAvatarUrl } from '../../utils/imageUtils';

const PROFILE_FLAVOURS = [
  { id: 'Normal Chai', label: 'Normal Chai', emoji: '' },
  { id: 'Masala Chai', label: 'Masala Chai', emoji: '' },
  { id: 'Keser Chai', label: 'Keser Chai', emoji: '' },
  { id: 'Chocolate Chai', label: 'Chocolate Chai', emoji: '' },
];

export function normalizeMorningCup(val?: string | null): string {
  if (!val) return 'Normal Chai';
  const clean = String(val).trim();
  const lower = clean.toLowerCase();
  if (
    lower === 'normal chai' ||
    lower === 'normal' ||
    lower.includes('assam') ||
    lower.includes('classic') ||
    (lower.includes('kadak') && !lower.includes('masala'))
  ) {
    return 'Normal Chai';
  }
  if (
    lower === 'masala chai' ||
    lower === 'masala' ||
    lower.includes('spice') ||
    lower.includes('elaichi') ||
    lower.includes('kadha')
  ) {
    return 'Masala Chai';
  }
  if (
    lower === 'keser chai' ||
    lower === 'kesar chai' ||
    lower === 'keser' ||
    lower === 'kesar' ||
    lower.includes('saffron') ||
    lower.includes('mogra')
  ) {
    return 'Keser Chai';
  }
  if (lower === 'chocolate chai' || lower === 'chocolate' || lower.includes('cocoa')) {
    return 'Chocolate Chai';
  }
  return clean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { isTablet } = useResponsive();
  const { user, logout, setPreferredBlend: setPreferredBlendStore, updateUserProfile } = useAuth();
  const { wishlistIds } = useWishlistStore();
  const wishlistCount = wishlistIds.length;
  const {
    addresses,
    loadAddresses,
    setDefaultAddress: storeSetDefaultAddress,
    deleteAddress: storeDeleteAddress,
    addNewAddress: storeAddNewAddress,
    updateAddress: storeUpdateAddress,
  } = useAddressStore();
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const [preferredBlend, setPreferredBlend] = useState(
    normalizeMorningCup(user?.preferred_blend || user?.favorite_morning_cup || 'Normal Chai')
  );
  const [refreshing, setRefreshing] = useState(false);

  // Floating notification toast for taste profile change
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string; tea: string } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showPreferenceToast = (tea: string) => {
    setToastMessage({
      title: 'Taste Profile Saved in Database!',
      body: `Your preference for "${tea}" is successfully saved in database. Now you will get notifications according to your preference.`,
      tea,
    });
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(4500),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  // Dynamic user stats from API
  const [userProfile, setUserProfile] = useState<any>(null);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);

  // Scratch Cards Store integration
  const { cards: scratchCards } = useScratchCardStore();
  const unclaimedScratchCards = scratchCards.filter((c) => !c.isClaimed);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        await useScratchCardStore.getState().setCurrentUser(user.id);
      }
      const [prof, coins, _addr, _wish, _cards, ordersRes] = await Promise.all([
        fetchUserProfile(),
        fetchUserCoins(),
        loadAddresses(),
        useWishlistStore.getState().loadWishlist(),
        useScratchCardStore.getState().loadCards(user?.id),
        fetchUserOrders(1, 15).catch(() => ({ orders: [] })),
      ]);
      if (prof) {
        setUserProfile(prof);
        const morningCup = normalizeMorningCup(
          prof.preferred_blend || prof.favorite_morning_cup || user?.preferred_blend
        );
        setPreferredBlend(morningCup);
      } else if (user?.preferred_blend) {
        setPreferredBlend(normalizeMorningCup(user.preferred_blend));
      }
      if (coins?.balance !== undefined) {
        setCoinsBalance(coins.balance);
      }
      await useScratchCardStore.getState().syncWithOrders(ordersRes?.orders || [], user?.id);
    } catch (e) {
      console.warn('Error loading user profile:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const setDefaultAddress = async (id: string | number) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    await storeSetDefaultAddress(id);
  };

  const promptDeleteAddress = (addr: Address) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
    setAddressToDelete(addr);
    setDeleteModalVisible(true);
  };

  const confirmDeleteAddress = async (addr: Address) => {
    try {
      setIsDeletingAddress(true);
      await storeDeleteAddress(addr.id);
      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { }
      }
    } catch (e) {
      console.warn('Error deleting address:', e);
    } finally {
      setIsDeletingAddress(false);
      setDeleteModalVisible(false);
      setAddressToDelete(null);
    }
  };

  const handleSelectMorningCup = async (tea: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    setPreferredBlend(tea);
    if (user) {
      setPreferredBlendStore(tea);
    }
    showPreferenceToast(tea);
    try {
      await updateUserTasteProfile(tea);
    } catch (err) {
      console.warn('Failed to update favorite morning cup:', err);
    }
  };

  const handleSaveProfile = async (updatedData: {
    name: string;
    email: string;
    phone: string;
    favoriteMorningCup: string;
    avatarUrl?: string | null;
  }) => {
    await updateUserProfile({
      name: updatedData.name,
      email: updatedData.email,
      phone: updatedData.phone,
      favorite_morning_cup: updatedData.favoriteMorningCup,
      preferred_blend: updatedData.favoriteMorningCup,
      avatarUrl: updatedData.avatarUrl,
    });
    setPreferredBlend(updatedData.favoriteMorningCup);
    await loadProfile();
    showPreferenceToast(updatedData.favoriteMorningCup);
  };

  const handleSignOut = () => {
    setSignOutModalVisible(true);
  };

  const confirmSignOut = async () => {
    setSignOutModalVisible(false);
    try {
      await logout();
      router.replace('/auth/login');
    } catch (e) {
      console.warn('Logout error:', e);
      router.replace('/auth/login');
    }
  };

  const userReferralCode = userProfile?.referral_code || user?.referral_code || '';
  const [copiedReferral, setCopiedReferral] = useState(false);

  const resolveActiveReferralCode = async (): Promise<string | null> => {
    if (userProfile?.referral_code) return userProfile.referral_code;
    if (user?.referral_code) return user.referral_code;

    try {
      const prof = await fetchUserProfile();
      if (prof?.referral_code) {
        setUserProfile(prof);
        return prof.referral_code;
      }
    } catch { }

    return null;
  };

  const getInviteMessage = (code: string) => {
    const inviteLink = `https://vardhamrit.onrender.com/auth/register?code=${code}`;
    return `Hey! ☕ I'm inviting you to try fresh single-estate Assam tea from *Vardhamrit*.\n\nUse my invite code *${code}* during signup to get *50 free Tea Coins (₹50 value)* on your account!\n\nOrder fresh from estate here:\n${inviteLink}`;
  };

  const handleCopyReferralCode = async () => {
    const code = await resolveActiveReferralCode();
    if (!code) {
      Alert.alert('Loading Invite Code', 'Please wait a moment while your account invite code finishes loading.');
      return;
    }
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
      } catch { }
    }
    setCopiedReferral(true);
    setTimeout(() => {
      setCopiedReferral(false);
    }, 2500);
  };

  const handleWhatsAppShare = async () => {
    const code = await resolveActiveReferralCode();
    if (!code) {
      Alert.alert('Loading Invite Code', 'Please wait a moment while your account invite code finishes loading.');
      return;
    }
    const message = getInviteMessage(code);
    const encoded = encodeURIComponent(message);
    const whatsappNativeUrl = `whatsapp://send?text=${encoded}`;
    const whatsappWebUrl = `https://api.whatsapp.com/send?text=${encoded}`;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    try {
      const canOpen = await Linking.canOpenURL(whatsappNativeUrl);
      if (canOpen) {
        await Linking.openURL(whatsappNativeUrl);
        return;
      }
    } catch { }

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(whatsappWebUrl, '_blank');
      } else {
        await Linking.openURL(whatsappWebUrl);
      }
    } catch {
      handleNativeShare();
    }
  };

  const handleNativeShare = async () => {
    const code = await resolveActiveReferralCode();
    if (!code) return;
    const message = getInviteMessage(code);
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
        handleWhatsAppShare();
        return;
      }
      await Share.share({
        message,
        title: 'Invite a Friend to Vardhamrit Tea Club',
      });
    } catch {
      handleWhatsAppShare();
    }
  };

  return (
    <View style={styles.container}>
      {/* Floating Preference Saved Notification Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.notificationToastWrapper,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.notificationToastCard}>
            <View style={styles.toastIconDisc}>
              <Icon name="bell" size={16} color="#0A3622" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.toastHeaderRow}>
                <Text style={styles.toastTitle}>{toastMessage.title}</Text>
                <View style={styles.toastDbBadge}>
                  <Text style={styles.toastDbBadgeText}></Text>
                </View>
              </View>
              <Text style={styles.toastBody}>{toastMessage.body}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setToastMessage(null)}
              style={styles.toastDismissBtn}
              activeOpacity={0.7}
            >
              <Icon name="x" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* 1. TOP NAVBAR */}
      <View style={[styles.topNav, isTablet && styles.topNavTablet]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={[styles.backButton, isTablet && styles.backButtonTablet]}
        >
          <Icon name="arrow-left" size={isTablet ? 18 : 16} color={theme.colors.textPrimary} />
          <Text style={[styles.backText, isTablet && { fontSize: 13.5 }]}>Shopping</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isTablet && { fontSize: 19 }]}>My Profile</Text>
          <Text style={[styles.headerSubtitle, isTablet && { fontSize: 13 }]}>Royal Connoisseur Club</Text>
        </View>

        <View style={[styles.vipBadge, isTablet && { minWidth: 90 }]}>
          <Text style={styles.vipBadgeText}></Text>
        </View>
      </View>

      {loading && !userProfile ? (
        <ProfileSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 2. LUXURY ESTATE MEMBER HERO CARD */}
          <LinearGradient
            colors={theme.colors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.memberCard}
          >
            <View style={styles.memberTopRow}>
              {/* Avatar Disc */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setEditProfileModalVisible(true)}
                style={styles.avatarBorder}
              >
                <View style={styles.avatarInner}>
                  {getAvatarUrl(user?.avatar_url) ? (
                    <Image
                      source={{ uri: getAvatarUrl(user?.avatar_url)! }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {user?.name
                        ? user.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                        : 'AS'}
                    </Text>
                  )}
                </View>
                <View style={styles.avatarCameraBadge}>
                  <Icon name="camera" size={10} color="#0A3622" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>

              {/* Member Details */}
              <View style={styles.memberDetailsCol}>
                <View style={styles.memberNameRow}>
                  <Text style={styles.memberName}>
                    {user?.name || 'Aarav Sharma'}
                  </Text>
                  <Icon name="badge-check" size={15} color="#86EFAC" />

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setEditProfileModalVisible(true)}
                    style={styles.editProfilePill}
                  >
                    <Icon name="edit-2" size={10} color="#0A3622" />
                    <Text style={styles.editProfilePillText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.memberContactText}>
                  {user?.phone || '+91 98765 43210'}
                </Text>
                <Text style={styles.memberContactText}>
                  {user?.email ? `${user.email}` : 'Verified Connoisseur'}
                </Text>

              </View>
            </View>

            {/* Loyalty Points Bar */}
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyTitleRow}>
                <View style={styles.loyaltyLeftCol}>
                  <Text style={styles.loyaltyPointsNumber}>{coinsBalance}</Text>
                  <Text style={styles.loyaltyPointsLabel}>Tea Coins</Text>
                </View>
                <Text style={styles.loyaltyValueText}>
                  {coinsBalance >= 500
                    ? 'Max ₹500 Off Ready'
                    : `Worth ₹${coinsBalance} Off Next Order`}
                </Text>
              </View>

              <View style={styles.loyaltyProgressBarTrack}>
                <View style={[styles.loyaltyProgressBarFill, { width: `${Math.min(100, Math.round((coinsBalance / 500) * 100))}%` }]} />
              </View>

              <View style={styles.loyaltyFooterRow}>
                <Text style={styles.loyaltyFooterNote}>
                  1 Coin = ₹1 flat deduction
                </Text>
                <View style={[styles.loyaltyCapBadge, coinsBalance >= 500 && styles.loyaltyCapBadgeMax]}>
                  <Icon
                    name={coinsBalance >= 500 ? 'shield-check' : 'coins'}
                    size={11}
                    color={coinsBalance >= 500 ? '#34D399' : '#FEF08A'}
                  />
                  <Text style={[styles.loyaltyCapText, coinsBalance >= 500 && styles.loyaltyCapTextMax]}>
                    {coinsBalance >= 500 ? 'Max Cap (500) Reached' : 'Max Wallet Cap: 500 Coins'}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* SIMPLE PHONEPE-STYLE UNCLAIMED REWARDS TILE */}
          {unclaimedScratchCards.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/rewards')}
              style={styles.simpleRewardsCard}
            >
              <View style={styles.simpleRewardsLeft}>
                <View style={styles.simpleGiftDisc}>
                  <Icon name="gift" size={18} color="#B45309" />
                </View>
                <View style={styles.simpleTextCol}>
                  <View style={styles.simpleTitleRow}>
                    <Text style={styles.simpleRewardsTitle}>Rewards & Scratch Cards</Text>
                    <View style={styles.simpleBadgePill}>
                      <View style={styles.simpleBadgeDot} />
                      <Text style={styles.simpleBadgeText}>
                        {unclaimedScratchCards.length} Unclaimed
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.simpleRewardsSubtitle}>
                    Tap to scratch & win instant cashback coins
                  </Text>
                </View>
              </View>

              <View style={styles.simpleArrowWrap}>
                <Icon name="chevron-right" size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          )}

          {/* 3. FOUR QUICK ACCOUNT HIGHLIGHTS */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/orders')}
              style={styles.statBox}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#F1F5F9' }]}>
                <Icon name="package" size={18} color={theme.colors.primary} />
              </View>
              <Text style={styles.statNumber}>{userProfile?.stats?.orders_count ?? 0}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/wishlist')}
              style={styles.statBox}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                <Icon name="heart" size={18} color="#DC2626" fill="#DC2626" />
              </View>
              <Text style={styles.statNumber}>{wishlistCount}</Text>
              <Text style={styles.statLabel}>Wishlist</Text>
            </TouchableOpacity>

            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                <Icon name="tag" size={18} color="#B45309" />
              </View>
              <Text style={styles.statNumber}>₹{userProfile?.stats?.total_saved ?? 0}</Text>
              <Text style={styles.statLabel}>Saved</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/orders')}
              style={styles.statBox}
            >
              <View style={[styles.statIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                <Icon name="zap" size={18} color="#2563EB" />
              </View>
              <Text style={styles.statNumber}>48hrs</Text>
              <Text style={styles.statLabel}>Speed</Text>
            </TouchableOpacity>
          </View>

          {/* 4. CHAI SOMMELIER TASTE PREFERENCES (Favorite Morning Cup Only) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Icon name="coffee" size={isTablet ? 20 : 16} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, isTablet && { fontSize: 16.5 }]}>My Tea Taste Profile</Text>
              </View>
              <View style={[styles.activeProfileBadge, isTablet && { paddingHorizontal: 10, paddingVertical: 4 }]}>
                <Text style={[styles.activeProfileBadgeText, isTablet && { fontSize: 11 }]}>SAVED</Text>
              </View>
            </View>

            <View style={[styles.preferenceGroup, isTablet && { padding: 14 }]}>
              <Text style={[styles.prefHeading, isTablet && { fontSize: 13.5, marginBottom: 10 }]}>Favorite Morning Cup</Text>
              <View style={[styles.prefChipsRow, isTablet && styles.prefChipsRowTablet]}>
                {PROFILE_FLAVOURS.map((f) => {
                  const isSelected =
                    normalizeMorningCup(preferredBlend) === normalizeMorningCup(f.id);
                  return (
                    <TouchableOpacity
                      key={f.id}
                      activeOpacity={0.75}
                      onPress={() => handleSelectMorningCup(f.id)}
                      style={[
                        styles.prefChip,
                        isTablet && styles.prefChipTablet,
                        isSelected && styles.prefChipActive,
                      ]}
                    >
                      <Text style={styles.prefChipEmoji}>{f.emoji}</Text>
                      <Text
                        style={[
                          styles.prefChipText,
                          isTablet && { fontSize: 13.5 },
                          isSelected && styles.prefChipTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                      {isSelected ? (
                        <View style={styles.prefChipCheckBadge}>
                          <Icon name="check" size={10} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 5. SAVED DELIVERY ADDRESSES */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Icon name="map-pin" size={16} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>Saved Addresses</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setEditingAddress(null);
                  setAddModalVisible(true);
                }}
                style={styles.addBtnRow}
              >
                <Icon name="plus" size={13} color={theme.colors.primary} />
                <Text style={styles.addAddressText}>Add New</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addressesList}>
              {addresses.map((addr) => (
                <View
                  key={addr.id}
                  style={[
                    styles.addressBox,
                    addr.isDefault && styles.addressBoxDefault,
                  ]}
                >
                  <View style={styles.addrTopRow}>
                    <View style={styles.addrTagRow}>
                      <View style={styles.addrTagIconCircle}>
                        <Icon
                          name={
                            addr.tag === 'HOME'
                              ? 'home'
                              : addr.tag === 'WORK'
                                ? 'building'
                                : 'map-pin'
                          }
                          size={12}
                          color={theme.colors.primary}
                        />
                      </View>
                      <Text style={styles.addrTag}>{addr.tag}</Text>
                      <Text style={styles.addrName}>{addr.name}</Text>
                    </View>

                    {addr.isDefault ? (
                      <View style={styles.defaultChip}>
                        <Text style={styles.defaultChipText}>Default</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setDefaultAddress(addr.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.setDefaultText}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.addrLine} numberOfLines={2}>
                    {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ''}
                    {addr.city} - {addr.pincode}
                  </Text>
                  <View style={styles.addrPhoneRow}>
                    <Icon name="phone" size={11} color="#6B7280" />
                    <Text style={styles.addrPhone}>{addr.phone}</Text>
                  </View>

                  <View style={styles.addrActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingAddress(addr);
                        setAddModalVisible(true);
                      }}
                      style={styles.editBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Icon name="edit" size={12} color={theme.colors.primary} />
                      <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => promptDeleteAddress(addr)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Icon name="trash" size={12} color="#DC2626" />
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 6. REFER & EARN ₹50 CARD */}
          <LinearGradient
            colors={['#FFFDF7', '#FEF3C7', '#FDE68A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.referCard}
          >
            {/* Top Row: Icon + Title + Value Badge */}
            <View style={styles.referTopRow}>
              <LinearGradient
                colors={['#F59E0B', '#B45309']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.referIconCircle}
              >
                <Icon name="sparkles" size={18} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.referTitle} numberOfLines={1}>Invite a Fellow Chai Lover</Text>
                <Text style={styles.referSubtitle}>
                  Give ₹50 in Tea Coins to friends & earn ₹50 when they join!
                </Text>
              </View>
            </View>

            {/* Voucher Ticket Code Box + Share Action Row */}
            <View style={styles.referRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleCopyReferralCode}
                style={styles.referCodeBtn}
                accessibilityLabel="Copy invite code"
              >
                <View style={styles.referCodeLeft}>
                  <View style={styles.referCodeLabelRow}>
                    <Icon name="ticket" size={10} color="#B45309" />
                    <Text style={styles.referCodeLabel}>YOUR EXCLUSIVE INVITE CODE</Text>
                  </View>
                  <Text style={styles.referCodeText}>
                    {userReferralCode || (loading ? 'Loading...' : 'CHAI50')}
                  </Text>
                </View>

                <View
                  style={[
                    styles.referCopyPill,
                    copiedReferral && styles.referCopyPillSuccess,
                  ]}
                >
                  <Icon
                    name={copiedReferral ? 'check' : 'copy'}
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleNativeShare}
                style={styles.referOtherShareBtn}
                accessibilityLabel="Share invite code with friends"
              >
                <Icon name="share" size={18} color="#78350F" />
              </TouchableOpacity>
            </View>


            {/* Micro-Benefit Highlights */}
            <View style={styles.referPerksRow}>
              <View style={styles.referPerkItem}>
                <Icon name="badge-check" size={12} color="#15803D" />
                <Text style={styles.referPerkText}>50 Coins on Signup</Text>
              </View>
              <View style={styles.referPerkDivider} />
              <View style={styles.referPerkItem}>
                <Icon name="zap" size={12} color="#B45309" />
                <Text style={styles.referPerkText}>Instant Wallet Credit</Text>
              </View>
            </View>

          </LinearGradient>

          {/* 7. QUICK SERVICES & SUPPORT MENU */}
          <View style={styles.menuCard}>
            {/* Edit Personal Profile */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => setEditProfileModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#E0F2FE' }]}>
                <Icon name="user" size={16} color="#0284C7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>Personal Details & Profile</Text>
                <Text style={styles.menuSubtext}>Edit your name, email, phone & taste preference</Text>
              </View>
              <Icon name="chevron-right" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/(tabs)/orders')}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#F1F5F9' }]}>
                <Icon name="package" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.menuText}>Order History & Past Shipments</Text>
              <Icon name="chevron-right" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* My Scratch Cards & Rewards */}
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/rewards')}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Icon name="gift" size={16} color="#B45309" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuText}>My Scratch Cards & Rewards</Text>
                <Text style={styles.menuSubtext}>
                  {unclaimedScratchCards.length > 0
                    ? `${unclaimedScratchCards.length} scratch card${unclaimedScratchCards.length > 1 ? 's' : ''} waiting to be revealed`
                    : 'View all reward history & perks'}
                </Text>
              </View>
              {unclaimedScratchCards.length > 0 ? (
                <View style={styles.unclaimedBadgePill}>
                  <Text style={styles.unclaimedBadgeText}>
                    {unclaimedScratchCards.length} New
                  </Text>
                </View>
              ) : (
                <Icon name="chevron-right" size={14} color="#9CA3AF" />
              )}
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => router.push('/wishlist')}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
                <Icon name="heart" size={16} color="#DC2626" />
              </View>
              <Text style={styles.menuText}>My Saved Chai Wishlist</Text>
              <Icon name="chevron-right" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() =>
                Alert.alert(
                  'Vardhamrit Tea Sommelier',
                  'Have questions on blends, brewing methods, or water ratios? Our master blenders are on call 24/7.'
                )
              }
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <Icon name="message-square" size={16} color="#B45309" />
              </View>
              <Text style={styles.menuText}>24/7 Tea Sommelier & Concierge</Text>
              <Icon name="chevron-right" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={() =>
                Alert.alert(
                  'Direct Harvest Purity Guarantee',
                  'Every pack of Vardhamrit tea is 100% single-estate or garden-direct, vacuum-sealed with zero artificial flavors or colors.'
                )
              }
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#F3F4F6' }]}>
                <Icon name="leaf" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.menuText}>Direct Estate Purity Guarantee</Text>
              <Icon name="chevron-right" size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* 8. SIGN OUT BUTTON */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSignOut}
            style={styles.signOutBtn}
          >
            <Icon name="lock" size={14} color="#DC2626" />
            <Text style={styles.signOutText}>Sign Out from Vardhamrit</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>
            Vardhamrit Tea Quick-Commerce v2.4 (Estate Direct Edition)
          </Text>
        </ScrollView>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editProfileModalVisible}
        onClose={() => setEditProfileModalVisible(false)}
        user={user}
        onSave={handleSaveProfile}
      />

      {/* Add / Edit Address Modal */}
      <AddAddressModal
        visible={addModalVisible}
        initialAddress={editingAddress}
        onClose={() => {
          setAddModalVisible(false);
          setEditingAddress(null);
        }}
        onSaveAddress={async (savedAddr) => {
          if (
            editingAddress &&
            editingAddress.id &&
            !String(editingAddress.id).startsWith('addr-') &&
            !String(editingAddress.id).startsWith('gps-')
          ) {
            await storeUpdateAddress(editingAddress.id, savedAddr);
          } else {
            await storeAddNewAddress(savedAddr);
          }
          setEditingAddress(null);
          await loadAddresses();
        }}
      />

      {/* Attractive Delete Address Confirmation Modal */}
      <DeleteAddressModal
        visible={deleteModalVisible}
        address={addressToDelete}
        onClose={() => {
          setDeleteModalVisible(false);
          setAddressToDelete(null);
        }}
        onConfirmDelete={confirmDeleteAddress}
        isDeleting={isDeletingAddress}
      />

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.signOutModalCard}>
            <View style={styles.signOutIconDisc}>
              <Icon name="lock" size={22} color="#DC2626" />
            </View>

            <Text style={styles.signOutModalTitle}>Sign Out</Text>
            <Text style={styles.signOutModalMessage}>
              Are you sure you want to sign out from Vardhamrit? Your saved blends, orders, and addresses will remain safe.
            </Text>

            <View style={styles.signOutModalButtonsRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSignOutModalVisible(false)}
                style={styles.signOutCancelBtn}
              >
                <Text style={styles.signOutCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={confirmSignOut}
                style={styles.signOutConfirmBtn}
              >
                <Text style={styles.signOutConfirmBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  notificationToastWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 44,
    left: 14,
    right: 14,
    zIndex: 9999,
    elevation: 10,
  },
  notificationToastCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    shadowColor: '#0A3622',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  toastIconDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  toastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: -10,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: '#fff',
    flex: 1,
  },
  toastDbBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  toastDbBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  toastBody: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
  toastDismissBtn: {
    padding: 3,
  },
  topNav: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  topNavTablet: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  backButtonTablet: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 10.5,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
    marginTop: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  vipBadgeText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
  },
  scrollContent: {
    padding: theme.spacing.base,
    paddingBottom: 44,
  },
  memberCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBorder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#D4AF37',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#D4AF37',
    borderWidth: 1.5,
    borderColor: '#0A3622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  memberDetailsCol: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginLeft: 'auto',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  editProfilePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0A3622',
  },
  memberName: {
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  memberContactText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.85)',
    marginVertical: 2,
  },
  tierCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  tierCapsuleText: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  loyaltyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  loyaltyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  loyaltyLeftCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  loyaltyPointsNumber: {
    fontSize: 18,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
  },
  loyaltyPointsLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  loyaltyValueText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FEF08A',
    letterSpacing: 0.2,
  },
  loyaltyProgressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  loyaltyProgressBarFill: {
    height: '100%',
    backgroundColor: '#FEF08A',
    borderRadius: 3,
  },
  loyaltyFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyFooterNote: {
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: theme.typography.weights.medium,
  },
  loyaltyCapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(254, 240, 138, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  loyaltyCapBadgeMax: {
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    borderColor: '#34D399',
  },
  loyaltyCapText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FEF08A',
    letterSpacing: 0.2,
  },
  loyaltyCapTextMax: {
    color: '#D1FAE5',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  statNumber: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontSize: 9.5,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionCardTablet: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  activeProfileBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  activeProfileBadgeText: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  preferenceGroup: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
  },
  prefHeading: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  prefChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefChipsRowTablet: {
    gap: 12,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  prefChipTablet: {
    flex: 1,
    minWidth: 120,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
  },
  prefChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  prefChipEmoji: {
    fontSize: 13,
  },
  prefChipText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: theme.typography.weights.bold,
  },
  prefChipTextActive: {
    color: '#FFFFFF',
    fontWeight: theme.typography.weights.extraBold,
  },
  prefChipCheckBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  addBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addAddressText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  addressesList: {
    gap: 10,
  },
  addressBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  addressBoxDefault: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  addrTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addrTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addrTagIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrTag: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  addrName: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  defaultChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultChipText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  setDefaultText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  addrLine: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 15,
    marginBottom: 6,
  },
  addrPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  addrPhone: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
  },
  addrActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  editText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deleteText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
  referCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.2,
    borderColor: '#FCD34D',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  referTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  referIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  referTitle: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: '#78350F',
  },
  referSubtitle: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 3,
    lineHeight: 15,
  },
  referRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  referCodeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#F59E0B',
    height: 52,
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  referCodeLeft: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  referCodeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referCodeLabel: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#B45309',
    letterSpacing: 0.6,
  },
  referCodeText: {
    fontSize: 15,
    fontWeight: theme.typography.weights.extraBold,
    color: '#78350F',
    letterSpacing: 1.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  referCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350F',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#78350F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  referCopyPillSuccess: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  referCopyText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  referPerksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 2,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  referPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  referPerkText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: '#78350F',
  },
  referPerkDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#FCD34D',
  },
  referOtherShareBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 56,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    marginBottom: 14,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: '#DC2626',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  signOutModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  signOutIconDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  signOutModalTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  signOutModalMessage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20,
  },
  signOutModalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  signOutCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutCancelBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  signOutConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
  },
  simpleRewardsCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  simpleRewardsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  simpleGiftDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleTextCol: {
    flex: 1,
  },
  simpleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simpleRewardsTitle: {
    fontSize: 13.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#0F172A',
  },
  simpleBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  simpleBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D97706',
  },
  simpleBadgeText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.extraBold,
    color: '#92400E',
    letterSpacing: 0.3,
  },
  simpleRewardsSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  simpleArrowWrap: {
    paddingLeft: 8,
  },
  menuSubtext: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  unclaimedBadgePill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unclaimedBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
  },
});
