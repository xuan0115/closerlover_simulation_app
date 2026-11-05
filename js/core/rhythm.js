/*
 * 回复节奏（《陪伴对象设计规范》第 5 节）：你发完消息，她过多久才开始回、回几条、打字多快。
 *
 *   她此刻的状态由她的作息决定（js/data/persona.js 的 routine 只是给 AI 看的文字，这里是程序用的大概时间）：
 *     起床、睡觉、跑步的时间每天不一样（按日期算，同一天总是同一个结果）
 *   时间表只决定倾向：你们正聊得热的时候，她忙着也会回（「取决于对话者」）。
 *   等待中切走、关掉网页都没关系：预定的回复时间存在 ST.pending 里，下次打开时按那个时间补上。
 */
'use strict';

const SPEEDS = { fast: '秒回（测试用）', real: '像真人', slow: '慢热' };
const rnd = (a, b) => a + Math.random() * (b - a);

/* 她这一天的大概时间（毫秒时间戳） */
function herDay(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const key = dkey(d), r = k => hash01(key + ':' + k);
  const at = (h, m) => d.getTime() + (h * 60 + m) * 60e3;
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const wake = weekend ? at(8, 30 + r('wake') * 60) : at(6, 45 + r('wake') * 60);   // 工作日 6:45–7:45，周末 8:30–9:30
  const bed = at(23, r('bed') * 90);                                                  // 23:00–0:30
  const busy = weekend ? [] : [[at(9, 0), at(12, 0)], [at(13, 30), at(18, 0)]];
  let run = null;
  if (r('run?') < (weekend ? .5 : .8)) { const s = at(17, 45 + r('run') * 105); run = [s, s + (40 + r('runlen') * 30) * 60e3]; } // 17:45–19:30 开始，跑 40–70 分钟
  return { wake, bed, busy, run };
}
/* 她此刻在干嘛：sleep / run / busy / free，以及这个状态到什么时候结束 */
function herStatus(t = Date.now()) {
  const d = herDay(t);
  if (t < d.wake) return { status: 'sleep', until: d.wake };
  if (t >= d.bed) return { status: 'sleep', until: herDay(t + 864e5).wake };
  if (d.run && t >= d.run[0] && t < d.run[1]) return { status: 'run', until: d.run[1] };
  const b = d.busy.find(([s, e]) => t >= s && t < e);
  if (b) return { status: 'busy', until: b[1] };
  return { status: 'free', until: t };
}
const STATUS_WORDS = { sleep: '在睡觉', run: '在跑步', busy: '在画稿', free: '' };

/* 你们是不是正聊得热：她 5 分钟内回过你 */
function chatIsHot(now) {
  const lastHer = [...M].reverse().find(m => m.from === 'her');
  return !!lastHer && now - lastHer.ts < 5 * 60e3;
}

/* 这次等多久才开始回 */
function replyDelay(now = Date.now()) {
  const speed = S.zx.speed || 'real';
  if (speed === 'fast') return { delay: rnd(1e3, 3e3), status: 'free' };
  const k = speed === 'slow' ? 2 : 1;
  if (chatIsHot(now)) return { delay: rnd(3e3, 25e3) * k, status: 'free' };   // 聊得正热：忙也会回
  const st = herStatus(now);
  if (st.status !== 'sleep' && Math.random() < .1) return { delay: rnd(500, 3e3), status: 'free' };   // 刚好拿着手机
  if (st.status === 'free') return { delay: rnd(20e3, 180e3) * k, status: 'free' };
  if (st.status === 'busy') return { delay: rnd(3, 15) * 60e3 * k, status: 'busy' };
  if (st.status === 'run') return { delay: Math.min(st.until - now, 70 * 60e3) + rnd(1, 5) * 60e3 * k, status: 'run' };
  return { delay: st.until - now + rnd(5, 40) * 60e3 * k, status: 'sleep' };   // 睡着了：醒来以后才看到
}

/* 这次回几条：1 条 45%，2 条 35%，3 条 15%，4 条 5%；你只回了「嗯」或一个表情，最多 1 条 */
function drawCount(text = '') {
  const t = String(text).trim();
  if (t && (/^(嗯+|哦+|噢+|好+|好的|行|ok|okay|k|哈+|嘿+|hh+|lol|yeah|yep|sure|mm+|hmm+)[.。!！~～]*$/i.test(t) || /^[\p{Extended_Pictographic}\s]+$/u.test(t))) return 1;
  const x = Math.random();
  return x < .45 ? 1 : x < .8 ? 2 : x < .95 ? 3 : 4;
}

/* 打字要多久：每秒 3–4 个字，速度设置为「秒回」时快很多 */
function typingMs(it) {
  if (it.type === 'image' || it.type === 'gift') return 1300;
  if (it.type === 'voice') return 900 + it.dur * 250;
  const ms = Math.min(12e3, Math.max(1200, String(it.text || '').length / rnd(3, 4) * 1e3));
  return (S.zx.speed || 'real') === 'fast' ? ms * .3 : ms;
}

/* ---------- 你发完消息：排一个回复 ---------- */
let replyTimer = null;
function queueReply() {
  const now = Date.now();
  if (ST.pending && ST.pending.due > now) {   // 已经在等了：她看到时会一起看到，不重新算
    ST.pending.due = Math.max(ST.pending.due, now + 2e3); saveST(); armReply(); return;
  }
  const { delay, status } = replyDelay(now);
  ST.pending = { due: now + Math.max(2e3, delay), since: now, status };
  saveST(); armReply();
  pushDirty(true);   // 你马上关网页的话，到时间由服务器替她回（js/core/push.js）
}
function armReply() {
  clearTimeout(replyTimer);
  if (!ST.pending) return;
  replyTimer = setTimeout(checkPending, Math.max(0, Math.min(ST.pending.due - Date.now(), 2 ** 31 - 1)) + 50);
}
let replyBusy = false;
/* 到点了就让她回；飞行模式下先不回，关掉后再回 */
function checkPending() {
  const p = ST.pending, now = Date.now();
  if (pushHold()) return;   // 网页在后台：服务器替她回；回到前台时再看（js/core/push.js）
  if (!p || p.due > now || replyBusy || S.notify.airplane) { if (p && !replyBusy) armReply(); return; }
  delete ST.pending; saveST();
  const live = now - p.due < 60e3 && !document.hidden;   // 网页关着时错过的：按预定时间补上，不演打字
  replyBusy = true;
  enqueue(async () => {
    try { await herTurn({ kind: 'reply', at: live ? Date.now() : p.due, live, waited: p.due - p.since, status: p.status, retry: { kind: 'reply' } }); }
    finally { replyBusy = false; if (ST.pending) armReply(); }
  });
}
