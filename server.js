const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
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
} = require('./src/auth');
const {
  createOAuthState,
  consumeOAuthState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile
} = require('./src/google-oauth');
const {
  createUser,
  getPublicUser,
  findUserAuthByEmail,
  findUserAuthByGoogleSub,
  attachGoogleIdentity,
  updateUserName,
  createSession,
  getSessionWithUser,
  touchSession,
  deleteSession,
  deleteExpiredSessions,
  createUploadRecord,
  listUserUploads,
  getUserUploadDetail,
  trackEvent,
  updateEventGeo,
  getAnalyticsSummary,
  getRecentEvents,
  getScansByDay,
  getSignupsByDay,
  getTopSpecies,
  getGeoBreakdown,
  getVisitorBreakdown,
  getPageViewsByDay,
  getEventFunnel,
  updateUploadStory,
  getCoverImageBlob,
  insertFeedback,
  listFeedback,
  listAllUsers,
  createPasswordResetToken,
  findValidResetToken,
  markResetTokenUsed,
  updateUserPassword,
  deleteUserSessions,
  deleteExpiredResetTokens,
  checkAnonQuota,
  recordAnonScan,
  checkUserQuota,
  recordUserScan,
  cleanExpiredAnonQuotas,
  ANON_SCAN_LIMIT,
  FREE_SCAN_LIMIT
} = require('./src/db');
const { sendWelcomeEmail, sendPasswordResetEmail, sendTestEmail, sendFeedbackNotification } = require('./src/email');
const { runOnePost, listPosted } = require('./src/instagram');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TOKEN_FILE = path.join(ROOT, 'design', 'tokens', 'tokens.json');

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const API_URL = process.env.MUSHROOM_API_URL || 'https://mushroom.kindwise.com/api/v1/identification';
const API_LANGUAGE = process.env.MUSHROOM_API_LANGUAGE || 'en';
const ENABLE_MIX_CHECK = process.env.ENABLE_MIX_CHECK !== 'false';
const MIX_CONFIDENCE_THRESHOLD = Number(process.env.MIX_CONFIDENCE_THRESHOLD || 75);
const IDENTIFY_RATE_LIMIT_ENABLED = process.env.IDENTIFY_RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const AUTH_RATE_LIMIT_ENABLED = process.env.AUTH_RATE_LIMIT_ENABLED !== 'false';
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60_000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 40);
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://amushroom.com';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_BASE_URL}/api/auth/google/callback`;
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 8 * 1024 * 1024);
const MAX_IMAGE_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8;
const MAX_UPLOAD_IMAGES = 5;
// Covers 5 images at MAX_IMAGE_BYTES each plus base64 and JSON overhead before payload validation runs.
const IDENTIFY_BODY_MAX_BYTES = Math.ceil((MAX_IMAGE_BYTES * MAX_UPLOAD_IMAGES * 4) / 3) + 1024 * 1024;
const MIX_CHECK_TRIGGER_TOP_CONFIDENCE = 90;
const MIX_CHECK_TRIGGER_MARGIN = 15;

const ADMIN_EMAILS = new Set((process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean));

async function lookupGeo(ip) {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') return null;
  try {
    const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`);
    const data = await resp.json();
    if (data.status === 'success') return { country: data.country, city: data.city };
  } catch { /* ignore */ }
  return null;
}

function trackAndGeo(event, userId, metadata, ip, userAgent) {
  const eventId = trackEvent({ event, userId, metadata, ip, userAgent });
  lookupGeo(ip).then(geo => {
    if (geo) updateEventGeo(eventId, geo.country, geo.city);
  }).catch(() => {});
}

function isAdmin(user) {
  if (!user?.email) return false;
  return ADMIN_EMAILS.has(user.email.toLowerCase());
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif'
]);

const REQUESTED_DETAILS = [
  'common_names',
  'url',
  'description',
  'edibility',
  'psychoactive',
  'characteristic',
  'look_alike',
  'taxonomy',
  'rank',
  'gbif_id',
  'inaturalist_id',
  'image',
  'images'
];

const TRAIT_FALLBACK = 'Key visible markers were limited in this photo set. Add clear close-ups of cap, gills, and stalk.';
const SESSION_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const identifyRateLimitStore = new Map();
const authRateLimitStore = new Map();

deleteExpiredSessions();
deleteExpiredResetTokens();
setInterval(() => {
  deleteExpiredSessions();
  deleteExpiredResetTokens();
  cleanExpiredAnonQuotas();
}, SESSION_CLEANUP_INTERVAL_MS).unref();

function securityHeaders(req) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  };

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwardedProto === 'https') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

function sendJson(req, res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...securityHeaders(req),
    ...extraHeaders,
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function serveFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(req, res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { ...securityHeaders(req), 'Content-Type': contentType });
    res.end(data);
  });
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwardedFor) return forwardedFor;
  }
  if (req.socket?.remoteAddress) return req.socket.remoteAddress;
  return 'unknown';
}

function checkRateLimit(store, key, windowMs, maxRequests) {
  const now = Date.now();
  const current = store.get(key);
  let entry = current;

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
  }

  entry.count += 1;
  store.set(key, entry);

  if (store.size > 5000) {
    for (const [mapKey, value] of store.entries()) {
      if (now >= value.resetAt) store.delete(mapKey);
    }
  }

  if (entry.count > maxRequests) {
    return { limited: true, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  return { limited: false, retryAfterSec: 0 };
}

function getRequestOrigin(req) {
  const forwardedProto = TRUST_PROXY ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
  const proto = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
  const forwardedHost = TRUST_PROXY ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  const host = forwardedHost || String(req.headers.host || '').trim();
  if (!host) return null;
  return `${proto}://${host}`;
}

function getAllowedOrigins(req) {
  const allowed = new Set();
  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) allowed.add(requestOrigin);

  try {
    allowed.add(new URL(APP_BASE_URL).origin);
  } catch {
    // Ignore malformed APP_BASE_URL.
  }

  return allowed;
}

