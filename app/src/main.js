// Sunset Cover Maker — wires the editor: photos, panels, words, grades, export.
// The drawing itself lives in cover.js; this file owns the state and the page.
import { drawCover, panelRects, LAYOUTS, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const panelLabel = document.getElementById('panel-label');
const zoomEl = document.getElementById('zoom');

const DEFAULT_ZOOM = 1.15;

/** The whole cover, as the editor holds it. Panels keep their own crop. */
const state = {
  layout: 'quad',
  grade: 'sunset',
  size: '1080x1080',
  caption: 'Sunset Heist',
  captionSize: 1,
  captionPos: 'bottom',
  captionOutline: true,
  captionGlow: 'pink',
  tagline: 'A SUNSET STORY',
  panels: [
    { photo: null, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 },
    { photo: null, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 },
    { photo: null, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 },
    { photo: null, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 },
  ],
};

let photos = []; // { name, img, url }
let selectedPanel = 0;
let fontsReady = false;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function geometry() {
  const W = canvas.width, H = canvas.height;
  const bandH = Math.round(H * 0.28);
  const gut = Math.max(6, Math.round(W * 0.008));
  return { bandH, gut, rects: panelRects(state.layout, W, H, bandH, gut) };
}

function render() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  panelLabel.textContent = `Panel ${selectedPanel + 1}`;
  zoomEl.value = state.panels[selectedPanel].zoom;
  markTrayPicked();
}

function setStatus(text) {
  statusEl.textContent = text;
}

/** The photo tray: every loaded photo, samples first, then uploads. */
function renderTray() {
  trayEl.innerHTML = '';
  photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = photo.name;
    btn.dataset.photo = i;
    const thumb = document.createElement('img');
    thumb.src = photo.url;
    thumb.alt = photo.name;
    btn.appendChild(thumb);
    btn.addEventListener('click', () => assignPhoto(i));
    trayEl.appendChild(btn);
  });
  markTrayPicked();
}

function markTrayPicked() {
  const current = state.panels[selectedPanel].photo;
  trayEl.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('picked', photos[i] && photos[i].img === current);
  });
}

/** Puts a photo into the selected panel and resets that panel's crop. */
function assignPhoto(photoIndex) {
  const photo = photos[photoIndex];
  if (!photo) return;
  state.panels[selectedPanel] = { photo: photo.img, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 };
  render();
}

/** Fills every panel with the selected panel's photo, each with a fresh crop. */
function fillAllPanels() {
  const photo = state.panels[selectedPanel].photo;
  if (!photo) {
    setStatus('Pick a photo for the selected panel first.');
    return;
  }
  state.panels = state.panels.map(() => ({ photo, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 }));
  render();
  setStatus('Every panel now uses that photo — drag each one to crop it differently.');
}

function resetCrop() {
  state.panels[selectedPanel] = { ...state.panels[selectedPanel], zoom: DEFAULT_ZOOM, ox: 0, oy: 0 };
  render();
}

/** Which panel (if any) holds a point in canvas pixels. */
function panelAt(x, y) {
  const { rects } = geometry();
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (canvas.width / box.width),
    y: (event.clientY - box.top) * (canvas.height / box.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const index = panelAt(p.x, p.y);
  if (index === -1) return;
  const panel = state.panels[index];
  drag = { panel: index, startX: p.x, startY: p.y, ox: panel.ox, oy: panel.oy, moved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const p = canvasPoint(event);
  const { rects } = geometry();
  const rect = rects[drag.panel];
  if (Math.abs(p.x - drag.startX) > 4 || Math.abs(p.y - drag.startY) > 4) drag.moved = true;
  const panel = state.panels[drag.panel];
  panel.ox = Math.max(-0.6, Math.min(0.6, drag.ox + (p.x - drag.startX) / rect.w));
  panel.oy = Math.max(-0.6, Math.min(0.6, drag.oy + (p.y - drag.startY) / rect.h));
  render();
});
function endDrag(event) {
  if (!drag) return;
  if (!drag.moved) {
    selectedPanel = drag.panel;
    render();
  }
  drag = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-event.deltaY * 0.0012)));
  render();
}, { passive: false });

