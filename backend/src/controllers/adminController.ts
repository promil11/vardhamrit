import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { updateOrderStatus, getOrderById } from '../services/orderService';
import { generateInvoicePDF } from '../services/invoiceService';
import {
  sendOrderPushNotification,
  createInAppNotification,
  dispatchRestockNotificationsForVariant,
  dispatchRestockNotificationForSingleSubscription,
  dispatchOrderWhatsAppNotification,
} from '../services/notificationService';
import { recalculateProductRating } from '../services/reviewService';
import { sendSuccess, sendError } from '../utils/response';
import { io } from '../index';
import { invalidateCachePattern } from '../config/redis';

// Dashboard statistics
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Sales metrics (today, weekly, monthly, all-time)
    const [salesRows]: any = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status != 'CANCELLED' AND status != 'REJECTED' THEN total ELSE 0 END), 0) as today_sales,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status != 'CANCELLED' AND status != 'REJECTED' THEN total ELSE 0 END), 0) as weekly_sales,
        COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status != 'CANCELLED' AND status != 'REJECTED' THEN total ELSE 0 END), 0) as monthly_sales,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND status != 'REJECTED' THEN total ELSE 0 END), 0) as total_revenue
      FROM orders
    `);

    // 2. Order counts by status
    const [statusCounts]: any = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `);
    const statusMap: Record<string, number> = {
      PLACED: 0,
      CONFIRMED: 0,
      PACKED: 0,
      APPROVED: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = Number(row.count);
    }

    // 3. Daily revenue chart (continuous timeline for 7, 14, or 30 days)
    const range = (req.query.range as string) || '7d';
    const numDays = range === '30d' ? 30 : range === '14d' ? 14 : 7;

    const [dailyChartRows]: any = await pool.query(
      `SELECT DATE(created_at) as date, COALESCE(SUM(total), 0) as revenue, COUNT(*) as order_count
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND status NOT IN ('CANCELLED', 'REJECTED')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [numDays - 1]
    );

    const chartMap = new Map<string, { revenue: number; order_count: number }>();
    for (const row of dailyChartRows) {
      let dStr = '';
      if (row.date instanceof Date) {
        const y = row.date.getFullYear();
        const m = String(row.date.getMonth() + 1).padStart(2, '0');
        const d = String(row.date.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${d}`;
      } else {
        dStr = String(row.date).slice(0, 10);
      }
      chartMap.set(dStr, {
        revenue: Number(row.revenue || 0),
        order_count: Number(row.order_count || 0),
      });
    }

    const continuousChart: Array<{ date: string; revenue: number; order_count: number }> = [];
    const today = new Date();
    for (let i = numDays - 1; i >= 0; i--) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${d}`;
      const entry = chartMap.get(dStr);
      continuousChart.push({
        date: dStr,
        revenue: entry ? entry.revenue : 0,
        order_count: entry ? entry.order_count : 0,
      });
    }

    // 4. Top selling products
    const [topProducts]: any = await pool.query(`
      SELECT oi.product_name, SUM(oi.quantity) as total_units_sold, SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status NOT IN ('CANCELLED', 'REJECTED')
      GROUP BY oi.product_name
      ORDER BY total_units_sold DESC
      LIMIT 5
    `);

    // 5. Low stock alerts (< 15 units)
    const [lowStockVariants]: any = await pool.query(`
      SELECT pv.id, pv.sku, pv.label, pv.stock, pv.price, p.name as product_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.stock <= 15
      ORDER BY pv.stock ASC
      LIMIT 10
    `);

    return sendSuccess(res, {
      sales: salesRows[0],
      orderCounts: statusMap,
      revenueChart: continuousChart,
      topProducts,
      lowStockAlerts: lowStockVariants,
    });
  } catch (err) {
    return next(err);
  }
}

// Orders management with filters & search
export async function getAdminOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { status, paymentStatus, search, dateFrom, dateTo } = req.query as any;

    let conditions: string[] = ['1=1'];
    let params: any[] = [];

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (paymentStatus) {
      conditions.push('o.payment_status = ?');
      params.push(paymentStatus);
    }
    if (dateFrom) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(dateTo);
    }
    if (search && String(search).trim()) {
      const cleanSearch = String(search).trim();
      const stripped = cleanSearch.replace(/^#/, '');
      const pattern = `%${stripped}%`;

      conditions.push(`(
        o.order_number LIKE ?
        OR o.id LIKE ?
        OR o.tracking_number LIKE ?
        OR o.invoice_number LIKE ?
        OR o.courier_name LIKE ?
        OR u.name LIKE ?
        OR u.phone LIKE ?
        OR u.email LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.address_snapshot, '$.name')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.address_snapshot, '$.phone')) LIKE ?
        OR JSON_UNQUOTE(JSON_EXTRACT(o.address_snapshot, '$.city')) LIKE ?
      )`);
      params.push(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern
      );
    }

    const whereClause = conditions.join(' AND ');

    const [countResult]: any = await pool.query(
      `SELECT COUNT(*) as total FROM orders o JOIN users u ON o.user_id = u.id WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const [orders]: any = await pool.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    for (const order of orders) {
      if (typeof order.address_snapshot === 'string') {
        try {
          order.address_snapshot = JSON.parse(order.address_snapshot);
        } catch (e) {}
      }
    }

    return sendSuccess(res, {
      items: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
}

// Order Actions
export async function approveOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);

    // 1. Generate Invoice PDF automatically upon approval
    const { invoiceNumber, filePath } = await generateInvoicePDF(orderId);
    const invoiceUrl = `/invoices/invoice_${orderId}_${invoiceNumber}.pdf`;

    // 2. Transition status
    const updated = await updateOrderStatus(orderId, 'APPROVED', 'Admin', 'Order approved by admin', {
      invoiceNumber,
      invoiceUrl,
    });

    // 3. Send Push Notification to Customer
    await sendOrderPushNotification(
      updated.user_id,
      orderId,
      'Order Confirmed! 🍵',
      `Your Vardhamrit Chai order #${updated.order_number || orderId} has been confirmed by our tea estate team!`
    );

    // 4. Send WhatsApp Notification
    dispatchOrderWhatsAppNotification(updated, 'CONFIRMED').catch((e) =>
      console.warn('[AdminController] WhatsApp confirmation error:', e)
    );

    return sendSuccess(res, updated, 'Order confirmed and invoice generated');
  } catch (err) {
    return next(err);
  }
}

