/*
 * 时钟：世界时钟、闹钟、秒表、计时器。
 * 闹钟分两种：只响铃的（你自己加的）和要 TA 提醒的（打开「让 TA 提醒我」，或者督促清单里设了提醒时间的）。
 * 晚上 8 点那个是预设的，只能关，不能删、不能改。
 * 只响铃的闹钟由这里的 alarmTick() 检查；要 TA 提醒的走 js/core/schedule.js，和她的作息一起。
 */
'use strict';

const CITIES = [['上海', 'Asia/Shanghai'], ['首尔', 'Asia/Seoul'],['纽约', 'America/New_York'],['东京', 'Asia/Tokyo'], ['伦敦', 'Europe/London'], ['悉尼', 'Australia/Sydney']];
let clockTab = 'alarm', alarmEditing = false, SW = { t0: 0, acc: 0, laps: [], run: false }, TM = { end: 0, left: 0, run: false, total: 0 };
const alarmDays = ds => ds.length ? daysText(ds) : '只响一次';

function clockRoot(pg, app) {
  pg.classList.add('clock-app');
  const body = el('div', { class: 'ios-body' });
  const tabs = el('nav', { class: 'clock-tabs' });
  const T_ = [['world', '世界时钟', 'globe'], ['alarm', '闹钟', 'alarm'], ['stopwatch', '秒表', 'stopwatch'], ['timer', '计时器', 'timer']];
  for (const [k, label, ic] of T_) tabs.append(el('button', { 'aria-current': String(k === clockTab), onclick: () => { clockTab = k; alarmEditing = false; render(); } }, icon(ic, 24, 1.9), el('span', {}, label)));
  let nav = iosNav(app, { flat: true });
  pg.append(nav, body, tabs);
  let iv;
  pg.refresh = render; pg.onclose = () => clearInterval(iv);
  render();
  function render() {
    clearInterval(iv);
    $$('button', tabs).forEach((b, i) => b.setAttribute('aria-current', String(T_[i][0] === clockTab)));
    // 闹钟页：左上「编辑」，右上「＋」
    const n2 = clockTab === 'alarm'
      ? el('header', { class: 'ios-nav flat' },
          el('button', { class: 'ios-back', style: 'padding-left:8px', onclick: () => { alarmEditing = !alarmEditing; render(); } }, alarmEditing ? '完成' : '编辑'),
          el('h2', {}, ''), el('button', { class: 'ios-act', 'aria-label': '添加闹钟', onclick: () => alarmSheet(null, render) }, icon('plus', 26, 2.2)))
      : iosNav(app, { flat: true });
    nav.replaceWith(n2); nav = n2;
    body.textContent = '';
    if (clockTab === 'world') world(); else if (clockTab === 'alarm') alarms(); else if (clockTab === 'stopwatch') stopwatch(); else timer();
  }
  function world() {
    body.append(el('h1', { class: 'ios-large' }, '世界时钟'));
    const list = el('div', { class: 'clock-list' }); body.append(list);
    const draw = () => {
      list.textContent = '';
      const here = new Date();
      for (const [name, tz] of CITIES) {
        const f = new Intl.DateTimeFormat('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false, year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = Object.fromEntries(f.formatToParts(here).map(p => [p.type, p.value]));
        const there = new Date(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${parts.hour}:${parts.minute}:00`);
        const diff = Math.round((there - new Date(dkey(here) + 'T' + hm(here) + ':00')) / 36e5);
        const day = dkey(there) === dkey(here) ? '今天' : there > here ? '明天' : '昨天';
        list.append(el('div', { class: 'clock-row' }, el('div', {}, el('small', {}, `${day}，${diff >= 0 ? '+' : ''}${diff}小时`), el('b', {}, name)), el('time', {}, `${parts.hour}:${parts.minute}`)));
      }
    };
    draw(); iv = setInterval(draw, 15000);
  }
  function alarms() {
    body.append(el('h1', { class: 'ios-large' }, '闹钟'));
    const row = (a) => {
      const sw = el('input', { type: 'checkbox', class: 'sw', 'aria-label': (a.label || '闹钟') + ' ' + a.time }); sw.checked = a.on;
      sw.addEventListener('click', e => e.stopPropagation());
      sw.addEventListener('change', () => { a.on = sw.checked; saveS(); render(); });
      const lead = alarmEditing ? (a.locked ? el('span', { class: 'al-lock', 'aria-label': '预设闹钟，不能删' }, icon('lock', 16, 2))
        : el('button', { class: 'al-del', 'aria-label': '删除', onclick: async e => { e.stopPropagation(); if (await confirmSheet('删除这个闹钟？', a.label || '', '删除', true)) { S.alarms = S.alarms.filter(x => x !== a); saveS(); render(); } } }, icon('minus', 14, 3))) : '';
      return el('div', { class: 'alarm' + (a.on ? '' : ' off'), role: 'button', tabindex: '0', onclick: () => a.locked ? toast('这个闹钟只能关闭，不能修改') : alarmSheet(a, render) }, lead,
        el('div', { class: 'al-main' }, el('time', {}, a.time), el('div', { class: 'lbl' }, a.label || '闹钟', el('small', {}, '，' + (a.date && !a.days.length ? whenText(a.date, a.time).split(' ')[0] : alarmDays(a.days)) + (a.byHer ? `，聊天里让${TA()}提醒的` : a.ta ? `，${TA()}提醒` : '')),
          a.locked ? el('span', { class: 'al-pin' }, icon('lock', 12, 2.2)) : '')), alarmEditing ? el('span', { class: 'chev' }, icon('chevron', 18, 2.2)) : sw);
    };
    const mine = [...S.alarms].sort((a, b) => ((a.date || '') + a.time).localeCompare((b.date || '') + b.time));
    body.append(iosGroup('', mine.map(row), `到点只响铃。想让${herName()}来提醒，编辑闹钟时打开「让${TA()}提醒我」。`));
    // 督促清单里设了提醒时间的：到点 TA 在聊天里提醒
    const tasks = S.tasks.filter(t => t.remind).sort((a, b) => a.remind.localeCompare(b.remind));
    if (tasks.length) body.append(iosGroup(`督促清单 · ${herName()}会提醒你`, tasks.map(t => {
      const sw = el('input', { type: 'checkbox', class: 'sw', 'aria-label': t.name }); sw.checked = t.remindOn !== false;
      sw.addEventListener('click', e => e.stopPropagation());
      sw.addEventListener('change', () => { t.remindOn = sw.checked; saveS(); render(); });
      return el('div', { class: 'alarm' + (t.remindOn !== false ? '' : ' off'), role: 'button', tabindex: '0', onclick: () => Nav.push(app, p => taskEditPage(p, app, t)) },
        el('div', { class: 'al-main' }, el('time', {}, t.remind), el('div', { class: 'lbl' }, `${t.emoji ? t.emoji + ' ' : ''}${t.name}`, el('small', {}, '，' + daysText(t.days)))), sw);
    }), '这几条在「设置 → 督促清单」里改，点一下也能直接改。'));
  }
  function stopwatch() {
    const fmtSW = ms => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;
    const cur = () => SW.acc + (SW.run ? Date.now() - SW.t0 : 0);
    const disp = el('div', { class: 'sw-disp' }, fmtSW(cur()));
    const left = el('button', { class: 'round gray', onclick: () => { if (SW.run) { SW.laps.unshift(cur()); render(); } else { SW.acc = 0; SW.laps = []; render(); } } }, SW.run ? '计次' : '复位');
    const right = el('button', { class: 'round ' + (SW.run ? 'red' : 'green'), onclick: () => { if (SW.run) { SW.acc = cur(); SW.run = false; } else { SW.t0 = Date.now(); SW.run = true; } render(); } }, SW.run ? '停止' : '启动');
    body.append(disp, el('div', { class: 'round-row' }, left, right),
      el('div', { class: 'clock-list laps' }, ...SW.laps.map((t, i) => el('div', { class: 'clock-row slim' }, el('span', {}, `计次 ${SW.laps.length - i}`), el('span', {}, fmtSW(i < SW.laps.length - 1 ? t - SW.laps[i + 1] : t))))));
    if (SW.run) iv = setInterval(() => { disp.textContent = fmtSW(cur()); }, 33);
  }
  function timer() {
    const left = () => TM.run ? Math.max(0, TM.end - Date.now()) : TM.left;
    const f = ms => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
    if (!TM.total) {
      body.append(el('h1', { class: 'ios-large' }, '计时器'), el('div', { class: 'timer-picks' }, ...[1, 5, 10, 25, 45, 60].map(m =>
        el('button', { onclick: () => { TM.total = TM.left = m * 60000; TM.end = Date.now() + TM.left; TM.run = true; render(); } }, el('b', {}, m), '分钟'))),
        el('p', { class: 'ios-foot' }, '选一个时长就开始。比如学习前开个 25 分钟。'));
      return;
    }
    const disp = el('div', { class: 'sw-disp timer' }, f(left()));
    body.append(disp, el('div', { class: 'round-row' },
      el('button', { class: 'round gray', onclick: () => { TM = { end: 0, left: 0, run: false, total: 0 }; render(); } }, '取消'),
      el('button', { class: 'round ' + (TM.run ? 'orange' : 'green'), onclick: () => { if (TM.run) { TM.left = left(); TM.run = false; } else { TM.end = Date.now() + TM.left; TM.run = true; } render(); } }, TM.run ? '暂停' : '继续')));
    if (TM.run) iv = setInterval(() => {
      const l = left(); disp.textContent = f(l);
      if (l <= 0) { clearInterval(iv); TM = { end: 0, left: 0, run: false, total: 0 }; toast('计时结束'); try { navigator.vibrate && navigator.vibrate(300); } catch (e) {} render(); }
    }, 250);
  }
}

/* ---------- 添加 / 编辑闹钟 ---------- */
function alarmSheet(a, after) {
  const isNew = !a;
  const x = a ? clone(a) : { id: uid('al'), time: hm(Date.now() + 3600e3).slice(0, 2) + ':00', days: [], label: '', on: true, ta: false, snooze: true };
  openSheet((p, close) => {
    const time = el('input', { type: 'time', class: 'al-time', value: x.time, 'aria-label': '时间' });
    const label = el('input', { value: x.label, placeholder: '闹钟', 'aria-label': '标签' });
    const ta = el('input', { type: 'checkbox', class: 'sw', 'aria-label': `让${TA()}提醒我` }); ta.checked = !!x.ta;
    const snooze = el('input', { type: 'checkbox', class: 'sw', 'aria-label': '稍后提醒' }); snooze.checked = x.snooze !== false;
    const save = () => {
      x.time = time.value || x.time; x.label = label.value.trim(); x.ta = ta.checked; x.snooze = snooze.checked; x.on = true;
      if (x.ta && !x.days.length) {   // 只响一次、由她提醒：记下是哪一天（锁屏通知的服务器只发那一天的）
        const [h, m] = x.time.split(':').map(Number), t = new Date(); t.setHours(h, m, 0, 0);
        if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
        x.date = dkey(t);
      } else delete x.date;
      const i = S.alarms.findIndex(y => y.id === x.id);
      if (i >= 0) S.alarms[i] = x; else S.alarms.push(x);
      saveS(); close(); after && after();
      toast(x.ta ? `到点${herName()}会来提醒你` : `闹钟已设为 ${x.time}`);
    };
    p.append(sheetHead(isNew ? '添加闹钟' : '编辑闹钟', el('button', { onclick: close }, '取消'), el('button', { class: 'bold', onclick: save }, '存储')),
      el('div', { class: 'al-time-wrap' }, time),
      iosGroup('', [
        el('div', { class: 'ios-field' }, el('span', {}, '重复（都不选 = 只响一次）'), daysPicker(x.days)),
        el('label', { class: 'ios-field' }, el('span', {}, '标签'), label),
        el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, `让${TA()}提醒我`, el('small', {}, `打开后到点不响铃，由${herName()}在聊天里提醒你`)), ta),
        el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, '稍后提醒'), snooze)]));
    if (!isNew) p.append(el('button', { class: 'btn danger wide', style: 'margin-top:14px', onclick: () => { S.alarms = S.alarms.filter(y => y.id !== x.id); saveS(); close(); after && after(); } }, '删除闹钟'));
  });
}

/* ---------- 响铃（只响铃的闹钟；网页开着时才响） ---------- */
let ringing = null;
function alarmTick() {
  const now = Date.now(), from = Math.max(ST.alarmTick || now - 60e3, now - 3 * 60e3);
  ST.alarmTick = now; ST.alarmFired = ST.alarmFired || {}; ST.snoozes = ST.snoozes || {};
  for (const a of S.alarms) {
    if (!a.on || a.ta) continue;
    const [h, m] = a.time.split(':').map(Number), t = new Date(now); t.setHours(h, m, 0, 0);
    const k = a.id + '@' + dkey(now);
    const today = !a.days.length || a.days.includes(t.getDay());
    if (today && t.getTime() > from && t.getTime() <= now && !ST.alarmFired[k]) {
      ST.alarmFired[k] = 1;
      if (!a.days.length) { a.on = false; saveS(); }
      showAlarm(a);
    }
    const sz = ST.snoozes[a.id];
    if (sz && sz <= now) { delete ST.snoozes[a.id]; showAlarm(a); }
  }
  for (const k of Object.keys(ST.alarmFired)) if (k.split('@')[1] < dkey(now - 2 * 864e5)) delete ST.alarmFired[k];
  saveST();
}
function showAlarm(a) {
  if (ringing) return;
  const box = el('div', { class: 'alarm-ring', role: 'alertdialog', 'aria-label': '闹钟' },
    el('div', { class: 'ar-top' }, icon('alarm', 18, 2), '闹钟'),
    el('div', { class: 'ar-time' }, hm(Date.now())),
    el('div', { class: 'ar-label' }, a.label || '闹钟'),
    el('div', { class: 'ar-btns' },
      a.snooze !== false ? el('button', { class: 'ar-snooze', onclick: () => { ST.snoozes[a.id] = Date.now() + 9 * 60e3; saveST(); stop(); toast('9 分钟后再响'); } }, '稍后提醒') : '',
      el('button', { class: 'ar-stop', onclick: () => stop() }, '停止')));
  const stop = () => { stopRing(); box.classList.remove('on'); setTimeout(() => box.remove(), 300); ringing = null; try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} };
  $('#phone').append(box); requestAnimationFrame(() => box.classList.add('on'));
  ringing = box; ring('in');
  try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
  systemNotify('闹钟', a.label || hm(Date.now()));
}
