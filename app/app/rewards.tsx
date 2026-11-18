import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  RefreshControl,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Icon } from '../components/common/Icon';
import { TeaCoinIcon } from '../components/common/TeaCoinIcon';
import { useAuth } from '../store/authContext';
import { useScratchCardStore, ScratchCardItem } from '../store/useScratchCardStore';
import { fetchUserOrders } from '../services/orderClientService';
import { fetchUserCoins, claimScratchCardReward } from '../services/userClientService';
import { ScratchCardModal } from '../components/checkout/ScratchCardModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type FilterTab = 'all' | 'unscratched' | 'claimed';

export default function RewardsScreen() {
  const router = useRouter();
  const { setCoinsBalance: setAuthCoinsBalance } = useAuth();
  const { cards, loadCards, syncWithOrders, markClaimed } = useScratchCardStore();

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);
  const [selectedScratchCard, setSelectedScratchCard] = useState<ScratchCardItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const initData = async (isRefresh = false) => {
    try {
      const [_, coinsRes, ordersRes] = await Promise.all([
        loadCards(),
        fetchUserCoins().catch(() => null),
        fetchUserOrders(1, 20).catch(() => null),
      ]);

      if (coinsRes?.balance !== undefined) {
        setCoinsBalance(coinsRes.balance);
      }

      if (ordersRes?.orders?.length) {
        await syncWithOrders(ordersRes.orders);
      }
    } catch (e) {
      console.warn('Error loading rewards:', e);
    } finally {
      if (!isRefresh) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    initData();
  }, []);

  const triggerRefreshHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    } else if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(20);
      } catch { }
    }
  }, []);

  // Web Pull-To-Refresh Gestures State & Refs
  const scrollYRef = useRef(0);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const canPullRef = useRef(false);
  const isPullingRef = useRef(false);
  const isMouseDownRef = useRef(false);
  const hasTriggeredThresholdHaptic = useRef(false);
  const pullAnim = useRef(new Animated.Value(0)).current;
  const [pullDistanceState, setPullDistanceState] = useState(0);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    triggerRefreshHaptic();

    if (Platform.OS === 'web') {
      Animated.spring(pullAnim, {
        toValue: 56,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }).start();
    }

    const startTime = Date.now();
    try {
      await initData(true);
    } catch (e) {
      console.warn('Error refreshing rewards:', e);
    } finally {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 750 - elapsed);
      if (remaining > 0) {
        await new Promise((r) => setTimeout(r, remaining));
      }
      setRefreshing(false);
      if (Platform.OS === 'web') {
        Animated.timing(pullAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }).start(() => {
          setPullDistanceState(0);
        });
      }
    }
  }, [refreshing, triggerRefreshHaptic]);

  const finishPull = useCallback(() => {
    if (!isPullingRef.current) {
      canPullRef.current = false;
      hasTriggeredThresholdHaptic.current = false;
      return;
    }
    isPullingRef.current = false;
    canPullRef.current = false;
    hasTriggeredThresholdHaptic.current = false;

    if (pullDistanceState >= 55 && !refreshing) {
      onRefresh();
    } else if (!refreshing) {
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }).start(() => {
        setPullDistanceState(0);
      });
    }
  }, [pullDistanceState, refreshing, onRefresh]);

  const handleTouchStart = (e: any) => {
    if (refreshing) return;
    const touch = e.touches ? e.touches[0] : e;
    if (!touch) return;
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    canPullRef.current = scrollYRef.current <= 2;
    isPullingRef.current = false;
    hasTriggeredThresholdHaptic.current = false;
  };

  const handleTouchMove = (e: any) => {
    if (!canPullRef.current || refreshing) return;
    const touch = e.touches ? e.touches[0] : e;
    if (!touch) return;
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // Reject horizontal movements
    if (Math.abs(deltaX) > Math.abs(deltaY) && !isPullingRef.current) {
      canPullRef.current = false;
      return;
    }

    // Must be downward pull at the top of the scroll container
    if (deltaY > 8 && scrollYRef.current <= 2) {
      isPullingRef.current = true;
      const distance = Math.min(85, Math.pow(deltaY, 0.82) * 1.6);
      pullAnim.setValue(distance);
      setPullDistanceState(distance);

      if (distance >= 55 && !hasTriggeredThresholdHaptic.current) {
        hasTriggeredThresholdHaptic.current = true;
        triggerRefreshHaptic();
      } else if (distance < 55) {
        hasTriggeredThresholdHaptic.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    finishPull();
  };

  const handleMouseDown = (e: any) => {
    if (refreshing || scrollYRef.current > 2) return;
    if (e.button !== 0) return; // Only primary left mouse button
    isMouseDownRef.current = true;
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    canPullRef.current = true;
    isPullingRef.current = false;
    hasTriggeredThresholdHaptic.current = false;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current || !canPullRef.current || refreshing) return;
      if (e.buttons !== 1) {
        isMouseDownRef.current = false;
        finishPull();
        return;
      }
      const deltaY = e.clientY - startYRef.current;
      const deltaX = e.clientX - startXRef.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && !isPullingRef.current) {
        canPullRef.current = false;
        return;
      }

      if (deltaY > 8 && scrollYRef.current <= 2) {
        isPullingRef.current = true;
        const distance = Math.min(85, Math.pow(deltaY, 0.82) * 1.6);
        pullAnim.setValue(distance);
        setPullDistanceState(distance);

        if (distance >= 55 && !hasTriggeredThresholdHaptic.current) {
          hasTriggeredThresholdHaptic.current = true;
          triggerRefreshHaptic();
        } else if (distance < 55) {
          hasTriggeredThresholdHaptic.current = false;
        }
      }
    };

    const onWindowMouseUp = () => {
      if (isMouseDownRef.current) {
        isMouseDownRef.current = false;
        finishPull();
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [refreshing, finishPull, triggerRefreshHaptic]);

  // Filtered Cards
  const unclaimedCards = useMemo(() => cards.filter((c) => !c.isClaimed), [cards]);
  const claimedCards = useMemo(() => cards.filter((c) => c.isClaimed), [cards]);

  const displayedCards = useMemo(() => {
    if (filterTab === 'unscratched') return unclaimedCards;
    if (filterTab === 'claimed') return claimedCards;
    return cards;
  }, [filterTab, cards, unclaimedCards, claimedCards]);

  // Total won calculation
  const totalCoinsWon = useMemo(() => {
    return claimedCards.reduce((sum, c) => sum + (c.coinsEarned || 0), 0);
  }, [claimedCards]);

  const handleCardPress = (card: ScratchCardItem) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    if (!card.isClaimed) {
      setSelectedScratchCard(card);
      setModalVisible(true);
    } else {
      Alert.alert(
        'Reward Claimed! ☕',
        `You won ${card.coinsEarned} Tea Coins (₹${card.coinsEarned}) on Order #${card.orderNumber}.\n\nThese coins have been credited to your wallet and can be used on your next checkout!`,
        [
          { text: 'Shop Teas', onPress: () => router.push('/(tabs)/categories') },
          { text: 'Close', style: 'cancel' },
        ]
      );
    }
  };

  const handleClaimReward = async () => {
    if (selectedScratchCard) {
      const claimRes = await claimScratchCardReward({
        orderNumber: selectedScratchCard.orderNumber,
        orderId: selectedScratchCard.id,
        coinsEarned: selectedScratchCard.coinsEarned,
      });

      await markClaimed(selectedScratchCard.id);

      if (claimRes?.newBalance !== undefined) {
        setCoinsBalance(claimRes.newBalance);
        setAuthCoinsBalance(claimRes.newBalance);
      } else {
        const res = await fetchUserCoins();
        if (res?.balance !== undefined) {
          setCoinsBalance(res.balance);
          setAuthCoinsBalance(res.balance);
        }
      }

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { }
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={styles.container}
        {...(Platform.OS === 'web'
          ? {
              onTouchStart: handleTouchStart,
              onTouchMove: handleTouchMove,
              onTouchEnd: handleTouchEnd,
              onTouchCancel: handleTouchEnd,
              onMouseDown: handleMouseDown,
            }
          : {})}
      >
        {/* 1. TOP APP BAR */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerNavRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Icon name="arrow-left" size={17} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <View style={styles.headerTitleRow}>
                <Icon name="gift" size={16} color="#FBBF24" />
                <Text style={styles.headerTitle}>Rewards & Scratch Cards</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() =>
                Alert.alert(
                  'How Vardhamrit Rewards Work 🎁',
                  '1. Every completed order unlocks an exclusive mystery scratch card.\n\n2. Scratch with your finger to reveal instant Tea Coins (₹1 = 1 Coin).\n\n3. Coins are credited directly to your wallet for instant discounts at checkout!'
                )
              }
              style={styles.helpButton}
            >
              <Icon name="help-circle" size={17} color="#A7F3D0" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          alwaysBounceVertical={true}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor="#FFFFFF"
              progressViewOffset={Platform.OS === 'android' ? 20 : 0}
            />
          }
        >
          {/* Custom Web Pull-To-Refresh Indicator */}
          {Platform.OS === 'web' && (
            <Animated.View
              style={[
                styles.webPullIndicatorContainer,
                {
                  height: pullAnim,
                  opacity: pullAnim.interpolate({
                    inputRange: [0, 15, 55],
                    outputRange: [0, 0.5, 1],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              <View style={styles.webPullIndicatorBadge}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: pullAnim.interpolate({
                            inputRange: [0, 55],
                            outputRange: ['0deg', '180deg'],
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    }}
                  >
                    <Icon name="chevron-down" size={15} color={theme.colors.primary} />
                  </Animated.View>
                )}
                <Text style={styles.webPullIndicatorText}>
                  {refreshing
                    ? 'Refreshing Rewards & Scratch Cards...'
                    : pullDistanceState >= 55
                    ? 'Release to refresh'
                    : 'Pull down to refresh'}
                </Text>
              </View>
            </Animated.View>
          )}
          {/* 2. ROYAL CONNOISSEUR CASHBACK PASS */}
          <LinearGradient
            colors={theme.colors.primaryGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Ambient gold glow highlight */}
            <View style={styles.heroGlowOrb} />

            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.heroBrandBadge}>
                  <Icon name="sparkles" size={10} color="#FBBF24" />
                  <Text style={styles.heroBrandText}>VARDHAMRIT CASHBACK CLUB</Text>
                </View>

                <View style={styles.heroBalanceRow}>
                  <TeaCoinIcon size={32} style={{ marginRight: 8 }} />
                  <Text style={styles.heroCoinsNumber}>
                    {coinsBalance > 0 ? coinsBalance : totalCoinsWon}
                  </Text>
                  <View style={styles.heroCoinsCol}>
                    <Text style={styles.heroCoinsLabel}>Tea Coins</Text>
                  </View>
                </View>

                <Text style={styles.heroSubtext}>
                  1 Tea Coin = ₹1 flat deduction at checkout
                </Text>
              </View>

              {/* Royal Gold Seal */}
              <View style={styles.heroTrophyDisc}>
                <LinearGradient
                  colors={['#FDE68A', '#F59E0B', '#D97706']}
                  style={styles.heroTrophyGradient}
                >
                  <Icon name="crown" size={24} color="#78350F" />
                </LinearGradient>
              </View>
            </View>
          </LinearGradient>

          {/* 3. SEGMENTED FILTER BAR */}
          <View style={styles.segmentedContainer}>
            <View style={styles.segmentedTabs}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterTab('all')}
                style={[
                  styles.tabItem,
                  filterTab === 'all' && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    filterTab === 'all' && styles.tabItemTextActive,
                  ]}
                >
                  All ({cards.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterTab('unscratched')}
                style={[
                  styles.tabItem,
                  filterTab === 'unscratched' && styles.tabItemActive,
                ]}
              >
                <View style={styles.tabItemRow}>
                  {unclaimedCards.length > 0 && <View style={styles.tabBadgeDot} />}
                  <Text
                    style={[
                      styles.tabItemText,
                      filterTab === 'unscratched' && styles.tabItemTextActive,
                    ]}
                  >
                    Unscratched ({unclaimedCards.length})
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFilterTab('claimed')}
                style={[
                  styles.tabItem,
                  filterTab === 'claimed' && styles.tabItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    filterTab === 'claimed' && styles.tabItemTextActive,
                  ]}
                >
                  Claimed ({claimedCards.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 4. 2-COLUMN SCRATCH CARDS GRID */}
          {displayedCards.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconDisc}>
                <Icon name="gift" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {filterTab === 'unscratched'
                  ? 'All Scratch Cards Claimed!'
                  : 'No Scratch Cards Found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === 'unscratched'
                  ? 'Every mystery reward has been revealed and added to your wallet. Place another order to unlock fresh cashback!'
                  : 'Place an order on Vardhamrit to get guaranteed cashback scratch cards on every checkout!'}
              </Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => router.push('/(tabs)/categories')}
                style={styles.emptyCtaBtn}
              >
                <LinearGradient
                  colors={theme.colors.actionGradient as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaGradient}
                >
                  <Icon name="sparkles" size={14} color="#FFFFFF" />
                  <Text style={styles.emptyCtaText}>Explore Teas & Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsGrid}>
              {displayedCards.map((card) => {
                const isUnclaimed = !card.isClaimed;

                return (
                  <TouchableOpacity
                    key={card.id}
                    activeOpacity={0.85}
                    onPress={() => handleCardPress(card)}
                    style={styles.cardWrapper}
                  >
                    {isUnclaimed ? (
                      /* RADIANT HOLOGRAPHIC GOLD SCRATCH CARD */
                      <LinearGradient
                        colors={['#D97706', '#F59E0B', '#B45309', '#92400E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.unscratchedCard}
                      >
                        {/* Diagonal foil sheen overlay */}
                        <View style={styles.foilSheenStripe} />
                        <View style={styles.cardCornerSparkle}>
                          <Icon name="sparkles" size={10} color="rgba(255, 255, 255, 0.45)" />
                        </View>

                        {/* Top floating pill badge */}
                        <View style={styles.unscratchedPill}>
                          <Icon name="sparkles" size={9} color="#78350F" />
                          <Text style={styles.unscratchedPillText}>TAP TO SCRATCH</Text>
                        </View>

                        {/* Centered Golden Medallion */}
                        <View style={styles.mysteryMedallionRing}>
                          <View style={styles.mysteryMedallionInner}>
                            <Icon name="gift" size={30} color="#FEF3C7" />
                          </View>
                        </View>

                        {/* Win amount announcement */}
                        <View style={styles.mysteryTextCol}>
                          <Text style={styles.mysteryWinLabel}>Win Coins</Text>
                        </View>

                        {/* Frosted Order Tag */}
                        <View style={styles.mysteryOrderPill}>
                          <Text style={styles.mysteryOrderText} numberOfLines={1}>
                            Order #{card.orderNumber}
                          </Text>
                        </View>
                      </LinearGradient>
                    ) : (
                      /* LUXURY CLAIMED VOUCHER CARD */
                      <View style={styles.claimedCard}>
                        <View style={styles.claimedTopRow}>
                          <View style={styles.claimedBadgeDisc}>
                            <Icon name="badge-check" size={13} color="#15803D" />
                            <Text style={styles.claimedStatusText}>WON</Text>
                          </View>
                          <Icon name="check" size={12} color="#15803D" />
                        </View>

                        <View style={styles.claimedCenter}>
                          <Text style={styles.claimedCoinsNumber}>+{card.coinsEarned}</Text>
                          <Text style={styles.claimedCoinsLabel}>Tea Coins</Text>
                          <View style={styles.claimedTagBox}>
                            <Text style={styles.claimedCashbackTag}>Credited to Wallet 🍵</Text>
                          </View>
                        </View>

                        <View style={styles.claimedFooter}>
                          <Text style={styles.claimedOrderRef} numberOfLines={1}>
                            Order #{card.orderNumber}
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* 5. INTERACTIVE SCRATCH CARD MODAL */}
        {selectedScratchCard && (
          <ScratchCardModal
            visible={modalVisible}
            onClose={() => setModalVisible(false)}
            coinsEarned={selectedScratchCard.coinsEarned}
            orderNumber={selectedScratchCard.orderNumber}
            onClaim={handleClaimReward}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  webPullIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  webPullIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139, 37, 34, 0.16)',
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
    marginVertical: 4,
  },
  webPullIndicatorText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    letterSpacing: 0.2,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  helpButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.32)',
    shadowColor: '#062D1D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  heroGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  heroBrandText: {
    color: '#FDE68A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 4,
  },
  heroCoinEmoji: {
    fontSize: 26,
  },
  heroCoinsNumber: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroCoinsCol: {
    justifyContent: 'center',
  },
  heroCoinsLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroValPill: {
    backgroundColor: '#047857',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
  },
  heroValPillText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  heroSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  heroTrophyDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTrophyGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  heroLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  segmentedContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
  },
  segmentedTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 3.5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#2D8B55',
    shadowColor: '#1A5D38',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  tabItemText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 14,
  },
  cardWrapper: {
    width: '48.2%',
    aspectRatio: 0.85,
  },
  unscratchedCard: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  foilSheenStripe: {
    position: 'absolute',
    top: -30,
    left: -40,
    width: 60,
    height: 240,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ rotate: '25deg' }],
  },
  cardCornerSparkle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  unscratchedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  unscratchedPillText: {
    color: '#78350F',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mysteryMedallionRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(253, 230, 138, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryMedallionInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryTextCol: {
    alignItems: 'center',
  },
  mysteryWinLabel: {
    color: '#FEF3C7',
    fontSize: 10.5,
    fontWeight: '700',
  },
  mysteryWinAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  mysteryOrderPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  mysteryOrderText: {
    color: '#FDE68A',
    fontSize: 9.5,
    fontWeight: '700',
  },
  claimedCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  claimedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  claimedBadgeDisc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  claimedStatusText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  claimedCenter: {
    alignItems: 'center',
  },
  claimedCoinsNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  claimedCoinsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  claimedTagBox: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  claimedCashbackTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#15803D',
  },
  claimedFooter: {
    width: '100%',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  claimedOrderRef: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyIconDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyCtaBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
