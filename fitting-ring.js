// Shared by the doctrine browser and the live fitting workbench.
const RACKS = [
  ['high', 'High power', -90], ['mid', 'Medium power', 0],
  ['low', 'Low power', 90], ['rig', 'Rig slots', 180]
];
let nextRingId = 0;

function node(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function initialize(container) {
  const imageWindow = node('div', 'fitting-ring-ship');
  const fallback = node('span', 'fitting-ring-fallback', 'Ship render unavailable');
  fallback.hidden = true;
  const image = node('img', 'fitting-ring-image');
  image.width = image.height = 512;
  image.onerror = () => { image.hidden = true; fallback.hidden = false; };
  image.onload = () => { image.hidden = false; fallback.hidden = true; };
  imageWindow.append(fallback, image);

  // Labels follow a separate inner arc, leaving the module band unobstructed.
  const ns = 'http://www.w3.org/2000/svg';
  const labels = document.createElementNS(ns, 'svg');
  labels.classList.add('fitting-ring-labels');
  labels.setAttribute('viewBox', '0 0 1000 1000');
  labels.setAttribute('aria-hidden', 'true');
  const id = ++nextRingId;
  for (const [rack, label, center] of RACKS) {
    const point = angle => {
      const radians = angle * Math.PI / 180;
      return `${500 + 354 * Math.cos(radians)} ${500 + 354 * Math.sin(radians)}`;
    };
    const reverse = rack === 'low';
    const start = center + (reverse ? 37 : -37);
    const end = center + (reverse ? -37 : 37);
    const path = document.createElementNS(ns, 'path');
    path.id = `fitting-ring-${id}-${rack}`;
    path.setAttribute('d', `M ${point(start)} A 354 354 0 0 ${reverse ? 0 : 1} ${point(end)}`);
    path.setAttribute('fill', 'none');
    const text = document.createElementNS(ns, 'text');
    const textPath = document.createElementNS(ns, 'textPath');
    textPath.setAttribute('href', `#${path.id}`);
    textPath.setAttribute('startOffset', '50%');
    textPath.setAttribute('text-anchor', 'middle');
    textPath.textContent = label;
    text.append(textPath);
    labels.append(path, text);
  }
  container.append(imageWindow, labels, node('div', 'fitting-ring-slots'), node('strong', 'fitting-ring-hull'));
}

export function renderFittingRing(container, { name, typeId, racks, onSlotClick }) {
  if (!container.querySelector('.fitting-ring-image')) initialize(container);
  container.classList.add('fitting-ring');
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', `${name} fitting slots`);
  const image = container.querySelector('.fitting-ring-image');
  const source = `https://images.evetech.net/types/${typeId}/render?size=512`;
  if (image.getAttribute('src') !== source) {
    image.hidden = false;
    container.querySelector('.fitting-ring-fallback').hidden = true;
    image.src = source;
  }
  image.alt = `${name} ship render`;
  container.querySelector('.fitting-ring-hull').textContent = name;

  const focused = container.contains(document.activeElement) ? document.activeElement.dataset : null;
  const slots = [];
  const maxCount = Math.max(1, ...RACKS.map(([key]) => racks[key]?.length || 0));
  const step = Math.min(11.5, 74 / Math.max(1, maxCount - 1));
  const halfStep = step * Math.PI / 360;
  // Rotated squares need clearance for their corners, not just their centers.
  const size = Math.min(7, 2 * 43 * Math.sin(halfStep) /
    (Math.cos(halfStep) + Math.sin(halfStep)) * 0.95);
  container.style.setProperty('--fitting-slot-size', `${size}%`);

  for (const [rack, label, center] of RACKS) {
    const items = racks[rack] || [];
    items.forEach((item, index) => {
      const angle = center + (index - (items.length - 1) / 2) * step;
      const radians = angle * Math.PI / 180;
      const slot = node(onSlotClick ? 'button' : 'span', `fitting-ring-slot${item ? ' is-filled' : ' is-empty'}`);
      slot.dataset.rack = rack;
      slot.dataset.index = index;
      slot.style.left = `${50 + 43 * Math.cos(radians)}%`;
      slot.style.top = `${50 + 43 * Math.sin(radians)}%`;
      slot.style.setProperty('--slot-angle', `${angle + 90}deg`);
      slot.style.setProperty('--icon-angle', `${-angle - 90}deg`);
      const title = item ? `${item.name} · ${label} slot ${index + 1}` : `Empty ${label.toLowerCase()} slot ${index + 1}`;
      slot.title = onSlotClick ? (item ? `Remove ${title}` : `Fit a module · ${title}`) : title;
      slot.setAttribute('aria-label', slot.title);
      const icon = node('span', `fitting-ring-icon icon-${rack}`);
      icon.setAttribute('aria-hidden', 'true');
      if (item?.typeId) {
        const moduleImage = node('img', '');
        moduleImage.alt = '';
        moduleImage.src = `https://images.evetech.net/types/${item.typeId}/icon?size=64`;
        moduleImage.addEventListener('error', () => moduleImage.remove(), { once: true });
        icon.append(moduleImage);
      }
      if (onSlotClick) {
        slot.type = 'button';
        slot.addEventListener('click', () => onSlotClick(rack, index, item));
      }
      slot.append(icon);
      slots.push(slot);
    });
  }
  container.querySelector('.fitting-ring-slots').replaceChildren(...slots);
  // Removing a module redraws the rack. Keep keyboard focus in that rack.
  if (focused?.rack) {
    slots.find(slot => slot.dataset.rack === focused.rack && slot.dataset.index === focused.index)?.focus({ preventScroll: true });
  }
}
