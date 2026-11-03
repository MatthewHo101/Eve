import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config, HttpError, readSession, saveSession, withSessionLock } from './server.js';

export const ASSET_SCOPE = 'esi-assets.read_assets.v1';
const SSO = 'https://login.eveonline.com';
const ESI = 'https://esi.evetech.net/latest';
let jwks;

export async function exchangeToken(parameters) {
  const { clientId, clientSecret } = config();
  const response = await fetch(`${SSO}/v2/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    if ([400, 401].includes(response.status)) throw new HttpError(401, 'EVE authorization expired or was revoked. Please link this character again.');
    throw new HttpError(502, 'EVE login is temporarily unavailable.');
  }
  const tokens = await response.json();
  if (!tokens.access_token) throw new HttpError(502, 'EVE did not return a valid login.');
  return tokens;
}

export async function verifyAccessToken(token, keySet) {
  if (!keySet && !jwks) {
    const response = await fetch(`${SSO}/.well-known/oauth-authorization-server`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new HttpError(502, 'EVE login verification is temporarily unavailable.');
    const metadata = await response.json();
    const url = new URL(metadata.jwks_uri);
    if (url.origin !== SSO) throw new HttpError(502, 'EVE login verification is temporarily unavailable.');
    jwks = createRemoteJWKSet(url, { timeoutDuration: 10000 });
  }
  const { payload } = await jwtVerify(token, keySet || jwks, {
    algorithms: ['RS256'],
    issuer: [SSO, `${SSO}/`, 'login.eveonline.com'],
    audience: config().clientId,
    requiredClaims: ['exp', 'sub', 'name', 'aud', 'iss', 'scp']
  });
  if (!Array.isArray(payload.aud) || !payload.aud.includes('EVE Online') ||
      !/^CHARACTER:EVE:\d+$/.test(payload.sub) || typeof payload.name !== 'string' ||
      !Array.isArray(payload.scp) || !payload.scp.includes(ASSET_SCOPE)) {
    throw new HttpError(401, 'EVE login did not grant the required character access.');
  }
  return payload;
}

export function characterFromTokens(tokens, claims, previous = {}) {
  const refreshToken = tokens.refresh_token || previous.refreshToken;
  if (!refreshToken) throw new HttpError(401, 'Please link the character again to enable automatic login renewal.');
  return {
    id: claims.sub.split(':')[2], name: claims.name,
    owner: claims.owner || previous.owner,
    accessToken: tokens.access_token, refreshToken, expiresAt: claims.exp * 1000
  };
}

export async function characterWithToken(sessionId, characterId, forceRefresh = false, rejectedToken) {
  return withSessionLock(sessionId, async lease => {
    const session = await readSession(sessionId);
    const character = session?.characters[characterId];
    if (!character) throw new HttpError(403, 'This character is not linked to your session.');
    // Another request may already have replaced the token that ESI rejected.
    const needsForcedRefresh = forceRefresh && character.accessToken === rejectedToken;
    if (!needsForcedRefresh && character.expiresAt > Date.now() + 60000) return character;
    const tokens = await exchangeToken({ grant_type: 'refresh_token', refresh_token: character.refreshToken });
    const claims = await verifyAccessToken(tokens.access_token);
    const updated = characterFromTokens(tokens, claims, character);
    if (updated.id !== characterId || (character.owner && updated.owner !== character.owner)) {
      throw new HttpError(401, 'Character ownership changed. Please link the character again.');
    }
    session.characters[characterId] = updated;
    await saveSession(sessionId, session, lease);
    return updated;
  });
}

export async function assetPage(character, page) {
  return fetch(`${ESI}/characters/${character.id}/assets/?datasource=tranquility&page=${page}`, {
    headers: { Authorization: `Bearer ${character.accessToken}` },
    signal: AbortSignal.timeout(15000)
  });
}

export async function fetchCharacterAssets(sessionId, characterId) {
  let character = await characterWithToken(sessionId, characterId);
  async function getPage(page) {
    const requestedToken = character.accessToken;
    let response = await assetPage(character, page);
    if (response.status === 401) {
      character = await characterWithToken(sessionId, characterId, true, requestedToken);
      response = await assetPage(character, page);
    }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new HttpError(401, 'Character access was revoked. Please link the character again.');
      throw new HttpError(response.status === 420 || response.status === 429 ? 429 : 502,
        'EVE assets are temporarily unavailable. Please try again later.');
    }
    const items = await response.json();
    if (!Array.isArray(items)) throw new HttpError(502, 'EVE returned an invalid asset list.');
    return { items, pages: Number(response.headers.get('x-pages') || 1),
      modified: response.headers.get('last-modified'), expires: Date.parse(response.headers.get('expires')) };
  }

  // Retry once if ESI's cached snapshot changes while pages are being retrieved.
  for (let attempt = 0; attempt < 2; attempt++) {
    const first = await getPage(1);
    if (!Number.isInteger(first.pages) || first.pages < 1 || first.pages > 10000) {
      throw new HttpError(502, 'EVE returned invalid asset pagination.');
    }
    const items = [...first.items];
    let consistent = true;
    let expires = first.expires;
    // Small batches avoid launching hundreds of ESI requests simultaneously.
    for (let page = 2; page <= first.pages; page += 4) {
      const batch = await Promise.all(Array.from({ length: Math.min(4, first.pages - page + 1) }, (_, i) => getPage(page + i)));
      for (const result of batch) {
        if (result.pages !== first.pages || result.modified !== first.modified) consistent = false;
        expires = Math.min(expires, result.expires);
        items.push(...result.items);
      }
    }
    if (consistent) return { items, expires };
  }
  throw new HttpError(503, 'Your asset inventory changed during loading. Please try again.');
}

export async function resolveAssetNames(typeIds) {
  const names = new Map();
  for (let i = 0; i < typeIds.length; i += 900) {
    const response = await fetch(`${ESI}/universe/names/?datasource=tranquility`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeIds.slice(i, i + 900)), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new HttpError(502, 'Item names are temporarily unavailable. Please try again.');
    for (const entry of await response.json()) names.set(entry.id, entry.name);
  }
  return names;
}
