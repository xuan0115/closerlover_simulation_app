/*
 * 桌面：排布（存在 S.layout 里）、画出来、长按进入编辑（抖动、删除、拖动换位置）、
 * 加回小组件，以及「App Store」—— 下载 / 重新下载壳子。
 * 默认排布在 js/data/ui.js 的 HOME_LAYOUT、FOLDERS。
 */
'use strict';

/* ---------- 排布 ---------- */
function homeLayout() {
  if (!S.layout || !Array.isArray(S.layout.pages)) S.layout = { pages: clone(HOME_LAYOUT.pages), dock: clone(HOME_LAYOUT.dock), folders: clone(FOLDERS) };
  if (!S.layout.folders) S.layout.folders = clone(FOLDERS);
  return S.layout;
}
const canDelete = it => it.startsWith('widget:') || (APPS[it] && !NO_DELETE.includes(it));
const cellsOf = it => it === 'widget:checkin' ? 8 : it.startsWith('widget:') ? 4 : 1;
const PAGE_CELLS = 24; // 4 列 × 6 行
function installedApps() {
  const L = homeLayout(), set = new Set();
  const add = it => { if (APPS[it]) set.add(it); else if (it.startsWith('folder:')) ((L.folders[it.slice(7)] || {}).apps || []).forEach(a => set.add(a)); };
  L.pages.flat().forEach(add); L.dock.forEach(add);
  return set;
}
/* 整理：去掉不认识的、空文件夹；一页放不下就挤到下一页；去掉空页（第一页留着） */
function normalizeLayout() {
  const L = homeLayout();
  const ok = it => it.startsWith('widget:') || APPS[it] || (it.startsWith('folder:') && L.folders[it.slice(7)] && L.folders[it.slice(7)].apps.length);
  L.dock = L.dock.filter(it => ok(it) && !it.startsWith('widget:')).slice(0, 4);
  const pages = L.pages.map(p => p.filter(ok));
  for (let i = 0; i < pages.length; i++) {
    let used = 0;
    for (let j = 0; j < pages[i].length; j++) {
      used += cellsOf(pages[i][j]);
      if (used > PAGE_CELLS) { const extra = pages[i].splice(j); if (!pages[i + 1]) pages.push([]); pages[i + 1].unshift(...extra); break; }
    }
  }
  L.pages = pages.filter((p, i) => i === 0 || p.length);
}
function removeItem(it) {
  const L = homeLayout();
  L.pages = L.pages.map(p => p.filter(x => x !== it));
  L.dock = L.dock.filter(x => x !== it);
  for (const f of Object.values(L.folders)) f.apps = f.apps.filter(a => a !== it);
  normalizeLayout();
}
/* 新装的 App：放在最后一页还有空的地方，满了就新开一页 */
function placeNew(it) {
  const L = homeLayout();
  let p = L.pages.findIndex((pg, i) => i > 0 && pg.reduce((n, x) => n + cellsOf(x), 0) + cellsOf(it) <= PAGE_CELLS);
  if (p < 0) p = L.pages[0].reduce((n, x) => n + cellsOf(x), 0) + cellsOf(it) <= PAGE_CELLS && L.pages.length === 1 ? 0 : -1;
  if (p < 0) { L.pages.push([]); p = L.pages.length - 1; }
  L.pages[p].push(it);
  normalizeLayout();
  return L.pages.findIndex(pg => pg.includes(it));
}

