-- Migration: 004_drop_password_column.sql
-- Drop password_hash column: all users authenticate via passwordless OTP (Email OTP & Mobile OTP)

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
