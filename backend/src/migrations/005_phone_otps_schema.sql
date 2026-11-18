-- Migration: 005_phone_otps_schema.sql
-- Create phone_otps table for real Mobile OTP verification

CREATE TABLE IF NOT EXISTS phone_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_otps_lookup (phone, otp, expires_at, verified)
);
