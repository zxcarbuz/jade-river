import * as THREE from 'three';
import { mulberry32, CJK_FONT } from './util.js';

const cache = new Map();
const all = [];
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  all.push(t);
  return t;
}
function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }
export function disposeTextures() { all.forEach((t) => t.dispose()); all.length = 0; cache.clear(); }

function speckle(g, w, h, n, r, colors, alpha, R) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + R() * 0.6);
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    const s = r * (0.3 + R());
    g.beginPath(); g.ellipse(R() * w, R() * h, s, s * (0.5 + R()), R() * 3, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

export const plasterTex = () => memo('plaster', () => {
  const [c, g] = canvas(512, 512); const R = mulberry32(11);
  g.fillStyle = '#f1ece1'; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 900, 18, ['#e6dfd0', '#f7f3ea', '#ddd5c4'], 0.25, R);
  // aged water stains rising from the base
  const gr = g.createLinearGradient(0, 512, 0, 300);
  gr.addColorStop(0, 'rgba(92,98,84,0.55)'); gr.addColorStop(0.35, 'rgba(120,122,104,0.28)'); gr.addColorStop(1, 'rgba(150,150,130,0)');
  g.fillStyle = gr; g.fillRect(0, 300, 512, 212);
  for (let i = 0; i < 22; i++) {
    const x = R() * 512, len = 20 + R() * 90, wd = 6 + R() * 18;
    const gg = g.createLinearGradient(0, 0, 0, len);
    gg.addColorStop(0, 'rgba(110,112,100,0.10)'); gg.addColorStop(1, 'rgba(110,112,100,0)');
    g.save(); g.translate(x, R() < 0.5 ? 0 : 512 - len - 40 * R()); g.fillStyle = gg; g.fillRect(0, 0, wd, len); g.restore();
  }
  speckle(g, 512, 512, 60, 40, ['#c9c2b0'], 0.12, R);
  return tex(c);
});

export const pavingTex = () => memo('paving', () => {
  const [c, g] = canvas(512, 512); const R = mulberry32(21);
  g.fillStyle = '#4a4a44'; g.fillRect(0, 0, 512, 512);
  let y = 0;
  while (y < 512) {
    const rh = 40 + Math.floor(R() * 40); let x = -Math.floor(R() * 60);
    while (x < 512) {
      const rw = 60 + Math.floor(R() * 90);
      const l = 105 + Math.floor(R() * 45), tint = Math.floor(R() * 12);
      g.fillStyle = `rgb(${l - tint},${l},${l - 6 - tint})`;
      g.fillRect(x + 2, y + 2, rw - 4, rh - 4);
      // wear & mottling
      for (let k = 0; k < 14; k++) { g.globalAlpha = 0.10; g.fillStyle = R() < 0.5 ? '#2c2e28' : '#d8d6cc'; g.beginPath(); g.ellipse(x + R() * rw, y + R() * rh, 4 + R() * 16, 3 + R() * 8, R() * 3, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      // wrap horizontally
      if (x + rw > 512) { g.drawImage(c, 512, y, x + rw - 512, rh, 0, y, x + rw - 512, rh); }
      x += rw;
    }
    y += rh;
  }
  // moss in grout
  speckle(g, 512, 512, 300, 4, ['#4f6a3a', '#3e5a2e'], 0.35, R);
  return tex(c);
});

export const stoneBlockTex = () => memo('stoneblock', () => {
  const [c, g] = canvas(512, 512); const R = mulberry32(31);
  g.fillStyle = '#3d403b'; g.fillRect(0, 0, 512, 512);
  const rows = 8, rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -64 : 0;
    while (x < 512) {
      const rw = 90 + Math.floor(R() * 70);
      const l = 112 + Math.floor(R() * 40);
      g.fillStyle = `rgb(${l - 4},${l + 2},${l - 8})`;
      g.fillRect(x + 3, r * rh + 3, rw - 6, rh - 6);
      for (let k = 0; k < 10; k++) { g.globalAlpha = 0.12; g.fillStyle = R() < 0.6 ? '#2f332c' : '#e2e0d4'; g.fillRect(x + R() * rw, r * rh + R() * rh, 6 + R() * 24, 2 + R() * 6); }
      g.globalAlpha = 1; x += rw;
    }
  }
  const gr = g.createLinearGradient(0, 512, 0, 340);
  gr.addColorStop(0, 'rgba(48,70,40,0.55)'); gr.addColorStop(1, 'rgba(48,70,40,0)');
  g.fillStyle = gr; g.fillRect(0, 340, 512, 172);
  return tex(c);
});

export const woodTex = () => memo('wood', () => {
  const [c, g] = canvas(256, 256); const R = mulberry32(41);
  g.fillStyle = '#6b4a33'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++) {
    g.globalAlpha = 0.10 + R() * 0.18; g.strokeStyle = R() < 0.5 ? '#3e2717' : '#8a6448';
    g.lineWidth = 1 + R() * 2; const x = R() * 256;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + R() * 10 - 5, 80, x + R() * 10 - 5, 170, x + R() * 8 - 4, 256); g.stroke();
  }
  g.globalAlpha = 1;
  return tex(c);
});

