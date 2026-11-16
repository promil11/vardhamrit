import React, { useState } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();
  const { login, sendPhoneOtp, loginWithPhone, loginAsGuest } = useAuth();

  const [authMode, setAuthMode] = useState<'otp' | 'password'>('otp');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Email / Password states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userNotFound, setUserNotFound] = useState(false);

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
      const data = await sendPhoneOtp(clean);
      setLoading(false);
      setOtpSent(true);
      setOtp(data?.data?.otp || '1234');
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
    if (otp.length < 4) {
      setErrorMsg('Please enter the 4-digit verification code.');
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

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your email/phone and password.');
      return;
    }

    setErrorMsg(null);
    setUserNotFound(false);
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      const isNotFound =
        err.response?.status === 404 ||
        err.response?.data?.code === 'USER_NOT_FOUND';

      if (isNotFound) {
        setUserNotFound(true);
        setErrorMsg(
          err.response?.data?.error ||
          'No account found with this email or mobile number. Please create an account.'
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
          'Invalid credentials. Please verify your password.'
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
                size={14}
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

            <TouchableOpacity
              onPress={() => {
                setAuthMode('password');
                setErrorMsg(null);
                setUserNotFound(false);
              }}
              style={[
                styles.tabBtn,
                authMode === 'password' && styles.tabBtnActive,
              ]}
            >
              <Icon
                name="lock"
                size={14}
                color={authMode === 'password' ? theme.colors.primary : '#64748B'}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  authMode === 'password' && styles.tabBtnTextActive,
                ]}
              >
                Password
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
                    Create account & get <Text style={styles.userNotFoundCoins}>50 Coins</Text>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const clean = phone.replace(/[^0-9]/g, '');
                  router.push({
                    pathname: '/auth/register',
                    params: clean ? { phone: clean } : {},
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

          {/* Mode 1: Mobile OTP */}
          {authMode === 'otp' ? (
            <>
              <Text style={styles.cardHeading}>
                {otpSent ? 'Verify Mobile Code' : 'Enter Mobile Number'}
              </Text>
              <Text style={styles.cardSub}>
                {otpSent
                  ? `Enter the 4-digit code sent to +91 ${phone} (Demo code: 1234)`
                  : 'Fast OTP login for instant doorstep tea orders'}
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
                /* OTP Input */
                <View style={styles.otpSection}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="1234"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={4}
                    value={otp}
                    onChangeText={(t) => {
                      setOtp(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    autoFocus
                    underlineColorAndroid="transparent"
                  />

                  <TouchableOpacity
                    onPress={() => {
                      setOtpSent(false);
                      setUserNotFound(false);
                    }}
                    style={styles.editNumberBtn}
                  >
                    <Text style={styles.editNumberText}>Change Mobile Number</Text>
                  </TouchableOpacity>
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
                      {otpSent ? 'Verify & Continue' : 'Get OTP Code'}
                    </Text>
                    <Icon name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* Mode 2: Password Login */
            <>
              <Text style={styles.cardHeading}>Account Login</Text>
              <Text style={styles.cardSub}>
                Sign in with your email or registered phone number
              </Text>

              {/* Identifier Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email or Phone</Text>
                <View style={styles.inputWrapper}>
                  <Icon
                    name="user"
                    size={16}
                    color="#9CA3AF"
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.standardInput}
                    placeholder="name@example.com or 10-digit phone"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    value={identifier}
                    onChangeText={(t) => {
                      setIdentifier(t);
                      if (errorMsg) setErrorMsg(null);
                      if (userNotFound) setUserNotFound(false);
                    }}
                    underlineColorAndroid="transparent"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Icon
                    name="lock"
                    size={16}
                    color="#9CA3AF"
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={styles.standardInput}
                    placeholder="Enter password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    underlineColorAndroid="transparent"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ paddingRight: 14 }}
                  >
                    <Icon
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={16}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Primary Action Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePasswordLogin}
                disabled={loading}
                style={styles.primaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                    <Icon name="arrow-right" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>New to Vardhamrit? </Text>
            <TouchableOpacity
              onPress={() => {
                const clean = phone.replace(/[^0-9]/g, '');
                router.push({
                  pathname: '/auth/register',
                  params: clean ? { phone: clean } : {},
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
    fontSize: 14,
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
