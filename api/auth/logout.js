import { cookies, endpoint, redis, SESSION_COOKIE, sessionKey, setCookie, validId, withSessionLock } from '../../lib/server.js';

export default endpoint(['POST'], async (req, res) => {
  const id = cookies(req)[SESSION_COOKIE];
  if (validId(id)) await withSessionLock(id, () => redis('DEL', sessionKey(id)));
  setCookie(res, SESSION_COOKIE, '', 0);
  res.status(200).json({ ok: true });
});
