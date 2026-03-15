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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Site design tokens: #0e1a0e (bg), #1a2e1a (card), #3a5a3a (border/green),
// #c8956c (copper/brand), #f0e4cc (cream text), #c4b49a (muted text)
function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#0e1a0e;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#0e1a0e;padding:48px 24px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:#1a2e1a;border-radius:16px;border:1px solid #3a5a3a;overflow:hidden;">

<tr><td style="padding:36px 0 28px;text-align:center;">
  <a href="https://orangutany.com" style="text-decoration:none;">
    <img src="https://orangutany.com/images/logo.png" alt="Orangutany" width="200" style="display:inline-block;width:200px;max-width:100%;height:auto;border:0;" />
  </a>
</td></tr>

<tr><td style="padding:0 44px;">
  <div style="height:1px;background:#3a5a3a;"></div>
</td></tr>

<tr><td style="padding:36px 44px 40px;">
  ${content}
</td></tr>

<tr><td style="padding:0 44px;">
  <div style="height:1px;background:#3a5a3a;"></div>
</td></tr>

<tr><td style="padding:28px 44px 32px;text-align:center;">
  <p style="margin:0;font-size:13px;line-height:1.5;color:#c4b49a;">Orangutany &mdash; Mushroom ID built by mycology &amp; tech enthusiasts</p>
  <p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:#7a6f5f;">You received this because you have an account at orangutany.com</p>
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

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">Welcome to Orangutany!</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">Built by people who love mycology and technology. Orangutany gives you accurate, confident mushroom identifications from photos.</p>

    <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#f0e4cc;">Upload photos from multiple angles for a full breakdown: species, edibility, look-alikes, and confidence score.</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Start Identifying</a>
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

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">Reset Your Password</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#f0e4cc;">We received a request to reset your password. Click the button below to choose a new one:</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 32px;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Reset Password</a>
    </td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#c4b49a;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#c4b49a;">If the button doesn't work, copy this URL:</p>
    <p style="margin:0;padding:12px 16px;font-size:13px;line-height:1.5;color:#c8956c;background:#0e1a0e;border-radius:8px;word-break:break-all;">${resetUrl}</p>
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
    <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#f0e4cc;">Test Email</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">Email delivery is working correctly from <strong>noreply@orangutany.com</strong>.</p>
    <p style="margin:0;font-size:14px;color:#c4b49a;">Sent at ${new Date().toISOString()}</p>
  `);
  const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Orangutany — Email Test', html });
  console.log(`[email] Test email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  return result?.data?.id;
}

async function sendFeedbackNotification(adminEmail, { name, email, message, ip }) {
  if (!resend) return;
  const from = name ? `${escapeHtml(name)}${email ? ` (${escapeHtml(email)})` : ''}` : (email ? escapeHtml(email) : 'Anonymous');
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#f0e4cc;">New Feedback</h1>
    <p style="margin:0 0 8px;font-size:14px;color:#c4b49a;">From: <strong style="color:#f0e4cc;">${from}</strong></p>
    <p style="margin:0 0 20px;font-size:14px;color:#c4b49a;">IP: ${ip || 'unknown'}</p>
    <div style="background:#0e1a0e;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:16px;line-height:1.7;color:#f0e4cc;white-space:pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `);
  try {
    await resend.emails.send({ from: FROM_EMAIL, to: adminEmail, subject: `Orangutany Feedback — ${name || email || 'Anonymous'}`, html });
    console.log(`[email] Feedback notification sent to ${adminEmail}`);
  } catch (err) {
    console.error(`[email] Failed to send feedback notification:`, err.message);
  }
}

async function sendUpgradeEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — upgrade email skipped');
    return;
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">You're now on Orangutany Pro!</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">Thank you for upgrading. Here's what you now have access to:</p>

    <div style="background:#0e1a0e;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;<strong>Unlimited scanning</strong></td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Full species breakdown &amp; confidence scores</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Look-alike warnings &amp; edibility details</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Priority support</td></tr>
      </table>
    </div>

    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#f0e4cc;">Stripe will send you a receipt for each payment automatically. You can manage your subscription anytime from your account.</p>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Start Scanning</a>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#c4b49a;text-align:center;">$7.99/mo &bull; Cancel anytime &bull; Questions? Reply to this email.</p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Welcome to Orangutany Pro!', html });
    console.log(`[email] Upgrade email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send upgrade email to ${to}:`, err.message);
  }
}

