/*
 * 手机外壳：锁屏、桌面、打开/关闭 App、App 内的页面前进后退、通知横幅、提示、底部面板、看大图、手势和快捷键。
 */
'use strict';

/* ---------- 提示 / 面板 / 大图 ---------- */
let toastT;
function toast(t, ms = 2600) {
  const e = $('#toast'); e.textContent = t; e.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms);
}
/* sheetLock：登录面板开着时为 true —— 点背景、按 Esc 都关不掉，别的面板也弹不出来 */
let sheetLock = false;
function openSheet(build) {
  if (sheetLock) return;
  const s = $('#sheet'), p = $('.sheet-panel', s);
  p.textContent = ''; p.scrollTop = 0; p.className = 'sheet-panel'; build(p, closeSheet); s.classList.add('on');
}
function closeSheet() { if (sheetLock) return; $('#sheet').classList.remove('on'); }
function lockSheet(on) { sheetLock = !!on; $('#sheet').classList.toggle('locked', sheetLock); }
const sheetOpen = () => $('#sheet').classList.contains('on');
function sheetHead(title, left, right) {
  return el('div', { class: 'sheet-head' }, left || el('span'), el('h3', {}, title), right || el('span'));
}
function confirmSheet(title, sub, ok, danger) {
  if (sheetLock) return Promise.resolve(false);   // 登录面板开着：别的确认一律当作「取消」
  return new Promise(res => openSheet((p, close) => {
    p.append(el('div', { class: 'sheet-title' }, title), sub ? el('p', { class: 'sub' }, sub) : '',
      el('div', { class: 'btnrow' },
        el('button', { class: 'btn', onclick: () => { close(); res(false); } }, '取消'),
        el('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { close(); res(true); } }, ok)));
  }));
}
function openViewer(id) { const v = $('#viewer'), im = $('img', v); im.removeAttribute('src'); setImg(im, id); v.classList.add('on'); }
const viewerOpen = () => $('#viewer').classList.contains('on');
$('.sheet-back').addEventListener('click', closeSheet);
$('#viewer').addEventListener('click', () => $('#viewer').classList.remove('on'));

/* ---------- App 内的页面栈（前进 push / 后退 pop） ---------- */
const Nav = {
  stacks: {},
  root: app => $('#app-' + app),
  reset(app, builder) {
    const r = this.root(app); r.textContent = '';
    const pg = el('div', { class: 'page' }); builder(pg, app); r.append(pg);
    this.stacks[app] = [pg];
    return pg;
  },
  push(app, builder, { instant = false } = {}) {
    const st = this.stacks[app], prev = st[st.length - 1];
    const pg = el('div', { class: 'page' + (instant ? '' : ' enter') });
    builder(pg, app); this.root(app).append(pg); st.push(pg);
    if (instant) prev.classList.add('under');
    else { pg.getBoundingClientRect(); requestAnimationFrame(() => { pg.classList.remove('enter'); prev.classList.add('under'); }); }
    syncInk();
    return pg;
  },
  pop(app) {
    const st = this.stacks[app]; if (!st || st.length < 2) return false;
    const pg = st.pop(), prev = st[st.length - 1];
    pg.classList.add('enter'); prev.classList.remove('under');
    if (pg.onclose) pg.onclose();
    if (prev.refresh) prev.refresh();
    setTimeout(() => pg.remove(), 380);
    syncInk();
    return true;
  },
  popToRoot(app) {
    const st = this.stacks[app]; if (!st) return;
    while (st.length > 1) { const pg = st.pop(); if (pg.onclose) pg.onclose(); pg.remove(); }
    st[0].classList.remove('under');
    if (st[0].refresh) st[0].refresh();
  },
  top(app) { const st = this.stacks[app]; return st && st[st.length - 1]; },
  refresh(app) { const t = this.top(app); if (t && t.refresh) t.refresh(); }
};

/* 系统风格的顶栏 */
function iosNav(app, { title = '', back = '', right = null, flat = false } = {}) {
  const b = back ? el('button', { class: 'ios-back', onclick: () => Nav.pop(app) }, icon('back', 26, 2.4), back) : el('span');
  return el('header', { class: 'ios-nav' + (flat ? ' flat' : '') }, b, el('h2', {}, title), right || el('span'));
}
function iosGroup(title, rows, foot) {
  return el('section', { class: 'ios-group' }, title ? el('h3', {}, title) : '', el('div', { class: 'ios-card' }, rows), foot ? el('p', { class: 'ios-foot' }, foot) : '');
}
function iosLink({ ic, color, label, sub, value, onclick, chevron = true, cls = '' }) {
  return el('button', { class: 'ios-row' + (ic ? ' has-ic' : '') + (cls ? ' ' + cls : ''), onclick },
    ic ? el('span', { class: 'ios-ic', style: `background:${color}` }, icon(ic, 19, 2)) : '',
    el('span', { class: 'lbl' }, label, sub ? el('small', {}, sub) : ''),
    value != null && value !== '' ? el('span', { class: 'val' }, value) : '',
    chevron ? el('span', { class: 'chev' }, icon('chevron', 18, 2.2)) : '');
}

/* ---------- 切换屏幕 ---------- */
let cur = 'lock';
/* 网页里有仿真界面的 App；其余点开是一个说明页 */
const appRoots = () => ({ wx: wxRoot, diary: diaryRoot, settings: settingsRoot, camera: cameraRoot, calc: calcRoot, photos: photosRoot, calendar: calendarRoot, notes: notesRoot, clock: clockRoot, appstore: appStoreRoot, weather: weatherRoot, voicememos: voiceMemosRoot });
const secOf = name => appRoots()[name] ? name : 'shell';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function show(name) {
  const prev = cur;
  if (name === 'lock' && prev !== 'lock') rememberPlace();   // 锁屏前记下在哪，解锁后回到这里
  if (name === 'lock') $('#lock').classList.add('on');
  else $('#lock').classList.remove('on');
  const sec = APPS[name] ? 'app-' + secOf(name) : '';
  $$('.app.scr').forEach(s => s.classList.toggle('on', s.id === sec));
  if (name !== 'lock') cur = name;
  else cur = 'lock';
  $('#phone').dataset.screen = name;
  $('#banner').classList.remove('on');
  if (name === 'lock') renderLock();
  if (name === 'home' || name === 'lock') renderHome();
  if (prev === 'camera' && name !== 'camera') stopCamera();
  syncInk();
  if (name !== 'lock' && typeof pushMaybeAsk === 'function') pushMaybeAsk();   // 第一次进到手机里：问要不要开通知（js/core/push.js）
}
/* 你在知己里的哪儿（哪个 App、是不是在和她的聊天里）：锁屏或切走时记下，解锁后回到这里，像真的手机 */
function rememberPlace() {
  if (cur === 'lock' || !ST.started) return;
  ST.resume = { app: cur, chat: cur === 'wx' && threadVisible() };
  saveST();
}
/* 在 iPhone 上：有跳转地址的 App（第二页的第三方 App、图书、播客）直接打开手机里真的那个 */
function launchReal(d) {
  const t0 = Date.now();
  location.href = d.ios;
  setTimeout(() => { if (!document.hidden && Date.now() - t0 < 4000) { toast(`没能打开「${d.label}」，手机里可能没装`); openApp(d.id, null, true); } }, 1800);
}
/* 打开 App：从图标的位置放大出来 */
function openApp(name, fromEl, noJump) {
  const d = appDef(name);
  if (!noJump && isIOS() && d.ios && name !== 'wx' && name !== 'settings') { launchReal(d); return; }
  const sec = secOf(name);
  const scr = $('#app-' + sec);
  const src = fromEl || $(`.home [data-app="${name}"] .squircle`);
  if (src && scr) {
    const pr = $('#phone').getBoundingClientRect(), r = src.getBoundingClientRect();
    const k = pr.width / $('#phone').offsetWidth || 1;
    scr.style.setProperty('--ox', ((r.left + r.width / 2 - pr.left) / k) + 'px');
    scr.style.setProperty('--oy', ((r.top + r.height / 2 - pr.top) / k) + 'px');
  }
  if (sec === 'shell') Nav.reset('shell', pg => shellPage(pg, name));
  else if (!Nav.stacks[name]) Nav.reset(name, appRoots()[name]); else Nav.refresh(name);
  show(name);
  if (name === 'wx') markRead();
  if (name === 'camera') startCamera();
}
function goHome() { if (cur !== 'home') show('home'); else if (!closeFolder()) exitEdit(); }
/* 没有仿真界面的 App（电脑上点开时） */
function shellPage(pg, id) {
  if (APPS[id] && APPS[id].open) return thirdPartyPage(pg, id);
  const d = appDef(id);
  pg.append(iosNav('shell', { flat: true }), el('div', { class: 'ios-body shell-body' }, appIcon(id, 84), el('h1', {}, d.label),
    el('p', {}, d.ios ? `在 iPhone 上点这个图标，会直接打开手机里真的「${d.label}」。` : `这是「知己」里模拟的「${d.label}」，不会打开、也读不到你手机里真的那个。`),
    el('p', { class: 'hint' }, '点底部横条或按 Esc 回到桌面')));
}
function unlock(then) {
  if (!ST.started) { show('home'); openApp('settings'); Nav.popToRoot('settings'); return; }
  show('home');
  if (then) { then(); return; }
  const r = ST.resume;   // 回到上次离开的地方（相机不自动打开）
  if (r && r.app && r.app !== 'home' && r.app !== 'camera' && APPS[r.app]) {
    openApp(r.app, null, true);
    if (r.app === 'wx' && r.chat) openThread(true);
  }
}
/* 状态栏颜色：锁屏、桌面、相机、朋友圈封面上用白字 */
function syncInk() {
  const top = APPS[cur] && Nav.top(cur);
  const light = cur === 'lock' || cur === 'home' || cur === 'camera' || cur === 'calc' || (top && top.classList.contains('ink-light'));
  $('#phone').dataset.ink = light ? 'light' : 'dark';
}

document.addEventListener('click', e => { const g = e.target.closest('[data-app]'); if (g) openApp(g.dataset.app, $('.squircle', g)); });
$('#unlock').addEventListener('click', () => unlock());
$('#torch').addEventListener('click', e => { const b = e.currentTarget; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
$('#lockcam').addEventListener('click', () => unlock(() => openApp('camera')));
$('#homesearch').addEventListener('click', () => { if (!ST.started) return unlock(); openApp('wx'); Nav.popToRoot('wx'); Nav.push('wx', wxSearchPage, { instant: true }); });

/* ---------- 手势：锁屏上滑解锁；底部横条点一下或往上拖回桌面 ---------- */
(function lockGesture() {
  const L = $('#lock'); let y0 = null, dy = 0;
  L.addEventListener('pointerdown', e => { if (e.target.closest('.note,.round-btn,.unlock')) return; y0 = e.clientY; dy = 0; L.setPointerCapture(e.pointerId); });
  L.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.min(0, e.clientY - y0);
    if (dy < -4) { L.style.transition = 'none'; L.style.transform = `translateY(${dy / (zoomK())}px)`; }
  });
  const end = () => { if (y0 == null) return; L.style.transition = ''; L.style.transform = ''; if (dy < -70) unlock(); y0 = null; };
  L.addEventListener('pointerup', end); L.addEventListener('pointercancel', end);
})();
const zoomK = () => { const p = $('#phone'); return (p.getBoundingClientRect().width / p.offsetWidth) || 1; };
(function homebarGesture() {
  const H = $('#homebar'); let y0 = null, dy = 0, scr = null, moved = false;
  H.addEventListener('pointerdown', e => {
    y0 = e.clientY; dy = 0; moved = false; H.setPointerCapture(e.pointerId);
    scr = APPS[cur] ? $('#app-' + cur) : null;
  });
  H.addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.min(0, (e.clientY - y0) / zoomK());
    if (dy < -6) moved = true;
    if (scr && moved) {
      const s = Math.max(.45, 1 + dy / 520);
      scr.classList.add('dragging');
      scr.style.transform = `translateY(${dy * .35}px) scale(${s})`;
      scr.style.borderRadius = '42px';
    }
  });
  const end = () => {
    if (y0 == null) return;
    if (scr) { scr.classList.remove('dragging'); scr.style.transform = ''; scr.style.borderRadius = ''; }
    if (!moved || dy < -60) { if (cur === 'lock') unlock(); else goHome(); }
    y0 = null; scr = null;
  };
  H.addEventListener('pointerup', end); H.addEventListener('pointercancel', end);
  H.addEventListener('click', e => { if (e.detail === 0) { if (cur === 'lock') unlock(); else goHome(); } }); // 键盘回车
})();

/* 键盘：Esc 返回上一级，已经在 App 首页就回桌面 */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (setupOpen() && !sheetOpen()) return;   // 第一次打开的「你好」页面：要先登录
  const a = document.activeElement;
  if (viewerOpen()) { $('#viewer').classList.remove('on'); return; }
  if (sheetOpen()) { closeSheet(); return; }
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.blur(); return; }
  if (cur === 'lock') { unlock(); return; }
  if (cur === 'home') { if (!closeFolder()) exitEdit(); return; }
  const top = APPS[cur] && Nav.top(cur);
  if (top && top.closeMenu && top.closeMenu()) return;
  if (APPS[cur]) { if (!Nav.pop(cur)) goHome(); }
});

