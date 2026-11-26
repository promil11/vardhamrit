import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { CHAI_REELS, ChaiReel } from '../../constants/chaiReels';
import { getFullImageUrl } from '../../utils/imageUtils';
import { asmrAudio } from '../../utils/asmrAudio';
import { useCartStore } from '../../store/useCartStore';
import { useResponsive } from '../../utils/responsive';

interface ChaiReelsViewerModalProps {
  visible: boolean;
  initialReelId?: string;
  onClose: () => void;
  onSelectReel?: (reel: ChaiReel) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ChaiReelsViewerModal: React.FC<ChaiReelsViewerModalProps> = ({
  visible,
  initialReelId,
  onClose,
}) => {
  const router = useRouter();
  const { isTablet } = useResponsive();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [likes, setLikes] = useState<Record<string, number>>({
    'misty-assam-harvest': 1240,
    'water-boiling-infusion': 2890,
    'velvety-milk-swirl': 3420,
    'steaming-kulhad-pour': 4150,
  });
  const [hasLiked, setHasLiked] = useState<Record<string, boolean>>({});
  const [addedToCartToast, setAddedToCartToast] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<any>(null);

  // Set initial reel index on open
  useEffect(() => {
    if (visible && initialReelId) {
      const idx = CHAI_REELS.findIndex((r) => r.id === initialReelId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [visible, initialReelId]);

  const currentReel = CHAI_REELS[currentIndex] || CHAI_REELS[0];

  // Start ASMR audio when visible & not muted
  useEffect(() => {
    if (visible && !isMuted && !isPaused) {
      asmrAudio.start(currentReel.asmrType);
    } else {
      asmrAudio.stop();
    }
    return () => {
      asmrAudio.stop();
    };
  }, [visible, currentIndex, isMuted, isPaused, currentReel.asmrType]);

  // Robust mobile video autoplay & playback synchronization
  useEffect(() => {
    if (visible && videoRef.current) {
      try {
        videoRef.current.muted = isMuted;
        videoRef.current.defaultMuted = isMuted;
        videoRef.current.playsInline = true;
        videoRef.current.setAttribute?.('playsinline', 'true');
        videoRef.current.setAttribute?.('webkit-playsinline', 'true');
        
        const playPromise = videoRef.current.play?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: any) => {
            // Autoplay with sound restricted by mobile browser policy; retry muted
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play?.().catch(() => {});
            }
          });
        }
      } catch {}
    }
  }, [visible, currentIndex, isMuted]);