/* ---------- 画桌面 ---------- */
let editing = false;
function delBadge(it, label) {
  return el('button', { class: 'del-badge', 'aria-label': `删除${label}`, onclick: e => { e.stopPropagation(); askDelete(it, label); } }, icon('minus', 14, 3));
}
function appButton(id) {
  const d = appDef(id);
  const b = el('button', { class: 'app-ic', 'data-app': id, 'data-item': id, 'aria-label': d.label, title: d.label }, appIcon(id), el('span', { class: 'lbl' }, d.label));
  if (id === 'wx') b.append(el('span', { class: 'badge wxbadge', hidden: true }));
  if (id === 'settings' && !ST.started) b.append(el('span', { class: 'badge' }, '1'));
  if (editing && canDelete(id)) b.append(delBadge(id, d.label));
  return b;
}
function folderButton(key) {
  const f = homeLayout().folders[key]; if (!f) return '';
  const tile = el('span', { class: 'squircle folder' });
  for (const id of f.apps.slice(0, 9)) tile.append(appIcon(id));
  return el('button', { class: 'app-ic', 'data-folder': key, 'data-item': 'folder:' + key, 'aria-label': `文件夹：${f.name}`, title: f.name, onclick: () => openFolder(key) }, tile, el('span', { class: 'lbl' }, f.name));
}
function openFolder(key) {
  const f = homeLayout().folders[key], pop = $('#folderpop'), panel = $('#fppanel');
  if (!f) return;
  pop.dataset.key = key;
  $('#fptitle').textContent = f.name; panel.textContent = '';
  for (const id of f.apps) if (APPS[id]) panel.append(appButton(id));
  pop.classList.add('on'); pop.setAttribute('aria-hidden', 'false');
}
function closeFolder() {
  const pop = $('#folderpop'); if (!pop.classList.contains('on')) return false;
  pop.classList.remove('on'); pop.setAttribute('aria-hidden', 'true'); return true;
}
$('#folderpop').addEventListener('click', e => { if (!e.target.closest('.app-ic')) closeFolder(); });

function widgetEl(w, c) {
  const cell = (lbl, node) => el('div', { class: 'wcell' }, node, el('span', { class: 'lbl' }, lbl));
  let node = null;
  if (w === 'her') {
    const last = [...M].reverse().find(m => m.from === 'her');
    const av = el('img', { alt: '' }); setAvatar(av);
    node = cell(appDef('wx').label, el('button', { class: 'widget her2', 'aria-label': `${herName()}的消息`, onclick: () => { if (!ST.started) return unlock(); openApp('wx'); openThread(true); } },
      el('div', { class: 'w-top' }, av, el('span', {}, herName())),
      last ? el('div', { class: 'w-say' }, preview(last)) : el('div', { class: 'w-say quiet' }, ST.started ? '还没有消息' : '先去「设置」设定人物'),
      last ? el('time', { class: 'w-time' }, relTime(last.ts)) : ''));
  }
  if (w === 'countdown') {
    const k = countdownInfo();
    node = cell('倒数日', el('button', { class: 'widget cd', 'aria-label': `${k.title}${k.past ? '已经' : '还有'} ${k.days} 天`, onclick: () => editCountdown() },
      el('div', { class: 'cd-head' }, `${k.title} ${k.past ? '已经' : '还有'}`),
      el('div', { class: 'cd-body' }, el('div', { class: 'cd-num' }, String(k.days)), el('div', { class: 'cd-date' }, `${k.date} 星期${k.wd}`))));
  }
  if (w === 'checkin') {
    const small = (kind, ic, label) => cell(`${label}打卡`, el('button', { class: 'widget small' + (c[kind] ? ' done' : ''), onclick: () => askCheckin(kind) },
      el('span', { class: 'w-ic' }, icon(ic, 20, 2)),
      el('div', {}, el('div', { class: 'w-big' }, c[kind] ? `${label}已打卡` : `今天还没${label}`), el('div', { class: 'w-sub' }, c[kind] ? hm(c[kind]) : '轻点打卡'))));
    node = el('div', { class: 'wpair' }, small('study', 'book', '学习'), small('gym', 'dumbbell', '健身'));
  }
  if (!node) return '';
  node.dataset.item = 'widget:' + w;
  if (editing) node.append(delBadge('widget:' + w, '小组件'));
  return node;
}