/* 电脑上让整台手机按比例缩放到窗口里 */
function fitPhone() {
  const mobile = matchMedia('(max-width:520px),(display-mode:standalone)').matches;
  const d = document.documentElement;   // 放在 <html> 上：手机两边的「知己」「Knowwo.」也按手机的实际宽度排
  if (mobile) { d.style.removeProperty('--z'); return; }
  const z = Math.min(1, (innerHeight - 64) / 876, (innerWidth - 32) / 417);
  d.style.setProperty('--z', Math.max(.45, z).toFixed(3));
}
addEventListener('resize', fitPhone);

/* ---------- 状态栏：专注模式图标、无线局域网 / 5G、飞行模式、电量 ---------- */
const FOCUS_MODES = {
  dnd:      { label: '勿扰模式', color: '#5E5CE6', d: '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z" fill="currentColor"/>' },
  personal: { label: '个人', color: '#AF52DE', d: '<circle cx="12" cy="7.5" r="4.2" fill="currentColor"/><path d="M3.5 21c.6-4.6 4-7.2 8.5-7.2s7.9 2.6 8.5 7.2z" fill="currentColor"/>' },
  sleep:    { label: '睡眠', color: '#30B0C7', d: '<path d="M2 19V6h2.4v7.5H22V19h-2.4v-2.6H4.4V19zM6 12.3a2.4 2.4 0 1 1 4.8 0zm6.2 0V8.6h5.6a3.7 3.7 0 0 1 3.7 3.7z" fill="currentColor"/>' },
  work:     { label: '工作', color: '#30A46C', d: '<path d="M9 3h6v4h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5zm2 2v2h2V5z" fill="currentColor"/>' }
};
function focusGlyph(mode, size = 14) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = (FOCUS_MODES[mode] || FOCUS_MODES.dnd).d;
  return s;
}
function syncStatusIcons() {
  const ph = $('#phone');
  ph.classList.toggle('airplane', !!S.notify.airplane);
  ph.classList.toggle('focus', !!S.notify.focus);
  ph.classList.toggle('wifi', !!S.look.wifi);
  ph.classList.toggle('lowpower', !!S.look.lowPower);
  ph.classList.toggle('charging', !!(battery && battery.charging));
  ph.classList.toggle('big-icons', S.look.icons !== 'small');
  const f = $('#sbfocus'); f.textContent = '';
  if (S.notify.focus) f.append(focusGlyph(S.notify.focusMode, 14));
}

