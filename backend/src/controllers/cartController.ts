import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';

export const addToCartSchema = z.object({
  variantId: z.number().int().positive('Valid variant ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const syncCartSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })
  ),
});

export const cartItemParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export async function getCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    const [items]: any = await pool.query(
      `SELECT c.id, c.variant_id, c.quantity, c.created_at,
              pv.label as variant_label, pv.price, pv.stock, pv.sku,
              p.id as product_id, p.name as product_name,
              COALESCE(
                (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
                '/images/tea/normal.png'
              ) as product_image
       FROM cart_items c
       JOIN product_variants pv ON c.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    let subtotal = 0;
    let totalQuantity = 0;
    let allInStock = true;

    // Check active promotions for cart items
    const variantIds = items.map((i: any) => i.variant_id);
    const promoMap = new Map<number, number>();
    if (variantIds.length > 0) {
      const [promoRows]: any = await pool.query(
        `SELECT variant_id, deal_price FROM promotions WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
        [variantIds]
      );
      for (const p of promoRows) {
        promoMap.set(p.variant_id, Number(p.deal_price));
      }
    }

    for (const item of items) {
      const originalPrice = Number(item.price);
      if (promoMap.has(item.variant_id)) {
        item.original_price = originalPrice;
        item.price = promoMap.get(item.variant_id)!;
        item.is_on_deal = true;
      } else {
        item.price = originalPrice;
      }
      item.line_total = Number((item.price * item.quantity).toFixed(2));
      item.in_stock = item.stock >= item.quantity;
      if (!item.in_stock) {
        allInStock = false;
      }
      subtotal += item.line_total;
      totalQuantity += item.quantity;
    }

    return sendSuccess(res, {
      items,
      subtotal: Number(subtotal.toFixed(2)),
      totalQuantity,
      allInStock,
    });
  } catch (err) {
    return next(err);
  }
}

export async function addToCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { variantId, quantity } = req.body;

    // Check variant exists and has stock
    const [variants]: any = await pool.query(
      'SELECT id, product_id, stock, price FROM product_variants WHERE id = ?',
      [variantId]
    );

    if (variants.length === 0) {
      return sendError(res, 'Product variant not found', 404);
    }

    const variant = variants[0];
    if (variant.stock < quantity) {
      return sendError(res, `Insufficient stock. Only ${variant.stock} available.`, 400);
    }

    // Check existing item in user's cart
    const [existing]: any = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND variant_id = ?',
      [userId, variantId]
    );

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + quantity;
      if (variant.stock < newQuantity) {
        return sendError(res, `Cannot add more. You have ${existing[0].quantity} in cart and only ${variant.stock} are in stock.`, 400);
      }

      await pool.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, variant.product_id, variantId, quantity]
      );
    }

    return getCart(req, res, next);
  } catch (err) {
    return next(err);
  }
}

export async function updateCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const cartItemId = Number(req.params.id);
    const { quantity } = req.body;

    const [items]: any = await pool.query(
      `SELECT c.id, c.variant_id, pv.stock 
       FROM cart_items c
       JOIN product_variants pv ON c.variant_id = pv.id
       WHERE c.id = ? AND c.user_id = ?`,
      [cartItemId, userId]
    );

    if (items.length === 0) {
      return sendError(res, 'Cart item not found', 404);
    }

    const item = items[0];
    if (item.stock < quantity) {
      return sendError(res, `Only ${item.stock} units available in stock`, 400);
    }

    await pool.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [quantity, cartItemId]
    );

    return getCart(req, res, next);
  } catch (err) {
    return next(err);
  }
}

export async function removeCartItem(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const cartItemId = Number(req.params.id);

    const [result]: any = await pool.query(
      'DELETE FROM cart_items WHERE (id = ? OR variant_id = ?) AND user_id = ?',
      [cartItemId, cartItemId, userId]
    );

    if (result.affectedRows === 0) {
      return sendError(res, 'Cart item not found', 404);
    }

    return getCart(req, res, next);
  } catch (err) {
    return next(err);
  }
}

export async function syncCart(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user!.userId;
    const { items } = req.body;

    await connection.beginTransaction();

    await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    for (const item of items) {
      const [variants]: any = await connection.query(
        'SELECT id, product_id, stock FROM product_variants WHERE id = ?',
        [item.variantId]
      );
      if (variants.length > 0) {
        const variant = variants[0];
        const qty = Math.min(item.quantity, variant.stock > 0 ? variant.stock : 10);
        await connection.query(
          'INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
          [userId, variant.product_id, item.variantId, qty]
        );
      }
    }

    await connection.commit();
    connection.release();

    return getCart(req, res, next);
  } catch (err) {
    await connection.rollback();
    connection.release();
    return next(err);
  }
}

export async function clearCart(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    return sendSuccess(res, { items: [], subtotal: 0, totalQuantity: 0, allInStock: true }, 'Cart cleared');
  } catch (err) {
    return next(err);
  }
}
