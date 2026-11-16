import crypto from 'crypto';
import pool from '../config/db';
import { RAZORPAY_CONFIG, getRazorpayClient, generateSignature, verifyWebhookSignature } from '../config/razorpay';
import { AppError } from '../middleware/errorHandler';
import { io } from '../index';

export interface CreatePaymentOrderResult {
  razorpay_order_id: string;
  amount: number; // in paise
  currency: string;
  key_id: string;
  orderId: number;
}

export async function createPaymentOrder(orderId: number, userId: number): Promise<CreatePaymentOrderResult> {
  const [orders]: any = await pool.query(
    'SELECT id, user_id, total, payment_method, payment_status, status FROM orders WHERE id = ?',
    [orderId]
  );

  if (orders.length === 0) {
    throw new AppError('Order not found', 404);
  }

  const order = orders[0];

  if (order.user_id !== userId) {
    throw new AppError('Access denied: You do not own this order', 403);
  }

  if (order.payment_status === 'PAID') {
    throw new AppError('Order has already been paid', 400);
  }

  if (['CANCELLED', 'REJECTED'].includes(order.status)) {
    throw new AppError(`Cannot pay for an order in '${order.status}' state`, 400);
  }

  // Amount is calculated strictly on the server: total * 100 paise
  const amountInPaise = Math.round(Number(order.total) * 100);
  let razorpayOrderId = '';

  const client = getRazorpayClient();

  if (!RAZORPAY_CONFIG.isMockMode && client) {
    try {
      const rzpOrder = await client.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_order_${order.id}`,
        notes: { orderId: String(order.id), userId: String(userId) },
      });
      razorpayOrderId = rzpOrder.id;
    } catch (err: any) {
      console.error('Razorpay API error creating order:', err);
      throw new AppError(`Payment gateway error: ${err.message || 'Unable to create order'}`, 502);
    }
  } else {
    // Deterministic mock razorpay order id for test/dev
    razorpayOrderId = `order_mock_${order.id}_${Date.now()}`;
  }

  // Insert or update payment record
  const [existing]: any = await pool.query(
    'SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
    [order.id]
  );

  if (existing.length > 0) {
    await pool.query(
      `UPDATE payments 
       SET razorpay_order_id = ?, amount = ?, status = 'CREATED'
       WHERE id = ?`,
      [razorpayOrderId, order.total, existing[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO payments (order_id, razorpay_order_id, amount, status)
       VALUES (?, ?, ?, 'CREATED')`,
      [order.id, razorpayOrderId, order.total]
    );
  }

  return {
    razorpay_order_id: razorpayOrderId,
    amount: amountInPaise,
    currency: 'INR',
    key_id: RAZORPAY_CONFIG.keyId,
    orderId: order.id,
  };
}

