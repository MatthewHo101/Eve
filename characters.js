// EVE tokens stay on the server. This client receives character names and assets only.
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const pilotInfoEl = document.getElementById('pilot-info');
const rosterEl = document.getElementById('character-roster');
const assetListEl = document.getElementById('asset-list');
const assetHeaderEl = document.getElementById('asset-header');
const authMessageEl = document.getElementById('auth-message');
let characters = [];
let assetLoadVersion = 0;

// Remove credentials left behind by the old browser-only login implementation.
try {
  localStorage.removeItem('eve_characters');
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('oauth_state');
} catch { /* Login also works when browser storage is disabled. */ }

async function characterApi(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load character data. Please try again.');
  return data;
}

function showAuthMessage(message) {
  authMessageEl.textContent = message;
  authMessageEl.hidden = !message;
}

function showAssetMessage(message) {
  if (!assetListEl) return;
  const li = document.createElement('li');
  li.textContent = message;
  assetListEl.replaceChildren(li);
}

loginBtn.addEventListener('click', () => { window.location.assign('/api/auth/login'); });

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await characterApi('/api/auth/logout', { method: 'POST' });
    assetLoadVersion++;
    characters = [];
    renderRoster();
    showAuthMessage('Signed out.');
  } catch (error) {
    showAuthMessage(error.message);
  } finally {
    logoutBtn.disabled = false;
  }
});

function renderRoster(selectedId = 'ALL') {
  pilotInfoEl.textContent = `${characters.length} Pilot${characters.length === 1 ? '' : 's'} Linked`;
  loginBtn.textContent = characters.length ? '+ Add Alt' : '+ Add Character';
  logoutBtn.hidden = characters.length === 0;
  if (!rosterEl) return;
  rosterEl.replaceChildren();
  if (!characters.length) {
    const message = document.createElement('p');
    message.className = 'empty-msg';
    message.textContent = 'No characters linked yet. Click "+ Add Character" in the top right.';
    rosterEl.appendChild(message);
    assetHeaderEl.textContent = 'Pilot Assets & Materials';
    showAssetMessage('Link a character to view hangar assets.');
    return;
  }
  if (characters.length > 1) {
    const chip = document.createElement('button');
    chip.className = `char-chip ${selectedId === 'ALL' ? 'active-char' : ''}`;
    chip.textContent = `All Alts Combined (${characters.length})`;
    chip.addEventListener('click', () => { renderRoster(); fetchCombinedAssets(); });
    rosterEl.appendChild(chip);
  }
  for (const character of characters) {
    const chip = document.createElement('div');
    const selected = selectedId === character.id || (characters.length === 1 && selectedId === 'ALL');
    chip.className = `char-chip ${selected ? 'active-char' : ''}`;
    const select = document.createElement('button');
    select.className = 'char-select';
    const image = document.createElement('img');
    image.src = `https://images.evetech.net/characters/${character.id}/portrait?size=64`;
    image.alt = '';
    const name = document.createElement('span');
    name.textContent = character.name;
    select.append(image, name);
    select.addEventListener('click', () => { renderRoster(character.id); fetchCombinedAssets(character.id); });
    const remove = document.createElement('button');
    remove.className = 'remove-char';
    remove.textContent = '\u00d7';
    remove.title = `Remove ${character.name}`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', async () => {
      remove.disabled = true;
      try {
        const data = await characterApi(`/api/characters?id=${encodeURIComponent(character.id)}`, { method: 'DELETE' });
        assetLoadVersion++;
        characters = data.characters;
        renderRoster();
        if (characters.length) await fetchCombinedAssets();
      } catch (error) {
        showAuthMessage(error.message);
        remove.disabled = false;
      }
    });
    chip.append(select, remove);
    rosterEl.appendChild(chip);
  }
}

async function fetchCombinedAssets(characterId) {
  if (!assetListEl) return;
  const version = ++assetLoadVersion;
  const selected = characters.find(character => character.id === characterId);
  assetHeaderEl.textContent = selected ? `${selected.name}'s Assets` : `Combined Assets (${characters.length} Pilots)`;
  showAssetMessage('Loading character assets...');
  try {
    const query = characterId ? `?character=${encodeURIComponent(characterId)}` : '';
    const { assets } = await characterApi(`/api/assets${query}`);
    if (version !== assetLoadVersion) return;
    if (!assets.length) return showAssetMessage('No assets found.');
    const rows = assets.map(asset => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = asset.name;
      const quantity = document.createElement('span');
      quantity.className = 'qty';
      quantity.textContent = `x${asset.quantity.toLocaleString()}`;
      li.append(name, quantity);
      return li;
    });
    assetListEl.replaceChildren(...rows);
  } catch (error) {
    if (version === assetLoadVersion) showAssetMessage(error.message);
  }
}

async function loadCharacters() {
  const params = new URLSearchParams(window.location.search);
  const loginFailed = params.has('auth_error');
  if (loginFailed || params.has('linked')) {
    showAuthMessage(loginFailed ? 'EVE login failed or expired. Please try linking your character again.' : 'Character linked successfully.');
    params.delete('auth_error');
    params.delete('linked');
    const query = params.toString();
    window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }
  // Old login callbacks cannot be reused by the new server session flow.
  if (params.has('code') || params.has('state')) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
    showAuthMessage('Login has been upgraded. Please link your characters again.');
  }
  try {
    const data = await characterApi('/api/characters');
    characters = data.characters;
    renderRoster();
    if (characters.length) await fetchCombinedAssets();
  } catch (error) {
    showAuthMessage(error.message);
  }
}

loadCharacters();
