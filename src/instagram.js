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
const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:data/amushroom.db',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Migration — create instagram_posts table if not exists
const igReady = client.execute(`
  CREATE TABLE IF NOT EXISTS instagram_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL UNIQUE,
    ig_media_id TEXT,
    caption TEXT,
    posted_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted',
    FOREIGN KEY(batch_id) REFERENCES upload_batches(id)
  )
`).catch(() => {});

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

// ─── Geo lookup for batch ────────────────────────────────────────────────────

async function getBatchGeo(batchId) {
  const result = await client.execute({
    sql: `SELECT city, country FROM analytics_events
          WHERE event = 'scan' AND created_at >= (
            SELECT created_at FROM upload_batches WHERE id = ?
          )
          AND city IS NOT NULL AND city != ''
          ORDER BY created_at ASC LIMIT 1`,
    args: [batchId]
  });
  return result.rows[0] || null;
}

function buildLocationHashtags(city, country) {
  const tags = [];
  if (city) {
    const slug = city.toLowerCase().replace(/[^a-z0-9]/g, '');
    tags.push(`#${slug}foraging`);
    tags.push(`#${slug}mushrooms`);
  }
  if (country) {
    const slug = country.toLowerCase().replace(/[^a-z0-9]/g, '');
    tags.push(`#${slug}foraging`);
    tags.push(`#${slug}mushrooms`);
  }
  return [...new Set(tags)].join(' ');
}

// ─── Caption builder ─────────────────────────────────────────────────────────

async function buildCaption(batch, match) {
  const lines = [];

  lines.push(`${match.common_name} (${match.scientific_name})`);
  lines.push(`${match.confidence}% confidence · ${match.edibility && match.edibility !== 'unknown' ? match.edibility : 'Edibility unknown'}`);

  if (batch.user_story) {
    lines.push('');
    lines.push(`"${batch.user_story}"`);
  }

  lines.push('');
  lines.push('Identify yours free at orangutany.com — link in bio.');
  lines.push('');

  const baseTags = '#mushrooms #mushroomhunting #foraging #mycology #fungi #wildmushrooms #mushroomidentification #orangutany #ediblemushrooms';
  const geo = await getBatchGeo(batch.batch_id);
  const locationTags = geo ? buildLocationHashtags(geo.city, geo.country) : '';

  lines.push(locationTags ? `${baseTags} ${locationTags}` : baseTags);

  return lines.join('\n');
}

// ─── Pick candidate ──────────────────────────────────────────────────────────

async function pickPostCandidate() {
  await igReady;
  const result = await client.execute(`
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
  `);
  return result.rows[0] || null;
}

// ─── Publish to Instagram ─────────────────────────────────────────────────────

async function publishPostFromUrl(imageUrl, caption, pageToken, igAccountId) {
  console.log(`[instagram] Creating media container for ${imageUrl}`);

  const container = await postJson(
    `${IG_GRAPH}/${igAccountId}/media?access_token=${pageToken}`,
    { image_url: imageUrl, caption }
  );

  if (container.error) {
    throw new Error(`Media container error: ${container.error.message}`);
  }

  const containerId = container.id;
  console.log(`[instagram] Container created: ${containerId}`);

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

async function markPosted(batchId, igMediaId, caption) {
  await client.execute({
    sql: `INSERT INTO instagram_posts (batch_id, ig_media_id, caption, posted_at, status)
          VALUES (?, ?, ?, datetime('now'), 'posted')`,
    args: [batchId, igMediaId, caption]
  });
}

async function markFailed(batchId, reason) {
  await client.execute({
    sql: `INSERT OR REPLACE INTO instagram_posts (batch_id, ig_media_id, caption, posted_at, status)
          VALUES (?, NULL, ?, datetime('now'), 'failed')`,
    args: [batchId, reason]
  });
}

// ─── Main: run one post ───────────────────────────────────────────────────────

async function runOnePost(options = {}) {
  const pageToken = options.pageToken || process.env.IG_PAGE_TOKEN;
  const igAccountId = options.igAccountId || process.env.IG_ACCOUNT_ID;
  const baseUrl = options.baseUrl || process.env.APP_BASE_URL || 'https://orangutany.com';

  if (!pageToken || !igAccountId) {
    throw new Error('IG_PAGE_TOKEN and IG_ACCOUNT_ID must be set');
  }

  const candidate = await pickPostCandidate();
  if (!candidate) {
    console.log('[instagram] No eligible candidates to post');
    return null;
  }

  const caption = await buildCaption(candidate, candidate);
  const imageUrl = `${baseUrl}/api/user/uploads/${candidate.batch_id}/cover-image`;

  console.log(`[instagram] Posting batch ${candidate.batch_id} — ${candidate.common_name} (${candidate.confidence}%)`);

  try {
    const mediaId = await publishPostFromUrl(imageUrl, caption, pageToken, igAccountId);
    await markPosted(candidate.batch_id, mediaId, caption);
    console.log(`[instagram] Done — ig media id: ${mediaId}`);
    return { batchId: candidate.batch_id, mediaId, caption };
  } catch (err) {
    console.error(`[instagram] Failed to post batch ${candidate.batch_id}:`, err.message);
    await markFailed(candidate.batch_id, err.message);
    throw err;
  }
}

// ─── List posted ─────────────────────────────────────────────────────────────

async function listPosted(limit = 20) {
  await igReady;
  const result = await client.execute({
    sql: `SELECT ip.*, ub.primary_match, ub.primary_confidence, ub.created_at as scan_date
          FROM instagram_posts ip
          JOIN upload_batches ub ON ub.id = ip.batch_id
          ORDER BY ip.posted_at DESC
          LIMIT ?`,
    args: [Number(limit)]
  });
  return result.rows;
}

module.exports = { runOnePost, pickPostCandidate, buildCaption, markPosted, listPosted };
