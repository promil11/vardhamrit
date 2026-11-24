import { api } from './api';
import { MOCK_BANNERS } from './mockData';

export interface Banner {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  image: string;
  badge: string;
  badge_variant?: string;
  gradient?: string[];
  target_url?: string;
}

export interface FlashDeal {
  id: number;
  productId: number;
  variantId: number;
  title: string;
  subtitle: string;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  image: string;
  rating: number;
  reviewCount: number;
  endTime: string;
  remainingSeconds: number;
}

export interface BrewingGuide {
  id: number;
  title: string;
  tagline: string;
  leaves: string;
  water: string;
  time: string;
  milk: string;
  notes: string;
}

export interface TrustProp {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
}

export async function fetchBanners(): Promise<any[]> {
  try {
    const res = await api.get('/api/v1/content/banners');
    if (res.data?.success && res.data?.data?.banners?.length > 0) {
      return res.data.data.banners.map((b: any) => ({
        id: String(b.id),
        slug: b.slug,
        headline: b.headline || b.title,
        title: b.title || b.headline,
        subheadline: b.subheadline || b.subtitle,
        subtitle: b.subtitle || b.subheadline,
        tagline: b.tagline,
        imageUrl: b.imageUrl || b.image,
        image: b.image || b.imageUrl,
        badgeText: b.badgeText || b.badge,
        badge: b.badge || b.badgeText,
        badgeVariant: b.badgeVariant || b.badge_variant,
        gradient:
          b.gradient && Array.isArray(b.gradient) && b.gradient.length >= 2
            ? b.gradient
            : ['#0F5132', '#14532D'],
        target_url: b.target_url,
      }));
    }
    return MOCK_BANNERS;
  } catch (err) {
    console.warn('Error fetching banners from database API, using fallback:', err);
    return MOCK_BANNERS;
  }
}

export async function fetchFlashDeals(): Promise<FlashDeal[]> {
  try {
    const res = await api.get('/api/v1/content/promotions/flash-deal');
    if (res.data?.success && res.data?.data) {
      if (Array.isArray(res.data.data.promotions) && res.data.data.promotions.length > 0) {
        return res.data.data.promotions;
      }
      if (Array.isArray(res.data.data.items) && res.data.data.items.length > 0) {
        return res.data.data.items;
      }
      if (res.data.data.promotion) {
        return [res.data.data.promotion];
      }
    }
    return [];
  } catch (err) {
    console.warn('Fallback for flash deals:', err);
    return [];
  }
}

export async function fetchFlashDeal(): Promise<FlashDeal | null> {
  const deals = await fetchFlashDeals();
  return deals.length > 0 ? deals[0] : null;
}

export async function fetchBrewingGuides(): Promise<BrewingGuide[]> {
  try {
    const res = await api.get('/api/v1/content/brewing-guides');
    if (res.data?.success && res.data?.data?.guides?.length > 0) {
      return res.data.data.guides;
    }
    return [];
  } catch (err) {
    console.warn('Fallback for brewing guides:', err);
    return [];
  }
}

export async function fetchTrustProps(): Promise<TrustProp[]> {
  try {
    const res = await api.get('/api/v1/content/trust-props');
    if (res.data?.success && res.data?.data?.trust_props?.length > 0) {
      return res.data.data.trust_props;
    }
    return [];
  } catch (err) {
    console.warn('Fallback for trust props:', err);
    return [];
  }
}

export async function fetchTrendingSearches(): Promise<string[]> {
  try {
    const res = await api.get('/api/v1/content/trending-searches');
    if (res.data?.success && res.data?.data?.trending) {
      return res.data.data.trending;
    }
    return ['Masala Chai', 'Kadak CTC', 'Elaichi Chai', 'Kashmiri Kahwa'];
  } catch (err) {
    return ['Masala Chai', 'Kadak CTC', 'Elaichi Chai', 'Kashmiri Kahwa'];
  }
}
