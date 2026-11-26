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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme';
import { useAuth } from '../../store/authContext';
import { Icon } from '../../components/common/Icon';
import { verifyInviteCode, InviteVerificationResult, uploadAvatarImage } from '../../services/userClientService';
import { sendFirebasePhoneOtp, ConfirmationResult } from '../../lib/firebase';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string; code?: string; phone?: string; email?: string }>();
  const {
    sendEmailOtp,
    loginWithEmailOtp,
    sendPhoneOtp,
    loginWithPhone,
    loginWithFirebasePhone,
  } = useAuth();

  // Registration Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState(params.email ? String(params.email).trim().toLowerCase() : '');
  const [phone, setPhone] = useState(params.phone ? String(params.phone).replace(/[^0-9]/g, '') : '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

  // OTP & Flow State
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);

  // Invite / Referral Code State
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [appliedInvite, setAppliedInvite] = useState<InviteVerificationResult | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Focus tracking for smooth web focus state without default browser black border
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const webInputNoOutline = Platform.OS === 'web' ? {
    outlineStyle: 'none' as any,
    outlineWidth: 0 as any,
    outlineColor: 'transparent' as any,
    boxShadow: 'none' as any,
    borderWidth: 0,
  } : {};

  // Countdown timer for OTP
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Auto-fill from navigation params
  useEffect(() => {
    if (params.phone && typeof params.phone === 'string') {
      setPhone(params.phone.replace(/[^0-9]/g, ''));
    }
  }, [params.phone]);

  useEffect(() => {
    if (params.email && typeof params.email === 'string') {
      setEmail(params.email.trim().toLowerCase());
    }
  }, [params.email]);

  // Auto-fill invite code from URL / params
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
      applyInviteCode(code);
    }
  }, [params.invite, params.code]);

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

  // Step 1: Send OTP for Registration
  const handleSendOtp = async () => {
    if (loading) return;

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      if (authMethod === 'email') {
        await sendEmailOtp(cleanEmail, 'register');
      } else {
        // Try Firebase OTP first on mobile, then backend fallback
        try {
          const confirmation = await sendFirebasePhoneOtp(cleanPhone);
          setFirebaseConfirmation(confirmation);
        } catch (fbErr: any) {
          console.warn('[Firebase] Phone OTP fallback to backend:', fbErr?.message);
          await sendPhoneOtp(cleanPhone, 'register');
        }
      }

      setStep('otp');
      setTimer(60);
      setOtp('');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to send verification code. Please check your details.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Create Account, then Route to Preferences
  const handleVerifyOtp = async () => {
    if (loading) return;

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      // Upload avatar if selected
      let uploadedAvatarUrl: string | undefined = undefined;
      if (avatarUri) {
        try {
          uploadedAvatarUrl = await uploadAvatarImage(avatarUri, avatarBase64);
        } catch (uploadErr) {
          console.warn('Avatar upload failed during register:', uploadErr);
        }
      }

      const activeInvite = appliedInvite ? appliedInvite.code : (inviteCodeInput.trim() || undefined);

      if (authMethod === 'email') {
        await loginWithEmailOtp(email.trim().toLowerCase(), cleanOtp, {
          name: name.trim(),
          phone: phone.trim(),
          inviteCode: activeInvite,
          avatarUrl: uploadedAvatarUrl,
          purpose: 'register',
        });
      } else {
        if (firebaseConfirmation) {
          const result = await firebaseConfirmation.confirm(cleanOtp);
          const idToken = await result.user.getIdToken();
          await loginWithFirebasePhone(phone.trim(), idToken, name.trim(), {
            email: email.trim().toLowerCase(),
            inviteCode: activeInvite,
            avatarUrl: uploadedAvatarUrl,
          });
        } else {
          await loginWithPhone(phone.trim(), cleanOtp, {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            inviteCode: activeInvite,
            avatarUrl: uploadedAvatarUrl,
            purpose: 'register',
          });
        }
      }

      // Smoothly navigate to the dedicated tea taste preference screen
      router.replace('/auth/preferences');
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Verification failed. Please check the code and try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const totalRewardCoins = appliedInvite ? 50 : 25;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* LUXURY HERO HEADER */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          <View style={styles.topBarRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => (step === 'otp' ? setStep('form') : router.back())}
              style={styles.backCircleBtn}
            >
              <Icon name="arrow-left" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.vipTagCapsule}>
              <Icon name="sparkles" size={11} color="#FDE68A" />
              <Text style={styles.vipTagText}>SIGNUP REWARD: +{totalRewardCoins} COINS</Text>
            </View>
          </View>

          <View style={styles.logoCircle}>
            <Icon name="leaf" size={32} color="#F5B93C" />
          </View>

          <Text style={styles.brandTitle}>
            {step === 'otp' ? 'Verify Account' : 'Join Vardhamrit'}
          </Text>
          <Text style={styles.brandSubtitle}>
            {step === 'otp'
              ? `Enter the 6-digit code sent to ${authMethod === 'email' ? email : '+91 ' + phone}`
              : `Unlock ${totalRewardCoins} Welcome Tea Coins & Estate-First Access`}
          </Text>
        </LinearGradient>

        {/* MAIN CARD CONTAINER */}
        <View style={styles.formCard}>
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Icon name="alert-triangle" size={15} color="#DC2626" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {step === 'form' ? (
            /* STEP 1: REGISTRATION DETAILS FORM */
            <>
              {/* Profile Avatar Photo Picker - Exact Previous UI */}
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
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'name' && styles.inputWrapperFocused,
                  ]}
                >
                  <Icon
                    name="user"
                    size={16}
                    color={focusedField === 'name' ? theme.colors.primary : '#9CA3AF'}
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={[styles.input, webInputNoOutline]}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              {/* Email Address */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'email' && styles.inputWrapperFocused,
                  ]}
                >
                  <Icon
                    name="mail"
                    size={16}
                    color={focusedField === 'email' ? theme.colors.primary : '#9CA3AF'}
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={[styles.input, webInputNoOutline]}
                    placeholder="name@example.com"
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              {/* Phone Number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    focusedField === 'phone' && styles.inputWrapperFocused,
                  ]}
                >
                  <View style={styles.countryCodeBox}>
                    <Text style={{ fontSize: 16 }}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={[styles.input, webInputNoOutline]}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/[^0-9]/g, ''));
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="phone-pad"
                    maxLength={10}
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              {/* Invite / Referral Code Field */}
              <View style={styles.inviteFieldContainer}>
                {appliedInvite ? (
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
                          25 Welcome + 25 Bonus = 50 Tea Coins (₹50)
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
                  <View>
                    <View style={styles.inviteHeaderRow}>
                      <View style={styles.inviteLabelGroup}>
                        <Text style={styles.inviteFieldLabel}>Invite / Referral Code</Text>
                        <View style={styles.inviteOptionalBadge}>
                          <Text style={styles.inviteOptionalText}>Optional</Text>
                        </View>
                      </View>
                      <View style={styles.coinsBonusPill}>
                        <Text style={styles.coinsBonusPillText}>🎁 +25 Coins</Text>
                      </View>
                    </View>

                    {/* Fixed, perfectly aligned Referral Code box */}
                    <View
                      style={[
                        styles.unifiedInputWrapper,
                        inviteCodeInput.trim().length > 0 && styles.unifiedInputWrapperActive,
                        focusedField === 'invite' && styles.unifiedInputWrapperFocused,
                      ]}
                    >
                      <Icon
                        name="ticket"
                        size={16}
                        color={focusedField === 'invite' || inviteCodeInput.trim() ? theme.colors.primary : '#94A3B8'}
                        style={{ marginLeft: 12 }}
                      />
                      <TextInput
                        style={[styles.unifiedInput, webInputNoOutline]}
                        placeholder="eg: CODE"
                        placeholderTextColor="#9CA3AF"
                        value={inviteCodeInput}
                        onChangeText={(t) => {
                          setInviteCodeInput(t.toUpperCase());
                          if (inviteError) setInviteError(null);
                        }}
                        onFocus={() => setFocusedField('invite')}
                        onBlur={() => setFocusedField(null)}
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
                        Enter a friend's code to get 25 bonus Tea Coins (₹25)
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* OTP Method Selector: Email OTP vs Mobile OTP */}
              <View style={styles.otpMethodCard}>
                <Text style={styles.otpMethodLabel}>Receive Verification Code On:</Text>
                <View style={styles.otpMethodTabs}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAuthMethod('email')}
                    style={[styles.otpTab, authMethod === 'email' && styles.otpTabActive]}
                  >
                    <Icon
                      name="mail"
                      size={14}
                      color={authMethod === 'email' ? theme.colors.primary : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.otpTabText,
                        authMethod === 'email' && styles.otpTabTextActive,
                      ]}
                    >
                      Email OTP
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setAuthMethod('phone')}
                    style={[styles.otpTab, authMethod === 'phone' && styles.otpTabActive]}
                  >
                    <Icon
                      name="phone"
                      size={14}
                      color={authMethod === 'phone' ? theme.colors.primary : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.otpTabText,
                        authMethod === 'phone' && styles.otpTabTextActive,
                      ]}
                    >
                      Mobile OTP
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendOtp}
                disabled={loading}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>
                      Send {authMethod === 'email' ? 'Email' : 'Mobile'} Verification Code
                    </Text>
                    <Icon name="arrow-right" size={15} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* STEP 2: OTP VERIFICATION STEP */
            <View style={styles.otpVerificationContainer}>
              <View style={styles.otpBadgeRow}>
                <View style={styles.otpBadgePill}>
                  <Icon
                    name={authMethod === 'email' ? 'mail' : 'phone'}
                    size={13}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.otpBadgePillText}>
                    Sent to {authMethod === 'email' ? email : `+91 ${phone}`}
                  </Text>
                </View>
              </View>

              <Text style={styles.otpInstructionTitle}>Enter 6-Digit Code</Text>
              <Text style={styles.otpInstructionSub}>
                Check your {authMethod === 'email' ? 'inbox or spam folder' : 'SMS / WhatsApp'} for the one-time code.
              </Text>

              <View
                style={[
                  styles.otpInputBox,
                  focusedField === 'otp' && styles.otpInputBoxFocused,
                ]}
              >
                <TextInput
                  style={[styles.otpInputField, webInputNoOutline]}
                  placeholder="• • • • • •"
                  placeholderTextColor="#CBD5E1"
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t.replace(/[^0-9]/g, ''));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => setFocusedField('otp')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  underlineColorAndroid="transparent"
                />
              </View>

              {/* Resend & Switch Methods */}
              <View style={styles.resendRow}>
                {timer > 0 ? (
                  <Text style={styles.timerText}>Resend code in {timer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                    <Text style={styles.resendBtnText}>Resend Code</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setAuthMethod(authMethod === 'email' ? 'phone' : 'email');
                    setStep('form');
                  }}
                  style={styles.switchMethodBtn}
                >
                  <Text style={styles.switchMethodBtnText}>
                    Try {authMethod === 'email' ? 'Mobile OTP' : 'Email OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Verify & Create Account Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleVerifyOtp}
                disabled={loading || otp.trim().length < 6}
                style={[
                  styles.primaryBtn,
                  otp.trim().length < 6 && styles.primaryBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                    <Icon name="arrow-right" size={15} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep('form')}
                style={styles.editDetailsBtn}
              >
                <Icon name="edit-2" size={13} color="#64748B" />
                <Text style={styles.editDetailsBtnText}>Change Email or Mobile</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer: Sign in link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.termsNotice}>
            By continuing, you agree to Vardhamrit's{' '}
            <Text style={{ fontWeight: 'bold' }}>Terms of Service</Text> &{' '}
            <Text style={{ fontWeight: 'bold' }}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* TRUST BADGES FOOTER */}
        <View style={styles.trustBadgesRow}>
          <View style={styles.trustBadgeItem}>
            <Icon name="leaf" size={14} color={theme.colors.primary} />
            <Text style={styles.trustBadgeText}>100% Single-Estate</Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <Icon name="zap" size={14} color="#B45309" />
            <Text style={styles.trustBadgeText}>48 hrs Fresh Pluck</Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <Icon name="lock" size={14} color="#15803D" />
            <Text style={styles.trustBadgeText}>Direct Savings</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 36,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  vipTagText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  logoCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
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
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: theme.typography.weights.medium,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  formCard: {
    marginHorizontal: 16,
    marginTop: -16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
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
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    height: 48,
    overflow: 'hidden',
  },
  inputWrapperFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    color: theme.colors.textPrimary,
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
      outlineColor: 'transparent',
      boxShadow: 'none',
    } : {}),
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    height: '100%',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  inviteFieldContainer: {
    marginBottom: 14,
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inviteLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  inviteOptionalBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  inviteOptionalText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  coinsBonusPill: {
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
    paddingLeft: 4,
    paddingRight: 6,
    overflow: 'hidden',
  },
  unifiedInputWrapperActive: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  unifiedInputWrapperFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  unifiedInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: theme.colors.textPrimary,
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
      outlineColor: 'transparent',
      boxShadow: 'none',
    } : {}),
  },
  sleekApplyBtn: {
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 14,
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
    fontSize: 12,
    fontWeight: '700',
  },
  sleekApplyBtnTextActive: {
    color: '#FFFFFF',
  },
  sleekApplyBtnTextDisabled: {
    color: '#94A3B8',
  },
  inviteHelperHint: {
    fontSize: 10.5,
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
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
  inviteAppliedVoucher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
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
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  appliedSuccessBadge: {
    backgroundColor: '#15803D',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  appliedSuccessBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appliedReferrerText: {
    fontSize: 11,
    color: '#334155',
    marginTop: 2,
  },
  appliedBonusHighlight: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 1,
  },
  appliedRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  appliedRemoveBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  otpMethodCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  otpMethodLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  otpMethodTabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  otpTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  otpTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  otpTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  otpTabTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  otpVerificationContainer: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  otpBadgeRow: {
    marginBottom: 10,
  },
  otpBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.25)',
  },
  otpBadgePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  otpInstructionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  otpInstructionSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  otpInputBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  otpInputBoxFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  otpInputField: {
    width: '100%',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 10,
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none',
      outlineWidth: 0,
      outlineColor: 'transparent',
      boxShadow: 'none',
    } : {}),
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  timerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  switchMethodBtn: {
    paddingVertical: 4,
  },
  switchMethodBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  editDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 2,
  },
  editDetailsBtnText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    fontSize: 10.5,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 15,
  },
  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  trustBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: theme.typography.weights.bold,
    color: '#4B5563',
  },
});