export const tileTex = () => memo('tile', () => {
  const [c, g] = canvas(256, 256); const R = mulberry32(51);
  g.fillStyle = '#5b5f63'; g.fillRect(0, 0, 256, 256);
  // tile courses (horizontal rows down the slope)
  for (let y = 0; y < 256; y += 16) {
    const gr = g.createLinearGradient(0, y, 0, y + 16);
    gr.addColorStop(0, '#7a7e80'); gr.addColorStop(0.75, '#55595c'); gr.addColorStop(1, '#2b2e31');
    g.fillStyle = gr; g.fillRect(0, y, 256, 16);
  }
  speckle(g, 256, 256, 260, 5, ['#3c4f3a', '#8b8f8a', '#45403a'], 0.25, R);
  return tex(c);
});

export const latticeTex = (variant = 0) => memo('lattice' + variant, () => {
  const S = 256; const [c, g] = canvas(S, S); const [e, ge] = canvas(S, S);
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, S, S); // rice paper
  ge.fillStyle = '#fff'; ge.fillRect(0, 0, S, S);
  const wood = '#4a2c1c';
  const line = (x1, y1, x2, y2, w) => { for (const [ctx, col] of [[g, wood], [ge, '#000']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); } };
  const rect = (x, y, w, h, lw) => { for (const [ctx, col] of [[g, wood], [ge, '#000']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); } };
  rect(8, 8, S - 16, S - 16, 16);
  if (variant === 0) { // square-and-diamond lattice
    for (let i = 1; i < 6; i++) { line(8 + i * 40, 8, 8 + i * 40, S - 8, 5); line(8, 8 + i * 40, S - 8, 8 + i * 40, 5); }
    for (let i = -6; i < 7; i++) { line(8 + i * 40, 8, 8 + i * 40 + 120, 128, 3); }
  } else if (variant === 1) { // ice-crack lattice
    const R = mulberry32(77);
    const pts = []; for (let i = 0; i < 26; i++) pts.push([20 + R() * (S - 40), 20 + R() * (S - 40)]);
    for (const p of pts) { const q = pts[Math.floor(R() * pts.length)]; line(p[0], p[1], q[0], q[1], 4); line(p[0], p[1], R() < 0.5 ? 8 : S - 8, p[1], 4); }
  } else { // vertical slats with a central medallion
    for (let i = 1; i < 9; i++) line(8 + i * 26.7, 8, 8 + i * 26.7, S - 8, 4);
    for (let i = 1; i < 5; i++) line(8, 8 + i * 48, S - 8, 8 + i * 48, 4);
    for (const [ctx, col] of [[g, wood], [ge, '#000']]) { ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(S / 2, S / 2, 46, 0, 7); ctx.stroke(); }
  }
  // darken edges of the paper a little
  const vg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, 180);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.25)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
  return { map: tex(c, { repeat: false }), emissive: tex(e, { repeat: false }) };
});

