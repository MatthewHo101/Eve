let piDataInterval;
let piItemNames = new Map();

async function fetchUniverseNames(ids) {
  const uniqueIds = [...new Set(ids.filter(id => id > 0))];
  const missing = uniqueIds.filter(id => !piItemNames.has(id));
  
  if (missing.length > 0) {
    try {
      const res = await fetch('https://esi.evetech.net/latest/universe/names/?datasource=tranquility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(missing)
      });
      if (res.ok) {
        const names = await res.json();
        names.forEach(n => piItemNames.set(n.id, n.name));
      }
    } catch (e) {
      console.error('Failed to resolve ESI names', e);
    }
  }
}

async function loadPlanetaryIndustry() {
  const summaryEl = document.getElementById('pi-summary-content');
  const listEl = document.getElementById('pi-planet-list');
  
  if (!summaryEl || !listEl) return;
  
  // We need to fetch characters first. We can use the global `characters` if populated,
  // but to be safe, fetch it ourselves or just use the characterApi from characters.js if available.
  // We will assume `characterApi` is available globally from characters.js
  let chars = [];
  try {
    const data = await characterApi('/api/characters');
    chars = data.characters || [];
  } catch (err) {
    summaryEl.innerHTML = '<p class="error-msg">Failed to load characters.</p>';
    return;
  }
  
  if (chars.length === 0) {
    summaryEl.innerHTML = '<p class="empty-msg">No characters linked. Link characters to view PI data.</p>';
    listEl.innerHTML = '';
    return;
  }
  
  summaryEl.innerHTML = '<p>Loading planetary data...</p>';
  listEl.innerHTML = '';
  
  let allPlanets = [];
  
  for (const char of chars) {
    try {
      const data = await characterApi(`/api/planets?id=${encodeURIComponent(char.id)}`);
      if (data.planets) {
        data.planets.forEach(p => p.characterName = char.name);
        allPlanets = allPlanets.concat(data.planets);
      }
    } catch (e) {
      console.error(`Failed to load planets for ${char.name}:`, e);
    }
  }
  
  if (allPlanets.length === 0) {
    summaryEl.innerHTML = '<p>No planetary installations found across your linked characters.</p>';
    return;
  }
  
  // Collect all type IDs to resolve names (extractors, etc.)
  const typesToResolve = [];
  allPlanets.forEach(p => {
    typesToResolve.push(p.planet_id); // Planet ID might resolve to a name (no, wait, universe/names works on item/character/planet ids? No, universe/names works on item types. Wait, planet IDs are item IDs in EVE!)
    if (p.details && p.details.pins) {
      p.details.pins.forEach(pin => {
        if (pin.extractor_details && pin.extractor_details.product_type_id) {
          typesToResolve.push(pin.extractor_details.product_type_id);
        }
      });
    }
  });
  
  await fetchUniverseNames(typesToResolve);
  
  renderPlanetaryData(allPlanets, summaryEl, listEl);
}

