const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'data', 'amushroom.db');

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDirectory(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT,
  password_salt TEXT,
  google_sub TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS upload_batches (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  session_id TEXT,
  created_at TEXT NOT NULL,
  image_count INTEGER NOT NULL,
  primary_match TEXT,
  primary_confidence INTEGER,
  mixed_species INTEGER NOT NULL DEFAULT 0,
  consistency_message TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS upload_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  role TEXT,
  filename TEXT,
  mime_type TEXT,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  image_blob BLOB NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES upload_batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS identification_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  scientific_name TEXT,
  common_name TEXT,
  confidence INTEGER,
  edibility TEXT,
  psychedelic TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES upload_batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  user_id INTEGER,
  metadata TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_quotas (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  first_scan_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_upload_batches_user_id ON upload_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_images_batch_id ON upload_images(batch_id);
CREATE INDEX IF NOT EXISTS idx_identification_matches_batch_id ON identification_matches(batch_id);
`);

const ANON_SCAN_LIMIT = Number(process.env.ANON_SCAN_LIMIT || 5);
const FREE_SCAN_LIMIT = Number(process.env.FREE_SCAN_LIMIT || 5);

// Safe migrations — silently ignore if columns already exist
try { db.exec('ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT \'free\''); } catch { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN scans_today INTEGER NOT NULL DEFAULT 0'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE users ADD COLUMN scans_today_date TEXT NOT NULL DEFAULT \'\''); } catch { /* column exists */ }
try { db.exec('ALTER TABLE analytics_events ADD COLUMN user_agent TEXT'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE upload_batches ADD COLUMN user_story TEXT'); } catch { /* column exists */ }

const stmts = {
  createUser: db.prepare(`
    INSERT INTO users (email, name, password_hash, password_salt, google_sub, email_verified, created_at, updated_at)
    VALUES (@email, @name, @password_hash, @password_salt, @google_sub, @email_verified, @created_at, @updated_at)
  `),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserByGoogleSub: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
  findUserById: db.prepare('SELECT id, email, name, email_verified, tier, scans_today, scans_today_date, created_at, updated_at FROM users WHERE id = ?'),
  attachGoogleToUser: db.prepare(`
    UPDATE users SET google_sub = @google_sub, email_verified = @email_verified, updated_at = @updated_at WHERE id = @id
  `),
  updateUserName: db.prepare('UPDATE users SET name = @name, updated_at = @updated_at WHERE id = @id'),

  createSession: db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, ip, user_agent)
    VALUES (@id, @user_id, @created_at, @expires_at, @last_seen_at, @ip, @user_agent)
  `),
  findSessionWithUser: db.prepare(`
    SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      s.last_seen_at,
      u.id,
      u.email,
      u.name,
      u.email_verified,
      u.tier,
      u.scans_today,
      u.scans_today_date,
      u.created_at,
      u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `),
  deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  touchSession: db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?'),
  deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),

  createUploadBatch: db.prepare(`
    INSERT INTO upload_batches (
      id, user_id, session_id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message
    ) VALUES (
      @id, @user_id, @session_id, @created_at, @image_count, @primary_match, @primary_confidence, @mixed_species, @consistency_message
    )
  `),
  createUploadImage: db.prepare(`
    INSERT INTO upload_images (batch_id, role, filename, mime_type, bytes, sha256, image_blob, created_at)
    VALUES (@batch_id, @role, @filename, @mime_type, @bytes, @sha256, @image_blob, @created_at)
  `),
  createMatch: db.prepare(`
    INSERT INTO identification_matches (
      batch_id, rank, scientific_name, common_name, confidence, edibility, psychedelic, raw_json, created_at
    ) VALUES (
      @batch_id, @rank, @scientific_name, @common_name, @confidence, @edibility, @psychedelic, @raw_json, @created_at
    )
  `),

  listUserBatches: db.prepare(`
    SELECT id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message, user_story
    FROM upload_batches
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `),
  listBatchMatches: db.prepare(`
    SELECT rank, scientific_name, common_name, confidence
    FROM identification_matches
    WHERE batch_id = ?
    ORDER BY rank ASC
  `),
  getUserBatchById: db.prepare(`
    SELECT id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message, user_story
    FROM upload_batches
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `),
  listBatchImagesPreview: db.prepare(`
    SELECT id, role, filename, mime_type, image_blob
    FROM upload_images
    WHERE batch_id = ?
    ORDER BY id ASC
    LIMIT ?
  `),
  listBatchImagesDetailed: db.prepare(`
    SELECT id, role, filename, mime_type, bytes, image_blob, created_at
    FROM upload_images
    WHERE batch_id = ?
    ORDER BY id ASC
  `),
  listBatchMatchesDetailed: db.prepare(`
    SELECT rank, scientific_name, common_name, confidence, edibility, psychedelic, raw_json
    FROM identification_matches
    WHERE batch_id = ?
    ORDER BY rank ASC
  `),

  insertAnalyticsEvent: db.prepare(`
    INSERT INTO analytics_events (event, user_id, metadata, ip, country, city, user_agent, created_at)
    VALUES (@event, @user_id, @metadata, @ip, @country, @city, @user_agent, @created_at)
  `),
  updateEventGeo: db.prepare(`
    UPDATE analytics_events SET country = @country, city = @city WHERE id = @id
  `),
  analyticsSummary: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) AS totalUsers,
      (SELECT COUNT(*) FROM upload_batches) AS totalScans,
      (SELECT COUNT(*) FROM upload_batches WHERE created_at >= date('now', '-1 day')) AS scansToday,
      (SELECT COUNT(DISTINCT ip) FROM analytics_events WHERE created_at >= date('now', '-7 days')) AS uniqueVisitors7d
  `),
  recentEvents: db.prepare(`
    SELECT e.id, e.event, e.user_id, u.name AS user_name, u.email AS user_email, e.metadata, e.ip, e.country, e.city, e.user_agent, e.created_at
    FROM analytics_events e
    LEFT JOIN users u ON u.id = e.user_id
    ORDER BY e.created_at DESC LIMIT ?
  `),
  visitorBreakdown: db.prepare(`
    SELECT ip, user_agent, country, city,
      COUNT(*) AS hits,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      SUM(CASE WHEN event = 'scan' THEN 1 ELSE 0 END) AS scans
    FROM analytics_events
    WHERE created_at >= date('now', @days || ' days')
    GROUP BY ip, user_agent
    ORDER BY hits DESC
    LIMIT 200
  `),
  scansByDay: db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM upload_batches
    WHERE created_at >= date('now', ? || ' days')
    GROUP BY day ORDER BY day
  `),
  signupsByDay: db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM users
    WHERE created_at >= date('now', ? || ' days')
    GROUP BY day ORDER BY day
  `),
  topSpecies: db.prepare(`
    SELECT primary_match AS species, COUNT(*) AS count
    FROM upload_batches
    WHERE primary_match IS NOT NULL AND created_at >= date('now', ? || ' days')
    GROUP BY primary_match ORDER BY count DESC LIMIT 10
  `),
  pageViewsByDay: db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM analytics_events
    WHERE event = 'page_view' AND created_at >= date('now', ? || ' days')
    GROUP BY day ORDER BY day
  `),
  eventFunnel: db.prepare(`
    SELECT event, COUNT(*) AS count
    FROM analytics_events
    WHERE event IN ('page_view','signup','login','scan')
      AND created_at >= date('now', ? || ' days')
    GROUP BY event
  `),
  geoBreakdown: db.prepare(`
    SELECT country, city, COUNT(*) AS count
    FROM analytics_events
    WHERE country IS NOT NULL AND created_at >= date('now', ? || ' days')
    GROUP BY country, city ORDER BY count DESC LIMIT 50
  `),
  createResetToken: db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
    VALUES (@user_id, @token, @expires_at, @created_at)
  `),
  findValidResetToken: db.prepare(`
    SELECT rt.*, u.email, u.name FROM password_reset_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > ?
  `),
  markResetTokenUsed: db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?'),
  updateUserPassword: db.prepare(`
    UPDATE users SET password_hash = @password_hash, password_salt = @password_salt, updated_at = @updated_at WHERE id = @id
  `),
  deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpiredResetTokens: db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < ? OR used = 1'),

  getAnonQuota: db.prepare('SELECT count FROM scan_quotas WHERE ip = ?'),
  upsertAnonQuota: db.prepare(`
    INSERT INTO scan_quotas (ip, count, first_scan_at) VALUES (@ip, 1, @now)
    ON CONFLICT(ip) DO UPDATE SET count = count + 1
  `),
  getUserQuota: db.prepare('SELECT scans_today, scans_today_date FROM users WHERE id = ?'),
  incrementUserScans: db.prepare('UPDATE users SET scans_today = scans_today + 1, scans_today_date = @date WHERE id = @id'),
  resetUserScans: db.prepare('UPDATE users SET scans_today = 1, scans_today_date = @date WHERE id = @id'),
  cleanOldAnonQuotas: db.prepare('DELETE FROM scan_quotas WHERE first_scan_at < ?'),

  updateUploadStory: db.prepare('UPDATE upload_batches SET user_story = @story WHERE id = @id AND user_id = @userId'),

  countUsers: db.prepare('SELECT COUNT(*) AS count FROM users'),
  listAllUsers: db.prepare(`
    SELECT id, email, name, email_verified, tier, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ?
  `)
};

function nowIso() {
  return new Date().toISOString();
}

function createUser({ email, name, passwordHash, passwordSalt, googleSub, emailVerified }) {
  const now = nowIso();
  const result = stmts.createUser.run({
    email,
    name: name || null,
    password_hash: passwordHash || null,
    password_salt: passwordSalt || null,
    google_sub: googleSub || null,
    email_verified: emailVerified ? 1 : 0,
    created_at: now,
    updated_at: now
  });

  return getPublicUser(result.lastInsertRowid);
}

function getPublicUser(id) {
  const user = stmts.findUserById.get(id);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

function findUserAuthByEmail(email) {
  return stmts.findUserByEmail.get(email) || null;
}

function findUserAuthByGoogleSub(sub) {
  return stmts.findUserByGoogleSub.get(sub) || null;
}

function attachGoogleIdentity({ userId, googleSub, emailVerified }) {
  stmts.attachGoogleToUser.run({
    id: userId,
    google_sub: googleSub,
    email_verified: emailVerified ? 1 : 0,
    updated_at: nowIso()
  });
  return getPublicUser(userId);
}

function updateUserName({ userId, name }) {
  stmts.updateUserName.run({ id: userId, name: name || '', updated_at: nowIso() });
}

function createSession({ sessionId, userId, expiresAt, ip, userAgent }) {
  const now = nowIso();
  stmts.createSession.run({
    id: sessionId,
    user_id: userId,
    created_at: now,
    expires_at: expiresAt,
    last_seen_at: now,
    ip: ip || null,
    user_agent: userAgent || null
  });
}

function getSessionWithUser(sessionId) {
  return stmts.findSessionWithUser.get(sessionId) || null;
}

function touchSession(sessionId) {
  stmts.touchSession.run(nowIso(), sessionId);
}

function deleteSession(sessionId) {
  stmts.deleteSession.run(sessionId);
}

function deleteExpiredSessions() {
  stmts.deleteExpiredSessions.run(nowIso());
}

function createUploadRecord({ userId, sessionId, images, imageMeta, photoRoles, matches, consistencyCheck }) {
  const batchId = crypto.randomUUID();
  const now = nowIso();
  const top = matches[0] || null;

  const insert = db.transaction(() => {
    stmts.createUploadBatch.run({
      id: batchId,
      user_id: userId || null,
      session_id: sessionId || null,
      created_at: now,
      image_count: images.length,
      primary_match: top?.scientificName || null,
      primary_confidence: Number.isFinite(Number(top?.score)) ? Number(top.score) : null,
      mixed_species: consistencyCheck?.likelyMixed ? 1 : 0,
      consistency_message: consistencyCheck?.message || null
    });

    for (let i = 0; i < images.length; i += 1) {
      const b64 = images[i];
      const buffer = Buffer.from(String(b64 || ''), 'base64');
      const meta = Array.isArray(imageMeta) ? imageMeta[i] || {} : {};
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      stmts.createUploadImage.run({
        batch_id: batchId,
        role: Array.isArray(photoRoles) ? photoRoles[i] || null : null,
        filename: typeof meta.filename === 'string' ? meta.filename : null,
        mime_type: typeof meta.mimeType === 'string' ? meta.mimeType : null,
        bytes: buffer.length,
        sha256,
        image_blob: buffer,
        created_at: now
      });
    }

    matches.slice(0, 3).forEach((match, index) => {
      stmts.createMatch.run({
        batch_id: batchId,
        rank: index + 1,
        scientific_name: match.scientificName || null,
        common_name: match.commonName || null,
        confidence: Number.isFinite(Number(match.score)) ? Number(match.score) : null,
        edibility: match.edible || null,
        psychedelic: match.psychedelic || null,
        raw_json: JSON.stringify(match || {}),
        created_at: now
      });
    });
  });

  insert();
  return batchId;
}

function listUserUploads(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const batches = stmts.listUserBatches.all(userId, safeLimit);

  return batches.map((batch) => {
    const previews = stmts.listBatchImagesPreview.all(batch.id, 4);
    const previewImages = previews.map((row) => ({
      id: row.id,
      role: row.role || 'extra',
      filename: row.filename || '',
      mimeType: row.mime_type || 'image/jpeg',
      previewUrl: `data:${row.mime_type || 'image/jpeg'};base64,${Buffer.from(row.image_blob).toString('base64')}`
    }));
    const cover = previewImages[0] || null;

    return {
      id: batch.id,
      createdAt: batch.created_at,
      imageCount: batch.image_count,
      primaryMatch: batch.primary_match,
      primaryConfidence: batch.primary_confidence,
      mixedSpecies: Boolean(batch.mixed_species),
      consistencyMessage: batch.consistency_message,
      userStory: batch.user_story || null,
      coverImageUrl: cover?.previewUrl || '',
      coverFileName: cover?.filename || '',
      previewImages,
      topMatches: stmts.listBatchMatches.all(batch.id).map((m) => ({
        rank: m.rank,
        scientificName: m.scientific_name,
        commonName: m.common_name,
        confidence: m.confidence
      }))
    };
  });
}

function getUserUploadDetail(userId, uploadId) {
  const batch = stmts.getUserBatchById.get(uploadId, userId);
  if (!batch) return null;

  const images = stmts.listBatchImagesDetailed.all(uploadId).map((row) => ({
    id: row.id,
    role: row.role || 'extra',
    filename: row.filename || '',
    mimeType: row.mime_type || 'image/jpeg',
    bytes: row.bytes,
    createdAt: row.created_at,
    previewUrl: `data:${row.mime_type || 'image/jpeg'};base64,${Buffer.from(row.image_blob).toString('base64')}`
  }));

  const matches = stmts.listBatchMatchesDetailed.all(uploadId).map((row) => {
    let parsed = null;
    try {
      parsed = row.raw_json ? JSON.parse(row.raw_json) : null;
    } catch {
      parsed = null;
    }

    if (parsed && typeof parsed === 'object') return parsed;

    return {
      scientificName: row.scientific_name || 'Unknown species',
      commonName: row.common_name || row.scientific_name || 'Unknown species',
      score: row.confidence ?? 0,
      edible: row.edibility || 'Unknown',
      psychedelic: row.psychedelic || 'Unknown',
      traits: [],
      whyMatch: [],
      caution: 'Do not consume without local expert verification.'
    };
  });

  return {
    id: batch.id,
    createdAt: batch.created_at,
    imageCount: batch.image_count,
    primaryMatch: batch.primary_match,
    primaryConfidence: batch.primary_confidence,
    mixedSpecies: Boolean(batch.mixed_species),
    consistencyMessage: batch.consistency_message,
    userStory: batch.user_story || null,
    images,
    matches
  };
}

function trackEvent({ event, userId, metadata, ip, userAgent }) {
  const now = nowIso();
  const result = stmts.insertAnalyticsEvent.run({
    event,
    user_id: userId || null,
    metadata: metadata ? JSON.stringify(metadata) : null,
    ip: ip || null,
    country: null,
    city: null,
    user_agent: userAgent || null,
    created_at: now
  });
  return result.lastInsertRowid;
}

function updateEventGeo(id, country, city) {
  stmts.updateEventGeo.run({ id, country: country || null, city: city || null });
}

function getAnalyticsSummary() {
  return stmts.analyticsSummary.get();
}

function getRecentEvents(limit = 50) {
  return stmts.recentEvents.all(Math.min(limit, 200));
}

function getScansByDay(days = 30) {
  return stmts.scansByDay.all(String(-Math.abs(days)));
}

function getSignupsByDay(days = 30) {
  return stmts.signupsByDay.all(String(-Math.abs(days)));
}

function getTopSpecies(days = 30) {
  return stmts.topSpecies.all(String(-Math.abs(days)));
}

function getPageViewsByDay(days = 30) {
  return stmts.pageViewsByDay.all(String(-Math.abs(days)));
}

function getEventFunnel(days = 30) {
  const rows = stmts.eventFunnel.all(String(-Math.abs(days)));
  const map = Object.fromEntries(rows.map(r => [r.event, r.count]));
  return {
    pageViews: map.page_view || 0,
    signups: map.signup || 0,
    logins: map.login || 0,
    scans: map.scan || 0,
  };
}

function getGeoBreakdown(days = 30) {
  return stmts.geoBreakdown.all(String(-Math.abs(days)));
}

const BOT_PATTERNS = [
  /bot\b/i, /crawl/i, /spider/i, /slurp/i, /scraper/i,
  /googlebot/i, /bingbot/i, /yandexbot/i, /duckduckbot/i, /baiduspider/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /applebot/i, /semrushbot/i, /ahrefsbot/i, /dotbot/i, /mj12bot/i,
  /bytespider/i, /petalbot/i, /dataprovider/i, /gptbot/i, /claude-web/i,
  /anthropic-ai/i, /ccbot/i, /python-requests/i, /go-http-client/i,
  /curl\//i, /wget\//i, /axios\//i, /node-fetch/i, /java\//i,
  /okhttp/i, /libwww/i, /scrapy/i, /httpclient/i
];

function classifyUA(ua) {
  if (!ua) return 'unknown';
  for (const pat of BOT_PATTERNS) {
    if (pat.test(ua)) return 'bot';
  }
  if (/Chrome|Firefox|Safari|Edge|Opera|OPR/i.test(ua)) return 'browser';
  return 'other';
}

function getVisitorBreakdown(days = 30) {
  const rows = stmts.visitorBreakdown.all({ days: String(-Math.abs(days)) });
  return rows.map(r => ({
    ip: r.ip,
    userAgent: r.user_agent,
    country: r.country,
    city: r.city,
    hits: r.hits,
    scans: r.scans,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    type: classifyUA(r.user_agent)
  }));
}

function listAllUsers(limit = 100) {
  return stmts.listAllUsers.all(Math.min(limit, 500));
}

function createPasswordResetToken({ userId, token, expiresAt }) {
  stmts.createResetToken.run({
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: nowIso()
  });
}

function findValidResetToken(token) {
  return stmts.findValidResetToken.get(token, nowIso()) || null;
}

function markResetTokenUsed(id) {
  stmts.markResetTokenUsed.run(id);
}

function updateUserPassword({ userId, passwordHash, passwordSalt }) {
  stmts.updateUserPassword.run({
    id: userId,
    password_hash: passwordHash,
    password_salt: passwordSalt,
    updated_at: nowIso()
  });
}

function deleteUserSessions(userId) {
  stmts.deleteUserSessions.run(userId);
}

function deleteExpiredResetTokens() {
  stmts.deleteExpiredResetTokens.run(nowIso());
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function checkAnonQuota(ip) {
  const row = stmts.getAnonQuota.get(ip);
  const used = row ? row.count : 0;
  return { used, limit: ANON_SCAN_LIMIT, exceeded: used >= ANON_SCAN_LIMIT };
}

function recordAnonScan(ip) {
  stmts.upsertAnonQuota.run({ ip, now: nowIso() });
}

function checkUserQuota(userId) {
  const row = stmts.getUserQuota.get(userId);
  if (!row) return { used: 0, limit: FREE_SCAN_LIMIT, exceeded: false, resetsAt: null };
  const today = todayDateStr();
  const used = row.scans_today_date === today ? row.scans_today : 0;
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return { used, limit: FREE_SCAN_LIMIT, exceeded: used >= FREE_SCAN_LIMIT, resetsAt: tomorrow.toISOString() };
}

function recordUserScan(userId) {
  const today = todayDateStr();
  const row = stmts.getUserQuota.get(userId);
  if (row && row.scans_today_date === today) {
    stmts.incrementUserScans.run({ id: userId, date: today });
  } else {
    stmts.resetUserScans.run({ id: userId, date: today });
  }
}

function updateUploadStory({ uploadId, userId, story }) {
  stmts.updateUploadStory.run({ id: uploadId, userId, story: story || null });
}

function cleanExpiredAnonQuotas() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  stmts.cleanOldAnonQuotas.run(cutoff);
}

function getCoverImageBlob(batchId) {
  return db.prepare(`
    SELECT image_blob, mime_type FROM upload_images
    WHERE batch_id = ? ORDER BY id ASC LIMIT 1
  `).get(batchId) || null;
}

module.exports = {
  db,
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
  listAllUsers,
  createPasswordResetToken,
  findValidResetToken,
  markResetTokenUsed,
  updateUserPassword,
  deleteUserSessions,
  deleteExpiredResetTokens,
  updateUploadStory,
  checkAnonQuota,
  recordAnonScan,
  checkUserQuota,
  recordUserScan,
  cleanExpiredAnonQuotas,
  getCoverImageBlob,
  ANON_SCAN_LIMIT,
  FREE_SCAN_LIMIT
};