/* ---------- 时钟、电量（电脑上的 Chrome 能读到真实电量） ---------- */
let lastMin = '', battery = null;
if (navigator.getBattery) navigator.getBattery().then(b => { battery = b; b.addEventListener('chargingchange', syncStatusIcons); b.addEventListener('levelchange', tickClock); syncStatusIcons(); tickClock(); }).catch(() => {});
function tickClock() {
  const n = Date.now(), t = hm(n), d = new Date(n);
  $('#sbtime').textContent = t; $('#locktime').textContent = t;
  $('#lockdate').textContent = `${d.getMonth() + 1}月${d.getDate()}日星期${WD[d.getDay()]}`;
  const lv = battery ? Math.round(battery.level * 100) : Math.max(22, 100 - Math.floor(Math.max(0, d.getHours() * 60 + d.getMinutes() - 420) / 15));
  $('#sbbatt').textContent = lv;
  $('#sbbattery').style.setProperty('--lv', lv + '%');
  if (t !== lastMin) { lastMin = t; if (cur === 'lock') renderLock(); if (cur === 'home') renderHome(); }
}

/* ---------- 锁屏 & 桌面 ---------- */
const unreadList = () => M.filter(m => m.from === 'her' && m.ts > ST.lastRead);
const preview = m => previewOf(m);
function noteAvatar() {
  const av = el('img', { alt: '' }); setAvatar(av);
  const mini = appIcon('wx', 18); mini.classList.add('mini-app');
  return el('span', { class: 'note-av' }, av, mini);
}
function renderLock() {
  paintWall($('#lockwall'), 'lock');
  const box = $('#notes'); box.textContent = '';
  if (!ST.started) {
    box.append(el('button', { class: 'note', onclick: () => unlock() },
      el('span', { class: 'note-sys' }, appIcon('settings', 38)),
      el('div', {}, el('div', { class: 'note-top' }, el('span', {}, APPS.settings.label), el('time', {}, '现在')),
        el('p', {}, `先告诉${TA()}是谁、你们是什么关系，然后就能开始收到${TA()}的消息。`))));
    return;
  }
  const un = S.notify.lockShow === false ? [] : unreadList();   // 设置 → 通知 → 锁定屏幕
  for (const m of un.slice(-4).reverse()) {
    box.append(el('button', { class: 'note', onclick: () => unlock(() => { openApp('wx'); openThread(true); }) }, noteAvatar(),
      el('div', {}, el('div', { class: 'note-top' }, el('span', {}, wxName()), el('time', {}, relTime(m.ts))), el('p', {}, notePreview(m, 'lock')))));
  }
  if (un.length > 4) box.append(el('div', { class: 'more' }, `还有 ${un.length - 4} 条通知`));
}
/* 页码点：平时显示「搜索」，左右滑的时候换成页码点（和 iOS 26 一样） */
let pagingT;
function syncDots() {
  const pages = $('#homepages'), i = Math.round(pages.scrollLeft / (pages.clientWidth || 1));
  $$('#homedots button').forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
}
$('#homepages').addEventListener('scroll', () => {
  requestAnimationFrame(syncDots);
  const t = $('#hometools'); t.classList.add('paging');
  clearTimeout(pagingT); pagingT = setTimeout(() => t.classList.remove('paging'), 900);
});
/* 倒数日 */
function countdownInfo() {
  const c = S.countdown, t = new Date((c.date || dkey(Date.now())) + 'T00:00:00'), today = new Date(dkey(Date.now()) + 'T00:00:00');
  const days = Math.round((t - today) / 864e5);
  return { title: c.title || '倒数日', days: Math.abs(days), past: days < 0, date: c.date, wd: WD[t.getDay()] };
}
function editCountdown(after) {
  openSheet((p, close) => {
    const title = el('input', { value: S.countdown.title, placeholder: '比如：下次见面', 'aria-label': '标题' });
    const date = el('input', { type: 'date', value: S.countdown.date, 'aria-label': '日期' });
    p.append(sheetHead('倒数日', el('button', { onclick: close }, '取消'), el('button', { onclick: () => {
      S.countdown.title = title.value.trim() || '倒数日'; if (date.value) S.countdown.date = date.value; saveS(); close(); renderHome(); if (after) after();
    } }, '完成')),
      iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '标题'), title), el('label', { class: 'ios-field' }, el('span', {}, '日期'), date)],
        '日期还没到，显示「还有几天」；已经过了，显示「已经几天」（比如在一起的纪念日）。'));
  });
}

