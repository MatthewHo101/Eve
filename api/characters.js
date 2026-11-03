import { cookies, endpoint, HttpError, publicCharacters, readSession, redis, requireSession, saveSession,
  SESSION_COOKIE, sessionKey, withSessionLock } from '../lib/server.js';

export default endpoint(['GET', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') {
    const session = await readSession(cookies(req)[SESSION_COOKIE]);
    return res.status(200).json({ characters: publicCharacters(session) });
  }
  const { id } = await requireSession(req);
  const characterId = req.query.id;
  if (typeof characterId !== 'string' || !/^\d+$/.test(characterId)) throw new HttpError(400, 'A valid character ID is required.');
  const characters = await withSessionLock(id, async lease => {
    const session = await readSession(id);
    if (!session) throw new HttpError(401, 'Your session has expired.');
    if (!session.characters[characterId]) throw new HttpError(403, 'This character is not linked to your session.');
    delete session.characters[characterId];
    await saveSession(id, session, lease);
    await redis('DEL', `${sessionKey(id)}:assets:${characterId}`);
    return publicCharacters(session);
  });
  res.status(200).json({ characters });
});
