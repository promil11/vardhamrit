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
  Platform,
  KeyboardAvoidingView,
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
  const scrollViewRef = useRef<ScrollView>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tag, setTag] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [coords, setCoords] = useState<{ latitude?: number; longitude?: number }>(() => {
    const lat = initialAddress?.latitude != null ? Number(initialAddress.latitude) : undefined;
    const lon = initialAddress?.longitude != null ? Number(initialAddress.longitude) : undefined;
    if (lat && lon && !isNaN(lat) && !isNaN(lon) && lat !== 0) {
      return { latitude: lat, longitude: lon };
    }
    return {};
  });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<'EXACT_PREMISE' | 'STREET_LEVEL' | 'LOCALITY' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isFetchingPincode, setIsFetchingPincode] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showValidationBanner, setShowValidationBanner] = useState(false);

  const clearFieldError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleFieldChange = (field: string, setter: (val: string) => void) => (text: string) => {
    setter(text);
    clearFieldError(field);
  };

  useEffect(() => {
    if (visible) {
      setErrors({});
      setShowValidationBanner(false);

      if (initialAddress) {
        setName(initialAddress.name || '');
        const cleanPhone = initialAddress.phone
          ? initialAddress.phone.replace(/^\+91/, '').trim()
          : '';
        setPhone(cleanPhone);
        setTag((initialAddress.tag as 'HOME' | 'WORK' | 'OTHER') || 'HOME');
        setLine1(initialAddress.line1 || '');
        setLine2(initialAddress.line2 || '');
        setLandmark(initialAddress.landmark || '');
        setPincode(initialAddress.pincode || '');
        setCity(initialAddress.city || '');
        setState(initialAddress.state || '');
        if (initialAddress.latitude && initialAddress.longitude) {
          setCoords({
            latitude: Number(initialAddress.latitude),
            longitude: Number(initialAddress.longitude),
          });
          setLocationSuccess(true);
          setConfidence('EXACT_PREMISE');
        } else {
          setCoords({});
          setLocationSuccess(false);
          setConfidence(null);
        }
      } else {
        const user = storage.getUserSync();
        if (user?.name) setName(user.name);
        if (user?.phone) setPhone(user.phone);

        // Keep address fields completely empty by default until user taps "Auto-Detect Current GPS Location"
        setLine1('');
        setLine2('');
        setLandmark('');
        setPincode('');
        setCity('');
        setState('');
        setCoords({});
        setGpsAccuracy(null);
        setConfidence(null);
        setLocationSuccess(false);
      }
    }
  }, [visible, initialAddress]);

  const handleAutoDetectLocation = async () => {
    try {
      setIsLocating(true);
      setLocationSuccess(false);

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
        clearFieldError('line2');
      }

      // 2. City, State, Pincode
      if (geocoded.city) {
        setCity(geocoded.city);
        clearFieldError('city');
      }
      if (geocoded.state) setState(geocoded.state);
      if (geocoded.pincode) {
        setPincode(geocoded.pincode);
        clearFieldError('pincode');
      }

      // 3. Landmark (if detected)
      if (geocoded.landmark) {
        setLandmark(geocoded.landmark);
      }

      // 4. Flat / House No. / Building
      // Preserve existing user-entered custom premise if not an auto-generated placeholder
      const existingPremise =
        line1 && line1.trim().length > 0 && !isAutoGeneratedPremise(line1)
          ? line1.trim()
          : initialAddress?.line1 && initialAddress.line1.trim().length > 0 && !isAutoGeneratedPremise(initialAddress.line1)
            ? initialAddress.line1.trim()
            : undefined;

      const detectedPremise =
        existingPremise ||
        geocoded.line1 ||
        geocoded.houseNumber ||
        geocoded.building ||
        (geocoded.street ? `Building, ${geocoded.street}` : (geocoded.area ? `Plot / Building, ${geocoded.area}` : ''));
      if (detectedPremise) {
        setLine1(detectedPremise);
        clearFieldError('line1');
      } else {
        setLine1('');
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

  const isAutoGeneratedPremise = (val?: string | null) => {
    if (!val) return false;
    const trimmed = val.trim();
    return (
      trimmed.startsWith('Plot / Building') ||
      trimmed.startsWith('Building / Plot') ||
      trimmed.startsWith('House / Plot') ||
      trimmed.startsWith('Premise / Plot') ||
      trimmed.startsWith('Building,') ||
      trimmed === 'Plot / Building, Indore' ||
      trimmed === 'Plot / Building, Sukhlia'
    );
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

      const existingPremise =
        line1 && line1.trim().length > 0 && !isAutoGeneratedPremise(line1)
          ? line1.trim()
          : initialAddress?.line1 && initialAddress.line1.trim().length > 0 && !isAutoGeneratedPremise(initialAddress.line1)
            ? initialAddress.line1.trim()
            : undefined;

      const resolvedPremise =
        existingPremise ||
        reGeocoded.houseNumber ||
        reGeocoded.building ||
        reGeocoded.line1 ||
        (reGeocoded.street ? `Building, ${reGeocoded.street}` : (reGeocoded.area ? `Plot / Building, ${reGeocoded.area}` : 'Plot / Building, Indore'));
      setLine1(resolvedPremise);
      clearFieldError('line1');

      let cleanLine2 = reGeocoded.line2 || '';
      if (resolvedPremise) {
        cleanLine2 = cleanLine2
          .replace(new RegExp(`^${resolvedPremise}\\s*,?\\s*`, 'i'), '')
          .replace(new RegExp(`,\\s*${resolvedPremise}\\s*`, 'i'), '')
          .trim();
      }
      setLine2(cleanLine2 || reGeocoded.street || reGeocoded.area || reGeocoded.city || 'Indore');
      clearFieldError('line2');

      if (reGeocoded.city) setCity(reGeocoded.city);
      if (reGeocoded.state) setState(reGeocoded.state);
      if (reGeocoded.pincode) setPincode(reGeocoded.pincode);
      if (reGeocoded.landmark) setLandmark(reGeocoded.landmark);
      setConfidence(reGeocoded.confidence || (resolvedPremise ? 'EXACT_PREMISE' : 'STREET_LEVEL'));
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

    try {
      setIsLocating(true);
      const geocoded = await reverseGeocodeCoordinates(
        newCoords.latitude,
        newCoords.longitude,
        gpsAccuracy
      );

      // 1. Resolve Flat, House No., Building, Floor from the new map pin position
      // Always preserve user-entered custom house/flat details when editing or if already entered
      const existingPremise =
        line1 && line1.trim().length > 0 && !isAutoGeneratedPremise(line1)
          ? line1.trim()
          : initialAddress?.line1 && initialAddress.line1.trim().length > 0 && !isAutoGeneratedPremise(initialAddress.line1)
            ? initialAddress.line1.trim()
            : undefined;

      const resolvedPremise =
        extractedHouseNo ||
        existingPremise ||
        geocoded.houseNumber ||
        geocoded.building ||
        geocoded.line1 ||
        (geocoded.street ? `Building, ${geocoded.street}` : (geocoded.area ? `Plot / Building, ${geocoded.area}` : 'Plot / Building, Indore'));

      setLine1(resolvedPremise);
      clearFieldError('line1');

      // 2. Resolve Street, Colony, Area without repeating resolvedPremise
      let cleanLine2 = geocoded.line2 || '';
      if (resolvedPremise) {
        cleanLine2 = cleanLine2
          .replace(new RegExp(`^${resolvedPremise}\\s*,?\\s*`, 'i'), '')
          .replace(new RegExp(`,\\s*${resolvedPremise}\\s*`, 'i'), '')
          .trim();
      }
      setLine2(cleanLine2 || geocoded.street || geocoded.area || geocoded.city || 'Indore');
      clearFieldError('line2');

      // 3. Update city, state, pincode, landmark
      if (geocoded.city) {
        setCity(geocoded.city);
        clearFieldError('city');
      }
      if (geocoded.state) setState(geocoded.state);
      if (geocoded.pincode) {
        setPincode(geocoded.pincode);
        clearFieldError('pincode');
      }
      if (geocoded.landmark) setLandmark(geocoded.landmark);

      setConfidence(geocoded.confidence || (resolvedPremise ? 'EXACT_PREMISE' : 'STREET_LEVEL'));
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
    clearFieldError('pincode');

    if (clean.length === 6) {
      setIsFetchingPincode(true);
      try {
        const result = await fetchAddressFromPincode(clean);
        if (result) {
          setCity(result.city);
          clearFieldError('city');
          setState(result.state);
          if (result.area && !line2.trim()) {
            setLine2(result.area);
            clearFieldError('line2');
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
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Recipient name is mandatory';
    }

    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    const normPhone =
      cleanPhoneDigits.length === 12 && cleanPhoneDigits.startsWith('91')
        ? cleanPhoneDigits.slice(2)
        : cleanPhoneDigits.length > 10
          ? cleanPhoneDigits.slice(-10)
          : cleanPhoneDigits;

    if (!phone.trim()) {
      newErrors.phone = '10-digit mobile number is mandatory';
    } else if (normPhone.length !== 10) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    if (!line1.trim()) {
      newErrors.line1 = 'Flat / House No. / Building is mandatory';
    }

    if (!line2.trim()) {
      newErrors.line2 = 'Street, Colony, Area is mandatory';
    }

    const cleanPin = pincode.replace(/[^0-9]/g, '');
    if (!pincode.trim()) {
      newErrors.pincode = 'PIN Code is mandatory';
    } else if (cleanPin.length !== 6) {
      newErrors.pincode = 'PIN Code must be exactly 6 digits';
    }

    if (!city.trim()) {
      newErrors.city = 'City is mandatory';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShowValidationBanner(true);

      // Scroll smoothly to the first error input
      setTimeout(() => {
        if (newErrors.name) {
          scrollViewRef.current?.scrollTo({ y: 320, animated: true });
        } else if (newErrors.phone) {
          scrollViewRef.current?.scrollTo({ y: 380, animated: true });
        } else if (newErrors.line1) {
          flatInputRef.current?.focus();
          scrollViewRef.current?.scrollTo({ y: 440, animated: true });
        } else {
          scrollViewRef.current?.scrollTo({ y: 500, animated: true });
        }
      }, 50);

      if (Platform.OS !== 'web') {
        Alert.alert(
          'Mandatory Fields Required',
          'Please fill in all mandatory fields marked with * before saving.'
        );
      }
      return;
    }

    setShowValidationBanner(false);
    setErrors({});

    const formattedPhone = normPhone.length === 10 ? `+91${normPhone}` : phone.trim();

    const savedAddress: Address = {
      id: initialAddress?.id || `addr-${Date.now()}`,
      name: name.trim(),
      phone: formattedPhone,
      tag,
      line1: line1.trim(),
      line2: line2.trim() || undefined,
      landmark: landmark.trim() || undefined,
      city: city.trim() || 'Indore',
      state: state.trim() || 'Madhya Pradesh',
      pincode: pincode.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      isDefault: initialAddress ? Boolean(initialAddress.isDefault) : true,
    };

    onSaveAddress(savedAddress);
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
    setErrors({});
    setShowValidationBanner(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          style={styles.keyboardAvoid}
        >
          <View style={styles.sheetContainer}>
            {/* Elegant Top Sheet Pull Handle */}
            <View style={styles.sheetHandleWrapper}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  {initialAddress ? 'Edit Delivery Address' : 'Add Delivery Address'}
                </Text>
                <Text style={styles.subtitle}>
                  {initialAddress ? 'Update doorstep delivery details' : 'Fast 48 hrs doorstep delivery'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon name="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollContainer}
            >
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
              key={
                initialAddress
                  ? `map-edit-${initialAddress.id}-${coords.latitude ?? 'none'}-${coords.longitude ?? 'none'}`
                  : 'map-new'
              }
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
                </View>
                <Text style={styles.autoDetectSub} numberOfLines={1}>
                  {locationSuccess
                    ? `${city}, ${state} ${pincode ? `(${pincode})` : ''}`
                    : 'Auto-fills street, area, city, state & pincode'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Input Fields */}
            <View style={styles.labelRow}>
              <Text style={[styles.label, errors.name && styles.labelError]}>
                Recipient Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              {errors.name ? (
                <View style={styles.mandatoryBadge}>
                  <Icon name="alert-triangle" size={10} color="#DC2626" />
                  <Text style={styles.mandatoryBadgeText}>MANDATORY FIELD</Text>
                </View>
              ) : (
                <Text style={styles.requiredHint}></Text>
              )}
            </View>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Aarav Sharma"
              placeholderTextColor={theme.colors.textHint}
              value={name}
              onChangeText={handleFieldChange('name', setName)}
            />
            {errors.name && (
              <View style={styles.fieldErrorRow}>
                <Icon name="alert-triangle" size={12} color="#DC2626" />
                <Text style={styles.fieldErrorText}>{errors.name}</Text>
              </View>
            )}

            <View style={styles.labelRow}>
              <Text style={[styles.label, errors.phone && styles.labelError]}>
                10-Digit Mobile Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              {errors.phone ? (
                <View style={styles.mandatoryBadge}>
                  <Icon name="alert-triangle" size={10} color="#DC2626" />
                  <Text style={styles.mandatoryBadgeText}>MANDATORY FIELD</Text>
                </View>
              ) : (
                <Text style={styles.requiredHint}></Text>
              )}
            </View>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="e.g. 9876543210"
              placeholderTextColor={theme.colors.textHint}
              value={phone}
              onChangeText={handleFieldChange('phone', setPhone)}
              keyboardType="phone-pad"
              maxLength={15}
            />
            {errors.phone && (
              <View style={styles.fieldErrorRow}>
                <Icon name="alert-triangle" size={12} color="#DC2626" />
                <Text style={styles.fieldErrorText}>{errors.phone}</Text>
              </View>
            )}

            <View style={styles.labelRow}>
              <Text style={[styles.label, errors.line1 && styles.labelError]}>
                Flat, House No., Building, Floor <Text style={styles.requiredStar}>*</Text>
              </Text>
              {errors.line1 ? (
                <View style={styles.mandatoryBadge}>
                  <Icon name="alert-triangle" size={10} color="#DC2626" />
                  <Text style={styles.mandatoryBadgeText}>MANDATORY FIELD</Text>
                </View>
              ) : (
                <Text style={styles.requiredHint}></Text>
              )}
            </View>
            <TextInput
              ref={flatInputRef}
              style={[
                styles.input,
                locationSuccess && !line1 && styles.inputNeedsAction,
                errors.line1 && styles.inputError,
              ]}
              placeholder="e.g. Flat 302, 3rd Floor, Silver Crest / House No. 14"
              placeholderTextColor={theme.colors.textHint}
              value={line1}
              onChangeText={handleFieldChange('line1', setLine1)}
            />
            {errors.line1 && (
              <View style={styles.fieldErrorRow}>
                <Icon name="alert-triangle" size={12} color="#DC2626" />
                <Text style={styles.fieldErrorText}>{errors.line1}</Text>
              </View>
            )}

            <View style={styles.labelRow}>
              <Text style={[styles.label, errors.line2 && styles.labelError]}>
                Street, Colony, Area <Text style={styles.requiredStar}>*</Text>
              </Text>
              {errors.line2 ? (
                <View style={styles.mandatoryBadge}>
                  <Icon name="alert-triangle" size={10} color="#DC2626" />
                  <Text style={styles.mandatoryBadgeText}>MANDATORY FIELD</Text>
                </View>
              ) : (
                <Text style={styles.requiredHint}></Text>
              )}
            </View>
            <TextInput
              style={[styles.input, errors.line2 && styles.inputError]}
              placeholder="e.g. Martand Chowk, MG Road, South Tukoganj"
              placeholderTextColor={theme.colors.textHint}
              value={line2}
              onChangeText={handleFieldChange('line2', setLine2)}
            />
            {errors.line2 && (
              <View style={styles.fieldErrorRow}>
                <Icon name="alert-triangle" size={12} color="#DC2626" />
                <Text style={styles.fieldErrorText}>{errors.line2}</Text>
              </View>
            )}

            <View style={styles.labelRow}>
              <Text style={styles.label}>Nearby Landmark (Optional)</Text>
              <Text style={styles.optionalHint}>Optional</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g. Near Shiv Temple / Behind Apollo Pharmacy"
              placeholderTextColor={theme.colors.textHint}
              value={landmark}
              onChangeText={setLandmark}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, errors.pincode && styles.labelError]}>
                    PIN Code <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {errors.pincode && (
                    <Text style={[styles.mandatoryBadgeText, { fontSize: 8.5 }]}>REQUIRED</Text>
                  )}
                </View>
                <TextInput
                  style={[styles.input, errors.pincode && styles.inputError]}
                  placeholder="e.g. 452009"
                  placeholderTextColor={theme.colors.textHint}
                  value={pincode}
                  onChangeText={handlePincodeChange}
                  keyboardType="numeric"
                  maxLength={6}
                />
                {errors.pincode && (
                  <View style={styles.fieldErrorRow}>
                    <Icon name="alert-triangle" size={12} color="#DC2626" />
                    <Text style={styles.fieldErrorText}>{errors.pincode}</Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, errors.city && styles.labelError]}>
                    City <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {isFetchingPincode && (
                    <ActivityIndicator size="small" color={theme.colors.primary} style={{ transform: [{ scale: 0.75 }] }} />
                  )}
                </View>
                <TextInput
                  style={[styles.input, errors.city && styles.inputError]}
                  placeholder="e.g. Indore"
                  placeholderTextColor={theme.colors.textHint}
                  value={city}
                  onChangeText={handleFieldChange('city', setCity)}
                  editable={true}
                />
                {errors.city && (
                  <View style={styles.fieldErrorRow}>
                    <Icon name="alert-triangle" size={12} color="#DC2626" />
                    <Text style={styles.fieldErrorText}>{errors.city}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Prominent Mandatory Fields Validation Card */}
            {showValidationBanner && Object.keys(errors).length > 0 && (
              <View style={styles.errorBannerCard}>
                <View style={styles.errorBannerIconCircle}>
                  <Icon name="alert-triangle" size={16} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorBannerTitle}>Mandatory Fields Missing</Text>
                  <Text style={styles.errorBannerSubtitle}>
                    Please fill all mandatory fields marked with <Text style={{ color: '#DC2626', fontWeight: 'bold' }}>*</Text> to save your delivery address.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity activeOpacity={0.85} onPress={handleSave} style={styles.saveBtn}>
              <View style={styles.saveBtnContent}>
                <Text style={styles.saveBtnText}>
                  {initialAddress ? 'Update Delivery Address' : 'Save & Deliver Here'}
                </Text>
                <Icon name="arrow-right" size={16} color={theme.colors.textInverse} />
              </View>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing.base,
    paddingTop: theme.spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? 24 : theme.spacing.sm,
    height: '92%',
    maxHeight: '94%',
    display: 'flex',
    flexDirection: 'column',
    ...theme.shadows.modal,
  },
  sheetHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 2,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  scrollContainer: {
    flex: 1,
    scrollbarWidth: 'none',
  } as any,
  scrollContent: {
    paddingBottom: 100,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: theme.typography.scale.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  labelError: {
    color: '#DC2626',
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  requiredHint: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  optionalHint: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.textHint,
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mandatoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
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
    outlineWidth: 0,
    outlineStyle: 'none',
  } as any,
  inputError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
    marginBottom: 4,
  },
  fieldErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  fieldErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  errorBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md - 2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  errorBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBannerTitle: {
    fontSize: theme.typography.scale.xs + 0.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#DC2626',
  },
  errorBannerSubtitle: {
    fontSize: theme.typography.scale.xs - 1,
    color: '#B91C1C',
    marginTop: 2,
    fontWeight: theme.typography.weights.medium,
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
