import { createHash } from 'node:crypto';
import { ASSET_SCOPE } from '../../lib/eve.js';
import { config, cookies, endpoint, hash, OAUTH_COOKIE, randomId, readSession, redis, seal,
  SESSION_COOKIE, setCookie } from '../../lib/server.js';

export default endpoint(['GET'], async (req, res) => {
  const { origin, clientId } = config();
  const existingId = cookies(req)[SESSION_COOKIE];
  const existingSession = await readSession(existingId);
  const state = randomId();
  const verifier = randomId();
  const key = `eve:oauth:${hash(state)}`;
  await redis('SET', key, seal({
    sessionId: existingSession ? existingId : randomId(),
    existing: Boolean(existingSession), verifier
  }, key), 'EX', 600);
  setCookie(res, OAUTH_COOKIE, state, 600, '/api/auth');
  const url = new URL('https://login.eveonline.com/v2/oauth/authorize/');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback`, scope: ASSET_SCOPE, state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256'
  }).toString();
  res.redirect(302, url.toString());
});
