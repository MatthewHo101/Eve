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

// --- COMMAND DECK ESI DATA ---
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

const loginBtn = document.getElementById('login-btn');
const pilotInfoEl = document.getElementById('pilot-info');
const assetListEl = document.getElementById('asset-list');

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

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem('pkce_verifier');

  if (!code || !verifier) return;

  // Automatically jump to the My Characters tab when returning from login
  switchPage('my-characters');

  pilotInfoEl.textContent = 'Authenticating with CONCORD...';
  loginBtn.style.display = 'none';

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