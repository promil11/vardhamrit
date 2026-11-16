import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { createOrder, getUserOrders, getOrderById, cancelOrder } from '../services/orderService';
import { calculateDynamicDistanceFees } from '../utils/pricing';
import { sendSuccess } from '../utils/response';

export const calculateFeesSchema = z.object({
  address: z.any().optional(),
  subtotal: z.number().optional().default(0),
  items: z.array(z.object({
    variantId: z.number(),
    quantity: z.number(),
  })).optional(),
});

export const createOrderSchema = z.object({
  addressId: z.number().int().positive().optional(),
  address: z.any().optional(),
  paymentMethod: z.enum(['ONLINE', 'COD', 'UPI', 'CARDS', 'NETBANKING']).default('UPI'),
  couponCode: z.string().optional().nullable(),
  coinsToRedeem: z.number().int().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        variantId: z.number(),
        quantity: z.number().min(1),
      })
    )
    .optional(),
});

export const orderParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const cancelOrderSchema = z.object({
  reason: z.string().optional(),
});

export async function placeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2;
    const { addressId, address, paymentMethod, couponCode, coinsToRedeem, items } = req.body;

    const normalizedPaymentMethod =
      paymentMethod === 'COD' ? 'COD' : paymentMethod === 'ONLINE' ? 'ONLINE' : 'UPI';

    const order = await createOrder({
      userId,
      addressId,
      address,
      paymentMethod: normalizedPaymentMethod,
      couponCode: couponCode || undefined,
      coinsToRedeem: Number(coinsToRedeem) || 0,
      items,
    });

    return sendSuccess(res, order, 'Order placed successfully', 201);
  } catch (err) {
    return next(err);
  }
}

export async function getOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendSuccess(res, { items: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } });
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const result = await getUserOrders(userId, page, limit);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function getSingleOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2;
    const orderId = Number(req.params.id);

    // If user is not admin, ensure they only access their own order
    const order = await getOrderById(orderId, req.user?.role === 'admin' ? undefined : userId);
    return sendSuccess(res, order);
  } catch (err) {
    return next(err);
  }
}

export async function handleCalculateDeliveryFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { address, subtotal, items } = req.body;
    let verifiedSubtotal = Number(subtotal) || 0;
    const dealPrices: Record<number, number> = {};

    if (items && Array.isArray(items) && items.length > 0) {
      const variantIds = items.map((it: any) => Number(it.variantId)).filter(Boolean);
      if (variantIds.length > 0) {
        const [variantRows]: any = await pool.query(
          'SELECT id, price FROM product_variants WHERE id IN (?)',
          [variantIds]
        );
        const [promoRows]: any = await pool.query(
          `SELECT variant_id, deal_price FROM promotions WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
          [variantIds]
        );
        const promoMap = new Map<number, number>();
        for (const p of promoRows) {
          promoMap.set(p.variant_id, Number(p.deal_price));
        }
        const variantMap = new Map<number, number>();
        for (const v of variantRows) {
          variantMap.set(v.id, Number(v.price));
        }

        let calcSubtotal = 0;
        for (const it of items) {
          const vId = Number(it.variantId);
          const basePrice = variantMap.get(vId) || 0;
          const finalPrice = promoMap.has(vId) ? promoMap.get(vId)! : basePrice;
          dealPrices[vId] = finalPrice;
          calcSubtotal += finalPrice * Number(it.quantity || 1);
        }
        if (calcSubtotal > 0) {
          verifiedSubtotal = calcSubtotal;
        }
      }
    }

    const result = calculateDynamicDistanceFees(address, verifiedSubtotal);
    return sendSuccess(res, {
      ...result,
      verifiedSubtotal,
      dealPrices,
    });
  } catch (err) {
    return next(err);
  }
}

export async function cancelUserOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2;
    const orderId = Number(req.params.id);
    const { reason } = req.body;

    const cancelled = await cancelOrder(orderId, userId, reason);
    return sendSuccess(res, cancelled, 'Order cancelled successfully');
  } catch (err) {
    return next(err);
  }
}
