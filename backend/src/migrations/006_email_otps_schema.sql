-- Migration: 006_email_otps_schema.sql
-- Create email_otps table for Email OTP verification

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  otp VARCHAR(10) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_otps_lookup (email, otp, expires_at, verified)
);
