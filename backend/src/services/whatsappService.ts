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
