const crypto = require('node:crypto');

const SESSION_COOKIE_NAME = 'amushroom_session';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  const value = normalizeEmail(email);
  if (!value) return { valid: false, message: 'Email is required.' };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return ok ? { valid: true, message: '' } : { valid: false, message: 'Enter a valid email address.' };
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 10) {
    return { valid: false, message: 'Password must be at least 10 characters.' };
  }

  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: 'Password must include letters and numbers.' };
  }

  return { valid: true, message: '' };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;

  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function createId() {
  return crypto.randomUUID();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};

  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) continue;
    const rawValue = rest.join('=');
    try {
      out[name] = decodeURIComponent(rawValue);
    } catch {
      out[name] = rawValue;
    }
  }

  return out;
}

function isHttpsRequest(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwardedProto) return forwardedProto === 'https';
  return Boolean(req.socket && req.socket.encrypted);
}

function buildSessionCookie(req, sessionId, maxAgeSec = 60 * 60 * 24 * 30) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (isHttpsRequest(req) || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function buildClearSessionCookie(req) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (isHttpsRequest(req) || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

module.exports = {
  SESSION_COOKIE_NAME,
  normalizeEmail,
  validateEmail,
  validatePassword,
  hashPassword,
  verifyPassword,
  createId,
  parseCookies,
  buildSessionCookie,
  buildClearSessionCookie
};
