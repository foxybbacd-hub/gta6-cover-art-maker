// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample photo
// loaded; ?shot=cover shows the PNG the app itself exported, scaled to the viewport.
// Layout, grade, size, caption and photos come from the query string, so each
// screenshot can show a different cover. window.__shotReady is set once painted.
import { drawCover, SIZES, LAYOUTS } from './cover.js';

function applyChoice(query, key, values, state) {
  const v = query.get(key);
  if (v && values.includes(v)) state[key] = v;
}

export async function runShot(shot, query, api) {
  const { state, loadSamples, waitForFonts, render } = api;
  applyChoice(query, 'layout', Object.keys(LAYOUTS), state);
  applyChoice(query, 'grade', ['sunset', 'neon', 'noir', 'vice'], state);
  applyChoice(query, 'size', Object.keys(SIZES), state);
  if (query.get('caption') !== null) state.caption = query.get('caption');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  applyChoice(query, 'captionPos', ['bottom', 'top', 'center'], state);
  applyChoice(query, 'captionGlow', ['pink', 'cyan', 'gold', 'none'], state);
  const zoom = Number(query.get('zoom'));
  if (Number.isFinite(zoom) && zoom >= 1 && zoom <= 3) {
    state.panels.forEach((p) => { p.zoom = zoom; });
  }
  // Per-panel crops: zoom, ox, oy accept comma lists (one value per panel,
  // missing entries keep the default) so a shot can frame each photo well.
  const cropList = (key) => (query.get(key) || '').split(',').map((s) => Number(s.trim()));
  const zooms = cropList('zooms');
  const oxs = cropList('ox');
  const oys = cropList('oy');
  state.panels.forEach((p, i) => {
    if (Number.isFinite(zooms[i]) && zooms[i] >= 1 && zooms[i] <= 3) p.zoom = zooms[i];
    if (Number.isFinite(oxs[i])) p.ox = Math.max(-1.8, Math.min(1.8, oxs[i]));
    if (Number.isFinite(oys[i])) p.oy = Math.max(-1.8, Math.min(1.8, oys[i]));
  });

  await waitForFonts();
  await loadSamples();
  const wanted = (query.get('photos') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (wanted.length) {
    const byName = new Map(api.photos.map((p) => [p.name.replace('Sample: ', ''), p]));
    state.panels.forEach((panel, i) => {
      const pick = byName.get(wanted[i % wanted.length]);
      if (pick) panel.photo = pick.img;
    });
  }
  render();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.querySelector('.shot-view').hidden = false;
    const { w, h } = SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    drawCover(off, state);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    const img = document.getElementById('shot-img');
    img.src = URL.createObjectURL(blob);
    await img.decode();
    window.__shotReady = true;
    return;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
