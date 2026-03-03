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
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background-color:#171717;border-radius:12px;overflow:hidden;">
<tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #262626;">
  <span style="font-size:28px;font-weight:700;color:#f97316;letter-spacing:-0.5px;">🍄 Orangutany</span>
</td></tr>
<tr><td style="padding:32px 40px;">
  ${content}
</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid #262626;text-align:center;">
  <p style="margin:0;font-size:12px;color:#737373;">Orangutany — AI Mushroom Identification</p>
  <p style="margin:4px 0 0;font-size:12px;color:#525252;">You received this email because you have an account at orangutany.com</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcomeEmail(to, name) {
  if (!resend) return;

  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#f5f5f5;">Welcome to Orangutany!</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d4;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d4;">Thanks for creating an account. You can now upload mushroom photos and get AI-powered identifications, build your portfolio, and track your foraging history.</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d4d4d4;">Ready to identify your first mushroom?</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td style="background-color:#f97316;border-radius:8px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;">Start Identifying</a>
    </td></tr>
    </table>
  `);

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Welcome to Orangutany 🍄', html });
  } catch (err) {
    console.error('Failed to send welcome email:', err.message);
  }
}

async function sendPasswordResetEmail(to, name, resetUrl) {
  if (!resend) return;

  const greeting = name ? `Hi ${name},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#f5f5f5;">Reset Your Password</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d4;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d4d4d4;">We received a request to reset your password. Click the button below to choose a new one:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
    <tr><td style="background-color:#f97316;border-radius:8px;">
      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;">Reset Password</a>
    </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#737373;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#737373;">If the button doesn't work, copy and paste this URL into your browser:</p>
    <p style="margin:8px 0 0;font-size:12px;line-height:1.4;color:#525252;word-break:break-all;">${resetUrl}</p>
  `);

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Reset your Orangutany password', html });
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
  }
}

module.exports = { emailEnabled, sendWelcomeEmail, sendPasswordResetEmail };
