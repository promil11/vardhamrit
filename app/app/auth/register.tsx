import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { useAuth } from '../../store/authContext';
import { Icon } from '../../components/common/Icon';
import { verifyInviteCode, InviteVerificationResult, uploadAvatarImage } from '../../services/userClientService';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

const MORNING_CUP_OPTIONS = [
  {
    id: 'Normal Chai',
    label: 'Normal Chai',
    tagline: 'Classic Upper Assam Kadak CTC brew',
    tag: 'Strong & Bold',
    tagColor: '#B45309',
    tagBg: '#FEF3C7',
    emoji: '☕',
  },
  {
    id: 'Masala Chai',
    label: 'Masala Chai',
    tagline: 'Hand-pounded aromatic Indian spices',
    tag: 'Spiced & Kadak',
    tagColor: '#C2410C',
    tagBg: '#FFEDD5',
    emoji: '🌶️',
  },
  {
    id: 'Keser Chai',
    label: 'Keser Chai',
    tagline: 'Infused with Kashmiri Mogra kesar',
    tag: 'Royal Saffron',
    tagColor: '#7C3AED',
    tagBg: '#EDE9FE',
    emoji: '👑',
  },
  {
    id: 'Chocolate Chai',
    label: 'Chocolate Chai',
    tagline: 'Rich velvety cocoa & malted Assam',
    tag: 'Royal Cocoa',
    tagColor: '#92400E',
    tagBg: '#FEF3C7',
    emoji: '🍫',
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string; code?: string; phone?: string; email?: string }>();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.email ? String(params.email).trim().toLowerCase() : '');
  const [phone, setPhone] = useState(params.phone ? String(params.phone).replace(/[^0-9]/g, '') : '');
  const [favoriteMorningCup, setFavoriteMorningCup] = useState<string>('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please allow photo gallery access to upload a profile picture.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAvatarUri(asset.uri);
        if (asset.base64) {
          setAvatarBase64(asset.base64);
        }
        if (Platform.OS !== 'web') {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch { }
        }
      }
    } catch (err: any) {
      console.warn('Image picker error:', err);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUri(null);
    setAvatarBase64(null);
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
  };

  // Auto-fill phone from navigation param
  useEffect(() => {
    if (params.phone && typeof params.phone === 'string') {
      setPhone(params.phone.replace(/[^0-9]/g, ''));
    }
  }, [params.phone]);

  // Auto-fill email from navigation param
  useEffect(() => {
    if (params.email && typeof params.email === 'string') {
      setEmail(params.email.trim().toLowerCase());
    }
  }, [params.email]);

  // Invite Code State
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [appliedInvite, setAppliedInvite] = useState<InviteVerificationResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Auto-fill and verify if referral code in query params (e.g. from deep link)
  useEffect(() => {
    let rawCode = params.invite || params.code;
    if (!rawCode && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const search = window.location.search;
        if (search) {
          const urlParams = new URLSearchParams(search);
          rawCode = urlParams.get('invite') || urlParams.get('code') || undefined;
        }
      } catch { }
    }
    if (rawCode && typeof rawCode === 'string') {
      const code = rawCode.trim().toUpperCase();
      setInviteCodeInput(code);
      setShowInviteInput(true);
      applyInviteCode(code);
    }
  }, [params.invite, params.code]);

  const applyInviteCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || inviteCodeInput).trim().toUpperCase();
    if (!code) {
      setInviteError('Please enter an invite code to apply.');
      return;
    }

    try {
      setVerifyingInvite(true);
      setInviteError(null);

      const result = await verifyInviteCode(code);
      if (result.valid) {
        setAppliedInvite(result);
        setInviteCodeInput(code);
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { }
        }
      } else {
        setInviteError('Invalid invite code. Please check and try again.');
      }
    } catch (err: any) {
      setInviteError(err.message || 'Invalid or expired invite code.');
      setAppliedInvite(null);
    } finally {
      setVerifyingInvite(false);
    }
  };

  const handleRemoveInvite = () => {
    setAppliedInvite(null);
    setInviteCodeInput('');
    setInviteError(null);
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setErrorMessage('Please enter either your email or phone number.');
      return;
    }
    if (!favoriteMorningCup) {
      setErrorMessage('Please select your Favorite Morning Cup to personalize your profile.');
      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch { }
      }
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    try {
      setLoading(true);
      setErrorMessage(null);

      // Upload avatar first if user selected one
      let uploadedAvatarUrl: string | undefined = undefined;
      if (avatarUri) {
        try {
          uploadedAvatarUrl = await uploadAvatarImage(avatarUri, avatarBase64);
        } catch (uploadErr) {
          console.warn('Avatar upload failed during register:', uploadErr);
        }
      }

      const activeInvite = appliedInvite ? appliedInvite.code : (inviteCodeInput.trim() || undefined);
      const res = await register(
        name.trim(),
        email.trim(),
        phone.trim(),
        activeInvite,
        favoriteMorningCup,
        uploadedAvatarUrl
      );

      if (res?.inviteBonusAwarded) {
        Alert.alert(
          '🎉 100 Tea Coins Unlocked!',
          `Welcome to Vardhamrit! You received 50 Welcome Coins + 50 Invite Bonus Coins (₹100 value) in your wallet to use on orders.`,
          [{ text: 'Start Shopping', onPress: () => router.replace('/(tabs)') }]
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Registration failed. Please check your details and try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const totalRewardCoins = appliedInvite ? 100 : 50;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. LUXURY HERO BANNER */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          {/* Top Bar with Back Button */}
          <View style={styles.topBarRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.back()}
              style={styles.backCircleBtn}
            >
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Logo Badge */}
          <View style={styles.logoCircle}>
            <Icon name="leaf" size={32} color="#F5B93C" />
          </View>

          <Text style={styles.brandTitle}>Join Vardhamrit</Text>
          <Text style={styles.brandSubtitle}>
            Unlock {totalRewardCoins} Welcome Tea Coins & Estate-First Access
          </Text>

          {/* Estate Purity Trust Badges */}
          <View style={styles.heroTrustBadgesRow}>
            <View style={styles.heroTrustBadgeItem}>
              <Icon name="leaf" size={13} color="#86EFAC" />
              <Text style={styles.heroTrustBadgeText}>100% Single-Estate</Text>
            </View>
            <View style={styles.heroTrustBadgeItem}>
              <Icon name="zap" size={13} color="#FDE68A" />
              <Text style={styles.heroTrustBadgeText}>48 hrs Fast Dispatch</Text>
            </View>
            <View style={styles.heroTrustBadgeItem}>
              <Icon name="lock" size={13} color="#86EFAC" />
              <Text style={styles.heroTrustBadgeText}>Secure Checkout</Text>
            </View>
          </View>
        </LinearGradient>

        {/* 2. REGISTRATION FORM CARD */}
        <View style={styles.bodyCard}>
          <Text style={styles.cardHeading}>Create Your Account</Text>
          <Text style={styles.cardSub}>
            Sign up in seconds to start enjoying single-estate Himalayan & Assam chai
          </Text>

          {/* Error Notice */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Avatar Photo Picker */}
          <View style={styles.avatarPickerContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handlePickAvatar}
              style={styles.avatarPickerTouchable}
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarPickedImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="user" size={32} color="#0A3622" strokeWidth={1.8} />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Icon
                    name={avatarUri ? 'edit-2' : 'camera'}
                    size={12}
                    color="#FFFFFF"
                    strokeWidth={2.2}
                  />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.avatarTextContainer}>
              <Text style={styles.avatarTitle}>Profile Picture</Text>
              <Text style={styles.avatarSubtitle}>
                {avatarUri
                  ? 'Photo selected! Tap to change or remove'
                  : 'Add a photo to personalize your profile (Optional)'}
              </Text>
              <View style={styles.avatarActionButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handlePickAvatar}
                  style={styles.avatarActionPill}
                >
                  <Icon name="upload-cloud" size={12} color="#0A3622" />
                  <Text style={styles.avatarActionPillText}>
                    {avatarUri ? 'Change Photo' : 'Upload Photo'}
                  </Text>
                </TouchableOpacity>
                {avatarUri ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleRemoveAvatar}
                    style={styles.avatarRemovePill}
                  >
                    <Icon name="trash-2" size={12} color="#DC2626" />
                    <Text style={styles.avatarRemovePillText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Icon
                name="user"
                size={16}
                color="#9CA3AF"
                style={{ marginLeft: 12 }}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (errorMessage) setErrorMessage(null);
                }}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Email Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Icon
                name="tag"
                size={16}
                color="#9CA3AF"
                style={{ marginLeft: 12 }}
              />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Phone Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.countryCodeBox}>
                <Text style={{ fontSize: 16 }}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="10-digit mobile number"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t.replace(/[^0-9]/g, ''));
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="phone-pad"
                maxLength={10}
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {/* Tea Taste Profile: Favorite Morning Cup (Mandatory) */}
          <View
            style={[
              styles.tasteCardContainer,
              errorMessage && !favoriteMorningCup && styles.tasteCardContainerError,
            ]}
          >
            <View style={styles.tasteHeaderRow}>
              <View style={styles.tasteTitleGroup}>
                <View style={styles.tasteIconBadge}>
                  <Icon name="coffee" size={15} color={theme.colors.primary} />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.tasteMainTitle}>My Tea Taste Profile</Text>
                    <Text style={styles.mandatoryAsterisk}>*</Text>
                  </View>
                  <Text style={styles.tasteSubtitle}>Choose your Favorite Morning Cup</Text>
                </View>
              </View>

              <View
                style={[
                  styles.tasteStatusBadge,
                  favoriteMorningCup ? styles.tasteStatusBadgeSelected : styles.tasteStatusBadgeRequired,
                ]}
              >
                <Icon
                  name={favoriteMorningCup ? 'badge-check' : 'alert-triangle'}
                  size={11}
                  color={favoriteMorningCup ? '#059669' : '#DC2626'}
                />
              </View>
            </View>

            {/* 2x2 Interactive Luxury Option Tiles */}
            <View style={styles.tasteGrid}>
              {MORNING_CUP_OPTIONS.map((item) => {
                const isSelected = favoriteMorningCup === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.selectionAsync();
                        } catch { }
                      }
                      setFavoriteMorningCup(item.id);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    style={[
                      styles.tasteTile,
                      isSelected && styles.tasteTileSelected,
                    ]}
                  >
                    {/* Top Row: Emoji & Selection Radio/Check */}
                    <View style={styles.tasteTileTopRow}>
                      <View
                        style={[
                          styles.tasteEmojiCircle,
                          isSelected && styles.tasteEmojiCircleSelected,
                        ]}
                      >
                        <Text>{ }</Text>
                      </View>
                      <View
                        style={[
                          styles.tasteRadioOuter,
                          isSelected && styles.tasteRadioOuterSelected,
                        ]}
                      >
                        {isSelected && (
                          <View style={styles.tasteRadioInner}>
                            <Icon name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Blend Name */}
                    <Text
                      style={[
                        styles.tasteTileLabel,
                        isSelected && styles.tasteTileLabelSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>

                    {/* Flavor Tagline */}
                    <Text
                      style={[
                        styles.tasteTileTagline,
                        isSelected && styles.tasteTileTaglineSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {item.tagline}
                    </Text>

                    {/* Specialty Pill Tag */}
                    <View
                      style={[
                        styles.tasteSpecialtyTag,
                        { backgroundColor: item.tagBg },
                        isSelected && { backgroundColor: 'rgba(10, 54, 34, 0.12)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tasteSpecialtyTagText,
                          { color: item.tagColor },
                          isSelected && { color: theme.colors.primary },
                        ]}
                      >
                        {item.tag}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {errorMessage && !favoriteMorningCup ? (
              <View style={styles.tasteValidationWarning}>
                <Icon name="alert-triangle" size={12} color="#DC2626" />
                <Text style={styles.tasteValidationWarningText}>
                  Please choose your favorite morning cup to continue
                </Text>
              </View>
            ) : null}
          </View>

          {/* ======================================================== */}
          {/* 3. PROFESSIONAL INVITE / REFERRAL CODE FIELD             */}
          {/* ======================================================== */}
          <View style={styles.inviteFieldContainer}>
            {appliedInvite ? (
              // Applied Invite Code State (Verified Voucher Card)
              <View style={styles.inviteAppliedVoucher}>
                <View style={styles.appliedVoucherLeft}>
                  <View style={styles.appliedCheckCircle}>
                    <Icon name="badge-check" size={16} color="#15803D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.appliedCodeRow}>
                      <Text style={styles.appliedCodeTitle}>{appliedInvite.code}</Text>
                      <View style={styles.appliedSuccessBadge}>
                        <Text style={styles.appliedSuccessBadgeText}>APPLIED</Text>
                      </View>
                    </View>
                    <Text style={styles.appliedReferrerText}>
                      Invited by <Text style={{ fontWeight: '700' }}>{appliedInvite.referrerName}</Text>
                    </Text>
                    <Text style={styles.appliedBonusHighlight}>
                      50 Welcome + 50 Bonus = 100 Tea Coins (₹100)
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleRemoveInvite}
                  style={styles.appliedRemoveBtn}
                  activeOpacity={0.7}
                >
                  <Icon name="x" size={13} color="#64748B" />
                  <Text style={styles.appliedRemoveBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Clean Professional Input Row (Unapplied)
              <View>
                <View style={styles.inviteHeaderRow}>
                  <View style={styles.inviteLabelGroup}>
                    <Text style={styles.inviteFieldLabel}>Invite / Referral Code</Text>
                    <View style={styles.inviteOptionalBadge}>
                      <Text style={styles.inviteOptionalText}>Optional</Text>
                    </View>
                  </View>
                  <View style={styles.coinsBonusPill}>
                    <Text style={styles.coinsBonusPillText}>🎁 +50 Coins</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.unifiedInputWrapper,
                    inviteCodeInput.trim().length > 0 && styles.unifiedInputWrapperActive,
                  ]}
                >
                  <Icon
                    name="ticket"
                    size={16}
                    color={inviteCodeInput.trim() ? theme.colors.primary : '#94A3B8'}
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.unifiedInput}
                    placeholder="eg: CODE"
                    placeholderTextColor="#94A3B8"
                    value={inviteCodeInput}
                    onChangeText={(t) => {
                      setInviteCodeInput(t.toUpperCase());
                      if (inviteError) setInviteError(null);
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => applyInviteCode()}
                    disabled={verifyingInvite || !inviteCodeInput.trim()}
                    style={[
                      styles.sleekApplyBtn,
                      inviteCodeInput.trim()
                        ? styles.sleekApplyBtnActive
                        : styles.sleekApplyBtnDisabled,
                    ]}
                  >
                    {verifyingInvite ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={[
                          styles.sleekApplyBtnText,
                          inviteCodeInput.trim()
                            ? styles.sleekApplyBtnTextActive
                            : styles.sleekApplyBtnTextDisabled,
                        ]}
                      >
                        Apply
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {inviteError ? (
                  <View style={styles.inviteErrorRow}>
                    <Icon name="alert-triangle" size={12} color="#DC2626" />
                    <Text style={styles.inviteErrorText}>{inviteError}</Text>
                  </View>
                ) : (
                  <Text style={styles.inviteHelperHint}>
                    Enter a friend's code to get 50 bonus Tea Coins (₹50)
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleRegister}
            disabled={loading}
            style={styles.primaryBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContentRow}>
                <Text style={styles.primaryBtnText}>
                  {appliedInvite ? 'Create Account & Claim 100 Coins' : 'Create Free Account'}
                </Text>
                <Icon name="arrow-right" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Back to Sign In Link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.termsNotice}>
            By signing up, you agree to Vardhamrit's{' '}
            <Text style={{ fontWeight: 'bold' }}>Terms of Service</Text> &{' '}
            <Text style={{ fontWeight: 'bold' }}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* 4. TRUST FOOTER */}
        <View style={styles.trustBadgesRow}>
          <View style={styles.trustBadgeItem}>
            <Icon name="leaf" size={14} color={theme.colors.primary} />
            <Text style={styles.trustBadgeText}>100% Single-Estate</Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <Icon name="zap" size={14} color="#B45309" />
            <Text style={styles.trustBadgeText}>48 hrs Fast Dispatch</Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <Icon name="lock" size={14} color="#15803D" />
            <Text style={styles.trustBadgeText}>Secure Checkout</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 38,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBarRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipTagCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  vipTagText: {
    fontSize: 8.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  logoCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: theme.typography.weights.medium,
    marginTop: 3,
    textAlign: 'center',
  },
  heroTrustBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  heroTrustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroTrustBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  bodyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: -22,
    padding: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: theme.typography.weights.medium,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 46,
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any)
      : {}),
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    gap: 4,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    height: '100%',
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
      } as any)
      : {}),
  },

  // Professional Invite Code Styles
  inviteFieldContainer: {
    marginBottom: 14,
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  inviteLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteFieldLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  inviteOptionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  inviteOptionalText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  coinsBonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  coinsBonusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  unifiedInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 48,
    paddingRight: 6,
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any)
      : {}),
  },
  unifiedInputWrapperActive: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  unifiedInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.textPrimary,
    height: '100%',
    borderWidth: 0,
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
      } as any)
      : {}),
  },
  sleekApplyBtn: {
    height: 36,
    borderRadius: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleekApplyBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  sleekApplyBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  sleekApplyBtnText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.extraBold,
  },
  sleekApplyBtnTextActive: {
    color: '#FFFFFF',
  },
  sleekApplyBtnTextDisabled: {
    color: '#94A3B8',
  },
  inviteHelperHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 5,
  },
  inviteErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  inviteErrorText: {
    fontSize: 10.5,
    color: '#DC2626',
    fontWeight: theme.typography.weights.medium,
  },

  // Applied Voucher Styles
  inviteAppliedVoucher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 12,
  },
  appliedVoucherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  appliedCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appliedCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedCodeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#166534',
  },
  appliedSuccessBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  appliedSuccessBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.6,
  },
  appliedReferrerText: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  appliedBonusHighlight: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 2,
  },
  appliedRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  appliedRemoveBtnText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },

  tasteCardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tasteCardContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  tasteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tasteTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tasteIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2ECE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteMainTitle: {
    fontSize: 13,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  mandatoryAsterisk: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
  },
  tasteSubtitle: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  tasteStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  tasteStatusBadgeRequired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  tasteStatusBadgeSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tasteStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tasteStatusBadgeTextRequired: {
    color: '#DC2626',
  },
  tasteStatusBadgeTextSelected: {
    color: '#059669',
  },
  tasteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  tasteTile: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 11,
    justifyContent: 'space-between',
    minHeight: 126,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  tasteTileSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  tasteTileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tasteEmojiCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteEmojiCircleSelected: {
    backgroundColor: '#fff',
  },
  tasteEmoji: {
    fontSize: 14,
  },
  tasteRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tasteRadioOuterSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  tasteRadioInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasteTileLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  tasteTileLabelSelected: {
    color: theme.colors.primary,
  },
  tasteTileTagline: {
    fontSize: 9.5,
    color: theme.colors.textSecondary,
    lineHeight: 13,
    marginBottom: 8,
  },
  tasteTileTaglineSelected: {
    color: '#166534',
  },
  tasteSpecialtyTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tasteSpecialtyTagText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tasteValidationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  tasteValidationWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginBottom: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  termsNotice: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 14,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  trustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: '#4B5563',
  },
  avatarPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF9',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 14,
  },
  avatarPickerTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 2.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarPickedImage: {
    width: 69,
    height: 69,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    width: 69,
    height: 69,
    borderRadius: 35,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#0A3622',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextContainer: {
    flex: 1,
  },
  avatarTitle: {
    fontSize: 13.5,
    fontWeight: theme.typography.weights.bold,
    color: '#111827',
    marginBottom: 2,
  },
  avatarSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
    marginBottom: 8,
  },
  avatarActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  avatarActionPillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#0A3622',
  },
  avatarRemovePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  avatarRemovePillText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#DC2626',
  },
});
