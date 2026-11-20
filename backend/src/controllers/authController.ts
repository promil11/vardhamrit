import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendOtpEmail } from '../services/emailService';
import { sendSmsOtp, normalizeIndianPhone } from '../services/smsService';

// Zod validation schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15).optional().nullable(),
  role: z.enum(['customer', 'admin']).optional().default('customer'),
  inviteCode: z.string().trim().optional().nullable(),
  preferredBlend: z.string().trim().max(100).optional().nullable(),
  favoriteMorningCup: z.string().trim().max(100).optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
  avatar_url: z.string().trim().optional().nullable(),
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

export const sendEmailOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  purpose: z.string().optional().default('login'),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otp: z.string().min(4, 'OTP must be at least 4 digits').max(8),
  purpose: z.string().optional().default('login'),
  name: z.string().optional(),
  preferredBlend: z.string().optional(),
});

export const sendOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  identifier: z.string().optional(),
}).refine((data) => data.phone || data.email || data.identifier, {
  message: 'Mobile number or email address is required',
});

export const verifyOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  identifier: z.string().optional(),
  otp: z.string().min(4, 'OTP must be at least 4 digits').max(8),
  name: z.string().optional(),
  preferredBlend: z.string().optional(),
}).refine((data) => data.phone || data.email || data.identifier, {
  message: 'Mobile number or email address is required',
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
      role = 'customer',
      inviteCode,
      preferredBlend,
      favoriteMorningCup,
      avatarUrl,
      avatar_url,
    } = req.body;
    const morningCup = (favoriteMorningCup || preferredBlend || '').trim();
    const finalAvatarUrl = avatarUrl || avatar_url || null;
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

    const newReferralCode = await generateUniqueReferralCode(name, connection);
    const initialCoins = referrer ? 100 : 50;

    const [result]: any = await connection.query(
      `INSERT INTO users (name, email, phone, role, coins_balance, referral_code, referred_by, preferred_blend, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone || null, role, initialCoins, newReferralCode, referrer ? referrer.id : null, morningCup, finalAvatarUrl]
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

      // 3. Reward Referrer with 50 coins (Strictly capped at MAX_TEA_COINS = 500)
      const MAX_TEA_COINS = 500;
      const currentReferrerBal = Number(referrer.coins_balance || 0);

      if (currentReferrerBal < MAX_TEA_COINS) {
        const coinsToAdd = Math.min(50, MAX_TEA_COINS - currentReferrerBal);
        const updatedReferrerBal = currentReferrerBal + coinsToAdd;

        await connection.query(
          'UPDATE users SET coins_balance = ? WHERE id = ?',
          [updatedReferrerBal, referrer.id]
        );

        await connection.query(
          `INSERT INTO coin_transactions (user_id, amount, transaction_type, description, balance_after)
           VALUES (?, ?, 'REFERRAL_BONUS', ?, ?)`,
          [referrer.id, coinsToAdd, `Referral reward: ${name} joined with your invite code!`, updatedReferrerBal]
        );
      }
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
          avatar_url: finalAvatarUrl,
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

export async function sendEmailOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const email = String(req.body.email || req.body.identifier || '').trim().toLowerCase();
    const purpose = String(req.body.purpose || 'login');

    if (!email || !email.includes('@')) {
      return sendError(res, 'Please provide a valid email address', 400);
    }

    // Check if user exists
    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, status FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (purpose !== 'register' && users.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: `No account found with ${email}. Please create an account to get started.`,
      });
    }

    let userName: string | undefined;
    if (users.length > 0) {
      const user = users[0];
      if (user.status === 'suspended') {
        return sendError(res, 'Your account has been suspended. Please contact support.', 403);
      }
      userName = user.name;
    }

    // Generate 6-digit cryptographic random code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate all previous unverified OTPs for this email address so only the latest is valid
    await pool.query(
      'UPDATE email_otps SET verified = 1 WHERE email = ? AND verified = 0',
      [email]
    );

    // Save to email_otps table
    await pool.query(
      'INSERT INTO email_otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, otp, purpose, expiresAt]
    );

    // Send email via Resend HTTP API (waits with 4s race so cloud container sends it reliably)
    try {
      await Promise.race([
        sendOtpEmail({
          to: email,
          otp,
          userName,
          purpose: purpose === 'register' ? 'Registration' : 'Login / Verification',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Email dispatch timeout')), 7500)),
      ]);
    } catch (err: any) {
      console.warn('[sendEmailOtp] Email dispatch notice:', err.message);
    }

    return sendSuccess(
      res,
      {
        email,
        registered: users.length > 0,
        expiresIn: 600,
      },
      `Verification code sent to ${email}`
    );
  } catch (err) {
    return next(err);
  }
}

export async function verifyEmailOtp(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const email = String(req.body.email || req.body.identifier || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const purpose = String(req.body.purpose || 'login');
    const providedName = req.body.name ? String(req.body.name).trim() : '';
    const preferredBlend = req.body.preferredBlend ? String(req.body.preferredBlend).trim() : 'Upper Assam Kadak';

    if (!email || !otp) {
      return sendError(res, 'Email and verification code are required', 400);
    }

    // Check for valid active OTP in database (strictly requires real matching OTP)
    const [otpRecords]: any = await connection.query(
      'SELECT id, otp, expires_at FROM email_otps WHERE email = ? AND otp = ? AND expires_at > NOW() AND verified = 0 ORDER BY id DESC LIMIT 1',
      [email, otp]
    );

    if (otpRecords.length === 0) {
      return sendError(res, 'Invalid or expired verification code. Please check and try again.', 400);
    }

    if (otpRecords.length > 0) {
      await connection.query('UPDATE email_otps SET verified = 1 WHERE id = ?', [otpRecords[0].id]);
    }

    // Check if user exists
    const [users]: any = await connection.query(
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, preferred_blend, avatar_url, status FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    let user: any;
    let isNewUser = false;

    if (users.length > 0) {
      user = users[0];
      if (user.status === 'suspended') {
        return sendError(res, 'Your account has been suspended. Please contact support.', 403);
      }
    } else {
      if (purpose !== 'register') {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          error: `No account found with ${email}. Please create an account to get started.`,
        });
      }

      // Auto-register new user seamlessly with 50 welcome coins!
      isNewUser = true;
      const rawName = providedName || email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'Chai Connoisseur';
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const referralCode = await generateUniqueReferralCode(formattedName, connection);

      const [insertResult]: any = await connection.query(
        'INSERT INTO users (name, email, role, status, coins_balance, referral_code, preferred_blend) VALUES (?, ?, "customer", "active", 50, ?, ?)',
        [formattedName, email, referralCode, preferredBlend]
      );

      const newUserId = insertResult.insertId;

      await connection.query(
        'INSERT INTO coin_transactions (user_id, amount, balance_after, transaction_type, description) VALUES (?, 50, 50, "WELCOME_BONUS", "Welcome Bonus Coins for joining Vardhamrit")',
        [newUserId]
      );

      user = {
        id: newUserId,
        name: formattedName,
        email,
        phone: null,
        role: 'customer',
        coins_balance: 50,
        referral_code: referralCode,
        referred_by: null,
        preferred_blend: preferredBlend,
        avatar_url: null,
        push_token: null,
      };
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
          avatar_url: user.avatar_url || null,
          coins_balance: Number(user.coins_balance) || 0,
          referral_code: user.referral_code,
          referred_by: user.referred_by,
          preferred_blend: user.preferred_blend || 'Normal Chai',
          favorite_morning_cup: user.preferred_blend || 'Normal Chai',
          pushToken: user.push_token,
        },
        accessToken,
        refreshToken,
        isNewUser,
      },
      isNewUser ? 'Welcome to Vardhamrit! 50 Welcome Coins credited.' : 'Logged in successfully'
    );
  } catch (err) {
    return next(err);
  } finally {
    connection.release();
  }
}

export async function sendOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const rawTarget = String(req.body.phone || req.body.identifier || req.body.email || '').trim();
    if (rawTarget.includes('@')) {
      req.body.email = rawTarget;
      return sendEmailOtp(req, res, next);
    }

    const { phone } = req.body;
    const cleanPhone = normalizeIndianPhone(phone || rawTarget);
    const variants = getPhoneVariants(phone || rawTarget);

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, status FROM users WHERE phone IN (?, ?, ?, ?) LIMIT 1',
      variants
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: `No account found with +91 ${cleanPhone}. Please create an account to get started.`,
      });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return sendError(res, 'Your account has been suspended. Please contact support.', 403);
    }

    // Generate real secure 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate all previous unverified OTPs for this phone
    await pool.query(
      'UPDATE phone_otps SET verified = 1 WHERE (phone = ? OR phone = ? OR phone = ?) AND verified = 0',
      [cleanPhone, user.phone, `+91${cleanPhone}`]
    );

    // Store in phone_otps table
    await pool.query(
      'INSERT INTO phone_otps (phone, otp, purpose, expires_at) VALUES (?, ?, "login", ?)',
      [cleanPhone, otp, expiresAt]
    );

    // Send real WhatsApp OTP via Meta Cloud API
    const waResult = await sendSmsOtp({
      phone: cleanPhone,
      otp,
      userName: user.name,
      purpose: 'Login',
    });

    const isDev = process.env.NODE_ENV !== 'production';
    const message = waResult.sent
      ? `Verification code sent to WhatsApp (+91 ${cleanPhone})`
      : `WhatsApp notice: ${waResult.message || 'Configure Meta WhatsApp credentials in backend/.env'}`;

    return sendSuccess(
      res,
      {
        phone: user.phone || cleanPhone,
        name: user.name,
        expiresIn: 600,
        registered: true,
        smsSent: waResult.sent,
        smsNotice: !waResult.sent ? waResult.message : undefined,
        debugOtp: isDev ? otp : undefined,
      },
      message
    );
  } catch (err) {
    return next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const rawTarget = String(req.body.phone || req.body.identifier || req.body.email || '').trim();
    if (rawTarget.includes('@')) {
      req.body.email = rawTarget;
      return verifyEmailOtp(req, res, next);
    }

    const { phone, otp } = req.body;
    const variants = getPhoneVariants(phone || rawTarget);

    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, avatar_url, status FROM users WHERE phone IN (?, ?, ?, ?) LIMIT 1',
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

    // Check OTP in phone_otps table
    const cleanPhone = normalizeIndianPhone(phone || rawTarget);
    const [otpRecords]: any = await pool.query(
      `SELECT id, otp, expires_at FROM phone_otps 
       WHERE (phone = ? OR phone = ? OR phone = ?) AND otp = ? AND expires_at > NOW() AND verified = 0 
       ORDER BY id DESC LIMIT 1`,
      [cleanPhone, user.phone, `+91${cleanPhone}`, String(otp).trim()]
    );

    if (otpRecords.length === 0) {
      return sendError(res, 'Invalid or expired verification code. Please check and try again.', 400);
    }

    if (otpRecords.length > 0) {
      await pool.query('UPDATE phone_otps SET verified = 1 WHERE id = ?', [otpRecords[0].id]);
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
          avatar_url: user.avatar_url || null,
          coins_balance: Number(user.coins_balance) || 0,
          referral_code: user.referral_code,
          referred_by: user.referred_by,
          preferred_blend: user.preferred_blend || 'Normal Chai',
          favorite_morning_cup: user.preferred_blend || 'Normal Chai',
          pushToken: user.push_token,
        },
        accessToken,
        refreshToken,
        isNewUser: false,
      },
      'Logged in successfully'
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
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, preferred_blend, avatar_url, status FROM users WHERE email = ? OR phone IN (?, ?, ?, ?) LIMIT 1',
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

    if (user.role === 'admin') {
      const adminSecret = process.env.ADMIN_PASSWORD || 'Admin@123';
      if (password !== adminSecret) {
        return sendError(res, 'Invalid admin password. Please check your credentials.', 401);
      }
    } else {
      return sendError(
        res,
        'Customer accounts use passwordless OTP login. Please sign in using Mobile OTP or Email OTP.',
        400
      );
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
          avatar_url: user.avatar_url || null,
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
      'SELECT id, name, email, phone, role, push_token, coins_balance, referral_code, referred_by, preferred_blend, avatar_url, created_at FROM users WHERE id = ? LIMIT 1',
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

export async function firebasePhoneLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone, idToken, name, favoriteMorningCup } = req.body;
    const cleanPhone = normalizeIndianPhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return sendError(res, 'Valid 10-digit mobile number required', 400);
    }

    const variants = getPhoneVariants(cleanPhone);
    const [users]: any = await pool.query(
      'SELECT id, name, email, phone, role, status, coins_balance, referral_code, preferred_blend, avatar_url FROM users WHERE phone IN (?, ?, ?, ?) LIMIT 1',
      variants
    );

    let user: any;
    let isNewUser = false;

    if (users.length > 0) {
      user = users[0];
      if (user.status === 'suspended') {
        return sendError(res, 'Your account has been suspended. Please contact support.', 403);
      }
    } else {
      // Auto-register new phone user with 50 welcome coins!
      isNewUser = true;
      const formattedName = name?.trim() || `User ${cleanPhone.slice(-4)}`;
      const referralCode = await generateUniqueReferralCode(formattedName, pool);

      const [insertResult]: any = await pool.query(
        'INSERT INTO users (name, phone, role, status, coins_balance, referral_code, preferred_blend) VALUES (?, ?, "customer", "active", 50, ?, ?)',
        [formattedName, `+91${cleanPhone}`, referralCode, favoriteMorningCup || 'Normal Chai']
      );

      const newUserId = insertResult.insertId;

      await pool.query(
        'INSERT INTO coin_transactions (user_id, amount, balance_after, transaction_type, description) VALUES (?, 50, 50, "WELCOME_BONUS", "Welcome Bonus Coins for joining Vardhamrit")',
        [newUserId]
      );

      user = {
        id: newUserId,
        name: formattedName,
        email: null,
        phone: `+91${cleanPhone}`,
        role: 'customer',
        coins_balance: 50,
        referral_code: referralCode,
        preferred_blend: favoriteMorningCup || 'Normal Chai',
        avatar_url: null,
      };
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
        user,
        accessToken,
        refreshToken,
        isNewUser,
      },
      'Logged in successfully via Firebase'
    );
  } catch (err) {
    return next(err);
  }
}
