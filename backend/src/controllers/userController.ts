import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';

/**
 * GET /api/v1/user/profile
 * Returns authenticated user details, address count, order count, wishlist count, and coin balance.
 */
export async function getUserProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2; // Default to Rahul Sharma (id 2)

    const [users]: any = await pool.query(
      `SELECT id, name, email, phone, role, coins_balance, referral_code, referred_by, preferred_blend, created_at FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const user = users[0];

    // Compute stats
    const [[orderStats]]: any = await pool.query(
      `SELECT 
        COUNT(o.id) as total_orders,
        COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN o.total_amount ELSE 0 END), 0) as total_spent,
        COALESCE(SUM(CASE WHEN o.order_status != 'CANCELLED' THEN (o.discount_amount + o.coins_discount) ELSE 0 END), 0) as total_order_discounts,
        COALESCE((
          SELECT SUM(GREATEST(0, (COALESCE(pv.mrp, oi.unit_price) - oi.unit_price)) * oi.quantity)
          FROM order_items oi
          JOIN orders o2 ON oi.order_id = o2.id
          LEFT JOIN product_variants pv ON oi.variant_id = pv.id
          WHERE o2.user_id = ? AND o2.order_status != 'CANCELLED'
        ), 0) as total_mrp_savings
       FROM orders o 
       WHERE o.user_id = ?`,
      [userId, userId]
    );

    const totalSaved = Math.round(
      (Number(orderStats?.total_order_discounts) || 0) + 
      (Number(orderStats?.total_mrp_savings) || 0)
    );

    const [[wishlistStats]]: any = await pool.query(
      `SELECT COUNT(*) as total_wishlist FROM wishlists WHERE user_id = ?`,
      [userId]
    );

    const [[addressStats]]: any = await pool.query(
      `SELECT COUNT(*) as total_addresses FROM addresses WHERE user_id = ?`,
      [userId]
    );

    const coinsBalance = Number(user.coins_balance) || 0;

    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        coins_balance: coinsBalance,
        referral_code: user.referral_code,
        referred_by: user.referred_by,
        preferred_blend: user.preferred_blend || 'Normal Chai',
        favorite_morning_cup: user.preferred_blend || 'Normal Chai',
        member_since: user.created_at,
        tier: 'Tea Connoisseur',
        stats: {
          orders_count: Number(orderStats.total_orders) || 0,
          total_spent: Number(orderStats.total_spent) || 0,
          total_saved: totalSaved,
          wishlist_count: Number(wishlistStats.total_wishlist) || 0,
          address_count: Number(addressStats.total_addresses) || 0,
          coins_balance: coinsBalance,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT/PATCH /api/v1/user/preferences
 * Updates user tea taste preferences (e.g. favorite morning cup).
 */
export async function updateUserPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { preferredBlend, favoriteMorningCup } = req.body;
    const blendToSave = (favoriteMorningCup || preferredBlend || '').trim();

    if (!blendToSave) {
      return sendError(res, 'Preferred blend is required', 400);
    }

    await pool.query('UPDATE users SET preferred_blend = ? WHERE id = ?', [blendToSave, userId]);

    // Insert in-app notification in database for user
    const notifTitle = 'Taste Profile Saved! ☕';
    const notifBody = `Your preference for "${blendToSave}" is successfully saved in database. Now you will get notifications according to your preference.`;

    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, action_route, cta_text)
         VALUES (?, ?, ?, 'PREFERENCE_UPDATE', '/(tabs)/profile', 'View Taste Profile')`,
        [userId, notifTitle, notifBody]
      );
    } catch (notifErr) {
      console.warn('Could not insert preference notification into database:', notifErr);
    }

    return sendSuccess(
      res,
      {
        preferred_blend: blendToSave,
        favorite_morning_cup: blendToSave,
        notification: {
          title: notifTitle,
          body: notifBody,
        },
      },
      'Favorite morning cup updated successfully'
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/user/coins
 * Returns ledger of coin transactions for loyalty rewards.
 */
export async function getCoinHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2;

    const [transactions]: any = await pool.query(
      `SELECT id, transaction_type as type, amount, description, order_id as reference_id, balance_after, created_at
       FROM coin_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    const [uRow]: any = await pool.query(
      `SELECT coins_balance FROM users WHERE id = ?`,
      [userId]
    );
    const currentBalance = uRow.length > 0 ? Number(uRow[0].coins_balance) : 0;

    return sendSuccess(res, {
      current_balance: currentBalance,
      transactions,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/user/claim-scratch-card
 * Credits coins won from a scratch card directly to the user's wallet.
 */
export async function claimScratchCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id || 2;
    const { orderNumber, orderId, coinsEarned } = req.body;
    const coinsToAdd = Math.max(1, Math.round(Number(coinsEarned) || 5));

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Credit coins to users.coins_balance
      await connection.query(
        'UPDATE users SET coins_balance = coins_balance + ? WHERE id = ?',
        [coinsToAdd, userId]
      );

      // 2. Fetch updated balance
      const [uRows]: any = await connection.query(
        'SELECT coins_balance FROM users WHERE id = ?',
        [userId]
      );
      const newBalance = Number(uRows[0]?.coins_balance) || 0;

      // 3. Record in coin_transactions ledger
      const desc = orderNumber
        ? `Scratch card reward on Order #${orderNumber}`
        : 'Scratch card cashback reward';

      await connection.query(
        `INSERT INTO coin_transactions 
         (user_id, order_id, amount, transaction_type, description, balance_after)
         VALUES (?, ?, ?, 'ORDER_EARNED', ?, ?)`,
        [userId, orderId && !isNaN(Number(orderId)) ? Number(orderId) : null, coinsToAdd, desc, newBalance]
      );

      await connection.commit();

      return sendSuccess(res, {
        claimed: true,
        coinsAdded: coinsToAdd,
        newBalance,
        orderNumber,
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    return next(err);
  }
}