function isSameOriginOrNoOrigin(req) {
  const originHeader = String(req.headers.origin || '').trim();
  if (!originHeader) return true;

  let origin;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  return getAllowedOrigins(req).has(origin);
}

function requireSameOrigin(req, res) {
  if (isSameOriginOrNoOrigin(req)) return true;
  jsonError(req, res, 403, 'Blocked by origin policy.');
  return false;
}

function enforceRouteRateLimit(req, res, store, windowMs, maxRequests, message) {
  const ip = getClientIp(req);
  const outcome = checkRateLimit(store, ip, windowMs, maxRequests);
  if (!outcome.limited) return true;

  sendJson(req, res, 429, { error: message }, { 'Retry-After': String(outcome.retryAfterSec) });
  return false;
}

function parseBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > maxBytes) {
        reject(new Error('Request too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    req.on('error', () => reject(new Error('Failed to read request body.')));
  });
}

function jsonError(req, res, status, message) {
  sendJson(req, res, status, { error: message });
}

function getSessionTtlSeconds() {
  const days = Number.isFinite(SESSION_TTL_DAYS) ? SESSION_TTL_DAYS : 30;
  return Math.max(1, Math.floor(days * 24 * 60 * 60));
}

function computeSessionExpiryIso() {
  const ms = getSessionTtlSeconds() * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function toPublicUser(userRow) {
  if (!userRow) return null;
  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name || '',
    emailVerified: Boolean(userRow.email_verified ?? userRow.emailVerified),
    tier: userRow.tier || 'free',
    createdAt: userRow.created_at || userRow.createdAt,
    updatedAt: userRow.updated_at || userRow.updatedAt
  };
}

function getAuthContext(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;

  const session = getSessionWithUser(sessionId);
  if (!session) return null;

  const expiresAt = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    deleteSession(sessionId);
    return null;
  }

  touchSession(sessionId);
  return {
    sessionId,
    user: toPublicUser(session)
  };
}

function setSession(res, req, sessionId) {
  res.setHeader('Set-Cookie', buildSessionCookie(req, sessionId, getSessionTtlSeconds()));
}

function clearSession(res, req) {
  res.setHeader('Set-Cookie', buildClearSessionCookie(req));
}

function redirect(req, res, location) {
  res.writeHead(302, {
    ...securityHeaders(req),
    Location: location
  });
  res.end();
}

function firstText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (item && typeof item.name === 'string' && item.name.trim()) return item.name.trim();
    }
  }
  if (value && typeof value === 'object' && typeof value.name === 'string' && value.name.trim()) {
    return value.name.trim();
  }
  return '';
}

function toPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(Math.min(100, Math.max(0, n)));
}

function inferEdible(details = {}) {
  const edible = details.edibility ?? details.edible ?? details.is_edible;
  if (typeof edible === 'string') {
    const normalized = edible.trim().toLowerCase();
    const labels = {
      choice: 'Edible (choice)',
      edible: 'Edible',
      'edible when cooked': 'Edible when cooked',
      caution: 'Caution',
      medicinal: 'Medicinal',
      inedible: 'Inedible',
      poisonous: 'Poisonous',
      deadly: 'Deadly poisonous'
    };
    return labels[normalized] || edible;
  }
  if (typeof edible === 'boolean') return edible ? 'Edible' : 'Not edible';

  const text = [details.edibility, details.edibility_description, details.toxicity, details.warning]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('poison') || text.includes('toxic') || text.includes('not edible')) return 'Not edible';
  if (text.includes('edible')) return 'Edible';
  return 'Unknown';
}

function inferPsychedelic(details = {}) {
  const value = details.psychoactive ?? details.psychedelic ?? details.is_psychoactive;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  const text = [details.description, details.wiki_description, details.effects]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('psilocybin') || text.includes('psychoactive') || text.includes('hallucin')) return 'Yes';
  return 'Unknown';
}

function extractTraits(details = {}) {
  if (details.characteristic && typeof details.characteristic === 'object' && !Array.isArray(details.characteristic)) {
    const structured = [];
    for (const [key, val] of Object.entries(details.characteristic)) {
      if (typeof val === 'string' && val.trim()) structured.push(`${key}: ${val.trim()}`);
    }
    if (structured.length) return structured.slice(0, 6);
  }

  const candidates = [
    details.characteristics,
    details.characteristic,
    details.identification,
    details.key_features,
    details.look,
    details.cap,
    details.gills,
    details.stem
  ];

  const values = [];
  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (typeof item === 'string' && item.trim()) values.push(item.trim());
      }
      continue;
    }

    if (typeof candidate === 'string' && candidate.trim()) {
      values.push(candidate.trim());
      continue;
    }

    if (typeof candidate === 'object') {
      for (const v of Object.values(candidate)) {
        if (typeof v === 'string' && v.trim()) values.push(v.trim());
      }
    }
  }

  return Array.from(new Set(values)).slice(0, 4);
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  const supported = new Set(['top', 'gills', 'stalk', 'environment', 'extra']);
  return supported.has(value) ? value : 'extra';
}

function roleLabel(role) {
  const labels = {
    top: 'Top of cap',
    gills: 'Bottom / gills',
    stalk: 'Stalk',
    environment: 'Environment',
    extra: 'Extra detail'
  };
  return labels[role] || 'Extra detail';
}

