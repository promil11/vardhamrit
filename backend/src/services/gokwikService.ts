import QRCode from 'qrcode';
import pool from '../config/db';
import { GOKWIK_CONFIG, buildUpiLinks, verifyGoKwikSignature } from '../config/gokwik';
import { AppError } from '../middleware/errorHandler';
import { io } from '../index';
import { createOrder } from './orderService';
import { calculateTax, calculateDynamicDistanceFees } from '../utils/pricing';
import { validateCoupon } from './couponService';

export interface CreateGokwikSessionParams {
  userId: number;
  address: any;
  items: Array<{ variantId: number; quantity: number }>;
  couponCode?: string | null;
  coinsToRedeem?: number;
}

export interface GokwikSessionResult {
  sessionId: string;
  amount: number;
  currency: string;
  merchantVpa: string;
  merchantName: string;
  universalUpiUrl: string;
  appLinks: {
    gpay: string;
    phonepe: string;
    paytm: string;
    bhim: string;
    cred: string;
  };
  qrCodeDataUrl: string;
  expiresInSeconds: number;
}

/**
 * 1. Create a Payment Session WITHOUT creating an Order row in the database yet.
 * Order will only be placed once payment is received.
 */
export async function createGokwikCheckoutSession(params: CreateGokwikSessionParams): Promise<GokwikSessionResult> {
  const { userId, address, items, couponCode, coinsToRedeem = 0 } = params;

  if (!items || items.length === 0) {
    throw new AppError('Cannot initiate checkout with empty items', 400);
  }

  // 1. Calculate verified pricing
  const variantIds = items.map((i) => i.variantId);
  const [variants]: any = await pool.query(
    `SELECT pv.id, pv.price, pv.stock_quantity, pv.sku 
     FROM product_variants pv 
     WHERE pv.id IN (?)`,
    [variantIds]
  );

  const variantMap = new Map<number, any>();
  for (const v of variants) {
    variantMap.set(v.id, v);
  }

  // Check active promotions
  const [promoRows]: any = await pool.query(
    `SELECT variant_id, deal_price FROM promotions WHERE variant_id IN (?) AND is_active = TRUE AND NOW() BETWEEN start_time AND end_time`,
    [variantIds]
  );
  const promoMap = new Map<number, number>();
  for (const p of promoRows) {
    promoMap.set(p.variant_id, Number(p.deal_price));
  }

  let subtotal = 0;
  for (const item of items) {
    const v = variantMap.get(item.variantId);
    if (!v) {
      throw new AppError(`Product variant ${item.variantId} not found or unavailable`, 400);
    }
    let price = Number(v.price);
    if (promoMap.has(v.id)) {
      price = Math.min(price, promoMap.get(v.id)!);
    }
    subtotal += price * item.quantity;
  }

  // Coupon discount calculation
  let couponDiscount = 0;
  let validCouponId: number | null = null;
  if (couponCode && couponCode.trim()) {
    try {
      const couponRes = await validateCoupon(couponCode.trim(), userId, subtotal);
      if (couponRes && couponRes.valid) {
        couponDiscount = Number(couponRes.discountAmount) || 0;
        validCouponId = couponRes.couponId || null;
      }
    } catch {
      // Ignore invalid coupon
    }
  }

  // Coins calculation
  const remainingSubtotal = Math.max(0, subtotal - couponDiscount);
  const coinsDiscount = Math.min(Number(coinsToRedeem) || 0, Math.floor(remainingSubtotal));

  // Taxes, delivery & handling dynamically calculated according to distance
  const netProductAmount = Math.max(0, subtotal - couponDiscount - coinsDiscount);
  const taxAmount = calculateTax(netProductAmount);
  const distanceFees = calculateDynamicDistanceFees(address, subtotal);

  if (!distanceFees.isServiceable) {
    throw new AppError(
      distanceFees.message || `Delivery address is outside our 10 km service radius.`,
      400
    );
  }

  const deliveryFee = distanceFees.deliveryFee;
  const handlingFee = distanceFees.handlingFee;
  const grandTotal = Number((netProductAmount + deliveryFee + handlingFee).toFixed(2));

  // Generate unique Session ID
  const sessionId = `GKSESS_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Store Session data in MySQL
  const sessionData = {
    userId,
    address,
    items,
    couponCode: couponCode || null,
    couponId: validCouponId,
    coinsToRedeem: coinsDiscount,
    subtotal: Number(subtotal.toFixed(2)),
    discountAmount: couponDiscount,
    coinsDiscount,
    taxAmount,
    deliveryFee,
    handlingFee,
    distanceKm: distanceFees.distanceKm,
    grandTotal,
  };

  await pool.query(
    `INSERT INTO payment_sessions 
     (id, user_id, session_data, amount, payment_status, expires_at)
     VALUES (?, ?, ?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
    [sessionId, userId, JSON.stringify(sessionData), grandTotal]
  );

  // Generate UPI links and dynamic QR code
  const upiLinks = buildUpiLinks({
    transactionId: sessionId,
    orderNumber: sessionId,
    amount: grandTotal,
    note: `Vardhamrit Chai Checkout`,
  });

  let qrCodeDataUrl = GOKWIK_CONFIG.customQrImageUrl || '';
  if (!qrCodeDataUrl) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(upiLinks.universalUpiUrl, {
        errorCorrectionLevel: 'M',
        margin: 2,
        scale: 8,
        color: {
          dark: '#1B382B',
          light: '#FFFFFF',
        },
      });
    } catch (err) {
      console.error('Error generating UPI QR:', err);
    }
  }

  return {
    sessionId,
    amount: grandTotal,
    currency: 'INR',
    merchantVpa: GOKWIK_CONFIG.upiVpa,
    merchantName: GOKWIK_CONFIG.merchantName,
    universalUpiUrl: upiLinks.universalUpiUrl,
    appLinks: {
      gpay: upiLinks.gpayUrl,
      phonepe: upiLinks.phonepeUrl,
      paytm: upiLinks.paytmUrl,
      bhim: upiLinks.bhimUrl,
      cred: upiLinks.credUrl,
    },
    qrCodeDataUrl,
    expiresInSeconds: 600,
  };
}

