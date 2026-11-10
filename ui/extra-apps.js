/*
 * 其余几个常用 App：日历（看每天的打卡）、相机（拍照发给她）、备忘录、计算器。
 */
'use strict';

/* ================= 日历 ================= */
let calView = null, calSel = null;
const TASK_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00'];
const taskColor = id => { const i = S.tasks.findIndex(t => t.id === id); return i < 0 ? '#8E8E93' : TASK_COLORS[i % TASK_COLORS.length]; };
function calendarRoot(pg, app) {
  pg.classList.add('cal');
  const body = el('div', { class: 'ios-body' });
  const title = el('h2', {});
  pg.append(el('header', { class: 'ios-nav flat' },
    el('button', { class: 'ios-back', onclick: () => shift(-1), 'aria-label': '上个月' }, icon('back', 26, 2.4), '上月'), title,
    el('button', { class: 'ios-act', onclick: () => shift(1), 'aria-label': '下个月' }, '下月', icon('chevron', 22, 2.4))), body);
  function shift(n) { calView.setMonth(calView.getMonth() + n); render(); }
  pg.refresh = render; render();
  function render() {
    const now = new Date();
    if (!calView) { calView = new Date(now.getFullYear(), now.getMonth(), 1); }
    if (!calSel) calSel = dkey(now);
    const y = calView.getFullYear(), mo = calView.getMonth();
    title.textContent = `${y}年`;
    body.textContent = '';
    body.append(el('h1', { class: 'ios-large cal-month' }, `${mo + 1}月`));
    const head = el('div', { class: 'cal-week' }); for (const w of WD) head.append(el('span', {}, w));
    const grid = el('div', { class: 'cal-grid' });
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el('span'));
    const msgDays = new Set(M.filter(m => m.from === 'her').map(m => dkey(m.ts)));
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${pad(mo + 1)}-${pad(d)}`, ck = ST.checkins[k] || {};
      const isToday = k === dkey(now), isSel = k === calSel;
      grid.append(el('button', { class: 'cal-day' + (isToday ? ' today' : '') + (isSel ? ' sel' : ''), onclick: () => { calSel = k; render(); } },
        el('b', {}, String(d)),
        el('span', { class: 'cal-dots' }, ...Object.keys(ck).slice(0, 3).map(id => el('i', { style: `background:${taskColor(id)}` })), msgDays.has(k) ? el('i', { class: 'ms' }) : '')));
    }
    body.append(head, grid);
    const ck = ST.checkins[calSel] || {};
    const herCount = M.filter(m => m.from === 'her' && dkey(m.ts) === calSel).length;
    const [sy, sm, sd] = calSel.split('-').map(Number);
    const ids = [...new Set([...S.tasks.map(t => t.id), ...Object.keys(ck)])];
    body.append(iosGroup(`${sm}月${sd}日 星期${WD[new Date(sy, sm - 1, sd).getDay()]}`, [
      ...ids.map(id => el('div', { class: 'ios-row' }, el('span', { class: 'cal-legend', style: `background:${taskColor(id)}` }), el('span', { class: 'lbl' }, `${taskName(id)}打卡`), el('span', { class: 'val' }, ck[id] ? hm(ck[id]) : '没有'))),
      el('div', { class: 'ios-row' }, el('span', { class: 'cal-legend ms' }), el('span', { class: 'lbl' }, `${herName()}发来的消息`), el('span', { class: 'val' }, herCount ? `${herCount} 条` : '没有'))]));
  }
}

/* ================= 相机 ================= */
let CAM = null, camStream = null, camFacing = 'user';
function cameraRoot(pg) {
  pg.classList.add('cam', 'ink-light');
  const video = el('video', { class: 'cam-video', autoplay: true, playsinline: true, muted: true });
  video.muted = true; video.setAttribute('playsinline', '');
  const msg = el('div', { class: 'cam-msg', hidden: true });
  const thumb = el('button', { class: 'cam-side thumb', 'aria-label': '从相册选一张', onclick: pickFromFiles }, icon('photo', 24, 1.8));
  const zoom = el('div', { class: 'cam-zoom' }, ...['.5', '1×', '2'].map(z => el('button', { 'aria-pressed': String(z === '1×'), onclick: e => { $$('button', zoom).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, z)));
  pg.append(el('div', { class: 'cam-top' }, el('button', { class: 'cam-tb', 'aria-label': '闪光灯' }, icon('bolt', 18, 1.8)), el('span', { class: 'cam-tb' }, icon('chevronUp', 18, 2.2)), el('button', { class: 'cam-tb', 'aria-label': '实况照片' }, icon('live', 20, 1.8))),
    el('div', { class: 'cam-view' }, video, msg, el('div', { class: 'cam-flash' }), zoom),
    el('div', { class: 'cam-mode' }, el('span', {}, '延时摄影'), el('span', {}, '慢动作'), el('span', {}, '视频'), el('b', {}, '照片'), el('span', {}, '人像'), el('span', {}, '全景')),
    el('div', { class: 'cam-bar' }, thumb,
      el('button', { class: 'cam-shutter', 'aria-label': '拍照', onclick: capture }),
      el('button', { class: 'cam-side', 'aria-label': '切换前后摄像头', onclick: () => { camFacing = camFacing === 'user' ? 'environment' : 'user'; startCamera(); } }, icon('flip', 26, 1.8))));
  CAM = { pg, video, msg };
}
function camMsg(t) { if (!CAM) return; CAM.msg.textContent = t; CAM.msg.hidden = false; }
async function startCamera() {
  if (!CAM) return;
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camMsg(`这个浏览器用不了相机。点左下角，从相册里选一张发给${TA()}。`); return; }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing }, audio: false });
    if (cur !== 'camera') { s.getTracks().forEach(t => t.stop()); return; }
    camStream = s; CAM.video.srcObject = s; CAM.video.classList.toggle('mirror', camFacing === 'user'); CAM.msg.hidden = true;
  } catch (e) { camMsg('没有拿到相机权限。可以在浏览器地址栏里允许使用相机，或者点左下角从相册选一张。'); }
}
function stopCamera() {
  if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
  if (CAM) CAM.video.srcObject = null;
}
async function capture() {
  if (!camStream || !CAM.video.videoWidth) return pickFromFiles();
  const v = CAM.video, c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d');
  if (camFacing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(v, 0, 0);
  const f = $('.cam-flash', CAM.pg); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  reviewPhoto(await compress(c.toDataURL('image/jpeg', .92), 1280, .86));
}
async function pickFromFiles() {
  const [f] = await pickFile('image/*'); if (!f) return;
  try { reviewPhoto(await compress(await fileToDataURL(f), 1280, .86)); } catch (e) { toast(e.message); }
}
function reviewPhoto(data) {
  openSheet((p, close) => p.append(
    sheetHead(`发给${herName()}？`, el('button', { onclick: close }, '重拍'), el('button', { onclick: () => { close(); sendMyPhoto(data); } }, '发送')),
    el('img', { class: 'cam-review', src: data, alt: '刚拍的照片' })));
}
async function sendMyPhoto(data) {
  const id = uid('me');
  await IDB.put(id, data); imgCache.set(id, data);
  if (!ST.started) { ST.started = true; ST.lastTick = Date.now(); saveST(); }
  openApp('wx'); openThread(true);
  sendMine('', 'image', { imageId: id, desc: '我拍的照片' });
}

/* ================= 备忘录 ================= */
function notesRoot(pg, app) {
  pg.classList.add('notes-app');
  const body = el('div', { class: 'ios-body' });
  const count = el('span', {});
  pg.append(iosNav(app, { flat: true }), body,
    el('footer', { class: 'ios-toolbar' }, el('span'), count, el('button', { class: 'ios-act', 'aria-label': '新建备忘录', onclick: () => openNote(null) }, icon('compose', 25, 1.8))));
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('h1', { class: 'ios-large' }, appDef('notes').label), el('div', { class: 'ios-searchbox' }, icon('search', 17, 2), '搜索'));
    const list = [...NOTES].sort((a, b) => b.ts - a.ts);
    count.textContent = list.length ? `${list.length} 个备忘录` : '';
    if (!list.length) { body.append(el('p', { class: 'empty' }, '没有备忘录。点右下角写一条。')); return; }
    body.append(iosGroup('', list.map(n => {
      const [t, ...rest] = (n.text || '').split('\n');
      return el('button', { class: 'note-row', onclick: () => openNote(n) },
        el('b', {}, t.trim() || '新备忘录'),
        el('small', {}, el('span', {}, listTime(n.ts)), ' ', rest.join(' ').trim() || '没有其他文本'));
    })));
  }
  function openNote(n) { Nav.push(app, p => notePage(p, app, n)); }
}
function notePage(pg, app, note) {
  pg.classList.add('notes-app');
  const n = note || { id: uid('n'), text: '', ts: Date.now() };
  const ta = el('textarea', { class: 'note-text', placeholder: '写点什么', 'aria-label': '备忘录内容' });
  ta.value = n.text;
  const save = () => {
    const t = ta.value;
    const i = NOTES.findIndex(x => x.id === n.id);
    if (!t.trim()) { if (i >= 0) NOTES.splice(i, 1); }
    else { n.text = t; n.ts = Date.now(); if (i < 0) NOTES.push(n); }
    saveNotes();
  };
  ta.addEventListener('input', save);
  pg.append(iosNav(app, { back: APPS.notes.label, right: el('button', { class: 'ios-act bold', onclick: () => ta.blur() }, '完成') }),
    el('div', { class: 'note-date' }, fmtFull(n.ts)), ta,
    el('footer', { class: 'ios-toolbar' }, el('button', { class: 'ios-act', 'aria-label': '删除', onclick: async () => {
      if (!(await confirmSheet('删除这条备忘录？', '', '删除', true))) return;
      ta.value = ''; save(); Nav.pop(app);
    } }, icon('trash', 23, 1.8)), el('span'), el('span')));
  if (!note) setTimeout(() => ta.focus(), 400);
}

/* ================= 计算器 ================= */
function calcRoot(pg) {
  pg.classList.add('calc', 'ink-light');
  const disp = el('div', { class: 'calc-disp' }, '0');
  const st = { acc: null, op: null, cur: '0', fresh: true };
  const fmt = v => {
    if (!isFinite(v)) return '错误';
    let s = String(+v.toPrecision(10));
    if (s.length > 10) s = v.toExponential(4);
    return s;
  };
  const show = () => {
    let s = st.cur;
    if (!s.includes('e') && !s.includes('错')) { const [i, f] = s.split('.'); s = Number(i).toLocaleString('en-US') + (f != null ? '.' + f : ''); if (i === '-0') s = '-0' + (f != null ? '.' + f : ''); }
    disp.textContent = s;
    disp.style.fontSize = s.length > 9 ? '56px' : s.length > 7 ? '68px' : '84px';
    $$('.calc-key.op', pg).forEach(b => b.classList.toggle('on', st.fresh && st.op === b.dataset.k));
    ac.textContent = st.cur !== '0' && !st.fresh ? '⌫' : 'AC';
  };
  const calc = (a, op, b) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' ? a / b : b;
  function press(k) {
    if (/^\d$/.test(k)) { st.cur = st.fresh || st.cur === '0' ? k : (st.cur.replace(/[^\d]/g, '').length < 9 ? st.cur + k : st.cur); st.fresh = false; }
    else if (k === '.') { if (st.fresh) { st.cur = '0.'; st.fresh = false; } else if (!st.cur.includes('.')) st.cur += '.'; }
    else if (k === 'AC') {
      if (ac.textContent === '⌫') { st.cur = st.cur.length > 1 ? st.cur.slice(0, -1) : '0'; if (st.cur === '-') st.cur = '0'; }
      else { st.acc = null; st.op = null; st.cur = '0'; st.fresh = true; }
    }
    else if (k === '±') { st.cur = st.cur.startsWith('-') ? st.cur.slice(1) : '-' + st.cur; }
    else if (k === '%') { st.cur = fmt(parseFloat(st.cur) / 100); }
    else if (['+', '−', '×', '÷'].includes(k)) {
      if (st.op && !st.fresh) { st.acc = calc(st.acc, st.op, parseFloat(st.cur)); st.cur = fmt(st.acc); }
      else if (st.acc == null || !st.op) st.acc = parseFloat(st.cur);
      st.op = k; st.fresh = true;
    }
    else if (k === '=') {
      if (st.op) { const r = calc(st.acc, st.op, parseFloat(st.cur)); st.cur = fmt(r); st.acc = null; st.op = null; st.fresh = true; }
    }
    show();
  }
  const keys = [['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7'], ['8'], ['9'], ['×', 'op'], ['4'], ['5'], ['6'], ['−', 'op'], ['1'], ['2'], ['3'], ['+', 'op'], ['mode', 'num mode'], ['0'], ['.'], ['=', 'op eq']];
  const pad_ = el('div', { class: 'calc-pad' });
  let ac;
  for (const [k, c] of keys) {
    const b = k === 'mode' ? el('button', { class: 'calc-key ' + c, 'aria-label': '计算器类型', onclick: () => toast('这里只有基础计算器') }, icon('calc', 30, 1.6))
      : el('button', { class: 'calc-key ' + (c || 'num'), 'data-k': k, onclick: () => press(k) }, k);
    if (k === 'AC') ac = b;
    pad_.append(b);
  }
  pg.append(el('div', { class: 'calc-top' }, disp), pad_);
  pg.onkey = e => {
    const map = { '/': '÷', '*': '×', '-': '−', '+': '+', 'Enter': '=', '=': '=', 'Backspace': 'AC', '%': '%', '.': '.' };
    const k = /^\d$/.test(e.key) ? e.key : map[e.key];
    if (k) { e.preventDefault(); press(k); }
  };
  show();
}
document.addEventListener('keydown', e => {
  if (cur === 'calc' && Nav.top('calc') && Nav.top('calc').onkey && !e.metaKey && !e.ctrlKey && e.key !== 'Escape') Nav.top('calc').onkey(e);
});
