import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export const RAZORPAY_CONFIG = {
  keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_vardhamrit_dummy',
  keySecret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_replace_with_live',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret',
  isMockMode:
    process.env.MOCK_PAYMENT_GATEWAY === 'true' ||
    !process.env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID.includes('dummy'),
};

let razorpayClient: Razorpay | null = null;

if (!RAZORPAY_CONFIG.isMockMode) {
  try {
    razorpayClient = new Razorpay({
      key_id: RAZORPAY_CONFIG.keyId,
      key_secret: RAZORPAY_CONFIG.keySecret,
    });
  } catch (err) {
    console.warn('⚠️ Failed to initialize Razorpay SDK; falling back to Mock Gateway mode.', err);
    RAZORPAY_CONFIG.isMockMode = true;
  }
}

export function getRazorpayClient(): Razorpay | null {
  return razorpayClient;
}

export function generateSignature(orderId: string, paymentId: string, secret = RAZORPAY_CONFIG.keySecret): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret = RAZORPAY_CONFIG.webhookSecret): boolean {
  if (!signature || !secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
