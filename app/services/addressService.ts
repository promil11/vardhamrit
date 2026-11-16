import { api } from './api';
import { Address } from '../types';

export async function fetchUserAddresses(): Promise<Address[]> {
  try {
    const res = await api.get('/api/v1/addresses');
    if (res.data?.success && res.data?.data) {
      return res.data.data.map((a: any) => ({
        id: String(a.id),
        name: a.name,
        phone: a.phone,
        tag: a.tag || 'HOME',
        line1: a.line1,
        line2: a.line2 || undefined,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        isDefault: Boolean(a.is_default),
      }));
    }
    return [];
  } catch (err) {
    console.warn('Error fetching addresses from database API:', err);
    return [];
  }
}

export async function saveUserAddress(addr: Omit<Address, 'id'> | Address): Promise<Address | null> {
  try {
    const res = await api.post('/api/v1/addresses', {
      name: addr.name,
      phone: addr.phone,
      tag: addr.tag || 'HOME',
      line1: addr.line1,
      line2: addr.line2 || undefined,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: Boolean(addr.isDefault),
    });

    if (res.data?.success && res.data?.data) {
      const a = res.data.data;
      return {
        id: String(a.id),
        name: a.name,
        phone: a.phone,
        tag: a.tag || 'HOME',
        line1: a.line1,
        line2: a.line2 || undefined,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        isDefault: Boolean(a.is_default),
      };
    }
    return null;
  } catch (err) {
    console.warn('Error saving address to API:', err);
    return null;
  }
}

export async function removeUserAddress(id: string | number): Promise<boolean> {
  try {
    const res = await api.delete(`/api/v1/addresses/${id}`);
    return Boolean(res.data?.success);
  } catch (err) {
    console.warn(`Error deleting address ${id}:`, err);
    return false;
  }
}

export async function setDefaultUserAddress(id: string | number): Promise<boolean> {
  try {
    const res = await api.patch(`/api/v1/addresses/${id}/default`);
    return Boolean(res.data?.success);
  } catch (err) {
    console.warn(`Error setting address ${id} as default:`, err);
    return false;
  }
}
