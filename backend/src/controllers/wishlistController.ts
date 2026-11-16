import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';

/**
 * GET /api/v1/wishlist
 * Returns the authenticated user's bookmarked products.
 */
export async function getWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 1; // Fallback to demo user if not logged in

    const [rows]: any = await pool.query(
      `SELECT 
        w.id as wishlist_id,
        w.created_at as saved_at,
        p.id,
        p.name,
        p.slug,
        p.tagline,
        COALESCE(
          (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
        ) as image,
        p.rating,
        p.review_count,
        p.category_id,
        c.name as category_name,
        (SELECT MIN(pv.price) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE) as price,
        (SELECT MIN(pv.mrp) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE) as originalPrice
       FROM wishlists w
       JOIN products p ON w.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ? AND p.is_active = TRUE AND p.deleted_at IS NULL
       ORDER BY w.created_at DESC`,
      [userId]
    );

    return sendSuccess(res, { items: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/wishlist/:productId/toggle
 * Adds or removes a product from the user's wishlist.
 */
export async function toggleWishlist(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 1;
    const productId = Number(req.params.productId);

    if (isNaN(productId)) {
      return sendError(res, 'Invalid product ID', 400);
    }

    // Check if already in wishlist
    const [existing]: any = await pool.query(
      `SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );

    let wishlisted = false;

    if (existing.length > 0) {
      await pool.query(`DELETE FROM wishlists WHERE user_id = ? AND product_id = ?`, [userId, productId]);
      wishlisted = false;
    } else {
      await pool.query(`INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)`, [userId, productId]);
      wishlisted = true;
    }

    return sendSuccess(res, {
      product_id: productId,
      wishlisted,
      message: wishlisted ? 'Added to wishlist' : 'Removed from wishlist',
    });
  } catch (err) {
    return next(err);
  }
}
