import { fetchCharacterAssets, resolveAssetNames } from '../lib/eve.js';
import { endpoint, HttpError, redis, requireSession, seal, sessionKey, unseal } from '../lib/server.js';

export default endpoint(['GET'], async (req, res) => {
  const { id, session } = await requireSession(req);
  const requested = req.query.character;
  if (requested !== undefined && (typeof requested !== 'string' || !/^\d+$/.test(requested))) {
    throw new HttpError(400, 'A valid character ID is required.');
  }
  const ids = requested ? [requested] : Object.keys(session.characters);
  if (ids.some(characterId => !session.characters[characterId])) throw new HttpError(403, 'This character is not linked to your session.');
  const totals = new Map();
  for (const characterId of ids) {
    // Private cache keys are scoped to this session, never shared with other users.
    const cacheKey = `${sessionKey(id)}:assets:${characterId}`;
    const cached = await redis('GET', cacheKey);
    let items;
    if (cached) {
      items = unseal(cached, cacheKey);
    } else {
      const result = await fetchCharacterAssets(id, characterId);
      items = result.items;
      const ttl = Math.floor((result.expires - Date.now()) / 1000);
      if (ttl > 0) await redis('SET', cacheKey, seal(items, cacheKey), 'EX', ttl);
    }
    for (const item of items) totals.set(item.type_id, (totals.get(item.type_id) || 0) + item.quantity);
  }
  const names = await resolveAssetNames([...totals.keys()]);
  const assets = [...totals].map(([typeId, quantity]) => ({ typeId, name: names.get(typeId) || `Type ${typeId}`, quantity }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.status(200).json({ assets });
});
