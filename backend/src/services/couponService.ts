import { PoolConnection } from 'mysql2/promise';
import pool from '../config/db';
import { AppError } from '../middleware/errorHandler';

export interface CouponValidationResult {
  valid: boolean;
  couponId: number;
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  discountAmount: number;
  message: string;
}

export async function validateCoupon(
  code: string,
  userId: number,
  subtotal: number,
  paymentMethod: 'ONLINE' | 'COD' | 'ALL' = 'ALL',
  conn?: PoolConnection
): Promise<CouponValidationResult> {
  const queryExecutor = conn || pool;
  const upperCode = code.trim().toUpperCase();

  const [coupons]: any = await queryExecutor.query(
    `SELECT id, code, discount_type, discount_value, max_discount, min_order_value, 
            usage_limit_total, usage_limit_per_user, is_first_order_only, valid_from, valid_to, 
            is_active
     FROM coupons 
     WHERE code = ? AND deleted_at IS NULL`,
    [upperCode]
  );

  if (coupons.length === 0) {
    throw new AppError(`Coupon code '${upperCode}' does not exist or has expired`, 404);
  }

  const coupon = coupons[0];

  // 1. Active status check
  if (!coupon.is_active || Number(coupon.is_active) === 0) {
    throw new AppError(`Coupon '${upperCode}' is currently disabled`, 400);
  }

  // 2. Validity date range check
  const now = new Date();
  const validFrom = new Date(coupon.valid_from);
  const validTo = new Date(coupon.valid_to);

  if (now < validFrom) {
    throw new AppError(`Coupon '${upperCode}' is not active yet`, 400);
  }
  if (now > validTo) {
    throw new AppError(`Coupon '${upperCode}' has expired`, 400);
  }

  // 4. Minimum order value check
  const minOrderValue = Number(coupon.min_order_value || 0);
  if (subtotal < minOrderValue) {
    throw new AppError(
      `Minimum cart value of ₹${minOrderValue} required for coupon '${upperCode}' (current: ₹${subtotal})`,
      400
    );
  }

  // 5. Total usage limit check
  if (coupon.usage_limit_total !== null && coupon.usage_limit_total !== undefined) {
    const [totalUsageRows]: any = await queryExecutor.query(
      'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ?',
      [coupon.id]
    );
    if (totalUsageRows[0]?.count >= coupon.usage_limit_total) {
      throw new AppError(`Coupon '${upperCode}' has reached its total usage limit`, 400);
    }
  }

  // 6. Per-user usage limit check
  const usageLimitPerUser = Number(coupon.usage_limit_per_user || 0);
  if (usageLimitPerUser > 0 && userId > 0) {
    const [userUsageRows]: any = await queryExecutor.query(
      'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ? AND user_id = ?',
      [coupon.id, userId]
    );
    if (userUsageRows[0]?.count >= usageLimitPerUser) {
      throw new AppError(
        `You have already used coupon '${upperCode}'. It cannot be used again.`,
        400
      );
    }
  }

  // 7. First order check (exclusively for first-time buyers, not valid for next time orders)
  const isFirstOrderOnly = Boolean(coupon.is_first_order_only) || upperCode === 'WELCOMEFIRST';
  if (isFirstOrderOnly && userId > 0) {
    const [orderRows]: any = await queryExecutor.query(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status != 'CANCELLED'",
      [userId]
    );
    if (orderRows[0]?.count > 0) {
      throw new AppError(
        `Coupon '${upperCode}' is exclusively valid for your first order. It cannot be used for next time orders with the same account.`,
        400
      );
    }
  }

  // 7. Calculate discount amount
  let discountAmount = 0;
  const discountType = (coupon.discount_type || 'PERCENT').toUpperCase() as 'PERCENT' | 'FLAT';
  const couponValue = Number(coupon.discount_value);

  if (discountType === 'PERCENT') {
    discountAmount = (subtotal * couponValue) / 100;
    if (coupon.max_discount) {
      discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
    }
  } else if (discountType === 'FLAT') {
    discountAmount = Math.min(couponValue, subtotal);
  }

  discountAmount = Number(discountAmount.toFixed(2));

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    type: discountType,
    value: couponValue,
    discountAmount,
    message: `Coupon '${upperCode}' applied! You save ₹${discountAmount}.`,
  };
}
