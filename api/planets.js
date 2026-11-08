import { cookies, endpoint, HttpError, readSession, requireSession, SESSION_COOKIE } from '../lib/server.js';
import { fetchCharacterPlanets, fetchPlanetDetails } from '../lib/eve.js';

export default endpoint(['GET'], async (req, res) => {
  const { id } = await requireSession(req);
  const characterId = req.query.id;
  if (typeof characterId !== 'string' || !/^\d+$/.test(characterId)) {
    throw new HttpError(400, 'A valid character ID is required.');
  }

  const planets = await fetchCharacterPlanets(id, characterId);
  
  // Optionally fetch details for all planets at once or let the frontend do it
  // Since we want an overview, we probably need the details to see what's being produced and extraction status.
  const planetsWithDetails = await Promise.all(planets.map(async planet => {
    try {
      const details = await fetchPlanetDetails(id, characterId, planet.planet_id);
      return { ...planet, details };
    } catch (e) {
      return { ...planet, details: null, error: e.message };
    }
  }));

  res.status(200).json({ planets: planetsWithDetails });
});