function renderHome() {
  paintWall($('#homewall'), 'home');
  syncStatusIcons();
  const L = homeLayout();
  const pages = $('#homepages'); const sx = pages.scrollLeft; pages.textContent = '';
  const c = todayChecks();
  for (const items of L.pages) {
    const pg = el('div', { class: 'home-page' });
    for (const it of items) {
      if (it.startsWith('folder:')) pg.append(folderButton(it.slice(7)));
      else if (it.startsWith('widget:')) pg.append(widgetEl(it.slice(7), c));
      else if (APPS[it]) pg.append(appButton(it));
    }
    pages.append(pg);
  }
  pages.scrollLeft = sx;
  const dots = $('#homedots'); dots.textContent = '';
  if (L.pages.length > 1) L.pages.forEach((_, i) => dots.append(el('button', { 'aria-label': `第 ${i + 1} 页`, onclick: () => pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' }) })));
  syncDots();
  const d = $('#dock'); d.textContent = '';
  for (const it of L.dock) d.append(it.startsWith('folder:') ? folderButton(it.slice(7)) : appButton(it));
  const pop = $('#folderpop'); if (pop.classList.contains('on')) openFolder(pop.dataset.key);
  $('#home').classList.toggle('editing', editing);
  updateBadges();
}
const curPage = () => { const p = $('#homepages'); return Math.round(p.scrollLeft / (p.clientWidth || 1)); };

/* ---------- 编辑主屏幕 ---------- */
function enterEdit() {
  if (editing || cur !== 'home') return;
  editing = true; try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
  renderHome();
}
function exitEdit() {
  if (!editing) return false;
  editing = false; normalizeLayout(); saveS(); renderHome(); return true;
}
function askDelete(it, label) {
  const w = it.startsWith('widget:');
  confirmSheet(w ? '移除这个小组件？' : `删除「${label}」？`, w ? '可以点左上角的「＋」再加回来。' : '删除后可以在 App Store 里重新下载。', w ? '移除' : '删除 App', true).then(ok => {
    if (!ok) return;
    removeItem(it); saveS(); renderHome();
  });
}
const WIDGETS = { her: ['她的消息', '最近一条消息'], countdown: ['倒数日', '离某一天还有几天'], checkin: ['打卡', '学习、健身打卡'] };
function addWidgetSheet() {
  const L = homeLayout(), have = new Set(L.pages.flat());
  openSheet((p, close) => {
    p.append(sheetHead('添加小组件', el('button', { onclick: close }, '取消')));
    const rows = Object.entries(WIDGETS).map(([k, [t, sub]]) => {
      const on = have.has('widget:' + k);
      return el('button', { class: 'ios-row', disabled: on, onclick: () => {
        const i = curPage(); L.pages[i] = L.pages[i] || []; L.pages[i].unshift('widget:' + k);
        normalizeLayout(); saveS(); close(); renderHome();
      } }, el('span', { class: 'lbl' }, k === 'her' ? `${TA()}的消息` : t, el('small', {}, sub)), el('span', { class: 'val' }, on ? '已在桌面上' : '添加'));
    });
    p.append(iosGroup('', rows, '加到当前这一页的最前面。'));
  });
}
$('#homeadd').addEventListener('click', e => { e.stopPropagation(); addWidgetSheet(); });
$('#homedone').addEventListener('click', e => { e.stopPropagation(); exitEdit(); });

/* 长按进入编辑；编辑时点空白处结束；点图标不打开 App */
let lpT = null, lpXY = null, suppressClick = false;
const H = $('#home');
H.addEventListener('pointerdown', e => {
  if (editing || e.button > 0 || e.target.closest('.folder-pop,.home-editbar,.home-tools')) return;
  lpXY = [e.clientX, e.clientY];
  clearTimeout(lpT); lpT = setTimeout(() => { lpT = null; suppressClick = true; enterEdit(); }, 550);
});
H.addEventListener('pointermove', e => { if (lpT && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 8) { clearTimeout(lpT); lpT = null; } });
['pointerup', 'pointercancel'].forEach(t => H.addEventListener(t, () => { clearTimeout(lpT); lpT = null; }));
H.addEventListener('contextmenu', e => { e.preventDefault(); if (!editing) { suppressClick = true; enterEdit(); setTimeout(() => { suppressClick = false; }, 300); } });
H.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); return; }
  if (!editing) return;
  if (e.target.closest('.del-badge,.home-editbar')) return;
  if (e.target.closest('#folderpop') && !e.target.closest('.app-ic')) return;   // 点文件夹外面：关文件夹
  if (e.target.closest('[data-folder]')) return;                               // 编辑时也能打开文件夹
  e.stopPropagation(); e.preventDefault();
  if (!e.target.closest('[data-item]')) exitEdit();
}, true);

