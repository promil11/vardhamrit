import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Icon } from '../common/Icon';
import { CHAI_REELS, ChaiReel } from '../../constants/chaiReels';
import { useResponsive } from '../../utils/responsive';

interface ChaiAsmrReelsRowProps {
  onSelectReel: (reel: ChaiReel) => void;
}

export const ChaiAsmrReelsRow: React.FC<ChaiAsmrReelsRowProps> = ({ onSelectReel }) => {
  const { isTablet } = useResponsive();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleCardPress = (reel: ChaiReel) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onSelectReel(reel);
  };

  const cardWidth = isTablet ? 148 : 124;
  const cardHeight = isTablet ? 218 : 188;

  return (
    <View style={styles.sectionContainer}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <View style={styles.badgeRow}>
            <Animated.View
              style={[
                styles.liveDot,
                { transform: [{ scale: pulseAnim }] },
              ]}
            />
            <Text style={styles.badgeText}>CHAI ASMR & GARDEN REELS</Text>
          </View>
          <Text style={styles.mainTitle}>Sensory Brewing & Garden Stories</Text>
          <Text style={styles.subTitle}>
            10-second micro-videos: boiling, milk swirl & misty harvest
          </Text>
        </View>

        <View style={styles.headphonesChip}>
          <Icon name="headphones" size={13} color="#D97706" />
          <Text style={styles.headphonesChipText}>Wear 🎧</Text>
        </View>
      </View>

      {/* Horizontal Story Reel Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {CHAI_REELS.map((reel) => (
          <TouchableOpacity
            key={reel.id}
            activeOpacity={0.88}
            onPress={() => handleCardPress(reel)}
            style={[styles.storyCardContainer, { width: cardWidth, height: cardHeight }]}
          >
            {/* Animated Story Gradient Ring */}
            <LinearGradient
              colors={['#10B981', '#F59E0B', '#059669']}
              style={styles.storyGradientBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.storyCardInner}>
                {/* Poster Background */}
                <Image
                  source={{ uri: reel.posterUrl }}
                  style={styles.storyPoster}
                  resizeMode="cover"
                />

                {/* Dark Contrast Vignette */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.85)']}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top Duration & Badge Pill */}
                <View style={styles.topPillRow}>
                  <View style={styles.durationPill}>
                    <Icon name="play" size={8} color="#FFFFFF" />
                    <Text style={styles.durationText}>{reel.durationLabel}</Text>
                  </View>
                </View>

                {/* Center Floating Play Icon */}
                <View style={styles.centerPlayWrapper}>
                  <View style={styles.centerPlayCircle}>
                    <Icon name="play" size={14} color="#FFFFFF" />
                  </View>
                </View>

                {/* Bottom Title & Estate */}
                <View style={styles.bottomMeta}>
                  <Text style={styles.storyTitle} numberOfLines={2}>
                    {reel.title}
                  </Text>
                  <Text style={styles.storyEstate} numberOfLines={1}>
                    {reel.badgeText}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  badgeText: {
    color: '#047857',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subTitle: {
    color: '#64748B',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  headphonesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  headphonesChipText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 12,
  },
  storyCardContainer: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  storyGradientBorder: {
    flex: 1,
    padding: 2.2,
    borderRadius: 16,
  },
  storyCardInner: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  storyPoster: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topPillRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 6,
    zIndex: 2,
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  centerPlayWrapper: {
    alignSelf: 'center',
    zIndex: 2,
  },
  centerPlayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
    backdropFilter: 'blur(8px)',
  },
  bottomMeta: {
    padding: 8,
    zIndex: 2,
  },
  storyTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 14,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyEstate: {
    color: '#A7F3D0',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
