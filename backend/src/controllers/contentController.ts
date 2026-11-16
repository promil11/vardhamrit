import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { sendSuccess } from '../utils/response';
import { getOrSetCache } from '../config/redis';

const formatImageUrl = (url?: string | null): string => {
  if (!url) return 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800';

  const baseUrl = process.env.API_BASE_URL || 'https://vardhamrit.onrender.com';

  // If URL has hardcoded localhost:5000 or 127.0.0.1, replace it with the live baseUrl
  if (url.includes('localhost:5000') || url.includes('127.0.0.1:5000')) {
    return url.replace(/https?:\/\/(localhost|127\.0\.0\.1):5000/, baseUrl);
  }

  if (url.startsWith('/uploads')) {
    return `${baseUrl}${url}`;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return url;
};

/**
 * GET /api/v1/content/banners
 * Returns active carousel hero banners.
 */
export async function getBanners(req: Request, res: Response, next: NextFunction) {
  try {
    const banners = await getOrSetCache('content:banners', 600, async () => {
      const [rows]: any = await pool.query(
        `SELECT 
          id, 
          slug, 
          tagline, 
          headline, 
          subheadline, 
          image_url, 
          badge_text, 
          badge_variant, 
          gradient_start, 
          gradient_end, 
          target_url, 
          sort_order
         FROM banners
         WHERE is_active = TRUE AND (valid_to IS NULL OR valid_to > NOW())
         ORDER BY sort_order ASC`
      );
      return rows.map((b: any) => {
        const fullImg = formatImageUrl(b.image_url);
        return {
          id: String(b.id),
          slug: b.slug,
          headline: b.headline,
          title: b.headline,
          subheadline: b.subheadline,
          subtitle: b.subheadline,
          tagline: b.tagline,
          imageUrl: fullImg,
          image: fullImg,
          badgeText: b.badge_text,
          badge: b.badge_text,
          badgeVariant: b.badge_variant,
          badge_variant: b.badge_variant,
          gradient: [b.gradient_start || '#0F5132', b.gradient_end || '#14532D'],
          target_url: b.target_url,
        };
      });
    });

    return sendSuccess(res, { banners });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/content/promotions/flash-deal
 * Returns active flash deal promotion with time remaining.
 */
export async function getFlashDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const flashDeals = await getOrSetCache('content:promotions:flash-deals', 30, async () => {
      const [rows]: any = await pool.query(
        `SELECT 
          pr.id,
          pr.product_id,
          pr.variant_id,
          pr.title,
          pr.subtitle,
          pr.image_url as promo_image,
          pr.deal_price,
          pr.original_price,
          pr.discount_percent,
          pr.start_time,
          pr.end_time,
          p.name as product_name,
          p.slug as product_slug,
          p.rating as product_rating,
          p.review_count,
          pv.label as variant_label,
          pv.weight_grams,
          (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image
         FROM promotions pr
         JOIN products p ON pr.product_id = p.id
         LEFT JOIN product_variants pv ON pr.variant_id = pv.id
         WHERE pr.is_active = TRUE AND (pr.end_time IS NULL OR pr.end_time > NOW())
         ORDER BY pr.id DESC`
      );

      const now = new Date();
      return rows.map((promo: any) => {
        const endTime = promo.end_time ? new Date(promo.end_time) : new Date(now.getTime() + 86400000);
        const remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
        const imageChoice = promo.promo_image || promo.product_image || 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800';

        return {
          id: promo.id,
          productId: promo.product_id,
          variantId: promo.variant_id,
          variantLabel: promo.variant_label,
          weightGrams: promo.weight_grams,
          title: promo.title,
          subtitle: promo.subtitle,
          dealPrice: Number(promo.deal_price),
          originalPrice: Number(promo.original_price),
          discountPercent: Number(promo.discount_percent),
          image: imageChoice,
          imageUrl: imageChoice,
          rating: Number(promo.product_rating) || 4.9,
          reviewCount: Number(promo.review_count) || 450,
          endTime: endTime.toISOString(),
          remainingSeconds,
        };
      });
    });

    const activeDeals = Array.isArray(flashDeals) ? flashDeals : [];
    return sendSuccess(res, {
      promotion: activeDeals.length > 0 ? activeDeals[0] : null,
      promotions: activeDeals,
      items: activeDeals,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/content/brewing-guides
 * Returns brewing master guides for different tea styles.
 */
export async function getBrewingGuides(req: Request, res: Response, next: NextFunction) {
  try {
    const guides = await getOrSetCache('content:brewing-guides', 1800, async () => {
      const [rows]: any = await pool.query(
        `SELECT 
          id, 
          title, 
          tagline, 
          leaves_qty, 
          water_ratio, 
          boil_time_mins, 
          milk_ratio, 
          tasting_notes, 
          sort_order
         FROM brewing_guides
         ORDER BY sort_order ASC`
      );
      return rows.map((g: any) => ({
        id: g.id,
        title: g.title,
        tagline: g.tagline,
        leaves: g.leaves_qty,
        water: g.water_ratio,
        time: g.boil_time_mins,
        milk: g.milk_ratio,
        notes: g.tasting_notes,
      }));
    });

    return sendSuccess(res, { guides });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/content/trust-props
 * Returns brand trust propositions (100% Pure, Fresh from Garden, etc.)
 */
export async function getTrustProps(req: Request, res: Response, next: NextFunction) {
  try {
    const props = await getOrSetCache('content:trust-props', 3600, async () => {
      const [rows]: any = await pool.query(
        `SELECT id, title, subtitle, icon_name, sort_order
         FROM trust_props
         WHERE is_active = TRUE
         ORDER BY sort_order ASC`
      );
      return rows.map((p: any) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        icon: p.icon_name,
      }));
    });

    return sendSuccess(res, { trust_props: props });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/content/trending-searches
 * Returns top trending search phrases.
 */
export async function getTrendingSearches(req: Request, res: Response, next: NextFunction) {
  try {
    const trending = [
      'Masala Chai',
      'First Flush Darjeeling',
      'Kadak CTC',
      'Cardamom Elaichi',
      'Kashmiri Kahwa',
      'Ginger Tea',
      'Organic Green',
    ];
    return sendSuccess(res, { trending });
  } catch (err) {
    return next(err);
  }
}
