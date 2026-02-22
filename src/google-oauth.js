const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupStateStore() {
  const now = Date.now();
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt <= now) stateStore.delete(key);
  }
}

function createOAuthState(state, returnTo = '/') {
  cleanupStateStore();
  stateStore.set(state, {
    returnTo: String(returnTo || '/'),
    expiresAt: Date.now() + STATE_TTL_MS
  });
}

function consumeOAuthState(state) {
  cleanupStateStore();
  const value = stateStore.get(state);
  if (!value) return null;
  stateStore.delete(state);
  return value;
}

function buildGoogleAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed.');
  }

  return payload;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google profile request failed.');
  }

  return {
    sub: String(payload.sub || ''),
    email: String(payload.email || '').toLowerCase(),
    name: String(payload.name || ''),
    emailVerified: Boolean(payload.email_verified)
  };
}

module.exports = {
  createOAuthState,
  consumeOAuthState,
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile
};
