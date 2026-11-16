import { server } from '../index';
import pool from '../config/db';

async function runPhase3Tests() {
  const testPort = 5556;
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
    console.log('Customer logged in:', loginData.data?.user?.name);

    // 2. Add items to cart
    console.log('\n--- 2. Add Items to Cart ---');
    // Get product variant
    const [variants]: any = await pool.query(
      "SELECT id, price, stock FROM product_variants WHERE sku = 'AS-CTC-500' LIMIT 1"
    );
    const variantId = variants[0].id;
    const initialStock = variants[0].stock;
    console.log(`Variant ID ${variantId}, Initial stock: ${initialStock}, Price: ₹${variants[0].price}`);

    const addCartRes = await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        variantId,
        quantity: 2, // 2 * 300 = ₹600
      }),
    });
    const cartData = await addCartRes.json();
    console.log('Cart subtotal:', cartData.data?.subtotal);

    // 3. Test Coupon Validation: CHAI10 (10% off up to ₹100)
    console.log('\n--- 3. Testing POST /coupons/validate (CHAI10) ---');
    const couponRes = await fetch(`${baseUrl}/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'CHAI10' }),
    });
    const couponData = await couponRes.json();
    console.log('CHAI10 Validation status:', couponRes.status, 'Discount:', couponData.data?.discountAmount, 'Total:', couponData.data?.totals?.total);
    if (!couponData.success || couponData.data.discountAmount !== 60) { // 10% of 600 = 60
      throw new Error(`Expected ₹60 discount for CHAI10, got: ${couponData.data?.discountAmount}`);
    }

    // 4. Test Address retrieval
    console.log('\n--- 4. Getting Address for Order Placement ---');
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const addrData = await addrRes.json();
    const addressId = addrData.data[0].id;
    console.log('Selected address ID:', addressId, 'City:', addrData.data[0].city);

    // 5. Place Order with Coupon & Atomic Transaction
    console.log('\n--- 5. Placing Order (POST /orders) ---');
    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        addressId,
        paymentMethod: 'COD',
        couponCode: 'CHAI10',
      }),
    });
    const orderData = await orderRes.json();
    console.log('Order status:', orderRes.status, 'Order ID:', orderData.data?.id, 'Total:', orderData.data?.total);
    if (!orderData.success || !orderData.data?.id) {
      throw new Error('Order placement failed');
    }
    const orderId = orderData.data.id;

    // 6. Verify stock was decremented
    console.log('\n--- 6. Verifying Atomic Stock Decrement ---');
    const [afterStockRows]: any = await pool.query(
      'SELECT stock FROM product_variants WHERE id = ?',
      [variantId]
    );
    const newStock = afterStockRows[0].stock;
    console.log(`Old stock: ${initialStock}, New stock: ${newStock}`);
    if (newStock !== initialStock - 2) {
      throw new Error(`Stock decrement failed! Expected ${initialStock - 2}, got ${newStock}`);
    }

    // 7. Verify cart was cleared
    console.log('\n--- 7. Verifying Cart Cleared ---');
    const checkCartRes = await fetch(`${baseUrl}/cart`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkCartData = await checkCartRes.json();
    console.log('Cart items count after order:', checkCartData.data?.items?.length);
    if (checkCartData.data.items.length !== 0) {
      throw new Error('Cart was not cleared after order placement');
    }

    // 8. Verify coupon usage was recorded
    console.log('\n--- 8. Verifying Coupon Usage ---');
    const [couponUsageRows]: any = await pool.query(
      'SELECT * FROM coupon_usages WHERE order_id = ?',
      [orderId]
    );
    console.log('Coupon usage record:', couponUsageRows[0]?.discount_amount);
    if (couponUsageRows.length === 0) {
      throw new Error('Coupon usage was not recorded');
    }

    // 9. Verify order details and status history
    console.log(`\n--- 9. Testing GET /orders/${orderId} ---`);
    const singleOrderRes = await fetch(`${baseUrl}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const singleOrderData = await singleOrderRes.json();
    console.log('Order status:', singleOrderData.data?.status);
    console.log('Status history count:', singleOrderData.data?.status_history?.length);
    if (singleOrderData.data?.status_history[0].status !== 'PLACED') {
      throw new Error('Initial status history missing or incorrect');
    }

    // 10. Test Cancel Order & Restock
    console.log(`\n--- 10. Testing POST /orders/${orderId}/cancel ---`);
    const cancelRes = await fetch(`${baseUrl}/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Ordered by mistake' }),
    });
    const cancelData = await cancelRes.json();
    console.log('Cancellation status:', cancelRes.status, 'New order status:', cancelData.data?.status);
    if (!cancelData.success || cancelData.data?.status !== 'CANCELLED') {
      throw new Error('Order cancellation failed');
    }

    // 11. Verify stock was restored
    console.log('\n--- 11. Verifying Restocked Quantity ---');
    const [restockedRows]: any = await pool.query(
      'SELECT stock FROM product_variants WHERE id = ?',
      [variantId]
    );
    const restocked = restockedRows[0].stock;
    console.log(`Stock after cancellation: ${restocked} (initial was ${initialStock})`);
    if (restocked !== initialStock) {
      throw new Error(`Restocking failed! Expected ${initialStock}, got ${restocked}`);
    }

    console.log('\n🎉 ALL PHASE 3 TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 tests failed:', err);
  process.exit(1);
});
