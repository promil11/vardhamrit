import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';
import { api } from '../../services/api';
import { socket } from '../../services/socketService';
import { Icon } from '../common/Icon';

export interface GokwikSessionData {
  sessionId: string;
  amount: number;
  currency: string;
  merchantVpa: string;
  merchantName: string;
  universalUpiUrl: string;
  appLinks: {
    gpay: string;
    phonepe: string;
    paytm: string;
    bhim: string;
    cred: string;
  };
  qrCodeDataUrl: string;
  expiresInSeconds: number;
}

interface GokwikUpiModalProps {
  visible: boolean;
  session: GokwikSessionData | null;
  onClose: () => void;
  onPaymentSuccess: (orderId: number, orderNumber: string, amount: number) => void;
}

const VPA_SUFFIX_SUGGESTIONS = ['@okaxis', '@okhdfcbank', '@paytm', '@ybl', '@icici'];

export function GokwikUpiModal({
  visible,
  session,
  onClose,
  onPaymentSuccess,
}: GokwikUpiModalProps) {
  const [activeTab, setActiveTab] = useState<'APPS' | 'QR' | 'COLLECT'>('APPS');
  const [vpaInput, setVpaInput] = useState('');
  const [vpaRequesting, setVpaRequesting] = useState(false);
  const [vpaStatusMsg, setVpaStatusMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: number; number: string; amount: number } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const pollIntervalRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Reset state when session opens
  useEffect(() => {
    if (visible && session) {
      setPaymentSuccess(false);
      setConfirmedOrder(null);
      setVpaStatusMsg(null);
      setTimeLeft(session.expiresInSeconds || 600);
    }
  }, [visible, session?.sessionId]);

  // Session Countdown Timer
  useEffect(() => {
    if (!visible || paymentSuccess) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible, paymentSuccess]);

  // Handle Successful Payment Completion
  const triggerSuccess = (orderId: number, orderNumber: string, amount: number) => {
    if (paymentSuccess) return;
    setPaymentSuccess(true);
    setConfirmedOrder({ id: orderId, number: orderNumber, amount });

    if (Platform.OS !== 'web') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch { }
    }

    // Stop polling
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    // Give user 1.2s to enjoy the success checkmark animation
    setTimeout(() => {
      onPaymentSuccess(orderId, orderNumber, amount);
    }, 1200);
  };

  // Socket & Polling for Real-Time Payment Verification
  useEffect(() => {
    if (!visible || !session?.sessionId || paymentSuccess) return;

    const currentSessionId = session.sessionId;

    // 1. Socket Listener (instant push when payment succeeds)
    const handleSessionPaid = (payload: any) => {
      if (payload?.sessionId === currentSessionId) {
        triggerSuccess(payload.orderId, payload.orderNumber, Number(payload.amount || session.amount));
      }
    };

    socket.on('gokwik.session_paid', handleSessionPaid);
    socket.on('payment.success', handleSessionPaid);

    // 2. Relaxed Polling every 8 seconds (fallback for disconnected socket)
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/payments/gokwik/session-status/${currentSessionId}`);
        if (res.data?.success && res.data?.data?.isPaid) {
          const data = res.data.data;
          triggerSuccess(data.orderId, data.orderNumber, Number(data.amount || session.amount));
        }
      } catch {
        // Silent polling catch
      }
    }, 8000);

    return () => {
      socket.off('gokwik.session_paid', handleSessionPaid);
      socket.off('payment.success', handleSessionPaid);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [visible, session?.sessionId, paymentSuccess]);

  // Format MM:SS for countdown timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Manual Status Verification
  const handleManualCheckStatus = async () => {
    if (!session?.sessionId || checkingStatus) return;
    setCheckingStatus(true);
    try {
      const res = await api.get(`/api/v1/payments/gokwik/session-status/${session.sessionId}`);
      if (res.data?.success && res.data?.data?.isPaid) {
        const data = res.data.data;
        triggerSuccess(data.orderId, data.orderNumber, Number(data.amount || session.amount));
      } else {
        Alert.alert(
          'Payment Pending',
          'Payment confirmation not received yet. If you have already paid in your UPI app, please wait a few seconds and check again.'
        );
      }
    } catch {
      Alert.alert('Status Check', 'Unable to check status right now. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // 1-Tap UPI App Launch Handler
  const handleOpenUpiApp = async (appUrl: string, appName: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    try {
      const supported = await Linking.canOpenURL(appUrl);
      if (supported) {
        await Linking.openURL(appUrl);
      } else {
        if (session?.universalUpiUrl) {
          const fallbackSupported = await Linking.canOpenURL(session.universalUpiUrl);
          if (fallbackSupported) {
            await Linking.openURL(session.universalUpiUrl);
            return;
          }
        }

        setActiveTab('QR');
        Alert.alert(
          `${appName} Not Detected`,
          `We could not directly launch ${appName}. Please scan the QR code or enter your UPI ID below.`
        );
      }
    } catch (e: any) {
      console.warn('Error launching UPI app:', e);
      if (session?.universalUpiUrl) {
        Linking.openURL(session.universalUpiUrl).catch(() => {
          setActiveTab('QR');
        });
      }
    }
  };

  // VPA Collect Request Submission
  const handleSendCollect = async () => {
    if (!vpaInput.trim() || !session?.sessionId) {
      Alert.alert('Required', 'Please enter your UPI ID (e.g. name@okhdfcbank)');
      return;
    }

    setVpaRequesting(true);
    setVpaStatusMsg(null);

    try {
      const res = await api.post('/api/v1/payments/gokwik/session-vpa-collect', {
        sessionId: session.sessionId,
        vpa: vpaInput.trim(),
      });

      if (res.data?.success) {
        setVpaStatusMsg(`Collect request sent to ${vpaInput.trim()}! Please open your UPI app and authorize the payment.`);
        if (Platform.OS !== 'web') {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch { }
        }
      }
    } catch (err: any) {
      Alert.alert('Request Failed', err?.response?.data?.error || 'Failed to send UPI collect request.');
    } finally {
      setVpaRequesting(false);
    }
  };

  // Sandbox One-Tap Success Simulator
  const handleSimulatePayment = async () => {
    if (!session?.sessionId || simulating) return;
    setSimulating(true);

    try {
      const res = await api.post('/api/v1/payments/gokwik/simulate-session-success', {
        sessionId: session.sessionId,
      });

      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        triggerSuccess(data.orderId, data.orderNumber, Number(data.amount || session.amount));
      }
    } catch (err: any) {
      Alert.alert('Simulation Error', err?.response?.data?.error || 'Failed to simulate payment.');
    } finally {
      setSimulating(false);
    }
  };

  const handleClose = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    if (session?.sessionId && !paymentSuccess) {
      api.post('/api/v1/payments/gokwik/cancel-session', { sessionId: session.sessionId }).catch(() => { });
    }

    onClose();
  };

  if (!visible || !session) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop tap to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={styles.modalSheet}>
          {/* Header Bar */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.gokwikBadge}>
                <Text style={styles.gokwikBadgeText}>GOKWIK</Text>
                <View style={styles.badgeDot} />
                <Text style={styles.gokwikBadgeSub}>100% SECURE UPI</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClose}
              style={styles.closeBtn}
            >
              <Icon name="x" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Amount & Countdown Bar */}
          <View style={styles.amountBar}>
            <View>
              <Text style={styles.amountLabel}>Total Payable Amount</Text>
              <Text style={styles.amountValue}>₹{session.amount.toFixed(2)}</Text>
            </View>

            <View style={styles.timerPill}>
              <Icon name="clock" size={12} color={theme.colors.accentGoldDark} />
              <Text style={styles.timerText}>
                {timeLeft > 0 ? `Pay within ${formatTime(timeLeft)}` : 'Session Expired'}
              </Text>
            </View>
          </View>

          {paymentSuccess ? (
            /* Celebration / Success Screen */
            <View style={styles.successBox}>
              <View style={styles.successIconCircle}>
                <Icon name="check" size={38} color="#FFFFFF" />
              </View>
              <Text style={styles.successTitle}>UPI Payment Confirmed!</Text>
              <Text style={styles.successSubtitle}>
                ₹{session.amount.toFixed(2)} paid via GoKwik UPI
                {confirmedOrder?.number ? ` • Order #${confirmedOrder.number}` : ''}
              </Text>
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
              <Text style={styles.successRedirectText}>Placing order & redirecting...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Tabs: UPI Apps | Scan QR | Enter UPI ID */}
              <View style={styles.tabsContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveTab('APPS')}
                  style={[styles.tabBtn, activeTab === 'APPS' && styles.tabBtnActive]}
                >
                  <Icon
                    name="zap"
                    size={14}
                    color={activeTab === 'APPS' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'APPS' && styles.tabBtnTextActive]}>
                    UPI Apps
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveTab('QR')}
                  style={[styles.tabBtn, activeTab === 'QR' && styles.tabBtnActive]}
                >
                  <Icon
                    name="qr-code"
                    size={14}
                    color={activeTab === 'QR' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'QR' && styles.tabBtnTextActive]}>
                    Scan QR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveTab('COLLECT')}
                  style={[styles.tabBtn, activeTab === 'COLLECT' && styles.tabBtnActive]}
                >
                  <Icon
                    name="phone"
                    size={14}
                    color={activeTab === 'COLLECT' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text style={[styles.tabBtnText, activeTab === 'COLLECT' && styles.tabBtnTextActive]}>
                    UPI ID (VPA)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: 1-TAP UPI APPS */}
              {activeTab === 'APPS' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHeading}>Choose your UPI App to Pay</Text>
                  <Text style={styles.tabSubheading}>
                    Tap to launch your app with the exact amount pre-filled
                  </Text>

                  {/* Google Pay */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenUpiApp(session.appLinks.gpay, 'Google Pay')}
                    style={styles.appCard}
                  >
                    <View style={styles.appCardInfo}>
                      <Text style={styles.appCardTitle}>Google Pay</Text>
                      <Text style={styles.appCardSub}>Instant 1-Tap UPI approval</Text>
                    </View>
                    <View style={styles.appPayPill}>
                      <Text style={styles.appPayPillText}>PAY NOW</Text>
                      <Icon name="chevron-right" size={12} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>

                  {/* PhonePe */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenUpiApp(session.appLinks.phonepe, 'PhonePe')}
                    style={styles.appCard}
                  >
                    <View style={styles.appCardInfo}>
                      <Text style={styles.appCardTitle}>PhonePe</Text>
                      <Text style={styles.appCardSub}>UPI, Wallet, Linked Bank Account</Text>
                    </View>
                    <View style={styles.appPayPill}>
                      <Text style={styles.appPayPillText}>PAY NOW</Text>
                      <Icon name="chevron-right" size={12} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>

                  {/* Paytm */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenUpiApp(session.appLinks.paytm, 'Paytm')}
                    style={styles.appCard}
                  >
                    <View style={styles.appCardInfo}>
                      <Text style={styles.appCardTitle}>Paytm UPI</Text>
                      <Text style={styles.appCardSub}>Fast & secure payments</Text>
                    </View>
                    <View style={styles.appPayPill}>
                      <Text style={styles.appPayPillText}>PAY NOW</Text>
                      <Icon name="chevron-right" size={12} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>

                  {/* BHIM / Other UPI */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenUpiApp(session.universalUpiUrl, 'BHIM / Any UPI App')}
                    style={styles.appCard}
                  >
                    <View style={styles.appCardInfo}>
                      <Text style={styles.appCardTitle}>BHIM / Other UPI App</Text>
                      <Text style={styles.appCardSub}>Cred, Navi, Jupiter, Amazon Pay</Text>
                    </View>
                    <View style={styles.appPayPill}>
                      <Text style={styles.appPayPillText}>PAY NOW</Text>
                      <Icon name="chevron-right" size={12} color={theme.colors.primary} />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 2: DYNAMIC QR CODE */}
              {activeTab === 'QR' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHeading}>Scan & Pay with Any UPI App</Text>
                  <Text style={styles.tabSubheading}>
                    Open Google Pay, PhonePe, Paytm, or BHIM and scan this QR code
                  </Text>

                  <View style={styles.qrCard}>
                    {session.qrCodeDataUrl ? (
                      <Image
                        source={{ uri: session.qrCodeDataUrl }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <ActivityIndicator size="large" color={theme.colors.primary} />
                    )}

                    <View style={styles.qrFooter}>
                      <View style={styles.qrPayeeRow}>
                        <Icon name="shield-check" size={14} color={theme.colors.primary} />
                        <Text style={styles.qrPayeeText}>
                          Paying to: <Text style={{ fontWeight: '700' }}>{session.merchantName}</Text>
                        </Text>
                      </View>
                      <Text style={styles.qrVpaText}>{session.merchantVpa}</Text>
                    </View>
                  </View>

                  <View style={styles.qrStepHint}>
                    <Text style={styles.qrStepText}>
                      💡 Screenshot this QR code or scan it directly from another device.
                    </Text>
                  </View>

                </View>
              )}

              {/* TAB 3: ENTER UPI ID (VPA COLLECT) */}
              {activeTab === 'COLLECT' && (
                <View style={styles.tabContent}>
                  <Text style={styles.tabHeading}>Enter your UPI ID / VPA</Text>
                  <Text style={styles.tabSubheading}>
                    We will send a payment notification directly to your UPI app
                  </Text>

                  <View style={styles.vpaInputWrapper}>
                    <TextInput
                      style={styles.vpaInput}
                      placeholder="e.g. mobile@paytm or name@okhdfcbank"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={vpaInput}
                      onChangeText={setVpaInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {/* Suffix Quick Chips */}
                  <View style={styles.chipsRow}>
                    {VPA_SUFFIX_SUGGESTIONS.map((suffix) => (
                      <TouchableOpacity
                        key={suffix}
                        activeOpacity={0.7}
                        onPress={() => {
                          const base = vpaInput.split('@')[0] || '';
                          setVpaInput(`${base}${suffix}`);
                        }}
                        style={styles.suffixChip}
                      >
                        <Text style={styles.suffixChipText}>{suffix}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Status Banner */}
                  {vpaStatusMsg ? (
                    <View style={styles.vpaSuccessBanner}>
                      <Icon name="check" size={14} color={theme.colors.primary} />
                      <Text style={styles.vpaSuccessText}>{vpaStatusMsg}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSendCollect}
                    disabled={vpaRequesting || !vpaInput.trim()}
                    style={[
                      styles.sendCollectBtn,
                      (!vpaInput.trim() || vpaRequesting) && { opacity: 0.6 },
                    ]}
                  >
                    <LinearGradient
                      colors={theme.colors.primaryGradient as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.sendCollectGradient}
                    >
                      {vpaRequesting ? (
                        <ActivityIndicator color={theme.colors.textInverse} />
                      ) : (
                        <Text style={styles.sendCollectBtnText}>Verify & Send Request</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Trust Footer */}
              <View style={styles.trustFooter}>
                <Icon name="shield-check" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.trustFooterText}>
                  Powered by GoKwik • Encrypted 256-bit NPCI UPI Gateway
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    ...theme.shadows.elevated,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  gokwikBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  gokwikBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  badgeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  gokwikBadgeSub: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  orderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.pill,
  },
  amountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: theme.colors.accentGold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accentGoldDark,
  },
  successBox: {
    paddingVertical: 50,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.card,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  successRedirectText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontWeight: '600',
  },
  scrollBody: {
    padding: theme.spacing.base,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.pill,
    padding: 3,
    marginBottom: theme.spacing.base,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.subtle,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  tabContent: {
    marginBottom: theme.spacing.base,
  },
  tabHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  tabSubheading: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    marginBottom: theme.spacing.md,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    marginBottom: 10,
    ...theme.shadows.subtle,
  },
  appIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appCardInfo: {
    flex: 1,
  },
  appCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  appCardSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  appPayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF5F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  appPayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.card,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.subtle,
  },
  qrImage: {
    width: 210,
    height: 210,
    borderRadius: 8,
  },
  qrFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  qrPayeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrPayeeText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  qrVpaText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  qrStepHint: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginTop: 10,
  },
  qrStepText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  vpaInputWrapper: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 10,
  },
  vpaInput: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  suffixChip: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suffixChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  vpaSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF5F0',
    padding: 10,
    borderRadius: theme.radius.sm,
    marginBottom: 12,
  },
  vpaSuccessText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSuccess,
  },
  sendCollectBtn: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
  },
  sendCollectGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCollectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textInverse,
  },
  manualCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EDF5F0',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    marginTop: 12,
  },
  manualCheckBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sandboxCard: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: theme.radius.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.base,
  },
  sandboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sandboxPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sandboxPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4A5568',
    textTransform: 'uppercase',
  },
  sandboxHint: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  simulateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
  },
  simulateBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
  },
  trustFooterText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});