export const doorTex = () => memo('door', () => {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#5a2f22'; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#3a1d14'; g.fillRect(126, 0, 4, 512);
  for (const x of [0, 128]) {
    g.strokeStyle = '#2a140d'; g.lineWidth = 6; g.strokeRect(x + 16, 24, 96, 200); g.strokeRect(x + 16, 250, 96, 236);
    g.fillStyle = 'rgba(255,220,180,0.07)'; g.fillRect(x + 22, 30, 84, 188);
  }
  g.fillStyle = '#c9a24a'; for (const x of [112, 144]) { g.beginPath(); g.arc(x, 260, 9, 0, 7); g.fill(); }
  // red couplets
  g.fillStyle = '#a3241d'; g.fillRect(4, 40, 10, 420); g.fillRect(242, 40, 10, 420);
  return tex(c, { repeat: false });
});

export const grassTex = () => memo('grass', () => {
  const [c, g] = canvas(512, 512); const R = mulberry32(61);
  g.fillStyle = '#5d7a3a'; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 2600, 6, ['#6e8c44', '#4c6a2f', '#7d9a4f', '#58703a', '#8a8d4a'], 0.35, R);
  speckle(g, 512, 512, 120, 30, ['#4a6630', '#738d45'], 0.15, R);
  return tex(c);
});

export const softTex = () => memo('soft', () => {
  const [c, g] = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return tex(c, { srgb: false, repeat: false });
});

export const petalTex = () => memo('petal', () => {
  const [c, g] = canvas(64, 64);
  g.translate(32, 32);
  const gr = g.createRadialGradient(0, 4, 2, 0, 0, 26);
  gr.addColorStop(0, '#fff4f6'); gr.addColorStop(1, '#f2a7bd');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(22, -16, 18, 18, 0, 26); g.bezierCurveTo(-18, 18, -22, -16, 0, -26); g.fill();
  return tex(c, { repeat: false });
});

export const blossomTex = () => memo('blossom', () => {
  const [c, g] = canvas(256, 256); const R = mulberry32(71);
  for (let i = 0; i < 70; i++) {
    const x = 30 + R() * 196, y = 30 + R() * 196, r = 6 + R() * 9;
    const pink = R() < 0.55;
    for (let p = 0; p < 5; p++) {
      const a = p / 5 * Math.PI * 2 + R();
      g.fillStyle = pink ? (R() < 0.5 ? '#f6b7c9' : '#f39ab4') : '#fff1f4';
      g.beginPath(); g.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, 0, 7); g.fill();
    }
    g.fillStyle = '#c94a6a'; g.beginPath(); g.arc(x, y, r * 0.22, 0, 7); g.fill();
  }
  return tex(c, { repeat: false });
});

export const leafCardTex = (kind) => memo('leaf' + kind, () => {
  const W = 256, H = kind === 'willow' ? 512 : 256; const [c, g] = canvas(W, H); const R = mulberry32(kind.length * 13);
  const greens = kind === 'willow' ? ['#5f7f2e', '#7a9a3c', '#4a6a24', '#8aa84a'] : kind === 'bamboo' ? ['#6f9a3e', '#87ad4c', '#4d7a2c', '#9cbc5a'] : ['#4f7232', '#5f863a', '#3f6128', '#6f9446'];
  if (kind === 'willow') {
    for (let s = 0; s < 6; s++) {
      let x = 26 + s * 40 + R() * 10, y = R() * 30;
      while (y < H - 10) {
        const len = 16 + R() * 10; g.fillStyle = greens[Math.floor(R() * 4)];
        g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.9);
        g.beginPath(); g.ellipse(0, len / 2, 2.6, len / 2, 0, 0, 7); g.fill(); g.restore();
        y += 10 + R() * 7; x += (R() - 0.5) * 3;
      }
    }
  } else if (kind === 'bamboo') {
    for (let i = 0; i < 46; i++) {
      const x = 30 + R() * 196, y = 30 + R() * 196, a = R() * 6.28, len = 30 + R() * 34;
      g.fillStyle = greens[Math.floor(R() * 4)];
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, len * 0.4, 0, len); g.quadraticCurveTo(-5, len * 0.4, 0, 0); g.fill(); g.restore();
    }
  } else {
    for (let i = 0; i < 160; i++) {
      const a = R() * 6.28, rr = Math.sqrt(R()) * 110, x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr;
      g.fillStyle = greens[Math.floor(R() * 4)];
      g.save(); g.translate(x, y); g.rotate(R() * 6.28); g.beginPath(); g.ellipse(0, 0, 5, 11, 0, 0, 7); g.fill(); g.restore();
    }
  }
  return tex(c, { repeat: false });
});

