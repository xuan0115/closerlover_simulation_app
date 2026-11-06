/*
 * 回复节奏（《陪伴对象设计规范》第 5 节）：你发完消息，她过多久才开始回、回几条、打字多快。
 *
 *   陪伴方式（S.zx.company，见 js/data/persona.js 的 COMPANY）：
 *     真人作息（默认）：按她的作息（S.her.sched：几点起、几点睡、工作日忙的时候）决定多久回。
 *       睡着了醒来才回；你连发 7 条能把她吵醒；忙的时候过几分钟回；看不了手机的时候忙完才回。
 *     24 小时陪伴：什么时候都在几分钟内回。
 *   不管哪种：你说出想伤害自己这类话，她马上回。
 *   时间表只决定倾向：你们正聊得热的时候，她忙着也会回（「取决于对话者」）。
 *   起床、睡觉的时间可以每天早晚差半小时左右（按日期算，同一天总是同一个结果）。
 *   等待中切走、关掉网页都没关系：预定的回复时间存在 ST.pending 里，到时由服务器（锁屏通知）或下次打开网页时补上。
 */
'use strict';

const rnd = (a, b) => a + Math.random() * (b - a);
const WAKE_N = 7;   // 她睡着时，你连发几条能把她吵醒

const toMin = s => { const [h, m] = String(s || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
/* 她这一天的时间（毫秒时间戳）：起床、睡觉（可能过了半夜）、工作日忙的时候 */
function herDay(t) {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const sc = S.her.sched || DEFAULT_HER.sched, dow = d.getDay();
  const r = k => hash01(dkey(d) + ':' + k);
  const at = min => d.getTime() + min * 60e3;
  const jit = k => sc.vary === false ? 0 : (r(k) * 2 - 1) * 30;               // 每天早晚差半小时左右
  const wake = at(toMin(dow === 0 || dow === 6 ? sc.wakeWeekend : sc.wake) + jit('wake'));
  let bedMin = toMin(dow === 5 || dow === 6 ? sc.bedWeekend : sc.bed);         // 周五、周六晚上按周末的睡
  if (bedMin < 12 * 60) bedMin += 24 * 60;                                      // 00:30 = 过了半夜才睡
  const bed = Math.max(wake + 3600e3, at(bedMin + jit('bed')));
  const busy = dow === 0 || dow === 6 ? [] : (sc.busy || []).map(b => {
    const s = toMin(b.from), e = toMin(b.to);
    return e > s ? { from: at(s), to: at(e), what: String(b.what || '').trim(), phone: b.phone !== false } : null;
  }).filter(Boolean);
  return { wake, bed, busy };
}
/* 她此刻在干嘛：sleep 睡觉 / busy 忙（偶尔看手机）/ away 看不了手机 / free 有空，以及到什么时候 */
function herStatus(t = Date.now()) {
  const d = herDay(t);
  if (t < herDay(t - 864e5).bed) return { status: 'free', until: t };          // 昨晚过了半夜还没睡
  if (t < d.wake) return { status: 'sleep', until: d.wake };
  if (t >= d.bed) return { status: 'sleep', until: herDay(t + 864e5).wake };
  const b = d.busy.find(x => t >= x.from && t < x.to);
  if (b) return { status: b.phone ? 'busy' : 'away', until: b.to, what: b.what };
  return { status: 'free', until: t };
}
/* 她刚说了「晚安」「我睡了」：睡到明早醒来；「我眯一会儿」：睡一个小时左右。返回睡到什么时候，没说过就是 0 */
const GOODNIGHT = /晚安|(我|先|要|去)睡(了|啦)|睡觉去|good ?night|going to bed|off to bed/i, NAP = /眯一会|睡一会|午睡|小睡|nap/i;
function sleepSaidUntil(now) {
  let last = null;
  for (let i = M.length - 1; i >= 0 && !last; i--) if (M[i].from === 'her') last = M[i];
  const t = last && last.type === 'text' ? String(last.text || '') : '';
  if (!t || /[吗？?]/.test(t)) return 0;
  let until = 0;
  if (NAP.test(t)) until = last.ts + 60 * 60e3;
  else if (GOODNIGHT.test(t)) { const d = herDay(last.ts); until = last.ts < d.wake ? d.wake : herDay(last.ts + 864e5).wake; }
  return now < until ? until : 0;
}
/* 「刚才你在……」：告诉 AI 她刚才在干嘛 */
function doingText({ status, what } = {}) {
  if (status === 'sleep') return '在睡觉';
  if (status === 'woken') return `在睡觉，被${pron()}连着发的消息吵醒了`;
  if (status === 'run') return '在跑步';   // 旧版存下的
  if (status === 'busy' || status === 'away') return what ? (what.startsWith('在') ? what : '在' + what) : '在忙';
  return '';
}
/* 你还没被回的消息里，有没有想伤害自己之类的话 */
function crisisNow() {
  const t = pendingText();
  return !!t && [...REPLY_RULES, ...REPLY_RULES_EN].some(r => r.reply === 'crisis' && r.match.test(t));
}

/* 你们是不是正聊得热：她 5 分钟内回过你 */
function chatIsHot(now) {
  const lastHer = [...M].reverse().find(m => m.from === 'her');
  return !!lastHer && now - lastHer.ts < 5 * 60e3;
}

/* 这次等多久才开始回 */
function replyDelay(now = Date.now()) {
  if (S.zx.speed === 'fast') return { delay: rnd(1e3, 3e3), status: 'free' };                     // 测试用的秒回
  if (crisisNow()) return { delay: rnd(2e3, 6e3), status: 'free' };                               // 说出想伤害自己这类话：马上回
  const st = herStatus(now), said = sleepSaidUntil(now);
  if (S.zx.company === 'always')                                                                   // 24 小时陪伴
    return { delay: chatIsHot(now) ? rnd(3e3, 25e3) : rnd(15e3, 120e3), status: st.status === 'sleep' || said ? 'night' : 'free' };
  if (said) return { delay: said - now + rnd(5, 30) * 60e3, status: 'sleep' };                    // 她刚说了晚安 / 眯一会儿：睡着了
  if (chatIsHot(now)) return { delay: rnd(3e3, 25e3), status: 'free' };                           // 聊得正热：忙也会回
  if (st.status !== 'sleep' && st.status !== 'away' && Math.random() < .1) return { delay: rnd(500, 3e3), status: 'free' };   // 刚好拿着手机
  if (st.status === 'free') return { delay: rnd(20e3, 180e3), status: 'free' };
  if (st.status === 'busy') return { delay: Math.min(rnd(3, 15) * 60e3, st.until - now + rnd(1, 5) * 60e3), status: 'busy', what: st.what };
  if (st.status === 'away') return { delay: st.until - now + rnd(1, 5) * 60e3, status: 'away', what: st.what };   // 看不了手机：忙完才回
  return { delay: st.until - now + rnd(5, 40) * 60e3, status: 'sleep' };                          // 睡着了：醒来以后才看到
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
  const p = ST.pending;
  if (p && p.due > now) {   // 已经在等了：她看到时会一起看到
    if (crisisNow()) { p.due = Math.min(p.due, now + rnd(2e3, 6e3)); p.status = 'free'; delete p.what; }   // 想伤害自己这类话：马上回
    else if (p.status === 'sleep' && S.zx.company !== 'always' && pendingMine().filter(m => m.from === 'me').length >= WAKE_N) {
      p.due = Math.min(p.due, now + rnd(20e3, 90e3)); p.status = 'woken';                                // 连发 7 条：被吵醒了
    } else p.due = Math.max(p.due, now + 2e3);
  } else {
    const { delay, status, what } = replyDelay(now);
    ST.pending = Object.assign({ due: now + Math.max(2e3, delay), since: now, status }, what ? { what } : {});
  }
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
    try { await herTurn({ kind: 'reply', at: live ? Date.now() : p.due, live, waited: p.due - p.since, status: p.status, what: p.what || '', retry: { kind: 'reply' } }); }
    finally { replyBusy = false; if (ST.pending) armReply(); }
  });
}
