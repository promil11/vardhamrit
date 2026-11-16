import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';

// Zod validation schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15).optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['customer', 'admin']).optional().default('customer'),
  inviteCode: z.string().trim().optional().nullable(),
  preferredBlend: z.string().trim().max(100).optional().nullable(),
  favoriteMorningCup: z.string().trim().max(100).optional().nullable(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone must be provided',
  path: ['email'],
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
  expectedRole: z.enum(['customer', 'admin']).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const pushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token is required'),
});

export const sendOtpSchema = z.object({
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  otp: z.string().min(4, 'OTP must be 4 digits'),
});

export function getPhoneVariants(rawPhone: string): string[] {
  const clean = rawPhone.replace(/[^0-9]/g, '');
  const last10 = clean.slice(-10);
  return [
    last10,
    `+91${last10}`,
    `91${last10}`,
    rawPhone.trim(),
  ];
}

async function generateUniqueReferralCode(name: string, connection: any): Promise<string> {
  const cleanPrefix = (name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'CHAI');
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const candidate = `${cleanPrefix}${randomSuffix}`;
    const [existing]: any = await connection.query(
      'SELECT id FROM users WHERE referral_code = ? LIMIT 1',
      [candidate]
    );
    if (existing.length === 0) {
      return candidate;
    }
  }
  return `VRD${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export async function verifyInviteCode(req: Request, res: Response, next: NextFunction) {
  try {
    const code = String(req.query.code || req.body?.code || '').trim().toUpperCase();
    if (!code) {
      return sendError(res, 'Invite code is required', 400);
    }

    const [users]: any = await pool.query(
      'SELECT id, name, referral_code, avatar_url FROM users WHERE referral_code = ? AND status = "active" LIMIT 1',
      [code]
    );

    if (users.length === 0) {
      return sendError(res, 'Invalid or expired invite code', 404);
    }

    const referrer = users[0];
    const firstName = referrer.name.split(' ')[0] || referrer.name;

    return sendSuccess(
      res,
      {
        valid: true,
        code: referrer.referral_code,
        referrerName: referrer.name,
        referrerFirstName: firstName,
        bonusCoins: 50,
        welcomeCoins: 50,
        totalCoinsOnSignup: 100,
        description: `Invite code from ${firstName}! You both get 50 Tea Coins (₹50).`,
      },
      'Invite code verified successfully'
    );
  } catch (err) {
    return next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const {
      name,
      email,
      phone,
      password,
      role = 'customer',
      inviteCode,
      preferredBlend,
      favoriteMorningCup,
    } = req.body;
    const morningCup = (favoriteMorningCup || preferredBlend || '').trim();
    if (!morningCup) {
      return sendError(res, 'Please select your Favorite Morning Cup to complete registration', 400);
    }

    // Check if user already exists
    const [existing]: any = await connection.query(
      'SELECT id, email, phone FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)',
      [email || null, phone || null]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (email && match.email === email) {
        return sendError(res, 'An account with this email already exists', 409);
      }
      if (phone && match.phone === phone) {
        return sendError(res, 'An account with this phone number already exists', 409);
      }
      return sendError(res, 'User already exists', 409);
    }

    await connection.beginTransaction();

    // Verify referrer if invite code provided
    let referrer: any = null;
    if (inviteCode && String(inviteCode).trim()) {
      const cleanCode = String(inviteCode).trim().toUpperCase();
      const [referrerRows]: any = await connection.query(
        'SELECT id, name, coins_balance, referral_code FROM users WHERE referral_code = ? AND status = "active" LIMIT 1 FOR UPDATE',
        [cleanCode]
      );
      if (referrerRows.length > 0) {
        referrer = referrerRows[0];
      } else {
        await connection.rollback();
        return sendError(res, 'Invalid invite code entered. Please check and try again or proceed without a code.', 400);
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newReferralCode = await generateUniqueReferralCode(name, connection);
    const initialCoins = referrer ? 100 : 50;

    const [result]: any = await connection.query(
      `INSERT INTO users (name, email, phone, password_hash, role, coins_balance, referral_code, referred_by, preferred_blend)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, passwordHash, role, initialCoins, newReferralCode, referrer ? referrer.id : null, morningCup]
    );

    const userId = result.insertId;

    if (referrer) {
      // 1. Welcome Bonus for new user (50 coins)
      await connection.query(
        `INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
         VALUES (?, 50, 'WELCOME_BONUS', 'Welcome to Vardhamrit Tea Club', 50)`,
        [userId]
      );

      // 2. Referral Joiner Bonus for new user (50 coins)
      await connection.query(
        `INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
         VALUES (?, 50, 'REFERRAL_BONUS', ?, 100)`,
        [userId, `Invite bonus: Joined using ${referrer.name}'s invite code (${referrer.referral_code})`]
      );

      // 3. Reward Referrer with 50 coins
      const updatedReferrerBal = Number(referrer.coins_balance || 0) + 50;
      await connection.query(
        'UPDATE users SET coins_balance = ? WHERE id = ?',
        [updatedReferrerBal, referrer.id]
      );

      await connection.query(
        `INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
         VALUES (?, 50, 'REFERRAL_BONUS', ?, ?)`,
        [referrer.id, `Referral reward: ${name} joined with your invite code!`, updatedReferrerBal]
      );
    } else {
      // Standard Welcome Bonus (50 coins)
      await connection.query(
        `INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
         VALUES (?, 50, 'WELCOME_BONUS', 'Welcome to Vardhamrit Tea Club', 50)`,
        [userId]
      );
    }

    await connection.commit();

    const tokenPayload = { userId, role, email, phone };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return sendSuccess(
      res,
      {
        user: {
          id: userId,
          name,
          email,
          phone,
          role,
          coins_balance: initialCoins,
          referral_code: newReferralCode,
          referred_by: referrer ? referrer.id : null,
          preferred_blend: morningCup,
          favorite_morning_cup: morningCup,
        },
        accessToken,
        refreshToken,
        inviteBonusAwarded: !!referrer,
      },
      referrer
        ? `Account created! You received 50 Welcome Coins + 50 Invite Bonus Coins (Total: 100 Coins)!`
        : 'User registered successfully with 50 Welcome Coins!',
      201
    );
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone } = req.body;
    const variants = getPhoneVariants(phone);

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, status FROM users WHERE phone IN (?, ?, ?, ?) LIMIT 1',
      variants
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'No account found with this mobile number. Please create an account to get started.',
      });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact support.', 403);
    }

    return sendSuccess(
      res,
      {
        phone: user.phone,
        name: user.name,
        otp: '1234',
        registered: true,
      },
      'Verification code sent successfully'
    );
  } catch (err) {
    return next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, otp } = req.body;
    const variants = getPhoneVariants(phone);

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, status FROM users WHERE phone IN (?, ?, ?, ?) LIMIT 1',
      variants
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'No account found with this mobile number. Please create an account to get started.',
      });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact support.', 403);
    }

    if (otp !== '1234') {
      return sendError(res, 'Invalid verification code. Please enter 1234.', 400);
    }

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          coins_balance: Number(user.coins_balance) || 0,
          referral_code: user.referral_code,
          referred_by: user.referred_by,
          preferred_blend: user.preferred_blend || 'Normal Chai',
          favorite_morning_cup: user.preferred_blend || 'Normal Chai',
          pushToken: user.push_token,
        },
        accessToken,
        refreshToken,
      },
      'Login successful'
    );
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, password, expectedRole } = req.body;

    const phoneVariants = getPhoneVariants(identifier);

    // Query by email OR phone
    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, password_hash, role, push_token, coins_balance, referral_code, referred_by, preferred_blend, status FROM users WHERE email = ? OR phone IN (?, ?, ?, ?) LIMIT 1',
      [identifier, ...phoneVariants]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'No account found with this mobile number or email. Please create an account to get started.',
      });
    }

    const user = users[0];

    if (user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact support.', 403);
    }

    // Check role restriction if provided (e.g. admin login)
    if (expectedRole && user.role !== expectedRole) {
      return sendError(res, `Access denied for ${expectedRole} role`, 403);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return sendError(res, 'Invalid password. Please check your password and try again.', 401);
    }

    const tokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return sendSuccess(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          coins_balance: Number(user.coins_balance) || 0,
          referral_code: user.referral_code,
          referred_by: user.referred_by,
          preferred_blend: user.preferred_blend || 'Normal Chai',
          favorite_morning_cup: user.preferred_blend || 'Normal Chai',
          pushToken: user.push_token,
        },
        accessToken,
        refreshToken,
      },
      'Login successful'
    );
  } catch (err) {
    return next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;

    let payload: any;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ? LIMIT 1',
      [payload.userId]
    );

    if (users.length === 0) {
      return sendError(res, 'User no longer exists', 401);
    }

    const user = users[0];
    const newPayload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    return sendSuccess(
      res,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      'Tokens refreshed successfully'
    );
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, preferred_blend, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.userId]
    );

    if (users.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const userData = users[0];
    userData.favorite_morning_cup = userData.preferred_blend || 'Normal Chai';

    return sendSuccess(res, userData, 'Profile retrieved successfully');
  } catch (err) {
    return next(err);
  }
}

export async function updatePushToken(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { pushToken } = req.body;

    await pool.query('UPDATE users SET push_token = ? WHERE id = ?', [
      pushToken,
      req.user.userId,
    ]);

    return sendSuccess(res, { pushToken }, 'Push token updated successfully');
  } catch (err) {
    return next(err);
  }
}