export const clothTex = (base, stripe) => memo('cloth' + base + stripe, () => {
  const [c, g] = canvas(128, 128); const R = mulberry32(base.length * 7 + 3);
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  if (stripe) { g.fillStyle = stripe; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128); }
  speckle(g, 128, 128, 200, 3, ['rgba(0,0,0,0.5)', 'rgba(255,255,255,0.5)'], 0.12, R);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 118, 128, 10);
  return tex(c);
});

// Signboards with Chinese characters. horizontal plaques or vertical boards.
export function signTex(text, { vertical = false, bg = '#1d1410', fg = '#d8b35a', border = '#8c6a2c', red = false } = {}) {
  return memo('sign' + text + vertical + bg + fg, () => {
    const n = [...text].length;
    const W = vertical ? 128 : 128 * n + 64, H = vertical ? 128 * n + 64 : 160;
    const [c, g] = canvas(W, H);
    g.fillStyle = red ? '#8e1f1a' : bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
    g.lineWidth = 2; g.strokeRect(20, 20, W - 40, H - 40);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${vertical ? 96 : 104}px ${CJK_FONT}`;
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4;
    [...text].forEach((ch, i) => {
      if (vertical) g.fillText(ch, W / 2, 32 + 64 + i * 128);
      else g.fillText(ch, 32 + 64 + i * 128, H / 2 + 4);
    });
    const t = tex(c, { repeat: false });
    t.userData = { aspect: W / H };
    return t;
  });
}

// interior lime plaster: warm, mottled, with faint trowel arcs, hairline cracks and soot near the top
export const agedPlasterTex = () => memo('agedPlaster', () => {
  const [c, g] = canvas(512, 512); const R = mulberry32(73);
  g.fillStyle = '#ece2cf'; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 1400, 22, ['#e2d6bf', '#f4ecdc', '#d9cbb1', '#e8dcc6'], 0.3, R);
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(170,150,120,${0.05 + R() * 0.06})`; g.lineWidth = 4 + R() * 10; const x = R() * 512, y = R() * 512, r = 30 + R() * 70; g.beginPath(); g.arc(x, y, r, R() * 6, R() * 6 + 1.2); g.stroke(); }
  for (let i = 0; i < 7; i++) { g.strokeStyle = 'rgba(120,100,80,0.22)'; g.lineWidth = 1; let x = R() * 512, y = R() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 26; y += 6 + R() * 16; g.lineTo(x, y); } g.stroke(); }
  const top = g.createLinearGradient(0, 0, 0, 160); top.addColorStop(0, 'rgba(70,52,36,0.22)'); top.addColorStop(1, 'rgba(70,52,36,0)'); g.fillStyle = top; g.fillRect(0, 0, 512, 160);
  const bot = g.createLinearGradient(0, 512, 0, 400); bot.addColorStop(0, 'rgba(90,80,60,0.18)'); bot.addColorStop(1, 'rgba(90,80,60,0)'); g.fillStyle = bot; g.fillRect(0, 400, 512, 112);
  return tex(c);
});
// ambient-occlusion helpers: vertical gradient strip (dark at v=0) and a soft radial contact blob
export const aoTextures = () => memo('ao', () => {
  const [c, g] = canvas(8, 128); const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.62)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  const strip = tex(c, { repeat: false });
  const [c2, g2] = canvas(128, 128); const rg = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,0.7)'); rg.addColorStop(0.55, 'rgba(255,255,255,0.3)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = rg; g2.fillRect(0, 0, 128, 128);
  const blob = tex(c2, { repeat: false });
  // the material colour is black, so the texture only drives alpha
  strip.userData.alpha = blob.userData.alpha = true;
  return { strip, blob };
});
