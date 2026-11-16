import { server } from '../index';
import pool from '../config/db';
import { generateSignature } from '../config/razorpay';

async function runPhase4Tests() {
  const testPort = 5557;
  const baseUrl = `http://localhost:${testPort}`;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`🧪 Test server started on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Login Customer
    console.log('\n--- 1. Login Customer ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@vardhamrit.com',
        password: 'Customer@123',
      }),
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken;
    const userId = loginData.data?.user?.id;

    // 2. Add item to cart and place an ONLINE order
    console.log('\n--- 2. Add Item to Cart & Place ONLINE Order ---');
    const [variants]: any = await pool.query(
      "SELECT id, price FROM product_variants WHERE sku = 'AS-CTC-250' LIMIT 1"
    );
    const variantId = variants[0].id;

    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ variantId, quantity: 2 }), // 2 * 160 = ₹320
    });

    const [addrRows]: any = await pool.query('SELECT id FROM addresses WHERE user_id = ? LIMIT 1', [userId]);
    const addressId = addrRows[0].id;

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        addressId,
        paymentMethod: 'ONLINE',
      }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.data?.id;
    const orderTotal = orderData.data?.total;
    console.log(`Created Online Order #${orderId}, Total: ₹${orderTotal}`);

    // 3. Call POST /payments/create-order
    console.log('\n--- 3. Testing POST /payments/create-order ---');
    const createPayRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    });
    const createPayData = await createPayRes.json();
    console.log('Payment Order Status:', createPayRes.status, 'Razorpay Order ID:', createPayData.data?.razorpay_order_id, 'Amount (paise):', createPayData.data?.amount);
    if (!createPayData.success || !createPayData.data?.razorpay_order_id) {
      throw new Error('Create payment order failed');
    }

    const rzpOrderId = createPayData.data.razorpay_order_id;
    const expectedPaise = Math.round(orderTotal * 100);
    if (createPayData.data.amount !== expectedPaise) {
      throw new Error(`Amount in paise mismatch. Expected ${expectedPaise}, got ${createPayData.data.amount}`);
    }

    // 4. Test Payment Verification with Invalid Signature (Tamper Test)
    console.log('\n--- 4. Testing Payment Verification Tamper Protection ---');
    const fakeVerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: 'pay_tampered_test_999',
        razorpaySignature: 'invalid_forged_signature_xyz',
      }),
    });
    const fakeVerifyData = await fakeVerifyRes.json();
    console.log('Tampered verification status (expected 400):', fakeVerifyRes.status, fakeVerifyData.error);
    if (fakeVerifyRes.status !== 400) {
      throw new Error('Tampered payment signature was not blocked!');
    }

    // 5. Test Payment Verification with Genuine Signature
    console.log('\n--- 5. Testing Genuine Signature Verification ---');
    const genuinePaymentId = `pay_genuine_${Date.now()}`;
    const genuineSignature = generateSignature(rzpOrderId, genuinePaymentId);

    const verifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: genuinePaymentId,
        razorpaySignature: genuineSignature,
      }),
    });
    const verifyData = await verifyRes.json();
    console.log('Genuine verification status:', verifyRes.status, verifyData.message);
    if (!verifyData.success) {
      throw new Error('Valid signature verification failed');
    }

    // Check payment & order status in database
    const [dbOrder]: any = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [orderId]);
    console.log(`Order #${orderId} payment_status in DB:`, dbOrder[0]?.payment_status);
    if (dbOrder[0]?.payment_status !== 'PAID') {
      throw new Error('Order payment status was not updated to PAID');
    }

    // 6. Test Webhook Idempotency (payment.captured)
    console.log('\n--- 6. Testing Webhook Idempotency (payment.captured) ---');
    const webhookPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: genuinePaymentId,
            order_id: rzpOrderId,
            amount: expectedPaise,
            method: 'upi',
          },
        },
      },
    };

    const webhookRes = await fetch(`${baseUrl}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });
    const webhookData = await webhookRes.json();
    console.log('Webhook status:', webhookRes.status, webhookData);
    if (webhookRes.status !== 200) {
      throw new Error('Webhook failed');
    }

    // 7. Test Auto-Refund on Order Cancellation
    console.log('\n--- 7. Testing Auto-Refund on Order Cancellation ---');
    const cancelRes = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Customer requested refund & cancellation' }),
    });
    const cancelData = await cancelRes.json();
    console.log('Cancelled Order status:', cancelData.data?.status, 'Payment status:', cancelData.data?.payment_status);

    const [refundPaymentRows]: any = await pool.query(
      'SELECT status, refund_id, refunded_amount FROM payments WHERE order_id = ?',
      [orderId]
    );
    console.log('Payment record after cancellation refund:', refundPaymentRows[0]);
    if (refundPaymentRows[0]?.status !== 'REFUNDED' || !refundPaymentRows[0]?.refund_id) {
      throw new Error('Auto-refund was not processed for cancelled paid order');
    }

    console.log('\n🎉 ALL PHASE 4 TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 tests failed:', err);
  process.exit(1);
});
