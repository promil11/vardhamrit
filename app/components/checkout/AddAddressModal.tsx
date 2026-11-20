import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../../theme';
import { Address } from '../../types';
import { Icon } from '../common/Icon';
import {
  getAccurateCoordinates,
  reverseGeocodeCoordinates,
  fetchAddressFromPincode,
  nudgeCoordinates,
} from '../../services/locationService';
import { storage } from '../../services/storage';
import { InteractiveUberMapPicker } from '../address/InteractiveUberMapPicker';

interface AddAddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveAddress: (address: Address) => void;
  initialAddress?: Address | null;
}

export const AddAddressModal: React.FC<AddAddressModalProps> = ({
  visible,
  onClose,
  onSaveAddress,
  initialAddress,
}) => {
  const flatInputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tag, setTag] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>({});
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'EXACT_PREMISE' | 'STREET_LEVEL' | 'LOCALITY' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isFetchingPincode, setIsFetchingPincode] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const user = storage.getUserSync();
      if (user?.name && !name) setName(user.name);
      if (user?.phone && !phone) setPhone(user.phone);

      const sourceAddr = initialAddress;
      if (sourceAddr) {
        if (!line2 && (sourceAddr.line2 || sourceAddr.line1)) {
          setLine2(sourceAddr.line2 || sourceAddr.line1);
        }
        if (!city && sourceAddr.city) setCity(sourceAddr.city);
        if (!state && sourceAddr.state) setState(sourceAddr.state);
        if (!pincode && sourceAddr.pincode) setPincode(sourceAddr.pincode);
        if (sourceAddr.latitude && sourceAddr.longitude) {
          setCoords({ latitude: sourceAddr.latitude, longitude: sourceAddr.longitude });
        }
      }
    }
  }, [visible, initialAddress]);

  const handleAutoDetectLocation = async () => {
    try {
      setIsLocating(true);
      setLocationSuccess(false);
      setLocationHint(null);

      const detectedCoords = await getAccurateCoordinates();
      setCoords({ latitude: detectedCoords.latitude, longitude: detectedCoords.longitude });
      setGpsAccuracy(detectedCoords.accuracy ? Math.round(detectedCoords.accuracy) : null);

      const geocoded = await reverseGeocodeCoordinates(
        detectedCoords.latitude,
        detectedCoords.longitude,
        detectedCoords.accuracy
      );

      setConfidence(geocoded.confidence || (geocoded.line1 ? 'EXACT_PREMISE' : 'STREET_LEVEL'));

      // 1. Street, Area
      if (geocoded.line2) {
        setLine2(geocoded.line2);
      }

      // 2. City, State, Pincode
      if (geocoded.city) setCity(geocoded.city);
      if (geocoded.state) setState(geocoded.state);
      if (geocoded.pincode) setPincode(geocoded.pincode);

      // 3. Landmark (if detected)
      if (geocoded.landmark) {
        setLandmark(geocoded.landmark);
      }

      // 4. Flat / House No. / Building
      if (geocoded.line1 && geocoded.line1.trim().length > 0) {
        setLine1(geocoded.line1);
        setLocationHint('🏠 House/Building & Street detected with satellite precision!');
      } else {
        // Clear any previous generic text and focus flat/house field so user can type their private flat/house number
        setLine1('');
        setLocationHint('🛣️ Street & Area pinpointed! Please enter your Flat / House No.');
        setTimeout(() => {
          flatInputRef.current?.focus();
        }, 200);
      }

      setLocationSuccess(true);
      setTimeout(() => setLocationSuccess(false), 5000);
    } catch (err: any) {
      console.warn('Auto-detect location failed:', err);
      Alert.alert(
        'GPS Location Detection',
        err.message || 'Unable to detect location. Please check your GPS permissions or enter manually.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleNudgePin = async (direction: 'north' | 'south' | 'east' | 'west') => {
    if (!coords.latitude || !coords.longitude) return;
    try {
      setIsLocating(true);
      const newCoords = nudgeCoordinates(
        { latitude: coords.latitude, longitude: coords.longitude },
        direction,
        14 // ~14 meters shift
      );
      setCoords(newCoords);

      const reGeocoded = await reverseGeocodeCoordinates(
        newCoords.latitude,
        newCoords.longitude,
        gpsAccuracy
      );

      // Preserve existing user-entered house number if available
      const homeNumber = line1 && line1.trim().length > 0 ? line1.trim() : reGeocoded.line1;
      if (homeNumber) setLine1(homeNumber);
      if (reGeocoded.line2) setLine2(reGeocoded.line2);
      if (reGeocoded.city) setCity(reGeocoded.city);
      if (reGeocoded.state) setState(reGeocoded.state);
      if (reGeocoded.pincode) setPincode(reGeocoded.pincode);
      if (reGeocoded.landmark) setLandmark(reGeocoded.landmark);
      setConfidence(reGeocoded.confidence || (homeNumber ? 'EXACT_PREMISE' : 'STREET_LEVEL'));
      setLocationHint(`📍 Pin shifted ${direction.toUpperCase()} by 14m! ${homeNumber ? homeNumber + ', ' : ''}${reGeocoded.line2 || reGeocoded.city}`);
    } catch (e) {
      console.warn('Error nudging pin:', e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleMapLocationChange = async (
    newCoords: { latitude: number; longitude: number },
    placeHint?: string,
    extractedHouseNo?: string
  ) => {
    setCoords(newCoords);

    // 1. Determine best house/flat number: keep existing or use extracted
    let homeNumber = extractedHouseNo;
    if (!homeNumber && line1 && line1.trim().length > 0) {
      homeNumber = line1.trim();
    }
    if (homeNumber) {
      setLine1(homeNumber);
    }

    try {
      setIsLocating(true);
      const geocoded = await reverseGeocodeCoordinates(
        newCoords.latitude,
        newCoords.longitude,
        gpsAccuracy
      );

      // 2. Only use geocoded.line1 if user doesn't already have a house number
      if (!homeNumber && geocoded.line1 && geocoded.line1.trim().length > 0) {
        homeNumber = geocoded.line1.trim();
        setLine1(homeNumber);
      }

      // 3. Update street/colony/area, city, state, pincode, landmark
      if (geocoded.line2) setLine2(geocoded.line2);
      if (geocoded.city) setCity(geocoded.city);
      if (geocoded.state) setState(geocoded.state);
      if (geocoded.pincode) setPincode(geocoded.pincode);
      if (geocoded.landmark) setLandmark(geocoded.landmark);

      setConfidence(geocoded.confidence || (homeNumber ? 'EXACT_PREMISE' : 'STREET_LEVEL'));

      if (homeNumber) {
        setLocationHint(`🎯 Pin set: ${homeNumber}, ${geocoded.line2 || placeHint || geocoded.city}`);
      } else {
        setLocationHint(
          placeHint
            ? `🎯 Pin set: ${placeHint}`
            : `🎯 Pin set: ${geocoded.line2 || `${newCoords.latitude.toFixed(4)}, ${newCoords.longitude.toFixed(4)}`}`
        );
      }
    } catch (e) {
      console.warn('Error reverse geocoding map location change:', e);
    } finally {
      setIsLocating(false);
    }
  };

  // Auto-fill city/state accurately based on Indian PIN code
  const handlePincodeChange = async (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 6);
    setPincode(clean);

    if (clean.length === 6) {
      setIsFetchingPincode(true);
      try {
        const result = await fetchAddressFromPincode(clean);
        if (result) {
          setCity(result.city);
          setState(result.state);
          if (result.area && !line2.trim()) {
            setLine2(result.area);
          }
        }
      } catch (e) {
        console.warn('Error fetching pincode details:', e);
      } finally {
        setIsFetchingPincode(false);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim() || !phone.trim() || !line1.trim() || pincode.length < 6) {
      Alert.alert(
        'Required Fields',
        'Please enter recipient name, 10-digit phone number, address line, and valid 6-digit PIN code.'
      );
      return;
    }

    const newAddress: Address = {
      id: `addr-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      tag,
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      landmark: landmark.trim() || undefined,
      city: city.trim() || 'Indore',
      state: state.trim() || 'Madhya Pradesh',
      pincode: pincode.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      isDefault: true,
    };

    onSaveAddress(newAddress);
    onClose();

    // Reset fields
    setName('');
    setPhone('');
    setLine1('');
    setLine2('');
    setLandmark('');
    setPincode('');
    setCity('');
    setState('');
    setCoords({});
    setGpsAccuracy(null);
    setConfidence(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Add Delivery Address</Text>
              <Text style={styles.subtitle}>Fast 48 hrs doorstep delivery</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 560 }}>
            {/* Tag Selection Chips */}
            <View style={styles.tagRow}>
              {(['HOME', 'WORK', 'OTHER'] as const).map((t) => {
                const iconName = t === 'HOME' ? 'home' : t === 'WORK' ? 'building' : 'map-pin';
                const isActive = tag === t;
                return (
                  <TouchableOpacity
                    key={t}
                    activeOpacity={0.8}
                    onPress={() => setTag(t)}
                    style={[styles.tagChip, isActive && styles.tagChipActive]}
                  >
                    <Icon
                      name={iconName}
                      size={13}
                      color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[styles.tagText, isActive && styles.tagTextActive]}>
                      {t === 'HOME' ? 'Home' : t === 'WORK' ? 'Work' : 'Other'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Uber-Style Moving Map & Location Search Picker */}
            <InteractiveUberMapPicker
              latitude={coords.latitude}
              longitude={coords.longitude}
              accuracy={gpsAccuracy}
              isLocating={isLocating}
              onRequestLocateMe={handleAutoDetectLocation}
              onLocationChange={handleMapLocationChange}
            />

            {/* 1-Tap Free & Accurate GPS Location Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAutoDetectLocation}
              disabled={isLocating}
              style={[
                styles.autoDetectBtn,
                locationSuccess && styles.autoDetectBtnSuccess,
              ]}
            >
              <View style={styles.autoDetectIconCircle}>
                {isLocating ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Icon
                    name={locationSuccess ? 'check' : 'map-pin'}
                    size={15}
                    color={locationSuccess ? '#15803D' : theme.colors.primary}
                  />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.autoDetectTitle,
                      locationSuccess && styles.autoDetectTitleSuccess,
                    ]}
                  >
                    {isLocating
                      ? 'Acquiring GPS Pinpoint Location...'
                      : locationSuccess
                        ? 'Location Auto-Detected!'
                        : 'Auto-Detect Current GPS Location'}
                  </Text>
                  <View style={styles.gpsFreeBadge}>
                    <Text style={styles.gpsFreeBadgeText}>FREE</Text>
                  </View>
                </View>
                <Text style={styles.autoDetectSub} numberOfLines={1}>
                  {locationSuccess
                    ? `${city}, ${state} ${pincode ? `(${pincode})` : ''}`
                    : 'Auto-fills street, area, city, state & pincode'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* GPS Detection Status / User Guidance Banner */}
            {locationHint ? (
              <View style={styles.hintBanner}>
                <Icon name="check" size={13} color="#15803D" />
                <Text style={styles.hintBannerText}>{locationHint}</Text>
              </View>
            ) : null}

            {/* GPS Pin Precision & Micro-Nudge Card (Swiggy/Uber style) */}
            {coords.latitude && coords.longitude ? (
              <View style={styles.pinPrecisionCard}>
                <View style={styles.pinHeaderRow}>
                  <View style={styles.pinDotWrapper}>
                    <View style={styles.pinPulseDot} />
                    <Icon name="map-pin" size={14} color="#0A3622" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.pinPrecisionTitle}>
                        GPS Pin ({coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)})
                      </Text>
                      <View style={confidence === 'EXACT_PREMISE' ? styles.premiseBadge : styles.streetBadge}>
                        <Text style={confidence === 'EXACT_PREMISE' ? styles.premiseBadgeText : styles.streetBadgeText}>
                          {confidence === 'EXACT_PREMISE' ? '🏠 House Level' : '🛣️ Street Level'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.pinAccuracyText}>
                      {gpsAccuracy ? `Accuracy: ±${gpsAccuracy}m (Satellite Fix)` : 'High-precision coordinates active'}
                    </Text>
                  </View>
                </View>

                {/* 4-way Nudge Controls */}
                <View style={styles.nudgeContainer}>
                  <Text style={styles.nudgePrompt}>
                    Slightly off indoors? Nudge pin 14m:
                  </Text>
                  <View style={styles.nudgeButtonsRow}>
                    <TouchableOpacity
                      onPress={() => handleNudgePin('north')}
                      disabled={isLocating}
                      style={styles.nudgePill}
                      activeOpacity={0.7}
                    >
                      <Icon name="arrow-up" size={11} color="#0A3622" />
                      <Text style={styles.nudgePillText}>North</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleNudgePin('south')}
                      disabled={isLocating}
                      style={styles.nudgePill}
                      activeOpacity={0.7}
                    >
                      <Icon name="arrow-down" size={11} color="#0A3622" />
                      <Text style={styles.nudgePillText}>South</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleNudgePin('west')}
                      disabled={isLocating}
                      style={styles.nudgePill}
                      activeOpacity={0.7}
                    >
                      <Icon name="arrow-left" size={11} color="#0A3622" />
                      <Text style={styles.nudgePillText}>West</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleNudgePin('east')}
                      disabled={isLocating}
                      style={styles.nudgePill}
                      activeOpacity={0.7}
                    >
                      <Icon name="arrow-right" size={11} color="#0A3622" />
                      <Text style={styles.nudgePillText}>East</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Input Fields */}
            <Text style={styles.label}>Recipient Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aarav Sharma"
              placeholderTextColor={theme.colors.textHint}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>10-Digit Mobile Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor={theme.colors.textHint}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Text style={styles.label}>Flat, House No., Building, Floor *</Text>
            <TextInput
              ref={flatInputRef}
              style={[
                styles.input,
                locationSuccess && !line1 && styles.inputNeedsAction,
              ]}
              placeholder="e.g. Flat 302, 3rd Floor, Silver Crest / House No. 14"
              placeholderTextColor={theme.colors.textHint}
              value={line1}
              onChangeText={setLine1}
            />

            <Text style={styles.label}>Street, Colony, Area *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Martand Chowk, MG Road, South Tukoganj"
              placeholderTextColor={theme.colors.textHint}
              value={line2}
              onChangeText={setLine2}
            />

            <Text style={styles.label}>Nearby Landmark (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Near Shiv Temple / Behind Apollo Pharmacy"
              placeholderTextColor={theme.colors.textHint}
              value={landmark}
              onChangeText={setLandmark}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>PIN Code *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 452009"
                  placeholderTextColor={theme.colors.textHint}
                  value={pincode}
                  onChangeText={handlePincodeChange}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.label, { marginBottom: 0 }]}>City (Auto-filled)</Text>
                  {isFetchingPincode && (
                    <ActivityIndicator size="small" color={theme.colors.primary} style={{ transform: [{ scale: 0.75 }] }} />
                  )}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Indore"
                  placeholderTextColor={theme.colors.textHint}
                  value={city}
                  onChangeText={setCity}
                  editable={true}
                />
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.85} onPress={handleSave} style={styles.saveBtn}>
              <View style={styles.saveBtnContent}>
                <Text style={styles.saveBtnText}>Save & Deliver Here</Text>
                <Icon name="arrow-right" size={16} color={theme.colors.textInverse} />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.base,
    paddingBottom: theme.spacing.xl,
    ...theme.shadows.modal,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.scale.md + 1,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md,
  },
  autoDetectBtnSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  autoDetectIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoDetectTitle: {
    fontSize: theme.typography.scale.xs + 0.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  autoDetectTitleSuccess: {
    color: '#15803D',
  },
  autoDetectSub: {
    fontSize: theme.typography.scale.xs - 1.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gpsFreeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#86EFAC',
  },
  gpsFreeBadgeText: {
    color: '#15803D',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: theme.spacing.sm,
    gap: 6,
  },
  hintBannerText: {
    color: '#15803D',
    fontSize: theme.typography.scale.xs - 0.5,
    fontWeight: '700',
    flex: 1,
  },
  inputNeedsAction: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    backgroundColor: '#FFFBEB',
  },
  pinPrecisionCard: {
    backgroundColor: '#F8FAF9',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: theme.spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinDotWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinPulseDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
  },
  pinPrecisionTitle: {
    fontSize: 12,
    fontWeight: theme.typography.weights.extraBold,
    color: '#0A3622',
  },
  pinAccuracyText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
    marginTop: 2,
  },
  premiseBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#86EFAC',
  },
  premiseBadgeText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
  },
  streetBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#FCD34D',
  },
  streetBadgeText: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '800',
  },
  nudgeContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nudgePrompt: {
    fontSize: 10.5,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600',
  },
  nudgeButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  nudgePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 5,
  },
  nudgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0A3622',
  },
  tagChip: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tagChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  tagText: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  tagTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.extraBold,
  },
  label: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 1,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm + 2,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.3,
  },
});

export default AddAddressModal;
