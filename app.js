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

// --- EVE WORKBENCH FITTING SIMULATOR ENGINE ---
const SHIP_HULLS = {
  17715: {
    id: 17715, name: 'Gila', role: 'Guristas Shield & Drone Cruiser',
    high: 5, mid: 6, low: 3, rig: 3,
    cpu: 515, pg: 1050, cal: 400,
    shield: 3600, armor: 1950, hull: 1900,
    baseRes: 0.45, baseDps: 260, speed: 205, align: 5.8, sig: 135
  },
  11985: {
    id: 11985, name: 'Basilisk', role: 'Caldari Logistics Cruiser',
    high: 6, mid: 5, low: 2, rig: 3,
    cpu: 490, pg: 980, cal: 400,
    shield: 3100, armor: 1300, hull: 1350,
    baseRes: 0.50, baseDps: 0, speed: 215, align: 5.5, sig: 95
  },
  33153: {
    id: 33153, name: 'Drake Navy Issue', role: 'Caldari Battlecruiser',
    high: 8, mid: 6, low: 4, rig: 3,
    cpu: 550, pg: 1350, cal: 400,
    shield: 6500, armor: 3200, hull: 3100,
    baseRes: 0.48, baseDps: 180, speed: 165, align: 7.9, sig: 270
  },
  626: {
    id: 626, name: 'Vexor', role: 'Gallente Drone Cruiser',
    high: 4, mid: 4, low: 5, rig: 3,
    cpu: 350, pg: 850, cal: 400,
    shield: 1550, armor: 2100, hull: 2150,
    baseRes: 0.35, baseDps: 210, speed: 218, align: 5.6, sig: 130
  },
  29984: {
    id: 29984, name: 'Tengu', role: 'Caldari Strategic Cruiser',
    high: 6, mid: 6, low: 4, rig: 3,
    cpu: 580, pg: 1180, cal: 400,
    shield: 4200, armor: 2100, hull: 1800,
    baseRes: 0.58, baseDps: 220, speed: 225, align: 4.9, sig: 115
  }
};

const MODULE_DB = [
  // High Slots
  { id: 2410, name: 'Rapid Light Missile Launcher II', slot: 'high', cpu: 33, pg: 18, dps: 75, alpha: 310 },
  { id: 25715, name: 'Heavy Missile Launcher II', slot: 'high', cpu: 44, pg: 22, dps: 68, alpha: 420 },
  { id: 2185, name: 'Medium Neut II', slot: 'high', cpu: 38, pg: 135, dps: 0, alpha: 0 },
  { id: 3578, name: 'Large Remote Shield Booster II', slot: 'high', cpu: 65, pg: 120, dps: 0, alpha: 0 },
  { id: 28999, name: 'Drone Link Augmentor II', slot: 'high', cpu: 28, pg: 1, dps: 0, alpha: 0 },
  // Mid Slots
  { id: 5975, name: '50MN Microwarpdrive II', slot: 'mid', cpu: 50, pg: 150, speedMult: 4.5, sigMult: 2.2 },
  { id: 12058, name: '10MN Afterburner II', slot: 'mid', cpu: 25, pg: 35, speedMult: 1.8, sigMult: 1.0 },
  { id: 3841, name: 'Large Shield Extender II', slot: 'mid', cpu: 42, pg: 135, shieldHp: 2150, sigMult: 1.1 },
  { id: 2281, name: 'Multispectrum Shield Hardener II', slot: 'mid', cpu: 44, pg: 1, resBonus: 0.14 },
  { id: 32780, name: 'Warp Disruptor II', slot: 'mid', cpu: 30, pg: 1 },
  { id: 527, name: 'Stasis Webifier II', slot: 'mid', cpu: 25, pg: 1 },
  { id: 3568, name: 'Medium Cap Booster II', slot: 'mid', cpu: 40, pg: 45 },
  // Low Slots
  { id: 2048, name: 'Damage Control II', slot: 'low', cpu: 30, pg: 1, resBonus: 0.12, hullHp: 400 },
  { id: 4405, name: 'Drone Damage Amplifier II', slot: 'low', cpu: 30, pg: 1, dps: 55 },
  { id: 22291, name: 'Ballistic Control System II', slot: 'low', cpu: 40, pg: 1, dps: 48, alpha: 90 },
  { id: 11269, name: '1600mm Steel Plates II', slot: 'low', cpu: 28, pg: 260, armorHp: 4200, alignAdd: 1.4 },
  { id: 2605, name: 'Nanofiber Internal Structure II', slot: 'low', cpu: 18, pg: 1, speedMult: 1.12, alignAdd: -0.7 },
  // Rig Slots
  { id: 31796, name: 'Medium Core Defense Field Extender II', slot: 'rig', cpu: 0, pg: 0, cal: 150, shieldHp: 1100 },
  { id: 31360, name: 'Medium EM Shield Reinforcer II', slot: 'rig', cpu: 0, pg: 0, cal: 100, resBonus: 0.08 },
  { id: 31177, name: 'Medium Auxiliary Thrusters II', slot: 'rig', cpu: 0, pg: 0, cal: 100, speedMult: 1.09 }
];

