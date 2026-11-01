const statusEl = document.getElementById('server-status');
const playersEl = document.getElementById('player-count');
const plexEl = document.getElementById('plex-price');
const refreshBtn = document.getElementById('refresh-btn');

// --- PAGE NAVIGATION LOGIC ---
const navButtons = document.querySelectorAll('.nav-link[data-target]');
const pages = document.querySelectorAll('.page-view');

function switchPage(targetId) {
  pages.forEach(page => page.classList.remove('active-view'));
  navButtons.forEach(btn => btn.classList.remove('active'));

  const targetPage = document.getElementById(targetId);
  if (targetPage) targetPage.classList.add('active-view');

  const activeBtn = document.querySelector(`.nav-link[data-target="${targetId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    switchPage(targetId);
  });
});

if (window.location.hash === '#my-characters') {
  switchPage('my-characters');
}

// --- COMMAND DECK ESI DATA ---
async function fetchServerStatus() {
  if (!statusEl) return;
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
  if (!plexEl) return;
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

if (refreshBtn) {
  refreshBtn.addEventListener('click', loadAll);
  loadAll();
}

// --- MULTI-CHARACTER EVE SSO CONFIGURATION ---
const CLIENT_ID = 'ad56410943214f14875ece43370095f3';
const CALLBACK_URL = 'https://eveindustry.vercel.app/';
const SCOPES = 'esi-assets.read_assets.v1';

const loginBtn = document.getElementById('login-btn');
const pilotInfoEl = document.getElementById('pilot-info');
const rosterEl = document.getElementById('character-roster');
const assetListEl = document.getElementById('asset-list');
const assetHeaderEl = document.getElementById('asset-header');

// Load saved characters dictionary from localStorage
function getSavedCharacters() {
  const raw = localStorage.getItem('eve_characters');
  return raw ? JSON.parse(raw) : {};
}

function saveCharacter(id, name, accessToken) {
  const chars = getSavedCharacters();
  chars[id] = { id, name, accessToken, updatedAt: Date.now() };
  localStorage.setItem('eve_characters', JSON.stringify(chars));
}

function removeCharacter(id) {
  const chars = getSavedCharacters();
  delete chars[id];
  localStorage.setItem('eve_characters', JSON.stringify(chars));
  renderRoster();
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  values.forEach(v => result += chars[v % chars.length]);
  return result;
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const verifier = generateRandomString(64);
    const state = generateRandomString(16);

    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const challenge = await generateCodeChallenge(verifier);
    const authUrl = `https://login.eveonline.com/v2/oauth/authorize/?response_type=code` +
      `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
      `&client_id=${CLIENT_ID}` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&code_challenge=${challenge}` +
      `&code_challenge_method=S256` +
      `&state=${state}`;

    window.location.href = authUrl;
  });
}

// Render the top-right counter and the clickable character cards
function renderRoster(selectedId = 'ALL') {
  const chars = Object.values(getSavedCharacters());
  if (pilotInfoEl) {
    pilotInfoEl.textContent = `${chars.length} Pilot${chars.length === 1 ? '' : 's'} Linked`;
  }
  if (loginBtn) {
    loginBtn.textContent = chars.length > 0 ? '+ Add Alt' : '+ Add Character';
  }

  if (!rosterEl) return;

  if (chars.length === 0) {
    rosterEl.innerHTML = '<p class="empty-msg">No characters linked yet. Click "+ Add Character" in the top right.</p>';
    if (assetListEl) assetListEl.innerHTML = '<li>Link a character to view hangar assets.</li>';
    return;
  }

  rosterEl.innerHTML = '';

  // 1. Add "All Characters (Combined)" button if more than 1 character is linked
  if (chars.length > 1) {
    const allChip = document.createElement('div');
    allChip.className = `char-chip ${selectedId === 'ALL' ? 'active-char' : ''}`;
    allChip.innerHTML = `<strong>All Alts Combined (${chars.length})</strong>`;
    allChip.addEventListener('click', () => {
      renderRoster('ALL');
      fetchCombinedAssets(chars);
    });
    rosterEl.appendChild(allChip);
  }

  // 2. Add a portrait chip for each individual character
  chars.forEach(char => {
    const chip = document.createElement('div');
    const isSelected = selectedId === char.id || (chars.length === 1 && selectedId === 'ALL');
    chip.className = `char-chip ${isSelected ? 'active-char' : ''}`;
    chip.innerHTML = `
      <img src="https://images.evetech.net/characters/${char.id}/portrait?size=64" alt="${char.name}">
      <span>${char.name}</span>
      <button class="remove-char" title="Remove character">&times;</button>
    `;

    // Click chip to view that specific character's assets
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-char')) {
        e.stopPropagation();
        removeCharacter(char.id);
        return;
      }
      renderRoster(char.id);
      fetchCombinedAssets([char]);
    });

    rosterEl.appendChild(chip);
  });
}

// Fetch and combine assets for 1 or all characters
async function fetchCombinedAssets(charList) {
  if (!assetListEl) return;

  const label = charList.length === 1 ? `${charList[0].name}'s Assets` : `Combined Assets (${charList.length} Pilots)`;
  if (assetHeaderEl) assetHeaderEl.textContent = label;
  assetListEl.innerHTML = '<li>Scanning station hangars...</li>';

  const totals = {};

  for (const char of charList) {
    try {
      const res = await fetch(
        `https://esi.evetech.net/latest/characters/${char.id}/assets/?datasource=tranquility`,
        { headers: { Authorization: `Bearer ${char.accessToken}` } }
      );
      if (!res.ok) continue;
      const assets = await res.json();
      assets.forEach(item => {
        totals[item.type_id] = (totals[item.type_id] || 0) + item.quantity;
      });
    } catch (err) {
      console.error(`Failed fetching assets for ${char.name}`, err);
    }
  }

  const uniqueTypeIds = Object.keys(totals).slice(0, 50).map(Number);
  if (uniqueTypeIds.length === 0) {
    assetListEl.innerHTML = '<li>No assets found (or session expired—click "+ Add Alt" to refresh login).</li>';
    return;
  }

  const namesRes = await fetch(
    'https://esi.evetech.net/latest/universe/names/?datasource=tranquility',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uniqueTypeIds)
    }
  );
  const namesData = await namesRes.json();

  assetListEl.innerHTML = '';
  namesData.forEach(entry => {
    const li = document.createElement('li');
    const qty = totals[entry.id].toLocaleString();
    li.innerHTML = `<span>${entry.name}</span> <span class="qty">x${qty}</span>`;
    assetListEl.appendChild(li);
  });
}

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem('pkce_verifier');

  if (code && verifier) {
    switchPage('my-characters');
    if (pilotInfoEl) pilotInfoEl.textContent = 'Authenticating pilot...';
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code: code,
        code_verifier: verifier
      });

      const tokenRes = await fetch('https://login.eveonline.com/v2/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });
      const tokenData = await tokenRes.json();

      const payload = JSON.parse(atob(tokenData.access_token.split('.')[1]));
      const characterName = payload.name;
      const characterId = payload.sub.split(':')[2];

      saveCharacter(characterId, characterName, tokenData.access_token);
      renderRoster(characterId);
      const chars = getSavedCharacters();
      await fetchCombinedAssets([chars[characterId]]);
      return;
    } catch (err) {
      if (pilotInfoEl) pilotInfoEl.textContent = 'Login failed.';
    }
  }

  // On normal page load, display any already-saved characters
  const existingChars = Object.values(getSavedCharacters());
  renderRoster('ALL');
  if (existingChars.length > 0) {
    fetchCombinedAssets(existingChars);
  }
}

handleCallback();