function buildUploadGuidance(photoRoles, imageCount = 0) {
  const fallbackRoles = ['top', 'gills', 'stalk', 'environment', 'extra'].slice(0, Math.max(0, imageCount));
  const normalized = Array.isArray(photoRoles) && photoRoles.length ? photoRoles.map(normalizeRole) : fallbackRoles;
  const unique = Array.from(new Set(normalized));
  const recommended = ['top', 'gills', 'stalk', 'environment'];
  const missing = recommended.filter((role) => !unique.includes(role));

  return {
    uploadedRoles: unique.map(roleLabel),
    missingRecommendedRoles: missing.map(roleLabel)
  };
}

function buildWhyMatch({ score, traits, description, edibility, psychoactive, uploadGuidance }) {
  const reasons = [];

  if (score >= 80) reasons.push(`High confidence prediction (${score}%).`);
  else if (score >= 55) reasons.push(`Moderate confidence prediction (${score}%).`);
  else reasons.push(`Low confidence prediction (${score}%). Treat as a hint only.`);

  if (traits.length && !traits[0].includes('Key visible markers were limited in this photo set.')) {
    reasons.push(`Key visual traits align: ${traits.slice(0, 2).join('; ')}.`);
  } else if (description) {
    reasons.push('The species profile details align with what was visible in your photos.');
  } else {
    reasons.push('Limited species detail was available for this match.');
  }

  if (uploadGuidance.missingRecommendedRoles.length === 0) {
    reasons.push('You provided all core angles (top, gills, stalk, environment), which improves quality.');
  } else {
    reasons.push(`Adding photos of the ${uploadGuidance.missingRecommendedRoles.join(', ').replace(/, ([^,]*)$/, ' and $1')} could improve this identification.`);
  }

  if (String(edibility).toLowerCase().includes('poison') || String(edibility).toLowerCase().includes('deadly')) {
    reasons.push('Safety signal indicates possible toxicity.');
  }
  if (String(psychoactive).toLowerCase().includes('yes')) {
    reasons.push('This species is known to contain psychoactive compounds.');
  }

  return reasons.slice(0, 4);
}

function normalizeMatches(payload, uploadGuidance) {
  const suggestions =
    payload?.result?.classification?.suggestions ||
    payload?.result?.suggestions ||
    payload?.suggestions ||
    [];

  return suggestions.slice(0, 3).map((suggestion) => {
    const details = suggestion.details || suggestion.result || {};
    const commonName =
      firstText(details.common_names) ||
      firstText(details.common_name) ||
      firstText(suggestion.common_names) ||
      suggestion.name ||
      'Unknown species';

    const scientificName = suggestion.name || firstText(details.scientific_name) || commonName;
    const traits = extractTraits(details);
    const taxonomy = details.taxonomy && typeof details.taxonomy === 'object' ? details.taxonomy : null;
    const lookAlikes = Array.isArray(details.look_alike)
      ? details.look_alike
          .map((item) => (item && typeof item.name === 'string' ? item.name.trim() : ''))
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const wikiUrl = firstText(details.url);
    const description = firstText(details.description) || firstText(details.wiki_description);
    const representativeImage = firstText(details.image);
    const edibility = inferEdible(details);
    const psychoactive = inferPsychedelic(details);
    const score = toPercent(suggestion.probability ?? suggestion.confidence ?? suggestion.score ?? 0);

    const caution =
      firstText(details.warning) ||
      firstText(details.toxicity) ||
      (edibility.toLowerCase().includes('deadly') || edibility.toLowerCase().includes('poison')
        ? 'Potentially dangerous if consumed.'
        : '') ||
      'Do not consume without local expert verification.';

    return {
      commonName,
      scientificName,
      edible: edibility,
      psychedelic: psychoactive,
      score,
      traits: traits.length ? traits : [TRAIT_FALLBACK],
      caution,
      taxonomy,
      description,
      wikiUrl,
      lookAlikes,
      representativeImage,
      rank: firstText(details.rank),
      gbifId: details.gbif_id ?? null,
      inaturalistId: details.inaturalist_id ?? null,
      whyMatch: buildWhyMatch({
        score,
        traits: traits.length ? traits : [TRAIT_FALLBACK],
        description,
        edibility,
        psychoactive,
        uploadGuidance
      })
    };
  });
}

function buildIdentifyUrl(includeDetails = true) {
  const targetUrl = new URL(API_URL);
  if (includeDetails) targetUrl.searchParams.set('details', REQUESTED_DETAILS.join(','));
  targetUrl.searchParams.set('language', API_LANGUAGE);
  return targetUrl.toString();
}

async function requestIdentification(images, includeDetails = true) {
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(buildIdentifyUrl(includeDetails), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': process.env.MUSHROOM_API_KEY
      },
      body: JSON.stringify({ images, similar_images: true })
    });
  } catch {
    throw new Error('Failed to reach identification API.');
  }

  const rawText = await upstreamResponse.text();
  let parsed = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = {};
  }

  if (!upstreamResponse.ok) {
    const rawSnippet = typeof rawText === 'string' ? rawText.trim().slice(0, 200) : '';
    const message = parsed.message || parsed.error || rawSnippet || `API request failed (${upstreamResponse.status}).`;
    throw new Error(message);
  }

  return parsed;
}

function extractTopPrediction(payload) {
  const suggestions =
    payload?.result?.classification?.suggestions ||
    payload?.result?.suggestions ||
    payload?.suggestions ||
    [];

  const top = suggestions[0];
  if (!top) return null;

  const details = top.details || top.result || {};
  const commonName =
    firstText(details.common_names) ||
    firstText(details.common_name) ||
    firstText(top.common_names) ||
    top.name ||
    'Unknown species';

  const scientificName = top.name || firstText(details.scientific_name) || commonName;
  const confidence = toPercent(top.probability ?? top.confidence ?? top.score ?? 0);
  return { commonName, scientificName, confidence };
}