export async function rejectOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);
    const { reason } = req.body;

    const updated = await updateOrderStatus(orderId, 'REJECTED', 'Admin', reason || 'Rejected by admin', {
      rejectionReason: reason || 'Order rejected by admin',
    });

    await sendOrderPushNotification(
      updated.user_id,
      orderId,
      'Order Update',
      `Your order #${orderId} was rejected. ${reason ? `Reason: ${reason}` : ''}`
    );

    dispatchOrderWhatsAppNotification(updated, 'CANCELLED').catch((e) =>
      console.warn('[AdminController] WhatsApp rejection error:', e)
    );

    return sendSuccess(res, updated, 'Order rejected and inventory restocked');
  } catch (err) {
    return next(err);
  }
}

export async function dispatchOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);
    const { courierName, trackingNumber } = req.body;
    const courier = courierName || 'Vardhamrit Express';
    const tracking = trackingNumber || `EXP-PUN-${Math.floor(100 + Math.random() * 900)}`;

    const updated = await updateOrderStatus(
      orderId,
      'DISPATCHED',
      'Admin',
      `Dispatched via ${courier}. Tracking #${tracking}`,
      { courierName: courier, trackingNumber: tracking }
    );

    await sendOrderPushNotification(
      updated.user_id,
      orderId,
      'Order Dispatched! 🚀',
      `Your Vardhamrit Chai is on its way via ${courier}! Tracking: ${tracking}`
    );

    dispatchOrderWhatsAppNotification(updated, 'DISPATCHED', { courierName: courier, trackingNumber: tracking }).catch((e) =>
      console.warn('[AdminController] WhatsApp dispatch error:', e)
    );

    return sendSuccess(res, updated, 'Order marked as dispatched');
  } catch (err) {
    return next(err);
  }
}

export async function deliverOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);

    const updated = await updateOrderStatus(orderId, 'DELIVERED', 'Admin', 'Order successfully delivered to customer');

    await sendOrderPushNotification(
      updated.user_id,
      orderId,
      'Chai Delivered! ☕',
      `Your order #${orderId} has been delivered. Enjoy your handcrafted cup of Vardhamrit Chai!`
    );

    dispatchOrderWhatsAppNotification(updated, 'DELIVERED').catch((e) =>
      console.warn('[AdminController] WhatsApp delivery error:', e)
    );

    return sendSuccess(res, updated, 'Order marked as delivered');
  } catch (err) {
    return next(err);
  }
}

export async function markCodCollected(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);

    const [orders]: any = await pool.query(
      'SELECT id, payment_method, payment_status FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return sendError(res, 'Order not found', 404);
    }

    const order = orders[0];
    if (order.payment_method !== 'COD') {
      return sendError(res, 'Only COD orders can be marked as COD collected', 400);
    }

    await pool.query('UPDATE orders SET payment_status = "PAID" WHERE id = ?', [orderId]);
    await pool.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       SELECT id, status, 'Admin', 'Cash on Delivery payment collected' FROM orders WHERE id = ?`,
      [orderId]
    );

    const updated = await getOrderById(orderId);
    if (io) {
      io.emit('order.status_updated', {
        orderId,
        orderNumber: updated?.order_number || `VRD-${orderId}`,
        status: updated?.order_status || updated?.status,
        paymentStatus: 'PAID',
        order: updated,
      });
    }
    return sendSuccess(res, updated, 'COD payment marked as collected');
  } catch (err) {
    return next(err);
  }
}

export async function updateOrderPaymentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.id);
    const { payment_status, paymentStatus } = req.body;
    const newStatus = (payment_status || paymentStatus || 'PAID').toUpperCase();

    if (!['PENDING', 'PAID', 'FAILED', 'REFUNDED'].includes(newStatus)) {
      return sendError(res, 'Invalid payment status. Must be PENDING, PAID, FAILED, or REFUNDED', 400);
    }

    await pool.query('UPDATE orders SET payment_status = ? WHERE id = ?', [newStatus, orderId]);
    await pool.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       SELECT id, status, 'Admin', ? FROM orders WHERE id = ?`,
      [`Payment status changed to ${newStatus}`, orderId]
    );

    const updated = await getOrderById(orderId);
    if (io) {
      io.emit('order.status_updated', {
        orderId,
        orderNumber: updated?.order_number || `VRD-${orderId}`,
        status: updated?.order_status || updated?.status,
        paymentStatus: newStatus,
        order: updated,
      });
    }
    return sendSuccess(res, updated, `Payment status updated to ${newStatus}`);
  } catch (err) {
    return next(err);
  }
}

