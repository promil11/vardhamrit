import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { theme } from '../../theme';
import { Icon } from '../common/Icon';
import { User } from '../../store/authContext';
import { getAvatarUrl } from '../../utils/imageUtils';
import { uploadAvatarImage } from '../../services/userClientService';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (data: {
    name: string;
    email: string;
    phone: string;
    favoriteMorningCup: string;
    avatarUrl?: string | null;
  }) => Promise<void>;
}

const MORNING_CUPS = [
  { id: 'Normal Chai', label: 'Normal Chai', tag: 'Classic' },
  { id: 'Masala Chai', label: 'Masala Chai', tag: 'Spiced' },
  { id: 'Keser Chai', label: 'Keser Chai', tag: 'Royal' },
  { id: 'Chocolate Chai', label: 'Chocolate Chai', tag: 'Rich' },
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  user,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [favoriteMorningCup, setFavoriteMorningCup] = useState('Normal Chai');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      const rawPhone = user.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const phone10 = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
      setPhone(phone10);
      setFavoriteMorningCup(user.preferred_blend || user.favorite_morning_cup || 'Normal Chai');
      setAvatarUri(user.avatar_url ? getAvatarUrl(user.avatar_url) : null);
      setAvatarBase64(null);
      setAvatarChanged(false);
      setErrorMsg(null);
    }
  }, [visible, user]);

  const handlePickAvatar = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access photos was denied.');
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
        setAvatarChanged(true);
        setErrorMsg(null);
        if (Platform.OS !== 'web') {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch { }
        }
      }
    } catch (err: any) {
      console.warn('Image picker error in modal:', err);
      setErrorMsg('Could not open image picker.');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUri(null);
    setAvatarBase64(null);
    setAvatarChanged(true);
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch { }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (name.trim().length < 2) {
      setErrorMsg('Name must be at least 2 characters.');
      return;
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
    }

    if (phone.trim() && phone.trim().length !== 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch { }
    }

    try {
      let finalAvatarUrl: string | null | undefined = undefined;

      if (avatarChanged) {
        if (avatarUri) {
          setUploadingImage(true);
          try {
            finalAvatarUrl = await uploadAvatarImage(avatarUri, avatarBase64);
          } catch (uploadErr: any) {
            console.warn('Failed to upload avatar in modal:', uploadErr);
            setErrorMsg('Failed to upload photo. Please try a different image.');
            setLoading(false);
            setUploadingImage(false);
            return;
          }
        } else {
          finalAvatarUrl = null;
        }
      }

      await onSave({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        favoriteMorningCup,
        ...(avatarChanged ? { avatarUrl: finalAvatarUrl } : {}),
      });

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { }
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  const getInitials = () => {
    if (!name.trim()) return 'VP';
    return name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <Text style={styles.headerSubtitle}>
                Manage your connoisseur account details
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
            >
              <Icon name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Avatar Row */}
            <View style={styles.avatarRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickAvatar}
                style={styles.avatarBorder}
              >
                <View style={styles.avatarInner}>
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{getInitials()}</Text>
                  )}
                  {uploadingImage && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <View style={styles.cameraIconBadge}>
                  <Icon name="camera" size={11} color="#0A3622" strokeWidth={2.4} />
                </View>
              </TouchableOpacity>

              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName}>{name || 'Your Name'}</Text>
                <View style={styles.avatarButtonsRow}>
                  <TouchableOpacity
                    onPress={handlePickAvatar}
                    activeOpacity={0.75}
                    style={styles.photoPillBtn}
                  >
                    <Icon name="upload-cloud" size={11} color="#0A3622" />
                    <Text style={styles.photoPillBtnText}>
                      {avatarUri ? 'Change Photo' : 'Upload Photo'}
                    </Text>
                  </TouchableOpacity>
                  {avatarUri ? (
                    <TouchableOpacity
                      onPress={handleRemoveAvatar}
                      activeOpacity={0.75}
                      style={styles.removePillBtn}
                    >
                      <Icon name="trash-2" size={11} color="#DC2626" />
                      <Text style={styles.removePillBtnText}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Error Message */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <Icon name="alert-triangle" size={14} color="#DC2626" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Full Name Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Icon name="user" size={16} color="#64748B" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={(t) => {
                    setName(t);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Address Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Icon name="mail" size={16} color="#64748B" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email address"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />
              </View>
            </View>

            {/* Mobile Number Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.countryBox}>
                  <Text style={{ fontSize: 13 }}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { paddingLeft: 8 }]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/[^0-9]/g, ''));
                    if (errorMsg) setErrorMsg(null);
                  }}
                />
              </View>
            </View>

            {/* Favorite Morning Cup */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Favorite Morning Cup</Text>
              <View style={styles.chipsGrid}>
                {MORNING_CUPS.map((cup) => {
                  const isSelected = favoriteMorningCup === cup.id;
                  return (
                    <TouchableOpacity
                      key={cup.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        setFavoriteMorningCup(cup.id);
                        if (Platform.OS !== 'web') {
                          try {
                            Haptics.selectionAsync();
                          } catch { }
                        }
                      }}
                      style={[
                        styles.chipBtn,
                        isSelected && styles.chipBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          isSelected && styles.chipLabelActive,
                        ]}
                      >
                        {cup.label}
                      </Text>
                      <View
                        style={[
                          styles.chipTag,
                          isSelected && styles.chipTagActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipTagText,
                            isSelected && styles.chipTagTextActive,
                          ]}
                        >
                          {cup.tag}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={styles.cancelBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={styles.saveBtn}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.saveBtnRow}>
                  <Icon name="check" size={15} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    padding: 20,
    paddingBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  avatarBorder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#D4AF37',
    padding: 2,
    marginRight: 14,
    position: 'relative',
  },
  avatarInner: {
    flex: 1,
    backgroundColor: '#0A3622',
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D4AF37',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  avatarInfo: {
    flex: 1,
  },
  avatarName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  photoPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  photoPillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A3622',
  },
  removePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removePillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  fieldIcon: {
    marginLeft: 12,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  countryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    gap: 4,
  },
  countryCode: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipBtnActive: {
    borderColor: '#0A3622',
    backgroundColor: '#F0FDF4',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipLabelActive: {
    color: '#0A3622',
    fontWeight: '700',
  },
  chipTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  chipTagActive: {
    backgroundColor: '#DCFCE7',
  },
  chipTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  chipTagTextActive: {
    color: '#166534',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0A3622',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A3622',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  saveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
