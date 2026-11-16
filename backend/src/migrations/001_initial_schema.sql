-- Vardhamrit Initial Schema Migration
-- Defines all tables with appropriate types, foreign keys, indexes, and unique constraints.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NULL UNIQUE,
  phone VARCHAR(20) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  push_token VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email),
  INDEX idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  landmark VARCHAR(150) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_addresses_user_default (user_id, is_default),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  review_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_active (is_active),
  INDEX idx_products_rating (avg_rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  label VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  sku VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_variants_product (product_id),
  INDEX idx_variants_stock (stock),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  variant_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_variant (user_id, variant_id),
  INDEX idx_cart_user (user_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('PERCENT', 'FLAT') NOT NULL,
  value DECIMAL(10, 2) NOT NULL,
  max_discount_cap DECIMAL(10, 2) NULL,
  min_order_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  usage_limit_total INT NULL,
  usage_limit_per_user INT NOT NULL DEFAULT 1,
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payment_method_restriction ENUM('ALL', 'ONLINE', 'COD') NOT NULL DEFAULT 'ALL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_coupons_code_active (code, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  address_snapshot JSON NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  coupon_code VARCHAR(50) NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('ONLINE', 'COD') NOT NULL,
  payment_status ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  status ENUM('PLACED', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PLACED',
  rejection_reason VARCHAR(255) NULL,
  courier_name VARCHAR(100) NULL,
  tracking_number VARCHAR(100) NULL,
  invoice_number VARCHAR(100) NULL UNIQUE,
  invoice_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_payment_status (payment_status),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Coupon Usages Table
CREATE TABLE IF NOT EXISTS coupon_usages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  user_id INT NOT NULL,
  order_id INT NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_order (coupon_id, order_id),
  INDEX idx_coupon_user (coupon_id, user_id),
  CONSTRAINT fk_usage_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE RESTRICT,
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_usage_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  variant_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_label VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  INDEX idx_items_order (order_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Order Status History Table
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status ENUM('PLACED', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'REJECTED', 'CANCELLED') NOT NULL,
  changed_by VARCHAR(100) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_order (order_id),
  CONSTRAINT fk_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  razorpay_order_id VARCHAR(100) NULL,
  razorpay_payment_id VARCHAR(100) NULL,
  signature VARCHAR(255) NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('CREATED', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
  method VARCHAR(50) NULL,
  failure_reason TEXT NULL,
  refund_id VARCHAR(100) NULL,
  refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_razorpay_order (razorpay_order_id),
  INDEX idx_payments_razorpay_payment (razorpay_payment_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  order_id INT NOT NULL,
  rating TINYINT NOT NULL,
  title VARCHAR(150) NULL,
  comment TEXT NULL,
  images JSON NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  admin_reply TEXT NULL,
  admin_replied_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product_order (user_id, product_id, order_id),
  INDEX idx_reviews_product_hidden (product_id, is_hidden),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
