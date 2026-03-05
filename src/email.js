const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Orangutany <noreply@orangutany.com>';

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

function emailEnabled() {
  return resend !== null;
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0a0a0a;padding:48px 24px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:#161616;border-radius:16px;border:1px solid #262626;overflow:hidden;">

<tr><td style="padding:36px 0 28px;text-align:center;">
  <span style="font-size:32px;font-weight:700;color:#f97316;letter-spacing:-0.5px;">Orangutany Mushrooms</span>
</td></tr>

<tr><td style="padding:0 44px;">
  <div style="height:1px;background:#2a2a2a;"></div>
</td></tr>

<tr><td style="padding:36px 44px 40px;">
  ${content}
</td></tr>

<tr><td style="padding:0 44px;">
  <div style="height:1px;background:#2a2a2a;"></div>
</td></tr>

<tr><td style="padding:28px 44px 32px;text-align:center;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:#666;">Orangutany &mdash; AI Mushroom Identification</p>
  <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:#4a4a4a;">You received this because you have an account at orangutany.com</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcomeEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — welcome email skipped');
    return;
  }

  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Welcome to Orangutany!</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#e0e0e0;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#e0e0e0;">We use AI trained on millions of real mushroom specimens to give you accurate, confident identifications — so you know exactly what you're looking at.</p>

    <img src="https://orangutany.com/images/chicken-email.jpg" alt="Chicken of the Woods mushroom" width="100%" style="display:block;width:100%;border-radius:14px;border:0;margin:0 0 6px;" />
    <p style="margin:0 0 20px;font-size:13px;font-style:italic;color:#888;text-align:center;">Laetiporus sulphureus — Chicken of the Woods</p>

    <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#e0e0e0;">Upload photos from multiple angles for a full breakdown — species, edibility, look-alikes, and confidence score.</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#f97316;border-radius:10px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0a;text-decoration:none;letter-spacing:0.2px;">Start Identifying</a>
    </td></tr>
    </table>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Welcome to Orangutany Mushrooms', html });
    console.log(`[email] Welcome sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send welcome to ${to}:`, err.message, err.statusCode || '');
  }
}

async function sendPasswordResetEmail(to, name, resetUrl) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — password reset email skipped');
    return;
  }

  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Reset Your Password</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#e0e0e0;">${greeting}</p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#e0e0e0;">We received a request to reset your password. Click the button below to choose a new one:</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 32px;">
    <tr><td style="background-color:#f97316;border-radius:10px;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0a0a0a;text-decoration:none;letter-spacing:0.2px;">Reset Password</a>
    </td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#888;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#888;">If the button doesn't work, copy this URL:</p>
    <p style="margin:0;padding:12px 16px;font-size:13px;line-height:1.5;color:#f97316;background:#1a1a1a;border-radius:8px;word-break:break-all;">${resetUrl}</p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Reset your Orangutany password', html });
    console.log(`[email] Password reset sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send password reset to ${to}:`, err.message, err.statusCode || '');
    throw err; // re-throw so callers know it failed
  }
}

async function sendTestEmail(to) {
  if (!resend) throw new Error('RESEND_API_KEY not configured');
  const html = baseTemplate(`
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#ffffff;">Test Email</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#e0e0e0;">Email delivery is working correctly from <strong>noreply@orangutany.com</strong>.</p>
    <p style="margin:0;font-size:14px;color:#888;">Sent at ${new Date().toISOString()}</p>
  `);
  const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Orangutany — Email Test', html });
  console.log(`[email] Test email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  return result?.data?.id;
}

module.exports = { emailEnabled, sendWelcomeEmail, sendPasswordResetEmail, sendTestEmail };