async function runConsistencyCheck(images) {
  if (!ENABLE_MIX_CHECK || images.length < 2) return null;

  const perPhoto = await Promise.all(
    images.map(async (image, index) => {
      const payload = await requestIdentification([image], false);
      const top = extractTopPrediction(payload);
      return {
        photoNumber: index + 1,
        topMatch: top?.scientificName || 'Unknown',
        commonName: top?.commonName || 'Unknown',
        confidence: top?.confidence ?? 0
      };
    })
  );

  const strong = perPhoto.filter((item) => item.confidence >= MIX_CONFIDENCE_THRESHOLD && item.topMatch !== 'Unknown');
  const uniqueStrong = Array.from(new Set(strong.map((item) => item.topMatch)));

  if (uniqueStrong.length > 1) {
    const first = strong[0];
    const conflicting = strong.find((item) => item.topMatch !== first.topMatch) || strong[1];
    return {
      likelyMixed: true,
      message:
        `Possible mixed species upload: photo ${first.photoNumber} is closer to ${first.topMatch} (${first.confidence}%), ` +
        `while photo ${conflicting.photoNumber} is closer to ${conflicting.topMatch} (${conflicting.confidence}%).`,
      perPhoto
    };
  }

  return {
    likelyMixed: false,
    message: 'All uploaded photos appear consistent with a single species profile.',
    perPhoto
  };
}

function shouldRunConsistencyCheck(images, matches) {
  if (!ENABLE_MIX_CHECK || images.length < 2) return false;
  if (!Array.isArray(matches) || matches.length < 2) return true;

  const topScore = Number(matches[0]?.score || 0);
  const secondScore = Number(matches[1]?.score || 0);
  if (!Number.isFinite(topScore) || !Number.isFinite(secondScore)) return true;

  const margin = topScore - secondScore;
  return topScore < MIX_CHECK_TRIGGER_TOP_CONFIDENCE || margin < MIX_CHECK_TRIGGER_MARGIN;
}

function sanitizeReturnPath(value, fallback = '/') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (text.length > 200) return fallback;
  if (/[\r\n]/.test(text)) return fallback;
  if (!text.startsWith('/')) return fallback;
  if (text.startsWith('//')) return fallback;
  return text;
}

function decodedBase64Size(base64) {
  const normalized = String(base64 || '').replace(/\s+/g, '');
  const length = normalized.length;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((length * 3) / 4) - padding;
}

function validateImagePayload(images, imageMeta) {
  for (let i = 0; i < images.length; i += 1) {
    const base64 = String(images[i] || '').replace(/\s+/g, '');
    if (!base64) {
      return `Image ${i + 1} is empty.`;
    }
    if (base64.length > MAX_IMAGE_BASE64_CHARS) {
      return `Image ${i + 1} exceeds ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`;
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
      return `Image ${i + 1} uses an unsupported encoding format.`;
    }

    const sizeBytes = decodedBase64Size(base64);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
      return `Image ${i + 1} exceeds ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.`;
    }

    const meta = Array.isArray(imageMeta) ? imageMeta[i] || {} : {};
    const mimeType = String(meta.mimeType || '').trim().toLowerCase();
    if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return `Image ${i + 1} has unsupported file type (${mimeType}).`;
    }
  }

  return '';
}

function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

async function handleAuthRegister(req, res) {
  let body;
  try {
    body = await parseBody(req, 2 * 1024 * 1024);
  } catch (error) {
    jsonError(req, res, 400, error.message);
    return;
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const name = String(body.name || '').trim();

  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    jsonError(req, res, 400, emailCheck.message);
    return;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    jsonError(req, res, 400, passwordCheck.message);
    return;
  }

  if (findUserAuthByEmail(email)) {
    jsonError(req, res, 409, 'An account with this email already exists.');
    return;
  }

  const hashed = hashPassword(password);
  const user = createUser({
    email,
    name,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    googleSub: null,
    emailVerified: false
  });

  const sessionId = createId();
  createSession({
    sessionId,
    userId: user.id,
    expiresAt: computeSessionExpiryIso(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || '')
  });
  setSession(res, req, sessionId);

  trackAndGeo('signup', user.id, { email }, getClientIp(req), req.headers['user-agent'] || null);
  sendWelcomeEmail(email, name).catch(() => {});
  sendJson(req, res, 201, { user });
}

async function handleAuthLogin(req, res) {
  let body;
  try {
    body = await parseBody(req, 2 * 1024 * 1024);
  } catch (error) {
    jsonError(req, res, 400, error.message);
    return;
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  const userRow = findUserAuthByEmail(email);
  if (!userRow || !userRow.password_hash || !userRow.password_salt) {
    jsonError(req, res, 401, 'Invalid email or password.');
    return;
  }

  const ok = verifyPassword(password, userRow.password_salt, userRow.password_hash);
  if (!ok) {
    jsonError(req, res, 401, 'Invalid email or password.');
    return;
  }

  const sessionId = createId();
  createSession({
    sessionId,
    userId: userRow.id,
    expiresAt: computeSessionExpiryIso(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || '')
  });
  setSession(res, req, sessionId);

  trackAndGeo('login', userRow.id, { email }, getClientIp(req), req.headers['user-agent'] || null);
  sendJson(req, res, 200, { user: getPublicUser(userRow.id) });
}

function handleAuthLogout(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    deleteSession(sessionId);
  }
  clearSession(res, req);
  sendJson(req, res, 200, { ok: true });
}