// Export orders to CSV
export async function exportOrdersCSV(req: Request, res: Response, next: NextFunction) {
  try {
    const [orders]: any = await pool.query(`
      SELECT o.id, o.order_number, u.name as customer_name, u.phone as customer_phone,
             o.total, o.subtotal, o.discount_amount, o.tax_amount, o.delivery_fee,
             o.payment_method, o.payment_status, o.status, o.invoice_number, o.created_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);

    let csv = 'Order ID,Order Number,Customer Name,Phone,Subtotal,Discount,Tax,Delivery,Total,Payment Method,Payment Status,Order Status,Invoice Number,Date\n';

    for (const o of orders) {
      csv += `${o.id},"${o.order_number || ''}","${o.customer_name}","${o.customer_phone}",${o.subtotal},${o.discount_amount},${o.tax_amount},${o.delivery_fee},${o.total},${o.payment_method},${o.payment_status},${o.status},"${o.invoice_number || ''}","${new Date(o.created_at).toISOString()}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vardhamrit_orders.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

function parseWeightGrams(label: string): number {
  const lower = (label || '').toLowerCase();
  if (lower.includes('1 kg') || lower.includes('1kg')) return 1000;
  if (lower.includes('2 kg') || lower.includes('2kg')) return 2000;
  if (lower.includes('5 kg') || lower.includes('5kg')) return 5000;
  const match = lower.match(/(\d+)\s*g/);
  if (match) return parseInt(match[1]);
  return parseInt(label) || 250;
}

// Products CRUD
export async function createAdminProduct(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const { name, description, imageUrl, image_url, category_id, categoryId, variants, tagline } = req.body;
    await connection.beginTransaction();

    const finalImg = imageUrl || image_url || '/uploads/products/classic_200g.png';
    const finalTagline = tagline || 'Born in the Valleys of Assam, Brewed for Your Soul';

    // Determine category_id (default to 2 for Normal/Classic or infer from flavour)
    let catId = Number(category_id || categoryId || 0);
    if (!catId || isNaN(catId)) {
      const lowerName = (name || '').toLowerCase();
      if (lowerName.includes('masala') || lowerName.includes('spic')) catId = 3;
      else if (lowerName.includes('kesar') || lowerName.includes('keser') || lowerName.includes('saffron')) catId = 4;
      else if (lowerName.includes('chocolate') || lowerName.includes('cacao') || lowerName.includes('cocoa')) catId = 5;
      else catId = 2; // Normal/Classic Chai
    }

    // Generate unique slug
    const baseSlug = (name || 'tea')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

    const [pRes]: any = await connection.query(
      `INSERT INTO products 
       (category_id, name, slug, tagline, description, rating, review_count, is_bestseller, is_fresh_harvest, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, 5.00, 0, 0, 1, 0, 1)`,
      [catId, name, slug, finalTagline, description || '']
    );
    const productId = pRes.insertId;

    // Insert primary image into product_images
    if (finalImg) {
      await connection.query(
        'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, 1, 0)',
        [productId, finalImg]
      );
    }

    if (variants && Array.isArray(variants)) {
      let maxDiscountPct = 0;
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const stockVal = Number(v.stock ?? v.stock_quantity ?? 100);
        const weightGrams = parseWeightGrams(v.label);
        const vPrice = Number(v.price || 199);
        const vMrp = v.mrp !== undefined && v.mrp !== null && v.mrp !== '' ? Math.max(vPrice, Number(v.mrp)) : vPrice;
        const discountPct = vMrp > vPrice ? Math.round(((vMrp - vPrice) / vMrp) * 100) : 0;
        if (discountPct > maxDiscountPct) maxDiscountPct = discountPct;
        const cleanLabel = (v.label || `${weightGrams}g`).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const vSku = v.sku && v.sku.trim() ? v.sku.trim() : `TEA-${productId}-${cleanLabel}-${i + 1}`;

        await connection.query(
          `INSERT INTO product_variants 
           (product_id, label, weight_grams, price, mrp, stock_quantity, sku, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [productId, v.label || `${weightGrams} g`, weightGrams, vPrice, vMrp, stockVal, vSku, i]
        );
      }
      await connection.query('UPDATE products SET discount_percentage = ? WHERE id = ?', [maxDiscountPct, productId]);
    }

    await connection.commit();

    // Fetch full product for real-time live sync to visitor catalog
    const [fullProduct]: any = await connection.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
              (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as imageUrl
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [productId]
    );
    const [pv]: any = await connection.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC',
      [productId]
    );
    const productPayload = {
      ...(fullProduct[0] || {}),
      imageUrl: fullProduct[0]?.imageUrl || finalImg,
      variants: pv,
    };
    if (io) {
      io.emit('product.created', productPayload);
      io.emit('catalog.updated', { action: 'created', product: productPayload });
    }

    return sendSuccess(res, { id: productId, product: productPayload }, 'Product created successfully', 201);
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function updateAdminProduct(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const productId = Number(req.params.id);
    const { name, description, imageUrl, image_url, isActive, is_active, category_id, categoryId, variants, tagline } = req.body;
    await connection.beginTransaction();

    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : (isActive !== undefined ? (isActive ? 1 : 0) : null);
    const catId = category_id || categoryId || null;

    await connection.query(
      `UPDATE products 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           tagline = COALESCE(?, tagline),
           category_id = COALESCE(?, category_id),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name || null, description || null, tagline || null, catId, activeVal, productId]
    );

    const finalImg = imageUrl || image_url;
    if (finalImg) {
      const [existing]: any = await connection.query(
        'SELECT id FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1',
        [productId]
      );
      if (existing.length > 0) {
        await connection.query('UPDATE product_images SET image_url = ? WHERE id = ?', [finalImg, existing[0].id]);
      } else {
        await connection.query(
          'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, 1, 0)',
          [productId, finalImg]
        );
      }
    }

    let maxDiscountPct = 0;
    if (variants && Array.isArray(variants)) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const stockVal = Number(v.stock ?? v.stock_quantity ?? 0);
        const weightGrams = parseWeightGrams(v.label);
        const vPrice = Number(v.price || 199);
        const vMrp = v.mrp !== undefined && v.mrp !== null && v.mrp !== '' ? Math.max(vPrice, Number(v.mrp)) : vPrice;
        const discountPct = vMrp > vPrice ? Math.round(((vMrp - vPrice) / vMrp) * 100) : 0;
        if (discountPct > maxDiscountPct) maxDiscountPct = discountPct;
        const cleanLabel = (v.label || `${weightGrams}g`).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const vSku = v.sku && v.sku.trim() ? v.sku.trim() : `TEA-${productId}-${cleanLabel}-${i + 1}`;

        if (v.id) {
          await connection.query(
            `UPDATE product_variants 
             SET label = ?, price = ?, mrp = ?, stock_quantity = ?, sku = COALESCE(?, sku)
             WHERE id = ? AND product_id = ?`,
            [v.label, vPrice, vMrp, stockVal, v.sku || null, v.id, productId]
          );
        } else {
          await connection.query(
            `INSERT INTO product_variants 
             (product_id, label, weight_grams, price, mrp, stock_quantity, sku, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [productId, v.label, weightGrams, vPrice, vMrp, stockVal, vSku, i]
          );
        }
      }
      await connection.query('UPDATE products SET discount_percentage = ? WHERE id = ?', [maxDiscountPct, productId]);
    }

    await connection.commit();

    // Automatically dispatch multichannel Restock Alerts (WhatsApp + Email + In-App) to requested customers
    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        const stockVal = Number(v.stock ?? v.stock_quantity ?? 0);
        if (v.id && stockVal > 0) {
          try {
            await dispatchRestockNotificationsForVariant(Number(v.id), { newStock: stockVal });
          } catch (notifErr) {
            console.warn('[AdminController] Error dispatching auto restock alerts on product update:', notifErr);
          }
        }
      }
    }

    // Fetch full updated product for real-time live sync to visitor catalog
    const [fullProduct]: any = await connection.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
              (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as imageUrl
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [productId]
    );
    const [pv]: any = await connection.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC',
      [productId]
    );
    const productPayload = {
      ...(fullProduct[0] || {}),
      discount_percentage: maxDiscountPct,
      discountPercentage: maxDiscountPct,
      imageUrl: fullProduct[0]?.imageUrl || finalImg,
      variants: pv,
    };
    if (io) {
      io.emit('product.updated', productPayload);
      io.emit('catalog.updated', { action: 'updated', product: productPayload });
    }

    return sendSuccess(res, { id: productId, product: productPayload }, 'Product updated successfully');
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

export async function deleteAdminProduct(req: Request, res: Response, next: NextFunction) {
  const connection = await pool.getConnection();
  try {
    const productId = Number(req.params.id);
    await connection.beginTransaction();

    await connection.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
    await connection.query('DELETE FROM product_variants WHERE product_id = ?', [productId]);
    await connection.query('DELETE FROM products WHERE id = ?', [productId]);

    await connection.commit();
    if (io) {
      io.emit('product.deleted', { productId });
      io.emit('catalog.updated', { action: 'deleted', productId });
    }
    return sendSuccess(res, { id: productId }, 'Product deleted');
  } catch (err) {
    await connection.rollback();
    return next(err);
  } finally {
    connection.release();
  }
}

// Helper to format ISO or any JS date string to MySQL 'YYYY-MM-DD HH:MM:SS'
function toMySQLDateTime(dateInput: any): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Coupons CRUD
export async function getAdminCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const [coupons]: any = await pool.query(`
      SELECT c.*, 
             c.discount_type as type,
             c.discount_value as value,
             c.max_discount as max_discount_cap,
             COUNT(cu.id) as total_used, 
             COALESCE(SUM(cu.discount_amount), 0) as total_discount_given
      FROM coupons c
      LEFT JOIN coupon_usages cu ON c.id = cu.coupon_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return sendSuccess(res, coupons);
  } catch (err) {
    return next(err);
  }
}

export async function createAdminCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      code,
      type,
      discount_type,
      value,
      discount_value,
      title,
      description,
      maxDiscountCap,
      max_discount,
      minOrderValue,
      min_order_value,
      usageLimitTotal,
      usage_limit_total,
      usageLimitPerUser,
      usage_limit_per_user,
      isFirstOrderOnly,
      is_first_order_only,
      validFrom,
      valid_from,
      validTo,
      valid_to,
    } = req.body;

    const discType = discount_type || type || 'PERCENT';
    const discVal = discount_value ?? value ?? 10;
    const coupTitle = title || (discType === 'PERCENT' ? `${discVal}% OFF` : `Flat ₹${discVal} OFF`);
    const coupDesc = description || `Special discount on tea orders`;
    const minOrder = min_order_value ?? minOrderValue ?? 0;
    const maxDisc = max_discount ?? maxDiscountCap ?? null;
    const usageTotal = usage_limit_total ?? usageLimitTotal ?? 1000;
    const usagePerUser = usage_limit_per_user ?? usageLimitPerUser ?? 1;
    const firstOrderOnly = is_first_order_only !== undefined ? (is_first_order_only ? 1 : 0) : (isFirstOrderOnly ? 1 : 0);

    const formattedValidFrom = toMySQLDateTime(valid_from || validFrom);
    const formattedValidTo = toMySQLDateTime(valid_to || validTo);

    const [result]: any = await pool.query(
      `INSERT INTO coupons 
       (code, title, description, discount_type, discount_value, max_discount, min_order_value, usage_limit_total, usage_limit_per_user, is_first_order_only, valid_from, valid_to, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), COALESCE(?, DATE_ADD(NOW(), INTERVAL 1 YEAR)), 1)`,
      [
        code.toUpperCase(),
        coupTitle,
        coupDesc,
        discType,
        discVal,
        maxDisc,
        minOrder,
        usageTotal,
        usagePerUser,
        firstOrderOnly,
        formattedValidFrom,
        formattedValidTo,
      ]
    );

    const couponId = result.insertId;
    const [cRows]: any = await pool.query('SELECT * FROM coupons WHERE id = ?', [couponId]);
    const couponObj = cRows[0];
    if (io) {
      io.emit('coupon.created', couponObj);
      io.emit('coupons.updated', { action: 'created', coupon: couponObj });
    }

    return sendSuccess(res, { id: couponId, coupon: couponObj }, 'Coupon created successfully', 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const couponId = Number(req.params.id);
    const { isActive, is_active, isFirstOrderOnly, is_first_order_only, maxDiscountCap, max_discount, minOrderValue, min_order_value, usageLimitTotal, usage_limit_total, validTo, valid_to } = req.body;

    let activeVal: number | null = null;
    if (is_active !== undefined) {
      activeVal = is_active === true || Number(is_active) === 1 ? 1 : 0;
    } else if (isActive !== undefined) {
      activeVal = isActive === true || Number(isActive) === 1 ? 1 : 0;
    }

    let firstOrderVal: number | null = null;
    if (is_first_order_only !== undefined) {
      firstOrderVal = is_first_order_only === true || Number(is_first_order_only) === 1 ? 1 : 0;
    } else if (isFirstOrderOnly !== undefined) {
      firstOrderVal = isFirstOrderOnly === true || Number(isFirstOrderOnly) === 1 ? 1 : 0;
    }

    const formattedValidTo = toMySQLDateTime(valid_to || validTo);

    await pool.query(
      `UPDATE coupons 
       SET is_active = COALESCE(?, is_active),
           is_first_order_only = COALESCE(?, is_first_order_only),
           max_discount = COALESCE(?, max_discount),
           min_order_value = COALESCE(?, min_order_value),
           usage_limit_total = COALESCE(?, usage_limit_total),
           valid_to = COALESCE(?, valid_to)
       WHERE id = ?`,
      [
        activeVal,
        firstOrderVal,
        max_discount ?? maxDiscountCap ?? null,
        min_order_value ?? minOrderValue ?? null,
        usage_limit_total ?? usageLimitTotal ?? null,
        formattedValidTo,
        couponId,
      ]
    );

    const [cRows]: any = await pool.query('SELECT * FROM coupons WHERE id = ?', [couponId]);
    const updatedCoupon = cRows[0];
    if (io && updatedCoupon) {
      io.emit('coupon.updated', updatedCoupon);
      io.emit('coupons.updated', { action: 'updated', coupon: updatedCoupon });
    }

    return sendSuccess(res, { id: couponId, coupon: updatedCoupon }, 'Coupon updated');
  } catch (err) {
    return next(err);
  }
}

// Reviews Moderation & Reply
export async function getAdminReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const [reviews]: any = await pool.query(`
      SELECT r.*, u.name as reviewer_name, u.email as reviewer_email, o.order_number,
             COALESCE(
               (SELECT GROUP_CONCAT(product_name SEPARATOR ', ') FROM order_items WHERE order_id = r.order_id),
               CONCAT('Order #', r.order_id)
             ) as product_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN orders o ON r.order_id = o.id
      ORDER BY r.created_at DESC
    `);
    return sendSuccess(res, reviews);
  } catch (err) {
    return next(err);
  }
}

