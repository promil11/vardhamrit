import { server } from '../index';
import pool from '../config/db';

async function runPhase5Tests() {
  const testPort = 5558;
  const baseUrl = `http://localhost:${testPort}`;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`🧪 Test server started on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Logins
    console.log('\n--- 1. Login Customer & Admin ---');
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'customer@vardhamrit.com', password: 'Customer@123' }),
    });
    const custToken = (await custLoginRes.json()).data?.accessToken;

    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@vardhamrit.com', password: 'Admin@123' }),
    });
    const adminToken = (await adminLoginRes.json()).data?.accessToken;
    console.log('Customer token:', !!custToken, 'Admin token:', !!adminToken);

    // 2. Admin Dashboard Stats
    console.log('\n--- 2. Testing GET /admin/dashboard ---');
    const dashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dashData = await dashRes.json();
    console.log('Dashboard status:', dashRes.status, 'Sales:', dashData.data?.sales);
    if (!dashData.success || dashData.data.orderCounts === undefined) {
      throw new Error('Admin dashboard failed');
    }

    // 3. Customer places a fresh COD order
    console.log('\n--- 3. Customer placing new COD order ---');
    const [variants]: any = await pool.query("SELECT id, product_id FROM product_variants WHERE sku = 'KM-KW-250' LIMIT 1");
    const variantId = variants[0].id;
    const productId = variants[0].product_id;

    await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({ variantId, quantity: 1 }),
    });

    const [addrRows]: any = await pool.query('SELECT id FROM addresses WHERE user_id = 2 LIMIT 1');
    const addressId = addrRows[0].id;

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({ addressId, paymentMethod: 'COD' }),
    });
    const orderData = await orderRes.json();
    const orderId = orderData.data?.id;
    console.log(`Placed COD Order #${orderId}, Status: ${orderData.data?.status}`);

    // 4. Admin Approves Order -> Triggers PDF invoice generation & Push notification
    console.log(`\n--- 4. Admin Approving Order #${orderId} ---`);
    const approveRes = await fetch(`${baseUrl}/admin/orders/${orderId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const approveData = await approveRes.json();
    console.log('Approve status:', approveRes.status, 'Invoice Number:', approveData.data?.invoice_number);
    if (!approveData.success || !approveData.data?.invoice_number) {
      throw new Error('Order approval failed or invoice was not generated');
    }

    // 5. Customer downloads Invoice PDF
    console.log(`\n--- 5. Customer Downloading Invoice PDF (GET /orders/${orderId}/invoice) ---`);
    const invRes = await fetch(`${baseUrl}/orders/${orderId}/invoice`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const contentType = invRes.headers.get('content-type');
    const invBuffer = await invRes.arrayBuffer();
    const pdfHeader = Buffer.from(invBuffer).subarray(0, 5).toString('utf8');
    console.log('Invoice response status:', invRes.status, 'Content-Type:', contentType, 'PDF Header:', pdfHeader);
    if (invRes.status !== 200 || contentType !== 'application/pdf' || pdfHeader !== '%PDF-') {
      throw new Error('Invoice PDF streaming verification failed');
    }

    // 6. Admin Dispatches Order
    console.log(`\n--- 6. Admin Dispatching Order #${orderId} ---`);
    const dispatchRes = await fetch(`${baseUrl}/admin/orders/${orderId}/dispatch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ courierName: 'Delhivery Express', trackingNumber: 'DEL99281726' }),
    });
    const dispatchData = await dispatchRes.json();
    console.log('Dispatch status:', dispatchRes.status, 'Order status:', dispatchData.data?.status);
    if (dispatchData.data?.status !== 'DISPATCHED') {
      throw new Error('Dispatch failed');
    }

    // 7. Admin Delivers Order
    console.log(`\n--- 7. Admin Delivering Order #${orderId} ---`);
    const deliverRes = await fetch(`${baseUrl}/admin/orders/${orderId}/deliver`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deliverData = await deliverRes.json();
    console.log('Deliver status:', deliverRes.status, 'Order status:', deliverData.data?.status);
    if (deliverData.data?.status !== 'DELIVERED') {
      throw new Error('Deliver failed');
    }

    // 8. Admin Marks COD Collected
    console.log(`\n--- 8. Admin Marks COD Collected for Order #${orderId} ---`);
    const codRes = await fetch(`${baseUrl}/admin/orders/${orderId}/cod-collected`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const codData = await codRes.json();
    console.log('COD collected status:', codRes.status, 'Payment status:', codData.data?.payment_status);
    if (codData.data?.payment_status !== 'PAID') {
      throw new Error('Mark COD collected failed');
    }

    // 9. Verified Customer Reviews the Delivered Product
    console.log(`\n--- 9. Verified Customer Submitting Review for Product #${productId} ---`);
    const reviewRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({
        productId,
        orderId,
        rating: 5,
        title: 'Authentic Kashmiri Kahwa',
        comment: 'Finest saffron and almond aroma. The taste is pure perfection.',
      }),
    });
    const reviewData = await reviewRes.json();
    console.log('Review submission status:', reviewRes.status, 'Review ID:', reviewData.data?.id);
    if (!reviewData.success || !reviewData.data?.id) {
      throw new Error('Review submission failed');
    }
    const reviewId = reviewData.data.id;

    // 10. Admin Moderates Review & Adds Reply
    console.log(`\n--- 10. Admin Replying to Review #${reviewId} ---`);
    const modRes = await fetch(`${baseUrl}/admin/reviews/${reviewId}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        adminReply: 'Thank you for your review! We take pride in sourcing authentic saffron directly from Kashmir.',
      }),
    });
    const modData = await modRes.json();
    console.log('Review moderation status:', modRes.status);
    if (!modData.success) {
      throw new Error('Review moderation failed');
    }

    // 11. Admin Exports Orders to CSV
    console.log('\n--- 11. Testing GET /admin/orders/export/csv ---');
    const csvRes = await fetch(`${baseUrl}/admin/orders/export/csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const csvText = await csvRes.text();
    console.log('CSV Export status:', csvRes.status, 'First line:', csvText.split('\n')[0]);
    if (csvRes.status !== 200 || !csvText.startsWith('Order ID,Customer Name')) {
      throw new Error('CSV export failed');
    }

    // 12. Admin Fetches Customers
    console.log('\n--- 12. Testing GET /admin/customers ---');
    const custsRes = await fetch(`${baseUrl}/admin/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const custsData = await custsRes.json();
    console.log('Customers count:', custsData.data?.length, 'Top spender:', custsData.data[0]?.name, 'Total spent:', custsData.data[0]?.total_spent);
    if (!custsData.success || custsData.data.length === 0) {
      throw new Error('Fetch customers failed');
    }

    console.log('\n🎉 ALL PHASE 5 TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runPhase5Tests().catch((err) => {
  console.error('Phase 5 tests failed:', err);
  process.exit(1);
});