/**
 * 2. Check Session Status
 */
export async function getGokwikSessionStatus(sessionId: string, userId?: number) {
  const [rows]: any = await pool.query(
    'SELECT id, user_id, amount, payment_status, order_id, order_number, expires_at FROM payment_sessions WHERE id = ?',
    [sessionId]
  );

  if (rows.length === 0) {
    throw new AppError('Payment session not found', 404);
  }

  const session = rows[0];
  if (userId && session.user_id !== userId) {
    throw new AppError('Access denied', 403);
  }

  const isPaid = session.payment_status === 'PAID';

  return {
    sessionId: session.id,
    amount: Number(session.amount),
    paymentStatus: session.payment_status,
    isPaid,
    orderId: session.order_id,
    orderNumber: session.order_number,
  };
}

/**
 * 3. Confirm Payment for a Session:
 * Creates the order in the `orders` table ONLY NOW after money is verified!
 */
export async function confirmGokwikSessionPayment(
  sessionId: string,
  options?: {
    paymentRef?: string;
    userId?: number;
    raw?: any;
  }
) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [rows]: any = await connection.query(
      'SELECT * FROM payment_sessions WHERE id = ? FOR UPDATE',
      [sessionId]
    );

    if (rows.length === 0) {
      throw new AppError('Payment session not found', 404);
    }

    const session = rows[0];

    if (options?.userId && session.user_id !== options.userId) {
      throw new AppError('Access denied', 403);
    }

    // Idempotent: If already paid and order already created, return existing order details
    if (session.payment_status === 'PAID' && session.order_id) {
      await connection.rollback();
      return {
        success: true,
        alreadyPaid: true,
        orderId: session.order_id,
        orderNumber: session.order_number,
        amount: Number(session.amount),
      };
    }

    const sessionData = typeof session.session_data === 'string'
      ? JSON.parse(session.session_data)
      : session.session_data;

    // NOW CREATE THE ACTUAL ORDER IN THE DATABASE WITH STATUS PAID!
    const createdOrder = await createOrder({
      userId: session.user_id,
      address: sessionData.address,
      items: sessionData.items,
      couponCode: sessionData.couponCode,
      coinsToRedeem: sessionData.coinsToRedeem,
      paymentMethod: 'UPI',
      initialPaymentStatus: 'PAID',
    });

    const paymentId = options?.paymentRef || `GK_PAY_${Date.now()}`;

    // Update payment_session
    await connection.query(
      `UPDATE payment_sessions 
       SET payment_status = 'PAID', order_id = ?, order_number = ?
       WHERE id = ?`,
      [createdOrder.id, createdOrder.order_number, session.id]
    );

    // Insert payment record
    await connection.query(
      `INSERT INTO payments 
       (order_id, transaction_ref, gateway, gateway_order_id, gateway_payment_id, amount, currency, status, raw_response)
       VALUES (?, ?, 'GOKWIK', ?, ?, ?, 'INR', 'PAID', ?)`,
      [
        createdOrder.id,
        session.id,
        session.id,
        paymentId,
        session.amount,
        JSON.stringify(options?.raw || { confirmedAt: new Date().toISOString() }),
      ]
    );

    // Insert order history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by)
       VALUES (?, 'CONFIRMED', ?, 'GoKwik UPI Gateway')`,
      [createdOrder.id, `Payment verified via GoKwik UPI (TxID: ${paymentId})`]
    );

    await connection.commit();

    // Broadcast Real-time socket events
    if (io) {
      io.emit('gokwik.session_paid', {
        sessionId: session.id,
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        amount: Number(session.amount),
      });

      io.emit('order.payment_success', {
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        paymentId,
        paymentMethod: 'UPI',
        gateway: 'GOKWIK',
        amount: Number(session.amount),
      });

      io.emit('payment.success', {
        sessionId: session.id,
        orderId: createdOrder.id,
        orderNumber: createdOrder.order_number,
        amount: Number(session.amount),
      });
    }

    return {
      success: true,
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number,
      amount: Number(session.amount),
      paymentId,
      message: 'GoKwik UPI payment verified. Order placed successfully!',
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * 4. Cancel Session: User closed modal or aborted checkout.
 * Zero orders exist in the database!
 */
export async function cancelGokwikSession(sessionId: string, userId?: number) {
  const [result]: any = await pool.query(
    `UPDATE payment_sessions 
     SET payment_status = 'CANCELLED' 
     WHERE id = ? AND payment_status = 'PENDING' ${userId ? 'AND user_id = ?' : ''}`,
    userId ? [sessionId, userId] : [sessionId]
  );

  return {
    success: true,
    message: 'Payment session cancelled. No order was created.',
    affectedRows: result.affectedRows,
  };
}

/**
 * 5. Request VPA Collect for a Session
 */
export async function requestSessionVpaCollect(sessionId: string, vpa: string, userId: number) {
  const cleanVpa = vpa.trim().toLowerCase();
  const vpaRegex = /^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,49}$/;

  if (!vpaRegex.test(cleanVpa)) {
    throw new AppError('Invalid UPI ID / VPA. Format: yourname@bank', 400);
  }

  const [rows]: any = await pool.query(
    'SELECT id, user_id, amount, payment_status FROM payment_sessions WHERE id = ?',
    [sessionId]
  );

  if (rows.length === 0) {
    throw new AppError('Payment session not found', 404);
  }

  if (rows[0].user_id !== userId) {
    throw new AppError('Access denied', 403);
  }

  if (rows[0].payment_status === 'PAID') {
    throw new AppError('Payment session already paid', 400);
  }

  const isLive = GOKWIK_CONFIG.env === 'production' && GOKWIK_CONFIG.appId !== 'gokwik_test_vardhamrit_app';

  if (isLive) {
    // Live Outbound API Call to GoKwik Production Gateway
    try {
      const axios = require('axios');
      await axios.post(
        `${GOKWIK_CONFIG.baseUrl}/v1/upi/collect`,
        {
          session_id: sessionId,
          vpa: cleanVpa,
          amount: rows[0].amount,
          merchant_id: GOKWIK_CONFIG.merchantId,
        },
        {
          headers: {
            'app-id': GOKWIK_CONFIG.appId,
            'app-secret': GOKWIK_CONFIG.appSecret,
          },
          timeout: 10000,
        }
      );
    } catch (err: any) {
      console.warn('GoKwik Live Collect API Error:', err.response?.data || err.message);
      // Fallback message if live gateway returned rejection
      const errMsg = err.response?.data?.message || err.message;
      throw new AppError(`GoKwik Collect Request failed: ${errMsg}`, 502);
    }
  }

  return {
    success: true,
    isLive,
    message: isLive
      ? `Collect request sent to ${cleanVpa}! Please check your PhonePe/UPI app and authorize payment.`
      : `Sandbox Mode: Collect initiated for ${cleanVpa}. (NPCI does not send real bank debit pushes in Sandbox mode. Tap 'Simulate Instant UPI Success' below to complete the test).`,
  };
}

/**
 * Webhook handler
 */
export async function processGokwikWebhook(rawBody: string, signature: string) {
  if (GOKWIK_CONFIG.env === 'production' && signature) {
    const isValid = verifyGoKwikSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('Invalid GoKwik webhook signature', 400);
    }
  }

  let eventData: any = {};
  try {
    eventData = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    throw new AppError('Invalid JSON in GoKwik webhook payload', 400);
  }

  const { event, data } = eventData;
  const sessionId = data?.merchant_order_id || data?.session_id || data?.transaction_id;

  if (sessionId && (event === 'payment.captured' || event === 'order.paid' || data?.status === 'SUCCESS')) {
    return await confirmGokwikSessionPayment(sessionId, {
      paymentRef: data?.payment_id || data?.id,
      raw: eventData,
    });
  }

  return { status: 'received', event };
}