async function sendAbuseAlertEmail(adminEmail, { userId, userEmail, ip, reason, metadata }) {
  if (!resend) return;
  const reasonLabels = {
    hourly_burst: 'Hourly scan burst limit exceeded',
    ip_daily_cap: 'IP daily scan cap exceeded',
    suspicious_velocity: 'Suspicious scan velocity detected'
  };
  const label = reasonLabels[reason] || reason;
  const details = metadata ? escapeHtml(JSON.stringify(metadata, null, 2)) : 'No details';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ff4444;">Abuse Alert</h1>
    <p style="margin:0 0 8px;font-size:14px;color:#c4b49a;">Type: <strong style="color:#ff6666;">${escapeHtml(label)}</strong></p>
    <p style="margin:0 0 8px;font-size:14px;color:#c4b49a;">User: <strong style="color:#f0e4cc;">${escapeHtml(userEmail || (userId ? `#${userId}` : 'Anonymous'))}</strong></p>
    <p style="margin:0 0 20px;font-size:14px;color:#c4b49a;">IP: ${ip || 'unknown'}</p>
    <div style="background:#0e1a0e;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <pre style="margin:0;font-size:13px;line-height:1.5;color:#f0e4cc;white-space:pre-wrap;">${details}</pre>
    </div>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#ff4444;border-radius:10px;">
      <a href="https://orangutany.com/admin" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">View in Admin</a>
    </td></tr>
    </table>
  `);
  try {
    await resend.emails.send({ from: FROM_EMAIL, to: adminEmail, subject: `[ABUSE] ${label} — Orangutany`, html });
    console.log(`[email] Abuse alert sent to ${adminEmail} — ${reason}`);
  } catch (err) {
    console.error(`[email] Failed to send abuse alert:`, err.message);
  }
}

async function sendCancellationEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — cancellation email skipped');
    return;
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">Your Pro subscription has been cancelled</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">Your Orangutany Pro subscription has been cancelled and your account has been switched back to the free plan.</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">You can still use Orangutany with 5 free scans per day. If you ever want to come back to Pro, you can upgrade again anytime from your account.</p>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com/upgrade" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Re-subscribe</a>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#c4b49a;text-align:center;">Questions? Reply to this email.</p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Your Orangutany Pro subscription has been cancelled', html });
    console.log(`[email] Cancellation email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send cancellation email to ${to}:`, err.message);
  }
}

async function sendLifetimeUpgradeEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — lifetime upgrade email skipped');
    return;
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">Welcome to Orangutany Pro Lifetime!</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">You now have <strong>lifetime access</strong> to Orangutany Pro. No recurring charges, no expiration.</p>

    <div style="background:#0e1a0e;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;<strong>Scan as much as you want</strong> — forever</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Full species breakdown &amp; confidence scores</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Look-alike warnings &amp; edibility details</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;Priority support</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#10003; &nbsp;<strong>No recurring charges</strong></td></tr>
      </table>
    </div>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Start Scanning</a>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#c4b49a;text-align:center;">One-time payment of $49.99 &bull; Lifetime access &bull; Questions? Reply to this email.</p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Welcome to Orangutany Pro Lifetime!', html });
    console.log(`[email] Lifetime upgrade email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send lifetime upgrade email to ${to}:`, err.message);
  }
}

async function sendPaymentFailedEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — payment failed email skipped');
    return;
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#ff6666;line-height:1.3;">Payment failed</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">We were unable to process your latest Orangutany Pro payment. Please update your payment method to keep your Pro access.</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">If we can't collect payment, your account will be switched to the free plan automatically.</p>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com/account/billing" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Update Payment Method</a>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#c4b49a;text-align:center;">Questions? Reply to this email.</p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Orangutany Pro — Payment failed', html });
    console.log(`[email] Payment failed email sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send payment failed email to ${to}:`, err.message);
  }
}

async function sendNewsletterWelcomeEmail(to, name) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — newsletter welcome email skipped');
    return;
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const html = baseTemplate(`
    <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0e4cc;line-height:1.3;">You're on the list!</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#f0e4cc;">Thanks for subscribing to the Orangutany newsletter. We'll send you foraging tips, species spotlights, and seasonal updates — packed with real knowledge from mycologists and field foragers. No spam, ever.</p>

    <div style="background:#0e1a0e;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#127812; &nbsp;Seasonal foraging guides</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#128270; &nbsp;Species deep-dives &amp; look-alike alerts</td></tr>
        <tr><td style="padding:8px 0;font-size:15px;color:#f0e4cc;">&#127891; &nbsp;Identification tips from mycologists</td></tr>
      </table>
    </div>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
    <tr><td style="background-color:#c8956c;border-radius:10px;">
      <a href="https://orangutany.com" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#0e1a0e;text-decoration:none;letter-spacing:0.2px;">Start Identifying</a>
    </td></tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#c4b49a;text-align:center;">
      <a href="https://orangutany.com/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}" style="color:#c4b49a;text-decoration:underline;">Unsubscribe</a> &bull; Questions? Reply to this email.
    </p>
  `);

  try {
    const result = await resend.emails.send({ from: FROM_EMAIL, to, subject: 'Welcome to the Orangutany Newsletter!', html });
    console.log(`[email] Newsletter welcome sent to ${to} — id: ${result?.data?.id || 'unknown'}`);
  } catch (err) {
    console.error(`[email] Failed to send newsletter welcome to ${to}:`, err.message);
  }
}

module.exports = { emailEnabled, sendWelcomeEmail, sendPasswordResetEmail, sendTestEmail, sendFeedbackNotification, sendUpgradeEmail, sendLifetimeUpgradeEmail, sendCancellationEmail, sendPaymentFailedEmail, sendAbuseAlertEmail, sendNewsletterWelcomeEmail };
