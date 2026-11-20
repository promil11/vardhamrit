import { api } from './api';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar_url?: string | null;
  member_since: string;
  tier: string;
  referral_code?: string;
  coins_balance?: number;
  referred_by?: number | null;
  preferred_blend?: string;
  favorite_morning_cup?: string;
  stats: {
    orders_count: number;
    total_spent: number;
    total_saved?: number;
    wishlist_count: number;
    address_count: number;
    coins_balance: number;
  };
}

export interface CoinTransaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference_id?: string;
  balance_after?: number;
  created_at: string;
}

export interface InviteVerificationResult {
  valid: boolean;
  code?: string;
  referrerName?: string;
  referrerFirstName?: string;
  bonusCoins?: number;
  welcomeCoins?: number;
  totalCoinsOnSignup?: number;
  description?: string;
}

export async function verifyInviteCode(code: string): Promise<InviteVerificationResult> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const res = await api.get(`/api/v1/auth/verify-invite?code=${encodeURIComponent(cleanCode)}`);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return { valid: false };
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error || 'Invalid or expired invite code';
    throw new Error(errorMsg);
  }
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await api.get('/api/v1/user/profile');
    if (res.data?.success && res.data?.data?.user) {
      return res.data.data.user;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching user profile:', err);
    return null;
  }
}

export async function updateUserProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
  preferredBlend?: string;
  favoriteMorningCup?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  try {
    const res = await api.put('/api/v1/user/profile', data);
    if (res.data?.success && res.data?.data?.user) {
      return {
        success: true,
        user: res.data.data.user,
        message: res.data.message || 'Profile updated successfully',
      };
    }
    return { success: false, message: res.data?.error || 'Update failed' };
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message || 'Failed to update profile';
    throw new Error(msg);
  }
}

/**
 * Uploads user profile avatar image via Base64 or FormData multipart.
 * Returns the relative image URL (e.g. /uploads/avatars/avatar-xxx.jpg).
 */
export async function uploadAvatarImage(imageUri: string, base64Data?: string | null): Promise<string> {
  try {
    // 1. If base64 data is present, send JSON payload (fast & reliable across web/mobile)
    if (base64Data && base64Data.length > 20) {
      const formattedBase64 = base64Data.startsWith('data:')
        ? base64Data
        : `data:image/jpeg;base64,${base64Data}`;
      const res = await api.post('/api/v1/user/avatar', { base64: formattedBase64 });
      if (res.data?.success && res.data?.data?.url) {
        return res.data.data.url;
      }
    }

    // 2. Otherwise send multipart FormData
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('avatar', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    const res = await api.post('/api/v1/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (res.data?.success && res.data?.data?.url) {
      return res.data.data.url;
    }
    throw new Error(res.data?.error || 'Failed to upload profile image');
  } catch (err: any) {
    const msg = err.response?.data?.error || err.message || 'Failed to upload profile image';
    throw new Error(msg);
  }
}

export async function fetchUserCoins(): Promise<{
  balance: number;
  transactions: CoinTransaction[];
}> {
  try {
    const res = await api.get('/api/v1/user/coins');
    if (res.data?.success && res.data?.data) {
      return {
        balance: res.data.data.current_balance,
        transactions: res.data.data.transactions || [],
      };
    }
    return { balance: 0, transactions: [] };
  } catch (err) {
    console.warn('Error fetching user coins:', err);
    return { balance: 0, transactions: [] };
  }
}

export async function fetchWishlistItems(): Promise<any[]> {
  try {
    const res = await api.get('/api/v1/wishlist');
    if (res.data?.success && res.data?.data?.items) {
      return res.data.data.items;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching wishlist:', err);
    return [];
  }
}

export async function toggleProductWishlist(productId: number): Promise<boolean> {
  try {
    const res = await api.post(`/api/v1/wishlist/${productId}/toggle`);
    return Boolean(res.data?.data?.wishlisted);
  } catch (err) {
    console.warn(`Error toggling wishlist for ${productId}:`, err);
    return false;
  }
}

export async function updateUserTasteProfile(
  favoriteMorningCup: string
): Promise<{ success: boolean; notification?: { title: string; body: string } }> {
  try {
    const res = await api.put('/api/v1/user/preferences', {
      favoriteMorningCup,
      preferredBlend: favoriteMorningCup,
    });
    return {
      success: Boolean(res.data?.success),
      notification: res.data?.data?.notification,
    };
  } catch (err) {
    console.warn('Error updating user taste profile:', err);
    return { success: false };
  }
}

export async function claimScratchCardReward(params: {
  orderNumber: string;
  orderId?: string | number;
  coinsEarned: number;
}): Promise<{ success: boolean; newBalance?: number; coinsAdded?: number }> {
  try {
    const res = await api.post('/api/v1/user/claim-scratch-card', params);
    if (res.data?.success && res.data?.data) {
      return {
        success: true,
        newBalance: res.data.data.newBalance,
        coinsAdded: res.data.data.coinsAdded,
      };
    }
    return { success: false };
  } catch (err) {
    console.warn('Error claiming scratch card reward:', err);
    return { success: false };
  }
}
