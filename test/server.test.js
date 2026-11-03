import assert from 'node:assert/strict';
import { before, beforeEach, afterEach, test } from 'node:test';
import { createHash } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import login from '../api/auth/login.js';
import callback from '../api/auth/callback.js';
import logout from '../api/auth/logout.js';
import characters from '../api/characters.js';
import assets from '../api/assets.js';
import { ASSET_SCOPE, verifyAccessToken } from '../lib/eve.js';
import { hash, randomId, readSession, saveSession, seal, sessionKey, unseal } from '../lib/server.js';

let privateKey, localKeys, publicJwk;
let database, tokenRequests, esiRequests, tokenResponder, esiResponder;
const realFetch = globalThis.fetch;
const origin = 'https://eveindustry.vercel.app';
const storage = 'https://test-storage.upstash.io';
const settings = {
  APP_URL: origin, EVE_CLIENT_ID: 'test-client', EVE_CLIENT_SECRET: 'test-client-secret',
  SESSION_SECRET: 'test-only-encryption-key-at-least-32-characters',
  UPSTASH_REDIS_REST_URL: storage, UPSTASH_REDIS_REST_TOKEN: 'test-storage-token'
};

before(async () => {
  const keys = await generateKeyPair('RS256');
  privateKey = keys.privateKey;
  publicJwk = { ...await exportJWK(keys.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
  localKeys = createLocalJWKSet({ keys: [publicJwk] });
});

async function signedToken(id = '123', overrides = {}) {
  return new SignJWT({ sub: `CHARACTER:EVE:${id}`, name: `Pilot ${id}`, owner: 'owner-one',
    scp: [ASSET_SCOPE], aud: ['test-client', 'EVE Online'], iss: 'https://login.eveonline.com',
    exp: Math.floor(Date.now() / 1000) + 1200, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).sign(privateKey);
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

// Model only the Redis commands the app uses, including expiration and lock ownership.
function redisCommand(command) {
  const [name, key, ...args] = command;
  const entry = database.get(key);
  if (entry?.expires <= Date.now()) database.delete(key);
  if (name === 'GET') return database.get(key)?.value ?? null;
  if (name === 'GETDEL') {
    const value = database.get(key)?.value ?? null;
    database.delete(key);
    return value;
  }
  if (name === 'SET') {
    if (args.includes('NX') && database.has(key)) return null;
    const expiry = args.indexOf('EX');
    database.set(key, { value: args[0], expires: expiry < 0 ? Infinity : Date.now() + Number(args[expiry + 1]) * 1000 });
    return 'OK';
  }
  if (name === 'DEL') return Number(database.delete(key));
  if (name === 'EVAL') {
    const [count, ...values] = args;
    if (count === 1) {
      const [lockKey, owner] = values;
      if (database.get(lockKey)?.value !== owner) return 0;
      return Number(database.delete(lockKey));
    }
    const [lockKey, dataKey, owner, encrypted, ttl] = values;
    if (database.get(lockKey)?.value !== owner) return 0;
    database.set(dataKey, { value: encrypted, expires: Date.now() + Number(ttl) * 1000 });
    return 1;
  }
  throw new Error(`Unexpected Redis command: ${name}`);
}

beforeEach(() => {
  Object.assign(process.env, settings);
  database = new Map();
  tokenRequests = [];
  esiRequests = [];
  tokenResponder = async () => json({ access_token: await signedToken(), refresh_token: 'refresh-one' });
  esiResponder = async () => json([]);
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.origin === storage) {
      assert.equal(options.headers.Authorization, 'Bearer test-storage-token');
      return json({ result: redisCommand(JSON.parse(options.body)) });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return json({ jwks_uri: 'https://login.eveonline.com/oauth/jwks' });
    }
    if (url.pathname === '/oauth/jwks') return json({ keys: [publicJwk] });
    if (url.pathname === '/v2/oauth/token') {
      tokenRequests.push(options);
      return tokenResponder(options);
    }
    if (url.origin === 'https://esi.evetech.net') {
      esiRequests.push({ url, options });
      if (url.pathname.endsWith('/universe/names/')) {
        return json(JSON.parse(options.body).map(id => ({ id, name: `Item ${id}` })));
      }
      return esiResponder(url, options);
    }
    throw new Error('Unexpected upstream request');
  };
});

afterEach(() => { globalThis.fetch = realFetch; });

async function call(handler, { method = 'GET', query = {}, cookie = '', requestOrigin = origin } = {}) {
  const headers = new Map();
  const response = {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    redirect(code, location) { this.statusCode = code; this.location = location; return this; }
  };
  await handler({ method, query, headers: { cookie, origin: requestOrigin } }, response);
  return response;
}

async function seed(ids = ['123'], expiresAt = Date.now() + 1200000) {
  const id = randomId();
  const linked = Object.fromEntries(ids.map(characterId => [characterId, {
    id: characterId, name: `Pilot ${characterId}`, owner: 'owner-one', accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token', expiresAt
  }]));
  await saveSession(id, { characters: linked, expiresAt: Date.now() + 86400000 });
  return { id, cookie: `eve_session=${id}` };
}

async function startLogin(cookie = '') {
  const response = await call(login, { cookie });
  assert.equal(response.statusCode, 302);
  const url = new URL(response.location);
  const state = url.searchParams.get('state');
  return { response, url, state, cookie: `${cookie}${cookie ? '; ' : ''}eve_oauth=${state}` };
}

test('stored sessions are encrypted, authenticated, and bound to their database key', () => {
  const value = seal({ refreshToken: 'private-token' }, 'session-a');
  assert.ok(!value.includes('private-token'));
  assert.deepEqual(unseal(value, 'session-a'), { refreshToken: 'private-token' });
  assert.throws(() => unseal(value, 'session-b'));
  const tampered = Buffer.from(value, 'base64url');
  tampered[30] ^= 1;
  assert.throws(() => unseal(tampered.toString('base64url'), 'session-a'));
});

test('login generates a server-side PKCE verifier and secure state cookie', async () => {
  const { response, url, state } = await startLogin();
  assert.equal(url.origin, 'https://login.eveonline.com');
  assert.equal(url.searchParams.get('redirect_uri'), `${origin}/api/auth/callback`);
  assert.equal(url.searchParams.get('scope'), ASSET_SCOPE);
  const cookie = response.getHeader('Set-Cookie')[0];
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/auth', 'Max-Age=600']) assert.ok(cookie.includes(attribute));
  const key = `eve:oauth:${hash(state)}`;
  const flow = unseal(database.get(key).value, key);
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(flow.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(!response.location.includes(flow.verifier));
});

test('callback rejects missing or mismatched state without exchanging credentials', async () => {
  const { state, cookie } = await startLogin();
  for (const query of [{ code: 'code' }, { code: 'code', state: randomId() }]) {
    const response = await call(callback, { query, cookie });
    assert.match(response.location, /auth_error/);
  }
  const response = await call(callback, { query: { code: 'code', state }, cookie: '' });
  assert.match(response.location, /auth_error/);
  assert.equal(tokenRequests.length, 0);
});

test('successful callback stores tokens only on the server and cannot be replayed', async () => {
  const flow = await startLogin();
  const response = await call(callback, { cookie: flow.cookie, query: { state: flow.state, code: 'one-use-code' } });
  assert.equal(response.location, '/?linked=1#my-characters');
  const sessionCookie = response.getHeader('Set-Cookie').find(value => value.startsWith('eve_session='));
  const cookie = sessionCookie.split(';')[0];
  assert.ok(!sessionCookie.includes('refresh-one'));
  const roster = await call(characters, { cookie });
  assert.deepEqual(roster.body, { characters: [{ id: '123', name: 'Pilot 123' }] });
  assert.equal(roster.getHeader('Cache-Control'), 'private, no-store');
  const stored = await readSession(cookie.split('=')[1]);
  assert.equal(stored.characters['123'].refreshToken, 'refresh-one');
  assert.ok(!JSON.stringify([...database.values()]).includes('refresh-one'));
  assert.equal(tokenRequests[0].body.get('grant_type'), 'authorization_code');
  assert.equal(tokenRequests[0].body.get('redirect_uri'), `${origin}/api/auth/callback`);
  const replay = await call(callback, { cookie: flow.cookie, query: { state: flow.state, code: 'one-use-code' } });
  assert.match(replay.location, /auth_error/);
  assert.equal(tokenRequests.length, 1);
});

test('adding an alt preserves existing characters and requires the original browser session', async () => {
  const { id, cookie } = await seed(['456']);
  const flow = await startLogin(cookie);
  const response = await call(callback, { cookie: flow.cookie, query: { state: flow.state, code: 'alt-code' } });
  assert.match(response.location, /linked=1/);
  assert.deepEqual(Object.keys((await readSession(id)).characters).sort(), ['123', '456']);
  const another = await startLogin(cookie);
  const rejected = await call(callback, { cookie: `eve_oauth=${another.state}`, query: { state: another.state, code: 'other-code' } });
  assert.match(rejected.location, /auth_error/);
  assert.equal(tokenRequests.length, 1);
});

test('JWT verification rejects expired, wrong-issuer, wrong-audience, wrong-scope and forged tokens', async () => {
  assert.equal((await verifyAccessToken(await signedToken(), localKeys)).sub, 'CHARACTER:EVE:123');
  for (const overrides of [
    { exp: Math.floor(Date.now() / 1000) - 1 }, { iss: 'https://attacker.example' },
    { aud: ['different-client', 'EVE Online'] }, { aud: ['test-client'] },
    { scp: [] }, { sub: 'not-a-character' }
  ]) await assert.rejects(verifyAccessToken(await signedToken('123', overrides), localKeys));
  const parts = (await signedToken()).split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 1;
  parts[2] = signature.toString('base64url');
  await assert.rejects(verifyAccessToken(parts.join('.'), localKeys));
});

test('anonymous and expired sessions cannot read assets', async () => {
  const anonymous = await call(characters);
  assert.deepEqual(anonymous.body, { characters: [] });
  assert.equal((await call(assets)).statusCode, 401);
  const { id, cookie } = await seed();
  database.get(sessionKey(id)).expires = Date.now() - 1;
  assert.equal((await call(assets, { cookie })).statusCode, 401);
  assert.equal(esiRequests.length, 0);
});

test('users cannot select or unlink a character from another session', async () => {
  const userA = await seed(['123']);
  await seed(['456']);
  assert.equal((await call(assets, { cookie: userA.cookie, query: { character: '456' } })).statusCode, 403);
  assert.equal((await call(characters, { method: 'DELETE', cookie: userA.cookie, query: { id: '456' } })).statusCode, 403);
  assert.equal(esiRequests.length, 0);
});

test('mutations reject missing or foreign origins and unsupported methods', async () => {
  const { cookie } = await seed();
  for (const requestOrigin of ['https://attacker.example', '']) {
    assert.equal((await call(logout, { method: 'POST', cookie, requestOrigin })).statusCode, 403);
    assert.equal((await call(characters, { method: 'DELETE', cookie, query: { id: '123' }, requestOrigin })).statusCode, 403);
  }
  assert.equal((await call(logout, { cookie })).statusCode, 405);
  assert.equal((await call(assets, { method: 'POST', cookie })).statusCode, 405);
});

test('assets include every page and more than 50 types, combine alts, and respect private cache expiry', async () => {
  const { cookie } = await seed(['123', '456']);
  esiResponder = async url => {
    const page = Number(url.searchParams.get('page'));
    const items = Array.from({ length: 30 }, (_, i) => ({ type_id: (page - 1) * 30 + i + 1, quantity: 2 }));
    return json(items, 200, { 'X-Pages': '3', 'Last-Modified': 'Tue, 03 Nov 2026 01:00:00 GMT',
      Expires: new Date(Date.now() + 600000).toUTCString() });
  };
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.assets.length, 90);
  assert.ok(response.body.assets.every(item => item.quantity === 4));
  assert.equal(esiRequests.filter(({ url }) => url.pathname.includes('/assets/')).length, 6);
  const again = await call(assets, { cookie });
  assert.equal(again.statusCode, 200);
  assert.equal(esiRequests.filter(({ url }) => url.pathname.includes('/assets/')).length, 6);
  assert.ok(!JSON.stringify(response.body).includes('old-access-token'));
  assert.equal(response.getHeader('Cache-Control'), 'private, no-store');
});

test('an unavailable asset page returns an error instead of incomplete totals', async () => {
  const { cookie } = await seed();
  esiResponder = async url => url.searchParams.get('page') === '1'
    ? json([{ type_id: 1, quantity: 2 }], 200, { 'X-Pages': '2' })
    : json({ error: 'Upstream failed' }, 503);
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.assets, undefined);
});

test('mixed ESI snapshots are retried and never shown as a complete inventory', async () => {
  const { cookie } = await seed();
  esiResponder = async url => json([{ type_id: 1, quantity: 2 }], 200, {
    'X-Pages': '2', 'Last-Modified': url.searchParams.get('page') === '1' ? 'old' : 'new'
  });
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.assets, undefined);
  assert.equal(esiRequests.length, 4);
});

