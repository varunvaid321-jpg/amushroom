const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

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

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { ...securityHeaders(), 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { ...securityHeaders(), 'Content-Type': contentType });
    res.end(data);
  });
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
    reasons.push(`For better quality, add: ${uploadGuidance.missingRecommendedRoles.join(', ')}.`);
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

async function handleIdentify(req, res) {
  if (!process.env.MUSHROOM_API_KEY) {
    sendJson(res, 500, { error: 'Server missing MUSHROOM_API_KEY.' });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const images = Array.isArray(body.images) ? body.images.filter((item) => typeof item === 'string' && item.trim()) : [];
  const photoRoles = Array.isArray(body.photoRoles) ? body.photoRoles.slice(0, images.length) : [];
  const uploadGuidance = buildUploadGuidance(photoRoles, images.length);

  if (images.length < 1 || images.length > 5) {
    sendJson(res, 400, { error: 'Provide between 1 and 5 images.' });
    return;
  }

  const consistencyPromise = runConsistencyCheck(images).catch(() => null);
  let parsed;
  try {
    parsed = await requestIdentification(images, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Identification failed.';
    sendJson(res, 502, { error: message });
    return;
  }

  const matches = normalizeMatches(parsed, uploadGuidance);
  if (!matches.length) {
    sendJson(res, 502, { error: 'API returned no suggestions. Try different photos.' });
    return;
  }

  const consistencyCheck = await consistencyPromise;
  sendJson(res, 200, { matches, uploadGuidance, consistencyCheck });
}

function handleDesignTokens(res) {
  fs.readFile(TOKEN_FILE, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 500, { error: 'Unable to load design tokens.' });
      return;
    }

    try {
      const tokens = JSON.parse(data);
      sendJson(res, 200, tokens);
    } catch {
      sendJson(res, 500, { error: 'Invalid token format.' });
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

  if (req.method === 'POST' && url.pathname === '/api/identify') {
    await handleIdentify(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/design-tokens') {
    handleDesignTokens(res);
    return;
  }

  if (req.method === 'GET') {
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = resolvePublicPath(pathname);
    if (!filePath) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    serveFile(res, filePath);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`aMushroom running at http://${HOST}:${PORT}`);
});
