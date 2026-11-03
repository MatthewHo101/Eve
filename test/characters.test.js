import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import vm from 'node:vm';

class Element {
  constructor() { this.children = []; this.listeners = {}; this.textContent = ''; this.hidden = false; }
  append(...elements) { this.children.push(...elements); }
  appendChild(element) { this.append(element); }
  replaceChildren(...elements) { this.children = elements; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this[name] = value; }
  click() { return this.listeners.click(); }
}

async function loadClient(fetch) {
  const elements = Object.fromEntries(['login-btn', 'logout-btn', 'pilot-info', 'character-roster',
    'asset-list', 'asset-header', 'auth-message'].map(id => [id, new Element()]));
  const removed = [];
  const location = { search: '', pathname: '/', hash: '', assign(url) { this.destination = url; } };
  const source = await readFile(new URL('../characters.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    document: { getElementById: id => elements[id], createElement: () => new Element(), title: 'EVE' },
    window: { location, history: { replaceState() {} } }, URLSearchParams,
    localStorage: { removeItem: key => removed.push(key) },
    sessionStorage: { removeItem: key => removed.push(key) }, fetch
  });
  await setImmediate();
  return { elements, removed, location };
}

const response = body => ({ ok: true, json: async () => body });

test('client removes legacy credentials and starts login through the server', async () => {
  const { elements, removed, location } = await loadClient(async (path, options) => {
    assert.equal(path, '/api/characters');
    assert.equal(options.credentials, 'same-origin');
    return response({ characters: [] });
  });
  assert.deepEqual(removed.sort(), ['eve_characters', 'oauth_state', 'pkce_verifier']);
  assert.equal(elements['pilot-info'].textContent, '0 Pilots Linked');
  assert.equal(elements['logout-btn'].hidden, true);
  elements['login-btn'].click();
  assert.equal(location.destination, '/api/auth/login');
});

test('character and item names render as text, and sign-out clears private results', async () => {
  const calls = [];
  const { elements } = await loadClient(async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/characters') return response({ characters: [{ id: '123', name: '<img onerror=bad()>' }] });
    if (path === '/api/assets') return response({ assets: [{ typeId: 1, name: '<script>bad()</script>', quantity: 5 }] });
    if (path === '/api/auth/logout') return response({ ok: true });
    throw new Error('Unexpected browser request');
  });
  assert.equal(elements['character-roster'].children[0].children[0].children[1].textContent, '<img onerror=bad()>');
  assert.equal(elements['asset-list'].children[0].children[0].textContent, '<script>bad()</script>');
  await elements['logout-btn'].click();
  assert.equal(calls.at(-1).options.method, 'POST');
  assert.equal(elements['pilot-info'].textContent, '0 Pilots Linked');
  assert.equal(elements['asset-list'].children[0].textContent, 'Link a character to view hangar assets.');
});

test('a late asset response cannot restore private rows after logout', async () => {
  let finishAssets;
  const { elements } = await loadClient(async path => {
    if (path === '/api/characters') return response({ characters: [{ id: '123', name: 'Pilot' }] });
    if (path === '/api/assets') return new Promise(resolve => { finishAssets = resolve; });
    return response({ ok: true });
  });
  await elements['logout-btn'].click();
  finishAssets(response({ assets: [{ typeId: 1, name: 'Private item', quantity: 5 }] }));
  await setImmediate();
  assert.equal(elements['asset-list'].children[0].textContent, 'Link a character to view hangar assets.');
});
