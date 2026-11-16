import { Request, Response, NextFunction } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteUserNotification,
} from '../services/notificationService';
import { sendSuccess, sendError } from '../utils/response';
import pool from '../config/db';

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const result = await getUserNotifications(userId, page, limit);
    return sendSuccess(res, result, 'Notifications fetched successfully');
  } catch (err) {
    return next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const [unread]: any = await pool.query(
      'SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    return sendSuccess(
      res,
      { unreadCount: unread[0]?.unreadCount || 0 },
      'Unread count retrieved'
    );
  } catch (err) {
    return next(err);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.userId;
    const notificationId = Number(req.params.id);

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const updated = await markNotificationAsRead(userId, notificationId);
    if (!updated) {
      return sendError(res, 'Notification not found or already read', 404);
    }

    return sendSuccess(res, { id: notificationId, is_read: true }, 'Notification marked as read');
  } catch (err) {
    return next(err);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const count = await markAllNotificationsAsRead(userId);
    return sendSuccess(res, { updatedCount: count }, 'All notifications marked as read');
  } catch (err) {
    return next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.userId;
    const notificationId = Number(req.params.id);

    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const deleted = await deleteUserNotification(userId, notificationId);
    if (!deleted) {
      return sendError(res, 'Notification not found', 404);
    }

    return sendSuccess(res, { id: notificationId }, 'Notification deleted successfully');
  } catch (err) {
    return next(err);
  }
}
