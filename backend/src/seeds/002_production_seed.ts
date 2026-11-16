import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function seedDatabase() {
  console.log('🌱 Starting Vardhamrit 100% Data Migration & Seeding (4 Chai Flavours)...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'vardhamrit',
    multipleStatements: true,
  });

  try {
    await connection.beginTransaction();

    // 0. CLEAN UP LEGACY RECORDS FOR STRICT 4-FLAVOUR INTEGRITY
    console.log('🧹 0. Cleaning up foreign key references for 4 flavours...');
    await connection.query(`UPDATE order_items SET product_id = 1 WHERE product_id > 12;`);
    await connection.query(`DELETE FROM cart_items;`);
    await connection.query(`DELETE FROM wishlists;`);
    await connection.query(`DELETE FROM reviews;`);
    await connection.query(`DELETE FROM promotions;`);
    await connection.query(`DELETE FROM product_badges;`);
    await connection.query(`DELETE FROM product_images;`);
    await connection.query(`DELETE FROM product_variants;`);
    await connection.query(`DELETE FROM products WHERE id > 12;`);

    await connection.query(`DELETE FROM category_hero_metadata WHERE category_id > 5;`);
    await connection.query(`DELETE FROM categories WHERE id > 5;`);
    await connection.query(`DELETE FROM banners;`);

    // Reset slugs to temporary values to prevent unique slug collisions during migration
    await connection.query(`UPDATE categories SET slug = CONCAT('tmp_cat_', id);`);
    await connection.query(`UPDATE products SET slug = CONCAT('tmp_prod_', id);`);

    // 1. SEED USERS
    console.log('👤 1. Seeding Users (Admin & Customer Connoisseurs)...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const customerPasswordHash = await bcrypt.hash('Customer@123', 10);

    await connection.query(`
      INSERT INTO users (id, name, email, phone, password_hash, role, status, push_token, coins_balance, tier, preferred_blend, preferred_milk_ratio, referral_code)
      VALUES 
      (1, 'Vardhamrit Master Admin', 'admin@vardhamrit.com', '+919999900001', '${adminPasswordHash}', 'admin', 'active', NULL, 1000, 'PLATINUM', 'Upper Assam Kadak', '50% Creamy Milk', 'VARDHADMIN'),
      (2, 'Rahul Sharma', 'customer@vardhamrit.com', '+919876543210', '${customerPasswordHash}', 'customer', 'active', 'ExponentPushToken[mock_customer_token_123]', 450, 'GOLD', 'Upper Assam Kadak', '50% Creamy Milk', 'VARDH100'),
      (3, 'Aarav Sharma', 'aarav.tea@vardhamrit.com', '+919988776655', '${customerPasswordHash}', 'customer', 'active', NULL, 200, 'GOLD', 'Grand Masala', 'Light Milk Splash', 'AARAV2026')
      ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), coins_balance=VALUES(coins_balance), tier=VALUES(tier);
    `);

    // 2. SEED ADDRESSES
    console.log('📍 2. Seeding Delivery Addresses...');
    await connection.query(`
      INSERT INTO addresses (id, user_id, name, phone, tag, line1, line2, city, state, pincode, landmark, is_default)
      VALUES
      (1, 2, 'Rahul Sharma', '+919876543210', 'HOME', 'Flat 402, Green Glen Orchid', 'Phase 1, Hinjewadi IT Park', 'Pune', 'Maharashtra', '411057', 'Near IT Park Gate 2', TRUE),
      (2, 2, 'Rahul Sharma (Office)', '+919876543210', 'WORK', 'Tower B, Tech Innovation Hub', 'Embassy TechZone', 'Pune', 'Maharashtra', '411057', 'Opposite Food Court', FALSE)
      ON DUPLICATE KEY UPDATE name=VALUES(name), line1=VALUES(line1), is_default=VALUES(is_default);
    `);

    // 3. SEED CATEGORIES (Strictly 4 Flavours + 'All Teas')
    console.log('☕ 3. Seeding Categories (Normal, Masala, Keser, Chocolate)...');
    const categoriesData = [
      { id: 1, slug: 'all', name: 'All Teas', tagline: 'Curated 4 Signature Blends', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80', icon_name: 'sparkles', icon_color: '#0F5132', gradient_start: '#DCFCE7', gradient_end: '#BBF7D0', border_color: '#86EFAC', shadow_color: '#16A34A', badge_text: 'ALL 4', badge_bg: '#0F5132', sort_order: 1 },
      { id: 2, slug: 'normal', name: 'Normal Chai', tagline: 'Classic Upper Assam Kadak Brew', image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80', icon_name: 'coffee', icon_color: '#0F5132', gradient_start: '#DCFCE7', gradient_end: '#BBF7D0', border_color: '#86EFAC', shadow_color: '#16A34A', badge_text: 'CLASSIC', badge_bg: '#16A34A', sort_order: 2 },
      { id: 3, slug: 'masala', name: 'Masala Chai', tagline: 'Royal 7-Spice Blend with Cloves & Cinnamon', image_url: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=500&q=80', icon_name: 'sparkles', icon_color: '#0F5132', gradient_start: '#DCFCE7', gradient_end: '#BBF7D0', border_color: '#86EFAC', shadow_color: '#16A34A', badge_text: 'SPICED', badge_bg: '#15803D', sort_order: 3 },
      { id: 4, slug: 'keser', name: 'Keser Chai', tagline: 'Kashmiri Mogra Saffron & Roasted Almonds', image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&q=80', icon_name: 'crown', icon_color: '#0F5132', gradient_start: '#DCFCE7', gradient_end: '#BBF7D0', border_color: '#86EFAC', shadow_color: '#16A34A', badge_text: 'ROYAL', badge_bg: '#B45309', sort_order: 4 },
      { id: 5, slug: 'chocolate', name: 'Chocolate Chai', tagline: 'Velvety Dark Cocoa Nibs & Assam Granules', image_url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=500&q=80', icon_name: 'coffee', icon_color: '#0F5132', gradient_start: '#DCFCE7', gradient_end: '#BBF7D0', border_color: '#86EFAC', shadow_color: '#16A34A', badge_text: 'GOURMET', badge_bg: '#78350F', sort_order: 5 },
    ];

    for (const cat of categoriesData) {
      await connection.query(`
        INSERT INTO categories (id, slug, name, tagline, image_url, icon_name, icon_color, gradient_start, gradient_end, border_color, shadow_color, badge_text, badge_bg, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          slug=VALUES(slug), 
          name=VALUES(name), 
          tagline=VALUES(tagline), 
          image_url=VALUES(image_url),
          icon_name=VALUES(icon_name),
          icon_color=VALUES(icon_color),
          gradient_start=VALUES(gradient_start),
          gradient_end=VALUES(gradient_end),
          border_color=VALUES(border_color),
          shadow_color=VALUES(shadow_color),
          badge_text=VALUES(badge_text),
          badge_bg=VALUES(badge_bg),
          sort_order=VALUES(sort_order);
      `, [cat.id, cat.slug, cat.name, cat.tagline, cat.image_url, cat.icon_name, cat.icon_color, cat.gradient_start, cat.gradient_end, cat.border_color, cat.shadow_color, cat.badge_text, cat.badge_bg, cat.sort_order]);
    }

    // 4. SEED CATEGORY HERO METADATA (Tailored to each of the 4 flavours)
    console.log('✨ 4. Seeding Category Hero Tasting Notes...');
    const heroesData = [
      {
        category_id: 1,
        hero_title: 'Complete 4-Flavour Reserve',
        hero_subtitle: 'Discover our pure Normal, Masala, Keser and Chocolate signature chai blends',
        origin: 'Assam & Kashmir Valley',
        notes: JSON.stringify(['☕ 4 Pure Flavours', '🌱 100% Direct Estate', '✨ Zero Artificial Essence']),
        badge: 'ALL 4 BLENDS',
      },
      {
        category_id: 2,
        hero_title: 'Classic Normal Kadak Chai',
        hero_subtitle: 'Single-estate bold Assam CTC tea granules with rich malty body & authentic daily tea room strength',
        origin: 'Dibrugarh & Jorhat Gardens, Upper Assam',
        notes: JSON.stringify(['🔥 High Morning Kick', '🥛 Ideal with Creamy Milk', '🍯 Malty Sweetness']),
        badge: 'CLASSIC CTC',
      },
      {
        category_id: 3,
        hero_title: 'Grand Royal Masala Chai',
        hero_subtitle: 'Aromatic blend of crushed cinnamon, cloves, green cardamom, black pepper & dry ginger',
        origin: 'Malabar Coast & Nilgiris',
        notes: JSON.stringify(['🌶️ 7 Royal Spices', '🛡️ Ayurvedic Immunity', '☕ Warm Spiced Sip']),
        badge: 'ROYAL SPICES',
      },
      {
        category_id: 4,
        hero_title: 'Regal Kashmiri Keser Chai',
        hero_subtitle: 'Grade-A Kashmiri Mogra saffron stigmas with green cardamom pods & crunchy roasted almond slivers',
        origin: 'Pampore, Kashmir Valley',
        notes: JSON.stringify(['👑 Mogra Royal Stigmas', '🍯 Golden Liquid Color', '✨ Aristocratic Sip']),
        badge: 'KASHMIRI KESER',
      },
      {
        category_id: 5,
        hero_title: 'Artisan Chocolate Chai',
        hero_subtitle: 'Real roasted cocoa nibs & Dutch dark chocolate blended with bold black tea for a dessert cup',
        origin: 'Single-Estate Cocoa & Assam CTC',
        notes: JSON.stringify(['🍫 Real Cocoa Nibs', '🥛 Velvety Body', '☕ Warm Dessert Sip']),
        badge: 'CHOCOLATE CHAI',
      },
    ];

    for (const h of heroesData) {
      await connection.query(`
        INSERT INTO category_hero_metadata (category_id, hero_title, hero_subtitle, origin, notes, badge)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          hero_title=VALUES(hero_title), 
          hero_subtitle=VALUES(hero_subtitle), 
          origin=VALUES(origin), 
          notes=VALUES(notes), 
          badge=VALUES(badge);
      `, [h.category_id, h.hero_title, h.hero_subtitle, h.origin, h.notes, h.badge]);
    }

    // 5. SEED PRODUCTS (Strictly 4 Flavours: Normal, Masala, Keser, Chocolate with Distinct Images)
    console.log('🍃 5. Seeding the 4 Distinct Flavour Products (3 blends per flavour)...');
    const productsData = [
      // 1. NORMAL CHAI (Category 2)
      {
        id: 1,
        category_id: 2,
        name: 'Vardhamrit Normal Chai (Classic Kadak)',
        slug: 'vardhamrit-normal-kadak-chai',
        tagline: 'Classic Upper Assam Kadak Brew',
        description: 'Single-estate bold Assam CTC tea granules with rich malty body & authentic daily tea room strength. Handpicked high-grown bold tea granules from pristine Upper Assam gardens that brew a deep amber, robust cup with creamy milk consistency.',
        rating: 4.85,
        review_count: 342,
        is_bestseller: true,
        is_fresh_harvest: true,
        is_featured: true,
        discount_percentage: 20,
        sort_order: 1,
        badges: ['Daily Kadak', 'Single Estate', 'Rich Malty'],
        images: [
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
          'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-NR-250', label: '250 g', weight_grams: 250, price: 149.00, mrp: 185.00, stock_quantity: 50, sort_order: 1 },
          { sku: 'VRD-NR-500', label: '500 g', weight_grams: 500, price: 279.00, mrp: 350.00, stock_quantity: 45, sort_order: 2 },
          { sku: 'VRD-NR-1KG', label: '1 kg Saver', weight_grams: 1000, price: 519.00, mrp: 650.00, stock_quantity: 30, sort_order: 3 },
        ],
      },
      {
        id: 5,
        category_id: 2,
        name: 'Vardhamrit Daily Morning Kadak CTC',
        slug: 'vardhamrit-daily-morning-kadak-ctc',
        tagline: 'Extra-Punchy Daily Breakfast CTC',
        description: 'High-density dark granular CTC plucking engineered specifically for strong morning milk chai. Delivers an unmatched caffeine kick with rich golden amber liquor.',
        rating: 4.80,
        review_count: 215,
        is_bestseller: false,
        is_fresh_harvest: true,
        is_featured: false,
        discount_percentage: 15,
        sort_order: 2,
        badges: ['Morning Kick', 'Strong Kadak', 'Pure CTC'],
        images: [
          'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-DM-250', label: '250 g', weight_grams: 250, price: 139.00, mrp: 175.00, stock_quantity: 60, sort_order: 1 },
          { sku: 'VRD-DM-500', label: '500 g', weight_grams: 500, price: 259.00, mrp: 330.00, stock_quantity: 40, sort_order: 2 },
          { sku: 'VRD-DM-1KG', label: '1 kg Saver', weight_grams: 1000, price: 489.00, mrp: 620.00, stock_quantity: 25, sort_order: 3 },
        ],
      },
      {
        id: 6,
        category_id: 2,
        name: 'Vardhamrit Upper Assam Gold Leaf CTC',
        slug: 'vardhamrit-upper-assam-gold-leaf-ctc',
        tagline: 'Estate Orthodox Leaves & Bold CTC Granules',
        description: 'A connoisseur blend pairing golden-tipped whole orthodox leaves with brisk CTC granules for an extraordinary fragrance and full-bodied taste.',
        rating: 4.90,
        review_count: 178,
        is_bestseller: true,
        is_fresh_harvest: false,
        is_featured: true,
        discount_percentage: 25,
        sort_order: 3,
        badges: ['Gold Tipped', 'Reserve Blend', 'Amber Cup'],
        images: [
          'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=800&q=80',
          'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-GL-250', label: '250 g', weight_grams: 250, price: 169.00, mrp: 225.00, stock_quantity: 45, sort_order: 1 },
          { sku: 'VRD-GL-500', label: '500 g', weight_grams: 500, price: 319.00, mrp: 425.00, stock_quantity: 35, sort_order: 2 },
        ],
      },

      // 2. MASALA CHAI (Category 3)
      {
        id: 2,
        category_id: 3,
        name: 'Vardhamrit Grand Masala Chai',
        slug: 'vardhamrit-grand-masala-chai',
        tagline: 'Royal 7-Spice Blend with Cloves & Cinnamon',
        description: 'Aromatic blend of crushed cinnamon, cloves, green cardamom, black pepper & dry ginger. Centuries-old royal Ayurvedic recipe incorporating whole hand-pounded spices with bold estate CTC granules for an invigorating, comforting cup.',
        rating: 4.90,
        review_count: 289,
        is_bestseller: true,
        is_fresh_harvest: true,
        is_featured: true,
        discount_percentage: 15,
        sort_order: 4,
        badges: ['7 Fresh Spices', 'Ayurvedic Blend', 'Immunity Boost'],
        images: [
          'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
          'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-MS-250', label: '250 g', weight_grams: 250, price: 199.00, mrp: 265.00, stock_quantity: 60, sort_order: 1 },
          { sku: 'VRD-MS-500', label: '500 g', weight_grams: 500, price: 379.00, mrp: 510.00, stock_quantity: 25, sort_order: 2 },
        ],
      },
      {
        id: 7,
        category_id: 3,
        name: 'Vardhamrit Hand-Pounded Kadha Masala Chai',
        slug: 'vardhamrit-hand-pounded-kadha-masala-chai',
        tagline: '12-Spice Winter Immunity Kadha Blend',
        description: 'Stone-ground Sonth dry ginger, Ceylon cinnamon, star anise, nutmeg, and black pepper combined with brisk Assam CTC for soothing throat warmth.',
        rating: 4.85,
        review_count: 142,
        is_bestseller: false,
        is_fresh_harvest: true,
        is_featured: false,
        discount_percentage: 20,
        sort_order: 5,
        badges: ['Hand Pounded', '12 Spices', 'Winter Shield'],
        images: [
          'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&q=80',
          'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-KD-250', label: '250 g', weight_grams: 250, price: 219.00, mrp: 285.00, stock_quantity: 40, sort_order: 1 },
          { sku: 'VRD-KD-500', label: '500 g', weight_grams: 500, price: 419.00, mrp: 550.00, stock_quantity: 20, sort_order: 2 },
        ],
      },
      {
        id: 8,
        category_id: 3,
        name: 'Vardhamrit Malabar Spiced CTC Chai',
        slug: 'vardhamrit-malabar-spiced-ctc-chai',
        tagline: 'Green Cardamom & Tellicherry Peppercorns',
        description: 'Fresh green cardamom pods from Idukki hills with crushed Tellicherry black pepper and rich Upper Assam CTC tea for brisk, lively spice notes.',
        rating: 4.75,
        review_count: 98,
        is_bestseller: false,
        is_fresh_harvest: false,
        is_featured: false,
        discount_percentage: 18,
        sort_order: 6,
        badges: ['Idukki Cardamom', 'Malabar Pepper', 'Brisk Sip'],
        images: [
          'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&q=80',
          'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-MB-250', label: '250 g', weight_grams: 250, price: 189.00, mrp: 240.00, stock_quantity: 50, sort_order: 1 },
          { sku: 'VRD-MB-500', label: '500 g', weight_grams: 500, price: 359.00, mrp: 460.00, stock_quantity: 30, sort_order: 2 },
        ],
      },

      // 3. KESER CHAI (Category 4)
      {
        id: 3,
        category_id: 4,
        name: 'Vardhamrit Royal Keser Saffron Chai',
        slug: 'vardhamrit-royal-keser-saffron-chai',
        tagline: 'Kashmiri Mogra Saffron & Roasted Almonds',
        description: 'Grade-A whole saffron stigmas with green cardamom pods & crunchy roasted almond slivers. Luxurious blend of pure Kashmiri red saffron (Keser) with Upper Assam CTC, infusing a regal amber-golden hue and opulent aroma.',
        rating: 4.95,
        review_count: 188,
        is_bestseller: true,
        is_fresh_harvest: false,
        is_featured: true,
        discount_percentage: 20,
        sort_order: 7,
        badges: ['Grade A Saffron', 'Royal Gold', 'Almond Crunch'],
        images: [
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
          'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-KS-250', label: '250 g Tin', weight_grams: 250, price: 349.00, mrp: 440.00, stock_quantity: 25, sort_order: 1 },
          { sku: 'VRD-KS-500', label: '500 g Gift Box', weight_grams: 500, price: 649.00, mrp: 820.00, stock_quantity: 20, sort_order: 2 },
        ],
      },
      {
        id: 9,
        category_id: 4,
        name: 'Vardhamrit Kashmiri Mogra Gold Keser Chai',
        slug: 'vardhamrit-kashmiri-mogra-gold-keser-chai',
        tagline: 'Pampore Mogra Saffron Pistils & CTC',
        description: 'Selected high-potency red saffron stigmas sourced directly from Pampore valley infused into brisk golden CTC granules for an opulent amber cup.',
        rating: 4.90,
        review_count: 110,
        is_bestseller: true,
        is_fresh_harvest: true,
        is_featured: true,
        discount_percentage: 15,
        sort_order: 8,
        badges: ['Pampore Saffron', 'Deep Amber', 'Aristocratic'],
        images: [
          'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80',
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-MG-250', label: '250 g', weight_grams: 250, price: 379.00, mrp: 480.00, stock_quantity: 30, sort_order: 1 },
          { sku: 'VRD-MG-500', label: '500 g', weight_grams: 500, price: 699.00, mrp: 890.00, stock_quantity: 15, sort_order: 2 },
        ],
      },
      {
        id: 10,
        category_id: 4,
        name: 'Vardhamrit Imperial Keser Pista Chai',
        slug: 'vardhamrit-imperial-keser-pista-chai',
        tagline: 'Crushed Pistachio Nut Slivers & Keser Threads',
        description: 'Royal festive recipe combining saffron threads, green cardamom, and crunchy roasted Iranian pistachios with malted CTC tea.',
        rating: 4.92,
        review_count: 76,
        is_bestseller: false,
        is_fresh_harvest: false,
        is_featured: false,
        discount_percentage: 20,
        sort_order: 9,
        badges: ['Keser & Pista', 'Festive Reserve', 'Nutty Aroma'],
        images: [
          'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80',
          'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-KP-250', label: '250 g', weight_grams: 250, price: 399.00, mrp: 510.00, stock_quantity: 25, sort_order: 1 },
          { sku: 'VRD-KP-500', label: '500 g', weight_grams: 500, price: 749.00, mrp: 960.00, stock_quantity: 15, sort_order: 2 },
        ],
      },

      // 4. CHOCOLATE CHAI (Category 5)
      {
        id: 4,
        category_id: 5,
        name: 'Vardhamrit Artisan Chocolate Chai',
        slug: 'vardhamrit-artisan-chocolate-chai',
        tagline: 'Velvety Dark Cocoa Nibs & Assam Granules',
        description: 'Real roasted cocoa nibs & Dutch dark chocolate blended with bold black tea for a dessert cup. Single-origin roasted cocoa nibs combined with robust Assam tea and sweet spice notes for a creamy, decadent hot chocolate chai experience.',
        rating: 4.80,
        review_count: 124,
        is_bestseller: false,
        is_fresh_harvest: false,
        is_featured: true,
        discount_percentage: 15,
        sort_order: 10,
        badges: ['Real Cocoa Nibs', 'Dessert Chai', 'Velvety Body'],
        images: [
          'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
          'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-CH-250', label: '250 g Pouch', weight_grams: 250, price: 219.00, mrp: 260.00, stock_quantity: 35, sort_order: 1 },
          { sku: 'VRD-CH-500', label: '500 g Pouch', weight_grams: 500, price: 419.00, mrp: 499.00, stock_quantity: 20, sort_order: 2 },
        ],
      },
      {
        id: 11,
        category_id: 5,
        name: 'Vardhamrit Dutch Dark Cacao CTC Chai',
        slug: 'vardhamrit-dutch-dark-cacao-ctc-chai',
        tagline: '70% Dark Dutch Cacao Powder & Assam Malts',
        description: 'Indulgent deep cocoa blend crafted with premium Dutch alkalized cocoa and strong malted CTC tea. Perfectly balances chocolate sweetness with kadak tea punch.',
        rating: 4.85,
        review_count: 92,
        is_bestseller: true,
        is_fresh_harvest: true,
        is_featured: true,
        discount_percentage: 22,
        sort_order: 11,
        badges: ['70% Dark Cacao', 'Dessert Indulgence', 'Creamy Finish'],
        images: [
          'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=800&q=80',
          'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-DC-250', label: '250 g', weight_grams: 250, price: 239.00, mrp: 310.00, stock_quantity: 40, sort_order: 1 },
          { sku: 'VRD-DC-500', label: '500 g', weight_grams: 500, price: 449.00, mrp: 590.00, stock_quantity: 25, sort_order: 2 },
        ],
      },
      {
        id: 12,
        category_id: 5,
        name: 'Vardhamrit Roasted Cocoa Bean Cinnamon Chai',
        slug: 'vardhamrit-roasted-cocoa-bean-cinnamon-chai',
        tagline: 'Whole Crushed Cocoa Beans & Sweet Cinnamon',
        description: 'Coarsely crushed aromatic cocoa beans married with Ceylon cinnamon quills and bold estate tea. Creates a heavenly dessert cup aroma in your kitchen.',
        rating: 4.78,
        review_count: 65,
        is_bestseller: false,
        is_fresh_harvest: false,
        is_featured: false,
        discount_percentage: 18,
        sort_order: 12,
        badges: ['Crushed Beans', 'Sweet Cinnamon', 'Velvet Aroma'],
        images: [
          'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80',
          'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
        ],
        variants: [
          { sku: 'VRD-RC-250', label: '250 g', weight_grams: 250, price: 229.00, mrp: 290.00, stock_quantity: 35, sort_order: 1 },
          { sku: 'VRD-RC-500', label: '500 g', weight_grams: 500, price: 429.00, mrp: 540.00, stock_quantity: 20, sort_order: 2 },
        ],
      },
    ];

    for (const p of productsData) {
      await connection.query(`
        INSERT INTO products (id, category_id, name, slug, tagline, description, rating, review_count, is_bestseller, is_fresh_harvest, is_featured, discount_percentage, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          category_id=VALUES(category_id),
          name=VALUES(name), 
          slug=VALUES(slug), 
          tagline=VALUES(tagline), 
          description=VALUES(description), 
          rating=VALUES(rating),
          review_count=VALUES(review_count),
          is_bestseller=VALUES(is_bestseller),
          is_fresh_harvest=VALUES(is_fresh_harvest),
          is_featured=VALUES(is_featured),
          discount_percentage=VALUES(discount_percentage),
          sort_order=VALUES(sort_order);
      `, [p.id, p.category_id, p.name, p.slug, p.tagline, p.description, p.rating, p.review_count, p.is_bestseller, p.is_fresh_harvest, p.is_featured, p.discount_percentage, p.sort_order]);

      // Remove previous variants, images, badges for clean update
      await connection.query(`DELETE FROM product_variants WHERE product_id = ?;`, [p.id]);
      await connection.query(`DELETE FROM product_images WHERE product_id = ?;`, [p.id]);
      await connection.query(`DELETE FROM product_badges WHERE product_id = ?;`, [p.id]);

      // Variants
      for (const v of p.variants) {
        await connection.query(`
          INSERT INTO product_variants (product_id, sku, label, weight_grams, price, mrp, stock_quantity, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `, [p.id, v.sku, v.label, v.weight_grams, v.price, v.mrp, v.stock_quantity, v.sort_order]);
      }

      // Images
      let imgOrder = 1;
      for (const img of p.images) {
        await connection.query(`
          INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
          VALUES (?, ?, ?, ?);
        `, [p.id, img, imgOrder === 1, imgOrder]);
        imgOrder++;
      }

      // Badges
      let bOrder = 1;
      for (const b of p.badges) {
        await connection.query(`
          INSERT INTO product_badges (product_id, badge_label, sort_order)
          VALUES (?, ?, ?);
        `, [p.id, b, bOrder]);
        bOrder++;
      }
    }

    // 6. SEED PROMOTIONAL BANNERS (Coordinated with 4 Chai Flavours)
    console.log('🖼️ 6. Seeding Promotional Banners...');
    const bannersData = [
      {
        id: 1,
        slug: 'b1-normal-kadak',
        tagline: 'CLASSIC ASSAM CTC',
        headline: 'Normal Kadak Chai',
        subheadline: 'Single-estate bold Assam granules with rich malty body',
        image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80',
        badge_text: 'FLAT 25% OFF',
        badge_variant: 'discount',
        gradient_start: '#1A5D38',
        gradient_end: '#2D8B55',
        target_url: '/(tabs)/categories?category=normal',
        sort_order: 1,
      },
      {
        id: 2,
        slug: 'b2-masala-blend',
        tagline: '7-SPICE ROYAL RECIPE',
        headline: 'Grand Masala Chai',
        subheadline: 'Aromatic cinnamon, cloves, cardamom & dried ginger',
        image_url: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80',
        badge_text: 'BESTSELLER',
        badge_variant: 'gold',
        gradient_start: '#1A5D38',
        gradient_end: '#2D8B55',
        target_url: '/(tabs)/categories?category=masala',
        sort_order: 2,
      },
      {
        id: 3,
        slug: 'b3-keser-saffron',
        tagline: 'ROYAL KASHMIRI KESER',
        headline: 'Royal Keser Saffron Chai',
        subheadline: 'Grade-A whole saffron stigmas with roasted almond slivers',
        image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80',
        badge_text: 'ROYAL BATCH',
        badge_variant: 'gold',
        gradient_start: '#1A5D38',
        gradient_end: '#2D8B55',
        target_url: '/(tabs)/categories?category=keser',
        sort_order: 3,
      },
      {
        id: 4,
        slug: 'b4-chocolate-cacao',
        tagline: 'VELVETY COCOA DESSERT',
        headline: 'Artisan Chocolate Chai',
        subheadline: 'Roasted cocoa nibs & Dutch dark cacao with Assam tea',
        image_url: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&q=80',
        badge_text: 'GOURMET SPECIAL',
        badge_variant: 'discount',
        gradient_start: '#1A5D38',
        gradient_end: '#2D8B55',
        target_url: '/(tabs)/categories?category=chocolate',
        sort_order: 4,
      },
    ];

    for (const b of bannersData) {
      await connection.query(`
        INSERT INTO banners (id, slug, tagline, headline, subheadline, image_url, badge_text, badge_variant, gradient_start, gradient_end, target_url, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          slug=VALUES(slug), 
          tagline=VALUES(tagline), 
          headline=VALUES(headline), 
          subheadline=VALUES(subheadline),
          image_url=VALUES(image_url),
          badge_text=VALUES(badge_text),
          badge_variant=VALUES(badge_variant),
          gradient_start=VALUES(gradient_start),
          gradient_end=VALUES(gradient_end),
          target_url=VALUES(target_url),
          sort_order=VALUES(sort_order);
      `, [b.id, b.slug, b.tagline, b.headline, b.subheadline, b.image_url, b.badge_text, b.badge_variant, b.gradient_start, b.gradient_end, b.target_url, b.sort_order]);
    }

    // 7. SEED FLASH DEAL PROMOTION
    console.log('⚡ 7. Seeding Flash Deal Promotion...');
    const now = new Date();
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    const [variantRows]: any = await connection.query(`SELECT id FROM product_variants WHERE sku = 'VRD-NR-500' LIMIT 1;`);
    const flashVariantId = variantRows[0]?.id || 1;

    await connection.query(`
      INSERT INTO promotions (id, product_id, variant_id, title, subtitle, deal_price, original_price, discount_percent, start_time, end_time, is_active)
      VALUES (1, 1, ?, 'Normal Kadak Chai (Special 500g Family Pack)', '500g Bestseller CTC Pack • Fresh Vacuum Sealed', 249.00, 385.00, 35, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE 
        variant_id=VALUES(variant_id),
        deal_price=VALUES(deal_price), 
        original_price=VALUES(original_price),
        discount_percent=VALUES(discount_percent),
        title=VALUES(title),
        subtitle=VALUES(subtitle),
        start_time=VALUES(start_time),
        end_time=VALUES(end_time);
    `, [flashVariantId, now, endToday]);

    // 8. SEED BREWING GUIDES (Tailored to the 4 flavours)
    console.log('🫖 8. Seeding Brewing Guides...');
    const guidesData = [
      { id: 1, title: 'Normal Kadak Chai', tagline: 'The Daily Breakfast Ritual', leaves_qty: '1 heaped tsp (2.5g)', water_ratio: '1/2 cup (100ml)', boil_time_mins: '4 - 5 mins', milk_ratio: '1/2 cup whole milk', tasting_notes: 'Malty, rich amber color, invigorating strong punch', sort_order: 1 },
      { id: 2, title: 'Grand Masala Chai', tagline: 'Evening Aromatic Harmony', leaves_qty: '1.5 tsp spiced blend', water_ratio: '3/4 cup (150ml)', boil_time_mins: '4 - 5 mins slow simmer', milk_ratio: '1/2 cup warm milk', tasting_notes: 'Warming cinnamon & clove kick, soothing aromatic finish', sort_order: 2 },
      { id: 3, title: 'Royal Keser Chai', tagline: 'Royal Therapeutic Cup', leaves_qty: '1 tsp Keser blend', water_ratio: '1/2 cup (100ml)', boil_time_mins: '3 - 4 mins gentle simmer', milk_ratio: '1/2 cup rich milk + saffron strands', tasting_notes: 'Golden saffron liquor, almond crunch, delicate royal warmth', sort_order: 3 },
      { id: 4, title: 'Artisan Chocolate Chai', tagline: 'Decadent Dessert Sip', leaves_qty: '1.5 tsp chocolate blend', water_ratio: '1/2 cup (100ml)', boil_time_mins: '4 mins gentle simmer', milk_ratio: '1/2 cup whole milk', tasting_notes: 'Velvety dark chocolate sweetness, malty cocoa finish', sort_order: 4 },
    ];

    for (const g of guidesData) {
      await connection.query(`
        INSERT INTO brewing_guides (id, title, tagline, leaves_qty, water_ratio, boil_time_mins, milk_ratio, tasting_notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          title=VALUES(title), 
          tagline=VALUES(tagline),
          leaves_qty=VALUES(leaves_qty),
          water_ratio=VALUES(water_ratio),
          boil_time_mins=VALUES(boil_time_mins),
          milk_ratio=VALUES(milk_ratio),
          tasting_notes=VALUES(tasting_notes),
          sort_order=VALUES(sort_order);
      `, [g.id, g.title, g.tagline, g.leaves_qty, g.water_ratio, g.boil_time_mins, g.milk_ratio, g.tasting_notes, g.sort_order]);
    }

    // 9. SEED TRUST VALUE PROPOSITIONS
    console.log('🛡️ 9. Seeding Trust Value Propositions...');
    const trustData = [
      { id: 1, title: 'Fresh 2026 Harvest', subtitle: 'Packed at source within 48 hours', icon_name: 'sprout', sort_order: 1 },
      { id: 2, title: 'Direct Estate Sourced', subtitle: 'Zero middlemen, 100% garden pure', icon_name: 'leaf', sort_order: 2 },
      { id: 3, title: '48 hrs Tea Express', subtitle: 'Lightning doorstep delivery', icon_name: 'zap', sort_order: 3 },
      { id: 4, title: '100% Pure Aroma', subtitle: 'No chemical essence or coloring', icon_name: 'coffee', sort_order: 4 },
    ];

    for (const t of trustData) {
      await connection.query(`
        INSERT INTO trust_props (id, title, subtitle, icon_name, sort_order)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE title=VALUES(title), subtitle=VALUES(subtitle);
      `, [t.id, t.title, t.subtitle, t.icon_name, t.sort_order]);
    }

    // 10. SEED COUPONS
    console.log('🏷️ 10. Seeding Promotional Coupons...');
    const couponsData = [
      { id: 1, code: 'CHAI10', title: '10% OFF on all Teas', description: 'Valid on cart subtotal above ₹199', discount_type: 'PERCENT', discount_value: 10.00, min_order_value: 199.00, max_discount: 100.00 },
      { id: 2, code: 'WELCOME50', title: 'Flat ₹50 OFF for New Chai Lovers', description: 'Instant discount on first order above ₹299', discount_type: 'FLAT', discount_value: 50.00, min_order_value: 299.00, max_discount: null },
      { id: 3, code: 'KADAK100', title: 'Flat ₹100 OFF on Family Packs', description: 'Valid on orders containing 1kg packs above ₹599', discount_type: 'FLAT', discount_value: 100.00, min_order_value: 599.00, max_discount: null },
    ];

    for (const c of couponsData) {
      await connection.query(`
        INSERT INTO coupons (id, code, title, description, discount_type, discount_value, min_order_value, max_discount, usage_limit_total, usage_limit_per_user)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 10000, 2)
        ON DUPLICATE KEY UPDATE title=VALUES(title), discount_value=VALUES(discount_value);
      `, [c.id, c.code, c.title, c.description, c.discount_type, c.discount_value, c.min_order_value, c.max_discount]);
    }

    // 11. SEED ORDERS, ITEMS & TRACKING (Targeting the 4 flavours)
    console.log('📦 11. Seeding Customer Orders & Live Statuses...');
    const addressSnapshot = JSON.stringify({
      name: 'Rahul Sharma',
      phone: '+919876543210',
      tag: 'HOME',
      line1: 'Flat 402, Green Glen Orchid',
      line2: 'Phase 1, Hinjewadi IT Park',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411057',
    });

    const ordersData = [
      {
        id: 1,
        order_number: 'VRD-781902',
        user_id: 2,
        address_snapshot: addressSnapshot,
        subtotal: 478.00,
        discount_amount: 0.00,
        delivery_fee: 0.00,
        total_amount: 478.00,
        payment_method: 'UPI',
        payment_status: 'PAID',
        order_status: 'DISPATCHED',
        courier_name: 'Vardhamrit Express Rider (Suresh Kumar)',
        tracking_number: 'EXP-BLR-904',
        invoice_number: 'INV-2026-781902',
        items: [
          { product_id: 1, product_name: 'Vardhamrit Normal Chai (Classic Kadak)', variant_label: '500 g', unit_price: 279.00, quantity: 1, total_price: 279.00, product_image_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=80' },
          { product_id: 2, product_name: 'Vardhamrit Grand Masala Chai', variant_label: '250 g', unit_price: 199.00, quantity: 1, total_price: 199.00, product_image_url: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80' },
        ],
        history: [
          { status: 'CONFIRMED', notes: 'Order placed via UPI and harvest estate confirmed', changed_by: 'System' },
          { status: 'PACKED', notes: 'Vacuum sealed in fresh aroma lock bag', changed_by: 'Siliguri Hub' },
          { status: 'DISPATCHED', notes: 'Handed to express delivery rider Suresh Kumar', changed_by: 'Pune Express Hub' },
        ],
      },
      {
        id: 2,
        order_number: 'VRD-631084',
        user_id: 2,
        address_snapshot: addressSnapshot,
        subtotal: 398.00,
        discount_amount: 0.00,
        delivery_fee: 0.00,
        total_amount: 398.00,
        payment_method: 'UPI',
        payment_status: 'PAID',
        order_status: 'DELIVERED',
        courier_name: 'Vardhamrit Express Rider',
        tracking_number: 'EXP-BLR-312',
        invoice_number: 'INV-2026-631084',
        items: [
          { product_id: 2, product_name: 'Vardhamrit Grand Masala Chai', variant_label: '250 g', unit_price: 199.00, quantity: 2, total_price: 398.00, product_image_url: 'https://images.unsplash.com/photo-1563822249548-9a72b6353cd1?w=800&q=80' },
        ],
        history: [
          { status: 'CONFIRMED', notes: 'Order placed', changed_by: 'System' },
          { status: 'DELIVERED', notes: 'Delivered at customer doorstep', changed_by: 'Rider' },
        ],
      },
      {
        id: 3,
        order_number: 'VRD-419820',
        user_id: 2,
        address_snapshot: addressSnapshot,
        subtotal: 349.00,
        discount_amount: 0.00,
        delivery_fee: 0.00,
        total_amount: 349.00,
        payment_method: 'ONLINE',
        payment_status: 'PAID',
        order_status: 'DELIVERED',
        courier_name: 'Vardhamrit Express Rider',
        tracking_number: 'EXP-BLR-119',
        invoice_number: 'INV-2026-419820',
        items: [
          { product_id: 3, product_name: 'Vardhamrit Royal Keser Saffron Chai', variant_label: '250 g Tin', unit_price: 349.00, quantity: 1, total_price: 349.00, product_image_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=800&q=80' },
        ],
        history: [
          { status: 'CONFIRMED', notes: 'Order placed', changed_by: 'System' },
          { status: 'DELIVERED', notes: 'Delivered successfully', changed_by: 'Rider' },
        ],
      },
    ];

    for (const ord of ordersData) {
      await connection.query(`
        INSERT INTO orders (id, order_number, user_id, address_snapshot, subtotal, discount_amount, delivery_fee, total_amount, payment_method, payment_status, order_status, courier_name, tracking_number, invoice_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE order_status=VALUES(order_status), total_amount=VALUES(total_amount);
      `, [ord.id, ord.order_number, ord.user_id, ord.address_snapshot, ord.subtotal, ord.discount_amount, ord.delivery_fee, ord.total_amount, ord.payment_method, ord.payment_status, ord.order_status, ord.courier_name, ord.tracking_number, ord.invoice_number]);

      await connection.query(`DELETE FROM order_items WHERE order_id = ?;`, [ord.id]);
      for (const item of ord.items) {
        await connection.query(`
          INSERT INTO order_items (order_id, product_id, product_name, variant_label, unit_price, quantity, total_price, product_image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `, [ord.id, item.product_id, item.product_name, item.variant_label, item.unit_price, item.quantity, item.total_price, item.product_image_url]);
      }

      await connection.query(`DELETE FROM order_status_history WHERE order_id = ?;`, [ord.id]);
      for (const hist of ord.history) {
        await connection.query(`
          INSERT INTO order_status_history (order_id, status, notes, changed_by)
          VALUES (?, ?, ?, ?);
        `, [ord.id, hist.status, hist.notes, hist.changed_by]);
      }
    }

    // 12. SEED CUSTOMER REVIEWS (Targeting the 4 flavours)
    console.log('⭐ 12. Seeding Verified Customer Reviews...');
    const reviewsData = [
      { product_id: 1, user_id: 2, order_id: 1, rating: 5.0, title: 'Unbeatable Morning Kick!', comment: 'The liquor color is deep amber and the malty aroma fills the kitchen. Works brilliantly with thick milk.', review_tags: JSON.stringify(['Strong Malty Kick', 'Perfect with Milk', 'Fast 48 hrs Delivery']) },
      { product_id: 2, user_id: 2, order_id: 2, rating: 4.9, title: 'Authentic Hand-Pounded Spices', comment: 'You can smell real cloves and cinnamon as soon as you open the pouch. Zero artificial essence.', review_tags: JSON.stringify(['Real Spices', 'Ayurvedic Goodness']) },
      { product_id: 3, user_id: 2, order_id: 3, rating: 5.0, title: 'Opulent Saffron Gold Color', comment: 'Real Keser strands give the tea an unbelievable golden color and majestic aroma. Truly royal.', review_tags: JSON.stringify(['Mogra Saffron', 'Royal Gold']) },
      { product_id: 4, user_id: 2, order_id: 1, rating: 4.8, title: 'Velvety Dessert Treat!', comment: 'Real roasted cocoa nibs make it taste rich, chocolatey yet authentic tea. Evening delight.', review_tags: JSON.stringify(['Real Cocoa', 'Dessert Chai']) },
    ];

    for (const rev of reviewsData) {
      await connection.query(`
        INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, review_tags, is_verified_purchase, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)
        ON DUPLICATE KEY UPDATE rating=VALUES(rating), comment=VALUES(comment);
      `, [rev.product_id, rev.user_id, rev.order_id, rev.rating, rev.title, rev.comment, rev.review_tags]);
    }

    // 13. SEED WISHLISTS
    console.log('❤️ 13. Seeding Customer Wishlist...');
    await connection.query(`DELETE FROM wishlists WHERE user_id = 2;`);
    await connection.query(`
      INSERT INTO wishlists (user_id, product_id)
      VALUES (2, 1), (2, 2), (2, 3), (2, 4);
    `);

    // 14. SEED TEA COIN TRANSACTIONS
    console.log('🪙 14. Seeding Loyalty Coin Transactions...');
    await connection.query(`
      INSERT INTO coin_transactions (user_id, order_id, amount, transaction_type, description, balance_after)
      VALUES
      (2, NULL, 100, 'WELCOME_BONUS', 'Welcome to Vardhamrit Royal Club', 100),
      (2, 2, 200, 'ORDER_EARNED', 'Earned from order #VRD-631084', 300),
      (2, 3, 150, 'ORDER_EARNED', 'Earned from order #VRD-419820', 450)
      ON DUPLICATE KEY UPDATE amount=VALUES(amount);
    `);

    await connection.commit();
    console.log('✅ ALL SEEDS COMPLETED SUCCESSFULLY WITH 100% 4-FLAVOUR INTEGRITY!');
  } catch (error) {
    await connection.rollback();
    console.error('❌ Database Seeding Error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
