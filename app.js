const statusEl = document.getElementById('server-status');
const playersEl = document.getElementById('player-count');
const plexEl = document.getElementById('plex-price');
const refreshBtn = document.getElementById('refresh-btn');

async function fetchServerStatus() {
  try {
    const response = await fetch('https://esi.evetech.net/latest/status/?datasource=tranquility');
    const data = await response.json();
    statusEl.textContent = 'Status: ONLINE';
    statusEl.style.color = '#4ade80';
    playersEl.textContent = `Pilots currently in New Eden: ${data.players.toLocaleString()}`;
  } catch (error) {
    statusEl.textContent = 'Status: OFFLINE / VIP Mode';
    statusEl.style.color = '#f87171';
  }
}
async function fetchPlexPrice() {
  try {
    plexEl.textContent = 'Updating...';
    const response = await fetch('https://esi.evetech.net/latest/markets/prices/?datasource=tranquility');
    const items = await response.json();
    const plex = items.find(item => item.type_id === 44992);
    if (plex) {
      plexEl.textContent = `Average Price: ${Math.round(plex.average_price).toLocaleString()} ISK`;
    }
  } catch (error) {
    plexEl.textContent = 'Failed to load market data.';
  }
}
function loadAll() {
  fetchServerStatus();
  fetchPlexPrice();
}

refreshBtn.addEventListener('click', loadAll);
loadAll();

// --- EVE SSO CONFIGURATION ---
const CLIENT_ID = 'ad56410943214f14875ece43370095f3';
const CALLBACK_URL = 'https://eveindustry.vercel.app/';
const SCOPES = 'esi-assets.read_assets.v1';