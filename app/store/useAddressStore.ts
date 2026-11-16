import { create } from 'zustand';
import { Platform } from 'react-native';
import { Address } from '../types';
import { fetchUserAddresses, saveUserAddress, removeUserAddress, setDefaultUserAddress } from '../services/addressService';
import { fetchCurrentLocationAddress } from '../services/locationService';
import { storage } from '../services/storage';

const SELECTED_ADDRESS_KEY = 'vardhamrit_selected_address';

const getInitialSelectedAddress = (): Address | null => {
  try {
    const raw = storage.getItemSync(SELECTED_ADDRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // If it's a GPS-detected address, it's valid for this device
    if (parsed && String(parsed.id).startsWith('gps-')) {
      return parsed;
    }
    const user = storage.getUserSync();
    if (!user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

interface AddressState {
  addresses: Address[];
  selectedAddress: Address | null;
  isLoading: boolean;
  isLocating: boolean;

  // Actions
  loadAddresses: (preferredAddressId?: string) => Promise<Address[]>;
  setSelectedAddress: (addr: Address | null, makeDefault?: boolean) => void;
  setDefaultAddress: (id: string | number) => Promise<boolean>;
  setAddresses: (addresses: Address[]) => void;
  addNewAddress: (addr: Omit<Address, 'id'> | Address) => Promise<Address | null>;
  deleteAddress: (id: string | number) => Promise<boolean>;
  clearAddresses: () => void;
  autoDetectLocation: (force?: boolean) => Promise<Address | null>;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  selectedAddress: getInitialSelectedAddress(),
  isLoading: false,
  isLocating: false,

  loadAddresses: async (preferredAddressId?: string) => {
    set({ isLoading: true });
    try {
      const real = await fetchUserAddresses();
      const addrList = real || [];
      const currentSelected = get().selectedAddress;

      let targetAddress: Address | null = null;

      // 1. Explicitly preferred address (e.g. passed via checkout route param)
      if (preferredAddressId) {
        targetAddress = addrList.find((a) => String(a.id) === String(preferredAddressId)) || null;
      }

      // 2. If user has saved addresses in database
      if (!targetAddress && addrList.length > 0) {
        if (currentSelected && addrList.some((a) => String(a.id) === String(currentSelected.id))) {
          targetAddress = currentSelected;
        } else {
          const storedJson = storage.getItemSync(SELECTED_ADDRESS_KEY);
          if (storedJson) {
            try {
              const parsed = JSON.parse(storedJson);
              targetAddress = addrList.find((a) => String(a.id) === String(parsed.id)) || null;
            } catch {}
          }
        }

        if (!targetAddress) {
          targetAddress = addrList.find((a) => a.isDefault) || addrList[0];
        }
      }

      // 3. If user has NO saved addresses in database (brand new account or no addresses added)
      if (!targetAddress && addrList.length === 0) {
        // Only keep an address if it is an authentic GPS-detected address from this device
        if (currentSelected && String(currentSelected.id).startsWith('gps-')) {
          targetAddress = currentSelected;
        } else {
          const storedJson = storage.getItemSync(SELECTED_ADDRESS_KEY);
          if (storedJson) {
            try {
              const parsed = JSON.parse(storedJson);
              if (parsed && String(parsed.id).startsWith('gps-')) {
                targetAddress = parsed;
              }
            } catch {}
          }
        }
      }

      // Discard any foreign database address from another user's session
      if (targetAddress && !String(targetAddress.id).startsWith('gps-') && !addrList.some((a) => String(a.id) === String(targetAddress!.id))) {
        targetAddress = null;
        storage.removeItemSync(SELECTED_ADDRESS_KEY);
      }

      set({
        addresses: addrList,
        selectedAddress: targetAddress,
        isLoading: false,
      });

      if (targetAddress) {
        storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(targetAddress));
      } else {
        storage.removeItemSync(SELECTED_ADDRESS_KEY);
      }

      // 4. ZEPTO FLOW: When user opens the app and has no saved address, auto-fetch GPS location!
      if (!targetAddress && addrList.length === 0) {
        get().autoDetectLocation(false);
      }

      return addrList;
    } catch (e) {
      console.warn('Error loading addresses in useAddressStore:', e);
      set({ isLoading: false });
      return [];
    }
  },

  autoDetectLocation: async (force: boolean = false): Promise<Address | null> => {
    const { addresses, selectedAddress } = get();
    // If not forced and user already has a saved address from DB, keep it
    if (!force && selectedAddress && addresses.some((a) => String(a.id) === String(selectedAddress.id))) {
      return selectedAddress;
    }

    set({ isLocating: true });
    try {
      const currentUser = storage.getUserSync();
      const defaultName = currentUser?.name || 'My Delivery Point';
      const defaultPhone = currentUser?.phone || '';

      const { address, geocoded } = await fetchCurrentLocationAddress({
        name: defaultName,
        phone: defaultPhone,
        tag: 'HOME',
      });

      const cardLine1 = geocoded.line1 && geocoded.line1.trim().length > 0
        ? `${geocoded.line1}, ${geocoded.line2}`
        : (geocoded.line2 || 'Current Location');

      const detectedAddress: Address = {
        ...address,
        id: `gps-${Date.now()}`,
        tag: 'Current Location',
        line1: cardLine1,
        city: geocoded.city,
        state: geocoded.state,
        pincode: geocoded.pincode,
        isDefault: true,
      };

      set({
        selectedAddress: detectedAddress,
        isLocating: false,
      });

      storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(detectedAddress));
      return detectedAddress;
    } catch (err) {
      console.warn('Auto-detect location failed or denied:', err);
      set({ isLocating: false });
      return null;
    }
  },

  clearAddresses: () => {
    storage.removeItemSync(SELECTED_ADDRESS_KEY);
    set({
      addresses: [],
      selectedAddress: null,
      isLoading: false,
      isLocating: false,
    });
  },

  setSelectedAddress: (addr: Address | null, makeDefault: boolean = true) => {
    if (!addr) {
      set({ selectedAddress: null });
      storage.removeItemSync(SELECTED_ADDRESS_KEY);
      return;
    }

    set((state) => {
      const nextList = state.addresses.map((a) => ({
        ...a,
        isDefault: makeDefault ? String(a.id) === String(addr.id) : a.isDefault,
      }));
      const target = { ...addr, isDefault: makeDefault ? true : addr.isDefault };
      storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(target));
      return {
        selectedAddress: target,
        addresses: nextList,
      };
    });

    if (makeDefault && addr.id && !String(addr.id).startsWith('gps-')) {
      setDefaultUserAddress(addr.id).catch((err) =>
        console.warn('Background setDefault error on setSelectedAddress:', err)
      );
    }
  },

  setDefaultAddress: async (id: string | number) => {
    set((state) => {
      const nextList = state.addresses.map((a) => ({
        ...a,
        isDefault: String(a.id) === String(id),
      }));
      const newDefault = nextList.find((a) => String(a.id) === String(id)) || null;
      if (newDefault) {
        storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(newDefault));
      }
      return {
        addresses: nextList,
        selectedAddress: newDefault || state.selectedAddress,
      };
    });

    try {
      const ok = await setDefaultUserAddress(id);
      if (!ok) {
        await get().loadAddresses();
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Error setting default address in useAddressStore:', e);
      return false;
    }
  },

  setAddresses: (addresses: Address[]) => {
    set({ addresses });
  },

  addNewAddress: async (newAddr: Omit<Address, 'id'> | Address) => {
    try {
      const saved = await saveUserAddress(newAddr);
      if (saved) {
        set((state) => ({
          addresses: [saved, ...state.addresses.filter((a) => String(a.id) !== String(saved.id))],
          selectedAddress: saved,
        }));
        storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(saved));
        return saved;
      }
      return null;
    } catch (e) {
      console.warn('Error saving address in useAddressStore:', e);
      return null;
    }
  },

  deleteAddress: async (id: string | number) => {
    try {
      const ok = await removeUserAddress(id);
      if (ok) {
        set((state) => {
          const nextList = state.addresses.filter((a) => String(a.id) !== String(id));
          let nextSelected = state.selectedAddress;
          if (nextSelected && String(nextSelected.id) === String(id)) {
            nextSelected = nextList.find((a) => a.isDefault) || nextList[0] || null;
          }
          if (nextSelected) {
            storage.setItem(SELECTED_ADDRESS_KEY, JSON.stringify(nextSelected));
          } else {
            storage.removeItemSync(SELECTED_ADDRESS_KEY);
          }
          return {
            addresses: nextList,
            selectedAddress: nextSelected,
          };
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Error deleting address in useAddressStore:', e);
      return false;
    }
  },
}));

// Asynchronous rehydration fallback for Native platforms
if (Platform.OS !== 'web') {
  (async () => {
    try {
      const raw = await storage.getItem(SELECTED_ADDRESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && !useAddressStore.getState().selectedAddress) {
          useAddressStore.setState({ selectedAddress: parsed });
        }
      }
    } catch {}
  })();
}
