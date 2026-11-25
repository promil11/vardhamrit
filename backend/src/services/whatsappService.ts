/**
 * Vardhamrit Luxury Tea - WhatsApp OTP Service
 * Powered by Meta Cloud API (WhatsApp Business Platform)
 * Free 1,000 service / authentication conversations every month.
 */

export interface SendWhatsAppOtpOptions {
  phone: string;
  otp: string;
  purpose?: string;
  userName?: string;
}

export interface SendWhatsAppResult {
  sent: boolean;
  provider: 'whatsapp' | 'console';
  message?: string;
  requestId?: string;
}

/**
 * Normalizes phone number to clean 10-digit Indian mobile format
 */
export function normalizeIndianPhone(rawPhone: string): string {
  const digitsOnly = String(rawPhone || '').replace(/[^0-9]/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.substring(2);
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.substring(1);
  }
  if (digitsOnly.length === 10) {
    return digitsOnly;
  }
  return digitsOnly;
}

/**
 * Formats 10-digit Indian phone to Meta WhatsApp Cloud API format (e.g., "919876543210")
 */
export function toMetaWhatsAppNumber(rawPhone: string): string {
  const clean = normalizeIndianPhone(rawPhone);
  return `91${clean}`;
}

/**
 * Dispatches real WhatsApp OTP code via Meta Cloud API
 */
export async function sendWhatsAppOtp({
  phone,
  otp,
  purpose = 'login',
  userName,
}: SendWhatsAppOtpOptions): Promise<SendWhatsAppResult> {
  const cleanPhone = normalizeIndianPhone(phone);
  const waRecipient = toMetaWhatsAppNumber(phone);

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.trim() : null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ? process.env.WHATSAPP_PHONE_NUMBER_ID.trim() : null;
  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME ? process.env.WHATSAPP_OTP_TEMPLATE_NAME.trim() : null;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG ? process.env.WHATSAPP_TEMPLATE_LANG.trim() : 'en_US';

  if (accessToken && phoneNumberId && cleanPhone.length === 10) {
    try {
      const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

      let payload: any;

      if (templateName && templateName !== 'none') {
        // Option 1: Template Message (Standard for Meta Authentication/OTP)
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: waRecipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: otp },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: otp },
                ],
              },
            ],
          },
        };
      } else {
        // Option 2: Standard formatted WhatsApp text message
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: waRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: `🍵 *Vardhamrit Chai Verification*\n\nHello ${userName || 'Tea Connoisseur'},\nYour verification code is: *${otp}*\n\nValid for 10 minutes. Please do not share this code with anyone.`,
          },
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();

      if (response.ok && data?.messages && data.messages.length > 0) {
        const messageId = data.messages[0].id;
        console.log(`[WhatsAppService] ✅ Real WhatsApp OTP sent via Meta Cloud API to +91 ${cleanPhone} (ID: ${messageId})`);
        return {
          sent: true,
          provider: 'whatsapp',
          requestId: messageId,
          message: 'OTP sent successfully to your WhatsApp',
        };
      } else {
        const metaError = data?.error;
        const errCode = metaError?.code || response.status;
        const errMsg = metaError?.message || metaError?.error_user_msg || 'Meta Cloud API rejected the request';
        console.warn(`[WhatsAppService] ⚠️ Meta Cloud API error [${errCode}]: ${errMsg}`);

        // Dev console fallback output for smooth local testing:
        console.log('\n============================================================');
        console.log('📱 [Vardhamrit WhatsApp Service - Local Dev OTP]');
        console.log(`   To:              +91 ${cleanPhone} (WhatsApp: ${waRecipient})`);
        console.log(`   🔑 OTP:          ${otp}`);
        console.log(`   Meta Error:      [${errCode}] ${errMsg}`);
        console.log('============================================================\n');

        return {
          sent: false,
          provider: 'whatsapp',
          message: `Meta WhatsApp [${errCode}]: ${errMsg}`,
        };
      }
    } catch (err: any) {
      console.error('[WhatsAppService] ❌ Failed to dispatch WhatsApp OTP:', err.message || err);
      return {
        sent: false,
        provider: 'whatsapp',
        message: err.message || 'Network error reaching Meta Cloud API',
      };
    }
  }

  // Fallback / Development mode when Meta WhatsApp credentials are not yet configured:
  console.log('\n============================================================');
  console.log('📱 [Vardhamrit WhatsApp Service - Dev Console Fallback]');
  console.log(`   To:         +91 ${cleanPhone} (WhatsApp)`);
  console.log(`   Recipient:  ${userName || 'Tea Lover'}`);
  console.log(`   Purpose:    ${purpose}`);
  console.log(`   🔑 OTP:     ${otp}`);
  console.log(`   Valid For:  10 Minutes`);
  console.log('   Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in backend/.env for live WhatsApp delivery');
  console.log('============================================================\n');

  return {
    sent: false,
    provider: 'console',
    message: 'Meta WhatsApp credentials not configured in backend/.env. OTP logged to server console.',
  };
}

/**
 * Generic helper to send text messages via Meta Cloud API or log to server console
 */
