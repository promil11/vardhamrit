import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  broadcastNotificationCampaign,
  sendTestPushNotification,
  getAdminCampaigns,
  getNotificationStats,
} from '../services/notificationService';
import { sendSuccess, sendError } from '../utils/response';
import pool from '../config/db';

const broadcastSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  body: z.string().min(1, 'Message body is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  type: z.enum(['PROMO', 'FLASH_SALE', 'CHAI_TIME', 'CART_REMINDER', 'ORDER_UPDATE', 'ANNOUNCEMENT']).default('PROMO'),
  actionRoute: z.string().default('/'),
  ctaText: z.string().default('View Now'),
  targetAudience: z.enum(['ALL', 'ACTIVE_BUYERS', 'INACTIVE', 'SPECIFIC_USER']).default('ALL'),
  targetUserId: z.number().optional(),
});

const testNotificationSchema = z.object({
  target: z.union([z.string().min(1), z.number()]),
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  type: z.string().default('PROMO'),
  actionRoute: z.string().default('/'),
  ctaText: z.string().default('View Now'),
});

export async function broadcastCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = broadcastSchema.parse(req.body);
    const adminId = (req.user as any)?.userId;

    const result = await broadcastNotificationCampaign({
      ...validated,
      createdBy: adminId,
    });

    return sendSuccess(res, result, 'Campaign broadcasted successfully');
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return sendError(res, err.errors.map(e => e.message).join(', '), 400);
    }
    return next(err);
  }
}

export async function sendTestNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = testNotificationSchema.parse(req.body);
    const result = await sendTestPushNotification(validated);

    if (!result.success) {
      return sendError(res, result.message || 'Failed to send test notification', 400);
    }

    return sendSuccess(res, result, 'Test push notification executed');
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return sendError(res, err.errors.map(e => e.message).join(', '), 400);
    }
    return next(err);
  }
}

export async function getCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const data = await getAdminCampaigns(limit, offset);

    return sendSuccess(res, {
      ...data,
      page,
      limit,
    }, 'Campaigns retrieved successfully');
  } catch (err) {
    return next(err);
  }
}

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getNotificationStats();
    return sendSuccess(res, stats, 'Notification statistics retrieved');
  } catch (err) {
    return next(err);
  }
}

export async function deleteCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const campaignId = Number(req.params.id);
    if (!campaignId) {
      return sendError(res, 'Invalid campaign id', 400);
    }

    const [result]: any = await pool.query(
      'DELETE FROM notification_campaigns WHERE id = ?',
      [campaignId]
    );

    if (result.affectedRows === 0) {
      return sendError(res, 'Campaign not found', 404);
    }

    return sendSuccess(res, { id: campaignId }, 'Campaign deleted successfully');
  } catch (err) {
    return next(err);
  }
}
