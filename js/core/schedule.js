/*
 * 定时：她什么时候主动找你。
 * 网页开着时每 20 秒检查一次；网页关着错过的，下次打开时补最近 3 条（12 小时内）。
 */
'use strict';

let Q = Promise.resolve();
/* 所有「她说话」排队进行，避免两段回复交错 */
function enqueue(fn) { Q = Q.then(fn).catch(e => console.error(e)); return Q; }

function hash01(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

/* 某一天这条日程实际触发的时刻（同一天算出来总是同一个时间） */
function fireTime(ev, day) {
  if (!ev.on || !ev.days || !ev.days.includes(day.getDay())) return null;
  const [hh, mm] = String(ev.time || '08:00').split(':').map(Number);
  const off = Math.round((hash01(dkey(day) + ev.id) * 2 - 1) * (+ev.jitter || 0));
  const t = new Date(day); t.setHours(hh, mm + off, 0, 0);
  return t.getTime();
}
const firedKey = (ev, t) => ev.id + '@' + dkey(t);
function dueBetween(from, to) {
  const out = [];
  const d = new Date(from); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 1);
  while (d.getTime() <= to) {
    for (const ev of S.events) {
      const t = fireTime(ev, d);
      if (t && t > from && t <= to && !ST.fired[firedKey(ev, t)]) out.push({ ev, t });
    }
    d.setDate(d.getDate() + 1);
  }
  return out.sort((a, b) => a.t - b.t);
}

async function runEvent(ev, { at, live }) {
  if (ev.to === 'call' && !FEATURES.voice) ev = Object.assign({}, ev, { to: 'chat' });   // 语音通话待开发：先改成发消息
  if (ev.to === 'call') { // 她打语音电话来
    if (live && !document.hidden && !S.notify.airplane) { startCall('in', ev); return; }
    addMsg({ id: uid('m'), from: 'her', type: 'call', status: 'missed', ts: at });
    for (const t of tplPick('callMissed')) addMsg({ id: uid('m'), from: 'her', type: 'text', text: t, ts: at + 30000 });
    return;
  }
  const last = [...M].reverse().find(m => m.from !== 'sys');
  const unreplied = ev.to !== 'moments' && !!last && last.from === 'her' && at - last.ts > 2 * 3600e3;
  const note = unreplied ? PROMPTS.unreplied({ ta: pron(), gap: ago(at - last.ts) }) : '';
  await herTurn({ kind: 'event', ev, at, live, unreplied, note, retry: { kind: 'event', id: ev.id } });
}

function tick() {
  if (!ST.started || S.notify.airplane) return;   // 飞行模式下她联系不上你
  const now = Date.now();
  const from = Math.max(ST.lastTick || now, now - 12 * 3600e3);
  ST.lastTick = now;
  const due = dueBetween(from, now);
  due.forEach(x => { ST.fired[firedKey(x.ev, x.t)] = 1; });
  const cutoff = dkey(now - 3 * 864e5);
  for (const k of Object.keys(ST.fired)) if (k.split('@')[1] < cutoff) delete ST.fired[k];
  saveST();
  for (const x of due.slice(-3)) {
    const live = now - x.t < 10 * 60e3; // 10 分钟内的算「刚刚」，正常打字发出；更早的直接补上
    enqueue(() => runEvent(x.ev, { at: live ? Date.now() : x.t, live }));
  }
}

/* 第一次开始：她先开口 */
function start() {
  ST.started = true; ST.lastTick = Date.now(); saveST();
  openApp('wx'); openThread(true);
  enqueue(() => herTurn({ kind: 'opening', at: Date.now(), live: true, retry: { kind: 'reply' } }));
}
