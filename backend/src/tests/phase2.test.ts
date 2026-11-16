import { app, server } from '../index';
import http from 'http';

async function runTest() {
  const testPort = 5555;
  const baseUrl = `http://localhost:${testPort}`;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`🧪 Test server started on ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Test Health
    console.log('\n--- 1. Testing GET /health ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Status:', healthRes.status, healthData);
    if (!healthData.success || healthData.data.database !== 'connected') {
      throw new Error('Health check failed');
    }

    // 2. Test Customer Login
    console.log('\n--- 2. Testing Customer Login ---');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'customer@vardhamrit.com',
        password: 'Customer@123',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login status:', loginRes.status, 'User:', loginData.data?.user?.email);
    if (!loginData.success || !loginData.data.accessToken) {
      throw new Error('Login failed');
    }
    const customerToken = loginData.data.accessToken;
    const refreshToken = loginData.data.refreshToken;

    // 3. Test GET /auth/me
    console.log('\n--- 3. Testing GET /auth/me ---');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const meData = await meRes.json();
    console.log('Me status:', meRes.status, 'Name:', meData.data?.name);
    if (!meData.success || meData.data.role !== 'customer') {
      throw new Error('Get profile failed');
    }

    // 4. Test Token Refresh
    console.log('\n--- 4. Testing POST /auth/refresh ---');
    const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshData = await refreshRes.json();
    console.log('Refresh status:', refreshRes.status, 'New Token received:', !!refreshData.data?.accessToken);
    if (!refreshData.success) {
      throw new Error('Token refresh failed');
    }

    // 5. Test GET /products
    console.log('\n--- 5. Testing GET /products ---');
    const prodRes = await fetch(`${baseUrl}/products?sort=rating`);
    const prodData = await prodRes.json();
    console.log('Products fetched count:', prodData.data?.items?.length, 'Total:', prodData.data?.pagination?.total);
    if (!prodData.success || prodData.data.items.length === 0) {
      throw new Error('Fetch products failed');
    }
    const sampleProduct = prodData.data.items[0];
    console.log('Sample product:', sampleProduct.name, 'Variants count:', sampleProduct.variants?.length);
    const sampleVariant = sampleProduct.variants[0];

    // 6. Test GET /products/:id
    console.log(`\n--- 6. Testing GET /products/${sampleProduct.id} ---`);
    const detailRes = await fetch(`${baseUrl}/products/${sampleProduct.id}`);
    const detailData = await detailRes.json();
    console.log('Product detail status:', detailRes.status, 'Rating breakdown:', detailData.data?.rating_breakdown);
    if (!detailData.success) {
      throw new Error('Product detail failed');
    }

    // 7. Test Cart: Add to cart
    console.log('\n--- 7. Testing POST /cart (Add to Cart) ---');
    const addCartRes = await fetch(`${baseUrl}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        variantId: sampleVariant.id,
        quantity: 2,
      }),
    });
    const addCartData = await addCartRes.json();
    console.log('Add to cart status:', addCartRes.status, 'Cart subtotal:', addCartData.data?.subtotal, 'Items count:', addCartData.data?.items?.length);
    if (!addCartData.success || addCartData.data.items.length === 0) {
      throw new Error('Add to cart failed');
    }
    const cartItem = addCartData.data.items[0];

    // 8. Test Cart: Update quantity
    console.log(`\n--- 8. Testing PATCH /cart/${cartItem.id} ---`);
    const updateCartRes = await fetch(`${baseUrl}/cart/${cartItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({ quantity: 3 }),
    });
    const updateCartData = await updateCartRes.json();
    console.log('Cart updated quantity:', updateCartData.data?.items[0]?.quantity, 'New subtotal:', updateCartData.data?.subtotal);
    if (!updateCartData.success || updateCartData.data.items[0].quantity !== 3) {
      throw new Error('Update cart failed');
    }

    // 9. Test Cart: Remove item
    console.log(`\n--- 9. Testing DELETE /cart/${cartItem.id} ---`);
    const delCartRes = await fetch(`${baseUrl}/cart/${cartItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const delCartData = await delCartRes.json();
    console.log('Delete cart item status:', delCartRes.status, 'Remaining items:', delCartData.data?.items?.length);
    if (!delCartData.success) {
      throw new Error('Delete cart item failed');
    }

    // 10. Test Addresses: GET /addresses
    console.log('\n--- 10. Testing GET /addresses ---');
    const addrRes = await fetch(`${baseUrl}/addresses`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const addrData = await addrRes.json();
    console.log('Addresses count:', addrData.data?.length);
    if (!addrData.success || addrData.data.length === 0) {
      throw new Error('Get addresses failed');
    }

    // 11. Test Addresses: POST /addresses
    console.log('\n--- 11. Testing POST /addresses ---');
    const newAddrRes = await fetch(`${baseUrl}/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        name: 'Rahul Office Delivery',
        phone: '+919876543210',
        line1: 'Tower B, Cyber City',
        line2: '6th Floor, Suite 601',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122002',
        landmark: 'Near Metro Station',
        isDefault: false,
      }),
    });
    const newAddrData = await newAddrRes.json();
    console.log('New address created status:', newAddrRes.status, 'ID:', newAddrData.data?.id);
    if (!newAddrData.success || !newAddrData.data.id) {
      throw new Error('Create address failed');
    }
    const createdAddrId = newAddrData.data.id;

    // 12. Test Addresses: PATCH /addresses/:id/default
    console.log(`\n--- 12. Testing PATCH /addresses/${createdAddrId}/default ---`);
    const defAddrRes = await fetch(`${baseUrl}/addresses/${createdAddrId}/default`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const defAddrData = await defAddrRes.json();
    console.log('Default address updated, is_default:', defAddrData.data?.is_default);
    if (!defAddrData.success || !defAddrData.data.is_default) {
      throw new Error('Set default address failed');
    }

    // 13. Test Addresses: DELETE /addresses/:id
    console.log(`\n--- 13. Testing DELETE /addresses/${createdAddrId} ---`);
    const delAddrRes = await fetch(`${baseUrl}/addresses/${createdAddrId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const delAddrData = await delAddrRes.json();
    console.log('Address deleted status:', delAddrRes.status);
    if (!delAddrData.success) {
      throw new Error('Delete address failed');
    }

    console.log('\n🎉 ALL PHASE 2 TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
