/**
 * Instagram publishing pipeline for Orangutany.
 *
 * Flow:
 *   1. pickPostCandidate() — finds a high-confidence scan with a cover image, not yet posted
 *   2. buildCaption()      — formats species info + user story into a caption
 *   3. publishPost()       — uploads image + caption to Instagram via Graph API
 *   4. markPosted()        — records the post in instagram_posts table
 *
 * Credentials come from env vars (set on Render):
 *   IG_PAGE_TOKEN       — long-lived Facebook Page access token
 *   IG_ACCOUNT_ID       — Instagram Business Account ID linked to the page
 */

const https = require('node:https');
const Database = require('better-sqlite3');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'data', 'amushroom.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Migration — create instagram_posts table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS instagram_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL UNIQUE,
    ig_media_id TEXT,
    caption TEXT,
    posted_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted',
    FOREIGN KEY(batch_id) REFERENCES upload_batches(id)
  )
`);

const IG_GRAPH = 'https://graph.facebook.com/v19.0';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: options.method || 'GET', headers: options.headers || {} }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function postJson(url, payload) {
  const body = JSON.stringify(payload);
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
}

// ─── Caption builder ─────────────────────────────────────────────────────────

function buildCaption(batch, match) {
  const lines = [];

  lines.push(`${match.common_name} (${match.scientific_name})`);
  lines.push(`${match.confidence}% confidence`);

  if (match.edibility && match.edibility !== 'unknown') {
    lines.push(`Edibility: ${match.edibility}`);
  }

  if (batch.user_story) {
    lines.push('');
    lines.push(`"${batch.user_story}"`);
  }

  lines.push('');
  lines.push('Identified with Orangutany — free AI mushroom identification.');
  lines.push('Link in bio.');
  lines.push('');
  lines.push('#mushrooms #mushroomhunting #foraging #mycology #fungi #wildmushroooms #mushroomidentification #orangutany');

  return lines.join('\n');
}

// ─── Pick candidate ──────────────────────────────────────────────────────────

function pickPostCandidate() {
  // Find a batch: high confidence, has a cover image blob, not yet posted
  const row = db.prepare(`
    SELECT
      ub.id as batch_id,
      ub.user_story,
      ub.primary_confidence,
      im.scientific_name,
      im.common_name,
      im.confidence,
      im.edibility,
      ui.image_blob,
      ui.mime_type
    FROM upload_batches ub
    JOIN identification_matches im ON im.batch_id = ub.id AND im.rank = 1
    JOIN upload_images ui ON ui.batch_id = ub.id AND ui.role = 'cap'
    LEFT JOIN instagram_posts ip ON ip.batch_id = ub.id
    WHERE ub.primary_confidence >= 75
      AND ip.id IS NULL
      AND ub.user_id IS NOT NULL
    ORDER BY
      CASE WHEN ub.user_story IS NOT NULL THEN 0 ELSE 1 END,
      ub.primary_confidence DESC,
      ub.created_at DESC
    LIMIT 1
  `).get();

  return row || null;
}

// ─── Publish to Instagram ─────────────────────────────────────────────────────

async function publishPost(imageBlob, mimeType, caption, pageToken, igAccountId) {
  // Instagram requires a public image URL — we host it temporarily via a data upload
  // Since we can't serve from localhost, we use the Orangutany production image endpoint
  // The image must be accessible via public URL, so we use the /api/user/uploads/:id image route
  // For now we accept an imageUrl parameter instead of blob directly
  throw new Error('publishPost requires a public imageUrl — use publishPostFromUrl instead');
}

async function publishPostFromUrl(imageUrl, caption, pageToken, igAccountId) {
  console.log(`[instagram] Creating media container for ${imageUrl}`);

  // Step 1: Create media container
  const container = await postJson(
    `${IG_GRAPH}/${igAccountId}/media?access_token=${pageToken}`,
    { image_url: imageUrl, caption }
  );

  if (container.error) {
    throw new Error(`Media container error: ${container.error.message}`);
  }

  const containerId = container.id;
  console.log(`[instagram] Container created: ${containerId}`);

  // Step 2: Wait for container to be ready
  let status = 'IN_PROGRESS';
  let attempts = 0;
  while (status === 'IN_PROGRESS' && attempts < 10) {
    await new Promise(r => setTimeout(r, 3000));
    const check = await fetchJson(
      `${IG_GRAPH}/${containerId}?fields=status_code&access_token=${pageToken}`
    );
    status = check.status_code || 'ERROR';
    attempts++;
    console.log(`[instagram] Container status: ${status} (attempt ${attempts})`);
  }

  if (status !== 'FINISHED') {
    throw new Error(`Container not ready after ${attempts} attempts, status: ${status}`);
  }

  // Step 3: Publish
  const publish = await postJson(
    `${IG_GRAPH}/${igAccountId}/media_publish?access_token=${pageToken}`,
    { creation_id: containerId }
  );

  if (publish.error) {
    throw new Error(`Publish error: ${publish.error.message}`);
  }

  console.log(`[instagram] Published! Media ID: ${publish.id}`);
  return publish.id;
}

// ─── Mark posted ─────────────────────────────────────────────────────────────

function markPosted(batchId, igMediaId, caption) {
  db.prepare(`
    INSERT INTO instagram_posts (batch_id, ig_media_id, caption, posted_at, status)
    VALUES (?, ?, ?, datetime('now'), 'posted')
  `).run(batchId, igMediaId, caption);
}

function markFailed(batchId, reason) {
  db.prepare(`
    INSERT OR REPLACE INTO instagram_posts (batch_id, ig_media_id, caption, posted_at, status)
    VALUES (?, NULL, ?, datetime('now'), 'failed')
  `).run(batchId, reason);
}

// ─── Main: run one post ───────────────────────────────────────────────────────

async function runOnePost(options = {}) {
  const pageToken = options.pageToken || process.env.IG_PAGE_TOKEN;
  const igAccountId = options.igAccountId || process.env.IG_ACCOUNT_ID;
  const baseUrl = options.baseUrl || process.env.APP_BASE_URL || 'https://orangutany.com';

  if (!pageToken || !igAccountId) {
    throw new Error('IG_PAGE_TOKEN and IG_ACCOUNT_ID must be set');
  }

  const candidate = pickPostCandidate();
  if (!candidate) {
    console.log('[instagram] No eligible candidates to post');
    return null;
  }

  const caption = buildCaption(candidate, candidate);
  // Build public image URL using the existing preview endpoint
  const imageUrl = `${baseUrl}/api/user/uploads/${candidate.batch_id}/cover-image`;

  console.log(`[instagram] Posting batch ${candidate.batch_id} — ${candidate.common_name} (${candidate.confidence}%)`);

  try {
    const mediaId = await publishPostFromUrl(imageUrl, caption, pageToken, igAccountId);
    markPosted(candidate.batch_id, mediaId, caption);
    console.log(`[instagram] Done — ig media id: ${mediaId}`);
    return { batchId: candidate.batch_id, mediaId, caption };
  } catch (err) {
    console.error(`[instagram] Failed to post batch ${candidate.batch_id}:`, err.message);
    markFailed(candidate.batch_id, err.message);
    throw err;
  }
}

// ─── List posted ─────────────────────────────────────────────────────────────

function listPosted(limit = 20) {
  return db.prepare(`
    SELECT ip.*, ub.primary_match, ub.primary_confidence, ub.created_at as scan_date
    FROM instagram_posts ip
    JOIN upload_batches ub ON ub.id = ip.batch_id
    ORDER BY ip.posted_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = { runOnePost, pickPostCandidate, buildCaption, markPosted, listPosted };