const hullSelectEl = document.getElementById('hull-select');
if (hullSelectEl) {
  let currentHull = SHIP_HULLS[17715];
  let fitted = { high: [], mid: [], low: [], rig: [] };
  let activeSlotFilter = 'ALL';
  let esiPriceMap = {};

  // Fetch real live EVE market prices once to price-check any build
  fetch('https://esi.evetech.net/latest/markets/prices/?datasource=tranquility')
    .then(r => r.json())
    .then(items => {
      items.forEach(i => { esiPriceMap[i.type_id] = i.average_price || 0; });
      updateWorkbenchUI();
    }).catch(() => {});

  // Populate Ship Hull dropdown
  Object.values(SHIP_HULLS).forEach(hull => {
    const opt = document.createElement('option');
    opt.value = hull.id;
    opt.textContent = `${hull.name} (${hull.role})`;
    hullSelectEl.appendChild(opt);
  });

  hullSelectEl.addEventListener('change', () => {
    currentHull = SHIP_HULLS[hullSelectEl.value];
    fitted = { high: [], mid: [], low: [], rig: [] };
    updateWorkbenchUI();
  });

  // Module Catalog & Search
  const modSearchEl = document.getElementById('mod-search');
  const catalogEl = document.getElementById('module-catalog');
  const filterBtns = document.querySelectorAll('.slot-filter');

  function renderCatalog() {
    const query = (modSearchEl.value || '').toLowerCase();
    catalogEl.innerHTML = '';

    MODULE_DB.filter(m => {
      const matchesSlot = activeSlotFilter === 'ALL' || m.slot === activeSlotFilter;
      const matchesText = m.name.toLowerCase().includes(query);
      return matchesSlot && matchesText;
    }).forEach(mod => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="mod-item-left">
          <img src="https://images.evetech.net/types/${mod.id}/icon?size=32" alt="">
          <div>
            <div>${mod.name}</div>
            <div class="mod-meta">${mod.slot.toUpperCase()} • ${mod.cpu} tf • ${mod.pg} MW</div>
          </div>
        </div>
        <span>+ Fit</span>
      `;
      li.addEventListener('click', () => equipModule(mod));
      catalogEl.appendChild(li);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSlotFilter = btn.getAttribute('data-slot');
      renderCatalog();
    });
  });

  modSearchEl.addEventListener('input', renderCatalog);

  function equipModule(mod) {
    const maxSlots = currentHull[mod.slot];
    if (fitted[mod.slot].length >= maxSlots) return;
    fitted[mod.slot].push(mod);
    updateWorkbenchUI();
  }

  function unequipModule(slotType, index) {
    fitted[slotType].splice(index, 1);
    updateWorkbenchUI();
  }

  function renderRack(slotType, elId, countElId) {
    const rackEl = document.getElementById(elId);
    const countEl = document.getElementById(countElId);
    const max = currentHull[slotType];
    const items = fitted[slotType];

    countEl.textContent = `${items.length} / ${max}`;
    rackEl.innerHTML = '';

    for (let i = 0; i < max; i++) {
      const mod = items[i];
      const div = document.createElement('div');
      if (mod) {
        div.className = 'slot-item filled-slot';
        div.innerHTML = `
          <div class="mod-item-left">
            <img src="https://images.evetech.net/types/${mod.id}/icon?size=32" alt="">
            <span>${mod.name}</span>
          </div>
          <span class="mod-meta">${mod.cpu} tf | ${mod.pg} MW &times;</span>
        `;
        div.addEventListener('click', () => unequipModule(slotType, i));
      } else {
        div.className = 'slot-item empty-slot';
        div.textContent = `[ Empty ${slotType.toUpperCase()} Slot ]`;
      }
      rackEl.appendChild(div);
    }
  }

  function updateWorkbenchUI() {
    document.getElementById('ship-render').src = `https://images.evetech.net/types/${currentHull.id}/render?size=256`;
    document.getElementById('wb-ship-name').textContent = currentHull.name;
    document.getElementById('wb-ship-role').textContent = `${currentHull.role} • Click any fitted module to unequip`;

    renderRack('high', 'rack-high', 'high-count');
    renderRack('mid', 'rack-mid', 'mid-count');
    renderRack('low', 'rack-low', 'low-count');
    renderRack('rig', 'rack-rig', 'rig-count');

    // Calculate combined stats
    const allMods = [...fitted.high, ...fitted.mid, ...fitted.low, ...fitted.rig];
    let usedCpu = 0, usedPg = 0, usedCal = 0;
    let dps = currentHull.baseDps, alpha = 0;
    let shield = currentHull.shield, armor = currentHull.armor, hull = currentHull.hull;
    let resist = currentHull.baseRes;
    let speed = currentHull.speed, align = currentHull.align, sig = currentHull.sig;
    let totalIsk = esiPriceMap[currentHull.id] || 150000000;

    allMods.forEach(m => {
      usedCpu += m.cpu || 0;
      usedPg += m.pg || 0;
      usedCal += m.cal || 0;
      dps += m.dps || 0;
      alpha += m.alpha || 0;
      shield += m.shieldHp || 0;
      armor += m.armorHp || 0;
      hull += m.hullHp || 0;
      if (m.resBonus) resist += (1 - resist) * m.resBonus;
      if (m.speedMult) speed = Math.round(speed * m.speedMult);
      if (m.sigMult) sig = Math.round(sig * m.sigMult);
      if (m.alignAdd) align = Math.max(1.5, +(align + m.alignAdd).toFixed(1));
      totalIsk += esiPriceMap[m.id] || 2500000;
    });

    const ehp = Math.round((shield + armor + hull) / (1 - Math.min(0.88, resist)));

    // Resource Bars
    const cpuPct = Math.min(100, (usedCpu / currentHull.cpu) * 100);
    const pgPct = Math.min(100, (usedPg / currentHull.pg) * 100);
    const calPct = Math.min(100, (usedCal / currentHull.cal) * 100);

    document.getElementById('cpu-text').textContent = `${usedCpu} / ${currentHull.cpu} tf`;
    const cpuBar = document.getElementById('cpu-bar');
    cpuBar.style.width = `${cpuPct}%`;
    cpuBar.classList.toggle('overloaded', usedCpu > currentHull.cpu);

    document.getElementById('pg-text').textContent = `${usedPg} / ${currentHull.pg} MW`;
    const pgBar = document.getElementById('pg-bar');
    pgBar.style.width = `${pgPct}%`;
    pgBar.classList.toggle('overloaded', usedPg > currentHull.pg);

    document.getElementById('cal-text').textContent = `${usedCal} / ${currentHull.cal}`;
    const calBar = document.getElementById('cal-bar');
    calBar.style.width = `${calPct}%`;
    calBar.classList.toggle('overloaded', usedCal > currentHull.cal);

    // Numerical Readouts
    document.getElementById('stat-dps').textContent = `${dps.toFixed(1)} DPS`;
    document.getElementById('stat-alpha').textContent = alpha.toLocaleString();
    document.getElementById('stat-ehp').textContent = `${ehp.toLocaleString()} EHP`;
    document.getElementById('stat-shield').textContent = `${shield.toLocaleString()} HP`;
    document.getElementById('stat-armor').textContent = `${armor.toLocaleString()} HP`;
    document.getElementById('stat-hull').textContent = `${hull.toLocaleString()} HP`;
    document.getElementById('stat-speed').textContent = `${speed.toLocaleString()} m/s`;
    document.getElementById('stat-align').textContent = `${align} s`;
    document.getElementById('stat-sig').textContent = `${sig} m`;
    document.getElementById('stat-isk').textContent = `${(totalIsk / 1e6).toFixed(1)}M ISK`;

    // Sync EFT Box
    const eftLines = [`[${currentHull.name}, Corp Workbench Fit]`];
    ['low', 'mid', 'high', 'rig'].forEach(slot => {
      fitted[slot].forEach(m => eftLines.push(m.name));
      eftLines.push('');
    });
    document.getElementById('eft-box').value = eftLines.join('\n').trim();
  }

  document.getElementById('clear-fit-btn').addEventListener('click', () => {
    fitted = { high: [], mid: [], low: [], rig: [] };
    updateWorkbenchUI();
  });

  document.getElementById('export-eft-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('eft-box').value);
    const btn = document.getElementById('export-eft-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy EFT'; }, 1500);
  });

  document.getElementById('import-eft-btn').addEventListener('click', () => {
    const lines = document.getElementById('eft-box').value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    if (lines[0].startsWith('[')) {
      const hullName = lines[0].replace('[', '').split(',')[0].trim().toLowerCase();
      const matchedHull = Object.values(SHIP_HULLS).find(h => h.name.toLowerCase() === hullName);
      if (matchedHull) {
        currentHull = matchedHull;
        hullSelectEl.value = matchedHull.id;
      }
    }
    fitted = { high: [], mid: [], low: [], rig: [] };
    lines.slice(1).forEach(line => {
      const cleanName = line.split(',')[0].trim().toLowerCase();
      const mod = MODULE_DB.find(m => m.name.toLowerCase() === cleanName);
      if (mod && fitted[mod.slot].length < currentHull[mod.slot]) {
        fitted[mod.slot].push(mod);
      }
    });
    updateWorkbenchUI();
  });

  renderCatalog();
  updateWorkbenchUI();
}