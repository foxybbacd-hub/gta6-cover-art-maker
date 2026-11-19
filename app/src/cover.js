// Sunset Cover Maker — the drawing engine.
// Draws the whole cover onto any canvas at its own size: multi-panel photo collage,
// a hand-drawn sunset strip (striped sun, skyline, palm silhouettes), and the bold
// caption. Every shape here is drawn with canvas paths — no game artwork, no logos.

// Deterministic pseudo-random, so the skyline looks the same on every redraw.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRADES = {
  sunset: {
    sky: ['#ff9e45', '#ff2e88', '#5b1a8a'],
    sunTop: '#ffe259', sunBot: '#ff7e3d',
    silhouette: '#1c0a2e', bg: '#2a1140', glow: '#ff2e88',
  },
  neon: {
    sky: ['#00e5ff', '#ff00a8', '#12042b'],
    sunTop: '#a5fff3', sunBot: '#ff2ec4',
    silhouette: '#0a0618', bg: '#0d0524', glow: '#00e5ff',
  },
  noir: {
    sky: ['#e8e8e8', '#8a8a8a', '#141414'],
    sunTop: '#ffffff', sunBot: '#9a9a9a',
    silhouette: '#000000', bg: '#1a1a1a', glow: '#ffffff',
  },
  vice: {
    sky: ['#2de2c5', '#ff5e8a', '#2b1055'],
    sunTop: '#fff3a3', sunBot: '#ff6b9d',
    silhouette: '#160b2e', bg: '#1d0f3a', glow: '#2de2c5',
  },
};

export const LAYOUTS = {
  quad: { panels: 4, label: 'Quad · 2×2' },
  hero: { panels: 3, label: 'Hero + strip' },
  trio: { panels: 3, label: 'Trio columns' },
};

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080 },
  '1080x1350': { w: 1080, h: 1350 },
  '1920x1080': { w: 1920, h: 1080 },
};

/** Panel rectangles for a layout: the panels sit above the sunset band. */
export function panelRects(layout, W, H, bandH, g) {
  const areaH = H - bandH;
  if (layout === 'quad') {
    const cw = (W - g * 3) / 2, ch = (areaH - g * 3) / 2;
    return [
      { x: g, y: g, w: cw, h: ch },
      { x: g * 2 + cw, y: g, w: cw, h: ch },
      { x: g, y: g * 2 + ch, w: cw, h: ch },
      { x: g * 2 + cw, y: g * 2 + ch, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const heroH = areaH * 0.58;
    const stripH = areaH - heroH - g * 3;
    const cw = (W - g * 3) / 2;
    return [
      { x: g, y: g, w: W - g * 2, h: heroH },
      { x: g, y: g * 2 + heroH, w: cw, h: stripH },
      { x: g * 2 + cw, y: g * 2 + heroH, w: cw, h: stripH },
    ];
  }
  const cw = (W - g * 4) / 3;
  return [0, 1, 2].map((i) => ({ x: g + i * (cw + g), y: g, w: cw, h: areaH - g * 2 }));
}

/** Retro striped sun: a gradient disc cut by horizontal bars that widen downwards. */
function drawSun(ctx, cx, cy, r, top, bot, stripe) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = stripe;
  let y = cy + r * 0.02;
  let t = Math.max(1.5, r * 0.035);
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, t);
    y += t + r * 0.15;
    t *= 1.5;
  }
  ctx.restore();
}

