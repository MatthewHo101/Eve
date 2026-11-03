// Starter examples, not corporation-approved doctrine. EFT export preserves each rack.
export const DOCTRINE_FITS = [
  {
    id: 'crow-jackrabbit', name: 'Crow Jackrabbit', hull: 'Crow', typeId: 11176,
    category: 'Tackle', role: 'Fast tackle', className: 'Interceptor · Caldari',
    description: 'Fast fleet tackle. Hold point, keep moving, and give the fleet a warp-in.',
    modules: {
      high: ['Interdiction Nullifier II'],
      mid: ['Faint Epsilon Scoped Warp Scrambler', 'Warp Disruptor II', '5MN Y-T8 Compact Microwarpdrive', 'Medium Shield Extender II'],
      low: ['Overdrive Injector System II', 'Overdrive Injector System II'],
      rig: ['Small Polycarbon Engine Housing I', 'Small Ionic Field Projector I']
    },
    skills: [['Caldari Frigate', 5], ['Interceptors', 1], ['Propulsion Jamming', 2], ['High Speed Maneuvering', 1], ['Shield Upgrades', 4]]
  },
  {
    id: 'slasher-tackle', name: 'Slasher Throwaway', hull: 'Slasher', typeId: 585,
    category: 'Tackle', role: 'Entry-level tackle', className: 'Frigate · Minmatar',
    description: 'An inexpensive tackle example for pilots learning to catch and hold a target.',
    modules: {
      high: ['125mm Gatling AutoCannon I', '125mm Gatling AutoCannon I', '125mm Gatling AutoCannon I'],
      mid: ['5MN Cold-Gas Enduring Microwarpdrive', 'Warp Disruptor I', 'Warp Scrambler I', 'Small Shield Extender I'],
      low: ['Damage Control I', 'Overdrive Injector System I'],
      rig: ['Small Polycarbon Engine Housing I', 'Small Polycarbon Engine Housing I', 'Small Ionic Field Projector I']
    },
    skills: [['Minmatar Frigate', 1], ['Small Projectile Turret', 1], ['Propulsion Jamming', 1], ['High Speed Maneuvering', 1]]
  },
  {
    id: 'caracal-shield', name: 'Caracal Shield Wing', hull: 'Caracal', typeId: 621,
    category: 'Brawling cruisers', role: 'Missile support', className: 'Cruiser · Caldari',
    description: 'A shield cruiser example built around rapid light missiles and fleet support.',
    modules: {
      high: Array(5).fill('Rapid Light Missile Launcher II'),
      mid: ['50MN Y-T8 Compact Microwarpdrive', 'Large Shield Extender II', 'Large Shield Extender II', 'Multispectrum Shield Hardener II', 'Warp Disruptor II'],
      low: ['Ballistic Control System II', 'Ballistic Control System II', 'Damage Control II', 'Power Diagnostic System II'],
      rig: ['Medium Core Defense Field Extender I', 'Medium Core Defense Field Extender I', 'Medium EM Shield Reinforcer I']
    },
    skills: [['Caldari Cruiser', 1], ['Light Missiles', 5], ['Light Missile Specialization', 1], ['Shield Upgrades', 4]]
  },
  {
    id: 'moa-brawler', name: 'Moa Close Quarters', hull: 'Moa', typeId: 623,
    category: 'Brawling cruisers', role: 'Shield brawler', className: 'Cruiser · Caldari',
    description: 'A close-range hybrid turret example. Stay with your anchor and watch your range.',
    modules: {
      high: Array(5).fill('Heavy Electron Blaster II'),
      mid: ['50MN Y-T8 Compact Microwarpdrive', 'Large Shield Extender II', 'Multispectrum Shield Hardener II', 'Warp Scrambler II', 'Stasis Webifier II'],
      low: ['Damage Control II', 'Magnetic Field Stabilizer II', 'Magnetic Field Stabilizer II', 'Power Diagnostic System II'],
      rig: ['Medium Core Defense Field Extender I', 'Medium Core Defense Field Extender I', 'Medium EM Shield Reinforcer I']
    },
    skills: [['Caldari Cruiser', 1], ['Medium Hybrid Turret', 5], ['Medium Blaster Specialization', 1], ['Shield Upgrades', 4]]
  },
  {
    id: 'gila-shield', name: 'Gila Shield Cruiser', hull: 'Gila', typeId: 17715,
    category: 'Ratting', role: 'Drone damage', className: 'Cruiser · Guristas',
    description: 'A shield and drone cruiser example. Adapt tank and ammunition to your target.',
    modules: {
      high: Array(4).fill('Rapid Light Missile Launcher II'),
      mid: ['10MN Afterburner II', 'Large Shield Extender II', 'Large Shield Extender II', 'Multispectrum Shield Hardener II', 'Multispectrum Shield Hardener II', 'Drone Navigation Computer II'],
      low: Array(3).fill('Drone Damage Amplifier II'),
      rig: Array(3).fill('Medium Core Defense Field Purger I'),
      drones: ['Vespa II', 'Vespa II']
    },
    skills: [['Caldari Cruiser', 2], ['Gallente Cruiser', 2], ['Drones', 5], ['Medium Drone Operation', 5], ['Caldari Drone Specialization', 1]]
  },
  {
    id: 'basilisk-logistics', name: 'Basilisk Logistics Wing', hull: 'Basilisk', typeId: 11985,
    category: 'Logistics', role: 'Shield logistics', className: 'Logistics Cruiser · Caldari',
    description: 'A capacitor-chain logistics example. Coordinate transfer partners with your fleet.',
    modules: {
      high: ['Large Remote Shield Booster II', 'Large Remote Shield Booster II', 'Large Remote Shield Booster II', 'Large Remote Shield Booster II', 'Large Remote Capacitor Transmitter II', 'Large Remote Capacitor Transmitter II'],
      mid: ['10MN Afterburner II', 'Large Shield Extender II', 'Multispectrum Shield Hardener II', 'Multispectrum Shield Hardener II', 'Sensor Booster II'],
      low: ['Damage Control II', 'Power Diagnostic System II'],
      rig: ['Medium Ancillary Current Router I', 'Medium Core Defense Field Extender I']
    },
    skills: [['Caldari Cruiser', 5], ['Logistics Cruisers', 1], ['Shield Emission Systems', 4], ['Capacitor Emission Systems', 4]]
  }
];

export const RACKS = [
  ['high', 'High slots', 'High'], ['mid', 'Medium slots', 'Medium'],
  ['low', 'Low slots', 'Low'], ['rig', 'Rigs', 'Rig'], ['drones', 'Drones', 'Drone']
];

export function filterFits(search = '', category = 'All') {
  const query = search.trim().toLowerCase();
  return DOCTRINE_FITS.filter(fit => (category === 'All' || fit.category === category) &&
    `${fit.name} ${fit.hull} ${fit.role} ${fit.category}`.toLowerCase().includes(query));
}

export function exportFit(fit) {
  // EFT uses low, medium, high, then rig slots (the visual rack order differs).
  const racks = ['low', 'mid', 'high', 'rig'].map(key => fit.modules[key].join('\n'));
  const drones = fit.modules.drones || [];
  const counts = new Map();
  for (const name of drones) counts.set(name, (counts.get(name) || 0) + 1);
  return `[${fit.hull}, ${fit.name}]\n${racks.join('\n\n')}${drones.length ? '\n\n' + [...counts].map(([name, count]) => `${name} x${count}`).join('\n') : ''}\n`;
}