test('expired tokens are refreshed server-side and rotated refresh tokens are saved', async () => {
  const { id, cookie } = await seed(['123'], Date.now() - 1);
  tokenResponder = async options => {
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    assert.equal(options.body.get('refresh_token'), 'old-refresh-token');
    return json({ access_token: await signedToken(), refresh_token: 'rotated-refresh-token' });
  };
  esiResponder = async (_url, options) => {
    assert.notEqual(options.headers.Authorization, 'Bearer old-access-token');
    return json([]);
  };
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 200);
  assert.equal((await readSession(id)).characters['123'].refreshToken, 'rotated-refresh-token');
  assert.equal(tokenRequests.length, 1);
});

test('revoked refresh tokens produce a relink message without exposing upstream details', async () => {
  const { cookie } = await seed(['123'], Date.now() - 1);
  tokenResponder = async () => json({ error: 'invalid_grant', private_detail: 'do-not-expose' }, 400);
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error, /link this character again/);
  assert.ok(!JSON.stringify(response.body).includes('do-not-expose'));
});

test('simultaneous rejected asset pages refresh the token only once', async () => {
  const { cookie } = await seed();
  esiResponder = async (url, options) => {
    if (url.searchParams.get('page') !== '1' && options.headers.Authorization === 'Bearer old-access-token') {
      return json({ error: 'Token expired' }, 401);
    }
    return json([], 200, { 'X-Pages': '3' });
  };
  const response = await call(assets, { cookie });
  assert.equal(response.statusCode, 200);
  assert.equal(tokenRequests.length, 1);
});

