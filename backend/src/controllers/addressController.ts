import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { sendSuccess, sendError } from '../utils/response';

export const addressSchema = z.object({
  name: z.string().min(2, 'Recipient name is required'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required').max(15),
  tag: z.enum(['HOME', 'WORK', 'OTHER']).or(z.string()).optional().default('HOME'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional().nullable(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'PIN code must be a 6-digit number'),
  landmark: z.string().optional().nullable(),
  latitude: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  longitude: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export const addressParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export async function getAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      return sendSuccess(res, []);
    }

    const [addresses]: any = await pool.query(
      `SELECT id, user_id, name, phone, tag, line1, line2, city, state, pincode, landmark, latitude, longitude, is_default, created_at, updated_at
       FROM addresses
       WHERE user_id = ?
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return sendSuccess(res, addresses);
  } catch (err) {
    return next(err);
  }
}

export async function createAddress(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      connection.release();
      return sendError(res, 'Authentication required', 401);
    }
    const { name, phone, tag, line1, line2, city, state, pincode, landmark, latitude, longitude, isDefault } = req.body;

    await connection.beginTransaction();

    // Check count of addresses
    const [existing]: any = await connection.query(
      'SELECT COUNT(*) as count FROM addresses WHERE user_id = ?',
      [userId]
    );
    const count = existing[0].count;

    // If first address or isDefault is true, set shouldBeDefault = true
    const shouldBeDefault = count === 0 || isDefault === true;

    if (shouldBeDefault) {
      await connection.query(
        'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
        [userId]
      );
    }

    const parsedLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null;
    const parsedLon = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null;

    const [result]: any = await connection.query(
      `INSERT INTO addresses (user_id, name, phone, tag, line1, line2, city, state, pincode, landmark, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, name, phone, tag || 'HOME', line1, line2 || null, city, state, pincode, landmark || null, parsedLat, parsedLon, shouldBeDefault]
    );

    await connection.commit();

    const [created]: any = await pool.query(
      'SELECT * FROM addresses WHERE id = ?',
      [result.insertId]
    );

    return sendSuccess(res, created[0], 'Address created successfully', 201);
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function updateAddress(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      connection.release();
      return sendError(res, 'Authentication required', 401);
    }
    const addressId = Number(req.params.id);
    const { name, phone, tag, line1, line2, city, state, pincode, landmark, latitude, longitude, isDefault } = req.body;

    await connection.beginTransaction();

    const [existing]: any = await connection.query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return sendError(res, 'Address not found', 404);
    }

    if (isDefault) {
      await connection.query(
        'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
        [userId]
      );
    }

    const parsedLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null;
    const parsedLon = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null;

    await connection.query(
      `UPDATE addresses 
       SET name = ?, phone = ?, tag = ?, line1 = ?, line2 = ?, city = ?, state = ?, pincode = ?, landmark = ?, latitude = ?, longitude = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [name, phone, tag || 'HOME', line1, line2 || null, city, state, pincode, landmark || null, parsedLat, parsedLon, Boolean(isDefault), addressId, userId]
    );

    await connection.commit();

    const [updated]: any = await pool.query(
      'SELECT * FROM addresses WHERE id = ?',
      [addressId]
    );

    return sendSuccess(res, updated[0], 'Address updated successfully');
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function deleteAddress(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      connection.release();
      return sendError(res, 'Authentication required', 401);
    }
    const addressId = Number(req.params.id);

    await connection.beginTransaction();

    const [existing]: any = await connection.query(
      'SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return sendError(res, 'Address not found', 404);
    }

    const wasDefault = existing[0].is_default;

    await connection.query(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    // If deleted address was default, promote the newest remaining address to default
    if (wasDefault) {
      const [remaining]: any = await connection.query(
        'SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      if (remaining.length > 0) {
        await connection.query(
          'UPDATE addresses SET is_default = TRUE WHERE id = ?',
          [remaining[0].id]
        );
      }
    }

    await connection.commit();
    return sendSuccess(res, { id: addressId }, 'Address deleted successfully');
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function setDefaultAddress(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    if (!userId) {
      connection.release();
      return sendError(res, 'Authentication required', 401);
    }
    const addressId = Number(req.params.id);

    await connection.beginTransaction();

    const [existing]: any = await connection.query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return sendError(res, 'Address not found', 404);
    }

    await connection.query(
      'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
      [userId]
    );

    await connection.query(
      'UPDATE addresses SET is_default = TRUE WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    await connection.commit();

    const [updated]: any = await pool.query(
      'SELECT * FROM addresses WHERE id = ?',
      [addressId]
    );

    return sendSuccess(res, updated[0], 'Address set as default');
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}
