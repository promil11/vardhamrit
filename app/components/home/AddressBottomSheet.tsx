import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../../theme';
import { BottomSheetWrapper } from '../common/BottomSheetWrapper';
import { Address } from '../../types';
import { fetchUserAddresses, saveUserAddress, removeUserAddress } from '../../services/addressService';
import { fetchCurrentLocationAddress, formatHeaderAddress } from '../../services/locationService';
import { DeleteAddressModal } from '../address/DeleteAddressModal';
import { AddAddressModal } from '../checkout/AddAddressModal';
import { Icon } from '../common/Icon';
import { Skeleton } from '../common/Skeleton';
import { useAddressStore } from '../../store/useAddressStore';

interface AddressBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedAddressId: string | number;
  onSelectAddress: (address: Address) => void;
  onAddNewPress?: () => void;
  onEditAddress?: (address: Address) => void;
  addresses?: Address[];
  onRefreshAddresses?: () => void;
}

export const AddressBottomSheet: React.FC<AddressBottomSheetProps> = ({
  visible,
  onClose,
  selectedAddressId,
  onSelectAddress,
  onAddNewPress,
  onEditAddress,
  addresses: propAddresses,
  onRefreshAddresses,
}) => {
  const {
    addresses: storeAddresses,
    selectedAddress,
    loadAddresses: storeLoadAddresses,
    setSelectedAddress: storeSetSelectedAddress,
    deleteAddress: storeDeleteAddress,
    addNewAddress: storeAddNewAddress,
    updateAddress: storeUpdateAddress,
    autoDetectLocation,
  } = useAddressStore();

  const [internalAddresses, setInternalAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingStatus, setLocatingStatus] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [internalEditModalVisible, setInternalEditModalVisible] = useState(false);

  const promptDeleteAddress = (addr: Address) => {
    setAddressToDelete(addr);
    setDeleteModalVisible(true);
  };

  const confirmDeleteAddress = async (addr: Address) => {
    try {
      setIsDeletingAddress(true);
      await storeDeleteAddress(addr.id);
      setInternalAddresses((prev) => prev.filter((a) => String(a.id) !== String(addr.id)));
      onRefreshAddresses?.();
    } catch (e) {
      console.warn('Error deleting address from sheet:', e);
    } finally {
      setIsDeletingAddress(false);
      setDeleteModalVisible(false);
      setAddressToDelete(null);
    }
  };

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const realAddrs = await storeLoadAddresses();
      setInternalAddresses(realAddrs || []);
    } catch (e) {
      console.warn('Error fetching addresses from database in bottom sheet:', e);
      setInternalAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadAddresses();
    }
  }, [visible]);

  const isGpsActive = Boolean(
    selectedAddress &&
    (selectedAddress.tag === 'Current Location' || String(selectedAddress.id).startsWith('gps-'))
  );

  const displayAddresses =
    propAddresses !== undefined && propAddresses.length > 0
      ? propAddresses
      : storeAddresses.length > 0
        ? storeAddresses
        : internalAddresses;

  const handleUseCurrentLocation = async () => {
    try {
      setIsLocating(true);
      setLocatingStatus('Acquiring high-accuracy GPS fix...');

      const detected = await autoDetectLocation(true);
      if (detected) {
        onSelectAddress(detected);
        setLocatingStatus(`Detected: ${detected.line1}, ${detected.city}`);
      }

      setTimeout(() => {
        setIsLocating(false);
        setLocatingStatus(null);
        onClose();
      }, 450);
    } catch (err: any) {
      console.warn('GPS location fetch error:', err);
      setIsLocating(false);
      setLocatingStatus(null);
      Alert.alert(
        'Location Access',
        err.message || 'Unable to fetch current GPS location. Please ensure location services are enabled.'
      );
    }
  };

  return (
    <BottomSheetWrapper
      visible={visible}
      onClose={onClose}
      title="Choose Delivery Location"
      subtitle="Fresh tea delivered in 48 hrs"
    >
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
        {/* Quick GPS Location Row */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.gpsRow,
            (isLocating || isGpsActive) && styles.gpsRowActive,
            isGpsActive && styles.gpsRowSelected,
          ]}
          onPress={handleUseCurrentLocation}
          disabled={isLocating}
        >
          <View style={styles.gpsIconCircle}>
            {isLocating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Icon name="map-pin" size={18} color={theme.colors.primary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.gpsTitle}>Use Current Location</Text>
              {isGpsActive ? (
                <View style={styles.gpsActiveBadge}>
                  <Text style={styles.gpsActiveBadgeText}>ACTIVE</Text>
                </View>
              ) : (
                <View style={styles.gpsFreeBadge}>
                  <Text style={styles.gpsFreeBadgeText}>GPS</Text>
                </View>
              )}
            </View>
            <Text style={styles.gpsSub} numberOfLines={1}>
              {locatingStatus
                ? locatingStatus
                : isGpsActive && selectedAddress
                  ? `${formatHeaderAddress(selectedAddress)} • Tap to refresh`
                  : 'Tap to auto-detect your location via GPS'}
            </Text>
          </View>
          {isGpsActive ? (
            <View style={[styles.radioCircle, styles.radioCircleActive]}>
              <View style={styles.radioDot} />
            </View>
          ) : (
            <Icon name="chevron-right" size={18} color={theme.colors.primary} />
          )}
        </TouchableOpacity>

        <View style={styles.divider} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <Text style={styles.sectionHeader}>SAVED ADDRESSES ({displayAddresses.length})</Text>
          {loading && <ActivityIndicator size="small" color={theme.colors.primary} />}
        </View>

        {/* Address Cards */}
        <View style={styles.addressList}>
          {loading ? (
            <View style={{ gap: 10 }}>
              {[1, 2].map((i) => (
                <View key={i} style={[styles.addressCard, { padding: 14 }]}>
                  <Skeleton width={20} height={20} borderRadius={10} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Skeleton width={70} height={16} />
                    <Skeleton width="90%" height={14} style={{ marginTop: 6 }} />
                    <Skeleton width="50%" height={12} style={{ marginTop: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : displayAddresses.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Icon name="map-pin" size={32} color="#9CA3AF" />
              <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280', fontWeight: '500' }}>
                No saved addresses found
              </Text>
            </View>
          ) : (
            displayAddresses.map((addr) => {
              const isSelected = !isGpsActive && String(addr.id) === String(selectedAddressId);
              return (
                <TouchableOpacity
                  key={String(addr.id)}
                  activeOpacity={0.85}
                  onPress={() => {
                    storeSetSelectedAddress(addr);
                    onSelectAddress(addr);
                    onClose();
                  }}
                  style={[
                    styles.addressCard,
                    isSelected && styles.addressCardSelected,
                  ]}
                >
                  {/* Radio Circle */}
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>

                  {/* Details */}
                  <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                    <View style={styles.addrHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.tagText}>{addr.tag || 'HOME'}</Text>
                        {addr.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (onEditAddress) {
                              onClose();
                              onEditAddress(addr);
                            } else {
                              setEditingAddress(addr);
                              setInternalEditModalVisible(true);
                            }
                          }}
                          style={styles.sheetEditBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="edit" size={11} color={theme.colors.primary} />
                          <Text style={styles.sheetEditText}>EDIT</Text>
                        </TouchableOpacity>

                        {!addr.isDefault ? (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={(e) => {
                              e.stopPropagation();
                              promptDeleteAddress(addr);
                            }}
                            style={styles.sheetDeleteBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon name="trash" size={13} color="#DC2626" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.recipientName}>{addr.name}</Text>
                    <Text style={styles.addressLine} numberOfLines={2}>
                      {addr.line1}, {addr.line2 ? `${addr.line2}, ` : ''}{addr.city} - {addr.pincode}
                    </Text>
                    <View style={styles.phoneRow}>
                      <Icon name="phone" size={11} color={theme.colors.textHint} />
                      <Text style={styles.phoneText}>{addr.phone}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Add New Address Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            onClose();
            onAddNewPress?.();
          }}
          style={styles.addNewBtn}
        >
          <Icon name="plus" size={16} color={theme.colors.primary} />
          <Text style={styles.addNewText}>Add New Address</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Attractive Delete Address Confirmation Modal */}
      <DeleteAddressModal
        visible={deleteModalVisible}
        address={addressToDelete}
        onClose={() => {
          setDeleteModalVisible(false);
          setAddressToDelete(null);
        }}
        onConfirmDelete={confirmDeleteAddress}
        isDeleting={isDeletingAddress}
      />

      {/* Internal Self-Contained Edit Address Modal */}
      <AddAddressModal
        visible={internalEditModalVisible}
        initialAddress={editingAddress}
        onClose={() => {
          setInternalEditModalVisible(false);
          setEditingAddress(null);
        }}
        onSaveAddress={async (savedAddr) => {
          if (
            editingAddress?.id &&
            !String(editingAddress.id).startsWith('addr-') &&
            !String(editingAddress.id).startsWith('gps-')
          ) {
            await storeUpdateAddress(editingAddress.id, savedAddr);
          } else {
            await storeAddNewAddress(savedAddr);
          }
          setEditingAddress(null);
          setInternalEditModalVisible(false);
          await loadAddresses();
          onRefreshAddresses?.();
        }}
      />
    </BottomSheetWrapper>
  );
};

const styles = StyleSheet.create({
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryMuted,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  gpsRowActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(15, 81, 50, 0.08)',
  },
  gpsRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.8,
  },
  gpsActiveBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  gpsActiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gpsFreeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#86EFAC',
  },
  gpsFreeBadgeText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gpsIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  gpsTitle: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
  gpsSub: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gpsArrow: {
    fontSize: theme.typography.scale.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.sm,
  },
  sectionHeader: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    letterSpacing: 0.8,
    color: theme.colors.textHint,
    marginBottom: theme.spacing.sm,
  },
  addressList: {
    gap: theme.spacing.sm,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  addressCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleActive: {
    borderColor: theme.colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  addrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sheetDeleteBtn: {
    padding: 3,
    borderRadius: 4,
  },
  sheetEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  sheetEditText: {
    fontSize: 9.5,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.3,
  },
  sheetActionBtn: {
    padding: 3,
    borderRadius: 4,
  },
  tagText: {
    fontSize: theme.typography.scale.xs - 2,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  defaultBadge: {
    backgroundColor: theme.colors.accentGoldMuted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.xs,
  },
  defaultBadgeText: {
    fontSize: theme.typography.scale.xs - 3,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.accentGoldDark,
  },
  recipientName: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  addressLine: {
    fontSize: theme.typography.scale.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    lineHeight: theme.typography.lineHeights.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phoneText: {
    fontSize: theme.typography.scale.xs - 1,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  addNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.base,
    gap: theme.spacing.xs,
  },
  addNewPlus: {
    fontSize: theme.typography.scale.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
  },
  addNewText: {
    fontSize: theme.typography.scale.sm,
    fontWeight: theme.typography.weights.extraBold,
    color: theme.colors.primary,
  },
});

export default AddressBottomSheet;
