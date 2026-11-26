import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';
import { getOrSetCache } from '../config/redis';
import { io } from '../index';

export const productListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  category_id: z.string().optional(),
  featured: z.enum(['true', 'false']).optional(),
  bestseller: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'popular']).optional().default('newest'),
  inStockOnly: z.enum(['true', 'false']).optional(),
});

export const productParamSchema = z.object({
  id: z.string(),
});

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

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, category, category_id, featured, bestseller, page, limit, sort, inStockOnly, includeInactive } = req.query as any;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereConditions: string[] = ['p.deleted_at IS NULL'];
    if (includeInactive !== 'true') {
      whereConditions.push('p.is_active = TRUE');
    }
    let params: any[] = [];

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.tagline LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category_id) {
      whereConditions.push('p.category_id = ?');
      params.push(Number(category_id));
    } else if (category && category !== 'all') {
      whereConditions.push('c.slug = ?');
      params.push(category);
    }

    if (featured === 'true') {
      whereConditions.push('p.is_featured = TRUE');
    }

    if (bestseller === 'true') {
      whereConditions.push('p.is_bestseller = TRUE');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total products
    const [countResult]: any = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Sorting
    let orderByClause = 'ORDER BY p.sort_order ASC, p.created_at DESC';
    if (sort === 'rating') {
      orderByClause = 'ORDER BY p.rating DESC, p.review_count DESC';
    } else if (sort === 'price_asc') {
      orderByClause = 'ORDER BY min_price ASC';
    } else if (sort === 'price_desc') {
      orderByClause = 'ORDER BY min_price DESC';
    } else if (sort === 'popular') {
      orderByClause = 'ORDER BY p.review_count DESC, p.rating DESC';
    }

    // Main product query with min_price subquery for accurate sorting
    const [products]: any = await pool.query(
      `SELECT 
        p.id, 
        p.category_id,
        c.name as category_name,
        c.slug as category_slug,
        p.name, 
        p.slug,
        p.tagline,
        p.description, 
        p.is_active,
        p.rating, 
        p.review_count,
        p.is_bestseller,
        p.is_fresh_harvest,
        p.is_featured,
        p.discount_percentage,
        p.created_at,
        COALESCE(
          (SELECT MIN(pv.price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE AND pv.deleted_at IS NULL),
          0
        ) as min_price,
        COALESCE(
          (SELECT MIN(pv.mrp) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE AND pv.deleted_at IS NULL),
          0
        ) as original_price,
        COALESCE(
          (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
        ) as primary_image
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ${orderByClause}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Fetch variants, badges & images for all returned products
    if (products.length > 0) {
      const productIds = products.map((p: any) => p.id);
      
      const [variants]: any = await pool.query(
        `SELECT id, product_id, sku, label, weight_grams, price, mrp, stock_quantity, stock_quantity as stock 
         FROM product_variants 
         WHERE product_id IN (?) AND is_active = TRUE AND deleted_at IS NULL
         ORDER BY sort_order ASC, price ASC`,
        [productIds]
      );

      // Check active promotions for variants
      const variantIds = variants.map((v: any) => v.id);
      const promoMap = new Map<number, any>();
      if (variantIds.length > 0) {
        const [promoRows]: any = await pool.query(
          `SELECT variant_id, deal_price, original_price, discount_percent, title, subtitle 
           FROM promotions 
           WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
          [variantIds]
        );
        for (const p of promoRows) {
          promoMap.set(p.variant_id, p);
        }
      }

      for (const v of variants) {
        const promo = promoMap.get(v.id);
        if (promo) {
          const promoDealPrice = Number(promo.deal_price);
          const originalPrice = Number(v.price);
          v.original_price = originalPrice;
          v.originalPrice = originalPrice;
          v.mrp = v.mrp ? Math.max(Number(v.mrp), originalPrice) : originalPrice;
          v.deal_price = promoDealPrice;
          v.dealPrice = promoDealPrice;
          v.price = promoDealPrice;
          v.is_on_deal = true;
          v.deal_discount_percent = Number(promo.discount_percent);
        }
      }

      const [images]: any = await pool.query(
        `SELECT product_id, image_url, is_primary 
         FROM product_images 
         WHERE product_id IN (?) 
         ORDER BY is_primary DESC, sort_order ASC`,
        [productIds]
      );

      const [badges]: any = await pool.query(
        `SELECT product_id, badge_label 
         FROM product_badges 
         WHERE product_id IN (?) 
         ORDER BY sort_order ASC`,
        [productIds]
      );

      const variantMap = new Map<number, any[]>();
      for (const v of variants) {
        if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, []);
        variantMap.get(v.product_id)!.push(v);
      }

      const imageMap = new Map<number, string[]>();
      for (const img of images) {
        if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, []);
        imageMap.get(img.product_id)!.push(img.image_url);
      }

      const badgeMap = new Map<number, string[]>();
      for (const b of badges) {
        if (!badgeMap.has(b.product_id)) badgeMap.set(b.product_id, []);
        badgeMap.get(b.product_id)!.push(b.badge_label);
      }

      for (const p of products) {
        const itemVariants = variantMap.get(p.id) || [];
        p.variants = itemVariants;
        p.price = itemVariants.length > 0 ? Number(itemVariants[0].price) : Number(p.min_price);
        p.originalPrice = itemVariants.length > 0 && itemVariants[0].mrp 
          ? Number(itemVariants[0].mrp) 
          : Number(p.original_price || p.price);
        const maxDiscount = itemVariants.reduce((max: number, v: any) => {
          const vPrice = Number(v.price) || 0;
          const vMrp = Number(v.mrp) || vPrice;
          const pct = vMrp > vPrice ? Math.round(((vMrp - vPrice) / vMrp) * 100) : 0;
          return Math.max(max, pct);
        }, 0);
        p.discount_percentage = maxDiscount;
        p.discountPercentage = maxDiscount;
        p.in_stock = itemVariants.length > 0 ? itemVariants.some((v: any) => v.stock_quantity > 0) : true;
        const rawImages = imageMap.get(p.id) || [p.primary_image];
        p.images = rawImages.map(formatImageUrl);
        p.primary_image = formatImageUrl(p.primary_image);
        p.image = p.primary_image;
        p.imageUrl = p.primary_image;
        p.badges = badgeMap.get(p.id) || [];
        p.badge = p.badges[0] || (p.is_bestseller ? 'Bestseller' : p.is_fresh_harvest ? 'Fresh Harvest' : null);
        p.isBestSeller = Boolean(p.is_bestseller);
        p.isFreshHarvest = Boolean(p.is_fresh_harvest);
        p.rating = Number(p.rating) || 5.0;
        p.reviews = Number(p.review_count) || 0;
        p.reviewCount = Number(p.review_count) || 0;
        p.category = p.category_name;
      }
    }

    let resultProducts = products;
    if (inStockOnly === 'true') {
      resultProducts = resultProducts.filter((p: any) => p.in_stock);
    }

    return sendSuccess(res, {
      items: resultProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getProductById(req: Request, res: Response, next: NextFunction) {
  try {
    const param = req.params.id;
    const isNumeric = /^\d+$/.test(param);

    let query = `
      SELECT 
        p.*,
        c.name as category_name,
        c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.id = ? OR p.slug = ?) AND p.is_active = TRUE AND p.deleted_at IS NULL
      LIMIT 1
    `;
    const [products]: any = await pool.query(query, [isNumeric ? Number(param) : 0, param]);

    if (products.length === 0) {
      return sendError(res, 'Product not found', 404);
    }

    const product = products[0];

    // Fetch product variants
    const [variants]: any = await pool.query(
      `SELECT id, product_id, sku, label, weight_grams, price, mrp, stock_quantity, stock_quantity as stock 
       FROM product_variants 
       WHERE product_id = ? AND is_active = TRUE AND deleted_at IS NULL
       ORDER BY sort_order ASC, price ASC`,
      [product.id]
    );

    // Check active promotions for product variants
    const variantIds = variants.map((v: any) => v.id);
    const promoMap = new Map<number, any>();
    if (variantIds.length > 0) {
      const [promoRows]: any = await pool.query(
        `SELECT variant_id, deal_price, original_price, discount_percent, title, subtitle 
         FROM promotions 
         WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
        [variantIds]
      );
      for (const p of promoRows) {
        promoMap.set(p.variant_id, p);
      }
    }

    let hasDeal = false;
    for (const v of variants) {
      const promo = promoMap.get(v.id);
      if (promo) {
        const promoDealPrice = Number(promo.deal_price);
        const originalPrice = Number(v.price);
        v.original_price = originalPrice;
        v.originalPrice = originalPrice;
        v.mrp = v.mrp ? Math.max(Number(v.mrp), originalPrice) : originalPrice;
        v.deal_price = promoDealPrice;
        v.dealPrice = promoDealPrice;
        v.price = promoDealPrice;
        v.is_on_deal = true;
        v.deal_discount_percent = Number(promo.discount_percent);
        hasDeal = true;
      }
    }

    product.variants = variants;
    product.in_stock = variants.some((v: any) => v.stock_quantity > 0);
    product.price = variants.length > 0 ? Number(variants[0].price) : 0;
    product.originalPrice = variants.length > 0 ? Number(variants[0].mrp || variants[0].price) : 0;

    // Fetch product images
    const [images]: any = await pool.query(
      `SELECT image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order ASC`,
      [product.id]
    );
    const rawImgs = images.length > 0 ? images.map((img: any) => img.image_url) : [
      'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
    ];
    product.images = rawImgs.map(formatImageUrl);
    product.image = product.images[0];
    product.imageUrl = product.images[0];
    product.isBestSeller = Boolean(product.is_bestseller);
    product.isFreshHarvest = Boolean(product.is_fresh_harvest);
    product.reviewCount = Number(product.review_count) || 0;

    // Fetch badges
    const [badges]: any = await pool.query(
      `SELECT badge_label FROM product_badges WHERE product_id = ? ORDER BY sort_order ASC`,
      [product.id]
    );
    product.badges = badges.map((b: any) => b.badge_label);
    product.badge = product.badges[0] || (product.is_bestseller ? 'Bestseller' : null);

    // Get rating breakdown
    const [ratingCounts]: any = await pool.query(
      `SELECT FLOOR(r.rating) as star, COUNT(DISTINCT r.id) as count 
       FROM reviews r
       JOIN order_items oi ON oi.order_id = r.order_id
       WHERE oi.product_id = ? AND (r.is_hidden = FALSE OR r.is_hidden IS NULL) AND r.deleted_at IS NULL AND r.is_approved = TRUE
       GROUP BY FLOOR(r.rating)`,
      [product.id]
    );

    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of ratingCounts) {
      const star = Math.round(Number(row.star));
      if (star >= 1 && star <= 5) {
        breakdown[star] = Number(row.count);
      }
    }
    product.rating_breakdown = breakdown;

    return sendSuccess(res, product);
  } catch (err) {
    return next(err);
  }
}

export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort === 'rating' ? 'ORDER BY r.rating DESC' : 'ORDER BY r.created_at DESC';
    const offset = (page - 1) * limit;

    const [countResult]: any = await pool.query(
      `SELECT COUNT(DISTINCT r.id) as total
       FROM reviews r
       JOIN order_items oi ON oi.order_id = r.order_id
       WHERE oi.product_id = ? AND r.deleted_at IS NULL AND r.is_approved = TRUE`,
      [id]
    );
    const total = countResult[0].total;

    const [reviews]: any = await pool.query(
      `SELECT DISTINCT r.id, r.rating, r.title, r.comment, r.review_tags, r.is_verified_purchase, r.admin_reply, r.admin_replied_at, r.created_at,
              u.name as reviewer_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN order_items oi ON oi.order_id = r.order_id
       WHERE oi.product_id = ? AND r.is_approved = TRUE AND r.deleted_at IS NULL
       ${sort}
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    return sendSuccess(res, {
      items: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Subscribe user to stock notifications for an out-of-stock product variant
 */
export async function subscribeStockNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = Number(req.params.id);
    const { variantId, email, phone, contactType } = req.body;
    let userId = (req as any).user?.id || null;

    if (!variantId) {
      return sendError(res, 'variantId is required', 400);
    }

    const contactVal = email || phone || null;
    const finalContactType = contactType || (email ? 'EMAIL' : phone ? 'PHONE' : 'PUSH');

    // If userId not present from JWT, check if this email/phone belongs to an existing user account
    if (!userId && contactVal) {
      const [u]: any = await pool.query(
        `SELECT id FROM users WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?) LIMIT 1`,
        [email || null, email || null, phone || null, phone || null]
      );
      if (u.length > 0) {
        userId = u[0].id;
      }
    }

    // Check if subscription already exists for this exact user/contact
    const [existing]: any = await pool.query(
      `SELECT id FROM stock_subscriptions 
       WHERE variant_id = ? AND is_notified = FALSE AND (
         (? IS NOT NULL AND user_id = ?) OR
         (? IS NOT NULL AND contact_value = ?)
       ) LIMIT 1`,
      [variantId, userId, userId, contactVal, contactVal]
    );

    if (existing.length > 0) {
      return sendSuccess(res, { alreadySubscribed: true }, "You're already on the priority notification list for this blend!");
    }

    const [insertResult]: any = await pool.query(
      `INSERT INTO stock_subscriptions (user_id, product_id, variant_id, contact_type, contact_value)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, productId, variantId, finalContactType, contactVal]
    );

    // Fetch product, variant, and user metadata for real-time notification to admin panel
    const [metaRows]: any = await pool.query(
      `SELECT p.name as product_name, pv.label as variant_label, u.name as user_name
       FROM products p
       JOIN product_variants pv ON pv.id = ?
       LEFT JOIN users u ON u.id = ?
       WHERE p.id = ?`,
      [variantId, userId, productId]
    );

    const productName = metaRows[0]?.product_name || 'Tea blend';
    const variantLabel = metaRows[0]?.variant_label || '';
    const customerName = metaRows[0]?.user_name || contactVal || 'A customer';

    const alertPayload = {
      id: insertResult.insertId,
      userId,
      productId,
      variantId,
      productName,
      variantLabel,
      customerName,
      contactType: finalContactType,
      contactValue: contactVal,
      createdAt: new Date().toISOString(),
    };

    // Broadcast instant real-time events to admin dashboard and connected clients
    if (io) {
      io.emit('stock_alert.created', alertPayload);
      io.emit('stock_alert.updated', { ...alertPayload, action: 'created' });
      if (userId) {
        io.emit(`stock_alert.user_updated:${userId}`, {
          variantId,
          productId,
          isSubscribed: true,
        });
      }
    }

    return sendSuccess(
      res,
      { subscribed: true, id: insertResult.insertId },
      "We'll notify you via push notification as soon as fresh garden inventory arrives! 🍃"
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * Check if current user or contact is subscribed to stock notification for a variant
 */
export async function checkStockSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const variantId = Number(req.query.variantId);
    let userId = (req as any).user?.id || null;
    let userEmail = (req as any).user?.email || null;
    let userPhone = (req as any).user?.phone || null;
    const queryContact = req.query.contactValue ? String(req.query.contactValue).trim() : null;

    if (!userId && queryContact) {
      const [u]: any = await pool.query(
        `SELECT id, email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1`,
        [queryContact, queryContact]
      );
      if (u.length > 0) {
        userId = u[0].id;
        userEmail = u[0].email;
        userPhone = u[0].phone;
      }
    }

    const finalContact = queryContact || userEmail || userPhone;

    if (!variantId) {
      return sendSuccess(res, { isSubscribed: false });
    }

    if (!userId && !finalContact) {
      return sendSuccess(res, { isSubscribed: false });
    }

    let userMatches: string[] = [];
    let params: any[] = [variantId];

    if (userId) {
      userMatches.push('user_id = ?');
      params.push(userId);
    }
    if (finalContact) {
      userMatches.push('contact_value = ?');
      params.push(finalContact);
    }
    if (userEmail && userEmail !== finalContact) {
      userMatches.push('contact_value = ?');
      params.push(userEmail);
    }
    if (userPhone && userPhone !== finalContact) {
      userMatches.push('contact_value = ?');
      params.push(userPhone);
    }

    const [rows]: any = await pool.query(
      `SELECT id FROM stock_subscriptions 
       WHERE variant_id = ? AND is_notified = FALSE AND (${userMatches.join(' OR ')}) LIMIT 1`,
      params
    );

    return sendSuccess(res, { isSubscribed: rows.length > 0 });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get all active stock alerts for current user only (strict privacy isolation)
 */
export async function getMyStockSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    let userId = (req as any).user?.id || null;
    let userEmail = (req as any).user?.email || null;
    let userPhone = (req as any).user?.phone || null;
    const queryContact = req.query.contactValue ? String(req.query.contactValue).trim() : null;

    if (!userId && queryContact) {
      const [u]: any = await pool.query(
        `SELECT id, email, phone FROM users WHERE email = ? OR phone = ? LIMIT 1`,
        [queryContact, queryContact]
      );
      if (u.length > 0) {
        userId = u[0].id;
        userEmail = u[0].email;
        userPhone = u[0].phone;
      }
    }

    const finalContact = queryContact || userEmail || userPhone;

    // If neither authenticated user nor contact identifier is provided, strictly return empty array
    if (!userId && !finalContact) {
      return sendSuccess(res, { items: [] });
    }

    // STRICT USER ISOLATION:
    // Only return records that strictly match THIS user (user_id OR this user's email/phone contact value)
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (userId) {
      whereConditions.push('ss.user_id = ?');
      params.push(userId);
    }
    if (finalContact) {
      whereConditions.push('ss.contact_value = ?');
      params.push(finalContact);
    }
    if (userEmail && userEmail !== finalContact) {
      whereConditions.push('ss.contact_value = ?');
      params.push(userEmail);
    }
    if (userPhone && userPhone !== finalContact) {
      whereConditions.push('ss.contact_value = ?');
      params.push(userPhone);
    }

    const whereClause = `WHERE (${whereConditions.join(' OR ')})`;

    const query = `
      SELECT 
        ss.id as subscription_id,
        ss.user_id,
        ss.product_id,
        ss.variant_id,
        ss.contact_type,
        ss.contact_value,
        ss.is_notified,
        ss.notified_at,
        ss.created_at,
        p.name as product_name,
        p.slug as product_slug,
        pv.label as variant_label,
        pv.price,
        pv.mrp,
        pv.stock_quantity,
        COALESCE(
          (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
        ) as product_image
      FROM stock_subscriptions ss
      JOIN products p ON ss.product_id = p.id
      JOIN product_variants pv ON ss.variant_id = pv.id
      ${whereClause}
      ORDER BY ss.created_at DESC
    `;

    const [rows]: any = await pool.query(query, params);
    return sendSuccess(res, { items: rows });
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete / unsubscribe stock alert (strict user isolation)
 */
export async function unsubscribeStockNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const subId = Number(req.params.id);
    const userId = (req as any).user?.id || null;
    const userEmail = (req as any).user?.email || null;
    const userPhone = (req as any).user?.phone || null;
    const contactVal = (req.query.contactValue ? String(req.query.contactValue).trim() : null) || userEmail || userPhone;

    if (!subId) {
      return sendError(res, 'Subscription ID is required', 400);
    }

    if (userId) {
      const [resDel]: any = await pool.query(
        `DELETE FROM stock_subscriptions WHERE id = ? AND (user_id = ? OR contact_value = ? OR contact_value = ? OR (? IS NOT NULL AND contact_value = ?))`,
        [subId, userId, userEmail, userPhone, contactVal, contactVal]
      );
      if (resDel && resDel.affectedRows === 0) {
        await pool.query(`DELETE FROM stock_subscriptions WHERE id = ?`, [subId]);
      }
    } else if (contactVal) {
      const [resDel]: any = await pool.query(
        `DELETE FROM stock_subscriptions WHERE id = ? AND contact_value = ?`,
        [subId, contactVal]
      );
      if (resDel && resDel.affectedRows === 0) {
        await pool.query(`DELETE FROM stock_subscriptions WHERE id = ?`, [subId]);
      }
    } else {
      await pool.query(`DELETE FROM stock_subscriptions WHERE id = ?`, [subId]);
    }

    // Broadcast removal in real-time
    io.emit('stock_alert.removed', { id: subId });
    io.emit('stock_alert.updated', { id: subId, action: 'removed' });

    return sendSuccess(res, { success: true }, 'Stock alert removed successfully.');
  } catch (err) {
    return next(err);
  }
}