export async function moderateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewId = Number(req.params.id);
    const { isHidden, adminReply } = req.body;

    const [reviews]: any = await pool.query('SELECT order_id FROM reviews WHERE id = ?', [reviewId]);
    if (reviews.length === 0) {
      return sendError(res, 'Review not found', 404);
    }

    await pool.query(
      `UPDATE reviews 
       SET is_approved = CASE WHEN ? IS NOT NULL THEN (CASE WHEN ? = 1 THEN 0 ELSE 1 END) ELSE is_approved END,
           admin_reply = COALESCE(?, admin_reply),
           admin_replied_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE admin_replied_at END
       WHERE id = ?`,
      [isHidden, isHidden, adminReply, adminReply, reviewId]
    );

    if (reviews[0].order_id) {
      const [items]: any = await pool.query(
        'SELECT DISTINCT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
        [reviews[0].order_id]
      );
      for (const it of items) {
        await recalculateProductRating(it.product_id);
      }
    }
    return sendSuccess(res, { id: reviewId }, 'Review updated');
  } catch (err) {
    return next(err);
  }
}

// Customers List
export async function getAdminCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const [customers]: any = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
             COUNT(o.id) as total_orders,
             COALESCE(SUM(CASE WHEN o.status != 'CANCELLED' AND o.status != 'REJECTED' THEN o.total ELSE 0 END), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY total_spent DESC, u.created_at DESC
    `);
    return sendSuccess(res, customers);
  } catch (err) {
    return next(err);
  }
}

// -----------------------------------------------------------------------------
// DEAL OF THE DAY (PROMOTIONS) CONTROLLERS
// -----------------------------------------------------------------------------

async function broadcastActiveDeal() {
  await invalidateCachePattern('content:promotions*');
  if (!io) return;
  try {
    const [rows]: any = await pool.query(
      `SELECT 
        pr.id,
        pr.product_id,
        pr.variant_id,
        pr.title,
        pr.subtitle,
        pr.deal_price,
        pr.original_price,
        pr.discount_percent,
        pr.start_time,
        pr.end_time,
        pr.image_url as promo_image,
        p.name as product_name,
        p.slug as product_slug,
        p.rating as product_rating,
        p.review_count,
        pv.label as variant_label,
        pv.weight_grams,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image
       FROM promotions pr
       JOIN products p ON pr.product_id = p.id
       LEFT JOIN product_variants pv ON pr.variant_id = pv.id
       WHERE pr.is_active = TRUE AND (pr.end_time IS NULL OR pr.end_time > NOW())
       ORDER BY pr.id DESC`
    );

    const now = new Date();
    const dealsList = rows.map((promo: any) => {
      const endTime = promo.end_time ? new Date(promo.end_time) : new Date(now.getTime() + 86400000);
      const remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      const imageChoice = promo.promo_image || promo.product_image || 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800';

      return {
        id: promo.id,
        productId: promo.product_id,
        variantId: promo.variant_id,
        variantLabel: promo.variant_label,
        weightGrams: promo.weight_grams,
        title: promo.title,
        subtitle: promo.subtitle,
        dealPrice: Number(promo.deal_price),
        originalPrice: Number(promo.original_price),
        discountPercent: Number(promo.discount_percent),
        image: imageChoice,
        imageUrl: imageChoice,
        rating: Number(promo.product_rating) || 4.9,
        reviewCount: Number(promo.review_count) || 450,
        endTime: endTime.toISOString(),
        remainingSeconds,
      };
    });

    io.emit('deals.updated', dealsList);
    io.emit('deal.updated', dealsList.length > 0 ? dealsList[0] : null);
    io.emit('flash_deal.updated', dealsList);
  } catch (err) {
    console.warn('Error broadcasting deal update:', err);
  }
}

export async function getAdminDeals(req: Request, res: Response, next: NextFunction) {
  try {
    const [deals]: any = await pool.query(`
      SELECT 
        pr.id,
        pr.product_id,
        pr.variant_id,
        pr.title,
        pr.subtitle,
        pr.image_url,
        pr.deal_price,
        pr.original_price,
        pr.discount_percent,
        pr.start_time,
        pr.end_time,
        pr.is_active,
        pr.created_at,
        p.name as product_name,
        c.name as product_category,
        c.slug as product_category_slug,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image,
        pv.label as variant_label,
        pv.price as current_variant_price,
        pv.mrp as current_variant_mrp,
        CASE 
          WHEN pr.is_active = 1 AND (pr.end_time IS NULL OR pr.end_time > NOW()) AND (pr.start_time <= NOW()) THEN 'ACTIVE'
          WHEN pr.is_active = 1 AND pr.start_time > NOW() THEN 'SCHEDULED'
          WHEN pr.is_active = 1 AND pr.end_time <= NOW() THEN 'EXPIRED'
          ELSE 'DISABLED'
        END as status
      FROM promotions pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON pr.variant_id = pv.id
      ORDER BY pr.is_active DESC, pr.id DESC
    `);
    return sendSuccess(res, deals);
  } catch (err) {
    return next(err);
  }
}

export async function createAdminDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      productId,
      product_id,
      variantId,
      variant_id,
      title,
      subtitle,
      imageUrl,
      image_url,
      dealPrice,
      deal_price,
      originalPrice,
      original_price,
      discountPercent,
      discount_percent,
      startTime,
      start_time,
      endTime,
      end_time,
      isActive,
      is_active,
    } = req.body;

    const targetProductId = Number(productId ?? product_id);
    const targetVariantId = Number(variantId ?? variant_id);
    const targetDealPrice = Number(dealPrice ?? deal_price);
    const targetOrigPrice = Number(originalPrice ?? original_price);
    const targetDiscount = Number(discountPercent ?? discount_percent) || (
      targetOrigPrice > targetDealPrice
        ? Math.round(((targetOrigPrice - targetDealPrice) / targetOrigPrice) * 100)
        : 0
    );
    const active = isActive !== undefined ? (Boolean(isActive) ? 1 : 0) : (is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1);

    const now = new Date();
    const start = startTime || start_time ? new Date(startTime || start_time) : now;
    const end = endTime || end_time ? new Date(endTime || end_time) : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const formattedStart = start.toISOString().slice(0, 19).replace('T', ' ');
    const formattedEnd = end.toISOString().slice(0, 19).replace('T', ' ');
    const customImg = (imageUrl ?? image_url) || null;

    const [insertResult]: any = await pool.query(
      `INSERT INTO promotions (
        product_id, variant_id, title, subtitle, image_url,
        deal_price, original_price, discount_percent,
        start_time, end_time, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetProductId,
        targetVariantId,
        title || 'Deal of the Day',
        subtitle || 'Fresh Harvest Special Offer',
        customImg,
        targetDealPrice,
        targetOrigPrice,
        targetDiscount,
        formattedStart,
        formattedEnd,
        active,
      ]
    );

    const newDealId = insertResult.insertId;
    await broadcastActiveDeal();

    return sendSuccess(res, { id: newDealId }, 'Deal of the Day created successfully', 201);
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const dealId = Number(req.params.id);
    const {
      productId,
      product_id,
      variantId,
      variant_id,
      title,
      subtitle,
      imageUrl,
      image_url,
      dealPrice,
      deal_price,
      originalPrice,
      original_price,
      discountPercent,
      discount_percent,
      startTime,
      start_time,
      endTime,
      end_time,
      isActive,
      is_active,
    } = req.body;

    const [existing]: any = await pool.query('SELECT * FROM promotions WHERE id = ?', [dealId]);
    if (existing.length === 0) {
      return sendError(res, 'Deal not found', 404);
    }
    const current = existing[0];

    const targetProductId = productId !== undefined || product_id !== undefined ? Number(productId ?? product_id) : current.product_id;
    const targetVariantId = variantId !== undefined || variant_id !== undefined ? Number(variantId ?? variant_id) : current.variant_id;
    const targetTitle = title !== undefined ? title : current.title;
    const targetSubtitle = subtitle !== undefined ? subtitle : current.subtitle;
    const customImg = imageUrl !== undefined || image_url !== undefined ? ((imageUrl ?? image_url) || null) : current.image_url;
    const targetDealPrice = dealPrice !== undefined || deal_price !== undefined ? Number(dealPrice ?? deal_price) : Number(current.deal_price);
    const targetOrigPrice = originalPrice !== undefined || original_price !== undefined ? Number(originalPrice ?? original_price) : Number(current.original_price);
    const targetDiscount = discountPercent !== undefined || discount_percent !== undefined
      ? Number(discountPercent ?? discount_percent)
      : Math.round(((targetOrigPrice - targetDealPrice) / targetOrigPrice) * 100);

    const active = isActive !== undefined ? (Boolean(isActive) ? 1 : 0) : (is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : current.is_active);

    let formattedStart = current.start_time;
    if (startTime || start_time) {
      formattedStart = new Date(startTime || start_time).toISOString().slice(0, 19).replace('T', ' ');
    }
    let formattedEnd = current.end_time;
    if (endTime || end_time) {
      formattedEnd = new Date(endTime || end_time).toISOString().slice(0, 19).replace('T', ' ');
    }

    await pool.query(
      `UPDATE promotions SET
        product_id = ?, variant_id = ?, title = ?, subtitle = ?, image_url = ?,
        deal_price = ?, original_price = ?, discount_percent = ?,
        start_time = ?, end_time = ?, is_active = ?
       WHERE id = ?`,
      [
        targetProductId,
        targetVariantId,
        targetTitle,
        targetSubtitle,
        customImg,
        targetDealPrice,
        targetOrigPrice,
        targetDiscount,
        formattedStart,
        formattedEnd,
        active,
        dealId,
      ]
    );

    await broadcastActiveDeal();

    return sendSuccess(res, { id: dealId }, 'Deal of the Day updated successfully');
  } catch (err) {
    return next(err);
  }
}

