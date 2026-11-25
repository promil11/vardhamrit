import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import pool from '../config/db';
import { io } from '../index';
import { sendWhatsAppRestockAlert, sendWhatsAppOrderAlert } from './whatsappService';
import { sendRestockAlertEmail } from './emailService';

const expo = new Expo();

export interface CampaignPayload {
  title: string;
  body: string;
  imageUrl?: string;
  type?: 'PROMO' | 'FLASH_SALE' | 'CHAI_TIME' | 'CART_REMINDER' | 'ORDER_UPDATE' | 'ANNOUNCEMENT';
  actionRoute?: string;
  ctaText?: string;
  targetAudience?: 'ALL' | 'ACTIVE_BUYERS' | 'INACTIVE' | 'SPECIFIC_USER';
  targetUserId?: number;
  createdBy?: number;
}

/**
 * Creates an in-app notification record and broadcasts it in real-time via Socket.IO
 */
export async function createInAppNotification(params: {
  userId: number;
  campaignId?: number | null;
  title: string;
  body: string;
  imageUrl?: string | null;
  type?: string;
  actionRoute?: string;
  ctaText?: string;
  data?: Record<string, any>;
}) {
  try {
    const resolvedRoute = (!params.actionRoute || params.actionRoute === '/') ? '/(tabs)' : params.actionRoute;

    const [result]: any = await pool.query(
      `INSERT INTO notifications (campaign_id, user_id, title, body, image_url, type, action_route, cta_text, data, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [
        params.campaignId || null,
        params.userId,
        params.title,
        params.body,
        params.imageUrl || null,
        params.type || 'PROMO',
        resolvedRoute,
        params.ctaText || 'View Now',
        params.data ? JSON.stringify(params.data) : null,
      ]
    );

    const notificationId = result.insertId;

    const payload = {
      id: notificationId,
      campaign_id: params.campaignId || null,
      user_id: params.userId,
      title: params.title,
      body: params.body,
      image_url: params.imageUrl || null,
      type: params.type || 'PROMO',
      action_route: resolvedRoute,
      cta_text: params.ctaText || 'View Now',
      data: params.data || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    // Emit live socket event to user
    try {
      if (io) {
        io.emit(`user_notification:${params.userId}`, payload);
        io.emit('new_notification', { userId: params.userId, ...payload });
      }
    } catch (e) {
      console.warn('Socket notification emit error:', e);
    }

    return notificationId;
  } catch (err) {
    console.error('Error creating in-app notification:', err);
    return null;
  }
}

/**
 * Sends order status push notification + persists in in-app notification inbox
 */
export async function sendOrderPushNotification(
  userId: number,
  orderId: number,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    // 1. Create in-app notification record
    await createInAppNotification({
      userId,
      title,
      body,
      type: 'ORDER_UPDATE',
      actionRoute: `/order-tracking?id=${orderId}`,
      ctaText: 'Track Order',
      data: { orderId, ...data },
    });

    // 2. Fetch user's push token
    const [users]: any = await pool.query(
      'SELECT push_token, name FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0 || !users[0].push_token) {
      return { sent: false, reason: 'No push token registered for user' };
    }

    const pushToken = users[0].push_token;

    if (!Expo.isExpoPushToken(pushToken)) {
      console.warn(`Push token ${pushToken} is not a valid Expo push token`);
      return { sent: false, reason: 'Invalid push token format' };
    }

    const messages: ExpoPushMessage[] = [
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        priority: 'high',
        data: {
          orderId,
          actionRoute: `/order-tracking?id=${orderId}`,
          ...data,
        },
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log('📬 Expo push notification ticket:', ticketChunk);
      } catch (error) {
        console.error('Error sending Expo push notification chunk:', error);
      }
    }

    return { sent: true };
  } catch (err) {
    console.error('Failed to send push notification:', err);
    return { sent: false, error: err };
  }
}

/**
 * Broadcasts campaign to users (All, Active, Inactive, or Specific)
 */
export async function broadcastNotificationCampaign(campaign: CampaignPayload) {
  try {
    const audience = campaign.targetAudience || 'ALL';
    let query = '';
    const queryParams: any[] = [];

    if (audience === 'SPECIFIC_USER' && campaign.targetUserId) {
      query = 'SELECT id, name, push_token FROM users WHERE id = ?';
      queryParams.push(campaign.targetUserId);
    } else if (audience === 'ACTIVE_BUYERS') {
      query = `
        SELECT DISTINCT u.id, u.name, u.push_token 
        FROM users u
        INNER JOIN orders o ON o.user_id = u.id
        WHERE u.role = 'customer'
      `;
    } else if (audience === 'INACTIVE') {
      query = `
        SELECT u.id, u.name, u.push_token 
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        WHERE u.role = 'customer' AND o.id IS NULL
      `;
    } else {
      // Default: ALL customers
      query = "SELECT id, name, push_token FROM users WHERE role = 'customer'";
    }

    const [recipients]: any = await pool.query(query, queryParams);
    const totalRecipients = recipients.length;
    const resolvedRoute = (!campaign.actionRoute || campaign.actionRoute === '/') ? '/(tabs)' : campaign.actionRoute;

    // 1. Insert Campaign record
    const [campResult]: any = await pool.query(
      `INSERT INTO notification_campaigns (title, body, image_url, type, action_route, cta_text, target_audience, target_user_id, total_recipients, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?)`,
      [
        campaign.title,
        campaign.body,
        campaign.imageUrl || null,
        campaign.type || 'PROMO',
        resolvedRoute,
        campaign.ctaText || 'View Now',
        audience,
        campaign.targetUserId || null,
        totalRecipients,
        campaign.createdBy || null,
      ]
    );

    const campaignId = campResult.insertId;

    if (totalRecipients === 0) {
      return {
        campaignId,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        message: 'No recipients matched the target audience criteria.',
      };
    }

    // 2. Batch insert in-app notifications
    const insertValues: any[] = [];
    const pushMessages: ExpoPushMessage[] = [];

    for (const user of recipients) {
      insertValues.push([
        campaignId,
        user.id,
        campaign.title,
        campaign.body,
        campaign.imageUrl || null,
        campaign.type || 'PROMO',
        resolvedRoute,
        campaign.ctaText || 'View Now',
        JSON.stringify({
          campaignId,
          type: campaign.type || 'PROMO',
          actionRoute: resolvedRoute,
        }),
        false,
      ]);

      if (user.push_token && Expo.isExpoPushToken(user.push_token)) {
        pushMessages.push({
          to: user.push_token,
          sound: 'default',
          title: campaign.title,
          body: campaign.body,
          priority: 'high',
          data: {
            campaignId,
            actionRoute: resolvedRoute,
            type: campaign.type || 'PROMO',
            imageUrl: campaign.imageUrl || null,
          },
        });
      }
    }

    if (insertValues.length > 0) {
      await pool.query(
        `INSERT INTO notifications (campaign_id, user_id, title, body, image_url, type, action_route, cta_text, data, is_read)
         VALUES ?`,
        [insertValues]
      );
    }

    // 3. Dispatch Expo Push Notifications in chunks
    let sentCount = 0;
    let failedCount = 0;

    if (pushMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(pushMessages);
      for (const chunk of chunks) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          for (const ticket of tickets) {
            if (ticket.status === 'ok') {
              sentCount++;
            } else {
              failedCount++;
              console.warn('Expo Push error ticket:', ticket);
            }
          }
        } catch (error) {
          failedCount += chunk.length;
          console.error('Chunk send error:', error);
        }
      }
    }

    // Update campaign stats
    await pool.query(
      'UPDATE notification_campaigns SET sent_count = ?, failed_count = ? WHERE id = ?',
      [sentCount, failedCount, campaignId]
    );

    // 4. Emit live broadcast event via Socket.IO
    try {
      if (io) {
        io.emit('broadcast_notification', {
          id: campaignId,
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.imageUrl || null,
          type: campaign.type || 'PROMO',
          actionRoute: campaign.actionRoute || '/',
          ctaText: campaign.ctaText || 'View Now',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Socket broadcast error:', e);
    }

    return {
      campaignId,
      totalRecipients,
      pushTokensFound: pushMessages.length,
      sentCount,
      failedCount,
      success: true,
    };
  } catch (err) {
    console.error('Failed to broadcast campaign:', err);
    throw err;
  }
}

/**
 * Send instant test notification to a specific admin or user
 */
export async function sendTestPushNotification(params: {
  target: string | number; // userId, email, or phone
  title: string;
  body: string;
  imageUrl?: string;
  type?: string;
  actionRoute?: string;
  ctaText?: string;
}) {
  try {
    let userQuery = 'SELECT id, name, email, phone, push_token FROM users WHERE ';
    const queryParam: any[] = [];

    if (typeof params.target === 'number' || !isNaN(Number(params.target))) {
      userQuery += 'id = ?';
      queryParam.push(Number(params.target));
    } else if (params.target.includes('@')) {
      userQuery += 'email = ?';
      queryParam.push(params.target);
    } else {
      userQuery += 'phone LIKE ?';
      queryParam.push(`%${params.target}%`);
    }

    const [users]: any = await pool.query(userQuery, queryParam);

    if (users.length === 0) {
      return { success: false, message: `Target user '${params.target}' not found` };
    }

    const targetUser = users[0];
    const resolvedRoute = (!params.actionRoute || params.actionRoute === '/') ? '/(tabs)' : params.actionRoute;

    // Create in-app record
    const notifId = await createInAppNotification({
      userId: targetUser.id,
      title: params.title,
      body: params.body,
      imageUrl: params.imageUrl || null,
      type: params.type || 'PROMO',
      actionRoute: resolvedRoute,
      ctaText: params.ctaText || 'View Now',
      data: { isTest: true },
    });

    let pushSent = false;
    let pushReason = '';

    if (targetUser.push_token && Expo.isExpoPushToken(targetUser.push_token)) {
      try {
        const ticket = await expo.sendPushNotificationsAsync([
          {
            to: targetUser.push_token,
            sound: 'default',
            title: `[TEST] ${params.title}`,
            body: params.body,
            priority: 'high',
            data: {
              test: true,
              actionRoute: resolvedRoute,
              imageUrl: params.imageUrl || null,
            },
          },
        ]);
        pushSent = true;
        console.log('📬 Test notification sent ticket:', ticket);
      } catch (e: any) {
        pushReason = e.message || 'Failed to dispatch Expo push';
      }
    } else {
      pushReason = targetUser.push_token
        ? 'Invalid Expo token format'
        : 'User has no push token registered. In-app notification was delivered.';
    }

    return {
      success: true,
      notificationId: notifId,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        hasPushToken: !!targetUser.push_token,
      },
      pushSent,
      pushReason: pushSent ? 'Delivered via Expo push' : pushReason,
    };
  } catch (err: any) {
    console.error('Test push error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get user's notifications list with unread counter
 */
export async function getUserNotifications(userId: number, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [notifications]: any = await pool.query(
    `SELECT id, campaign_id, user_id, title, body, image_url, type, action_route, cta_text, data, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const [unreadResult]: any = await pool.query(
    'SELECT COUNT(*) as unreadCount FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );

  const [totalResult]: any = await pool.query(
    'SELECT COUNT(*) as totalCount FROM notifications WHERE user_id = ?',
    [userId]
  );

  return {
    notifications,
    unreadCount: unreadResult[0]?.unreadCount || 0,
    totalCount: totalResult[0]?.totalCount || 0,
    page,
    totalPages: Math.ceil((totalResult[0]?.totalCount || 0) / limit),
  };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(userId: number, notificationId: number) {
  const [result]: any = await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number) {
  const [result]: any = await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );
  return result.affectedRows;
}

/**
 * Delete a user notification
 */
export async function deleteUserNotification(userId: number, notificationId: number) {
  const [result]: any = await pool.query(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Get all past admin campaigns with metrics
 */
export async function getAdminCampaigns(limit = 30, offset = 0) {
  const [campaigns]: any = await pool.query(
    `SELECT nc.*, u.name as created_by_name
     FROM notification_campaigns nc
     LEFT JOIN users u ON u.id = nc.created_by
     ORDER BY nc.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  const [countResult]: any = await pool.query(
    'SELECT COUNT(*) as total FROM notification_campaigns'
  );

  return {
    campaigns,
    total: countResult[0]?.total || 0,
  };
}

/**
 * Get notification statistics for Admin dashboard
 */
export async function getNotificationStats() {
  const [campCount]: any = await pool.query(
    'SELECT COUNT(*) as totalCampaigns, SUM(sent_count) as totalPushSent FROM notification_campaigns'
  );

  const [tokenCount]: any = await pool.query(
    "SELECT COUNT(*) as registeredTokens FROM users WHERE push_token IS NOT NULL AND push_token != ''"
  );

  const [notifStats]: any = await pool.query(
    'SELECT COUNT(*) as totalInApp, SUM(CASE WHEN is_read = TRUE THEN 1 ELSE 0 END) as totalRead FROM notifications'
  );

  const [activeCustomers]: any = await pool.query(
    "SELECT COUNT(*) as totalCustomers FROM users WHERE role = 'customer'"
  );

  return {
    totalCampaigns: campCount[0]?.totalCampaigns || 0,
    totalPushSent: Number(campCount[0]?.totalPushSent || 0),
    registeredTokens: tokenCount[0]?.registeredTokens || 0,
    totalCustomers: activeCustomers[0]?.totalCustomers || 0,
    totalInAppDelivered: notifStats[0]?.totalInApp || 0,
    totalRead: Number(notifStats[0]?.totalRead || 0),
    readRate: notifStats[0]?.totalInApp > 0
      ? Math.round((Number(notifStats[0]?.totalRead || 0) / notifStats[0]?.totalInApp) * 100)
      : 0,
  };
}

/**
 * Automatically dispatches multichannel Restock Alerts (WhatsApp + Email + In-App + Socket.io)
 * to all customers who requested back-in-stock notifications for this variant.
 */
export async function dispatchRestockNotificationsForVariant(
  variantId: number,
  options?: { newStock?: number }
): Promise<{ notifiedCount: number; details: any[] }> {
  try {
    const [subs]: any = await pool.query(
      `SELECT 
        s.id as subscription_id,
        s.user_id,
        s.contact_value,
        s.contact_type,
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        pv.id as variant_id,
        pv.label as variant_label,
        pv.price,
        pv.stock_quantity,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        COALESCE(
          (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
        ) as product_image
      FROM stock_subscriptions s
      JOIN products p ON s.product_id = p.id
      JOIN product_variants pv ON s.variant_id = pv.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.variant_id = ? AND s.is_notified = FALSE`,
      [variantId]
    );

    if (!subs || subs.length === 0) {
      return { notifiedCount: 0, details: [] };
    }

    const notifiedDetails: any[] = [];
    const subIdsToMark: number[] = [];

    for (const sub of subs) {
      subIdsToMark.push(sub.subscription_id);
      const recipientName = sub.user_name || 'Tea Connoisseur';

      // 1. WhatsApp Delivery
      let phone = sub.contact_type === 'whatsapp' || sub.contact_type === 'phone'
        ? sub.contact_value
        : (sub.user_phone || null);

      if (!phone && sub.contact_value && /^\+?[0-9]{10,14}$/.test(sub.contact_value.trim())) {
        phone = sub.contact_value.trim();
      }

      if (phone) {
        try {
          await sendWhatsAppRestockAlert({
            phone,
            userName: recipientName,
            productName: sub.product_name,
            variantLabel: sub.variant_label,
            price: Number(sub.price),
            productSlug: sub.product_slug,
            productId: sub.product_id,
          });
        } catch (waErr) {
          console.warn('[NotificationService] WhatsApp restock dispatch warning:', waErr);
        }
      }

      // 2. Email Delivery
      let email = sub.contact_type === 'email'
        ? sub.contact_value
        : (sub.user_email || null);

      if (!email && sub.contact_value && sub.contact_value.includes('@')) {
        email = sub.contact_value.trim();
      }

      if (email) {
        try {
          await sendRestockAlertEmail({
            to: email,
            userName: recipientName,
            productName: sub.product_name,
            variantLabel: sub.variant_label,
            price: Number(sub.price),
            productId: sub.product_id,
            productSlug: sub.product_slug,
            imageUrl: sub.product_image,
          });
        } catch (emailErr) {
          console.warn('[NotificationService] Email restock dispatch warning:', emailErr);
        }
      }

      // 3. In-App Notification (if linked to registered user)
      if (sub.user_id) {
        try {
          await createInAppNotification({
            userId: sub.user_id,
            title: `Back in Stock: ${sub.product_name} (${sub.variant_label}) 🍃`,
            body: `Great news! Fresh inventory is now in stock for ${sub.product_name} (${sub.variant_label}). Tap to order before it sells out!`,
            type: 'FLASH_SALE',
            actionRoute: `/product/${sub.product_id}`,
            ctaText: 'Order Now',
          });
          io?.emit(`stock_alert.user_updated:${sub.user_id}`, {
            variantId: sub.variant_id,
            productId: sub.product_id,
            status: 'in_stock',
          });
        } catch (inAppErr) {
          console.warn('[NotificationService] In-App restock dispatch warning:', inAppErr);
        }
      }

      notifiedDetails.push({
        subscriptionId: sub.subscription_id,
        userId: sub.user_id,
        phone,
        email,
        product: sub.product_name,
        variant: sub.variant_label,
      });
    }

    // 4. Mark subscriptions as notified in database
    if (subIdsToMark.length > 0) {
      await pool.query(
        `UPDATE stock_subscriptions SET is_notified = TRUE, notified_at = NOW() WHERE id IN (?)`,
        [subIdsToMark]
      );
    }

    // 5. Broadcast real-time Socket.io events across all active apps
    if (io) {
      io.emit('stock_alert.updated', {
        variantId,
        newStock: options?.newStock ?? null,
        notifiedCount: subIdsToMark.length,
        isNotified: true,
      });
      io.emit('stock_alert.notified', {
        variantId,
        notifiedCount: subIdsToMark.length,
      });
      io.emit('stock_alert.restocked', {
        variantId,
        newStock: options?.newStock ?? null,
      });
    }

    console.log(`[NotificationService] ✅ Multichannel restock alert sent to ${subIdsToMark.length} customers for Variant #${variantId}`);
    return { notifiedCount: subIdsToMark.length, details: notifiedDetails };
  } catch (err: any) {
    console.error('[NotificationService] ❌ Error in dispatchRestockNotificationsForVariant:', err);
    return { notifiedCount: 0, details: [] };
  }
}

/**
 * Automatically dispatches WhatsApp Order Notifications to the customer
 */
export async function dispatchOrderWhatsAppNotification(
  order: any,
  status: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED',
  extra?: { courierName?: string; trackingNumber?: string }
) {
  try {
    let phone = order.customerPhone || order.phone || null;
    let customerName = order.customerName || order.userName || order.name || 'Tea Lover';

    if (!phone && order.address) {
      const addr = typeof order.address === 'string' ? JSON.parse(order.address) : order.address;
      phone = addr?.phone || null;
      if (!customerName || customerName === 'Tea Lover') customerName = addr?.name || 'Tea Lover';
    }

    if (!phone && order.address_snapshot) {
      const addr = typeof order.address_snapshot === 'string' ? JSON.parse(order.address_snapshot) : order.address_snapshot;
      phone = addr?.phone || null;
      if (!customerName || customerName === 'Tea Lover') customerName = addr?.name || 'Tea Lover';
    }

    if (!phone && order.user_id) {
      const [uRows]: any = await pool.query('SELECT name, phone FROM users WHERE id = ?', [order.user_id]);
      if (uRows.length > 0) {
        phone = uRows[0]?.phone;
        if (!customerName || customerName === 'Tea Lover') customerName = uRows[0]?.name;
      }
    }

    if (!phone) {
      console.warn(`[NotificationService] ⚠️ No phone number found for Order #${order.order_number || order.id || order.orderNumber} WhatsApp notification`);
      return;
    }

    // Build items summary if available
    let itemsSummary = '';
    if (order.items && Array.isArray(order.items)) {
      itemsSummary = order.items
        .map((it: any) => `${it.product_name || it.name} (${it.variant_label || it.variantLabel || ''}) x${it.quantity}`)
        .join(', ');
    }

    await sendWhatsAppOrderAlert({
      phone,
      userName: customerName,
      orderNumber: String(order.order_number || order.orderNumber || order.id),
      status,
      totalAmount: Number(order.total_amount || order.totalAmount || order.total || 0),
      courierName: extra?.courierName || order.courier_name || order.courierName,
      trackingNumber: extra?.trackingNumber || order.tracking_number || order.trackingNumber,
      itemsSummary,
    });
  } catch (err) {
    console.warn('[NotificationService] Error sending WhatsApp order alert:', err);
  }
}