async function handleForgotPassword(req, res) {
  let body;
  try {
    body = await parseBody(req, 2 * 1024 * 1024);
  } catch (error) {
    jsonError(req, res, 400, error.message);
    return;
  }

  // Always return 200 to prevent email enumeration
  const genericResponse = { message: 'If an account exists with that email, a reset link has been sent.' };

  const email = normalizeEmail(body.email);
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) {
    sendJson(req, res, 200, genericResponse);
    return;
  }

  const userRow = findUserAuthByEmail(email);
  if (!userRow || !userRow.password_hash) {
    sendJson(req, res, 200, genericResponse);
    return;
  }

  const crypto = require('node:crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  createPasswordResetToken({ userId: userRow.id, token, expiresAt });

  const resetUrl = `${APP_BASE_URL}/reset-password?token=${token}`;
  sendPasswordResetEmail(email, userRow.name, resetUrl).catch((err) => {
    console.error('[forgot-password] Email send failed:', err.message);
  });

  sendJson(req, res, 200, genericResponse);
}

async function handleResetPassword(req, res) {
  let body;
  try {
    body = await parseBody(req, 2 * 1024 * 1024);
  } catch (error) {
    jsonError(req, res, 400, error.message);
    return;
  }

  const token = String(body.token || '');
  const password = String(body.password || '');

  if (!token) {
    jsonError(req, res, 400, 'Reset token is required.');
    return;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    jsonError(req, res, 400, passwordCheck.message);
    return;
  }

  const resetToken = findValidResetToken(token);
  if (!resetToken) {
    jsonError(req, res, 400, 'Invalid or expired reset link. Please request a new one.');
    return;
  }

  const hashed = hashPassword(password);
  updateUserPassword({ userId: resetToken.user_id, passwordHash: hashed.hash, passwordSalt: hashed.salt });
  markResetTokenUsed(resetToken.id);
  deleteUserSessions(resetToken.user_id);

  sendJson(req, res, 200, { message: 'Password reset successfully. Please sign in with your new password.' });
}

function handleAuthMe(req, res) {
  const auth = getAuthContext(req);
  const user = auth?.user || null;
  sendJson(req, res, 200, { user, isAdmin: user ? isAdmin(user) : false });
}

function handleGoogleStart(req, res, url) {
  if (!isGoogleAuthConfigured()) {
    jsonError(req, res, 503, 'Google OAuth is not configured.');
    return;
  }

  const state = createId();
  const returnTo = sanitizeReturnPath(url.searchParams.get('returnTo') || '/', '/');
  createOAuthState(state, returnTo);

  const authUrl = buildGoogleAuthUrl({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    state
  });

  redirect(req, res, authUrl);
}

async function handleGoogleCallback(req, res, url) {
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const authError = url.searchParams.get('error');

  if (authError) {
    redirect(req, res, '/?error=google_auth_denied');
    return;
  }

  if (!state || !code) {
    redirect(req, res, '/?error=google_auth_invalid');
    return;
  }

  const stateValue = consumeOAuthState(state);
  if (!stateValue) {
    redirect(req, res, '/?error=google_auth_state');
    return;
  }

  if (!isGoogleAuthConfigured()) {
    redirect(req, res, '/?error=google_auth_unavailable');
    return;
  }

  let profile;
  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: GOOGLE_REDIRECT_URI
    });
    profile = await fetchGoogleProfile(tokens.access_token);
  } catch {
    redirect(req, res, '/?error=google_auth_failed');
    return;
  }

  if (!profile.email || !profile.sub) {
    redirect(req, res, '/?error=google_profile_invalid');
    return;
  }

  let user = findUserAuthByGoogleSub(profile.sub);
  if (!user) {
    const existingByEmail = findUserAuthByEmail(normalizeEmail(profile.email));
    if (existingByEmail) {
      attachGoogleIdentity({
        userId: existingByEmail.id,
        googleSub: profile.sub,
        emailVerified: profile.emailVerified
      });
      if (profile.name && !existingByEmail.name) {
        updateUserName({ userId: existingByEmail.id, name: profile.name });
      }
      user = findUserAuthByGoogleSub(profile.sub);
    } else {
      createUser({
        email: normalizeEmail(profile.email),
        name: profile.name,
        passwordHash: null,
        passwordSalt: null,
        googleSub: profile.sub,
        emailVerified: profile.emailVerified
      });
      user = findUserAuthByGoogleSub(profile.sub);
    }
  }

  if (!user) {
    redirect(req, res, '/?error=google_auth_failed');
    return;
  }

  const sessionId = createId();
  createSession({
    sessionId,
    userId: user.id,
    expiresAt: computeSessionExpiryIso(),
    ip: getClientIp(req),
    userAgent: String(req.headers['user-agent'] || '')
  });
  setSession(res, req, sessionId);
  redirect(req, res, sanitizeReturnPath(stateValue.returnTo || '/', '/'));
}

function handleUserUploads(req, res, url) {
  const auth = getAuthContext(req);
  if (!auth?.user?.id) {
    jsonError(req, res, 401, 'Authentication required.');
    return;
  }

  const limit = Number(url.searchParams.get('limit') || 20);
  const uploads = listUserUploads(auth.user.id, limit);
  sendJson(req, res, 200, { uploads });
}

function handleAuthConfig(req, res) {
  sendJson(req, res, 200, {
    googleAuthEnabled: isGoogleAuthConfigured()
  });
}

