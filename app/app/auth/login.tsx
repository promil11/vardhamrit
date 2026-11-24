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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Icon } from '../../components/common/Icon';
import { useAuth } from '../../store/authContext';
import { sendFirebasePhoneOtp, ConfirmationResult } from '../../lib/firebase';

export default function LoginScreen() {
  const router = useRouter();
  const {
    login,
    sendPhoneOtp,
    loginWithPhone,
    loginWithFirebasePhone,
    sendEmailOtp,
    loginWithEmailOtp,
    loginAsGuest,
  } = useAuth();

  const [authMode, setAuthMode] = useState<'email-otp' | 'otp'>('email-otp');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Email OTP states
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Phone OTP states
  const [phoneTimer, setPhoneTimer] = useState(0);
  const [devPhoneOtpHint, setDevPhoneOtpHint] = useState<string | null>(null);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);

  useEffect(() => {
    let interval: any;
    if (emailTimer > 0) {
      interval = setInterval(() => {
        setEmailTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailTimer]);

  useEffect(() => {
    let interval: any;
    if (phoneTimer > 0) {
      interval = setInterval(() => {
        setPhoneTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phoneTimer]);

  const handleSendEmailOtp = async () => {
    if (loading) return;
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      setUserNotFound(false);
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);

    try {
      const res = await sendEmailOtp(cleanEmail, 'login');
      setLoading(false);
      setEmailOtpSent(true);
      setEmailTimer(60);
    } catch (err: any) {
      setLoading(false);
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.code === 'USER_NOT_FOUND' ||
        err.message?.includes('No account found');

      if (isNotFound) {
        setUserNotFound(true);
        setErrorMsg(
          err.response?.data?.error ||
          `No account found with ${cleanEmail}. Please create an account to get started!`
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
          err.message ||
          'Failed to send email verification code. Please check your email.'
        );
      }
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.trim().length < 6) {
      setErrorMsg('Please enter the complete 6-digit verification code.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);

    try {
      await loginWithEmailOtp(email, emailOtp);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.code === 'USER_NOT_FOUND' ||
        err.message?.includes('No account found');

      if (isNotFound) {
        setUserNotFound(true);
        setEmailOtpSent(false);
        setErrorMsg(
          err.response?.data?.error ||
          `No account found with ${email}. Please create an account to get started.`
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
          err.message ||
          'Verification failed. Please check the code and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (loading) return;
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      setUserNotFound(false);
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);

    try {
      try {
        const confirmation = await sendFirebasePhoneOtp(clean);
        setFirebaseConfirmation(confirmation);
        setLoading(false);
        setOtpSent(true);
        setPhoneTimer(60);
        setOtp('');
        return;
      } catch (fbErr: any) {
        console.warn('[Firebase] Phone OTP notice:', fbErr?.code || fbErr?.message);
        // If not yet enabled in Firebase Console, proceed with backend OTP fallback:
      }

      const data = await sendPhoneOtp(clean);
      setLoading(false);
      setOtpSent(true);
      setPhoneTimer(60);
      setOtp('');
    } catch (err: any) {
      setLoading(false);
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.code === 'USER_NOT_FOUND' ||
        err.message?.includes('No account found');

      if (isNotFound) {
        setUserNotFound(true);
        setErrorMsg(
          err.response?.data?.error ||
          `No account found with +91 ${clean}. Please create an account to get started!`
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
          err.message ||
          'Failed to send verification code. Please check your number.'
        );
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);

    try {
      if (firebaseConfirmation) {
        try {
          const result = await firebaseConfirmation.confirm(otp);
          const idToken = await result.user.getIdToken();
          await loginWithFirebasePhone(phone, idToken);
          router.replace('/(tabs)');
          return;
        } catch (fbErr: any) {
          if (fbErr?.code === 'auth/invalid-verification-code') {
            setErrorMsg('Invalid verification code. Please check the SMS and try again.');
            return;
          }
          throw fbErr;
        }
      }

      await loginWithPhone(phone, otp);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.code === 'USER_NOT_FOUND';

      if (isNotFound) {
        setUserNotFound(true);
        setOtpSent(false);
        setErrorMsg(
          err.response?.data?.error ||
          'No account found with this mobile number. Please create an account.'
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
          err.message ||
          'Verification failed. Please check the code and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoQuickLogin = async () => {
    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);
    try {
      await login('customer@vardhamrit.com', 'Customer@123');
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await loginAsGuest();
      router.replace('/(tabs)');
    } catch {
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. LUXURY ESTATE HERO BANNER */}
        <LinearGradient
          colors={theme.colors.primaryGradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          {/* Logo Badge */}
          <View style={styles.logoCircle}>
            <Icon name="coffee" size={36} color="#F5B93C" />
          </View>

          <Text style={styles.brandTitle}>VARDHAMRIT</Text>
          <Text style={styles.brandSubtitle}>
            Pure Upper Assam & Himalayan Direct Harvest
          </Text>

          {/* Speed & Purity Pill */}
          <View style={styles.speedPill}>
            <Icon name="zap" size={12} color="#92400E" />
            <Text style={styles.speedText}>
              Direct Harvest • 48 hrs Delivery
            </Text>
          </View>
        </LinearGradient>

        {/* 2. MAIN LOGIN CARD */}
        <View style={styles.bodyCard}>
          {/* Mode Switcher Tabs */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              onPress={() => {
                setAuthMode('email-otp');
                setErrorMsg(null);
                setUserNotFound(false);
              }}
              style={[
                styles.tabBtn,
                authMode === 'email-otp' && styles.tabBtnActive,
              ]}
            >
              <Icon
                name="mail"
                size={13}
                color={authMode === 'email-otp' ? theme.colors.primary : '#64748B'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  authMode === 'email-otp' && styles.tabBtnTextActive,
                ]}
              >
                Email OTP
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setAuthMode('otp');
                setErrorMsg(null);
                setUserNotFound(false);
              }}
              style={[
                styles.tabBtn,
                authMode === 'otp' && styles.tabBtnActive,
              ]}
            >
              <Icon
                name="phone"
                size={13}
                color={authMode === 'otp' ? theme.colors.primary : '#64748B'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  authMode === 'otp' && styles.tabBtnTextActive,
                ]}
              >
                Mobile OTP
              </Text>
            </TouchableOpacity>
          </View>

          {/* USER NOT FOUND ALERT CARD (Dense & Simple) */}
          {userNotFound ? (
            <View style={styles.userNotFoundCard}>
              <View style={styles.userNotFoundLeft}>
                <View style={styles.userNotFoundIcon}>
                  <Icon name="alert-triangle" size={13} color="#DC2626" />
                </View>
                <View style={styles.userNotFoundTextCol}>
                  <Text style={styles.userNotFoundTitle}>Number or Email not registered</Text>
                  <Text style={styles.userNotFoundSub}>
                    Create account & get <Text style={styles.userNotFoundCoins}>25 Coins</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const clean = phone.replace(/[^0-9]/g, '');
                  router.push({
                    pathname: '/auth/register',
                    params:
                      authMode === 'otp' && clean
                        ? { phone: clean }
                        : email
                          ? { email: email.trim().toLowerCase() }
                          : {},
                  });
                }}
                style={styles.createAccountCtaBtn}
              >
                <Text style={styles.createAccountCtaText}>Sign Up</Text>
                <Icon name="arrow-right" size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Mode 1: Free Email OTP */}
          {authMode === 'email-otp' ? (
            <>
              <Text style={styles.cardHeading}>
                {emailOtpSent ? 'Verify Email Code' : 'Sign In with Email OTP'}
              </Text>
              <Text style={styles.cardSub}>
                {emailOtpSent
                  ? `Enter the 6-digit verification code sent to ${email}.`
                  : 'Fast & free login. Enter your registered email address'}
              </Text>

              {!emailOtpSent ? (
                /* Email Input */
                <View style={styles.inputWrapper}>
                  <Icon
                    name="mail"
                    size={16}
                    color="#9CA3AF"
                    style={{ marginHorizontal: 10 }}
                  />
                  <TextInput
                    style={styles.standardInput}
                    placeholder="Enter your email address"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    underlineColorAndroid="transparent"
                  />
                </View>
              ) : (
                /* 6-Digit OTP Section */
                <View style={styles.otpSection}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="••••••"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChangeText={(t) => {
                      setEmailOtp(t.replace(/[^0-9]/g, ''));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoFocus
                    underlineColorAndroid="transparent"
                  />

                  <View style={styles.otpActionRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setEmailOtpSent(false);
                        setEmailOtp('');
                        setDevOtpHint(null);
                      }}
                      style={styles.editNumberBtn}
                    >
                      <Text style={styles.editNumberText}>Change Email</Text>
                    </TouchableOpacity>

                    {emailTimer > 0 ? (
                      <Text style={styles.resendTimerText}>
                        Resend code in {emailTimer}s
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSendEmailOtp}
                        disabled={loading}
                      >
                        <Text style={styles.resendActiveText}>Resend Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Primary Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={emailOtpSent ? handleVerifyEmailOtp : handleSendEmailOtp}
                disabled={loading}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>
                      {emailOtpSent ? 'Verify & Continue' : 'Get Email OTP'}
                    </Text>
                    <Icon name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* Mode 2: Mobile OTP */
            <>
              <Text style={styles.cardHeading}>
                {otpSent ? 'Verify Mobile Code' : 'Enter Mobile Number'}
              </Text>
              <Text style={styles.cardSub}>
                {otpSent
                  ? `Enter the 6-digit verification code sent via SMS to +91 ${phone}`
                  : 'Fast & free login via Mobile OTP'}
              </Text>

              {!otpSent ? (
                /* Phone Input */
                <View style={styles.inputWrapper}>
                  <View style={styles.countryCodeBox}>
                    <Text style={{ fontSize: 16 }}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>

                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter 10-digit mobile number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/[^0-9]/g, ''));
                      if (errorMsg) setErrorMsg(null);
                      if (userNotFound) setUserNotFound(false);
                    }}
                    underlineColorAndroid="transparent"
                  />
                </View>
              ) : (
                /* 6-Digit OTP Section */
                <View style={styles.otpSection}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="••••••"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="numeric"
                    maxLength={6}
                    value={otp}
                    onChangeText={(t) => {
                      setOtp(t.replace(/[^0-9]/g, ''));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoFocus
                    underlineColorAndroid="transparent"
                  />

                  <View style={styles.otpActionRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setOtpSent(false);
                        setUserNotFound(false);
                        setOtp('');
                        setDevPhoneOtpHint(null);
                      }}
                      style={styles.editNumberBtn}
                    >
                      <Text style={styles.editNumberText}>Change Mobile Number</Text>
                    </TouchableOpacity>

                    {phoneTimer > 0 ? (
                      <Text style={styles.resendTimerText}>
                        Resend code in {phoneTimer}s
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={handleSendOtp}
                        disabled={loading}
                      >
                        <Text style={styles.resendActiveText}>Resend Code</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Primary Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>
                      {otpSent ? 'Verify & Continue' : 'Get Mobile OTP'}
                    </Text>
                    <Icon name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Invisible reCAPTCHA container for Google Firebase Phone Auth */}
          <View nativeID="recaptcha-container" id="recaptcha-container" />

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>New to Vardhamrit? </Text>
            <TouchableOpacity
              onPress={() => {
                const clean = phone.replace(/[^0-9]/g, '');
                router.push({
                  pathname: '/auth/register',
                  params:
                    authMode === 'otp' && clean
                      ? { phone: clean }
                      : email
                        ? { email: email.trim().toLowerCase() }
                        : {},
                });
              }}
            >
              <Text style={styles.registerLink}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Trust Footnote */}
          <Text style={styles.termsNotice}>
            By continuing, you agree to Vardhamrit's{' '}
            <Text style={{ fontWeight: 'bold' }}>Terms of Service</Text> &{' '}
            <Text style={{ fontWeight: 'bold' }}>Privacy Policy</Text>.
          </Text>
        </View>

        {/* 5. ESTATE PURITY TRUST BADGES */}
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
    backgroundColor: '#F8FAFC',
  },
  heroHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.88)',
    fontWeight: theme.typography.weights.medium,
    marginTop: 4,
    textAlign: 'center',
  },
  speedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    gap: 6,
    marginTop: 14,
  },
  speedText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: '#92400E',
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.semiBold,
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.extraBold,
  },
  freeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  freeBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#15803D',
  },
  devHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  devHintText: {
    fontSize: 11.5,
    color: '#0F766E',
  },
  otpActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  resendTimerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: theme.typography.weights.medium,
  },
  resendActiveText: {
    fontSize: 11.5,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    height: 48,
    marginBottom: 14,
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
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
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
  otpSection: {
    alignItems: 'center',
    marginBottom: 14,
  },
  otpInput: {
    width: '100%',
    height: 52,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    fontSize: 24,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    textAlign: 'center',
    letterSpacing: 14,
    marginBottom: 10,
    ...(Platform.OS === 'web'
      ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any)
      : {}),
  },
  editNumberBtn: {
    paddingVertical: 4,
  },
  editNumberText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  fieldGroup: {
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 5,
  },
  standardInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 13,
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
  demoLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 10,
  },
  demoBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoLoginText: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  skipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  skipText: {
    fontSize: 11.5,
    color: '#6B7280',
    fontWeight: theme.typography.weights.semiBold,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginBottom: 10,
  },
  registerPrompt: {
    fontSize: 12,
    color: '#6B7280',
  },
  registerLink: {
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

  // Dense & Simple User Not Found Card
  userNotFoundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  userNotFoundLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  userNotFoundIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNotFoundTextCol: {
    flex: 1,
  },
  userNotFoundTitle: {
    fontSize: 11.5,
    fontWeight: theme.typography.weights.bold,
    color: '#991B1B',
  },
  userNotFoundSub: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 0.5,
  },
  userNotFoundCoins: {
    fontWeight: '800',
    color: '#B45309',
  },
  createAccountCtaBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    height: 30,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  createAccountCtaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: theme.typography.weights.extraBold,
  },

  trustBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 20,
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
});
