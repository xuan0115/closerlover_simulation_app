/*
 * 墙纸：锁屏和主屏幕各用哪张，设置里的「墙纸」页面，
 * 以及默认的「竹林」——用代码画出来的，不需要图片文件。
 */
'use strict';

/* ---------- 用代码画的竹林（远景画得小再放大，就是虚化的效果） ---------- */
function drawBamboo(W = 786, H = 1704) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 20261031;
  const R = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cx = W * .5;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f4f8e8'); bg.addColorStop(.2, '#d6e8b0'); bg.addColorStop(.5, '#8db466'); bg.addColorStop(.8, '#4b7238'); bg.addColorStop(1, '#2a4322');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(cx, H * .1, 10, cx, H * .1, W * .8);
  glow.addColorStop(0, 'rgba(255,255,245,1)'); glow.addColorStop(.3, 'rgba(244,250,220,.55)'); glow.addColorStop(1, 'rgba(244,250,220,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  function stalk(x, xb, wb, lean, dark, light, alpha) {
    const xt = cx + (xb - cx) * lean, wt = wb * .72, top = -40, bot = H + 40;
    x.save(); x.globalAlpha = alpha;
    x.beginPath(); x.moveTo(xb - wb / 2, bot); x.lineTo(xt - wt / 2, top); x.lineTo(xt + wt / 2, top); x.lineTo(xb + wb / 2, bot); x.closePath();
    const sh = x.createLinearGradient(xb - wb / 2, 0, xb + wb / 2, 0);
    sh.addColorStop(0, dark); sh.addColorStop(.3, light); sh.addColorStop(.6, light); sh.addColorStop(1, dark);
    x.fillStyle = sh; x.fill();
    const seg = 120 + R() * 110;
    for (let y = bot - R() * seg; y > top; y -= seg * (.85 + R() * .3)) {
      const t = (y - top) / (bot - top), cxs = xt + (xb - xt) * t, w = wt + (wb - wt) * t, h = Math.max(1.5, w * .05);
      x.fillStyle = 'rgba(25,40,18,.4)'; x.fillRect(cxs - w / 2, y, w, h);
      x.fillStyle = 'rgba(255,255,235,.28)'; x.fillRect(cxs - w / 2, y + h, w, h * .7);
    }
    x.restore();
  }
  function leaves(x, px, py, n, size, cols, alpha) {
    x.save(); x.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      x.save(); x.translate(px + (R() - .5) * size * 3.2, py + (R() - .5) * size * 2);
      x.rotate(Math.PI / 2 + (R() - .5) * 2.2);
      x.fillStyle = cols[Math.floor(R() * cols.length)];
      x.beginPath(); x.ellipse(0, 0, size * (.6 + R() * .6), size * .13, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.restore();
  }
  function layer(scale, draw) {
    const l = document.createElement('canvas'); l.width = Math.round(W * scale); l.height = Math.round(H * scale);
    const x = l.getContext('2d'); x.scale(scale, scale); draw(x);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(l, 0, 0, W, H);
  }
  // 远景：很浅、很虚
  layer(.12, x => {
    for (let i = 0; i < 34; i++) stalk(x, R() * W, 12 + R() * 16, .6 + R() * .25, '#86a564', '#c3d99c', .6);
    for (let i = 0; i < 50; i++) leaves(x, R() * W, R() * H * .5, 14, 24, ['#b2d083', '#98bd6c', '#cfe3a3'], .5);
  });
  // 中景：有点虚
  layer(.3, x => {
    for (let i = 0; i < 16; i++) { const k = R(); stalk(x, (k < .5 ? k * .8 : .2 + k * .8) * W, 18 + R() * 18, .5 + R() * .25, '#4a6b32', '#8fb565', .85); }
    for (let i = 0; i < 40; i++) leaves(x, R() * W, R() * H * .38, 16, 26, ['#6b9643', '#82ad52', '#9cc468', '#577f39'], .7);
  });
  // 近景：只在两边，清楚
  for (const k of [.02, .11, .87, .97]) stalk(g, k * W + (R() - .5) * 24, 30 + R() * 22, .4 + R() * .15, '#22351a', '#6a8f45', 1);
  layer(.6, x => {
    for (let i = 0; i < 22; i++) leaves(x, R() < .5 ? R() * W * .32 : W - R() * W * .32, R() * H * .26, 16, 32, ['#34552a', '#466f30', '#5b853c'], .8);
  });
  const vg = g.createRadialGradient(cx, H * .42, W * .35, cx, H * .5, H * .78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(12,22,8,.42)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return c.toDataURL('image/jpeg', .88);
}

let bambooURL = '';
const bamboo = () => bambooURL || (bambooURL = drawBamboo());

/* ---------- 现在用的是哪张 ----------
 * 锁屏 S.look.wall：WALLPAPERS 里的一项，或 'her'（她最近发的照片）、'custom'（自己选的照片）、'color'（纯色）
 * 主屏幕 S.look.home：'same' 和锁屏一样、'blur' 锁屏那张虚化、'color' 纯色、'custom' 另选一张照片
 */
const WALL_COLORS = ['#2F4A2A', '#1E2A44', '#3A2E5C', '#5C2E3E', '#7A5A2E', '#2E5C58', '#48484A', '#E8E1D5'];
const colorCSS = c => `radial-gradient(120% 70% at 50% 0%,${c}88,transparent 70%),linear-gradient(180deg,${c} 0%,${c} 40%,#0d0d10 160%)`;
function latestPhotoId() {
  for (let i = M.length - 1; i >= 0; i--) { const m = M[i]; if (m.from === 'her' && m.type === 'image') return m.imageId; }
  for (const p of [...POSTS].reverse()) if (p.author !== 'me' && p.imageIds && p.imageIds[0]) return p.imageIds[0];
  return null;
}
async function lockWallBG() {
  const k = S.look.wall;
  if (k === 'custom') { const s = await imgSrc('wall:lock'); if (s) return { url: s, photo: true }; }
  if (k === 'her') { const id = latestPhotoId(), s = id && await imgSrc(id); if (s) return { url: s, photo: true }; }
  if (k === 'color') return { css: colorCSS(S.look.lockColor) };
  const w = WALLPAPERS[k] || WALLPAPERS.bamboo;
  if (w.draw === 'bamboo') return { url: bamboo() };
  return { css: w.css };
}
async function homeWallBG() {
  const h = S.look.home;
  if (h === 'color') return { css: colorCSS(S.look.homeColor) };
  if (h === 'custom') { const s = await imgSrc('wall:home'); if (s) return { url: s, photo: true }; }
  return Object.assign(await lockWallBG(), { blur: h === 'blur' });
}
function wallName() {
  const k = S.look.wall;
  return k === 'custom' ? '我的照片' : k === 'her' ? `${herName()}的照片` : k === 'color' ? '颜色' : (WALLPAPERS[k] || WALLPAPERS.bamboo).label;
}
/* 把墙纸画到某个 .wall 元素上（同一张就不重画，避免闪） */
async function paintWall(node, which) {
  const w = which === 'home' ? await homeWallBG() : await lockWallBG();
  const bg = w.url ? `center/cover no-repeat url("${w.url}")` : w.css;
  if (node._bg !== bg) { node.style.background = bg; node._bg = bg; }
  node.classList.toggle('photo', !!w.photo && which === 'lock');
  node.classList.toggle('blur', !!w.blur);
}

/* ---------- 设置 → 墙纸 ---------- */
function wpPreview(which) {
  const wall = el('div', { class: 'wall' }); paintWall(wall, which);
  const box = el('div', { class: 'wp-prev wp-' + which }, wall);
  if (which === 'lock') {
    const d = new Date();
    box.append(el('div', { class: 'wp-date' }, `${d.getMonth() + 1}月${d.getDate()}日 星期${WD[d.getDay()]}`), el('div', { class: 'wp-time' }, hm(Date.now())));
  } else {
    const grid = el('div', { class: 'wp-grid' });
    const items = homeLayout().pages[0].map(it => it.startsWith('widget:') ? (it === 'widget:countdown' ? 'W2' : it === 'widget:her' ? 'W2g' : 'W4') : it);
    for (const it of items) {
      if (it === 'W4') grid.append(el('span', { class: 'w4' }));
      else if (it === 'W2') grid.append(el('span', { class: 'w2' }));
      else if (it === 'W2g') grid.append(el('span', { class: 'w2 glass' }));
      else { const st = artOf(it.startsWith('folder:') ? 'folder' : it) || {}; grid.append(el('span', { style: `background:${st.bg || 'rgba(255,255,255,.35)'}` })); }
    }
    box.append(grid, el('div', { class: 'wp-dock' }, ...homeLayout().dock.map(id => el('span', { style: `background:${(artOf(id.startsWith('folder:') ? 'folder' : id) || {}).bg}` }))));
  }
  return box;
}
function settingsWallPage(pg, app) {
  subPage(pg, app, '墙纸', (b, re) => {
    b.append(el('div', { class: 'ios-card wp-card' },
      el('div', { class: 'wp-pair' },
        el('button', { class: 'wp-col', onclick: () => addWallSheet(re), 'aria-label': '自定锁定屏幕' }, wpPreview('lock')),
        el('button', { class: 'wp-col', onclick: () => homeWallSheet(re), 'aria-label': '自定主屏幕' }, wpPreview('home'))),
      el('div', { class: 'wp-acts' },
        el('button', { class: 'wp-btn', onclick: () => addWallSheet(re) }, '自定'),
        el('button', { class: 'wp-btn', onclick: () => homeWallSheet(re) }, '自定'))),
      el('button', { class: 'wp-add', onclick: () => addWallSheet(re) }, icon('plus', 18, 2.4), '添加新墙纸'));
    const homeLbl = { same: '与锁定屏幕相同', blur: '模糊', color: '颜色', custom: '照片' }[S.look.home];
    b.append(iosGroup('', [
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '锁定屏幕'), el('span', { class: 'val' }, wallName())),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '主屏幕'), el('span', { class: 'val' }, homeLbl))],
      '点上面的「自定」换墙纸。也可以选手机里自己的照片。'));
  });
}
/* 「添加新墙纸」：照片、她的照片、颜色、精选 */
function addWallSheet(re) {
  const done = () => { saveS(); closeSheet(); re && re(); renderLock(); renderHome(); toast('墙纸已更换'); };
  openSheet((p, close) => {
    p.append(sheetHead('添加新墙纸', el('button', { onclick: close }, '取消')));
    const cats = el('div', { class: 'wp-cats' },
      el('button', { onclick: async () => { const s = await pickWallPhoto(); if (!s) return; await IDB.put('wall:lock', s); imgCache.set('wall:lock', s); S.look.wall = 'custom'; done(); } },
        el('span', { class: 'wp-cat', style: 'background:linear-gradient(135deg,#5AC8FA,#007AFF)' }, icon('photo', 26, 2)), '照片'),
      el('button', { onclick: () => herPhotoPicker(p, re) },
        el('span', { class: 'wp-cat', style: 'background:linear-gradient(135deg,#FF9F7A,#FF2D55)' }, icon('heart', 26, 2)), `${herName()}的照片`),
      el('button', { onclick: () => colorPicker(p, 'lock', re) },
        el('span', { class: 'wp-cat', style: 'background:conic-gradient(#FF3B30,#FF9500,#FFCC00,#34C759,#5AC8FA,#007AFF,#AF52DE,#FF3B30)' }, icon('sun', 26, 2)), '颜色'));
    const grid = el('div', { class: 'wp-feat' });
    for (const [k, w] of Object.entries(WALLPAPERS)) {
      const t = el('button', { class: 'wp-thumb' + (S.look.wall === k ? ' on' : ''), onclick: () => { S.look.wall = k; done(); } }, el('span', { class: 'wall' }), el('small', {}, w.label));
      t.firstChild.style.background = w.draw === 'bamboo' ? `center/cover url("${bamboo()}")` : w.css;
      grid.append(t);
    }
    p.append(cats, el('h4', { class: 'wp-h' }, '精选'), grid);
  });
}
async function pickWallPhoto() {
  const [f] = await pickFile('image/*'); if (!f) return '';
  try { return await compress(await fileToDataURL(f), 1600, .88); } catch (e) { toast(e.message); return ''; }
}
function herPhotoPicker(p, re) {
  const ids = allPhotos();
  p.textContent = '';
  p.append(sheetHead(`${herName()}的照片`, el('button', { onclick: () => addWallSheet(re) }, '返回')));
  const auto = el('button', { class: 'ios-row', onclick: () => { S.look.wall = 'her'; saveS(); closeSheet(); re && re(); renderHome(); toast(`墙纸会跟着${TA()}最近发的照片换`); } },
    el('span', { class: 'lbl' }, `总是用${TA()}最近发的那张`), S.look.wall === 'her' ? el('span', { class: 'check' }, icon('check', 20, 2.4)) : '');
  p.append(iosGroup('', [auto]));
  if (!ids.length) { p.append(el('p', { class: 'empty' }, `${TA()}还没发过照片。`)); return; }
  const g = el('div', { class: 'photo-grid wp-pg' });
  for (const ph of ids) {
    const im = el('img', { alt: '' }); setImg(im, ph.id);
    g.append(el('button', { onclick: async () => { const s = await imgSrc(ph.id); if (!s) return; await IDB.put('wall:lock', s); imgCache.set('wall:lock', s); S.look.wall = 'custom'; saveS(); closeSheet(); re && re(); renderHome(); toast('墙纸已更换'); } }, im));
  }
  p.append(g);
}
function colorPicker(p, which, re) {
  p.textContent = '';
  p.append(sheetHead('颜色', el('button', { onclick: () => which === 'lock' ? addWallSheet(re) : homeWallSheet(re) }, '返回')));
  const row = el('div', { class: 'wp-colors' });
  const cur = which === 'lock' ? S.look.lockColor : S.look.homeColor;
  for (const c of WALL_COLORS) row.append(el('button', { 'aria-label': c, 'aria-pressed': String(c === cur), style: `background:${c}`, onclick: () => {
    if (which === 'lock') { S.look.lockColor = c; S.look.wall = 'color'; } else { S.look.homeColor = c; S.look.home = 'color'; }
    saveS(); closeSheet(); re && re(); renderLock(); renderHome(); toast('墙纸已更换');
  } }));
  p.append(row);
}
/* 主屏幕的「自定」：配对、模糊、颜色、照片 */
function homeWallSheet(re) {
  openSheet((p, close) => {
    p.append(sheetHead('主屏幕', el('button', { onclick: close }, '取消')));
    const set = v => { S.look.home = v; saveS(); close(); re && re(); renderHome(); };
    const opt = (v, label, swatch, onclick) => el('button', { class: 'wp-opt', 'aria-pressed': String(S.look.home === v), onclick: onclick || (() => set(v)) }, swatch, el('small', {}, label));
    const sw = cls => { const w = el('span', { class: 'wall ' + cls }); return el('span', { class: 'wp-sw' }, w); };
    const a = sw(''), bl = sw('blur');
    lockWallBG().then(w => { const bg = w.url ? `center/cover url("${w.url}")` : w.css; a.firstChild.style.background = bg; bl.firstChild.style.background = bg; });
    const col = el('span', { class: 'wp-sw' }, el('span', { class: 'wall', style: `background:${colorCSS(S.look.homeColor)}` }));
    const ph = el('span', { class: 'wp-sw icon' }, icon('photo', 24, 2));
    p.append(el('div', { class: 'wp-opts' },
      opt('same', '配对', a), opt('blur', '模糊', bl),
      opt('color', '颜色', col, () => colorPicker(p, 'home', re)),
      opt('custom', '照片', ph, async () => { const s = await pickWallPhoto(); if (!s) return; await IDB.put('wall:home', s); imgCache.set('wall:home', s); set('custom'); })),
      el('p', { class: 'ios-foot' }, '「配对」和锁定屏幕用同一张，「模糊」是把那张虚化。'));
  });
}