export async function verifyPayment(
  orderId: number,
  userId: number,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
) {
  // 1. Signature Verification
  let isValid = false;

  if (RAZORPAY_CONFIG.isMockMode) {
    // In mock mode, support generated HMAC signature or mock tokens
    const expectedSig = generateSignature(razorpayOrderId, razorpayPaymentId);
    isValid = razorpaySignature === expectedSig || razorpaySignature.startsWith('mock_sig_');
  } else {
    const expectedSig = generateSignature(razorpayOrderId, razorpayPaymentId);
    isValid = crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(razorpaySignature));
  }

  if (!isValid) {
    throw new AppError('Payment signature verification failed. Possible tampering.', 400);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [orders]: any = await connection.query(
      'SELECT id, user_id, payment_status, status FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );

    if (orders.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = orders[0];
    if (order.user_id !== userId) {
      throw new AppError('Unauthorized order access', 403);
    }

    // Idempotent: if already paid, return success
    if (order.payment_status === 'PAID') {
      await connection.rollback();
      return { success: true, message: 'Payment already recorded as PAID' };
    }

    // Update payment record
    await connection.query(
      `UPDATE payments 
       SET razorpay_payment_id = ?, signature = ?, status = 'PAID', method = 'online'
       WHERE order_id = ? AND razorpay_order_id = ?`,
      [razorpayPaymentId, razorpaySignature, orderId, razorpayOrderId]
    );

    // Update order status
    await connection.query(
      `UPDATE orders SET payment_status = 'PAID' WHERE id = ?`,
      [orderId]
    );

    // Log history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES (?, ?, 'System', ?)`,
      [orderId, order.status, `Online payment verified via Razorpay ID: ${razorpayPaymentId}`]
    );

    await connection.commit();

    if (io) {
      io.emit('order.payment_success', {
        orderId,
        paymentId: razorpayPaymentId,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      success: true,
      message: 'Payment verified and captured successfully',
      paymentId: razorpayPaymentId,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function processWebhook(rawBody: Buffer | string, signature: string) {
  // If not mock mode and signature present, verify webhook signature
  if (!RAZORPAY_CONFIG.isMockMode && signature) {
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  const event = payload.event;
  console.log(`📩 Processing Razorpay Webhook Event: ${event}`);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (event === 'payment.captured') {
      const paymentEntity = payload.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const method = paymentEntity.method;

      // Find payment record by razorpay_order_id
      const [payments]: any = await connection.query(
        'SELECT id, order_id, status FROM payments WHERE razorpay_order_id = ? FOR UPDATE',
        [razorpayOrderId]
      );

      if (payments.length > 0) {
        const payment = payments[0];
        // Idempotency: skip if already PAID
        if (payment.status !== 'PAID') {
          await connection.query(
            `UPDATE payments 
             SET razorpay_payment_id = ?, status = 'PAID', method = ?
             WHERE id = ?`,
            [razorpayPaymentId, method || 'online', payment.id]
          );

          await connection.query(
            `UPDATE orders SET payment_status = 'PAID' WHERE id = ?`,
            [payment.order_id]
          );

          await connection.query(
            `INSERT INTO order_status_history (order_id, status, changed_by, notes)
             SELECT id, status, 'Webhook', ? FROM orders WHERE id = ?`,
            [`Payment confirmed via webhook (${razorpayPaymentId})`, payment.order_id]
          );
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payload.payment.entity;
      const razorpayOrderId = paymentEntity.order_id;
      const razorpayPaymentId = paymentEntity.id;
      const failureReason = paymentEntity.error_description || 'Payment failed';

      const [payments]: any = await connection.query(
        'SELECT id, order_id, status FROM payments WHERE razorpay_order_id = ? FOR UPDATE',
        [razorpayOrderId]
      );

      if (payments.length > 0 && payments[0].status !== 'PAID') {
        await connection.query(
          `UPDATE payments 
           SET razorpay_payment_id = ?, status = 'FAILED', failure_reason = ?
           WHERE id = ?`,
          [razorpayPaymentId, failureReason, payments[0].id]
        );

        await connection.query(
          `UPDATE orders SET payment_status = 'FAILED' WHERE id = ?`,
          [payments[0].order_id]
        );

        await connection.query(
          `INSERT INTO order_status_history (order_id, status, changed_by, notes)
           SELECT id, status, 'Webhook', ? FROM orders WHERE id = ?`,
          [`Payment failed: ${failureReason}`, payments[0].order_id]
        );
      }
    }

    await connection.commit();
    return { status: 'processed', event };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function processRefund(orderId: number, reason: string): Promise<any> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [payments]: any = await connection.query(
      `SELECT * FROM payments WHERE order_id = ? AND status = 'PAID' FOR UPDATE`,
      [orderId]
    );

    if (payments.length === 0) {
      await connection.rollback();
      return { skipped: true, message: 'No paid online payment found to refund.' };
    }

    const payment = payments[0];
    const amountInPaise = Math.round(Number(payment.amount) * 100);
    let refundId = '';

    const client = getRazorpayClient();

    if (!RAZORPAY_CONFIG.isMockMode && client && payment.razorpay_payment_id) {
      try {
        const refundRes = await client.payments.refund(payment.razorpay_payment_id, {
          amount: amountInPaise,
          notes: { reason, orderId: String(orderId) },
        });
        refundId = refundRes.id;
      } catch (err: any) {
        console.error('Razorpay refund API call failed:', err);
        throw new AppError(`Refund processing failed: ${err.message || 'Razorpay error'}`, 502);
      }
    } else {
      refundId = `rfnd_mock_${Date.now()}`;
    }

    // Update payment record
    await connection.query(
      `UPDATE payments 
       SET status = 'REFUNDED', refund_id = ?, refunded_amount = ?
       WHERE id = ?`,
      [refundId, payment.amount, payment.id]
    );

    // Update order payment status
    await connection.query(
      `UPDATE orders SET payment_status = 'REFUNDED' WHERE id = ?`,
      [orderId]
    );

    // Log in order status history
    await connection.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       SELECT id, status, 'System', ? FROM orders WHERE id = ?`,
      [`Refund initiated: ₹${payment.amount} (Refund ID: ${refundId}). Reason: ${reason}`, orderId]
    );

    await connection.commit();

    return {
      success: true,
      refundId,
      refundedAmount: payment.amount,
      message: `Refund of ₹${payment.amount} processed successfully`,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
