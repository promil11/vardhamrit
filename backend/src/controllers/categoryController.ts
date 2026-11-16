import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';
import { getOrSetCache } from '../config/redis';

/**
 * GET /api/v1/categories
 * Returns active categories with style attributes and dynamic product counts.
 */
export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const featuredOnly = req.query.featured === 'true';
    const cacheKey = `categories:all:${featuredOnly ? 'featured' : 'all'}`;

    const categories = await getOrSetCache(cacheKey, 600, async () => {
      let query = `
        SELECT 
          c.id,
          c.slug,
          c.name,
          c.tagline,
          c.description,
          c.icon_name,
          c.icon_color,
          c.image_url,
          c.gradient_start,
          c.gradient_end,
          c.border_color,
          c.shadow_color,
          c.badge_text,
          c.badge_bg,
          c.sort_order,
          COUNT(p.id) AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE AND p.deleted_at IS NULL
        WHERE c.is_active = TRUE AND c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
      `;

      const [rows]: any = await pool.query(query);
      return rows.map((cat: any) => ({
        id: cat.slug || String(cat.id),
        numeric_id: cat.id,
        slug: cat.slug,
        label: cat.name,
        name: cat.name,
        tagline: cat.tagline,
        description: cat.description,
        iconName: cat.icon_name || 'coffee',
        icon: cat.icon_name || 'coffee',
        iconColor: cat.icon_color || '#0F5132',
        color: cat.icon_color || '#0F5132',
        imageUrl: cat.image_url || null,
        image: cat.image_url || null,
        gradientColors: [cat.gradient_start || '#DCFCE7', cat.gradient_end || '#BBF7D0'],
        bgGradient: [cat.gradient_start || '#DCFCE7', cat.gradient_end || '#BBF7D0'],
        borderColor: cat.border_color,
        shadowColor: cat.shadow_color,
        badge: cat.badge_text,
        badgeBg: cat.badge_bg,
        count: `${cat.product_count}+ Products`,
        product_count: Number(cat.product_count),
      }));
    });

    return sendSuccess(res, { categories });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/categories/:slug
 * Returns category details along with hero tasting notes and statistics.
 */
export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const cacheKey = `category:slug:${slug}`;

    const categoryData = await getOrSetCache(cacheKey, 600, async () => {
      const [categories]: any = await pool.query(
        `SELECT 
          c.id,
          c.slug,
          c.name,
          c.tagline,
          c.description,
          c.icon_name,
          c.icon_color,
          c.image_url,
          c.gradient_start,
          c.gradient_end,
          c.border_color,
          c.shadow_color,
          c.badge_text,
          c.badge_bg,
          c.sort_order
         FROM categories c
         WHERE c.slug = ? AND c.is_active = TRUE AND c.deleted_at IS NULL
         LIMIT 1`,
        [slug]
      );

      if (categories.length === 0) return null;

      const cat = categories[0];

      // Fetch hero metadata
      const [heroMeta]: any = await pool.query(
        `SELECT hero_title, hero_subtitle, origin, notes, badge
         FROM category_hero_metadata
         WHERE category_id = ?
         LIMIT 1`,
        [cat.id]
      );

      let hero: any = null;
      if (heroMeta.length > 0) {
        const meta = heroMeta[0];
        let notesArr: string[] = [];
        if (typeof meta.notes === 'string') {
          try { notesArr = JSON.parse(meta.notes); } catch (_) { notesArr = [meta.notes]; }
        } else if (Array.isArray(meta.notes)) {
          notesArr = meta.notes;
        }

        hero = {
          title: meta.hero_title,
          subtitle: meta.hero_subtitle,
          origin: meta.origin,
          notes: notesArr,
          badge: meta.badge,
          gradient: [cat.gradient_start || '#0F5132', cat.gradient_end || '#14532D'],
        };
      }

      return {
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        tagline: cat.tagline,
        description: cat.description,
        icon: cat.icon_name,
        color: cat.icon_color,
        bgGradient: [cat.gradient_start, cat.gradient_end],
        borderColor: cat.border_color,
        shadowColor: cat.shadow_color,
        badge: cat.badge_text,
        badgeBg: cat.badge_bg,
        hero,
      };
    });

    if (!categoryData) {
      return sendError(res, 'Category not found', 404);
    }

    return sendSuccess(res, categoryData);
  } catch (err) {
    return next(err);
  }
}