  // Handle 10-second reel progress animation
  useEffect(() => {
    if (!visible) {
      progressAnim.setValue(0);
      return;
    }

    if (isPaused) {
      progressAnim.stopAnimation();
      return;
    }

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 10000,
      easing: Easing.linear,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [visible, currentIndex, isPaused]);

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setCurrentIndex((prev) => (prev + 1) % CHAI_REELS.length);
  }, []);

  const handlePrev = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setCurrentIndex((prev) => (prev === 0 ? CHAI_REELS.length - 1 : prev - 1));
  }, []);

  const toggleMute = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (videoRef.current) {
        videoRef.current.muted = nextMuted;
        if (!nextMuted) {
          videoRef.current.play?.().catch(() => {});
        }
      }
      return nextMuted;
    });
  };

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  const handleToggleLike = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.4,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    const id = currentReel.id;
    const isCurrentlyLiked = !!hasLiked[id];
    setHasLiked((prev) => ({ ...prev, [id]: !isCurrentlyLiked }));
    setLikes((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + (isCurrentlyLiked ? -1 : 1),
    }));
  };

  const handleAddToCart = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const mockProduct: any = {
      id: currentReel.productId,
      name: currentReel.productName,
      slug: currentReel.id,
      images: [currentReel.productImageUrl],
      category_id: 1,
      is_active: true,
      is_featured: true,
      variants: [
        {
          id: currentReel.productId * 10 + 1,
          label: currentReel.productWeight,
          price: currentReel.productPrice,
          mrp: Math.round(currentReel.productPrice * 1.25),
          stock: 50,
          weightGrams: 250,
        },
      ],
    };

    useCartStore.getState().addItem(mockProduct, mockProduct.variants[0]);

    setAddedToCartToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setAddedToCartToast(false));
  };

  const handleViewBlendDetails = () => {
    onClose();
    router.push({
      pathname: '/product/[id]',
      params: { id: String(currentReel.productId) },
    });
  };

  const videoUri = getFullImageUrl(currentReel.videoUrl);

  const containerWidth = isTablet ? 480 : Math.min(SCREEN_WIDTH, 520);
  const containerHeight = isTablet ? 820 : SCREEN_HEIGHT;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.backdrop}>
        <View style={[styles.reelContainer, { width: containerWidth, height: containerHeight }]}>
          {/* Background Video Player / Fallback Poster */}
          {Platform.OS === 'web' ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: '#000',
              }}
            >
              <video
                key={currentReel.id}
                ref={videoRef}
                src={videoUri}
                poster={getFullImageUrl(currentReel.posterUrl)}
                autoPlay
                playsInline
                loop
                muted={isMuted}
                preload="auto"
                controls={false}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'brightness(0.92)',
                }}
              />
            </div>
          ) : (
            <Image
              source={{ uri: getFullImageUrl(currentReel.posterUrl) }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          )}

          {/* Vignette Top & Bottom Gradients */}
          <LinearGradient
            colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.15)', 'transparent']}
            style={styles.topVignette}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
            style={styles.bottomVignette}
            pointerEvents="none"
          />

          {/* Interactive Tap Zones: Left (Prev) & Right (Next) */}
          <View style={styles.touchOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.touchLeft}
              activeOpacity={1}
              onPress={handlePrev}
            />
            <TouchableOpacity
              style={styles.touchCenter}
              activeOpacity={1}
              onPress={togglePause}
            />
            <TouchableOpacity
              style={styles.touchRight}
              activeOpacity={1}
              onPress={handleNext}
            />
          </View>

          {/* Top Segmented Story Progress Bar */}
          <View style={styles.progressBarRow}>
            {CHAI_REELS.map((reel, idx) => {
              let segmentProgress: any = 0;
              if (idx < currentIndex) {
                segmentProgress = 1;
              } else if (idx === currentIndex) {
                segmentProgress = progressAnim;
              } else {
                segmentProgress = 0;
              }

              return (
                <View key={reel.id} style={styles.progressBarTrack}>
                  {idx === currentIndex ? (
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    />
                  ) : (
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: segmentProgress === 1 ? '100%' : '0%' },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Top Header Controls */}
          <View style={styles.headerRow}>
            <View style={styles.estateBadge}>
              <Icon name="sprout" size={13} color="#10B981" />
              <View style={styles.estateBadgeTexts}>
                <Text style={styles.estateProvenanceText} numberOfLines={1}>
                  {currentReel.estateProvenance}
                </Text>
                <Text style={styles.elevationText}>{currentReel.elevation}</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Sound ASMR Toggle */}
              <TouchableOpacity
                style={[styles.iconButton, !isMuted && styles.iconButtonActive]}
                onPress={toggleMute}
                activeOpacity={0.8}
              >
                <Icon
                  name={isMuted ? 'volume-x' : 'volume-2'}
                  size={18}
                  color={!isMuted ? '#F59E0B' : '#FFFFFF'}
                />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Icon name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Floating Right Action Rail */}
          <View style={styles.rightActionRail}>
            {/* Like Reel */}
            <TouchableOpacity
              style={styles.railActionBtn}
              onPress={handleToggleLike}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Icon
                  name="heart"
                  size={24}
                  color={hasLiked[currentReel.id] ? '#EF4444' : '#FFFFFF'}
                />
              </Animated.View>
              <Text style={styles.railActionLabel}>
                {likes[currentReel.id] || 1200}
              </Text>
            </TouchableOpacity>

            {/* ASMR Indicator Wave */}
            <View style={styles.asmrIndicatorContainer}>
              <View
                style={[
                  styles.soundWavePill,
                  !isMuted && !isPaused && styles.soundWavePillActive,
                ]}
              >
                <Icon name="headphones" size={14} color="#F59E0B" />
                <Text style={styles.asmrIndicatorText}>ASMR</Text>
              </View>
            </View>
          </View>

          {/* Bottom Card / Product Drawer Overlay */}
          <View style={styles.bottomOverlay}>
            {/* Category / ASMR Badge */}
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.asmrTypeBadge,
                  { backgroundColor: `${currentReel.accentColor}26` },
                ]}
              >
                <Text
                  style={[styles.asmrTypeBadgeText, { color: currentReel.accentColor }]}
                >
                  {currentReel.badgeText}
                </Text>
              </View>
              <Text style={styles.asmrDescText}>{currentReel.asmrDescription}</Text>
            </View>

            {/* Title & Tagline */}
            <Text style={styles.reelTitle}>{currentReel.title}</Text>
            <Text style={styles.reelTagline}>{currentReel.tagline}</Text>

            {/* Tasting Notes Chips */}
            <View style={styles.tastingNotesRow}>
              {currentReel.aromaNotes.map((note, i) => (
                <View key={i} style={styles.tastingNoteChip}>
                  <Text style={styles.tastingNoteText}>✦ {note}</Text>
                </View>
              ))}
            </View>

            {/* Floating Glassmorphic Product Buy Bar */}
            <View style={styles.productBuyCard}>
              <TouchableOpacity
                style={styles.productThumbWrapper}
                onPress={handleViewBlendDetails}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: getFullImageUrl(currentReel.productImageUrl) }}
                  style={styles.productThumb}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.productInfoCol}
                onPress={handleViewBlendDetails}
                activeOpacity={0.8}
              >
                <Text style={styles.productBuyName} numberOfLines={1}>
                  {currentReel.productName}
                </Text>
                <View style={styles.productPriceRow}>
                  <Text style={styles.productBuyPrice}>₹{currentReel.productPrice}</Text>
                  <Text style={styles.productBuyWeight}>/ {currentReel.productWeight}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={handleAddToCart}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#059669', '#047857']}
                  style={styles.addToCartGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name="shopping-bag" size={15} color="#FFFFFF" />
                  <Text style={styles.addToCartBtnText}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Success Toast when Item Added to Cart */}
          {addedToCartToast && (
            <Animated.View
              style={[
                styles.toastContainer,
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
              <Icon name="check-circle" size={16} color="#10B981" />
              <Text style={styles.toastText}>Added to cart fresh!</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelContainer: {
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: Platform.OS === 'web' ? 16 : 0,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 2,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 360,
    zIndex: 2,
  },
  touchOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 220,
    flexDirection: 'row',
    zIndex: 3,
  },
  touchLeft: {
    flex: 1,
  },
  touchCenter: {
    flex: 1,
  },
  touchRight: {
    flex: 1,
  },
  progressBarRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 20,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  headerRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 62 : 34,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  estateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    maxWidth: '65%',
    gap: 6,
  },
  estateBadgeTexts: {
    flexShrink: 1,
  },
  estateProvenanceText: {
    color: '#F9FAFB',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  elevationText: {
    color: '#9CA3AF',
    fontSize: 9.5,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  iconButtonActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  rightActionRail: {
    position: 'absolute',
    right: 12,
    bottom: 220,
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  railActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
  railActionLabel: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  asmrIndicatorContainer: {
    marginTop: 6,
  },
  soundWavePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
  soundWavePillActive: {
    backgroundColor: 'rgba(245,158,11,0.25)',
    borderColor: '#F59E0B',
  },
  asmrIndicatorText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    zIndex: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  asmrTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  asmrTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  asmrDescText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '500',
  },
  reelTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reelTagline: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  tastingNotesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tastingNoteChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  tastingNoteText: {
    color: '#FEF08A',
    fontSize: 10.5,
    fontWeight: '600',
  },
  productBuyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backdropFilter: 'blur(16px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  productThumbWrapper: {
    width: 46,
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#374151',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productInfoCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  productBuyName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  productBuyPrice: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  productBuyWeight: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  addToCartBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  addToCartGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addToCartBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#10B981',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
