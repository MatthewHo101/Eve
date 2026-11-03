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

// --- LIVE ESI ALL-SHIPS & ALL-MODULES WORKBENCH ENGINE ---
const DOGMA_ATTR = {
  CPU_OUTPUT: 48,
  PG_OUTPUT: 11,
  CAL_OUTPUT: 1132,
  HIGH_SLOTS: 14,
  MID_SLOTS: 13,
  LOW_SLOTS: 12,
  RIG_SLOTS: 1137,
  SHIELD_HP: 263,
  ARMOR_HP: 265,
  HULL_HP: 9,
  MAX_VELOCITY: 37,
  INERTIA: 70,
  MASS: 4,
  SIG_RADIUS: 552,
  CPU_LOAD: 50,
  PG_LOAD: 30,
  RIG_COST: 1153,
  SHIELD_BONUS: 72,
  ARMOR_BONUS: 1159,
  SPEED_FACTOR: 20,
  ROF: 51,
  DMG_MULT: 64
};

const DOGMA_EFFECT = {
  LOW_SLOT: 11,
  HIGH_SLOT: 12,
  MID_SLOT: 13,
  RIG_SLOT: 2663
};

const STARTER_HULLS = [
  { id: 17715, name: 'Gila', className: 'Cruiser', nation: 'Pirate' },
  { id: 11985, name: 'Basilisk', className: 'Logistics', nation: 'Caldari' },
  { id: 33153, name: 'Drake Navy Issue', className: 'Combat Battlecruiser', nation: 'Caldari' },
  { id: 29984, name: 'Tengu', className: 'Strategic Cruiser', nation: 'Caldari' },
  { id: 29986, name: 'Legion', className: 'Strategic Cruiser', nation: 'Amarr' },
  { id: 29988, name: 'Proteus', className: 'Strategic Cruiser', nation: 'Gallente' },
  { id: 29990, name: 'Loki', className: 'Strategic Cruiser', nation: 'Minmatar' },
  { id: 12005, name: 'Ishtar', className: 'Heavy Assault Cruiser', nation: 'Gallente' },
  { id: 28661, name: 'Kronos', className: 'Marauder', nation: 'Gallente' },
  { id: 28665, name: 'Vargur', className: 'Marauder', nation: 'Minmatar' },
  { id: 28659, name: 'Paladin', className: 'Marauder', nation: 'Amarr' },
  { id: 28710, name: 'Golem', className: 'Marauder', nation: 'Caldari' },
  { id: 626, name: 'Vexor', className: 'Cruiser', nation: 'Gallente' },
  { id: 24690, name: 'Ferox', className: 'Combat Battlecruiser', nation: 'Caldari' },
  { id: 645, name: 'Dominix', className: 'Battleship', nation: 'Gallente' }
];

const STARTER_MODULES = [
  { id: 2410, name: 'Rapid Light Missile Launcher II', slot: 'high', cpu: 33, pg: 18, dps: 75, alpha: 310 },
  { id: 25715, name: 'Heavy Missile Launcher II', slot: 'high', cpu: 44, pg: 22, dps: 68, alpha: 420 },
  { id: 3578, name: 'Large Remote Shield Booster II', slot: 'high', cpu: 65, pg: 120 },
  { id: 5975, name: '50MN Microwarpdrive II', slot: 'mid', cpu: 50, pg: 150, speedMult: 4.5, sigMult: 2.2 },
  { id: 12058, name: '10MN Afterburner II', slot: 'mid', cpu: 25, pg: 35, speedMult: 1.8 },
  { id: 3841, name: 'Large Shield Extender II', slot: 'mid', cpu: 42, pg: 135, shieldHp: 2150, sigMult: 1.1 },
  { id: 2281, name: 'Multispectrum Shield Hardener II', slot: 'mid', cpu: 44, pg: 1, resBonus: 0.14 },
  { id: 32780, name: 'Warp Disruptor II', slot: 'mid', cpu: 30, pg: 1 },
  { id: 2048, name: 'Damage Control II', slot: 'low', cpu: 30, pg: 1, resBonus: 0.12, hullHp: 400 },
  { id: 4405, name: 'Drone Damage Amplifier II', slot: 'low', cpu: 30, pg: 1, dps: 55 },
  { id: 22291, name: 'Ballistic Control System II', slot: 'low', cpu: 40, pg: 1, dps: 48, alpha: 90 },
  { id: 11269, name: '1600mm Steel Plates II', slot: 'low', cpu: 28, pg: 260, armorHp: 4200, alignAdd: 1.4 },
  { id: 31796, name: 'Medium Core Defense Field Extender II', slot: 'rig', cpu: 0, pg: 0, cal: 150, shieldHp: 1100 }
];

