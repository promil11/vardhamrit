import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { validateCoupon } from '../services/couponService';
import { calculateOrderTotals } from '../utils/pricing';
import { sendSuccess, sendError } from '../utils/response';

export const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  paymentMethod: z.enum(['ONLINE', 'COD', 'ALL']).optional().default('ALL'),
  subtotal: z.number().positive().optional(),
});

export async function checkCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req.user as any)?.id || Number(req.body.userId) || 0;
    const { code, paymentMethod, subtotal: providedSubtotal } = req.body;

    let subtotal = providedSubtotal;

    // If subtotal was not explicitly provided, calculate directly from user's live cart
    if (!subtotal) {
      if (!userId) {
        return sendError(res, 'Subtotal is required to validate coupon', 400);
      }
      const [items]: any = await pool.query(
        `SELECT c.quantity, pv.price 
         FROM cart_items c
         JOIN product_variants pv ON c.variant_id = pv.id
         WHERE c.user_id = ?`,
        [userId]
      );

      if (items.length === 0) {
        return sendError(res, 'Your cart is empty. Add items before applying coupon.', 400);
      }

      subtotal = items.reduce(
        (sum: number, it: any) => sum + Number(it.price) * it.quantity,
        0
      );
    }

    const result = await validateCoupon(code, userId, subtotal, paymentMethod);
    const totals = calculateOrderTotals(subtotal, result.discountAmount);

    return sendSuccess(res, {
      ...result,
      totals,
    });
  } catch (err) {
    return next(err);
  }
}

export async function listCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req.user as any)?.id || Number(req.query.userId) || 0;

    let hasPriorOrders = false;
    const userUsageMap = new Map<number, number>();

    if (userId > 0) {
      const [orderRows]: any = await pool.query(
        "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status != 'CANCELLED'",
        [userId]
      );
      hasPriorOrders = (orderRows[0]?.count || 0) > 0;

      const [usageRows]: any = await pool.query(
        'SELECT coupon_id, COUNT(*) as count FROM coupon_usages WHERE user_id = ? GROUP BY coupon_id',
        [userId]
      );
      usageRows.forEach((u: any) => userUsageMap.set(u.coupon_id, Number(u.count)));
    }

    const [coupons]: any = await pool.query(
      `SELECT id, code, title, description, discount_type, discount_value, min_order_value, max_discount, is_first_order_only, usage_limit_per_user, valid_from, valid_to, is_active
       FROM coupons
       WHERE is_active = 1 AND (valid_to IS NULL OR valid_to > NOW()) AND (deleted_at IS NULL)
       ORDER BY discount_value DESC`
    );

    // Filter available coupons according to first-order and per-user usage limits
    const availableCoupons = coupons.filter((c: any) => {
      const isFirstOnly = Boolean(c.is_first_order_only) || c.code === 'WELCOMEFIRST';
      if (isFirstOnly) {
        if (hasPriorOrders || (userUsageMap.get(c.id) || 0) > 0) {
          return false;
        }
      }
      const usageLimit = Number(c.usage_limit_per_user || 0);
      if (usageLimit > 0) {
        const usedCount = userUsageMap.get(c.id) || 0;
        if (usedCount >= usageLimit) {
          return false;
        }
      }
      return true;
    });

    return sendSuccess(res, { coupons: availableCoupons });
  } catch (err) {
    return next(err);
  }
}