/** Uploads: each file joins the tray and fills the first empty panel. */
document.getElementById('upload').addEventListener('change', async (event) => {
  const files = [...event.target.files].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      photos.push({ name: file.name, img, url });
      const empty = state.panels.findIndex((p) => !p.photo);
      if (empty !== -1) state.panels[empty] = { photo: img, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 };
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  renderTray();
  render();
  event.target.value = '';
  if (files.length) setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added.`);
});

document.getElementById('fill-all').addEventListener('click', fillAllPanels);
document.getElementById('reset-crop').addEventListener('click', resetCrop);
zoomEl.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = Number(zoomEl.value);
  render();
});

function wirePickedRow(rowId, key, onChange) {
  const row = document.getElementById(rowId);
  row.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-' + key + ']');
    if (!btn) return;
    row.querySelectorAll('button').forEach((b) => b.classList.remove('picked'));
    btn.classList.add('picked');
    state[key] = btn.dataset[key];
    onChange();
    render();
  });
}
wirePickedRow('layout-row', 'layout', () => {
  const need = LAYOUTS[state.layout].panels;
  while (state.panels.length < need) {
    state.panels.push({ photo: null, zoom: DEFAULT_ZOOM, ox: 0, oy: 0 });
  }
  selectedPanel = Math.min(selectedPanel, need - 1);
});
wirePickedRow('grade-row', 'grade', () => {});
wirePickedRow('size-row', 'size', () => {});

document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  render();
});
document.getElementById('tagline').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  render();
});
document.getElementById('caption-size').addEventListener('input', (e) => {
  state.captionSize = Number(e.target.value);
  render();
});
document.getElementById('caption-pos').addEventListener('change', (e) => {
  state.captionPos = e.target.value;
  render();
});
document.getElementById('caption-glow').addEventListener('change', (e) => {
  state.captionGlow = e.target.value;
  render();
});
document.getElementById('caption-outline').addEventListener('change', (e) => {
  state.captionOutline = e.target.checked;
  render();
});

/** Renders the cover at the export size and downloads it as a PNG. */
async function exportPng() {
  const { w, h } = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  if (!blob) {
    setStatus('Export failed — try again.');
    return null;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sunset-cover-${w}x${h}.png`;
  a.click();
  setStatus(`Saved sunset-cover-${w}x${h}.png`);
  return blob;
}
document.getElementById('export').addEventListener('click', exportPng);

/** Loads the two sample photos and fills the panels with them, alternating. */
async function loadSamples() {
  const names = ['boulevard', 'pier'];
  for (const name of names) {
    try {
      const url = `samples/${name}.jpg`;
      const img = await loadImage(url);
      photos.push({ name: `Sample: ${name}`, img, url });
    } catch {
      setStatus(`Sample ${name} did not load.`);
    }
  }
  const order = [0, 1, 1, 0];
  state.panels.forEach((panel, i) => {
    const photo = photos[order[i % order.length]];
    if (photo) panel.photo = photo.img;
  });
  renderTray();
}

async function waitForFonts() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 100px Anton'),
        document.fonts.load('400 40px "Archivo Black"'),
        document.fonts.ready,
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    fontsReady = true;
  } catch {
    fontsReady = false;
  }
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    state, photos, loadImage, loadSamples, waitForFonts, render, exportPng,
    setSelectedPanel: (i) => { selectedPanel = i; },
  });
} else {
  await waitForFonts();
  await loadSamples();
  render();
}

// For screenshots and debugging: the live state and a manual re-render.
window.__app = { state, render, exportPng, photos: () => photos, fontsReady: () => fontsReady };