/** One palm silhouette: a leaning trunk and seven drooping frond blades. */
function drawPalm(ctx, x, y, s, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  const crownX = lean * 16, crownY = -76;
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-2 + lean * 5, -38, crownX - 3, crownY);
  ctx.lineTo(crownX + 3, crownY);
  ctx.quadraticCurveTo(2 + lean * 5, -38, 4, 0);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.06 + 0.88 * (i / 6));
    const len = 32 + (i % 3) * 7;
    const dx = Math.cos(a) * len;
    const dy = -Math.abs(Math.sin(a)) * len * 0.72 - 4;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(crownX + dx * 0.55, crownY + dy * 0.55 - 7, crownX + dx, crownY + dy + 15);
    ctx.quadraticCurveTo(crownX + dx * 0.5, crownY + dy * 0.5 + 13, crownX, crownY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(crownX - 4, crownY + 4, 3, 0, Math.PI * 2);
  ctx.arc(crownX + 4, crownY + 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A row of dark buildings with a few lit windows, seeded so it never changes. */
function drawSkyline(ctx, x, yBase, w, h, color, seed) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  let x0 = x;
  while (x0 < x + w) {
    const bw = w * (0.035 + rnd() * 0.055);
    const bh = h * (0.3 + rnd() * 0.7);
    ctx.fillRect(x0, yBase - bh, bw, bh);
    if (rnd() > 0.65) ctx.fillRect(x0 + bw / 2 - 1, yBase - bh - h * 0.14, 2, h * 0.14);
    const lit = 1 + Math.floor(rnd() * 4);
    ctx.fillStyle = 'rgba(255, 190, 90, 0.9)';
    for (let k = 0; k < lit; k++) {
      const wx = x0 + 2 + rnd() * Math.max(1, bw - 6);
      const wy = yBase - bh + 3 + rnd() * Math.max(1, bh - 8);
      ctx.fillRect(wx, wy, 2.5, 3.5);
    }
    ctx.fillStyle = color;
    x0 += bw + w * 0.01;
  }
}

/** Three tiny birds: two short strokes each, high in the sky. */
function drawBirds(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = Math.max(1.5, s * 0.03);
  ctx.lineCap = 'round';
  const spots = [[0, 0, 1], [20, -12, 0.8], [40, 5, 0.65]];
  for (const [dx, dy, k] of spots) {
    const bx = x + dx * s * 0.02, by = y + dy * s * 0.02, r = 5 * s * 0.02 * k;
    ctx.beginPath();
    ctx.moveTo(bx - r, by);
    ctx.quadraticCurveTo(bx - r * 0.4, by - r * 0.7, bx, by);
    ctx.quadraticCurveTo(bx + r * 0.4, by - r * 0.7, bx + r, by);
    ctx.stroke();
  }
  ctx.restore();
}

/** The colour grade over one photo panel, applied with composite operations. */
function gradePanel(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  if (grade === 'sunset') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255, 140, 60, 0.05)');
    g.addColorStop(1, 'rgba(200, 20, 110, 0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 110, 60, 0.55)';
    ctx.fillRect(x, y, w, h);
  } else if (grade === 'neon') {
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(0, 229, 255, 0.30)');
    g.addColorStop(1, 'rgba(255, 0, 168, 0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  } else if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, 'rgba(45, 226, 197, 0.26)');
    g.addColorStop(1, 'rgba(255, 94, 138, 0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  const v = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
    x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, 'rgba(5, 2, 12, 0)');
  v.addColorStop(1, 'rgba(5, 2, 12, 0.32)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
}

/** Cover-fits a photo into a panel, with zoom and a pan offset (fractions of the panel). */
function drawPhotoInto(ctx, img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const s = base * zoom;
  const pw = img.naturalWidth * s;
  const ph = img.naturalHeight * s;
  const maxOx = Math.max(0, (pw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (ph - rect.h) / 2 / rect.h);
  const cx = rect.x + rect.w / 2 + Math.max(-maxOx, Math.min(maxOx, ox)) * rect.w;
  const cy = rect.y + rect.h / 2 + Math.max(-maxOy, Math.min(maxOy, oy)) * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

/** A designed fallback for a panel with no photo yet: sky, sun and palms. */
function drawEmptyPanel(ctx, rect, g, seed) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, g.sky[0]);
  sky.addColorStop(0.6, g.sky[1]);
  sky.addColorStop(1, g.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawSun(ctx, rect.x + rect.w / 2, rect.y + rect.h * 0.38, Math.min(rect.w, rect.h) * 0.2,
    g.sunTop, g.sunBot, g.sky[1]);
  drawPalm(ctx, rect.x + rect.w * 0.12, rect.y + rect.h, Math.min(rect.w, rect.h) / 190, -0.4, g.silhouette);
  drawPalm(ctx, rect.x + rect.w * 0.88, rect.y + rect.h, Math.min(rect.w, rect.h) / 230, 0.5, g.silhouette);
  const shine = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** The sunset strip along the foot of the cover: sky, sun, skyline, palms, birds. */
function drawSunsetBand(ctx, W, H, bandH, g) {
  const top = H - bandH;
  const sky = ctx.createLinearGradient(0, top, 0, H);
  sky.addColorStop(0, g.sky[0]);
  sky.addColorStop(0.55, g.sky[1]);
  sky.addColorStop(1, g.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, top, W, bandH);
  const sunR = bandH * 0.42;
  const sunX = W * 0.5;
  const sunY = top + bandH * 0.34;
  drawSun(ctx, sunX, sunY, sunR, g.sunTop, g.sunBot, g.sky[1]);
  drawBirds(ctx, W * 0.16, top + bandH * 0.12, bandH * 0.5, g.silhouette);
  drawSkyline(ctx, 0, H, W, bandH * 0.26, g.silhouette, 20261119);
  drawPalm(ctx, W * 0.045, H, bandH / 95, 0.55, g.silhouette);
  drawPalm(ctx, W * 0.955, H, bandH / 115, -0.6, g.silhouette);
  const topEdge = ctx.createLinearGradient(0, top, 0, top + bandH * 0.12);
  topEdge.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
  topEdge.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = topEdge;
  ctx.fillRect(0, top, W, bandH * 0.12);
}

/** Bold condensed caption, auto-shrunk to fit, with outline and glow. `|` splits lines. */
function drawCaption(ctx, W, H, bandH, state, g) {
  const lines = state.caption.split('|').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!lines.length) return;
  const glowColors = { pink: '#ff2e88', cyan: '#00e5ff', gold: '#ffc53d', none: null };
  const glow = glowColors[state.captionGlow] ?? g.glow;
  let anchorY;
  if (state.captionPos === 'top') anchorY = H * 0.085;
  else if (state.captionPos === 'center') anchorY = (H - bandH) * 0.5;
  else anchorY = H - bandH * 0.19;
  let size = H * 0.115 * state.captionSize;
  const fit = (sz) => {
    ctx.font = `400 ${sz}px Anton, 'Archivo Black', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(sz * 0.02)}px`; } catch { /* older canvas */ }
    return Math.max(...lines.map((l) => ctx.measureText(l).width));
  };
  while (fit(size) > W * 0.92 && size > 14) size -= 2;
  while (size * 1.06 * lines.length > bandH * 0.88 && size > 14) {
    size -= 2;
    fit(size);
  }
  fit(size);
  const blockH = size * 1.06 * lines.length;
  if (state.captionPos === 'bottom') {
    anchorY = Math.min(anchorY, H - blockH / 2 - 10);
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(8, 3, 18, 0.28)';
  ctx.beginPath();
  ctx.ellipse(W / 2, anchorY, W * 0.44, blockH * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  if (state.captionGlow !== 'none') {
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.32;
  }
  lines.forEach((line, i) => {
    const y = anchorY + (i - (lines.length - 1) / 2) * size * 1.06;
    if (state.captionOutline) {
      ctx.strokeStyle = '#160a24';
      ctx.lineWidth = Math.max(2, size * 0.085);
      ctx.strokeText(line, W / 2, y);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(line, W / 2, y);
  });
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

/** Small spaced tagline at the top (or the foot when the caption is on top). */
function drawTagline(ctx, W, H, state) {
  const text = state.tagline.trim().toUpperCase();
  if (!text) return;
  const size = H * 0.021;
  const y = state.captionPos === 'top' ? H - H * 0.016 : H * 0.032;
  ctx.save();
  ctx.font = `400 ${size}px 'Archivo Black', sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.55)}px`; } catch { /* ignore */ }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = size * 0.5;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
}

/**
 * Draws the whole cover onto `canvas` at its own size.
 * state: { layout, grade, caption, captionSize, captionPos, captionOutline,
 *   captionGlow, tagline, panels: [{ photo, zoom, ox, oy }] }
 * A panel photo is an HTMLImageElement (or null for an empty panel).
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const g = GRADES[state.grade] ?? GRADES.sunset;
  const bandH = Math.round(H * 0.28);
  const gut = Math.max(6, Math.round(W * 0.008));

  ctx.fillStyle = g.bg;
  ctx.fillRect(0, 0, W, H);
  const bgGlow = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, Math.max(W, H) * 0.7);
  bgGlow.addColorStop(0, g.sky[1] + '33');
  bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(state.layout, W, H, bandH, gut);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: null, zoom: 1.15, ox: 0, oy: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (panel.photo) {
      drawPhotoInto(ctx, panel.photo, rect, panel.zoom, panel.ox, panel.oy);
      gradePanel(ctx, rect, state.grade);
    } else {
      drawEmptyPanel(ctx, rect, g, 1000 + i);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  drawSunsetBand(ctx, W, H, bandH, g);
  if (state.captionPos !== 'top') {
    const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.09);
    scrim.addColorStop(0, 'rgba(10, 4, 20, 0.38)');
    scrim.addColorStop(1, 'rgba(10, 4, 20, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H * 0.09);
  }
  drawTagline(ctx, W, H, state);
  drawCaption(ctx, W, H, bandH, state, g);
}