/* ---------- 拖动换位置（编辑时）：直接挪 DOM 节点，松手再整理、保存 ---------- */
let drag = null;
function where(it) {
  const L = homeLayout();
  const di = L.dock.indexOf(it); if (di >= 0) return { arr: L.dock, i: di };
  for (const p of L.pages) { const i = p.indexOf(it); if (i >= 0) return { arr: p, i }; }
  return null;
}
H.addEventListener('pointerdown', e => {
  if (!editing || e.button > 0 || e.target.closest('.del-badge')) return;
  const node = e.target.closest('.home-page>[data-item],#dock>[data-item]'); if (!node) return;
  drag = { it: node.dataset.item, node, x0: e.clientX, y0: e.clientY, on: false };
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 7) return;
    drag.on = true;
    const r = drag.node.getBoundingClientRect(), k = zoomK(), pr = $('#phone').getBoundingClientRect();
    drag.dx = (e.clientX - r.left) / k; drag.dy = (e.clientY - r.top) / k;
    drag.ghost = drag.node.cloneNode(true); drag.ghost.classList.add('drag-ghost');
    drag.ghost.style.width = r.width / k + 'px'; drag.ghost.style.height = r.height / k + 'px';
    $('#phone').append(drag.ghost); drag.node.classList.add('drag-src'); drag.pr = pr;
  }
  e.preventDefault();
  const k = zoomK(), pr = $('#phone').getBoundingClientRect();
  drag.ghost.style.transform = `translate(${(e.clientX - pr.left) / k - drag.dx}px,${(e.clientY - pr.top) / k - drag.dy}px)`;
  hover(e.clientX, e.clientY);
}, { passive: false });
function hover(x, y) {
  const L = homeLayout(), pages = $('#homepages'), pr = pages.getBoundingClientRect();
  // 拖到左右边缘停一会儿：翻页（最后一页往右会新开一页）
  const edge = x < pr.left + 22 ? -1 : x > pr.right - 22 ? 1 : 0;
  if (edge !== (drag.edge || 0)) { drag.edge = edge; clearTimeout(drag.flipT); if (edge) drag.flipT = setTimeout(() => flip(edge), 600); }
  const t = document.elementFromPoint(x, y); if (!t) return;
  const dock = t.closest('#dock'), page = t.closest('.home-page');
  const isWidget = drag.it.startsWith('widget:');
  const from = where(drag.it); if (!from) return;
  let toArr, toIdx, parent;
  const pick = (arr, sel) => {
    const over = t.closest(sel);
    if (over === drag.node) return false;
    if (!over) { toIdx = arr.length; return true; }
    const r = over.getBoundingClientRect();
    toIdx = arr.indexOf(over.dataset.item) + (x > r.left + r.width / 2 ? 1 : 0);
    return true;
  };
  if (dock) {
    if (isWidget || (L.dock.length >= 4 && from.arr !== L.dock)) return;
    toArr = L.dock; parent = dock;
    if (!pick(toArr, '#dock>[data-item]')) return;
  } else if (page) {
    const pi = [...pages.children].indexOf(page); toArr = L.pages[pi]; parent = page;
    if (!toArr || !pick(toArr, '.home-page>[data-item]')) return;
    if (toArr !== from.arr && toArr.reduce((n, it) => n + cellsOf(it), 0) + cellsOf(drag.it) > PAGE_CELLS) return;   // 那一页满了
  } else return;
  if (toArr === from.arr && (toIdx === from.i || toIdx === from.i + 1)) return;
  from.arr.splice(from.i, 1);
  if (toArr === from.arr && toIdx > from.i) toIdx--;
  toArr.splice(toIdx, 0, drag.it);
  const kids = [...parent.children].filter(n => n !== drag.node);   // DOM 和数组顺序保持一致
  parent.insertBefore(drag.node, kids[toIdx] || null);
}
function flip(dir) {
  if (!drag) return;
  const L = homeLayout(), pages = $('#homepages'), i = curPage() + dir;
  if (i < 0) return;
  if (i >= L.pages.length) {
    if (L.pages[L.pages.length - 1].length <= 1) return;
    L.pages.push([]); pages.append(el('div', { class: 'home-page' }));
  }
  pages.scrollTo({ left: i * pages.clientWidth, behavior: 'smooth' });
  drag.edge = 0;
}
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const d = drag; drag = null; clearTimeout(d.flipT);
  if (!d.on) return;
  d.ghost.remove(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 50);
  normalizeLayout(); saveS(); renderHome();
});

