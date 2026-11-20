import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';

// Ensure avatars directory exists
const avatarsDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `avatar-${uniqueSuffix}${cleanExt}`);
  },
});

const avatarMulter = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).any();

export const avatarUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    avatarMulter(req, res, (err: any) => {
      if (err) {
        return sendError(res, err.message || 'File upload failed', 400);
      }
      next();
    });
  } else {
    next();
  }
};

/**
 * POST /api/v1/user/avatar
 * Supports multipart/form-data file uploads and base64 payloads.
 * Automatically saves image to /uploads/avatars/ and updates user avatar if authenticated.
 */
export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    let avatarUrl: string | null = null;

    // 1. Check if multipart file uploaded
    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > 0) {
      avatarUrl = `/uploads/avatars/${files[0].filename}`;
    } else if ((req as any).file) {
      avatarUrl = `/uploads/avatars/${(req as any).file.filename}`;
    }

    // 2. Check if Base64 string payload provided
    const base64Data = (req.body?.imageBase64 || req.body?.base64 || req.body?.image || req.body?.avatar || '').trim();
    if (!avatarUrl && base64Data) {
      let ext = '.jpg';
      let cleanBase64 = base64Data;
      const match = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        const rawExt = match[1].toLowerCase();
        ext = rawExt === 'jpeg' ? '.jpg' : `.${rawExt}`;
        cleanBase64 = match[2];
      }
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `avatar-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
      const filepath = path.join(avatarsDir, filename);
      await fs.promises.writeFile(filepath, buffer);
      avatarUrl = `/uploads/avatars/${filename}`;
    }

    if (!avatarUrl) {
      return sendError(res, 'No image file or base64 data provided', 400);
    }

    // 3. If authenticated, update user's avatar_url in database
    if (userId) {
      await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);
    }

    return sendSuccess(
      res,
      {
        url: avatarUrl,
        avatar_url: avatarUrl,
        userId: userId || null,
      },
      'Profile image uploaded successfully'
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/user/profile
 * Returns authenticated user details, address count, order count, wishlist count, and coin balance.
 */
export async function getUserProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const [users]: any = await pool.query(
      `SELECT id, name, email, phone, role, coins_balance, referral_code, referred_by, preferred_blend, avatar_url, created_at FROM users WHERE id = ?`,
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
        avatar_url: user.avatar_url || null,
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
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendSuccess(res, {
        current_balance: 0,
        transactions: [],
      });
    }

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
 * Max coin balance is strictly capped at 500. If user crosses/reaches 500, no update is made.
 */
export async function claimScratchCard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }
    const { orderNumber, orderId, coinsEarned } = req.body;
    const coinsToAdd = Math.max(1, Math.round(Number(coinsEarned) || 5));
    const MAX_TEA_COINS = 500;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch current coin balance with row lock
      const [uRows]: any = await connection.query(
        'SELECT coins_balance FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      const currentBalance = Number(uRows[0]?.coins_balance) || 0;

      // If user has already reached or crossed 500 coins, no updation needed!
      if (currentBalance >= MAX_TEA_COINS) {
        await connection.commit();
        return sendSuccess(res, {
          claimed: true,
          coinsAdded: 0,
          newBalance: currentBalance,
          maxReached: true,
          orderNumber,
          message: 'Maximum limit of 500 Tea Coins reached. Redeem your coins at checkout to earn more!',
        });
      }

      // Calculate allowed coins to add without exceeding MAX_TEA_COINS (500)
      const allowedCoinsToAdd = Math.min(coinsToAdd, Math.max(0, MAX_TEA_COINS - currentBalance));
      const newBalance = currentBalance + allowedCoinsToAdd;

      if (allowedCoinsToAdd > 0) {
        // 2. Credit coins up to 500
        await connection.query(
          'UPDATE users SET coins_balance = ? WHERE id = ?',
          [newBalance, userId]
        );

        // 3. Record in coin_transactions ledger
        const desc = orderNumber
          ? `Scratch card reward on Order #${orderNumber}`
          : 'Scratch card cashback reward';

        await connection.query(
          `INSERT INTO coin_transactions 
           (user_id, order_id, amount, transaction_type, description, balance_after)
           VALUES (?, ?, ?, 'ORDER_EARNED', ?, ?)`,
          [userId, orderId && !isNaN(Number(orderId)) ? Number(orderId) : null, allowedCoinsToAdd, desc, newBalance]
        );
      }

      await connection.commit();

      return sendSuccess(res, {
        claimed: true,
        coinsAdded: allowedCoinsToAdd,
        newBalance,
        maxReached: newBalance >= MAX_TEA_COINS,
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

/**
 * PUT/PATCH /api/v1/user/profile
 * Updates basic profile details: name, email, phone, morning cup preference.
 */
export async function updateUserProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendError(res, 'Authentication required', 401);
    }

    const { name, email, phone, preferredBlend, favoriteMorningCup, avatarUrl, avatar_url } = req.body;

    const [currentUsers]: any = await pool.query(
      'SELECT id, name, email, phone, role, coins_balance, referral_code, preferred_blend, avatar_url FROM users WHERE id = ?',
      [userId]
    );

    if (currentUsers.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const currentUser = currentUsers[0];
    const newName = name !== undefined ? String(name).trim() : currentUser.name;
    let newEmail = email !== undefined ? String(email).trim().toLowerCase() : currentUser.email;
    let newPhone = phone !== undefined ? String(phone).trim() : currentUser.phone;
    const newBlend = (favoriteMorningCup || (preferredBlend !== undefined ? preferredBlend : currentUser.preferred_blend))?.trim();
    const newAvatar = avatarUrl !== undefined ? avatarUrl : (avatar_url !== undefined ? avatar_url : currentUser.avatar_url);

    if (newName && newName.length < 2) {
      return sendError(res, 'Name must be at least 2 characters long', 400);
    }

    // Check email uniqueness if changing email
    if (newEmail && newEmail !== currentUser.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return sendError(res, 'Please provide a valid email address', 400);
      }

      const [existingEmail]: any = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [newEmail, userId]
      );
      if (existingEmail.length > 0) {
        return sendError(res, 'This email address is already in use by another account', 400);
      }
    }

    // Check phone uniqueness if changing phone
    if (newPhone) {
      const clean = newPhone.replace(/[^0-9]/g, '');
      const clean10 = clean.length > 10 ? clean.slice(-10) : clean;
      if (clean10.length === 10) {
        newPhone = `+91${clean10}`;
        if (newPhone !== currentUser.phone) {
          const variants = [`+91${clean10}`, clean10, `0${clean10}`, `91${clean10}`];
          const [existingPhone]: any = await pool.query(
            'SELECT id FROM users WHERE phone IN (?, ?, ?, ?) AND id != ? LIMIT 1',
            [...variants, userId]
          );
          if (existingPhone.length > 0) {
            return sendError(res, 'This mobile number is already linked to another account', 400);
          }
        }
      }
    }

    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ?, preferred_blend = ?, avatar_url = ? WHERE id = ?',
      [newName || currentUser.name, newEmail || null, newPhone || null, newBlend || 'Normal Chai', newAvatar || null, userId]
    );

    const updatedUser = {
      ...currentUser,
      name: newName || currentUser.name,
      email: newEmail || null,
      phone: newPhone || null,
      avatar_url: newAvatar || null,
      preferred_blend: newBlend || 'Normal Chai',
      favorite_morning_cup: newBlend || 'Normal Chai',
    };

    return sendSuccess(res, { user: updatedUser }, 'Profile updated successfully');
  } catch (err) {
    return next(err);
  }
}
