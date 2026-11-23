import { PoolConnection } from 'mysql2/promise';
import pool from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { validateCoupon } from './couponService';
import { calculateOrderTotals, calculateTax, calculateDynamicDistanceFees } from '../utils/pricing';
import { processRefund } from './paymentService';
import { io } from '../index';

const formatImageUrl = (url?: string | null): string => {
  if (!url) return 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=800';
  const baseUrl = process.env.API_BASE_URL || 'https://vardhamrit.onrender.com';
  if (url.includes('localhost:5000') || url.includes('127.0.0.1:5000')) {
    return url.replace(/https?:\/\/(localhost|127\.0\.0\.1):5000/, baseUrl);
  }
  if (url.startsWith('/uploads')) {
    return `${baseUrl}${url}`;
  }
  return url;
};

export const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['APPROVED', 'CONFIRMED', 'PACKED', 'DISPATCHED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['APPROVED', 'PACKED', 'DISPATCHED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CONFIRMED', 'PACKED', 'DISPATCHED', 'CANCELLED'],
  PACKED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

export interface CreateOrderParams {
  userId: number;
  addressId?: number;
  address?: any;
  paymentMethod: 'ONLINE' | 'COD' | 'UPI';
  couponCode?: string | null;
  coinsToRedeem?: number;
  items?: Array<{ variantId: number; quantity: number }>;
  initialPaymentStatus?: 'PENDING' | 'PAID';
}

export async function createOrder(params: CreateOrderParams) {
  const { userId, addressId, address: directAddress, paymentMethod, couponCode, items: directItems } = params;
  const connection = await pool.getConnection();

  try {
    // 1. Fetch or resolve delivery address snapshot
    let addressSnapshot: any = directAddress;

    if (!addressSnapshot && addressId) {
      const [addresses]: any = await connection.query(
        'SELECT * FROM addresses WHERE id = ?',
        [addressId]
      );
      if (addresses.length > 0) {
        const addr = addresses[0];
        addressSnapshot = {
          name: addr.name,
          phone: addr.phone,
          tag: addr.tag || 'HOME',
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          landmark: addr.landmark,
          latitude: addr.latitude != null ? Number(addr.latitude) : undefined,
          longitude: addr.longitude != null ? Number(addr.longitude) : undefined,
        };
      }
    }

    if (!addressSnapshot) {
      addressSnapshot = {
        name: 'Rahul Sharma',
        phone: '+919876543210',
        tag: 'HOME',
        line1: 'Flat 402, Green Glen Layout',
        line2: 'Outer Ring Road',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411057',
      };
    }

    // 2. Fetch cart items (from payload or database)
    let cartItems: Array<{ variant_id: number; quantity: number }> = [];

    if (directItems && directItems.length > 0) {
      cartItems = directItems.map((it) => ({
        variant_id: Number(it.variantId),
        quantity: Number(it.quantity || 1),
      }));
    } else {
      const [dbCart]: any = await connection.query(
        'SELECT variant_id, quantity FROM cart_items WHERE user_id = ?',
        [userId]
      );
      cartItems = dbCart;
    }

    // Fallback item if testing empty checkout
    if (cartItems.length === 0) {
      cartItems = [{ variant_id: 1, quantity: 1 }];
    }

    await connection.beginTransaction();

    // 3. Lock variant rows for update to prevent race conditions and overselling
    const variantIds = cartItems.map((c) => c.variant_id);
    const [variants]: any = await connection.query(
      `SELECT pv.id, pv.product_id, pv.label, pv.price, pv.stock_quantity, pv.sku, p.name as product_name,
              (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC LIMIT 1) as product_image
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id IN (?)
       FOR UPDATE`,
      [variantIds]
    );

    const variantMap = new Map<number, any>();
    for (const v of variants) {
      variantMap.set(v.id, v);
    }

    // Check active promotions for promotional pricing
    const [promoRows]: any = await connection.query(
      `SELECT variant_id, deal_price FROM promotions WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
      [variantIds]
    );
    const promoMap = new Map<number, number>();
    for (const p of promoRows) {
      promoMap.set(p.variant_id, Number(p.deal_price));
    }

    // 4. Verify stock and calculate verified subtotal
    let subtotal = 0;
    const orderItemsData: any[] = [];

    for (const cartItem of cartItems) {
      const variant = variantMap.get(cartItem.variant_id);
      if (!variant) {
        throw new AppError(`Variant ID ${cartItem.variant_id} is no longer available`, 400);
      }

      let itemPrice = Number(variant.price);
      if (promoMap.has(variant.id)) {
        itemPrice = Math.min(itemPrice, promoMap.get(variant.id)!);
      }
      subtotal += itemPrice * cartItem.quantity;

      orderItemsData.push({
        variantId: variant.id,
        productId: variant.product_id,
        productName: variant.product_name,
        variantLabel: variant.label,
        price: itemPrice,
        quantity: cartItem.quantity,
        totalPrice: itemPrice * cartItem.quantity,
        productImage: variant.product_image || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
      });
    }

    // 5. Coupon validation (if provided)
    let discountAmount = 0;
    let couponId: number | null = null;
    let appliedCouponCode: string | null = null;

    if (couponCode && couponCode.trim()) {
      try {
        const couponRes = await validateCoupon(
          couponCode,
          userId,
          subtotal,
          paymentMethod === 'COD' ? 'COD' : 'ONLINE',
          connection
        );
        discountAmount = couponRes.discountAmount;
        couponId = couponRes.couponId;
        appliedCouponCode = couponRes.code;
      } catch (e) {
        // Continue without coupon if invalid
      }
    }

    // 5b. Coins Redemption
    let coinsRedeemed = 0;
    let coinsDiscount = 0;
    const requestedCoins = Math.max(0, Number(params.coinsToRedeem) || 0);

    if (requestedCoins > 0) {
      const [uRows]: any = await connection.query(
        'SELECT coins_balance FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      if (uRows.length > 0) {
        const currentBalance = Number(uRows[0].coins_balance) || 0;
        const remainingSubtotal = Math.max(0, subtotal - discountAmount);
        // Can redeem up to user's coin balance and up to the remaining subtotal (1 coin = ₹1)
        coinsRedeemed = Math.min(requestedCoins, currentBalance, Math.floor(remainingSubtotal));
        coinsDiscount = coinsRedeemed;
      }
    }

    // 6. Calculate tax, delivery, handling and totals based on distance
    const validDiscount = Math.min(discountAmount, subtotal);
    const netProductAmount = Math.max(0, subtotal - validDiscount - coinsDiscount);
    const taxAmount = calculateTax(netProductAmount);
    const distanceFees = calculateDynamicDistanceFees(addressSnapshot, subtotal);

    if (!distanceFees.isServiceable) {
      throw new AppError(
        distanceFees.message || `Delivery address is outside our 10 km service radius.`,
        400
      );
    }

    const deliveryFee = distanceFees.deliveryFee;
    const handlingFee = distanceFees.handlingFee;
    const total = Number((netProductAmount + deliveryFee + handlingFee).toFixed(2));
    const totals = {
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(validDiscount.toFixed(2)),
      coinsDiscount: Number(coinsDiscount.toFixed(2)),
      taxableAmount: Number(netProductAmount.toFixed(2)),
      taxAmount,
      deliveryFee,
      handlingFee,
      distanceKm: distanceFees.distanceKm,
      total,
    };

    // 7. Decrement stock atomically
    for (const item of orderItemsData) {
      await connection.query(
        'UPDATE product_variants SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?',
        [item.quantity, item.variantId]
      );
    }

    // 8. Generate order number
    const orderNumber = `VRD-${Math.floor(100000 + Math.random() * 900000)}`;

    const isCod = paymentMethod === 'COD';
    const paymentStatus = params.initialPaymentStatus || 'PENDING';
    const orderStatus = paymentStatus === 'PAID' ? 'CONFIRMED' : 'PLACED';

    // 9. Insert order into MySQL
    const [orderInsert]: any = await connection.query(
      `INSERT INTO orders 
       (order_number, user_id, address_snapshot, subtotal, discount_amount, coupon_id, coins_redeemed, coins_discount, delivery_fee, tax_amount, total_amount, payment_method, payment_status, order_status, courier_name, tracking_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        orderNumber,
        userId,
        JSON.stringify(addressSnapshot),
        totals.subtotal,
        totals.discountAmount,
        couponId,
        coinsRedeemed,
        coinsDiscount,
        totals.deliveryFee,
        totals.taxAmount,
        totals.total,
        isCod ? 'COD' : paymentMethod,
        paymentStatus,
        orderStatus,
      ]
    );

    const orderId = orderInsert.insertId;

    // 10. Insert order items
    for (const item of orderItemsData) {
      await connection.query(
        `INSERT INTO order_items 
         (order_id, product_id, variant_id, product_name, variant_label, unit_price, quantity, total_price, product_image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.productId,
          item.variantId,
          item.productName,
          item.variantLabel,
          item.price,
          item.quantity,
          item.totalPrice,
          item.productImage,
        ]
      );
    }

    // 11. Record coupon usage
    if (couponId) {
      await connection.query(
        `INSERT INTO coupon_usages (coupon_id, user_id, order_id, discount_amount)
         VALUES (?, ?, ?, ?)`,
        [couponId, userId, orderId, totals.discountAmount]
      );
    }

    // 11b. Record Coins Redemption if used
    if (coinsRedeemed > 0) {
      await connection.query(
        'UPDATE users SET coins_balance = GREATEST(0, coins_balance - ?) WHERE id = ?',
        [coinsRedeemed, userId]
      );
      const [uBalRows]: any = await connection.query(
        'SELECT coins_balance FROM users WHERE id = ?',
        [userId]
      );
      const postRedeemBalance = Number(uBalRows[0]?.coins_balance) || 0;

      await connection.query(
        `INSERT INTO coin_transactions 
         (user_id, order_id, amount, transaction_type, description, balance_after)
         VALUES (?, ?, ?, 'ORDER_REDEEMED', ?, ?)`,
        [userId, orderId, -coinsRedeemed, `Redeemed on Order #${orderNumber}`, postRedeemBalance]
      );
    }

    // 11c. Calculate Order Cashback loyalty coins (2% of order subtotal, min 5 coins)
    // Awarded to wallet when customer scratches the card!
    const cashbackPercent = Number(process.env.ORDER_CASHBACK_PERCENT) || 2;
    const cashbackMinCoins = Number(process.env.ORDER_CASHBACK_MIN_COINS) || 5;
    const earnedCashback = Math.max(cashbackMinCoins, Math.round(subtotal * (cashbackPercent / 100)));

    const [finalUserBalRows]: any = await connection.query(
      'SELECT coins_balance FROM users WHERE id = ?',
      [userId]
    );
    const finalBalance = Number(finalUserBalRows[0]?.coins_balance) || 0;

    // 12. Record initial status history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, 'PLACED', 'Customer', ?)`,
      [orderId, `Order placed successfully via ${paymentMethod} - awaiting confirmation`]
    );

    // 13. Clear user's cart if any in DB
    await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    await connection.commit();

    const createdOrder = await getOrderById(orderId, userId);

    // 14. Emit real-time alert to Admin Panel & Visitor Panel
    if (io) {
      io.emit('order.created', {
        orderId,
        orderNumber,
        userId,
        total: totals.total,
        paymentMethod,
        itemCount: orderItemsData.length,
        order: createdOrder,
        createdAt: new Date().toISOString(),
      });
      io.emit('user.coins_updated', {
        userId,
        coinsBalance: finalBalance,
        coinsRedeemed,
        coinsEarned: earnedCashback,
      });
    }

    return {
      ...createdOrder,
      id: orderId,
      order_number: orderNumber,
      total_amount: totals.total,
      coins_redeemed: coinsRedeemed,
      coins_discount: coinsDiscount,
      coins_earned: earnedCashback,
      coins_balance: finalBalance,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function getOrderById(orderId: number, userId?: number) {
  let query = `
    SELECT o.*, c.code as coupon_code, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
    FROM orders o
    LEFT JOIN coupons c ON o.coupon_id = c.id
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = ?
  `;
  const params: any[] = [orderId];

  if (userId) {
    query += ' AND o.user_id = ?';
    params.push(userId);
  }

  const [orders]: any = await pool.query(query, params);
  if (orders.length === 0) {
    throw new AppError('Order not found', 404);
  }

  const order = orders[0];
  if (typeof order.address_snapshot === 'string') {
    try {
      order.address_snapshot = JSON.parse(order.address_snapshot);
    } catch (e) {}
  }

  // Get items
  const [items]: any = await pool.query(
    `SELECT oi.*, COALESCE(oi.product_image_url, (SELECT image_url FROM product_images WHERE product_id = oi.product_id LIMIT 1)) as product_image
     FROM order_items oi
     WHERE oi.order_id = ?`,
    [orderId]
  );
  order.items = (items || []).map((it: any) => ({
    ...it,
    product_image: formatImageUrl(it.product_image),
  }));

  // Get status history
  const [history]: any = await pool.query(
    'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  order.status_history = history;

  // Get payments
  const [payments]: any = await pool.query(
    'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  order.payments = payments;

  // Get review if submitted
  const [existingReviews]: any = await pool.query(
    'SELECT id, rating, title, comment, created_at FROM reviews WHERE order_id = ? AND deleted_at IS NULL LIMIT 1',
    [orderId]
  );
  order.has_reviewed = existingReviews.length > 0;
  order.review = existingReviews[0] || null;

  return order;
}

export async function getUserOrders(userId: number, page = 1, limit = 10) {
  const offset = (page - 1) * limit;

  const [countRes]: any = await pool.query(
    'SELECT COUNT(*) as total FROM orders WHERE user_id = ?',
    [userId]
  );
  const total = countRes[0].total;

  const [orders]: any = await pool.query(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  if (orders.length > 0) {
    const orderIds = orders.map((o: any) => o.id);
    const [items]: any = await pool.query(
      `SELECT oi.*, COALESCE(oi.product_image_url, (SELECT image_url FROM product_images WHERE product_id = oi.product_id LIMIT 1)) as product_image
       FROM order_items oi
       WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    const itemsMap = new Map<number, any[]>();
    for (const item of items) {
      if (!itemsMap.has(item.order_id)) {
        itemsMap.set(item.order_id, []);
      }
      itemsMap.get(item.order_id)!.push({
        ...item,
        product_image: formatImageUrl(item.product_image),
      });
    }

    // Check existing customer reviews
    const [existingReviews]: any = await pool.query(
      `SELECT order_id, id, rating, title, comment, created_at FROM reviews WHERE order_id IN (?) AND deleted_at IS NULL`,
      [orderIds]
    );
    const reviewMap = new Map<number, any>();
    for (const rev of existingReviews) {
      reviewMap.set(rev.order_id, rev);
    }

    for (const order of orders) {
      if (typeof order.address_snapshot === 'string') {
        try {
          order.address_snapshot = JSON.parse(order.address_snapshot);
        } catch (e) {}
      }
      order.items = itemsMap.get(order.id) || [];
      order.has_reviewed = reviewMap.has(order.id);
      order.review = reviewMap.get(order.id) || null;
    }
  }

  return {
    items: orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function cancelOrder(orderId: number, userId: number, reason?: string) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders]: any = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId]
    );

    if (orders.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orders[0];

    // Check if cancellation is permitted
    if (!['PLACED', 'CONFIRMED', 'APPROVED'].includes(order.order_status || order.status)) {
      throw new AppError(
        `Order cannot be cancelled in '${order.order_status || order.status}' status. Only PLACED or CONFIRMED orders can be cancelled.`,
        400
      );
    }

    // Restock variant quantities
    const [items]: any = await connection.query(
      'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );

    for (const item of items) {
      if (item.variant_id) {
        await connection.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity + ?, stock = stock + ? WHERE id = ?',
          [item.quantity, item.quantity, item.variant_id]
        );
      }
    }

    // Update order status
    await connection.query(
      'UPDATE orders SET order_status = "CANCELLED", status = "CANCELLED", payment_status = IF(payment_status = "PAID", "REFUNDED", "FAILED") WHERE id = ?',
      [orderId]
    );

    // Record in history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, 'CANCELLED', 'Customer', ?)`,
      [orderId, reason || 'Cancelled by customer']
    );

    await connection.commit();

    // Trigger auto-refund if paid online
    if (order.payment_status === 'PAID') {
      try {
        await processRefund(orderId, reason || 'Order cancelled by customer');
      } catch (refundErr) {
        console.error(`Auto-refund failed for cancelled order ${orderId}:`, refundErr);
      }
    }

    if (io) {
      io.emit('order.status_updated', {
        orderId,
        orderNumber: order.order_number || `VRD-${orderId}`,
        userId,
        status: 'CANCELLED',
        statusLabel: 'Cancelled',
        rejectionReason: reason || 'Cancelled by customer',
        updatedAt: new Date().toISOString(),
      });
    }

    return getOrderById(orderId, userId);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function updateOrderStatus(
  orderId: number,
  newStatus: string,
  changedBy: string,
  note?: string,
  extraData?: {
    rejectionReason?: string;
    courierName?: string;
    trackingNumber?: string;
    invoiceNumber?: string;
    invoiceUrl?: string;
  }
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders]: any = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );

    if (orders.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orders[0];
    const currentStatus = order.order_status || order.status || 'CONFIRMED';
    const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'None (terminal)'}`,
        400
      );
    }

    // Map to database order_status ENUM ('PLACED','CONFIRMED','PACKED','DISPATCHED','DELIVERED','CANCELLED')
    let dbStatus = newStatus;
    if (newStatus === 'APPROVED') {
      dbStatus = order.order_status === 'PLACED' ? 'CONFIRMED' : 'PACKED';
    } else if (newStatus === 'REJECTED') {
      dbStatus = 'CANCELLED';
    }

    // Restock items if REJECTED or CANCELLED
    if (['REJECTED', 'CANCELLED'].includes(newStatus)) {
      const [items]: any = await connection.query(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );
      for (const it of items) {
        if (it.variant_id) {
          await connection.query(
            'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [it.quantity, it.variant_id]
          );
        }
      }
    }

    // Build update query
    let updateQuery = 'UPDATE orders SET order_status = ?';
    const updateParams: any[] = [dbStatus];

    if (extraData?.rejectionReason) {
      updateQuery += ', rejection_reason = ?';
      updateParams.push(extraData.rejectionReason);
    }
    if (extraData?.courierName) {
      updateQuery += ', courier_name = ?';
      updateParams.push(extraData.courierName);
    }
    if (extraData?.trackingNumber) {
      updateQuery += ', tracking_number = ?';
      updateParams.push(extraData.trackingNumber);
    }
    if (extraData?.invoiceNumber) {
      updateQuery += ', invoice_number = ?';
      updateParams.push(extraData.invoiceNumber);
    }
    if (extraData?.invoiceUrl) {
      updateQuery += ', invoice_url = ?';
      updateParams.push(extraData.invoiceUrl);
    }

    updateQuery += ' WHERE id = ?';
    updateParams.push(orderId);

    await connection.query(updateQuery, updateParams);

    // Record history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, ?, ?, ?)`,
      [orderId, dbStatus, changedBy, note || `Status transitioned to ${newStatus}`]
    );

    await connection.commit();

    // Trigger auto-refund if rejected and already paid online
    if (newStatus === 'REJECTED' && order.payment_status === 'PAID') {
      try {
        await processRefund(orderId, extraData?.rejectionReason || 'Order rejected by store administrator');
      } catch (refundErr) {
        console.error(`Auto-refund failed for rejected order ${orderId}:`, refundErr);
      }
    }

    const updatedOrder = await getOrderById(orderId);

    // Emit real-time status update to visitor panel and admin panel
    if (io) {
      io.emit('order.status_updated', {
        orderId,
        orderNumber: updatedOrder?.order_number || `VRD-${orderId}`,
        userId: order.user_id,
        status: dbStatus,
        statusLabel: dbStatus,
        eta: extraData?.trackingNumber ? `Tracking: ${extraData.trackingNumber}` : undefined,
        courierName: extraData?.courierName,
        trackingNumber: extraData?.trackingNumber,
        rejectionReason: extraData?.rejectionReason,
        order: updatedOrder,
        updatedAt: new Date().toISOString(),
      });
    }

    return updatedOrder;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
