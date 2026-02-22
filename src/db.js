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

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_batches_user_id ON upload_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_images_batch_id ON upload_images(batch_id);
CREATE INDEX IF NOT EXISTS idx_identification_matches_batch_id ON identification_matches(batch_id);
`);

const stmts = {
  createUser: db.prepare(`
    INSERT INTO users (email, name, password_hash, password_salt, google_sub, email_verified, created_at, updated_at)
    VALUES (@email, @name, @password_hash, @password_salt, @google_sub, @email_verified, @created_at, @updated_at)
  `),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserByGoogleSub: db.prepare('SELECT * FROM users WHERE google_sub = ?'),
  findUserById: db.prepare('SELECT id, email, name, email_verified, created_at, updated_at FROM users WHERE id = ?'),
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
    SELECT id, created_at, image_count, primary_match, primary_confidence, mixed_species, consistency_message
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

  return batches.map((batch) => ({
    id: batch.id,
    createdAt: batch.created_at,
    imageCount: batch.image_count,
    primaryMatch: batch.primary_match,
    primaryConfidence: batch.primary_confidence,
    mixedSpecies: Boolean(batch.mixed_species),
    consistencyMessage: batch.consistency_message,
    topMatches: stmts.listBatchMatches.all(batch.id).map((m) => ({
      rank: m.rank,
      scientificName: m.scientific_name,
      commonName: m.common_name,
      confidence: m.confidence
    }))
  }));
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
  listUserUploads
};
