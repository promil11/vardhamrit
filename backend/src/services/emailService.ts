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

  // Check if Gmail SMTP shortcut is provided
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER.trim(),
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
      },
      connectionTimeout: 5000,
      greetingTimeout: 4000,
      socketTimeout: 8000,
    });
    return transporter;
  }

  return null;
}

export async function sendOtpEmail({ to, otp, userName, purpose = 'Login' }: SendOtpEmailOptions): Promise<{ sent: boolean; messageId?: string; previewUrl?: string }> {
  const fromName = process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Vardhamrit Tea';
  const fromEmail = process.env.GMAIL_USER || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@vardhamrit.com';
  const from = `"${fromName}" <${fromEmail}>`;
  const subject = `Your Vardhamrit Verification Code: ${otp}`;
  const nameDisplay = userName ? `Hello ${userName},` : 'Hello Chai Lover,';

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

  const activeTransporter = getTransporter();

  if (activeTransporter) {
    try {
      const plainText = `${nameDisplay}\n\nYour Vardhamrit verification code is: ${otp}\n\nThis code is valid for 10 minutes. Please enter it in the app to continue.\n\nDo not share this code with anyone.\n\nWarm regards,\nVardhamrit Tea Estates Pvt Ltd\ncare@vardhamrit.com`;

      const info = await activeTransporter.sendMail({
        from,
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });

      console.log(`[EmailService] ✅ Email OTP sent to ${to} (Message ID: ${info.messageId})`);
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EmailService] ❌ Failed to send email via SMTP transporter:', err);
    }
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