test('a rotated session encryption secret permits a fresh login', async () => {
  const { cookie } = await seed();
  process.env.SESSION_SECRET = 'another-test-encryption-secret-with-32-characters';
  assert.deepEqual((await call(characters, { cookie })).body.characters, []);
  const response = await call(login, { cookie });
  assert.equal(response.statusCode, 302);
});

test('unlink removes access and logout invalidates the server session', async () => {
  const { id, cookie } = await seed(['123', '456']);
  const removed = await call(characters, { method: 'DELETE', cookie, query: { id: '123' } });
  assert.deepEqual(removed.body.characters, [{ id: '456', name: 'Pilot 456' }]);
  assert.equal((await call(assets, { cookie, query: { character: '123' } })).statusCode, 403);
  const response = await call(logout, { method: 'POST', cookie });
  assert.equal(response.statusCode, 200);
  assert.ok(response.getHeader('Set-Cookie')[0].includes('Max-Age=0'));
  assert.equal(await readSession(id), null);
  assert.equal((await call(assets, { cookie })).statusCode, 401);
});

test('missing deployment configuration fails closed with a useful message', async () => {
  delete process.env.SESSION_SECRET;
  const response = await call(login);
  assert.equal(response.statusCode, 503);
  assert.match(response.body.error, /configuration is incomplete/);
  assert.equal(database.size, 0);
});