function handleUserUploadDetail(req, res, url) {
  const auth = getAuthContext(req);
  if (!auth?.user?.id) {
    jsonError(req, res, 401, 'Authentication required.');
    return;
  }

  const uploadId = decodeURIComponent(url.pathname.slice('/api/user/uploads/'.length)).trim();
  if (!uploadId) {
    jsonError(req, res, 400, 'Upload ID is required.');
    return;
  }

  const upload = getUserUploadDetail(auth.user.id, uploadId);
  if (!upload) {
    jsonError(req, res, 404, 'Saved upload not found.');
    return;
  }

  const photoRoles = Array.isArray(upload.images) ? upload.images.map((image) => image.role || 'extra') : [];
  const uploadGuidance = buildUploadGuidance(photoRoles, photoRoles.length);
  const consistencyCheck = {
    likelyMixed: Boolean(upload.mixedSpecies),
    message: upload.consistencyMessage || 'Saved consistency summary not available.',
    perPhoto: []
  };

  sendJson(req, res, 200, {
    upload: {
      ...upload,
      uploadGuidance,
      consistencyCheck
    }
  });
}

function stripMatchToTeaser(match) {
  return {
    commonName: match.commonName,
    scientificName: match.scientificName,
    score: match.score,
    edible: 'Unknown',
    psychedelic: 'Unknown',
    traits: [],
    taxonomy: {},
    lookAlikes: [],
    description: '',
    wikiUrl: '',
    representativeImage: '',
    whyMatch: [],
    caution: ''
  };
}

