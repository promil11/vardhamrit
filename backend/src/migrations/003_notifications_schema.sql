-- 003_notifications_schema.sql
-- Push Notifications and In-App Notification Center Schema

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'PROMO',
  action_route VARCHAR(255) NOT NULL DEFAULT '/',
  cta_text VARCHAR(100) DEFAULT 'View Now',
  target_audience ENUM('ALL', 'ACTIVE_BUYERS', 'INACTIVE', 'SPECIFIC_USER') NOT NULL DEFAULT 'ALL',
  target_user_id BIGINT UNSIGNED NULL,
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  status ENUM('SENT', 'SCHEDULED', 'FAILED') NOT NULL DEFAULT 'SENT',
  created_by BIGINT UNSIGNED NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaigns_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'PROMO',
  action_route VARCHAR(255) NOT NULL DEFAULT '/',
  cta_text VARCHAR(100) DEFAULT 'View Now',
  data JSON NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read),
  INDEX idx_notifications_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
