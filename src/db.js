const crypto = require('node:crypto');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'file:data/amushroom.db';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

const ANON_SCAN_LIMIT = Number(process.env.ANON_SCAN_LIMIT || 3);
const FREE_SCAN_LIMIT = Number(process.env.FREE_SCAN_LIMIT || 5);
const PRO_SCAN_DAILY_LIMIT = Number(process.env.PRO_SCAN_DAILY_LIMIT || 50);
const HOURLY_SCAN_LIMIT = Number(process.env.HOURLY_SCAN_LIMIT || 15);
const IP_DAILY_SCAN_LIMIT = Number(process.env.IP_DAILY_SCAN_LIMIT || 60);
const ABUSE_FLAG_THRESHOLD = Number(process.env.ABUSE_FLAG_THRESHOLD || 30);

// Schema + migration — run once at startup
const dbReady = (async () => {
  const isFile = TURSO_URL.startsWith('file:');
  if (isFile) {
    await client.execute('PRAGMA journal_mode=WAL');
    await client.execute('PRAGMA foreign_keys=ON');
  }

  // Create tables
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT,
    password_salt TEXT,
    google_sub TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS upload_batches (
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
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS upload_images (
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
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS identification_matches (
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
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    user_id INTEGER,
    metadata TEXT,
    ip TEXT,
    country TEXT,
    city TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS scan_quotas (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    first_scan_at TEXT NOT NULL
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    name TEXT,
    message TEXT NOT NULL,
    also_email INTEGER NOT NULL DEFAULT 0,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stripe_subscription_id TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS abuse_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip TEXT,
    reason TEXT NOT NULL,
    metadata TEXT,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolved_by INTEGER,
    notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS scan_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_scan_log_user_created ON scan_log(user_id, created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_scan_log_ip_created ON scan_log(ip, created_at)`);

  // Immutable audit log — NEVER DELETE records. 3-year retention minimum.
  // Tracks: signups, tier changes, payments, subscription cancellations
  await client.execute(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    user_id INTEGER,
    user_email TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type)`);

  await client.execute(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    country TEXT,
    subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
    unsubscribed_at TEXT
  )`);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_upload_batches_user_id ON upload_batches(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_upload_images_batch_id ON upload_images(batch_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_identification_matches_batch_id ON identification_matches(batch_id)`);

  // Safe migrations
  const migrations = [
    "ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN scans_today INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN scans_today_date TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE analytics_events ADD COLUMN user_agent TEXT",
    "ALTER TABLE upload_batches ADD COLUMN user_story TEXT",
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
    "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
    "ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN membership_started_at TEXT",
    "ALTER TABLE users ADD COLUMN membership_expires_at TEXT",
    "ALTER TABLE analytics_events ADD COLUMN lat REAL",
    "ALTER TABLE analytics_events ADD COLUMN lon REAL"
  ];
  for (const sql of migrations) {
    try { await client.execute(sql); } catch { /* column already exists */ }
  }
})();

function nowIso() {
  return new Date().toISOString();
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name || '',
    emailVerified: Boolean(row.email_verified),
    tier: row.tier || 'free',
    scans_today: Number(row.scans_today || 0),
    scans_today_date: row.scans_today_date || '',
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    suspended: Number(row.suspended || 0),
    membership_started_at: row.membership_started_at || null,
    membership_expires_at: row.membership_expires_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getPublicUser(id) {
  const result = await client.execute({
    sql: 'SELECT id, email, name, email_verified, tier, scans_today, scans_today_date, stripe_customer_id, stripe_subscription_id, membership_started_at, membership_expires_at, created_at, updated_at FROM users WHERE id = ?',
    args: [Number(id)]
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name || '',
    emailVerified: Boolean(row.email_verified),
    stripe_subscription_id: row.stripe_subscription_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createUser({ email, name, passwordHash, passwordSalt, googleSub, emailVerified }) {
  const now = nowIso();
  const result = await client.execute({
    sql: `INSERT INTO users (email, name, password_hash, password_salt, google_sub, email_verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [email, name || null, passwordHash || null, passwordSalt || null, googleSub || null, emailVerified ? 1 : 0, now, now]
  });
  return getPublicUser(Number(result.lastInsertRowid));
}

async function findUserAuthByEmail(email) {
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email]
  });
  return result.rows[0] ? { ...result.rows[0], id: Number(result.rows[0].id) } : null;
}

async function findUserAuthByGoogleSub(sub) {
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE google_sub = ?',
    args: [sub]
  });
  return result.rows[0] ? { ...result.rows[0], id: Number(result.rows[0].id) } : null;
}

async function attachGoogleIdentity({ userId, googleSub, emailVerified }) {
  await client.execute({
    sql: 'UPDATE users SET google_sub = ?, email_verified = ?, updated_at = ? WHERE id = ?',
    args: [googleSub, emailVerified ? 1 : 0, nowIso(), Number(userId)]
  });
  return getPublicUser(userId);
}

async function updateUserName({ userId, name }) {
  await client.execute({
    sql: 'UPDATE users SET name = ?, updated_at = ? WHERE id = ?',
    args: [name || '', nowIso(), Number(userId)]
  });
}

async function createSession({ sessionId, userId, expiresAt, ip, userAgent }) {
  const now = nowIso();
  await client.execute({
    sql: `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, ip, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [sessionId, Number(userId), now, expiresAt, now, ip || null, userAgent || null]
  });
}

async function getSessionWithUser(sessionId) {
  const result = await client.execute({
    sql: `SELECT
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
      u.stripe_customer_id,
      u.stripe_subscription_id,
      u.membership_started_at,
      u.membership_expires_at,
      u.created_at,
      u.updated_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?`,
    args: [sessionId]
  });
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return { ...row, user_id: Number(row.user_id), id: Number(row.id) };
}

async function touchSession(sessionId) {
  await client.execute({
    sql: 'UPDATE sessions SET last_seen_at = ? WHERE id = ?',
    args: [nowIso(), sessionId]
  });
}

async function deleteSession(sessionId) {
  await client.execute({
    sql: 'DELETE FROM sessions WHERE id = ?',
    args: [sessionId]
  });
}

async function deleteExpiredSessions() {
  await client.execute({
    sql: 'DELETE FROM sessions WHERE expires_at < ?',
    args: [nowIso()]
  });
}

async function createUploadRecord({ userId, sessionId, images, imageMeta, photoRoles, matches, consistencyCheck }) {
  const batchId = crypto.randomUUID();
  const now = nowIso();
  const top = matches[0] || null;

  const tx = await client.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO upload_batches (id, user_id, session_id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        batchId,
        userId ? Number(userId) : null,
        sessionId || null,
        now,
        images.length,
        top?.scientificName || null,
        Number.isFinite(Number(top?.score)) ? Number(top.score) : null,
        consistencyCheck?.likelyMixed ? 1 : 0,
        consistencyCheck?.message || null
      ]
    });

    for (let i = 0; i < images.length; i++) {
      const b64 = images[i];
      const buffer = Buffer.from(String(b64 || ''), 'base64');
      const meta = Array.isArray(imageMeta) ? imageMeta[i] || {} : {};
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      await tx.execute({
        sql: `INSERT INTO upload_images (batch_id, role, filename, mime_type, bytes, sha256, image_blob, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          batchId,
          Array.isArray(photoRoles) ? photoRoles[i] || null : null,
          typeof meta.filename === 'string' ? meta.filename : null,
          typeof meta.mimeType === 'string' ? meta.mimeType : null,
          buffer.length,
          sha256,
          buffer,
          now
        ]
      });
    }

    for (let index = 0; index < matches.slice(0, 3).length; index++) {
      const match = matches[index];
      await tx.execute({
        sql: `INSERT INTO identification_matches (batch_id, rank, scientific_name, common_name, confidence, edibility, psychedelic, raw_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          batchId,
          index + 1,
          match.scientificName || null,
          match.commonName || null,
          Number.isFinite(Number(match.score)) ? Number(match.score) : null,
          match.edible || null,
          match.psychedelic || null,
          JSON.stringify(match || {}),
          now
        ]
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  return batchId;
}

async function listUserUploads(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const batchResult = await client.execute({
    sql: `SELECT id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message, user_story
          FROM upload_batches WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    args: [Number(userId), safeLimit]
  });

  const uploads = [];
  for (const batch of batchResult.rows) {
    const previewResult = await client.execute({
      sql: 'SELECT id, role, filename, mime_type FROM upload_images WHERE batch_id = ? ORDER BY id ASC LIMIT 4',
      args: [batch.id]
    });

    const previewImages = previewResult.rows.map((row) => ({
      id: Number(row.id),
      role: row.role || 'extra',
      filename: row.filename || '',
      mimeType: row.mime_type || 'image/jpeg',
      previewUrl: `/api/uploads/${batch.id}/cover-image`
    }));
    const hasCover = previewImages.length > 0;

    const matchResult = await client.execute({
      sql: 'SELECT rank, scientific_name, common_name, confidence FROM identification_matches WHERE batch_id = ? ORDER BY rank ASC',
      args: [batch.id]
    });

    uploads.push({
      id: batch.id,
      createdAt: batch.created_at,
      imageCount: Number(batch.image_count),
      primaryMatch: batch.primary_match,
      primaryConfidence: batch.primary_confidence !== null ? Number(batch.primary_confidence) : null,
      mixedSpecies: Boolean(batch.mixed_species),
      consistencyMessage: batch.consistency_message,
      userStory: batch.user_story || null,
      coverImageUrl: hasCover ? `/api/uploads/${batch.id}/cover-image` : '',
      coverFileName: previewImages[0]?.filename || '',
      previewImages,
      topMatches: matchResult.rows.map((m) => ({
        rank: Number(m.rank),
        scientificName: m.scientific_name,
        commonName: m.common_name,
        confidence: m.confidence !== null ? Number(m.confidence) : null
      }))
    });
  }

  return uploads;
}

async function getUserUploadDetail(userId, uploadId) {
  const batchResult = await client.execute({
    sql: `SELECT id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message, user_story
          FROM upload_batches WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [uploadId, Number(userId)]
  });
  const batch = batchResult.rows[0];
  if (!batch) return null;

  const imgResult = await client.execute({
    sql: 'SELECT id, role, filename, mime_type, bytes, image_blob, created_at FROM upload_images WHERE batch_id = ? ORDER BY id ASC',
    args: [uploadId]
  });

  const images = imgResult.rows.map((row) => ({
    id: Number(row.id),
    role: row.role || 'extra',
    filename: row.filename || '',
    mimeType: row.mime_type || 'image/jpeg',
    bytes: Number(row.bytes),
    createdAt: row.created_at,
    previewUrl: `data:${row.mime_type || 'image/jpeg'};base64,${Buffer.from(row.image_blob).toString('base64')}`
  }));

  const matchResult = await client.execute({
    sql: 'SELECT rank, scientific_name, common_name, confidence, edibility, psychedelic, raw_json FROM identification_matches WHERE batch_id = ? ORDER BY rank ASC',
    args: [uploadId]
  });

  const matches = matchResult.rows.map((row) => {
    let parsed = null;
    try { parsed = row.raw_json ? JSON.parse(row.raw_json) : null; } catch { parsed = null; }
    if (parsed && typeof parsed === 'object') return parsed;
    return {
      scientificName: row.scientific_name || 'Unknown species',
      commonName: row.common_name || row.scientific_name || 'Unknown species',
      score: row.confidence !== null ? Number(row.confidence) : 0,
      edible: row.edibility || 'Edibility Unknown',
      psychedelic: row.psychedelic || 'Psychoactivity Unknown',
      traits: [],
      whyMatch: [],
      caution: 'Do not consume without local expert verification.'
    };
  });

  return {
    id: batch.id,
    createdAt: batch.created_at,
    imageCount: Number(batch.image_count),
    primaryMatch: batch.primary_match,
    primaryConfidence: batch.primary_confidence !== null ? Number(batch.primary_confidence) : null,
    mixedSpecies: Boolean(batch.mixed_species),
    consistencyMessage: batch.consistency_message,
    userStory: batch.user_story || null,
    images,
    matches
  };
}

async function trackEvent({ event, userId, metadata, ip, userAgent }) {
  const now = nowIso();
  const result = await client.execute({
    sql: `INSERT INTO analytics_events (event, user_id, metadata, ip, country, city, user_agent, created_at)
          VALUES (?, ?, ?, ?, null, null, ?, ?)`,
    args: [event, userId ? Number(userId) : null, metadata ? JSON.stringify(metadata) : null, ip || null, userAgent || null, now]
  });
  return Number(result.lastInsertRowid);
}

async function updateEventGeo(id, country, city, lat, lon) {
  await client.execute({
    sql: 'UPDATE analytics_events SET country = ?, city = ?, lat = ?, lon = ? WHERE id = ?',
    args: [country || null, city || null, lat || null, lon || null, Number(id)]
  });
}

async function getAnalyticsSummary() {
  const result = await client.execute(`
    SELECT
      (SELECT COUNT(*) FROM users) AS totalUsers,
      (SELECT COUNT(*) FROM upload_batches) AS totalScans,
      (SELECT COUNT(*) FROM upload_batches WHERE created_at >= date('now', '-1 day')) AS scansToday,
      (SELECT COUNT(DISTINCT ip) FROM analytics_events WHERE created_at >= date('now', '-7 days')) AS uniqueVisitors7d
  `);
  const row = result.rows[0];
  if (!row) return {};
  return {
    totalUsers: Number(row.totalUsers),
    totalScans: Number(row.totalScans),
    scansToday: Number(row.scansToday),
    uniqueVisitors7d: Number(row.uniqueVisitors7d)
  };
}

async function getRecentEvents(limit = 50) {
  const result = await client.execute({
    sql: `SELECT e.id, e.event, e.user_id, u.name AS user_name, u.email AS user_email, e.metadata, e.ip, e.country, e.city, e.user_agent, e.created_at
          FROM analytics_events e
          LEFT JOIN users u ON u.id = e.user_id
          ORDER BY e.created_at DESC LIMIT ?`,
    args: [Math.min(Number(limit), 200)]
  });
  return result.rows.map(r => ({ ...r, id: Number(r.id), user_id: r.user_id !== null ? Number(r.user_id) : null }));
}

async function getScansByDay(days = 30) {
  const result = await client.execute({
    sql: `SELECT date(created_at) AS day, COUNT(*) AS count FROM upload_batches
          WHERE created_at >= date('now', ? || ' days') GROUP BY day ORDER BY day`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({ day: r.day, count: Number(r.count) }));
}

async function getSignupsByDay(days = 30) {
  const result = await client.execute({
    sql: `SELECT date(created_at) AS day, COUNT(*) AS count FROM users
          WHERE created_at >= date('now', ? || ' days') GROUP BY day ORDER BY day`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({ day: r.day, count: Number(r.count) }));
}

async function getTopSpecies(days = 30) {
  const result = await client.execute({
    sql: `SELECT primary_match AS species, COUNT(*) AS count FROM upload_batches
          WHERE primary_match IS NOT NULL AND created_at >= date('now', ? || ' days')
          GROUP BY primary_match ORDER BY count DESC LIMIT 10`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({ species: r.species, count: Number(r.count) }));
}

async function getPageViewsByDay(days = 30) {
  const result = await client.execute({
    sql: `SELECT date(created_at) AS day, COUNT(*) AS count FROM analytics_events
          WHERE event = 'page_view' AND created_at >= date('now', ? || ' days')
          GROUP BY day ORDER BY day`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({ day: r.day, count: Number(r.count) }));
}

async function getEventFunnel(days = 30) {
  const result = await client.execute({
    sql: `SELECT event, COUNT(*) AS count FROM analytics_events
          WHERE event IN ('page_view','signup','login','scan')
            AND created_at >= date('now', ? || ' days')
          GROUP BY event`,
    args: [String(-Math.abs(days))]
  });
  const map = Object.fromEntries(result.rows.map(r => [r.event, Number(r.count)]));
  return {
    pageViews: map.page_view || 0,
    signups: map.signup || 0,
    logins: map.login || 0,
    scans: map.scan || 0
  };
}

async function getGeoBreakdown(days = 30) {
  const result = await client.execute({
    sql: `SELECT country, city, COUNT(*) AS count FROM analytics_events
          WHERE country IS NOT NULL AND created_at >= date('now', ? || ' days')
          GROUP BY country, city ORDER BY count DESC LIMIT 50`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({ country: r.country, city: r.city, count: Number(r.count) }));
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

async function getVisitorBreakdown(days = 30) {
  const result = await client.execute({
    sql: `SELECT ip, user_agent, country, city,
            COUNT(*) AS hits,
            MIN(created_at) AS first_seen,
            MAX(created_at) AS last_seen,
            SUM(CASE WHEN event = 'scan' THEN 1 ELSE 0 END) AS scans
          FROM analytics_events
          WHERE created_at >= date('now', ? || ' days')
          GROUP BY ip, user_agent
          ORDER BY hits DESC LIMIT 200`,
    args: [String(-Math.abs(days))]
  });
  return result.rows.map(r => ({
    ip: r.ip,
    userAgent: r.user_agent,
    country: r.country,
    city: r.city,
    hits: Number(r.hits),
    scans: Number(r.scans),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    type: classifyUA(r.user_agent)
  }));
}

async function listAllUsers(limit = 100) {
  const result = await client.execute({
    sql: 'SELECT id, email, name, email_verified, tier, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ?',
    args: [Math.min(Number(limit), 500)]
  });
  return result.rows.map(r => ({ ...r, id: Number(r.id) }));
}

async function getUserScanStats() {
  const result = await client.execute(`
    SELECT u.id, u.email, u.name, u.tier,
           COUNT(ub.id) AS total_scans,
           MAX(ub.created_at) AS last_scan_at,
           u.created_at AS signed_up_at,
           (SELECT ae.country FROM analytics_events ae WHERE ae.user_id = u.id AND ae.country IS NOT NULL ORDER BY ae.created_at DESC LIMIT 1) AS country
    FROM users u
    LEFT JOIN upload_batches ub ON ub.user_id = u.id
    GROUP BY u.id
    ORDER BY total_scans DESC
  `);
  return result.rows.map(r => ({
    id: Number(r.id),
    email: r.email,
    name: r.name || '',
    tier: r.tier || 'free',
    totalScans: Number(r.total_scans),
    lastScanAt: r.last_scan_at || null,
    signedUpAt: r.signed_up_at,
    country: r.country || null,
  }));
}

async function createPasswordResetToken({ userId, token, expiresAt }) {
  await client.execute({
    sql: `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
          VALUES (?, ?, ?, ?)`,
    args: [Number(userId), token, expiresAt, nowIso()]
  });
}

async function findValidResetToken(token) {
  const result = await client.execute({
    sql: `SELECT rt.*, u.email, u.name FROM password_reset_tokens rt
          JOIN users u ON u.id = rt.user_id
          WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > ?`,
    args: [token, nowIso()]
  });
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return { ...row, id: Number(row.id), user_id: Number(row.user_id) };
}

async function markResetTokenUsed(id) {
  await client.execute({
    sql: 'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
    args: [Number(id)]
  });
}

async function updateUserPassword({ userId, passwordHash, passwordSalt }) {
  await client.execute({
    sql: 'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
    args: [passwordHash, passwordSalt, nowIso(), Number(userId)]
  });
}

async function deleteUserSessions(userId) {
  await client.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ?',
    args: [Number(userId)]
  });
}

async function deleteExpiredResetTokens() {
  await client.execute({
    sql: 'DELETE FROM password_reset_tokens WHERE expires_at < ? OR used = 1',
    args: [nowIso()]
  });
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAnonQuota(ip) {
  const result = await client.execute({
    sql: 'SELECT count FROM scan_quotas WHERE ip = ?',
    args: [ip]
  });
  const used = result.rows[0] ? Number(result.rows[0].count) : 0;
  return { used, limit: ANON_SCAN_LIMIT, exceeded: used >= ANON_SCAN_LIMIT };
}

async function recordAnonScan(ip) {
  await client.execute({
    sql: `INSERT INTO scan_quotas (ip, count, first_scan_at) VALUES (?, 1, ?)
          ON CONFLICT(ip) DO UPDATE SET count = count + 1`,
    args: [ip, nowIso()]
  });
}

async function checkUserQuota(userId) {
  const result = await client.execute({
    sql: 'SELECT scans_today, scans_today_date, tier FROM users WHERE id = ?',
    args: [Number(userId)]
  });
  const row = result.rows[0];
  if (!row) return { used: 0, limit: FREE_SCAN_LIMIT, exceeded: false, resetsAt: null };
  const tier = row.tier || 'free';
  const isPro = tier === 'pro' || tier === 'pro_lifetime';
  const dailyLimit = isPro ? PRO_SCAN_DAILY_LIMIT : FREE_SCAN_LIMIT;
  const today = todayDateStr();
  const used = row.scans_today_date === today ? Number(row.scans_today) : 0;
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return { used, limit: dailyLimit, exceeded: used >= dailyLimit, resetsAt: tomorrow.toISOString() };
}

async function recordUserScan(userId) {
  const today = todayDateStr();
  const result = await client.execute({
    sql: 'SELECT scans_today, scans_today_date FROM users WHERE id = ?',
    args: [Number(userId)]
  });
  const row = result.rows[0];
  if (row && row.scans_today_date === today) {
    await client.execute({
      sql: 'UPDATE users SET scans_today = scans_today + 1, scans_today_date = ? WHERE id = ?',
      args: [today, Number(userId)]
    });
  } else {
    await client.execute({
      sql: 'UPDATE users SET scans_today = 1, scans_today_date = ? WHERE id = ?',
      args: [today, Number(userId)]
    });
  }
}

async function updateUploadStory({ uploadId, userId, story }) {
  await client.execute({
    sql: 'UPDATE upload_batches SET user_story = ? WHERE id = ? AND user_id = ?',
    args: [story || null, uploadId, Number(userId)]
  });
}

async function cleanExpiredAnonQuotas() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await client.execute({
    sql: 'DELETE FROM scan_quotas WHERE first_scan_at < ?',
    args: [cutoff]
  });
}

async function insertFeedback({ userId, email, name, message, alsoEmail, ip }) {
  await client.execute({
    sql: `INSERT INTO feedback (user_id, email, name, message, also_email, ip)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId ? Number(userId) : null, email || null, name || null, message, alsoEmail ? 1 : 0, ip || null]
  });
}

async function listFeedback(limit = 100) {
  const result = await client.execute({
    sql: `SELECT f.*, u.email as user_email, u.name as user_name
          FROM feedback f
          LEFT JOIN users u ON u.id = f.user_id
          ORDER BY f.created_at DESC LIMIT ?`,
    args: [Math.min(Number(limit), 500)]
  });
  return result.rows.map(r => ({ ...r, id: Number(r.id), user_id: r.user_id !== null ? Number(r.user_id) : null }));
}

async function getCoverImageBlob(batchId) {
  const result = await client.execute({
    sql: 'SELECT image_blob, mime_type FROM upload_images WHERE batch_id = ? ORDER BY id ASC LIMIT 1',
    args: [batchId]
  });
  return result.rows[0] || null;
}

// ─── Stripe / Payment ────────────────────────────────────────────────────────

async function setUserStripeCustomer(userId, stripeCustomerId) {
  await client.execute({
    sql: 'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
    args: [stripeCustomerId, Number(userId)]
  });
}

async function setUserSubscription(userId, stripeSubscriptionId, tier, expiresAt) {
  await client.execute({
    sql: 'UPDATE users SET stripe_subscription_id = ?, tier = ?, membership_started_at = COALESCE(membership_started_at, ?), membership_expires_at = ?, updated_at = ? WHERE id = ?',
    args: [stripeSubscriptionId, tier, nowIso(), expiresAt || null, nowIso(), Number(userId)]
  });
}

async function downgradeUser(userId) {
  await client.execute({
    sql: "UPDATE users SET tier = 'free', stripe_subscription_id = NULL, updated_at = ? WHERE id = ?",
    args: [nowIso(), Number(userId)]
  });
}

async function findUserByStripeCustomerId(stripeCustomerId) {
  const result = await client.execute({
    sql: 'SELECT * FROM users WHERE stripe_customer_id = ?',
    args: [stripeCustomerId]
  });
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

async function createPaymentRecord({ userId, stripeSubscriptionId, amountCents, currency, status }) {
  await client.execute({
    sql: 'INSERT INTO payments (user_id, stripe_subscription_id, amount_cents, currency, status) VALUES (?, ?, ?, ?, ?)',
    args: [Number(userId), stripeSubscriptionId || null, amountCents, currency || 'usd', status]
  });
}

async function getRevenueStats() {
  const subs = await client.execute("SELECT COUNT(*) as count FROM users WHERE tier = 'pro'");
  const rev = await client.execute("SELECT COALESCE(SUM(amount_cents), 0) as total FROM payments");
  const proCount = Number(subs.rows[0]?.count || 0);
  return {
    proSubscriptions: proCount,
    mrr: proCount * 799,
    totalRevenue: Number(rev.rows[0]?.total || 0),
  };
}

// ─── Scan logging & Abuse detection ──────────────────────────────────────────

async function logScan(userId, ip) {
  await client.execute({
    sql: 'INSERT INTO scan_log (user_id, ip) VALUES (?, ?)',
    args: [userId ? Number(userId) : null, ip || null]
  });
}

async function countRecentScans(userId, ip, windowMinutes) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const result = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM scan_log WHERE (user_id = ? OR ip = ?) AND created_at >= ?',
    args: [userId ? Number(userId) : null, ip || '', cutoff]
  });
  return Number(result.rows[0]?.count || 0);
}

async function countIpScansToday(ip) {
  const today = todayDateStr();
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM scan_log WHERE ip = ? AND created_at >= ?",
    args: [ip, today + 'T00:00:00.000Z']
  });
  return Number(result.rows[0]?.count || 0);
}

async function createAbuseFlag({ userId, ip, reason, metadata }) {
  await client.execute({
    sql: 'INSERT INTO abuse_flags (user_id, ip, reason, metadata) VALUES (?, ?, ?, ?)',
    args: [userId ? Number(userId) : null, ip || null, reason, metadata ? JSON.stringify(metadata) : null]
  });
}

async function listAbuseFlags(limit = 200) {
  const result = await client.execute({
    sql: `SELECT a.*, u.email as user_email FROM abuse_flags a
          LEFT JOIN users u ON u.id = a.user_id
          ORDER BY a.created_at DESC LIMIT ?`,
    args: [Math.min(Number(limit), 500)]
  });
  return result.rows.map(r => ({ ...r, id: Number(r.id), user_id: r.user_id !== null ? Number(r.user_id) : null }));
}

async function getUnresolvedAbuseFlagCount() {
  const result = await client.execute("SELECT COUNT(*) as count FROM abuse_flags WHERE resolved = 0");
  return Number(result.rows[0]?.count || 0);
}

async function resolveAbuseFlag(flagId, resolvedBy) {
  await client.execute({
    sql: 'UPDATE abuse_flags SET resolved = 1, resolved_by = ? WHERE id = ?',
    args: [resolvedBy ? Number(resolvedBy) : null, Number(flagId)]
  });
}

async function markAbuseFlagNotified(flagId) {
  await client.execute({
    sql: 'UPDATE abuse_flags SET notified = 1 WHERE id = ?',
    args: [Number(flagId)]
  });
}

async function suspendUser(userId) {
  await client.execute({
    sql: 'UPDATE users SET suspended = 1, updated_at = ? WHERE id = ?',
    args: [nowIso(), Number(userId)]
  });
}

async function unsuspendUser(userId) {
  await client.execute({
    sql: 'UPDATE users SET suspended = 0, updated_at = ? WHERE id = ?',
    args: [nowIso(), Number(userId)]
  });
}

async function isUserSuspended(userId) {
  const result = await client.execute({
    sql: 'SELECT suspended FROM users WHERE id = ?',
    args: [Number(userId)]
  });
  return Number(result.rows[0]?.suspended || 0) === 1;
}

async function checkAbusePatterns(userId, ip) {
  const flags = [];
  const hourlyCount = await countRecentScans(userId, ip, 60);
  if (hourlyCount >= HOURLY_SCAN_LIMIT) {
    flags.push({ reason: 'hourly_burst', metadata: { count: hourlyCount, limit: HOURLY_SCAN_LIMIT } });
  }
  const ipDaily = await countIpScansToday(ip);
  if (ipDaily >= IP_DAILY_SCAN_LIMIT) {
    flags.push({ reason: 'ip_daily_cap', metadata: { count: ipDaily, limit: IP_DAILY_SCAN_LIMIT } });
  }
  const twoHourCount = await countRecentScans(userId, ip, 120);
  if (twoHourCount >= ABUSE_FLAG_THRESHOLD) {
    flags.push({ reason: 'suspicious_velocity', metadata: { count: twoHourCount, window: '2h', threshold: ABUSE_FLAG_THRESHOLD } });
  }
  return flags;
}

// Immutable audit log — NEVER delete. 3-year minimum retention.
async function writeAuditLog({ eventType, userId, userEmail, details, ip }) {
  await client.execute({
    sql: 'INSERT INTO audit_log (event_type, user_id, user_email, details, ip) VALUES (?, ?, ?, ?, ?)',
    args: [eventType, userId ? Number(userId) : null, userEmail || null, typeof details === 'object' ? JSON.stringify(details) : (details || null), ip || null]
  });
}

async function getAuditLogs({ userId, eventType, limit = 100 } = {}) {
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const args = [];
  if (userId) { sql += ' AND user_id = ?'; args.push(Number(userId)); }
  if (eventType) { sql += ' AND event_type = ?'; args.push(eventType); }
  sql += ' ORDER BY id DESC LIMIT ?';
  args.push(limit);
  const result = await client.execute({ sql, args });
  return result.rows;
}

async function addNewsletterSubscriber(email, name, country) {
  await dbReady;
  const now = nowIso();
  try {
    await client.execute({
      sql: `INSERT INTO newsletter_subscribers (email, name, country, subscribed_at) VALUES (?, ?, ?, ?)`,
      args: [email.toLowerCase().trim(), name || null, country || null, now]
    });
    return { success: true };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      // Already subscribed — update name/country silently
      await client.execute({
        sql: `UPDATE newsletter_subscribers SET name = ?, country = ?, unsubscribed_at = NULL WHERE email = ?`,
        args: [name || null, country || null, email.toLowerCase().trim()]
      });
      return { success: true };
    }
    throw err;
  }
}

async function listNewsletterSubscribers() {
  await dbReady;
  const result = await client.execute(`SELECT id, email, name, country, subscribed_at, unsubscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC`);
  return result.rows;
}

async function getNewsletterStats() {
  await dbReady;
  const total = await client.execute(`SELECT COUNT(*) as count FROM newsletter_subscribers WHERE unsubscribed_at IS NULL`);
  return { activeSubscribers: Number(total.rows[0].count) };
}

async function getAdminScanGallery(limit = 200) {
  const batches = await client.execute({
    sql: `SELECT b.id, b.user_id, b.created_at, b.image_count, b.primary_match, b.primary_confidence,
                 u.email, u.name
          FROM upload_batches b
          LEFT JOIN users u ON b.user_id = u.id
          ORDER BY b.created_at DESC
          LIMIT ?`,
    args: [limit]
  });

  const scans = [];
  for (const batch of batches.rows) {
    const imgs = await client.execute({
      sql: 'SELECT id, mime_type, image_blob FROM upload_images WHERE batch_id = ? ORDER BY id ASC LIMIT 1',
      args: [batch.id]
    });
    const thumb = imgs.rows.length > 0
      ? `data:${imgs.rows[0].mime_type || 'image/jpeg'};base64,${Buffer.from(imgs.rows[0].image_blob).toString('base64')}`
      : null;

    // Get country from the closest scan event
    const geo = await client.execute({
      sql: `SELECT country, city FROM analytics_events
            WHERE event = 'scan' AND user_id = ? AND created_at <= datetime(?, '+1 minute')
            ORDER BY created_at DESC LIMIT 1`,
      args: [batch.user_id ? Number(batch.user_id) : null, batch.created_at]
    });

    scans.push({
      id: batch.id,
      userName: batch.name || null,
      userEmail: batch.email || null,
      primaryMatch: batch.primary_match,
      primaryConfidence: batch.primary_confidence ? Number(batch.primary_confidence) : null,
      imageCount: Number(batch.image_count),
      thumbnail: thumb,
      country: geo.rows[0]?.country || null,
      city: geo.rows[0]?.city || null,
      createdAt: batch.created_at
    });
  }
  return scans;
}

module.exports = {
  dbReady,
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
  insertFeedback,
  listFeedback,
  ANON_SCAN_LIMIT,
  FREE_SCAN_LIMIT,
  PRO_SCAN_DAILY_LIMIT,
  HOURLY_SCAN_LIMIT,
  setUserStripeCustomer,
  setUserSubscription,
  downgradeUser,
  findUserByStripeCustomerId,
  createPaymentRecord,
  getRevenueStats,
  logScan,
  checkAbusePatterns,
  createAbuseFlag,
  listAbuseFlags,
  getUnresolvedAbuseFlagCount,
  resolveAbuseFlag,
  markAbuseFlagNotified,
  suspendUser,
  unsuspendUser,
  isUserSuspended,
  getUserScanStats,
  writeAuditLog,
  getAuditLogs,
  addNewsletterSubscriber,
  listNewsletterSubscribers,
  getNewsletterStats,
  getAdminScanGallery,
  getUserUploadBatches
};

async function getUserUploadBatches(userIds) {
  await dbReady;
  if (!userIds.length) return new Map();
  const map = new Map();
  for (const uid of userIds) {
    const result = await client.execute({
      sql: 'SELECT id, user_id, created_at FROM upload_batches WHERE user_id = ? ORDER BY created_at DESC',
      args: [uid]
    });
    if (result.rows.length > 0) {
      map.set(uid, result.rows.map(r => ({ id: r.id, createdAt: r.created_at })));
    }
  }
  return map;
}
