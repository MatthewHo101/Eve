import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'eve_session';
export const OAUTH_COOKIE = 'eve_oauth';
export const SESSION_TTL = 60 * 60 * 24 * 30;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function config() {
  const required = ['APP_URL', 'EVE_CLIENT_ID', 'EVE_CLIENT_SECRET', 'SESSION_SECRET',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  if (required.some(name => !process.env[name]) || process.env.SESSION_SECRET.length < 32) {
    throw new HttpError(503, 'Server configuration is incomplete. Check the deployment environment variables.');
  }
  const origin = new URL(process.env.APP_URL).origin;
  const storageUrl = new URL(process.env.UPSTASH_REDIS_REST_URL);
  if ((!origin.startsWith('https://') && !/^http:\/\/localhost(:\d+)?$/.test(origin)) || storageUrl.protocol !== 'https:') {
    throw new HttpError(503, 'Server URLs are configured incorrectly.');
  }
  return { origin, clientId: process.env.EVE_CLIENT_ID, clientSecret: process.env.EVE_CLIENT_SECRET };
}

export function privateResponse(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

export function endpoint(methods, handler) {
  return async (req, res) => {
    privateResponse(res);
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    try {
      config();
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== config().origin) {
        throw new HttpError(403, 'Request origin is not allowed.');
      }
      await handler(req, res);
    } catch (error) {
      // Never log upstream responses, codes, cookies, tokens, or database credentials.
      res.status(error instanceof HttpError ? error.status : 502)
        .json({ error: error instanceof HttpError ? error.message : 'The service is temporarily unavailable. Please try again.' });
    }
  };
}

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(part => {
    const i = part.indexOf('=');
    return i < 0 ? ['', ''] : [part.slice(0, i).trim(), part.slice(i + 1).trim()];
  }));
}

export function setCookie(res, name, value, maxAge, path = '/') {
  const secure = config().origin.startsWith('https://') ? '; Secure' : '';
  const cookie = `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  const existing = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : [existing]), cookie]);
}

export const randomId = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
export const sessionKey = id => `eve:session:${hash(id)}`;

function encryptionKey() {
  return createHash('sha256').update(process.env.SESSION_SECRET).digest();
}

export function seal(value, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function unseal(value, context) {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'));
}

export async function redis(...command) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new HttpError(503, 'Session storage is temporarily unavailable.');
  const data = await response.json();
  if (data.error) throw new HttpError(503, 'Session storage is temporarily unavailable.');
  return data.result;
}

export async function readSession(id) {
  if (!validId(id)) return null;
  const key = sessionKey(id);
  const value = await redis('GET', key);
  if (!value) return null;
  let session;
  try {
    session = unseal(value, key);
  } catch {
    // A rotated encryption key invalidates old cookies without preventing a new login.
    return null;
  }
  return session.expiresAt > Date.now() ? session : null;
}

export async function requireSession(req) {
  const id = cookies(req)[SESSION_COOKIE];
  const session = await readSession(id);
  if (!session) throw new HttpError(401, 'Your session has expired. Please link your character again.');
  return { id, session };
}

export async function saveSession(id, session, lease) {
  const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
  if (ttl <= 0) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  const key = sessionKey(id);
  const encrypted = seal(session, key);
  if (lease) {
    const saved = await redis('EVAL',
      'if redis.call("GET", KEYS[1]) == ARGV[1] then redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3]); return 1 else return 0 end',
      2, lease.key, key, lease.owner, encrypted, ttl);
    if (!saved) throw new HttpError(409, 'Your session changed during this request. Please try again.');
  } else {
    await redis('SET', key, encrypted, 'EX', ttl);
  }
}

// Serialize token refresh, linking, unlinking, and logout across Vercel instances.
export async function withSessionLock(id, action) {
  const key = `${sessionKey(id)}:lock`;
  const owner = randomId();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await redis('SET', key, owner, 'NX', 'EX', 60)) {
      try {
        return await action({ key, owner });
      } finally {
        await redis('EVAL', 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end', 1, key, owner);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new HttpError(409, 'Another character update is in progress. Please try again.');
}

export function publicCharacters(session) {
  return Object.values(session?.characters || {}).map(({ id, name }) => ({ id, name }));
}
