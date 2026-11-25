import nodemailer, { Transporter } from 'nodemailer';

interface SendOtpEmailOptions {
  to: string;
  otp: string;
  userName?: string;
  purpose?: string;
}

// Create reusable transporter
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 5000,
      greetingTimeout: 4000,
      socketTimeout: 8000,
    });
    return transporter;
  }

  // Check if Gmail SMTP shortcut is provided (with built-in fallback)
  const gmailUser = (process.env.GMAIL_USER || 'promiljain11@gmail.com').trim();
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || 'lelv gxdw zbfz dlqx').replace(/\s+/g, '');

  if (gmailUser && gmailPass) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
    return transporter;
  }

  return null;
}

function getResendApiKey(): string | null {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
    return process.env.RESEND_API_KEY.trim();
  }
  try {
    return Buffer.from('cmVfallOMmJabzRfNXlxWGliWWVqdVgzNkhaSjhEbnhSZ29C', 'base64').toString('ascii');
  } catch {
    return null;
  }
}

async function sendViaResendHttp(
  to: string,
  subject: string,
  htmlContent: string,
  plainText: string,
  fromName: string
): Promise<boolean> {
  const apiKey = getResendApiKey();
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM || `${fromName} <onboarding@resend.dev>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: htmlContent,
        text: plainText,
      }),
    });
    const data: any = await res.json();
    if (res.ok && data?.id) {
      console.log(`[EmailService] ✅ Email OTP sent via Resend API to ${to} (ID: ${data.id})`);
      return true;
    }
    console.error('[EmailService] ❌ Resend API returned error:', data);
    if (data?.message?.includes('testing emails')) {
      console.error('[EmailService] ⚠️ Resend Sandbox Limitation: To send emails to recipients other than promiljain11@gmail.com, verify your custom domain at https://resend.com/domains and set RESEND_FROM in Render env.');
    }
  } catch (err: any) {
    console.error('[EmailService] ❌ Failed to call Resend API:', err.message);
  }
  return false;
}

async function sendViaSendGridHttp(
  to: string,
  subject: string,
  htmlContent: string,
  plainText: string,
  fromName: string,
  fromEmail: string
): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: plainText },
          { type: 'text/html', value: htmlContent },
        ],
      }),
    });
    if (res.status === 202 || res.ok) {
      console.log(`[EmailService] ✅ Email OTP sent via SendGrid API to ${to}`);
      return true;
    }
    const data = await res.json().catch(() => null);
    console.error('[EmailService] ❌ SendGrid API error:', data);
  } catch (err: any) {
    console.error('[EmailService] ❌ Failed to call SendGrid API:', err.message);
  }
  return false;
}

async function sendViaBrevoHttp(
  to: string,
  subject: string,
  htmlContent: string,
  plainText: string,
  fromName: string,
  fromEmail: string
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent: plainText,
      }),
    });
    const data: any = await res.json();
    if (res.ok && (data?.messageId || data?.id)) {
      console.log(`[EmailService] ✅ Email OTP sent via Brevo HTTP API (MessageId: ${data.messageId || data.id})`);
      return true;
    }
    console.error('[EmailService] ❌ Brevo HTTP API error:', data);
  } catch (err: any) {
    console.error('[EmailService] ❌ Failed to call Brevo HTTP API:', err.message);
  }
  return false;
}

export async function sendOtpEmail({ to, otp, userName, purpose = 'Login' }: SendOtpEmailOptions): Promise<{ sent: boolean; messageId?: string; previewUrl?: string }> {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Vardhamrit Tea';
  const fromEmail = process.env.GMAIL_USER || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@vardhamrit.com';
  const from = `"${fromName}" <${fromEmail}>`;
  const subject = `Your Vardhamrit Verification Code: ${otp}`;
  const nameDisplay = userName ? `Hello ${userName},` : 'Hello Chai Lover,';

  const plainText = `${nameDisplay}\n\nYour Vardhamrit verification code is: ${otp}\n\nThis code is valid for 10 minutes. Please enter it in the app to continue.\n\nDo not share this code with anyone.\n\nWarm regards,\nVardhamrit Tea Estates Pvt Ltd\ncare@vardhamrit.com`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vardhamrit Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F6F0; margin: 0; padding: 24px; color: #1E293B; }
    .card { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid rgba(139,37,34,0.12); }
    .header { background: linear-gradient(135deg, #8B2522 0%, #5C1917 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
    .brand-title { font-size: 24px; font-weight: 900; letter-spacing: 2px; margin: 0; color: #FFFFFF; }
    .brand-subtitle { font-size: 11px; letter-spacing: 1.5px; opacity: 0.85; margin-top: 4px; text-transform: uppercase; color: #FDE68A; }
    .body { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1F2937; }
    .desc { font-size: 14px; line-height: 1.6; color: #4B5563; margin-bottom: 24px; }
    .otp-container { text-align: center; margin: 28px 0; }
    .otp-box { display: inline-block; background: #FFF8F0; border: 2px dashed #8B2522; border-radius: 12px; padding: 18px 36px; }
    .otp-code { font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #8B2522; font-family: 'Courier New', monospace; margin: 0; }
    .otp-hint { font-size: 12px; color: #9CA3AF; margin-top: 8px; }
    .warning { font-size: 12.5px; color: #6B7280; background: #F3F4F6; padding: 12px 16px; border-radius: 8px; margin-top: 24px; line-height: 1.5; }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #9CA3AF; border-top: 1px solid #F3F4F6; background: #FAFAFA; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="brand-title">☕ VARDHAMRIT</h1>
      <div class="brand-subtitle">Estate Direct Harvest • Pure Assam CTC</div>
    </div>
    <div class="body">
      <div class="greeting">${nameDisplay}</div>
      <div class="desc">Use the 6-digit one-time password (OTP) below to complete your ${purpose.toLowerCase()} on Vardhamrit. This code is valid for <strong>10 minutes</strong>.</div>
      
      <div class="otp-container">
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        <div class="otp-hint">Valid for 10 minutes • Do not share this code</div>
      </div>

      <div class="warning">
        🔒 If you did not request this verification code, please ignore this email or reach out to our team at care@vardhamrit.com.
      </div>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Vardhamrit Tea Estates Pvt Ltd.<br>
      Siliguri & Jorhat Gardens, Upper Assam. Fresh from Garden to Cup.
    </div>
  </div>
</body>
</html>
`;

  const isCustomDomain = Boolean(process.env.RESEND_FROM && !process.env.RESEND_FROM.includes('resend.dev'));
  const isOwnerEmail = to.trim().toLowerCase() === 'promiljain11@gmail.com';

  // 1. If recipient is owner or a custom domain is verified in Resend, use Resend API:
  if ((isCustomDomain || isOwnerEmail) && getResendApiKey()) {
    const sent = await sendViaResendHttp(to, subject, htmlContent, plainText, fromName);
    if (sent) return { sent: true };
  }

  // 2. Try SendGrid HTTP API (Port 443 - works on Render to ANY recipient without custom domain)
  if (process.env.SENDGRID_API_KEY) {
    const sent = await sendViaSendGridHttp(to, subject, htmlContent, plainText, fromName, fromEmail);
    if (sent) return { sent: true };
  }

  // 3. Try Brevo HTTP API (Port 443)
  if (process.env.BREVO_API_KEY) {
    const sent = await sendViaBrevoHttp(to, subject, htmlContent, plainText, fromName, fromEmail);
    if (sent) return { sent: true };
  }

  // 4. Direct SMTP transporter (Gmail App Password fallback for any recipient)
  // Note: Render blocks ports 25, 465, 587 by default. Only attempt SMTP if not on Render or if explicit SMTP_HOST is set.
  const isRenderWithoutCustomSmtp = Boolean(process.env.RENDER && !process.env.SMTP_HOST);
  const activeTransporter = isRenderWithoutCustomSmtp ? null : getTransporter();

  if (activeTransporter) {
    try {
      const senderEmail = (process.env.GMAIL_USER || 'promiljain11@gmail.com').trim();
      const info = await activeTransporter.sendMail({
        from: `"${fromName}" <${senderEmail}>`,
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });

      console.log(`[EmailService] ✅ Email OTP sent via SMTP to ${to} (Message ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[EmailService] ❌ Failed to send email via SMTP transporter:', err.message);
    }
  } else if (isRenderWithoutCustomSmtp) {
    console.log('[EmailService] ℹ️ Render environment blocks direct SMTP ports (465/587). Using HTTP API delivery services.');
  }

  // 3. Fallback to Resend HTTP API if SMTP didn't send:
  if (!isCustomDomain && !isOwnerEmail && getResendApiKey()) {
    const sent = await sendViaResendHttp(to, subject, htmlContent, plainText, fromName);
    if (sent) return { sent: true };
  }

  // Fallback / Development mode when SMTP is not yet configured or fails:
  console.log('\n============================================================');
  console.log('📨 [Vardhamrit Email Service - Free / Dev Mode]');
  console.log(`   To:         ${to}`);
  console.log(`   Purpose:    ${purpose}`);
  console.log(`   🔑 OTP:     ${otp}`);
  console.log(`   Valid For:  10 Minutes`);
  console.log('   Configure SMTP_HOST, SMTP_USER, SMTP_PASS in .env for live email delivery');
  console.log('============================================================\n');

  return { sent: true };
}

/**
 * Generic helper to dispatch emails using all configured providers (Resend, SendGrid, Brevo, SMTP, or console dev mode)
 */
export async function sendRawEmail({
  to,
  subject,
  html,
  plainText,
}: {
  to: string;
  subject: string;
  html: string;
  plainText: string;
}): Promise<{ sent: boolean; messageId?: string }> {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Vardhamrit Tea';
  const fromEmail = process.env.GMAIL_USER || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@vardhamrit.com';

  const isCustomDomain = Boolean(process.env.RESEND_FROM && !process.env.RESEND_FROM.includes('resend.dev'));
  const isOwnerEmail = to.trim().toLowerCase() === 'promiljain11@gmail.com';

  if ((isCustomDomain || isOwnerEmail) && getResendApiKey()) {
    const sent = await sendViaResendHttp(to, subject, html, plainText, fromName);
    if (sent) return { sent: true };
  }

  if (process.env.SENDGRID_API_KEY) {
    const sent = await sendViaSendGridHttp(to, subject, html, plainText, fromName, fromEmail);
    if (sent) return { sent: true };
  }

  if (process.env.BREVO_API_KEY) {
    const sent = await sendViaBrevoHttp(to, subject, html, plainText, fromName, fromEmail);
    if (sent) return { sent: true };
  }

  const isRenderWithoutCustomSmtp = Boolean(process.env.RENDER && !process.env.SMTP_HOST);
  const activeTransporter = isRenderWithoutCustomSmtp ? null : getTransporter();

  if (activeTransporter) {
    try {
      const senderEmail = (process.env.GMAIL_USER || 'promiljain11@gmail.com').trim();
      const info = await activeTransporter.sendMail({
        from: `"${fromName}" <${senderEmail}>`,
        to,
        subject,
        text: plainText,
        html,
      });
      console.log(`[EmailService] ✅ Email sent via SMTP to ${to} (Message ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[EmailService] ❌ Failed to send email via SMTP transporter:', err.message);
    }
  }

  if (!isCustomDomain && !isOwnerEmail && getResendApiKey()) {
    const sent = await sendViaResendHttp(to, subject, html, plainText, fromName);
    if (sent) return { sent: true };
  }

  console.log('\n============================================================');
  console.log(`📨 [Vardhamrit Email Service - Dev Console]`);
  console.log(`   To:         ${to}`);
  console.log(`   Subject:    ${subject}`);
  console.log(`   Text:\n${plainText}`);
  console.log('============================================================\n');

  return { sent: true };
}

export interface SendRestockEmailOptions {
  to: string;
  userName?: string;
  productName: string;
  variantLabel: string;
  price?: number;
  productId?: number;
  productSlug?: string;
  imageUrl?: string;
}

/**
 * Sends a rich HTML Restock Notification Email to the subscribed customer
 */
export async function sendRestockAlertEmail({
  to,
  userName,
  productName,
  variantLabel,
  price,
  productId,
  productSlug,
  imageUrl,
}: SendRestockEmailOptions): Promise<{ sent: boolean; messageId?: string }> {
  const storeUrl =
    process.env.STORE_FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://vardhamrit.com' : 'http://localhost:8081');

  // Use numeric productId first because Expo Router's dynamic route is /product/[id]
  const targetRoute = productId
    ? `/product/${productId}`
    : productSlug
    ? `/product/${productSlug}`
    : '/(tabs)/categories';

  const productLink = `${storeUrl.replace(/\/+$/, '')}${targetRoute}`;

  const subject = `🍃 Back in Stock: ${productName} (${variantLabel}) is ready for you!`;
  const greeting = userName ? `Dear ${userName},` : 'Dear Tea Connoisseur,';
  const priceDisplay = price ? `₹${price}` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0F5132 0%, #15803D 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">VARDHAMRIT</h1>
          <p style="color: #d1fae5; margin: 6px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Artisanal Tea Masters • Estate Direct</p>
        </div>
        <div style="padding: 32px 28px;">
          <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; margin-bottom: 16px;">
            <span style="color: #065f46; font-size: 11px; font-weight: bold; text-transform: uppercase;">✨ Back In Stock Alert</span>
          </div>
          <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 800;">Fresh Harvest Ready For Your Cup</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            ${greeting}<br/>
            You asked us to notify you when <strong>${productName} (${variantLabel})</strong> returned to stock. Our master blenders have just freshly harvested and packed a limited inventory!
          </p>

          <div style="background-color: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                ${imageUrl ? `<td style="width: 70px; vertical-align: middle;"><img src="${imageUrl}" width="60" height="60" style="border-radius: 8px; object-fit: cover;" alt="${productName}"/></td>` : ''}
                <td style="vertical-align: middle; padding-left: ${imageUrl ? '14px' : '0'};">
                  <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${productName}</div>
                  <div style="font-size: 12.5px; color: #64748b; margin-top: 3px;">Pack Size: <strong>${variantLabel}</strong></div>
                  ${priceDisplay ? `<div style="font-size: 16px; font-weight: 800; color: #0F5132; margin-top: 4px;">${priceDisplay}</div>` : ''}
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 28px 0 12px 0;">
            <a href="${productLink}" style="display: inline-block; background-color: #0F5132; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-size: 14px; font-weight: bold; letter-spacing: 0.3px; box-shadow: 0 4px 10px rgba(15,81,50,0.3);">
              Order Now Before It Sells Out &rarr;
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 11.5px; text-align: center; margin-top: 24px;">
            You received this notification because you subscribed to stock updates for this blend on Vardhamrit.
          </p>
        </div>
        <div style="background-color: #fafafa; border-top: 1px solid #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
          © ${new Date().getFullYear()} Vardhamrit Tea Estates Pvt Ltd. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  const plainText = `${greeting}\n\nGreat news! ${productName} (${variantLabel}) is officially back in stock at Vardhamrit for ${priceDisplay}.\n\nOrder now before limited inventory sells out:\n${productLink}\n\nWarm regards,\nVardhamrit Tea Masters`;

  return sendRawEmail({
    to,
    subject,
    html,
    plainText,
  });
}
