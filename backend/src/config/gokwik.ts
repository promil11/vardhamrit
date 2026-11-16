import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

export const GOKWIK_CONFIG = {
  appId: process.env.GOKWIK_APP_ID || 'gokwik_test_vardhamrit_app',
  appSecret: process.env.GOKWIK_APP_SECRET || 'gokwik_test_secret_vardhamrit_2026',
  merchantId: process.env.GOKWIK_MERCHANT_ID || 'VRD_MERCHANT_01',
  merchantName: process.env.GOKWIK_MERCHANT_NAME || 'Vardhamrit Chai',
  upiVpa: process.env.GOKWIK_UPI_VPA || 'vardhamrit@icici',
  customQrImageUrl: process.env.GOKWIK_CUSTOM_QR_URL || '',
  env: process.env.GOKWIK_ENV || 'sandbox',
  baseUrl: process.env.GOKWIK_BASE_URL || 'https://sandbox.gokwik.co',
};

export interface UpiIntentParams {
  transactionId: string;
  orderNumber: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}

export interface UpiIntentResult {
  universalUpiUrl: string;
  gpayUrl: string;
  phonepeUrl: string;
  paytmUrl: string;
  bhimUrl: string;
  credUrl: string;
}

export function buildUpiLinks(params: UpiIntentParams): UpiIntentResult {
  const vpa = GOKWIK_CONFIG.upiVpa;
  const payeeName = GOKWIK_CONFIG.merchantName;
  const amountStr = params.amount.toFixed(2);
  const note = params.note || `Vardhamrit Chai Order ${params.orderNumber}`;

  const queryParams = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    mc: '5499', // Merchant Category Code for Food & Beverage / Specialty Retail
    tid: params.transactionId,
    tr: params.orderNumber,
    tn: note,
    am: amountStr,
    cu: 'INR',
  }).toString();

  const universalUpiUrl = `upi://pay?${queryParams}`;

  return {
    universalUpiUrl,
    gpayUrl: `gpay://upi/pay?${queryParams}`,
    phonepeUrl: `phonepe://upi/pay?${queryParams}`,
    paytmUrl: `paytmmp://upi/pay?${queryParams}`,
    bhimUrl: universalUpiUrl,
    credUrl: `credpay://upi/pay?${queryParams}`,
  };
}

export function generateGoKwikSignature(payload: string, secret: string = GOKWIK_CONFIG.appSecret): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyGoKwikSignature(payload: string, signature: string, secret: string = GOKWIK_CONFIG.appSecret): boolean {
  if (!signature) return false;
  try {
    const expected = generateGoKwikSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(expected, 'utf-8'));
  } catch {
    return false;
  }
}
