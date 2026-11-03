import { DOCTRINE_FITS, RACKS, filterFits, exportFit } from './doctrine-data.js';
import { renderFittingRing } from './fitting-ring.js';

const byId = id => document.getElementById(id);
let selected = DOCTRINE_FITS.find(fit => fit.id === new URLSearchParams(location.search).get('doctrine')) || DOCTRINE_FITS[0];
let category = 'All';
let itemIds = {};
try { itemIds = JSON.parse(localStorage.getItem('eve_doctrine_types_v1') || '{}') || {}; } catch { /* Optional icon cache. */ }

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function shipImage(fit, size) {
  return `https://images.evetech.net/types/${fit.typeId}/render?size=${size}`;
}

function moduleIcon(name, rack) {
  const icon = element('span', `doctrine-module-icon icon-${rack}`);
  icon.setAttribute('aria-hidden', 'true');
  if (Number.isInteger(itemIds[name]) && itemIds[name] > 0) {
    const image = element('img');
    image.src = `https://images.evetech.net/types/${itemIds[name]}/icon?size=64`;
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    icon.append(image);
  }
  return icon;
}

function renderFilters() {
  byId('doctrine-categories').replaceChildren(...['All', ...new Set(DOCTRINE_FITS.map(fit => fit.category))].map(name => {
    const button = element('button', '', name);
    button.setAttribute('aria-pressed', String(category === name));
    button.addEventListener('click', () => { category = name; renderFilters(); renderList(); });
    return button;
  }));
}

function renderList() {
  const fits = filterFits(byId('doctrine-search').value, category);
  byId('doctrine-result-count').textContent = `${fits.length} FIT${fits.length === 1 ? '' : 'S'}`;
  byId('doctrine-fit-list').replaceChildren(...fits.map(fit => {
    const button = element('button', 'doctrine-fit-card');
    button.setAttribute('aria-pressed', String(selected.id === fit.id));
    const image = element('img');
    image.src = shipImage(fit, 128);
    image.alt = '';
    image.width = image.height = 80;
    image.loading = 'lazy';
    image.addEventListener('error', () => { image.style.visibility = 'hidden'; }, { once: true });
    const info = element('span', 'doctrine-fit-card-info');
    info.append(element('strong', '', fit.name), element('span', 'doctrine-card-hull', fit.hull),
      element('span', 'doctrine-card-category', fit.category), element('span', 'doctrine-card-role', fit.role));
    button.append(image, info);
    button.addEventListener('click', () => {
      selected = fit;
      const url = new URL(location.href);
      url.searchParams.set('doctrine', fit.id);
      history.replaceState(null, '', url);
      renderList();
      renderDetail();
    });
    return button;
  }));
  if (!fits.length) {
    const message = element('div', 'doctrine-empty');
    message.append(element('strong', '', 'No matching fits'), element('p', '', 'Try another ship name or clear your filters.'));
    const reset = element('button', 'doctrine-button', 'Clear filters');
    reset.addEventListener('click', () => { category = 'All'; byId('doctrine-search').value = ''; renderFilters(); renderList(); });
    message.append(reset);
    byId('doctrine-fit-list').append(message);
  }
}

function renderModules() {
  byId('doctrine-modules').replaceChildren(...RACKS.filter(([key]) => selected.modules[key]?.length).map(([key, title, label]) => {
    const section = element('section', 'doctrine-rack');
    section.append(element('h3', '', title));
    const list = element('ul');
    for (const name of selected.modules[key]) {
      const row = element('li', 'doctrine-module-row');
      const text = element('span', 'doctrine-module-name');
      text.append(element('strong', '', name), element('small', '', label));
      row.append(moduleIcon(name, key), text, element('span', 'doctrine-module-quantity', '× 1'));
      list.append(row);
    }
    section.append(list);
    return section;
  }));

  renderFittingRing(byId('doctrine-fitting-ring'), {
    name: selected.hull, typeId: selected.typeId,
    racks: Object.fromEntries(RACKS.slice(0, 4).map(([key]) => [key,
      selected.modules[key].map(name => ({ name, typeId: itemIds[name] }))]))
  });
}

function renderDetail() {
  byId('doctrine-title').textContent = selected.name;
  byId('doctrine-role').textContent = selected.role;
  byId('doctrine-description').textContent = selected.description;
  byId('doctrine-hull-class').textContent = selected.className;
  byId('doctrine-copy-status').textContent = '';
  byId('doctrine-slot-summary').replaceChildren(...RACKS.slice(0, 4).map(([key, , label]) => {
    const cell = element('span');
    cell.append(element('strong', '', String(selected.modules[key].length)), document.createTextNode(` ${label}`));
    return cell;
  }));
  renderModules();
  const skills = element('ul', 'doctrine-skill-list');
  for (const [name, level] of selected.skills) {
    const row = element('li');
    const bars = element('span', 'doctrine-skill-level');
    bars.setAttribute('aria-label', `Level ${level}`);
    for (let i = 1; i <= 5; i++) bars.append(element('i', i <= level ? 'filled' : ''));
    row.append(element('strong', '', name), bars, element('span', 'doctrine-skill-roman', ['I', 'II', 'III', 'IV', 'V'][level - 1]));
    skills.append(row);
  }
  byId('doctrine-skills').replaceChildren(element('h3', 'doctrine-skills-title', 'Key training requirements'), skills,
    element('p', 'doctrine-skills-note', 'Selected hull and module requirements, not a complete training plan. Character skills are not synced; these levels do not indicate whether your pilot can fly this fit.'));
}

const tabs = [byId('doctrine-modules-tab'), byId('doctrine-skills-tab')];
function activateTab(active) {
  tabs.forEach(tab => {
    const isActive = tab === active;
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    byId(tab.getAttribute('aria-controls')).hidden = !isActive;
  });
}
tabs.forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs[1 - tabs.indexOf(tab)];
    activateTab(next);
    next.focus();
  });
});

async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    byId('doctrine-copy-status').textContent = success;
  } catch {
    byId('doctrine-copy-text').value = text;
    byId('doctrine-copy-dialog').showModal();
    byId('doctrine-copy-text').focus();
    byId('doctrine-copy-text').select();
  }
}
byId('doctrine-copy-fit').addEventListener('click', () => copyText(exportFit(selected), 'EFT fit copied. Paste it into EVE’s fitting window.'));
byId('doctrine-copy-link').addEventListener('click', () => {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('doctrine', selected.id);
  url.hash = 'corp-doctrines';
  copyText(url.href, 'Link to this fit copied.');
});
byId('doctrine-search').addEventListener('input', renderList);

renderFilters();
renderList();
renderDetail();

// Resolve item names rather than guessing type IDs. The layout works offline;
// real EVE icons replace the rack symbols when public ESI is available.
async function resolveIcons() {
  const names = [...new Set(DOCTRINE_FITS.flatMap(fit => Object.values(fit.modules).flat()))].filter(name => !itemIds[name]);
  if (!names.length) return;
  try {
    const response = await fetch('https://esi.evetech.net/latest/universe/ids/?datasource=tranquility', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(names), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return;
    const data = await response.json();
    for (const item of data.inventory_types || []) itemIds[item.name] = item.id;
    try { localStorage.setItem('eve_doctrine_types_v1', JSON.stringify(itemIds)); } catch { /* Storage is optional. */ }
    renderModules();
  } catch { /* Keep readable rack symbols if ESI is unavailable. */ }
}
resolveIcons();