function askCheckin(id) {
  if (!ST.started) return unlock();
  const t = taskById(id); if (!t) return;
  if (todayChecks()[id]) { toast(`今天${t.name}已经打过卡了`); return; }
  confirmSheet(`现在去${t.name}？`, `会发一条打卡消息给${herName()}。`, '打卡').then(ok => {
    if (!ok) return;
    openApp('wx'); openThread(true); doCheckin(id);
  });
}
function updateBadges() {
  const all = unreadList().length, n = S.notify.badge === false ? 0 : all;   // 设置 → 通知 → 标记：图标上的红色数字
  $$('.wxbadge').forEach(b => { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  document.title = (all ? `(${all}) ` : '') + APP_TITLE;
  if ('setAppBadge' in navigator) { try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {} }   // 主屏幕图标上的红色数字
  if (Nav.stacks.wx && Nav.stacks.wx[0].updateBadges) Nav.stacks.wx[0].updateBadges();
}

/* ---------- 新消息提醒 ---------- */
/* 通知上显示什么：设置 → 通知 → 显示预览。始终 / 解锁时（锁屏上不显示内容）/ 从不 */
const HIDDEN_TEXT = () => isEN() ? 'sent you a message' : '发来一条消息';
function notePreview(m, where) {
  const p = S.notify.preview || 'always';
  return p === 'never' || (p === 'unlocked' && where === 'lock') ? HIDDEN_TEXT() : preview(m);
}
let bannerT;
function showBanner(title, body, onclick) {
  const b = $('#banner'); b.textContent = '';
  b.append(noteAvatar(), el('div', {}, el('div', { class: 'note-top' }, el('span', {}, title), el('time', {}, '现在')), el('p', {}, body)));
  b.onclick = () => { b.classList.remove('on'); onclick(); };
  b.classList.add('on');
  clearTimeout(bannerT);
  if (S.notify.bannerStyle !== 'keep') bannerT = setTimeout(() => b.classList.remove('on'), 4500);   // 持续：点掉或往上划才消失
}
(function bannerSwipe() {   // 横幅往上划：收起
  const b = $('#banner'); let y0 = null;
  b.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
  b.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 < -18) { b.classList.remove('on'); y0 = null; } }, { passive: true });
})();
/* 来消息的提示音（网页开着时）：两声短促的「叮」。真正锁屏通知的声音由手机决定 */
let chimeCtx = null;
function playChime() {
  try {
    chimeCtx = chimeCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (chimeCtx.state === 'suspended') chimeCtx.resume();
    const t = chimeCtx.currentTime;
    [[880, 0], [1318.5, 0.11]].forEach(([f, d]) => {
      const o = chimeCtx.createOscillator(), g = chimeCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.32);
      o.connect(g).connect(chimeCtx.destination); o.start(t + d); o.stop(t + d + 0.34);
    });
  } catch (e) {}
}
document.addEventListener('pointerdown', () => { if (chimeCtx && chimeCtx.state === 'suspended') chimeCtx.resume(); }, { passive: true });
/* 和 iPhone 一样的居中弹窗。buttons：[{ label, bold, value }]，点哪个就返回它的 value */
function iosAlert({ title, message, buttons }) {
  return new Promise(res => {
    const wrap = el('div', { class: 'ios-alert-wrap', role: 'alertdialog', 'aria-label': title });
    const done = v => { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 220); res(v); };
    wrap.append(el('div', { class: 'ios-alert' },
      el('div', { class: 'ios-alert-text' }, el('h3', {}, title), message ? el('p', {}, message) : ''),
      el('div', { class: 'ios-alert-btns' + (buttons.length > 2 ? ' col' : '') }, ...buttons.map(b => el('button', { class: b.bold ? 'bold' : '', onclick: () => done(b.value) }, b.label)))));
    $('#phone').append(wrap);
    requestAnimationFrame(() => wrap.classList.add('on'));
  });
}
function systemNotify(title, body) {
  if (!S.notify.system || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: S.her.avatar || undefined, tag: 'qmar' });
    n.onclick = () => { window.focus(); openApp('wx'); openThread(true); n.close(); };
  } catch (e) {   // 有的手机浏览器只允许通过 Service Worker 发通知
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(r => r && r.showNotification(title, { body, tag: 'qmar', data: { url: './?open=chat' } })).catch(() => {});
  }
}
function onHerMessage(m) {
  if (threadVisible() && !document.hidden) { markRead(); return; }
  updateBadges();
  if (cur === 'lock') renderLock();
  else if (cur === 'home') renderHome();
  const hush = S.notify.focus || S.zx.mute, quiet = hush || !S.notify.banner;
  if (cur !== 'lock' && !document.hidden && !quiet) showBanner(wxName(), notePreview(m, 'banner'), () => { openApp('wx'); openThread(true); });
  if (!document.hidden && !hush && S.notify.sound !== false) playChime();
  if (document.hidden && !hush) systemNotify(wxName(), notePreview(m, 'banner'));
  if (cur === 'wx' && Nav.top('wx') === Nav.stacks.wx[0]) Nav.refresh('wx');
}
