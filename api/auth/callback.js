import { characterFromTokens, exchangeToken, verifyAccessToken } from '../../lib/eve.js';
import { config, cookies, endpoint, equal, hash, OAUTH_COOKIE, readSession, redis, saveSession,
  SESSION_COOKIE, SESSION_TTL, setCookie, unseal, validId, withSessionLock } from '../../lib/server.js';

export default endpoint(['GET'], async (req, res) => {
  const browserCookies = cookies(req);
  const { state, code, error } = req.query;
  setCookie(res, OAUTH_COOKIE, '', 0, '/api/auth');
  try {
    if (!validId(state) || !equal(state, browserCookies[OAUTH_COOKIE])) throw new Error('Invalid state');
    const key = `eve:oauth:${hash(state)}`;
    const raw = await redis('GETDEL', key);
    if (!raw || error || typeof code !== 'string' || !code) throw new Error('Invalid callback');
    const flow = unseal(raw, key);
    if (flow.existing && !equal(browserCookies[SESSION_COOKIE], flow.sessionId)) throw new Error('Session changed');
    const tokens = await exchangeToken({ grant_type: 'authorization_code', code,
      code_verifier: flow.verifier, redirect_uri: `${config().origin}/api/auth/callback` });
    const claims = await verifyAccessToken(tokens.access_token);
    const character = characterFromTokens(tokens, claims);
    const session = await withSessionLock(flow.sessionId, async lease => {
      const current = await readSession(flow.sessionId);
      if (flow.existing && !current) throw new Error('Session expired');
      const next = current || { characters: {}, expiresAt: Date.now() + SESSION_TTL * 1000 };
      next.characters[character.id] = character;
      await saveSession(flow.sessionId, next, lease);
      return next;
    });
    setCookie(res, SESSION_COOKIE, flow.sessionId, Math.floor((session.expiresAt - Date.now()) / 1000));
    res.redirect(302, '/?linked=1#my-characters');
  } catch {
    res.redirect(302, '/?auth_error=login_failed#my-characters');
  }
});
