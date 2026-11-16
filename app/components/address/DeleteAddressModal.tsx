import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import { Address } from '../../types';
import { Icon } from '../common/Icon';

interface DeleteAddressModalProps {
  visible: boolean;
  address: Address | null;
  onClose: () => void;
  onConfirmDelete: (address: Address) => Promise<void> | void;
  isDeleting?: boolean;
}

export const DeleteAddressModal: React.FC<DeleteAddressModalProps> = ({
  visible,
  address,
  onClose,
  onConfirmDelete,
  isDeleting = false,
}) => {
  if (!address) return null;

  const handleConfirm = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    onConfirmDelete(address);
  };

  const handleClose = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  const tagLabel = address.tag || 'HOME';
  const tagIcon =
    tagLabel === 'HOME' ? 'home' : tagLabel === 'WORK' ? 'building' : 'map-pin';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Top Close Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClose}
            disabled={isDeleting}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Luxury Danger Disc */}
          <View style={styles.iconDiscOuter}>
            <View style={styles.iconDiscInner}>
              <Icon name="trash" size={22} color="#DC2626" />
            </View>
          </View>

          {/* Title & Explainer */}
          <Text style={styles.modalTitle}>Delete Address?</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to remove this delivery location? You can re-add it at any time.
          </Text>

          {/* Address Preview Card */}
          <View style={styles.addressPreviewBox}>
            <View style={styles.previewHeaderRow}>
              <View style={styles.tagBadge}>
                <Icon name={tagIcon} size={11} color={theme.colors.primary} />
                <Text style={styles.tagBadgeText}>{tagLabel}</Text>
              </View>
              {address.isDefault ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>DEFAULT</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.previewName} numberOfLines={1}>
              {address.name}
            </Text>

            <Text style={styles.previewLine} numberOfLines={2}>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              {', '}
              {address.city} - {address.pincode}
            </Text>

            <View style={styles.previewPhoneRow}>
              <Icon name="phone" size={11} color={theme.colors.textSecondary} />
              <Text style={styles.previewPhone}>{address.phone}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleClose}
              disabled={isDeleting}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Keep Address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleConfirm}
              disabled={isDeleting}
              style={[styles.deleteConfirmBtn, isDeleting && styles.deleteConfirmBtnDisabled]}
            >
              {isDeleting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.deleteConfirmBtnText}>Deleting...</Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Icon name="trash" size={14} color="#FFFFFF" />
                  <Text style={styles.deleteConfirmBtnText}>Yes, Delete</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconDiscOuter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconDiscInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  addressPreviewBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 20,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: theme.colors.primaryBorder,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  defaultPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultPillText: {
    fontSize: 9,
    fontWeight: theme.typography.weights.extraBold,
    color: '#475569',
  },
  previewName: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  previewLine: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 15,
    marginBottom: 6,
  },
  previewPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewPhone: {
    fontSize: 10.5,
    color: theme.colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.bold,
    color: '#334155',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  deleteConfirmBtnDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: theme.typography.weights.extraBold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