/* ---------- App Store ---------- */
let storeQ = '', installing = {};
function installApp(id) {
  if (installedApps().has(id) || installing[id]) return;
  installing[id] = true; Nav.refresh('appstore');
  setTimeout(() => {
    delete installing[id];
    const p = placeNew(id); saveS(); renderHome();
    toast(`「${appDef(id).label}」已添加到主屏幕第 ${p + 1} 页`);
    Nav.refresh('appstore');
  }, 1400);
}
function appStoreRoot(pg, app) {
  const body = el('div', { class: 'ios-body store' });
  const input = el('input', { type: 'search', placeholder: '游戏、App 等', 'aria-label': '搜索 App', value: storeQ });
  input.addEventListener('input', () => { storeQ = input.value.trim(); list(); });
  const box = el('div');
  const tabs = el('nav', { class: 'store-tabs' },
    el('button', { onclick: () => toast('这里只有「App」页') }, icon('note', 24, 1.9), el('span', {}, 'Today')),
    el('button', { 'aria-current': 'true' }, icon('apps', 24, 1.9), el('span', {}, 'App')),
    el('button', { onclick: () => input.focus() }, icon('search', 24, 1.9), el('span', {}, '搜索')));
  pg.append(iosNav(app, { flat: true }), body, tabs);
  body.append(el('h1', { class: 'ios-large' }, 'App'), el('label', { class: 'ios-searchbox store-search' }, icon('search', 17, 2), input), box);
  pg.refresh = list; list();
  function row(id) {
    const d = appDef(id), has = installedApps().has(id);
    const btn = installing[id] ? el('span', { class: 'get busy', 'aria-label': '正在下载' }, el('i'))
      : el('button', { class: 'get', onclick: () => has ? openApp(id) : installApp(id) }, has ? '打开' : '获取');
    return el('div', { class: 'store-row' }, appIcon(id, 60), el('div', { class: 'grow' }, el('b', {}, d.label), el('small', {}, STORE[id])), btn);
  }
  function list() {
    box.textContent = '';
    const ids = Object.keys(STORE).filter(id => APPS[id] && (!storeQ || appDef(id).label.toLowerCase().includes(storeQ.toLowerCase()) || STORE[id].includes(storeQ)));
    const third = ids.filter(id => !STORE[id].startsWith('Apple')), apple = ids.filter(id => STORE[id].startsWith('Apple'));
    if (!ids.length) { box.append(el('p', { class: 'empty' }, `没有找到「${storeQ}」`)); return; }
    if (third.length) box.append(el('h2', { class: 'store-h' }, storeQ ? '搜索结果' : '热门 App'), el('div', { class: 'store-list' }, ...third.map(row)));
    if (apple.length) box.append(el('h2', { class: 'store-h' }, 'Apple 自带'), el('div', { class: 'store-list' }, ...apple.map(row)));
    box.append(el('p', { class: 'ios-foot' }, '这里下载的是壳子：在 iPhone 上点它会打开手机里真正的那个 App（要先装了才能打开）。在桌面上长按可以删除，删掉的随时能在这里再下载。'));
  }
}
