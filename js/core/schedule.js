/*
 * 定时：她什么时候主动找你（她的作息 + 督促清单的提醒 + 要她来提醒的闹钟），以及时钟里只响铃的闹钟（js/ui/clock.js）。
 * 网页开着时每 20 秒检查一次；网页关着错过的，下次打开时补最近 3 条（12 小时内）。
 * 开了锁屏通知（js/core/push.js）：网页关着时由服务器按时发，打开时先把那些取回来，再补剩下的。
 * 她连着主动找你 2 回你都没回，当天就不再追发；第二天早上重新算。
 * 你自己定的提醒（督促清单、要她提醒的闹钟、聊天里让她提醒的）照常发，也不算在这 2 回里。
 */
'use strict';

let Q = Promise.resolve();
/* 所有「她说话」排队进行，避免两段回复交错 */
function enqueue(fn) { Q = Q.then(fn).catch(e => console.error(e)); return Q; }

function hash01(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

/* 某一天这条日程实际触发的时刻（同一天算出来总是同一个时间） */
const FRIEND_SOMETIMES = ['e_morning', 'e_night'];   // 挚友不一定每天都道早安、晚安：大约一半的日子
function fireTime(ev, day) {
  if (!ev.on || !ev.days || !ev.days.includes(day.getDay())) return null;
  if (ev.date && dkey(day) !== ev.date) return null;   // 只在某一天响的（聊天里让她提醒的）
  if (S.her.relType === 'friend' && FRIEND_SOMETIMES.includes(ev.id) && hash01(dkey(day) + ev.id + ':friend') < .5) return null;
  const [hh, mm] = String(ev.time || '08:00').split(':').map(Number);
  const off = Math.round((hash01(dkey(day) + ev.id) * 2 - 1) * (+ev.jitter || 0));
  const t = new Date(day); t.setHours(hh, mm + off, 0, 0);
  return t.getTime();
}
const firedKey = (ev, t) => ev.id + '@' + dkey(t);
/* 除了她自己的作息，还有督促清单的提醒、要她来提醒的闹钟，都当成「她来找你」 */
function allEvents() {
  const ta = pron();
  const tasks = S.tasks.filter(t => t.remindOn && t.remind).map(t => ({
    id: 'task:' + t.id, label: t.name, time: t.remind, jitter: 0, days: t.days, on: true, to: 'chat', photo: false, scene: 'task', task: t,
    prompt: PROMPTS.taskEvent({ ta, name: t.name, target: t.target })
  }));
  const alarms = S.alarms.filter(a => a.on && a.ta).map(a => ({
    id: 'alarm:' + a.id, label: a.label, time: a.time, jitter: 0, days: a.days.length ? a.days : EVERY_DAY, date: a.days.length ? '' : a.date || '', on: true, to: 'chat', photo: false, scene: 'alarm', alarm: a,
    prompt: PROMPTS.alarmEvent({ ta, label: a.label || '闹钟' })
  }));
  return [...S.events, ...tasks, ...alarms];
}
function dueBetween(from, to) {
  const out = [];
  const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 1);
  const evs = allEvents();
  while (d.getTime() <= to) {
    for (const ev of evs) {
      const t = fireTime(ev, d);
      if (t && t > from && t <= to && !ST.fired[firedKey(ev, t)]) out.push({ ev, t });
    }
    d.setDate(d.getDate() + 1);
  }
  return out.sort((a, b) => a.t - b.t);
}

/* 她今天连着主动找了你几回你都没回（拍一拍也算回了；昨天的不算）。到 MAX_PRO 回就不再追发 */
const MAX_PRO = 2;
/* 你自己定的提醒：照常发，也不算「她主动找你」 */
const isExempt = ev => !!(ev && (ev.alarm || ev.task));
function proTurns(at = Date.now()) {
  const day0 = new Date(at); day0.setHours(0, 0, 0, 0);
  const seen = new Set();
  for (let i = M.length - 1; i >= 0; i--) {
    const m = M[i];
    if (m.from === 'me' || (m.from === 'tip' && m.who === 'me') || m.ts < day0.getTime()) break;
    if (m.from === 'her' && m.pro) seen.add(m.pro);
  }
  return seen.size;
}

async function runEvent(ev, { at, live, key = '' }) {
  if (ev.to !== 'moments' && !isExempt(ev) && proTurns(at) >= MAX_PRO) return;   // 今天找了你两回你都没回：这次不找了
  const pro = ev.to === 'moments' || isExempt(ev) ? '' : uid('p');
  if (ev.to === 'call' && !FEATURES.voice) ev = Object.assign({}, ev, { to: 'chat' });   // 语音通话待开发：先改成发消息
  if (ev.to === 'call') { // 她打语音电话来
    if (live && !document.hidden && !S.notify.airplane) { startCall('in', ev); return; }
    addMsg({ id: uid('m'), from: 'her', type: 'call', status: 'missed', ts: at, pro });
    for (const t of tplPick('callMissed')) addMsg({ id: uid('m'), from: 'her', type: 'text', text: t, ts: at + 30000, pro });
    return;
  }
  const last = [...M].reverse().find(m => m.from !== 'sys');
  const unreplied = ev.to !== 'moments' && !!last && last.from === 'her' && at - last.ts > 2 * 3600e3;
  const note = unreplied ? PROMPTS.unreplied({ ta: pron(), gap: ago(at - last.ts) }) : '';
  await herTurn({ kind: 'event', ev, at, live, unreplied, note, retry: { kind: 'event', id: ev.id }, pro, evKey: key });
}

function tick() {
  const now0 = Date.now();
  alarmTick();                                    // 闹钟：飞行模式下也照样响
  if (pushHold()) return;                         // 锁屏通知开着、网页在后台：交给服务器发（js/core/push.js）
  diaryTick(now0);                                // 她睡前写日记（js/ai/brain.js）
  checkPending();                                 // 她该回你了没（js/core/rhythm.js）
  if (!ST.started || S.notify.airplane) return;   // 飞行模式下她联系不上你
  const now = Date.now();
  const from = Math.max(ST.lastTick || now, now - 12 * 3600e3);
  ST.lastTick = now;
  const due = dueBetween(from, now);
  due.forEach(x => {
    ST.fired[firedKey(x.ev, x.t)] = 1;
    if (x.ev.alarm && !x.ev.alarm.days.length) { x.ev.alarm.on = false; saveS(); }   // 只响一次的闹钟
  });
  const cutoff = dkey(now - 3 * 864e5);
  for (const k of Object.keys(ST.fired)) if (k.split('@')[1] < cutoff) delete ST.fired[k];
  saveST();
  dropOldReminders(now);
  for (const x of due.slice(-3)) {
    const live = now - x.t < 10 * 60e3; // 10 分钟内的算「刚刚」，正常打字发出；更早的直接补上
    enqueue(() => runEvent(x.ev, { at: live ? Date.now() : x.t, live, key: firedKey(x.ev, x.t) }));
  }
}
/* 聊天里让她定的提醒：过了那天就从时钟里拿掉 */
function dropOldReminders(now = Date.now()) {
  const today = dkey(now), n = S.alarms.length;
  S.alarms = S.alarms.filter(a => !(a.byHer && a.date && a.date < today));
  if (S.alarms.length !== n) saveS();
}

/* 第一次开始：她先开口 */
function start() {
  ST.started = true; ST.lastTick = Date.now(); saveST();
  openApp('wx'); openThread(true);
  enqueue(() => herTurn({ kind: 'opening', at: Date.now(), live: true, retry: { kind: 'reply' }, pro: uid('p') }));
}
