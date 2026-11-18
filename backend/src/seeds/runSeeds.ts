import bcrypt from 'bcryptjs';
import pool from '../config/db';

async function runSeeds() {
  console.log('🌱 Starting Database Seeding...');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Seed Users (Admin & Customer)
    console.log('👤 Seeding Users...');

    const [adminResult]: any = await connection.query(
      `INSERT INTO users (name, email, phone, role)
       VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE name = VALUES(name);`,
      ['Vardhamrit Master Admin', 'admin@vardhamrit.com', '+919999900001']
    );

    const [customerResult]: any = await connection.query(
      `INSERT INTO users (name, email, phone, role, push_token)
       VALUES (?, ?, ?, 'customer', 'ExponentPushToken[mock_customer_token_123]')
       ON DUPLICATE KEY UPDATE name = VALUES(name);`,
      ['Rahul Sharma', 'customer@vardhamrit.com', '+919876543210']
    );

    const [customerRows]: any = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      ['customer@vardhamrit.com']
    );
    const customerId = customerRows[0].id;

    // 2. Seed Addresses for Customer
    console.log('📍 Seeding Addresses...');
    await connection.query(
      `DELETE FROM addresses WHERE user_id = ?`,
      [customerId]
    );

    await connection.query(
      `INSERT INTO addresses (user_id, name, phone, line1, line2, city, state, pincode, landmark, is_default)
       VALUES 
       (?, 'Rahul Sharma', '+919876543210', 'Flat 402, Nilgiri Heights', 'Phase 1, Hinjewadi', 'Pune', 'Maharashtra', '411057', 'Near Rajiv Gandhi Infotech Park', TRUE),
       (?, 'Rahul Sharma (Family Home)', '+919876543210', 'Plot 15, Bapu Nagar', 'Opposite Central Park', 'Jaipur', 'Rajasthan', '302015', 'Behind Rajasthan University', FALSE);`,
      [customerId, customerId]
    );

    // 3. Seed Products and Variants
    console.log('🍵 Seeding Tea Products & Variants...');
    const productsData = [
      {
        name: 'Vardhamrit Royal Assam CTC Chai',
        description: 'Handpicked bold granules from the lush Upper Assam tea gardens. Yields a rich amber liquor, brisk aroma, and deeply satisfying strong cup—the quintessential morning Indian breakfast chai.',
        imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
        avgRating: 4.8,
        reviewCount: 142,
        variants: [
          { label: '250g', price: 160.00, stock: 150, sku: 'AS-CTC-250' },
          { label: '500g', price: 300.00, stock: 200, sku: 'AS-CTC-500' },
          { label: '1kg', price: 580.00, stock: 100, sku: 'AS-CTC-1KG' }
        ]
      },
      {
        name: 'Vardhamrit Darjeeling First Flush Whole Leaf',
        description: 'Celebrated worldwide as the "Champagne of Teas". Grown at high altitudes in the Himalayan foothills, producing a delicate muscatel flavor with floral notes. Best enjoyed without milk.',
        imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
        avgRating: 4.9,
        reviewCount: 88,
        variants: [
          { label: '250g', price: 350.00, stock: 80, sku: 'DJ-FF-250' },
          { label: '500g', price: 650.00, stock: 50, sku: 'DJ-FF-500' },
          { label: '1kg', price: 1250.00, stock: 30, sku: 'DJ-FF-1KG' }
        ]
      },
      {
        name: 'Vardhamrit Shahi Masala Chai Blend',
        description: 'An authentic regal recipe blending strong Assam CTC with seven sun-dried and coarsely ground spices: Green Cardamom, Ceylon Cinnamon, Clove, Black Pepper, Ginger, Nutmeg, and Star Anise.',
        imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
        avgRating: 4.7,
        reviewCount: 115,
        variants: [
          { label: '250g', price: 220.00, stock: 120, sku: 'MS-BL-250' },
          { label: '500g', price: 420.00, stock: 180, sku: 'MS-BL-500' },
          { label: '1kg', price: 800.00, stock: 75, sku: 'MS-BL-1KG' }
        ]
      },
      {
        name: 'Vardhamrit Cardamom (Elaichi) Kadak Chai',
        description: 'Premium quality CTC tea perfectly complemented with freshly crushed aromatic Idukki green cardamom. Refreshing, aromatic, and invigorating throughout the day.',
        imageUrl: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
        avgRating: 4.6,
        reviewCount: 76,
        variants: [
          { label: '250g', price: 190.00, stock: 140, sku: 'EL-KD-250' },
          { label: '500g', price: 360.00, stock: 160, sku: 'EL-KD-500' },
          { label: '1kg', price: 690.00, stock: 60, sku: 'EL-KD-1KG' }
        ]
      },
      {
        name: 'Vardhamrit Kashmiri Kahwa Traditional Blend',
        description: 'Traditional green tea infused with rich saffron (kesar), cinnamon bark, crushed cardamom pods, and slivers of toasted Kashmiri almonds. A royal winter and celebration staple.',
        imageUrl: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=800&q=80',
        avgRating: 4.9,
        reviewCount: 64,
        variants: [
          { label: '250g', price: 380.00, stock: 90, sku: 'KM-KW-250' },
          { label: '500g', price: 720.00, stock: 60, sku: 'KM-KW-500' },
          { label: '1kg', price: 1380.00, stock: 25, sku: 'KM-KW-1KG' }
        ]
      },
      {
        name: 'Vardhamrit Pure Himalayan Green Tea',
        description: 'Rich in antioxidants and catechins, harvested from high mountain estates of Kangra. Provides a clean, gentle grassy sweetness and natural detox benefits with zero bitterness.',
        imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=800&q=80',
        avgRating: 4.5,
        reviewCount: 42,
        variants: [
          { label: '250g', price: 240.00, stock: 110, sku: 'HM-GT-250' },
          { label: '500g', price: 450.00, stock: 90, sku: 'HM-GT-500' },
          { label: '1kg', price: 850.00, stock: 40, sku: 'HM-GT-1KG' }
        ]
      }
    ];

    for (const prod of productsData) {
      // Check existing product
      const [existing]: any = await connection.query(
        'SELECT id FROM products WHERE name = ?',
        [prod.name]
      );

      let productId: number;
      if (existing.length > 0) {
        productId = existing[0].id;
        await connection.query(
          `UPDATE products SET description = ?, image_url = ?, avg_rating = ?, review_count = ? WHERE id = ?`,
          [prod.description, prod.imageUrl, prod.avgRating, prod.reviewCount, productId]
        );
      } else {
        const [insertRes]: any = await connection.query(
          `INSERT INTO products (name, description, image_url, avg_rating, review_count) VALUES (?, ?, ?, ?, ?)`,
          [prod.name, prod.description, prod.imageUrl, prod.avgRating, prod.reviewCount]
        );
        productId = insertRes.insertId;
      }

      // Upsert variants
      for (const variant of prod.variants) {
        await connection.query(
          `INSERT INTO product_variants (product_id, label, price, stock, sku)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE label = VALUES(label), price = VALUES(price), stock = VALUES(stock);`,
          [productId, variant.label, variant.price, variant.stock, variant.sku]
        );
      }
    }

    // 4. Seed Coupons
    console.log('🏷️ Seeding Coupons...');
    const couponsData = [
      {
        code: 'CHAI10',
        type: 'PERCENT',
        value: 10.00,
        maxDiscountCap: 100.00,
        minOrderValue: 199.00,
        usageLimitTotal: 1000,
        usageLimitPerUser: 2,
        validFrom: '2025-01-01 00:00:00',
        validTo: '2028-12-31 23:59:59',
        isActive: true,
        paymentRestriction: 'ALL'
      },
      {
        code: 'WELCOME50',
        type: 'FLAT',
        value: 50.00,
        maxDiscountCap: null,
        minOrderValue: 299.00,
        usageLimitTotal: 500,
        usageLimitPerUser: 1,
        validFrom: '2025-01-01 00:00:00',
        validTo: '2028-12-31 23:59:59',
        isActive: true,
        paymentRestriction: 'ALL'
      },
      {
        code: 'ONLINE5',
        type: 'PERCENT',
        value: 5.00,
        maxDiscountCap: 50.00,
        minOrderValue: 250.00,
        usageLimitTotal: null,
        usageLimitPerUser: 5,
        validFrom: '2025-01-01 00:00:00',
        validTo: '2028-12-31 23:59:59',
        isActive: true,
        paymentRestriction: 'ONLINE'
      },
      {
        code: 'FESTIVE15',
        type: 'PERCENT',
        value: 15.00,
        maxDiscountCap: 150.00,
        minOrderValue: 499.00,
        usageLimitTotal: 250,
        usageLimitPerUser: 1,
        validFrom: '2025-01-01 00:00:00',
        validTo: '2028-12-31 23:59:59',
        isActive: true,
        paymentRestriction: 'ALL'
      }
    ];

    for (const coupon of couponsData) {
      await connection.query(
        `INSERT INTO coupons (code, type, value, max_discount_cap, min_order_value, usage_limit_total, usage_limit_per_user, valid_from, valid_to, is_active, payment_method_restriction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           type = VALUES(type),
           value = VALUES(value),
           max_discount_cap = VALUES(max_discount_cap),
           min_order_value = VALUES(min_order_value),
           is_active = VALUES(is_active),
           payment_method_restriction = VALUES(payment_method_restriction);`,
        [
          coupon.code,
          coupon.type,
          coupon.value,
          coupon.maxDiscountCap,
          coupon.minOrderValue,
          coupon.usageLimitTotal,
          coupon.usageLimitPerUser,
          coupon.validFrom,
          coupon.validTo,
          coupon.isActive,
          coupon.paymentRestriction
        ]
      );
    }

    // 5. Seed a sample past delivered order with review for verified buyer showcase
    console.log('📦 Seeding Sample Completed Order & Review...');
    const [existingOrders]: any = await connection.query(
      `SELECT id FROM orders WHERE user_id = ? LIMIT 1`,
      [customerId]
    );

    if (existingOrders.length === 0) {
      const [firstVariant]: any = await connection.query(
        `SELECT pv.id as variant_id, pv.price, p.id as product_id, p.name as product_name, pv.label as variant_label 
         FROM product_variants pv 
         JOIN products p ON pv.product_id = p.id 
         WHERE pv.sku = 'AS-CTC-500' LIMIT 1`
      );

      if (firstVariant.length > 0) {
        const item = firstVariant[0];
        const subtotal = 300.00;
        const discountAmount = 0.00;
        const deliveryFee = 50.00;
        const taxAmount = 15.00; // 5% of 300
        const total = 365.00;

        const addressSnapshot = JSON.stringify({
          name: 'Rahul Sharma',
          phone: '+919876543210',
          line1: 'Flat 402, Nilgiri Heights',
          line2: 'Phase 1, Hinjewadi',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411057',
          landmark: 'Near Rajiv Gandhi Infotech Park'
        });

        const [orderRes]: any = await connection.query(
          `INSERT INTO orders 
           (user_id, address_snapshot, subtotal, discount_amount, delivery_fee, tax_amount, total, payment_method, payment_status, status, invoice_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ONLINE', 'PAID', 'DELIVERED', 'INV-2026-000001')`,
          [customerId, addressSnapshot, subtotal, discountAmount, deliveryFee, taxAmount, total]
        );
        const orderId = orderRes.insertId;

        await connection.query(
          `INSERT INTO order_items (order_id, variant_id, product_name, variant_label, price, quantity)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [orderId, item.variant_id, item.product_name, item.variant_label, item.price]
        );

        await connection.query(
          `INSERT INTO order_status_history (order_id, status, changed_by, note)
           VALUES 
           (?, 'PLACED', 'Customer', 'Order successfully placed via Razorpay'),
           (?, 'APPROVED', 'System', 'Order auto-approved upon verified payment'),
           (?, 'DISPATCHED', 'Admin', 'Dispatched via BlueDart (Tracking #BD77281923)'),
           (?, 'DELIVERED', 'BlueDart', 'Delivered to recipient with OTP confirmation');`,
          [orderId, orderId, orderId, orderId]
        );

        await connection.query(
          `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, signature, amount, status, method)
           VALUES (?, 'order_mock_seed_101', 'pay_mock_seed_101', 'verified_signature_mock', ?, 'PAID', 'upi')`,
          [orderId, total]
        );

        await connection.query(
          `INSERT INTO reviews (user_id, product_id, order_id, rating, title, comment, is_hidden, admin_reply)
           VALUES (?, ?, ?, 5, 'Exceptional Kadak Chai!', 'The aroma of the tea is authentic Assam. Makes the perfect morning cup with rich color and punch. Will reorder the 1kg pack soon!', FALSE, 'Thank you so much Rahul! We are delighted you enjoyed our Assam CTC harvest.')`,
          [customerId, item.product_id, orderId]
        );
      }
    }

    await connection.commit();
    console.log('✨ Seed data created successfully!');
  } catch (err) {
    await connection.rollback();
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeeds();
}

export default runSeeds;