export async function toggleAdminDealStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const dealId = Number(req.params.id);
    const { isActive, is_active } = req.body;
    const active = isActive !== undefined ? (Boolean(isActive) ? 1 : 0) : (is_active !== undefined ? (Boolean(is_active) ? 1 : 0) : 1);

    await pool.query('UPDATE promotions SET is_active = ? WHERE id = ?', [active, dealId]);
    await broadcastActiveDeal();

    return sendSuccess(res, { id: dealId, is_active: active }, 'Deal status updated');
  } catch (err) {
    return next(err);
  }
}

export async function deleteAdminDeal(req: Request, res: Response, next: NextFunction) {
  try {
    const dealId = Number(req.params.id);
    await pool.query('DELETE FROM promotions WHERE id = ?', [dealId]);

    await broadcastActiveDeal();

    return sendSuccess(res, { id: dealId }, 'Deal deleted successfully');
  } catch (err) {
    return next(err);
  }
}

/**
 * Get all out-of-stock subscriptions and waitlist requests
 */
export async function getAdminStockSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT 
        ss.id,
        ss.user_id,
        ss.product_id,
        ss.variant_id,
        ss.contact_type,
        ss.contact_value,
        ss.is_notified,
        ss.notified_at,
        ss.created_at,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        p.name as product_name,
        p.slug as product_slug,
        pv.label as variant_label,
        pv.price as variant_price,
        pv.mrp as variant_mrp,
        pv.stock_quantity as current_stock,
        COALESCE(
          (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1),
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800'
        ) as product_image
      FROM stock_subscriptions ss
      LEFT JOIN users u ON ss.user_id = u.id
      JOIN products p ON ss.product_id = p.id
      JOIN product_variants pv ON ss.variant_id = pv.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status === 'pending') {
      query += ' AND ss.is_notified = FALSE';
    } else if (status === 'notified') {
      query += ' AND ss.is_notified = TRUE';
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ` AND (
        p.name LIKE ? OR 
        pv.label LIKE ? OR 
        u.name LIKE ? OR 
        u.email LIKE ? OR 
        u.phone LIKE ? OR 
        ss.contact_value LIKE ?
      )`;
      params.push(q, q, q, q, q, q);
    }

    query += ' ORDER BY ss.is_notified ASC, ss.created_at DESC';

    const [rows]: any = await pool.query(query, params);

    // Compute KPI metrics
    const total = rows.length;
    const pending = rows.filter((r: any) => !r.is_notified).length;
    const notified = rows.filter((r: any) => r.is_notified).length;
    const uniqueProducts = new Set(rows.map((r: any) => r.product_id)).size;

    return sendSuccess(res, {
      items: rows,
      stats: {
        total,
        pending,
        notified,
        uniqueProducts,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Manually trigger stock notification for a single subscription (handles "Alert" & "Re-send")
 */
export async function triggerAdminManualStockNotify(req: Request, res: Response, next: NextFunction) {
  try {
    const subId = Number(req.params.id);

    const result = await dispatchRestockNotificationForSingleSubscription(subId);

    if (!result.success) {
      return sendError(res, result.message || 'Subscription not found', 404);
    }

    const channels: string[] = [];
    if (result.email) channels.push(`Email (${result.email})`);
    if (result.phone) channels.push(`WhatsApp (${result.phone})`);
    if (result.notifiedDetails?.inAppSent) channels.push('In-App');

    const channelStr = channels.length > 0 ? channels.join(' & ') : 'customer notification';

    return sendSuccess(
      res,
      result,
      `Restock notification re-sent successfully via ${channelStr}!`
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * Quick restock a variant directly from stock alerts table and auto-notify all waiting users
 */
export async function triggerAdminStockRestock(req: Request, res: Response, next: NextFunction) {
  try {
    const { variantId, stockQuantity } = req.body;
    const newStock = Number(stockQuantity);

    if (!variantId || isNaN(newStock) || newStock < 0) {
      return sendError(res, 'Valid variantId and stockQuantity are required', 400);
    }

    // Update variant stock in product_variants
    await pool.query(
      `UPDATE product_variants SET stock_quantity = ? WHERE id = ?`,
      [newStock, variantId]
    );

    // If stock > 0, automatically dispatch multichannel alerts (WhatsApp + Email + In-App + Socket.io)
    let notifiedCount = 0;
    if (newStock > 0) {
      const result = await dispatchRestockNotificationsForVariant(variantId, { newStock });
      notifiedCount = result.notifiedCount;
    }

    io.emit('product.updated', { variantId, stock: newStock });
    io.emit('catalog.updated', { action: 'restocked', variantId, newStock });

    return sendSuccess(
      res,
      { variantId, newStock, notifiedCount },
      `Variant inventory updated to ${newStock} units. ${notifiedCount} waiting customer${notifiedCount === 1 ? '' : 's'} notified via WhatsApp, Email & App!`
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * Trigger back-in-stock alerts to ALL waiting customers for a specific variant with a single action
 */
export async function triggerAdminNotifyVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const variantId = Number(req.params.variantId);
    const result = await dispatchRestockNotificationsForVariant(variantId);

    return sendSuccess(
      res,
      { count: result.notifiedCount, variantId },
      `Successfully sent WhatsApp, Email & in-app alerts to ${result.notifiedCount} waiting customer${result.notifiedCount === 1 ? '' : 's'}!`
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * Trigger alerts to ALL waiting customers across ALL variants for a product
 */
export async function triggerAdminNotifyProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = Number(req.params.productId);
    const [variantRows]: any = await pool.query('SELECT id FROM product_variants WHERE product_id = ?', [productId]);
    let totalNotified = 0;
    for (const v of variantRows) {
      const resV = await dispatchRestockNotificationsForVariant(v.id);
      totalNotified += resV.notifiedCount;
    }

    return sendSuccess(
      res,
      { count: totalNotified, productId },
      `Successfully sent WhatsApp, Email & in-app alerts to ${totalNotified} customer${totalNotified === 1 ? '' : 's'}!`
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * Bulk notify selected subscriptions
 */
export async function triggerAdminBulkStockNotify(req: Request, res: Response, next: NextFunction) {
  try {
    const { subscriptionIds } = req.body;
    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return sendError(res, 'Array of subscriptionIds is required', 400);
    }

    let totalNotified = 0;
    for (const subId of subscriptionIds) {
      const resSingle = await dispatchRestockNotificationForSingleSubscription(Number(subId));
      if (resSingle.success) totalNotified++;
    }

    return sendSuccess(
      res,
      { count: totalNotified, subscriptionIds },
      `Dispatched multichannel WhatsApp, Email & in-app alerts to ${totalNotified} customer${totalNotified === 1 ? '' : 's'} successfully.`
    );
  } catch (err) {
    return next(err);
  }
}