async function handleIdentify(req, res) {
  if (!process.env.MUSHROOM_API_KEY) {
    sendJson(req, res, 500, { error: 'Server missing MUSHROOM_API_KEY.' });
    return;
  }

  let body;
  try {
    body = await parseBody(req, IDENTIFY_BODY_MAX_BYTES);
  } catch (error) {
    sendJson(req, res, 400, { error: error.message });
    return;
  }

  const images = Array.isArray(body.images) ? body.images.filter((item) => typeof item === 'string' && item.trim()) : [];
  const photoRoles = Array.isArray(body.photoRoles) ? body.photoRoles.slice(0, images.length) : [];
  const imageMeta = Array.isArray(body.imageMeta) ? body.imageMeta.slice(0, images.length) : [];
  const uploadGuidance = buildUploadGuidance(photoRoles, images.length);
  const auth = getAuthContext(req);
  const clientIp = getClientIp(req);

  if (images.length < 1 || images.length > MAX_UPLOAD_IMAGES) {
    sendJson(req, res, 400, { error: `Provide between 1 and ${MAX_UPLOAD_IMAGES} images.` });
    return;
  }

  const imageValidationError = validateImagePayload(images, imageMeta);
  if (imageValidationError) {
    sendJson(req, res, 400, { error: imageValidationError });
    return;
  }

  // Quota check — before calling Kindwise API
  let quotaExceeded = false;
  let quotaInfo = null;

  if (auth?.user) {
    const tier = auth.user.tier || 'free';
    if (tier !== 'pro') {
      const quota = checkUserQuota(auth.user.id);
      quotaInfo = { tier, used: quota.used, limit: quota.limit, resetsAt: quota.resetsAt };
      if (quota.exceeded) {
        sendJson(req, res, 403, {
          error: `You've reached your daily limit of ${quota.limit} scans. Come back tomorrow or upgrade to Pro.`,
          quota_exceeded: true,
          quota: quotaInfo
        });
        return;
      }
    }
  } else {
    const quota = checkAnonQuota(clientIp);
    quotaInfo = { tier: 'anonymous', used: quota.used, limit: quota.limit };
    if (quota.exceeded) {
      quotaExceeded = true;
      // Don't return yet — we'll still call Kindwise but strip the response
    }
  }

  let parsed;
  try {
    parsed = await requestIdentification(images, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Identification failed.';
    sendJson(req, res, 502, { error: message });
    return;
  }

  const matches = normalizeMatches(parsed, uploadGuidance);
  if (!matches.length) {
    sendJson(req, res, 502, { error: 'API returned no suggestions. Try different photos.' });
    return;
  }

  // Record the scan against quota
  if (auth?.user) {
    const tier = auth.user.tier || 'free';
    if (tier !== 'pro') {
      recordUserScan(auth.user.id);
      const updated = checkUserQuota(auth.user.id);
      quotaInfo = { tier, used: updated.used, limit: updated.limit, resetsAt: updated.resetsAt };
    }
  } else {
    recordAnonScan(clientIp);
    const updated = checkAnonQuota(clientIp);
    quotaInfo = { tier: 'anonymous', used: updated.used, limit: updated.limit };
  }

  // Anonymous soft wall — strip results to teaser
  if (quotaExceeded) {
    const teaser = [stripMatchToTeaser(matches[0])];
    trackAndGeo('scan_quota_exceeded', null, { ip: clientIp, tier: 'anonymous' }, clientIp, req.headers['user-agent'] || null);
    sendJson(req, res, 200, {
      matches: teaser,
      uploadGuidance,
      consistencyCheck: null,
      uploadId: null,
      quota_exceeded: true,
      quota: quotaInfo
    });
    return;
  }

  let consistencyCheck = null;
  if (shouldRunConsistencyCheck(images, matches)) {
    consistencyCheck = await runConsistencyCheck(images).catch(() => null);
  } else {
    consistencyCheck = {
      likelyMixed: false,
      message: 'Photo consistency check skipped because the top match was already high-confidence and clearly ahead.',
      perPhoto: []
    };
  }

  let uploadId = null;
  if (auth?.user?.id) {
    try {
      uploadId = createUploadRecord({
        userId: auth.user.id,
        sessionId: auth.sessionId || null,
        images,
        imageMeta,
        photoRoles,
        matches,
        consistencyCheck
      });
    } catch {
      sendJson(req, res, 500, { error: 'Failed to persist upload record.' });
      return;
    }
  }

  const topMatch = matches[0];
  trackAndGeo('scan', auth?.user?.id || null, {
    imageCount: images.length,
    species: topMatch?.scientificName,
    confidence: topMatch?.score
  }, clientIp, req.headers['user-agent'] || null);

  sendJson(req, res, 200, { matches, uploadGuidance, consistencyCheck, uploadId, quota: quotaInfo });
}

function handleDesignTokens(req, res) {
  fs.readFile(TOKEN_FILE, 'utf8', (err, data) => {
    if (err) {
      sendJson(req, res, 500, { error: 'Unable to load design tokens.' });
      return;
    }

    try {
      const tokens = JSON.parse(data);
      sendJson(req, res, 200, tokens);
    } catch {
      sendJson(req, res, 500, { error: 'Invalid token format.' });
    }
  });
}

function resolvePublicPath(urlPathname) {
  const safePath = path.normalize(urlPathname).replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath || 'index.html');
  if (!filePath.startsWith(PUBLIC_DIR)) return null;
  return filePath;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', requestId);
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${url.pathname}`);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendJson(req, res, 200, {
      status: 'ok',
      service: 'amushroom',
      baseUrl: APP_BASE_URL,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime())
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/readyz') {
    const ready = Boolean(process.env.MUSHROOM_API_KEY);
    sendJson(req, res, ready ? 200 : 503, {
      status: ready ? 'ready' : 'not_ready',
      checks: {
        apiKeyConfigured: ready,
        databaseReady: true
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/config') {
    handleAuthConfig(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/quota') {
    const auth = getAuthContext(req);
    if (auth?.user) {
      const tier = auth.user.tier || 'free';
      if (tier === 'pro') {
        sendJson(req, res, 200, { tier: 'pro', used: 0, limit: null, resetsAt: null });
      } else {
        const q = checkUserQuota(auth.user.id);
        sendJson(req, res, 200, { tier, used: q.used, limit: q.limit, resetsAt: q.resetsAt });
      }
    } else {
      const q = checkAnonQuota(getClientIp(req));
      sendJson(req, res, 200, { tier: 'anonymous', used: q.used, limit: q.limit, resetsAt: null });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    handleAuthMe(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    if (!requireSameOrigin(req, res)) return;
    if (
      AUTH_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        authRateLimitStore,
        AUTH_RATE_LIMIT_WINDOW_MS,
        AUTH_RATE_LIMIT_MAX,
        'Too many authentication attempts. Please try again later.'
      )
    ) {
      return;
    }
    await handleAuthRegister(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    if (!requireSameOrigin(req, res)) return;
    if (
      AUTH_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        authRateLimitStore,
        AUTH_RATE_LIMIT_WINDOW_MS,
        AUTH_RATE_LIMIT_MAX,
        'Too many authentication attempts. Please try again later.'
      )
    ) {
      return;
    }
    await handleAuthLogin(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    if (!requireSameOrigin(req, res)) return;
    handleAuthLogout(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    if (!requireSameOrigin(req, res)) return;
    if (
      AUTH_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        authRateLimitStore,
        AUTH_RATE_LIMIT_WINDOW_MS,
        AUTH_RATE_LIMIT_MAX,
        'Too many requests. Please try again later.'
      )
    ) {
      return;
    }
    await handleForgotPassword(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    if (!requireSameOrigin(req, res)) return;
    if (
      AUTH_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        authRateLimitStore,
        AUTH_RATE_LIMIT_WINDOW_MS,
        AUTH_RATE_LIMIT_MAX,
        'Too many requests. Please try again later.'
      )
    ) {
      return;
    }
    await handleResetPassword(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/google') {
    if (
      AUTH_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        authRateLimitStore,
        AUTH_RATE_LIMIT_WINDOW_MS,
        AUTH_RATE_LIMIT_MAX,
        'Too many authentication attempts. Please try again later.'
      )
    ) {
      return;
    }
    handleGoogleStart(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/google/callback') {
    await handleGoogleCallback(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/user/uploads') {
    handleUserUploads(req, res, url);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/user/uploads/')) {
    handleUserUploadDetail(req, res, url);
    return;
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/user/uploads/') && url.pathname.endsWith('/story')) {
    if (!requireSameOrigin(req, res)) return;
    const auth = getAuthContext(req);
    if (!auth?.user) { jsonError(req, res, 401, 'Not authenticated.'); return; }
    const uploadId = decodeURIComponent(url.pathname.slice('/api/user/uploads/'.length, -'/story'.length)).trim();
    let body;
    try { body = await parseBody(req, 4 * 1024); } catch { jsonError(req, res, 400, 'Bad request.'); return; }
    const story = typeof body.story === 'string' ? body.story.slice(0, 500) : null;
    updateUploadStory({ uploadId, userId: auth.user.id, story });
    sendJson(req, res, 200, { ok: true });
    return;
  }

  // Feedback submission
  if (req.method === 'POST' && url.pathname === '/api/feedback') {
    let body;
    try { body = await parseBody(req, 8 * 1024); } catch { jsonError(req, res, 400, 'Bad request.'); return; }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message) { jsonError(req, res, 400, 'Message is required.'); return; }
    const auth = getAuthContext(req);
    const alsoEmail = body.alsoEmail === true;
    const ip = getClientIp(req);
    insertFeedback({
      userId: auth?.user?.id || null,
      email: auth?.user?.email || (typeof body.email === 'string' ? body.email.slice(0, 200) : null),
      name: auth?.user?.name || null,
      message,
      alsoEmail,
      ip,
    });
    // Notify admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    if (adminEmails[0]) {
      sendFeedbackNotification(adminEmails[0], {
        name: auth?.user?.name || null,
        email: auth?.user?.email || body.email || null,
        message,
        ip,
      });
    }
    sendJson(req, res, 200, { ok: true });
    return;
  }

  // Public cover image endpoint — used by Instagram pipeline for public image URL
  if (req.method === 'GET' && url.pathname.startsWith('/api/uploads/') && url.pathname.endsWith('/cover-image')) {
    const batchId = decodeURIComponent(url.pathname.slice('/api/uploads/'.length, -'/cover-image'.length)).trim();
    const row = getCoverImageBlob(batchId);
    if (!row) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': row.mime_type || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' });
    res.end(row.image_blob);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/identify') {
    if (!requireSameOrigin(req, res)) return;
    if (
      IDENTIFY_RATE_LIMIT_ENABLED &&
      !enforceRouteRateLimit(
        req,
        res,
        identifyRateLimitStore,
        RATE_LIMIT_WINDOW_MS,
        RATE_LIMIT_MAX,
        'Too many requests. Please wait and try again.'
      )
    ) {
      return;
    }

    await handleIdentify(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/design-tokens') {
    handleDesignTokens(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/track') {
    let body;
    try {
      body = await parseBody(req, 64 * 1024);
    } catch {
      sendJson(req, res, 400, { error: 'Bad request' });
      return;
    }
    const auth = getAuthContext(req);
    const event = String(body.event || '').slice(0, 50);
    if (event) {
      trackAndGeo(event, auth?.user?.id || null, body.metadata || null, getClientIp(req), req.headers['user-agent'] || null);
    }
    sendJson(req, res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/admin/')) {
    const auth = getAuthContext(req);
    if (!auth?.user || !isAdmin(auth.user)) {
      jsonError(req, res, 403, 'Admin access required.');
      return;
    }
    const route = url.pathname.slice('/api/admin/'.length);
    const days = Number(url.searchParams.get('days') || 30);
    if (route === 'summary') {
      sendJson(req, res, 200, getAnalyticsSummary());
    } else if (route === 'events') {
      sendJson(req, res, 200, { events: getRecentEvents(Number(url.searchParams.get('limit') || 50)) });
    } else if (route === 'scans-by-day') {
      sendJson(req, res, 200, { data: getScansByDay(days) });
    } else if (route === 'signups-by-day') {
      sendJson(req, res, 200, { data: getSignupsByDay(days) });
    } else if (route === 'species') {
      sendJson(req, res, 200, { data: getTopSpecies(days) });
    } else if (route === 'geo') {
      sendJson(req, res, 200, { data: getGeoBreakdown(days) });
    } else if (route === 'page-views-by-day') {
      sendJson(req, res, 200, { data: getPageViewsByDay(days) });
    } else if (route === 'funnel') {
      sendJson(req, res, 200, getEventFunnel(days));
    } else if (route === 'feedback') {
      sendJson(req, res, 200, { feedback: listFeedback(200) });
    } else if (route === 'instagram-post') {
      // POST /api/admin/instagram-post — trigger one Instagram post
      const pageToken = process.env.IG_PAGE_TOKEN;
      const igAccountId = process.env.IG_ACCOUNT_ID;
      if (!pageToken || !igAccountId) {
        sendJson(req, res, 503, { ok: false, error: 'IG_PAGE_TOKEN or IG_ACCOUNT_ID not configured on server.' });
        return;
      }
      try {
        const result = await runOnePost({ pageToken, igAccountId });
        if (!result) {
          sendJson(req, res, 200, { ok: true, posted: false, message: 'No eligible candidates to post.' });
        } else {
          sendJson(req, res, 200, { ok: true, posted: true, ...result });
        }
      } catch (err) {
        sendJson(req, res, 500, { ok: false, error: err.message });
      }
    } else if (route === 'instagram-posts') {
      // GET /api/admin/instagram-posts — list recent posts
      sendJson(req, res, 200, { posts: listPosted(50) });
    } else if (route === 'test-email') {
      const to = auth.user.email;
      try {
        const id = await sendTestEmail(to);
        sendJson(req, res, 200, { ok: true, to, id });
      } catch (err) {
        sendJson(req, res, 500, { ok: false, error: err.message });
      }
    } else if (route === 'users') {
      sendJson(req, res, 200, { users: listAllUsers(Number(url.searchParams.get('limit') || 100)) });
    } else if (route === 'visitors') {
      const visitors = getVisitorBreakdown(days);
      const total = visitors.reduce((s, v) => s + v.hits, 0);
      const bots = visitors.filter(v => v.type === 'bot');
      const browsers = visitors.filter(v => v.type === 'browser');
      const unknown = visitors.filter(v => v.type === 'unknown' || v.type === 'other');
      sendJson(req, res, 200, {
        summary: {
          totalHits: total,
          botHits: bots.reduce((s, v) => s + v.hits, 0),
          browserHits: browsers.reduce((s, v) => s + v.hits, 0),
          unknownHits: unknown.reduce((s, v) => s + v.hits, 0),
          uniqueIPs: visitors.length
        },
        visitors
      });
    } else {
      jsonError(req, res, 404, 'Unknown admin endpoint.');
    }
    return;
  }

    // Dev fallback: serve old public/ files
  if (req.method === 'GET') {
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = resolvePublicPath(pathname);
    if (!filePath) {
      sendJson(req, res, 403, { error: 'Forbidden' });
      return;
    }

    serveFile(req, res, filePath);
    return;
  }

  sendJson(req, res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Orangutany running at http://${HOST}:${PORT}`);
});
