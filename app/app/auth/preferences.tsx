import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { useAuth } from '../../store/authContext';
import { Icon } from '../../components/common/Icon';
import { updateUserTasteProfile } from '../../services/userClientService';

interface BlendOption {
  id: string;
  label: string;
  tagline: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  notes: string;
}

const TEA_BLEND_OPTIONS: BlendOption[] = [
  {
    id: 'Normal Chai',
    label: 'Normal Chai',
    tagline: 'Classic Upper Assam Kadak CTC brew',
    tag: 'Strong & Bold',
    tagColor: '#B45309',
    tagBg: '#FEF3C7',
    notes: 'Malty aroma, robust body, deep copper liquor',
  },
  {
    id: 'Masala Chai',
    label: 'Masala Chai',
    tagline: 'Hand-pounded aromatic Indian spices',
    tag: 'Spiced & Kadak',
    tagColor: '#C2410C',
    tagBg: '#FFEDD5',
    notes: 'Green cardamom, crushed ginger, cinnamon & clove',
  },
  {
    id: 'Keser Chai',
    label: 'Keser Chai',
    tagline: 'Infused with Kashmiri Mogra kesar',
    tag: 'Royal Saffron',
    tagColor: '#7C3AED',
    tagBg: '#EDE9FE',
    notes: 'Golden saffron strands, floral sweetness, luxury finish',
  },
  {
    id: 'Chocolate Chai',
    label: 'Chocolate Chai',
    tagline: 'Rich velvety cocoa & malted Assam',
    tag: 'Royal Cocoa',
    tagColor: '#92400E',
    tagBg: '#FEF3C7',
    notes: 'Artisan dark cocoa nibs with creamy morning richness',
  },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { user, updateUserProfile, setPendingPreferences } = useAuth();
  const [selectedBlend, setSelectedBlend] = useState<string>('Normal Chai');
  const [saving, setSaving] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSelectBlend = (blendId: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch { }
    }
    setSelectedBlend(blendId);
  };

  const handleSaveAndContinue = async () => {
    if (saving) return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    setSaving(true);
    try {
      await updateUserTasteProfile(selectedBlend);
      await updateUserProfile({ preferredBlend: selectedBlend } as any);
    } catch (e) {
      console.warn('Preference save notice:', e);
    } finally {
      setSaving(false);
      setPendingPreferences(false);
      // Navigate to Home Feed where the App Tour Guide starts!
      router.replace('/(tabs)');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BANNER */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          {/* Progress Pill */}
          <View style={styles.stepBadge}>
            <Icon name="sparkles" size={12} color="#FDE68A" />
            <Text style={styles.stepBadgeText}>STEP 2 OF 2 • TASTE PROFILE</Text>
          </View>

          <View style={styles.welcomeRow}>
            <Text style={styles.welcomeGreeting}>
              Welcome, {user?.name?.split(' ')[0] || 'Friend'}! 🍃
            </Text>
            <Text style={styles.heroTitle}>What's Your Morning Chai Ritual?</Text>
            <Text style={styles.heroSubtitle}>
              Select your favorite blend to personalize your garden harvest picks and unlock your 25 Welcome Tea Coins.
            </Text>
          </View>
        </LinearGradient>

        {/* MAIN SELECTION CARD */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.optionsGrid}>
            {TEA_BLEND_OPTIONS.map((item) => {
              const isSelected = selectedBlend === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.88}
                  onPress={() => handleSelectBlend(item.id)}
                  style={[
                    styles.blendCard,
                    isSelected && styles.blendCardSelected,
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.tagPill, { backgroundColor: item.tagBg }]}>
                      <Text style={[styles.tagPillText, { color: item.tagColor }]}>
                        {item.tag}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </View>

                  <Text style={styles.blendName}>{item.label}</Text>
                  <Text style={styles.blendTagline}>{item.tagline}</Text>
                  <Text style={styles.blendNotes}>✦ {item.notes}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Action Row */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSaveAndContinue}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnRow}>
                <Text style={styles.saveBtnText}>Save Preference & Start Shopping</Text>
                <Icon name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setPendingPreferences(false);
              router.replace('/(tabs)');
            }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipBtnText}>I will choose later • Skip to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  heroBanner: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 36,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    marginBottom: 14,
  },
  stepBadgeText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  welcomeRow: {
    alignItems: 'center',
  },
  welcomeGreeting: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FDE68A',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 14,
  },
  cardContainer: {
    marginHorizontal: 16,
    marginTop: -16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 30,
  },
  optionsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  blendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  blendCardSelected: {
    borderColor: '#F97316',
    backgroundColor: '#FFFBF7',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#F97316',
    backgroundColor: '#FFFFFF',
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#F97316',
  },
  blendName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  blendTagline: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  blendNotes: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
});
