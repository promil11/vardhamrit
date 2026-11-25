import { api } from './api';
import { storage } from './storage';
import { Product } from '../types';
import { CategoryItem } from '../components/home/CategoryTile';

const LOCAL_STOCK_VARIANTS_KEY = 'vardhamrit_stock_alert_variants';
const LOCAL_STOCK_CONTACT_KEY = 'vardhamrit_stock_alert_contact';

function getLocalKey(userKey?: string | number | null): string {
  if (userKey) {
    return `${LOCAL_STOCK_VARIANTS_KEY}_${userKey}`;
  }
  try {
    const rawUser = storage.getItemSync('vardhamrit_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.id) return `${LOCAL_STOCK_VARIANTS_KEY}_${u.id}`;
      if (u?.email) return `${LOCAL_STOCK_VARIANTS_KEY}_${u.email}`;
    }
  } catch {}
  return `${LOCAL_STOCK_VARIANTS_KEY}_guest`;
}

export function getLocalSubscribedVariantIds(userKey?: string | number | null): number[] {
  try {
    const raw = storage.getItemSync(getLocalKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export function addLocalSubscribedVariantId(variantId: number, userKey?: string | number | null): void {
  try {
    const key = getLocalKey(userKey);
    const list = getLocalSubscribedVariantIds(userKey);
    if (!list.includes(variantId)) {
      list.push(variantId);
      storage.setItemSync(key, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Error saving local stock subscription:', e);
  }
}

export function removeLocalSubscribedVariantId(variantId: number, userKey?: string | number | null): void {
  try {
    const key = getLocalKey(userKey);
    const list = getLocalSubscribedVariantIds(userKey).filter((id) => id !== variantId);
    storage.setItemSync(key, JSON.stringify(list));
  } catch (e) {
    console.warn('Error removing local stock subscription:', e);
  }
}

export function getLocalStockContact(): string | null {
  try {
    return storage.getItemSync(LOCAL_STOCK_CONTACT_KEY);
  } catch {
    return null;
  }
}

export function setLocalStockContact(contact: string): void {
  try {
    storage.setItemSync(LOCAL_STOCK_CONTACT_KEY, contact);
  } catch (e) {
    console.warn('Error saving local stock contact:', e);
  }
}

export type Category = CategoryItem;

export async function fetchCategories(featured?: boolean): Promise<CategoryItem[]> {
  try {
    const res = await api.get('/api/v1/categories', {
      params: featured ? { featured: 'true' } : {},
    });
    if (res.data?.success && res.data?.data?.categories) {
      return res.data.data.categories.map((c: any) => ({
        id: c.slug || String(c.id),
        label: c.label || c.name,
        name: c.name || c.label,
        tagline: c.tagline,
        imageUrl: c.imageUrl || c.image || null,
        image: c.image || c.imageUrl || null,
        iconName: c.iconName || c.icon || 'coffee',
        iconColor: c.iconColor || c.color || '#0F5132',
        gradientColors:
          c.gradientColors && c.gradientColors.length >= 2
            ? c.gradientColors
            : c.bgGradient && c.bgGradient.length >= 2
            ? c.bgGradient
            : ['#DCFCE7', '#BBF7D0'],
        borderColor: c.borderColor,
        shadowColor: c.shadowColor,
        badge: c.badge,
        badgeBg: c.badgeBg,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Error fetching categories from database API:', err);
    return [];
  }
}

export async function fetchCategoryDetail(slug: string): Promise<any> {
  try {
    const res = await api.get(`/api/v1/categories/${slug}`);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.warn(`Fallback for category ${slug}:`, err);
    return null;
  }
}

export interface ProductQueryParams {
  search?: string;
  category?: string;
  category_id?: number | string;
  featured?: boolean;
  bestseller?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popular';
  page?: number;
  limit?: number;
}

export function normalizeProduct(p: any): Product {
  const imageUrl =
    p.imageUrl ||
    p.image ||
    p.primary_image ||
    (p.images && p.images[0]) ||
    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80';

  const images =
    p.images && p.images.length > 0
      ? p.images
      : [imageUrl];

  const variants = (p.variants || []).map((v: any) => ({
    id: v.id,
    label: v.label,
    weightGrams: Number(v.weightGrams ?? v.weight_grams ?? 250),
    price: Number(v.price),
    mrp: Number(v.mrp ?? v.originalPrice ?? v.original_price ?? v.price),
    stock: Number(v.stock ?? v.stock_quantity ?? 10),
  }));

  const rawCatSlug = (p.category_slug || '').toLowerCase().trim();
  const rawCat = (p.category || p.category_name || '').toLowerCase().trim();
  let categorySlug = 'normal';
  if (rawCatSlug === 'masala' || rawCat.includes('masala')) {
    categorySlug = 'masala';
  } else if (rawCatSlug === 'keser' || rawCat.includes('keser') || rawCat.includes('saffron')) {
    categorySlug = 'keser';
  } else if (rawCatSlug === 'chocolate' || rawCat.includes('chocolate') || rawCat.includes('cocoa')) {
    categorySlug = 'chocolate';
  } else if (rawCatSlug === 'normal' || rawCatSlug === 'kadak' || rawCat.includes('normal') || rawCat.includes('kadak') || rawCat.includes('assam')) {
    categorySlug = 'normal';
  } else if (rawCatSlug) {
    categorySlug = rawCatSlug;
  }

  const maxVariantDiscount = variants.reduce((max: number, v: any) => {
    const pct = v.mrp > v.price ? Math.round(((v.mrp - v.price) / v.mrp) * 100) : 0;
    return Math.max(max, pct);
  }, 0);
  const effectiveDiscountPct = variants.length > 0 ? maxVariantDiscount : Number(p.discountPercentage ?? p.discount_percentage ?? 0);

  return {
    id: Number(p.id),
    name: p.name,
    tagline: p.tagline || '',
    description: p.description || '',
    imageUrl,
    images,
    category: categorySlug,
    category_slug: categorySlug,
    category_name: p.category_name || p.category || categorySlug,
    rating: Number(p.rating ?? p.avg_rating ?? 5.0),
    reviewCount: Number(p.reviewCount ?? p.review_count ?? p.reviews ?? 0),
    isBestSeller: Boolean(p.isBestSeller ?? p.is_bestseller),
    isFreshHarvest: Boolean(p.isFreshHarvest ?? p.is_fresh_harvest),
    discountPercentage: effectiveDiscountPct,
    variants:
      variants.length > 0
        ? variants
        : [
            {
              id: 1,
              label: '250 g',
              weightGrams: 250,
              price: Number(p.price || 149),
              mrp: Number(p.originalPrice || 185),
              stock: 50,
            },
          ],
    badges: p.badges || (p.badge ? [p.badge] : []),
  } as any;
}

export async function fetchProducts(params: ProductQueryParams = {}): Promise<{
  items: Product[];
  total: number;
}> {
  try {
    const res = await api.get('/api/v1/products', {
      params: {
        ...params,
        featured: params.featured ? 'true' : undefined,
        bestseller: params.bestseller ? 'true' : undefined,
      },
    });

    if (res.data?.success && res.data?.data?.items) {
      return {
        items: res.data.data.items.map(normalizeProduct),
        total: res.data.data.pagination?.total ?? res.data.data.items.length,
      };
    }
    return { items: [], total: 0 };
  } catch (err) {
    console.warn('Error fetching products from database API:', err);
    return { items: [], total: 0 };
  }
}

export async function fetchProductDetail(idOrSlug: string | number): Promise<Product | null> {
  try {
    const res = await api.get(`/api/v1/products/${idOrSlug}`);
    if (res.data?.success && res.data?.data) {
      return normalizeProduct(res.data.data);
    }
    return null;
  } catch (err) {
    console.warn(`Error fetching product ${idOrSlug} from database API:`, err);
    return null;
  }
}

export async function subscribeToStockNotification(
  productId: number,
  variantId: number,
  details?: { email?: string; phone?: string; contactType?: 'PUSH' | 'EMAIL' | 'PHONE' }
): Promise<{ success: boolean; message: string; alreadySubscribed?: boolean }> {
  try {
    const contactVal = details?.email || details?.phone;
    if (contactVal) {
      setLocalStockContact(contactVal);
    }
    // Optimistically save variant in local storage
    addLocalSubscribedVariantId(variantId);

    const res = await api.post(`/api/v1/products/${productId}/notify-stock`, {
      variantId,
      email: details?.email,
      phone: details?.phone,
      contactType: details?.contactType || 'PUSH',
    });
    if (res.data?.success) {
      addLocalSubscribedVariantId(variantId);
      return {
        success: true,
        message: res.data.message || "We'll notify you as soon as fresh garden inventory arrives! 🍃",
        alreadySubscribed: !!res.data.data?.alreadySubscribed,
      };
    }
    return {
      success: false,
      message: res.data?.message || 'Failed to set notification alert.',
    };
  } catch (err: any) {
    console.warn('Error subscribing to stock notification:', err);
    // Still retain local alert so user is not stuck
    addLocalSubscribedVariantId(variantId);
    const msg = err.response?.data?.message || 'Failed to set notification alert. Please try again.';
    return { success: false, message: msg };
  }
}

export async function checkStockNotificationSubscription(
  variantId: number,
  contactValue?: string | null
): Promise<boolean> {
  // 1. Instant check in local device storage
  const localList = getLocalSubscribedVariantIds();
  if (localList.includes(variantId)) {
    return true;
  }

  // 2. Remote check in database
  try {
    const resolvedContact = contactValue || getLocalStockContact();
    const res = await api.get('/api/v1/products/stock-subscription/check', {
      params: {
        variantId,
        contactValue: resolvedContact || undefined,
      },
    });
    const isSub = !!res.data?.data?.isSubscribed;
    if (isSub) {
      addLocalSubscribedVariantId(variantId);
    }
    return isSub;
  } catch (err) {
    return false;
  }
}

export interface StockAlertItem {
  subscription_id: number;
  user_id: number | null;
  product_id: number;
  variant_id: number;
  contact_type: string;
  contact_value: string | null;
  is_notified: number;
  notified_at: string | null;
  created_at: string;
  product_name: string;
  product_slug: string;
  variant_label: string;
  price: number;
  mrp: number;
  stock_quantity: number;
  product_image: string;
}

export async function fetchMyStockAlerts(contactValue?: string | null): Promise<StockAlertItem[]> {
  try {
    const resolvedContact = contactValue || getLocalStockContact();
    const res = await api.get('/api/v1/products/stock-subscriptions/my-alerts', {
      params: {
        contactValue: resolvedContact || undefined,
      },
    });
    if (res.data?.success && Array.isArray(res.data?.data?.items)) {
      return res.data.data.items;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching stock alerts:', err);
    return [];
  }
}

export async function unsubscribeStockAlert(
  subscriptionId: number,
  variantId?: number,
  contactValue?: string | null
): Promise<boolean> {
  try {
    if (variantId) {
      removeLocalSubscribedVariantId(variantId);
    }
    const resolvedContact = contactValue || getLocalStockContact();
    const res = await api.delete(`/api/v1/products/stock-subscriptions/${subscriptionId}`, {
      params: {
        contactValue: resolvedContact || undefined,
      },
    });
    return !!res.data?.success;
  } catch (err) {
    console.warn('Error removing stock alert:', err);
    return false;
  }
}