export async function sendMetaWhatsAppMessage({
  phone,
  text,
  userName,
  title = 'Notification',
}: {
  phone: string;
  text: string;
  userName?: string;
  title?: string;
}): Promise<SendWhatsAppResult> {
  const cleanPhone = normalizeIndianPhone(phone);
  const waRecipient = toMetaWhatsAppNumber(phone);

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ? process.env.WHATSAPP_ACCESS_TOKEN.trim() : null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ? process.env.WHATSAPP_PHONE_NUMBER_ID.trim() : null;

  if (accessToken && phoneNumberId && cleanPhone.length === 10) {
    try {
      const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: waRecipient,
        type: 'text',
        text: {
          preview_url: true,
          body: text,
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: any = await response.json();
      if (response.ok && data?.messages && data.messages.length > 0) {
        const messageId = data.messages[0].id;
        console.log(`[WhatsAppService] ✅ WhatsApp message sent via Meta Cloud API to +91 ${cleanPhone} (ID: ${messageId})`);
        return {
          sent: true,
          provider: 'whatsapp',
          requestId: messageId,
          message: 'WhatsApp notification sent successfully',
        };
      } else {
        const metaError = data?.error;
        console.warn(`[WhatsAppService] ⚠️ Meta Cloud API error [${metaError?.code || response.status}]: ${metaError?.message}`);
      }
    } catch (err: any) {
      console.error('[WhatsAppService] ❌ Failed to dispatch WhatsApp message:', err.message || err);
    }
  }

  // Console Fallback / Simulation
  console.log('\n============================================================');
  console.log(`📱 [Vardhamrit WhatsApp - ${title}]`);
  console.log(`   To:         +91 ${cleanPhone} (${userName || 'Customer'})`);
  console.log(`   Message:\n${text}`);
  console.log('============================================================\n');

  return {
    sent: true,
    provider: 'console',
    message: 'WhatsApp notification logged to console (Fallback mode)',
  };
}

export interface SendWhatsAppRestockOptions {
  phone: string;
  userName?: string;
  productName: string;
  variantLabel: string;
  price?: number;
  productId?: number;
  productSlug?: string;
}

/**
 * Dispatches automated Restock Alert directly to customer's WhatsApp
 */
export async function sendWhatsAppRestockAlert({
  phone,
  userName,
  productName,
  variantLabel,
  price,
  productId,
  productSlug,
}: SendWhatsAppRestockOptions): Promise<SendWhatsAppResult> {
  const storeUrl =
    process.env.STORE_FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://vardhamrit.com' : 'http://localhost:8081');

  const targetRoute = productId
    ? `/product/${productId}`
    : productSlug
    ? `/product/${productSlug}`
    : '/(tabs)/categories';

  const productLink = `${storeUrl.replace(/\/+$/, '')}${targetRoute}`;

  const greeting = userName ? `Hello *${userName}*,` : 'Hello Tea Connoisseur,';
  const priceText = price ? `\n💰 *Price:* ₹${price}` : '';

  const body = `🍃 *Back in Stock: Vardhamrit Pure Tea*\n\n${greeting}\nGreat news! The blend you requested is officially back in stock from our garden harvest:\n\n✨ *${productName}*\n📦 *Pack Size:* ${variantLabel}${priceText}\n\nStock is limited and selling fast! Tap the link below to order yours right away:\n👉 ${productLink}\n\n_Crafted with devotion by Vardhamrit Tea Masters._`;

  return sendMetaWhatsAppMessage({
    phone,
    text: body,
    userName,
    title: 'Restock Alert',
  });
}

export interface SendWhatsAppOrderAlertOptions {
  phone: string;
  userName?: string;
  orderNumber: string;
  status: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  courierName?: string;
  trackingNumber?: string;
  itemsSummary?: string;
}

/**
 * Dispatches automated Order Status notifications to customer's WhatsApp
 */
export async function sendWhatsAppOrderAlert({
  phone,
  userName,
  orderNumber,
  status,
  totalAmount,
  courierName,
  trackingNumber,
  itemsSummary,
}: SendWhatsAppOrderAlertOptions): Promise<SendWhatsAppResult> {
  const greeting = userName ? `Hello *${userName}*,` : 'Hello Tea Connoisseur,';

  let header = '';
  let statusDetail = '';

  switch (status) {
    case 'PLACED':
      header = `🍵 *Order Placed Successfully!*`;
      statusDetail = `Thank you for choosing Vardhamrit. We have received your order and are carefully preparing your artisanal tea fresh from the estate.`;
      break;
    case 'CONFIRMED':
      header = `✅ *Order Confirmed!*`;
      statusDetail = `Your order has been confirmed by our tea masters and is being packed in our vacuum freshness seal.`;
      break;
    case 'DISPATCHED':
      header = `🚀 *Order Dispatched & On Its Way!*`;
      const courierText = courierName ? `via *${courierName}*` : '';
      const trackText = trackingNumber ? `\n📌 *Tracking Number:* ${trackingNumber}` : '';
      statusDetail = `Your package is on its way ${courierText}!${trackText}\nYour tea will be at your doorstep very soon.`;
      break;
    case 'DELIVERED':
      header = `☕ *Order Delivered! Enjoy Your Chai!*`;
      statusDetail = `Your package has been successfully delivered. May every sip bring warmth and vitality to your day!`;
      break;
    case 'CANCELLED':
      header = `⚠️ *Order Update: Cancelled*`;
      statusDetail = `Your order #${orderNumber} has been cancelled. If payment was deducted, a refund has been initiated to your original payment method.`;
      break;
  }

  const itemsLine = itemsSummary ? `\n📋 *Items:* ${itemsSummary}` : '';
  const body = `${header}\n\n${greeting}\n${statusDetail}\n\n🔖 *Order #:* ${orderNumber}\n💵 *Total Amount:* ₹${totalAmount}${itemsLine}\n\nNeed assistance? Reply directly to this WhatsApp message or visit us at vardhamrit.com.`;

  return sendMetaWhatsAppMessage({
    phone,
    text: body,
    userName,
    title: `Order ${status}`,
  });
}