function renderPlanetaryData(planets, summaryEl, listEl) {
  let totalExtractors = 0;
  let activeExtractors = 0;
  let expiredExtractors = 0;
  let totalFactories = 0;
  
  const totalProduction = new Map();
  const now = new Date();
  
  let listHtml = '';
  
  // Sort planets by character name, then planet name/type
  planets.sort((a, b) => a.characterName.localeCompare(b.characterName) || a.planet_type.localeCompare(b.planet_type));

  let currentCharacter = null;
  
  planets.forEach(p => {
    if (p.characterName !== currentCharacter) {
      listHtml += `<h3>${p.characterName}</h3>`;
      currentCharacter = p.characterName;
    }
    
    const planetName = piItemNames.get(p.planet_id) || `${p.planet_type.toUpperCase()} Planet (${p.planet_id})`;
    
    if (p.error) {
      listHtml += `<div class="pi-planet-card">
        <h4>${planetName}</h4>
        <p class="error-msg">Error: ${p.error}</p>
      </div>`;
      return;
    }
    
    let extractorsHtml = '';
    let factories = 0;
    let needsAttention = false;
    
    if (p.details && p.details.pins) {
      p.details.pins.forEach(pin => {
        if (pin.factory_details) {
          factories++;
          totalFactories++;
        } else if (pin.extractor_details) {
          totalExtractors++;
          const prodId = pin.extractor_details.product_type_id;
          const prodName = piItemNames.get(prodId) || 'Raw Material';
          
          let status = 'Inactive';
          let statusClass = 'text-red';
          
          if (pin.expiry_time) {
            const expiry = new Date(pin.expiry_time);
            if (expiry > now) {
              const cycleTime = pin.extractor_details.cycle_time || 1;
              const qtyPerCycle = pin.extractor_details.qty_per_cycle || 0;
              const outputPerHour = Math.round((qtyPerCycle / cycleTime) * 3600);
              
              totalProduction.set(prodName, (totalProduction.get(prodName) || 0) + outputPerHour);
              
              status = `Extracting ~${outputPerHour.toLocaleString()}/hr (ends ${expiry.toLocaleString()})`;
              statusClass = 'text-green';
              activeExtractors++;
              
              // Warn if expiring in less than 24 hours
              const hoursLeft = (expiry - now) / 3600000;
              if (hoursLeft < 24) {
                status = `Extracting ~${outputPerHour.toLocaleString()}/hr - Expiring soon (ends ${expiry.toLocaleString()})`;
                statusClass = 'text-yellow';
                needsAttention = true;
              }
            } else {
              status = `Expired at ${expiry.toLocaleString()}`;
              statusClass = 'text-red';
              expiredExtractors++;
              needsAttention = true;
            }
          } else {
            expiredExtractors++;
            needsAttention = true;
          }
          
          extractorsHtml += `<li><strong>${prodName}</strong>: <span class="${statusClass}">${status}</span></li>`;
        }
      });
    }
    
    let attentionHtml = needsAttention ? '<span class="attention-badge">⚠️ Needs Attention</span>' : '';
    
    listHtml += `
      <div class="pi-planet-card ${needsAttention ? 'needs-attention' : ''}">
        <h4>${planetName} <span class="planet-type">(${p.planet_type})</span> ${attentionHtml}</h4>
        <p>Upgrade Level: ${p.upgrade_level}</p>
        <p>Factories: ${factories}</p>
        ${extractorsHtml ? `<h5>Extractors:</h5><ul>${extractorsHtml}</ul>` : '<p>No active extractors.</p>'}
      </div>
    `;
  });
  
  let productionHtml = '';
  if (totalProduction.size > 0) {
    productionHtml = '<h3>Global Extraction Rate</h3><ul class="pi-summary-list">';
    for (const [prod, qty] of totalProduction.entries()) {
      productionHtml += `<li><strong>${prod}:</strong> <span class="text-green">~${qty.toLocaleString()}/hr</span></li>`;
    }
    productionHtml += '</ul><hr style="border-color: #374151; margin: 15px 0;">';
  }
  
  summaryEl.innerHTML = `
    ${productionHtml}
    <ul class="pi-summary-list">
      <li><strong>Total Planets:</strong> ${planets.length}</li>
      <li><strong>Total Extractors:</strong> ${totalExtractors}</li>
      <li><strong>Active Extractors:</strong> <span class="text-green">${activeExtractors}</span></li>
      <li><strong>Expired/Idle Extractors:</strong> <span class="${expiredExtractors > 0 ? 'text-red' : ''}">${expiredExtractors}</span></li>
      <li><strong>Total Factories:</strong> ${totalFactories}</li>
    </ul>
    ${expiredExtractors > 0 ? '<p class="text-red" style="margin-top: 15px;"><strong>⚠️ You have extractors that require attention!</strong></p>' : ''}
  `;
  
  listEl.innerHTML = listHtml;
}

function initPlanetaryIndustry() {
  // Initial load when tab is clicked
  const tabBtn = document.querySelector('.nav-link[data-target="planetary-industry"]');
  if (tabBtn) {
    tabBtn.addEventListener('click', () => {
      loadPlanetaryIndustry();
    });
  }
  
  // Set up auto-refresh every minute
  if (piDataInterval) clearInterval(piDataInterval);
  piDataInterval = setInterval(() => {
    // Only refresh if the PI tab is active
    const piPage = document.getElementById('planetary-industry');
    if (piPage && piPage.classList.contains('active-view')) {
      loadPlanetaryIndustry();
    }
  }, 60000);
  
  // If we load the page directly on this tab (e.g. via hash), load data
  if (window.location.hash === '#planetary-industry') {
    // Assuming switchPage is global from app.js
    if (typeof switchPage === 'function') switchPage('planetary-industry');
    loadPlanetaryIndustry();
  }
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  // Give app.js and characters.js a moment to initialize
  setTimeout(initPlanetaryIndustry, 500);
});