const hullSelectEl = document.getElementById('hull-select');
if (hullSelectEl) {
  let allHullsList = [...STARTER_HULLS];
  let allModulesList = [...STARTER_MODULES];
  let dogmaCache = JSON.parse(localStorage.getItem('eve_dogma_cache') || '{}');
  let esiPriceMap = {};

  let currentHull = {
    id: 17715, name: 'Gila', role: 'Cruiser • Pirate',
    high: 5, mid: 6, low: 3, rig: 3,
    cpu: 515, pg: 1050, cal: 400,
    shield: 3600, armor: 1950, hull: 1900,
    baseRes: 0.45, baseDps: 260, speed: 205, align: 5.8, sig: 135
  };
  let fitted = { high: [], mid: [], low: [], rig: [] };
  let activeSlotFilter = 'ALL';
  let activeNationFilter = 'ALL';

  const syncStatusEl = document.getElementById('esi-sync-status');
  const hullSearchEl = document.getElementById('hull-search');
  const classSelectEl = document.getElementById('class-select');
  const nationBtns = document.querySelectorAll('#nation-filter-bar .slot-filter');
  const modSearchEl = document.getElementById('mod-search');
  const catalogEl = document.getElementById('module-catalog');
  const filterBtns = document.querySelectorAll('.slot-filter-bar .slot-filter');
  let drawFittingRing;
  if (document.getElementById('workbench-fitting-ring')) {
    import('./fitting-ring.js').then(({ renderFittingRing }) => {
      drawFittingRing = renderFittingRing;
      updateWorkbenchUI();
    });
  }

  function getAttr(typeData, attrId, fallback = 0) {
    if (!typeData || !typeData.dogma_attributes) return fallback;
    const found = typeData.dogma_attributes.find(a => a.attribute_id === attrId);
    return found ? found.value : fallback;
  }

  nationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      nationBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeNationFilter = btn.getAttribute('data-nation');
      renderHullDropdown();
    });
  });

  if (classSelectEl) {
    classSelectEl.addEventListener('change', renderHullDropdown);
  }

  function populateClassDropdown() {
    if (!classSelectEl) return;
    const currentVal = classSelectEl.value || 'ALL';
    const classes = [...new Set(allHullsList.map(h => h.className).filter(Boolean))].sort();
    classSelectEl.innerHTML = `<option value="ALL">All Ship Classes (${classes.length})</option>`;
    classes.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      if (cls === currentVal) opt.selected = true;
      classSelectEl.appendChild(opt);
    });
  }

  async function fetchTypeDogma(typeId) {
    if (dogmaCache[typeId]) return dogmaCache[typeId];
    const res = await fetch(`https://esi.evetech.net/latest/universe/types/${typeId}/?datasource=tranquility`);
    const data = await res.json();
    dogmaCache[typeId] = data;
    try {
      localStorage.setItem('eve_dogma_cache', JSON.stringify(dogmaCache));
    } catch (e) {}
    return data;
  }

  async function loadHullFromESI(typeId) {
    if (syncStatusEl) syncStatusEl.textContent = '(Loading hull Dogma...)';
    const data = await fetchTypeDogma(typeId);
    const raceMap = { 1: 'Caldari', 2: 'Minmatar', 4: 'Amarr', 8: 'Gallente', 128: 'ORE' };
    const detectedNation = raceMap[data.race_id] || 'Pirate';
    const hullEntry = allHullsList.find(h => h.id === data.type_id);
    if (hullEntry && !hullEntry.nation) hullEntry.nation = detectedNation;

    const mass = getAttr(data, DOGMA_ATTR.MASS, 12000000);
    const inertia = getAttr(data, DOGMA_ATTR.INERTIA, 0.5);
    const alignTime = +((Math.log(2) * mass * inertia) / 500000).toFixed(1);

    currentHull = {
      id: data.type_id,
      name: data.name,
      role: `${hullEntry ? hullEntry.className : 'Ship'} • ${detectedNation}`,
      high: getAttr(data, DOGMA_ATTR.HIGH_SLOTS, 4),
      mid: getAttr(data, DOGMA_ATTR.MID_SLOTS, 4),
      low: getAttr(data, DOGMA_ATTR.LOW_SLOTS, 4),
      rig: getAttr(data, DOGMA_ATTR.RIG_SLOTS, 3),
      cpu: getAttr(data, DOGMA_ATTR.CPU_OUTPUT, 400),
      pg: getAttr(data, DOGMA_ATTR.PG_OUTPUT, 800),
      cal: getAttr(data, DOGMA_ATTR.CAL_OUTPUT, 400),
      shield: getAttr(data, DOGMA_ATTR.SHIELD_HP, 2000),
      armor: getAttr(data, DOGMA_ATTR.ARMOR_HP, 2000),
      hull: getAttr(data, DOGMA_ATTR.HULL_HP, 2000),
      baseRes: 0.35,
      baseDps: 150,
      speed: getAttr(data, DOGMA_ATTR.MAX_VELOCITY, 200),
      align: alignTime > 0 ? alignTime : 6.0,
      sig: getAttr(data, DOGMA_ATTR.SIG_RADIUS, 150)
    };
    fitted = { high: [], mid: [], low: [], rig: [] };
    if (syncStatusEl) syncStatusEl.textContent = `(${allHullsList.length} hulls / ${allModulesList.length} modules ready)`;
    updateWorkbenchUI();
  }

  async function resolveModuleDogma(modEntry) {
    if (modEntry.slot && modEntry.cpu !== undefined) return modEntry;
    const data = await fetchTypeDogma(modEntry.id);
    const effects = (data.dogma_effects || []).map(e => e.effect_id);

    let slot = 'mid';
    if (effects.includes(DOGMA_EFFECT.HIGH_SLOT)) slot = 'high';
    else if (effects.includes(DOGMA_EFFECT.MID_SLOT)) slot = 'mid';
    else if (effects.includes(DOGMA_EFFECT.LOW_SLOT)) slot = 'low';
    else if (effects.includes(DOGMA_EFFECT.RIG_SLOT)) slot = 'rig';

    const resolved = {
      id: data.type_id,
      name: data.name,
      slot: slot,
      cpu: Math.round(getAttr(data, DOGMA_ATTR.CPU_LOAD, 0)),
      pg: Math.round(getAttr(data, DOGMA_ATTR.PG_LOAD, 0)),
      cal: Math.round(getAttr(data, DOGMA_ATTR.RIG_COST, 0)),
      shieldHp: Math.round(getAttr(data, DOGMA_ATTR.SHIELD_BONUS, 0)),
      armorHp: Math.round(getAttr(data, DOGMA_ATTR.ARMOR_BONUS, 0)),
      speedMult: getAttr(data, DOGMA_ATTR.SPEED_FACTOR, 0) > 0 ? 1 + getAttr(data, DOGMA_ATTR.SPEED_FACTOR, 0) / 100 : undefined,
      dps: slot === 'high' ? 55 : 0
    };
    Object.assign(modEntry, resolved);
    return resolved;
  }

  async function syncAllEveItemsFromESI() {
    const cachedShips = localStorage.getItem('eve_all_ships_v2');
    const cachedMods = localStorage.getItem('eve_all_mods_v1');

    if (cachedShips && cachedMods) {
      allHullsList = JSON.parse(cachedShips);
      allModulesList = JSON.parse(cachedMods);
      populateClassDropdown();
      renderHullDropdown();
      renderCatalog();
      if (syncStatusEl) syncStatusEl.textContent = `(${allHullsList.length} hulls & ${allModulesList.length} modules ready)`;
      return;
    }

    if (syncStatusEl) syncStatusEl.textContent = '(Indexing ship classes, nations & modules from ESI...)';

    try {
      const [shipCatRes, modCatRes, mktGroupsRes] = await Promise.all([
        fetch('https://esi.evetech.net/latest/universe/categories/6/?datasource=tranquility'),
        fetch('https://esi.evetech.net/latest/universe/categories/7/?datasource=tranquility'),
        fetch('https://esi.evetech.net/latest/markets/groups/?datasource=tranquility')
      ]);
      const shipCat = await shipCatRes.json();
      const modCat = await modCatRes.json();
      const mktGroupIds = await mktGroupsRes.json();

      const shipGroupDatas = await Promise.all(
        shipCat.groups.map(gid => fetch(`https://esi.evetech.net/latest/universe/groups/${gid}/?datasource=tranquility`).then(r => r.json()))
      );

      const typeToClass = {};
      const shipTypeIds = [];
      shipGroupDatas.forEach(g => {
        if (!g || !g.types) return;
        g.types.forEach(tid => {
          typeToClass[tid] = g.name;
          shipTypeIds.push(tid);
        });
      });

      const typeToNation = {};
      const mktDetails = await Promise.all(
        mktGroupIds.slice(0, 350).map(id =>
          fetch(`https://esi.evetech.net/latest/markets/groups/${id}/?datasource=tranquility`)
            .then(r => r.ok ? r.json() : null).catch(() => null)
        )
      );
      mktDetails.forEach(mg => {
        if (!mg || !mg.types || !mg.types.length) return;
        const n = (mg.name || '').toLowerCase();
        let nation = null;
        if (n.includes('amarr')) nation = 'Amarr';
        else if (n.includes('caldari')) nation = 'Caldari';
        else if (n.includes('gallente')) nation = 'Gallente';
        else if (n.includes('minmatar')) nation = 'Minmatar';
        else if (n.includes('ore')) nation = 'ORE';
        else if (n.includes('faction') || n.includes('pirate') || n.includes('special') || n.includes('navy') || n.includes('precursor') || n.includes('edencom')) {
          nation = 'Pirate';
        }
        if (nation) {
          mg.types.forEach(tid => { typeToNation[tid] = nation; });
        }
      });

      const modGroupDatas = await Promise.all(
        modCat.groups.slice(0, 60).map(gid => fetch(`https://esi.evetech.net/latest/universe/groups/${gid}/?datasource=tranquility`).then(r => r.json()))
      );
      const modTypeIds = [...new Set(modGroupDatas.flatMap(g => g.types || []))];

      async function resolveNamesInChunks(idArray) {
        const results = [];
        const uniqueIds = [...new Set(idArray)];
        for (let i = 0; i < uniqueIds.length; i += 900) {
          const chunk = uniqueIds.slice(i, i + 900);
          const res = await fetch('https://esi.evetech.net/latest/universe/names/?datasource=tranquility', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk)
          });
          if (res.ok) {
            const names = await res.json();
            results.push(...names);
          }
        }
        return results.sort((a, b) => a.name.localeCompare(b.name));
      }

      const [resolvedShips, resolvedMods] = await Promise.all([
        resolveNamesInChunks(shipTypeIds),
        resolveNamesInChunks(modTypeIds)
      ]);

      if (resolvedShips.length > 0) {
        const starterNationMap = new Map(STARTER_HULLS.map(h => [h.id, h.nation]));
        allHullsList = resolvedShips.map(s => ({
          id: s.id,
          name: s.name,
          className: typeToClass[s.id] || 'Ship',
          nation: typeToNation[s.id] || starterNationMap.get(s.id) || 'Pirate'
        }));
        localStorage.setItem('eve_all_ships_v2', JSON.stringify(allHullsList));
      }

      if (resolvedMods.length > 0) {
        const starterMap = new Map(STARTER_MODULES.map(m => [m.id, m]));
        allModulesList = resolvedMods.map(m => starterMap.get(m.id) || { id: m.id, name: m.name });
        localStorage.setItem('eve_all_mods_v1', JSON.stringify(allModulesList));
      }

      populateClassDropdown();
      renderHullDropdown();
      renderCatalog();
      if (syncStatusEl) syncStatusEl.textContent = `(${allHullsList.length} hulls & ${allModulesList.length} modules ready)`;
    } catch (err) {
      console.error('ESI full catalog sync error:', err);
      populateClassDropdown();
    }
  }

  function renderHullDropdown() {
    const filterText = (hullSearchEl ? hullSearchEl.value : '').toLowerCase();
    const selectedClass = classSelectEl ? classSelectEl.value : 'ALL';
    hullSelectEl.innerHTML = '';

    const filtered = allHullsList.filter(h => {
      const matchesName = h.name.toLowerCase().includes(filterText);
      const matchesClass = selectedClass === 'ALL' || h.className === selectedClass;
      const matchesNation = activeNationFilter === 'ALL' || h.nation === activeNationFilter;
      return matchesName && matchesClass && matchesNation;
    });

    if (filtered.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'No hulls match these filters';
      hullSelectEl.appendChild(opt);
      return;
    }

    filtered.forEach(hull => {
      const opt = document.createElement('option');
      opt.value = hull.id;
      opt.textContent = `${hull.name} [${hull.className} • ${hull.nation || 'New Eden'}]`;
      if (hull.id === currentHull.id) opt.selected = true;
      hullSelectEl.appendChild(opt);
    });
  }

  if (hullSearchEl) {
    hullSearchEl.addEventListener('input', renderHullDropdown);
  }

  hullSelectEl.addEventListener('change', () => {
    const selectedId = Number(hullSelectEl.value);
    if (selectedId) loadHullFromESI(selectedId);
  });

  function renderCatalog() {
    const query = (modSearchEl.value || '').toLowerCase();
    catalogEl.innerHTML = '';

    const matches = allModulesList.filter(m => {
      const matchesSlot = activeSlotFilter === 'ALL' || !m.slot || m.slot === activeSlotFilter;
      const matchesText = m.name.toLowerCase().includes(query);
      return matchesSlot && matchesText;
    }).slice(0, 80);

    matches.forEach(mod => {
      const li = document.createElement('li');
      const metaText = mod.slot
        ? `${mod.slot.toUpperCase()} • ${mod.cpu || 0} tf • ${mod.pg || 0} MW`
        : 'Click to load ESI Dogma & Fit';
      li.innerHTML = `
        <div class="mod-item-left">
          <img src="https://images.evetech.net/types/${mod.id}/icon?size=32" alt="">
          <div>
            <div>${mod.name}</div>
            <div class="mod-meta">${metaText}</div>
          </div>
        </div>
        <span>+ Fit</span>
      `;
      li.addEventListener('click', async () => {
        const fullMod = await resolveModuleDogma(mod);
        equipModule(fullMod);
        renderCatalog();
      });
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
    const maxSlots = currentHull[mod.slot] || 0;
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
    const max = currentHull[slotType] || 0;
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

    if (drawFittingRing) {
      const racks = Object.fromEntries(['high', 'mid', 'low', 'rig'].map(rack => [rack,
        Array.from({ length: currentHull[rack] || 0 }, (_, index) => {
          const mod = fitted[rack][index];
          return mod ? { name: mod.name, typeId: mod.id } : null;
        })]));
      drawFittingRing(document.getElementById('workbench-fitting-ring'), {
        name: currentHull.name, typeId: currentHull.id, racks,
        onSlotClick(rack, index, item) {
          if (item) return unequipModule(rack, index);
          activeSlotFilter = rack;
          filterBtns.forEach(button => button.classList.toggle('active', button.dataset.slot === rack));
          modSearchEl.value = '';
          renderCatalog();
          modSearchEl.focus({ preventScroll: true });
          modSearchEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    const allMods = [...fitted.high, ...fitted.mid, ...fitted.low, ...fitted.rig];
    let usedCpu = 0, usedPg = 0, usedCal = 0;
    let dps = currentHull.baseDps, alpha = 0;
    let shield = currentHull.shield, armor = currentHull.armor, hull = currentHull.hull;
    let resist = currentHull.baseRes;
    let speed = currentHull.speed, align = currentHull.align, sig = currentHull.sig;
    let totalIsk = esiPriceMap[currentHull.id] || 0;

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
      totalIsk += esiPriceMap[m.id] || 0;
    });

    const ehp = Math.round((shield + armor + hull) / (1 - Math.min(0.88, resist)));

    const cpuPct = currentHull.cpu ? Math.min(100, (usedCpu / currentHull.cpu) * 100) : 0;
    const pgPct = currentHull.pg ? Math.min(100, (usedPg / currentHull.pg) * 100) : 0;
    const calPct = currentHull.cal ? Math.min(100, (usedCal / currentHull.cal) * 100) : 0;

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

    document.getElementById('stat-dps').textContent = `${dps.toFixed(1)} DPS`;
    document.getElementById('stat-alpha').textContent = alpha.toLocaleString();
    document.getElementById('stat-ehp').textContent = `${ehp.toLocaleString()} EHP`;
    document.getElementById('stat-shield').textContent = `${Math.round(shield).toLocaleString()} HP`;
    document.getElementById('stat-armor').textContent = `${Math.round(armor).toLocaleString()} HP`;
    document.getElementById('stat-hull').textContent = `${Math.round(hull).toLocaleString()} HP`;
    document.getElementById('stat-speed').textContent = `${Math.round(speed).toLocaleString()} m/s`;
    document.getElementById('stat-align').textContent = `${align} s`;
    document.getElementById('stat-sig').textContent = `${Math.round(sig)} m`;
    document.getElementById('stat-isk').textContent = `${(totalIsk / 1e6).toFixed(1)}M ISK`;

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

  document.getElementById('import-eft-btn').addEventListener('click', async () => {
    const lines = document.getElementById('eft-box').value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    if (lines[0].startsWith('[')) {
      const hullName = lines[0].replace('[', '').split(',')[0].trim().toLowerCase();
      const matchedHull = allHullsList.find(h => h.name.toLowerCase() === hullName);
      if (matchedHull) {
        hullSelectEl.value = matchedHull.id;
        await loadHullFromESI(matchedHull.id);
      }
    }

    fitted = { high: [], mid: [], low: [], rig: [] };
    for (const line of lines.slice(1)) {
      const cleanName = line.split(',')[0].trim().toLowerCase();
      const modEntry = allModulesList.find(m => m.name.toLowerCase() === cleanName);
      if (modEntry) {
        const fullMod = await resolveModuleDogma(modEntry);
        if (fitted[fullMod.slot].length < currentHull[fullMod.slot]) {
          fitted[fullMod.slot].push(fullMod);
        }
      }
    }
    updateWorkbenchUI();
  });

  fetch('https://esi.evetech.net/latest/markets/prices/?datasource=tranquility')
    .then(r => r.json())
    .then(items => {
      items.forEach(i => { esiPriceMap[i.type_id] = i.average_price || 0; });
      updateWorkbenchUI();
    }).catch(() => {});

  populateClassDropdown();
  renderHullDropdown();
  renderCatalog();
  updateWorkbenchUI();
  syncAllEveItemsFromESI();
}
