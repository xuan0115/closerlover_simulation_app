/*
 * 她的「脑子」：决定这一轮用模板还是 AI、拼设定、解析回复、挑照片、一条条发出来。
 * 说话规则在 js/data/prompts.js（AI）和 js/data/templates.js（模板）。
 */
'use strict';

/* 现在能发哪些照片 */
function photoOptions() {
  const mode = S.photo.mode;
  const pool = mode === 'gen' ? [] : [...POOL].sort((a, b) => (a.sent || 0) - (b.sent || 0) || (a.lastSent || 0) - (b.lastSent || 0));
  return { pool, gen: mode !== 'pool' && !!imgConf().key };
}

/* ---------- AI：拼设定 ---------- */
/*
 * 发给模型的顺序（2026-11-09 起）：不变的放前面，常变的放后面。
 *   系统设定：开头 → 聊天规则 →（英文模式）→ 输出格式 → 她的人设 → 督促清单 → 你记得的事 → 发照片
 *   然后：聊天记录（整段整段地挪，见 histCore）→ 这一轮的说明 →「此刻」（现在几点、这次回几条）
 * DeepSeek 会把「和上一次开头一模一样」的部分按缓存价算（便宜很多）。「现在几点」每分钟都变，
 * 所以放在最后；放中间的话，它后面的规则和整段聊天记录每次都得按全价重新算。
 */
/* 「此刻」这一段：现在几点、今天的督促清单、这一轮的说明 */
function nowText(at, turnNote = '') {
  const today = todayChecks(at);
  const lastMine = [...M].reverse().find(m => m.from === 'me');
  return (PROMPTS.now({
    time: `${fmtFull(at)}（${dkey(at)}）`, ta: pron(),
    today: tasksOn(at).map(t => ({ name: t.name, done: today[t.id] && hm(today[t.id]) })),
    lastMineAgo: lastMine && ago(at - lastMine.ts)
  }) + (turnNote ? '\n' + turnNote : '')).trim();
}
const nowSection = (at, turnNote) => `${PROMPTS.nowHead}\n${nowText(at, turnNote)}`;
/* opt.noPhoto：这次发不了照片（锁屏通知的服务器替她说话时） */
function buildSystem(at, opt = {}) {
  const h = S.her, me = S.me, ta = pron(), nm = herName(), T = PROMPTS.sections;
  const L = [];
  const sec = (title, v) => { v = String(v || '').trim(); if (v) L.push(`【${title}】\n${v}`); };

  const edu = EDU_LEVELS[h.edu];
  if (opt.diary) {   // 写日记（js/ui/diary.js）：人设、记得的事照旧，聊天规则和格式换成写日记的
    const call = [myName() && `「${myName()}」`, h.callMe && `你平时叫${ta}的「${h.callMe}」`, ta !== 'TA' && `「${ta}」`].filter(Boolean);
    L.push(PROMPTS.diaryIntro({ nm, ta }));
    L.push(PROMPTS.diaryRules({ ta, call: call.length ? call.join('或') : `「${ta}」`, en: isEN() }));
  } else {
    L.push(PROMPTS.intro({ nm, me: myName(), ta }));
    L.push(PROMPTS.rules({ nm, ta }));
    if (isEN()) L.push(PROMPTS.english({ ta, level: S.zx.enLevel, correct: S.zx.correct, edu: edu && edu.label, eduKey: h.edu }));
    L.push(PROMPTS.format({ ta }));
  }

  const z = h.zodiac && ZODIAC[h.zodiac];
  sec(T.identity, [
    PROMPTS.social({ gender: h.gender, edu: edu && edu.label, major: edu && edu.major && h.major, job: h.job, siblings: SIBLINGS[h.siblings] }),
    h.region && `所在地：${h.region}`, h.identity, h.signature && `个性签名：${h.signature}`,
    PROMPTS.income(INCOME_TIERS[herIncome()]),
    z && PROMPTS.zodiac({ sign: h.zodiac, traits: z.traits })].filter(Boolean).join('\n'));
  sec(T.personality, h.personality);
  sec(T.style, h.style);
  sec(T.routine, h.routine);
  sec(T.relationship, [PROMPTS.relType[h.relType] || PROMPTS.relType.lover, h.relationship].filter(Boolean).join('\n'));
  sec(T.callMe(ta), isEN() ? (h.callMeEn ? `英文里叫${ta}「${h.callMeEn}」` : `英文里直接叫${ta}的名字`) : h.callMe && `「${h.callMe}」`);
  const myGender = me.gender === '自己填写' ? (me.genderText || '').trim() : me.gender;
  sec(T.aboutMe(ta), [myName() && `名字/昵称：${myName()}`, myGender && `性别：${myGender}`, me.identity && `身份：${me.identity}`, me.region && `所在地：${me.region}`,
    me.signature && `个性签名：${me.signature}`, me.zodiac && PROMPTS.myZodiac({ ta, sign: me.zodiac }), me.about].filter(Boolean).join('\n'));
  if (S.tasks.length) sec(T.tasks, PROMPTS.tasks({ ta, list: S.tasks.map(t => ({ id: t.id, name: t.name, days: daysText(t.days), target: t.target, remind: t.remindOn && t.remind })) }));
  if (S.memory.length) sec(T.memory, S.memory.map(x => '- ' + x).join('\n'));
  const dy = recentDiary(opt.diary || dkey(at), !!opt.diary);
  if (dy.length) sec(T.diary, dy.map(x => `- ${mdText(x.date)}「${x.title || '无题'}」${x.text.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n') + '\n' + PROMPTS.diaryNote(ta));
  if (opt.diary) return L.join('\n\n');

  const { pool, gen } = opt.noPhoto ? { pool: [], gen: false } : photoOptions();
  const P = [];
  if (pool.length) {
    P.push(PROMPTS.photoPoolHead);
    pool.slice(0, 15).forEach(x => P.push(PROMPTS.photoPoolItem(x.id, (x.desc || '').trim(), x.sent)));
    P.push(PROMPTS.photoPoolHow);
  }
  if (gen) P.push(PROMPTS.photoGenHow);
  P.push(!pool.length && !gen ? PROMPTS.photoNone : PROMPTS.photoLimit(ta));
  sec(T.photo, P.join('\n'));
  return L.join('\n\n');
}

/* 最近 3 篇日记（写日记时不含当天） */
const mdText = date => { const [, m, d] = date.split('-').map(Number); return `${m}月${d}日`; };
const recentDiary = (date, before) => DIARY.filter(x => !x.del && x.text && (before ? x.date < date : x.date <= date)).sort((a, b) => a.date < b.date ? -1 : 1).slice(-3);

/* 一条聊天记录在 AI 眼里是什么样 */
function msgForAI(m) {
  const ta = pron();
  const q = m.quote ? `「回复${m.quote.who}：${m.quote.text}」` : '';
  if (m.from === 'tip') {
    if (m.who === 'me' && m.kind === 'pat') return `[${ta}拍了拍你]`;
    if (m.who === 'me' && m.kind === 'recall') return `[${ta}撤回了一条消息]`;
    return null;
  }
  switch (m.type) {
    case 'image': return m.from === 'me' ? `[${ta}发来一张照片]` : `[发了一张照片：${m.desc || '照片'}]`;
    case 'voice': return m.from === 'me' ? (m.transcript ? `[语音] ${m.transcript}` : `[${ta}发来一段语音，没听清说了什么]`) : m.text;
    case 'gift': return `[送了一份礼物：${m.name}]${m.note ? ' ' + m.note : ''}`;
    case 'call': return `[语音通话${m.status === 'done' ? ' ' + fmtDur(m.dur) : '，没接通'}]`;
    case 'checkin': return `[打卡] ${m.text}`;
    default: return q + (m.text || '');
  }
}

/* 同一个人连着说的几条并成一段 */
const pushTurn = (out, role, text) => { if (!text) return; const l = out[out.length - 1]; if (l && l.role === role) l.text += '\n' + text; else out.push({ role, text }); };
/* 最近 30～49 条聊天，整理成模型能读的对话（锁屏通知的服务器也用这一份）。
 * 起点每次挪 20 条，不是每多一条就挪一条：这样连着几轮的开头都一样，能命中缓存 */
const HIST_MIN = 30, HIST_STEP = 20;
function histCore() {
  const all = M.filter(m => m.from !== 'sys');
  let from = Math.max(0, all.length - HIST_MIN);
  from -= from % HIST_STEP;
  const src = all.slice(from);
  const out = [];
  let prev = null;
  for (const m of src) {
    if (prev && m.ts - prev > 3 * 3600e3) pushTurn(out, 'user', PROMPTS.gap({ gap: ago(m.ts - prev), time: fmtFull(m.ts) }));
    prev = m.ts;
    const mine = m.from === 'me' || (m.from === 'tip' && m.who === 'me');
    pushTurn(out, mine ? 'user' : 'assistant', msgForAI(m));
  }
  return out;
}
/* 加上这一轮的指令；extra 是电话里的话之类；最后是「此刻」 */
function buildHistory(instruction, extra = [], at = Date.now(), turnNote = '') {
  const out = histCore();
  const push = (role, text) => pushTurn(out, role, text);
  if (instruction) push('user', instruction);
  for (const x of extra) push(x.role, x.text);
  push('user', nowSection(at, turnNote));
  return out;
}

/* 模型回复 → {messages, photo, voice, gift, remember, done}；格式不对也尽量救回来 */
function parseReply(t) {
  let s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let o = null;
  try { o = JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}/); if (m) { try { o = JSON.parse(m[0]); } catch (e2) {} } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) o = { messages: s.split(/\n+/) };
  if (typeof o.messages === 'string') o.messages = o.messages.split(/\n+/);
  const isAction = x => /^[（(\*【\[].*[）)\*】\]]$/.test(x); // 整条都是括号动作描写的，丢掉
  o.messages = (Array.isArray(o.messages) ? o.messages : [])
    .map(x => String(x && typeof x === 'object' ? (x.text || x.content || '') : x).trim())
    .filter(x => x && !isAction(x)).slice(0, 6);
  if (!o.photo || typeof o.photo !== 'object' || !(o.photo.id || o.photo.scene)) o.photo = null;
  o.voice = o.voice === true;
  o.gift = typeof o.gift === 'string' && giftsFor().some(g => g.name === o.gift.trim()) ? o.gift.trim() : null;
  o.remember = Array.isArray(o.remember) ? o.remember.map(x => String(x).trim()).filter(Boolean) : [];
  o.done = (Array.isArray(o.done) ? o.done : o.done ? [o.done] : []).map(String);
  o.remind = (Array.isArray(o.remind) ? o.remind : o.remind ? [o.remind] : [])
    .filter(x => x && typeof x === 'object').map(x => ({ at: String(x.at || x.time || '').trim(), what: String(x.what || x.text || '').trim() }))
    .filter(x => x.at).slice(0, 3);
  return o;
}

/* ---------- 照片：照片池里挑，或者 AI 现拍 ---------- */
async function resolvePhoto(p) {
  if (!p) return null;
  const { pool, gen } = photoOptions();
  let item = p.id ? POOL.find(x => x.id === p.id) : null;
  if (!item && p.scene && gen) return makePhoto(p.scene);
  if (!item && pool.length) {
    const min = pool[0].sent || 0;
    item = pick(pool.filter(x => (x.sent || 0) === min));
  }
  if (!item && gen) return makePhoto(p.scene || `${partOfDay()}随手拍的一张日常自拍，符合${TA()}此刻在做的事`);
  if (!item) return null;
  item.sent = (item.sent || 0) + 1; item.lastSent = Date.now(); savePool();
  return { imageId: item.imageId, desc: (item.desc || '').trim() || '一张照片' };
}
async function makePhoto(scene) {
  const url = await generateImage(scene);
  let data = url;
  try { data = await compress(url, 1280, .88); } catch (e) {}
  const id = uid('g');
  await IDB.put(id, data); imgCache.set(id, data);
  return { imageId: id, desc: scene };
}

/* ---------- 这一轮她说什么 ---------- */
/* kind：'reply' 回你 / 'event' 定时消息 / 'opening' 开场 */
const usesAI = () => S.reply.mode === 'ai';

function templateFor({ kind, ev, unreplied }) {
  if (kind === 'reply') return tplReply();
  if (kind === 'opening') return tplScene('opening');
  return tplScene(ev.scene || 'chat', { photo: !!ev.photo, unreplied, task: ev.task, alarm: ev.alarm });
}

async function compose({ kind, ev, at, unreplied, note, count, waited, status, what, pat }) {
  if (!usesAI()) {
    const o = templateFor({ kind, ev, unreplied });
    if (kind === 'reply' && (waited > 3 * 60e3 || status === 'woken') && o.messages.length) o.messages.unshift(...tplBack(status, what));   // 隔了好一阵才回：先说一句刚在干嘛
    return Object.assign(o, { by: 'template' });
  }
  const crisis = kind === 'reply' && [...REPLY_RULES, ...REPLY_RULES_EN].some(r => r.reply === 'crisis' && r.match.test(pendingText()));
  const turnNote = [
    kind === 'reply' && pat ? PROMPTS.patted(pron()) : '',
    kind === 'reply' && status === 'woken' ? PROMPTS.woken(pron())
      : kind === 'reply' && waited > 2 * 60e3 ? PROMPTS.waited({ ta: pron(), gap: ago(waited), doing: doingText({ status, what }) }) : '',
    kind === 'reply' && status === 'night' ? PROMPTS.night : '',
    count && !crisis && kind !== 'opening' && !(ev && ev.to === 'moments') ? PROMPTS.count(count) : ''
  ].filter(Boolean).join('\n');
  let instruction = '';
  if (kind === 'opening') instruction = PROMPTS.opening({ time: fmtFull(at), ta: pron() });
  if (kind === 'event') instruction = ev.to === 'moments'
    ? PROMPTS.moments({ time: fmtFull(at), prompt: ev.prompt, ta: pron() })
    : PROMPTS.event({ time: fmtFull(at), prompt: ev.prompt || '', photo: ev.photo, note });
  try {
    const o = parseReply(await callLLM(buildSystem(at), buildHistory(instruction, [], at, turnNote)));
    if (count && !crisis && o.messages.length > count) o.messages = o.messages.slice(0, count);   // 说好几条就几条
    if (ev && ev.photo && !o.photo) o.photo = { auto: true };
    if (!o.messages.length) throw new Error('模型的回复里没有能发的话（格式不对），再发一条试试');
    if (ST.aiErr) { delete ST.aiErr; saveST(); }
    return Object.assign(o, { by: 'ai', noPhoto: kind === 'reply' ? 'noPhoto' : 'photoNone' });
  } catch (e) {
    ST.aiErr = { at: Date.now(), msg: e.message }; saveST();   // 记下来，「设置 → 回复方式」里能看到
    if (!S.reply.fallback) throw e;
    toast('AI 没连上，这次用了模板：' + e.message, 9000);
    return Object.assign(templateFor({ kind, ev, unreplied }), { by: 'template' });
  }
}

/* 这一轮要不要用语音发 */
function wantVoice(o) {
  const f = S.zx.voice;
  if (!FEATURES.voice || f === 'never' || !o.messages.length) return false;
  if (o.by === 'ai' && o.voice) return true;
  const len = o.messages.join('').length;
  if (len > 60) return false;
  return Math.random() < (f === 'often' ? .4 : .12);
}

/*
 * 让她说一轮话。
 *   at    这轮发生的时间（补发错过的消息时是过去的时间）
 *   live  true = 现在正在发，带「对方正在输入」；false = 补发，直接出现
 */
/* 她这一轮记下的事、确认你做完的督促事项（网页里说的、网页关着时服务器替她说的，都走这里） */
/* 返回这一轮她答应要提醒你、真的定上了的提醒（时钟里的「她提醒」闹钟），发完消息后在聊天里显示一行小字 */
function absorbTurn(o) {
  for (const r of o.remember || []) { const s = String(r).slice(0, 80); if (s && !S.memory.includes(s)) S.memory.push(s); }
  if (S.memory.length > 80) S.memory = S.memory.slice(-80);
  for (const d of o.done || []) {   // 模型可能给 id，也可能给名称
    const t = taskById(d) || S.tasks.find(x => x.name === d);
    if (t && !todayChecks()[t.id]) checkin(t.id, Date.now());
  }
  const made = addReminders(o.remind);
  saveS(); saveST();
  return made;
}

/* ---------- 聊天里说「十点提醒我」：她定一个只响一次的提醒 ---------- */
/* 模型写的时间 → 时间戳；认 2026-11-09 22:00、11-09 22:00、22:00（下一个 22:00）。太久以前、一个月以后的不算 */
function parseRemindAt(str, now = Date.now()) {
  const s = String(str || '').trim().replace(/[年月/.]/g, '-').replace(/日/g, ' ').replace(/[：时點点]/g, ':');
  let m = s.match(/(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s*T?\s*(\d{1,2}):(\d{1,2})/), d;
  if (m) {
    const y = m[1] ? +m[1] : new Date(now).getFullYear();
    d = new Date(y, +m[2] - 1, +m[3], +m[4], +m[5]);
    if (!m[1] && d.getTime() < now - 864e5) d.setFullYear(y + 1);
  } else if ((m = s.match(/(\d{1,2}):(\d{1,2})/))) {
    d = new Date(now); d.setHours(+m[1], +m[2], 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  } else return 0;
  const t = d.getTime();
  if (!t || t < now - 10 * 60e3 || t > now + 31 * 864e5) return 0;
  return Math.max(t, now + 60e3);   // 说的时间刚过：一分钟后提醒
}
function addReminders(list, now = Date.now()) {
  const made = [];
  for (const r of list || []) {
    const t = parseRemindAt(r.at, now);
    if (!t) continue;
    const time = hm(t), date = dkey(t), label = String(r.what || '').trim().slice(0, 40) || '提醒';
    if (S.alarms.some(a => a.byHer && a.date === date && a.time === time)) continue;   // 同一个时间已经定过了
    const a = { id: uid('r'), time, date, days: [], label, on: true, ta: true, snooze: false, byHer: true };
    S.alarms.push(a); made.push(a);
  }
  if (made.length) pushDirty();
  return made;
}
/* 「今天 22:00」「明天 08:00」「11月12日 09:00」 */
function whenText(date, time, now = Date.now()) {
  const d = dkey(now), t1 = dkey(now + 864e5);
  if (date === d) return '今天 ' + time;
  if (date === t1) return '明天 ' + time;
  const [, mo, da] = date.split('-').map(Number);
  return `${mo}月${da}日 ${time}`;
}
const remindTip = (a, ts) => ({ id: uid('t'), from: 'tip', who: 'her', kind: 'remind', text: L(`${TA()}定了提醒：${whenText(a.date, a.time)}，${a.label}`, `Reminder set: ${a.date} ${a.time}, ${a.label}`), ts });

/*   pro   她主动找你的这一轮的记号（回你的话没有）：用来数「她连着主动找了你几次你都没回」 */
/*   evKey 她主动找你的这一次是哪一条日程的哪一天（比如 e_morning@2026-11-09）：几台设备同步时，同一次只留一份
 *   pre   提前想好的回复（js/core/rhythm.js：边等边想），没有就现在想；count 是提前想的时候定的条数 */
async function herTurn({ kind, ev = null, at = Date.now(), live = true, unreplied = false, note = '', retry = null, waited = 0, status = 'free', what = '', pro = '', evKey = '', pre = null, count = 0, pat = false }) {
  const toMoments = ev && ev.to === 'moments';
  if (live && !toMoments) setTyping(true);
  try {
    if (!count) count = drawCount(kind === 'reply' ? pendingText() : '');
    let o = null;
    if (pre) { try { o = await pre; } catch (e) { o = null; } }   // 提前想的那次没成：现在再想一次
    if (!o) o = await compose({ kind, ev, at, unreplied, note, count, waited, status, what, pat });
    const reminders = absorbTurn(o), turn = uid('u');

    let photo = null;
    if (o.photo) {
      try { photo = await resolvePhoto(o.photo); }
      catch (e) { toast('照片没生成出来：' + e.message, 5000); }
      if (!photo && o.by === 'template' && o.noPhoto) o.messages = tplPick(o.noPhoto);
    }

    if (toMoments) {
      if (!photo && !o.messages.length) return;
      addPost({ author: 'her', text: o.messages.join('，'), imageIds: photo ? [photo.imageId] : [], ts: live ? Date.now() : at });
      return;
    }

    let items = [];
    if (o.patBack) items.push({ from: 'tip', who: 'her', kind: 'pat', text: L(`「${wxName()}」拍了拍我${(S.me.pat || '').trim()}`, `${wxName()} nudged you`) });
    if (wantVoice(o)) {
      const text = o.messages.join('，');
      items.push({ type: 'voice', text, dur: Math.max(1, Math.min(60, Math.round(text.length * .28) + 1)) });
    } else items.push(...o.messages.map(text => ({ type: 'text', text })));
    if (photo) items.splice(Math.min(items.length, 1 + (o.patBack ? 1 : 0)), 0, { type: 'image', imageId: photo.imageId, desc: photo.desc });
    if (o.gift) {
      const g = GIFTS.find(x => x.name === o.gift) || GIFTS[0];
      items.push({ type: 'gift', name: g.name, emoji: g.emoji, note: o.by === 'template' ? tplPick('giftNote')[0] : '' });
    }
    if (!items.length) throw new Error(`${TA()}这次什么也没说`);

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (live && it.from !== 'tip') { // 按字数算打字时间；条与条之间停一下；偶尔打到一半停住
        if (i > 0) { setTyping(false); await sleep(rnd(1e3, 3e3) * ((S.zx.speed || 'real') === 'fast' ? .3 : 1)); }
        setTyping(true);
        const d = typingMs(it);
        if (it.type === 'text' && d > 2500 && Math.random() < .2) {
          await sleep(d / 2); setTyping(false); await sleep(rnd(2e3, 5e3)); setTyping(true); await sleep(d / 2);
        } else await sleep(d);
      }
      addMsg(Object.assign({ id: uid('m'), from: 'her', ts: live ? Date.now() : at + i * 20000 }, it, pro && it.from !== 'tip' ? { pro } : {}, evKey ? { ev: evKey, turn } : {}));
    }
    for (const a of reminders) addMsg(Object.assign(remindTip(a, live ? Date.now() : at + items.length * 20000), evKey ? { ev: evKey, turn } : {}));
  } catch (e) {
    addSys((live ? L(`${TA()}的消息没收到：`, `Message from ${herName()} didn't arrive: `) : L(`${hm(at)} 那条消息没收到：`, `The ${hm(at)} message didn't arrive: `)) + e.message, retry);
  } finally {
    if (live) setTyping(false);
  }
}

/*
 * 电话里、朋友圈里她说的话（不进聊天记录）。
 *   kind: 'call-start' | 'call-turn' | 'call-idle' | 'call-bye' | 'moment-comment' | 'my-moment'
 */
async function herSays(kind, ctx = {}) {
  const at = Date.now(), ta = pron();
  if (S.reply.mode !== 'template' && kind !== 'call-bye') {
    try {
      let instruction = '', extra = [];
      if (kind.startsWith('call')) {
        instruction = PROMPTS.callStart({ time: fmtFull(at), ta, mine: ctx.incoming });
        extra = (ctx.log || []).map(x => ({ role: x.who === 'me' ? 'user' : 'assistant', text: x.text }));
        if (kind !== 'call-start') extra.push({ role: 'user', text: PROMPTS.callTurn({ said: ctx.said || '' }) });
      }
      if (kind === 'moment-comment') instruction = PROMPTS.momentComment({ ta, post: ctx.post, comment: ctx.comment, mine: ctx.mine, her: ctx.her });
      if (kind === 'my-moment') instruction = PROMPTS.myMoment({ ta, post: ctx.post, photo: ctx.photo });
      const o = parseReply(await callLLM(buildSystem(at), buildHistory(instruction, extra, at)));
      if (o.messages.length) return o.messages.slice(0, kind.startsWith('call') ? 2 : 1);
    } catch (e) {
      if (!S.reply.fallback) throw e;
    }
  }
  if (kind === 'call-start') return tplCall('start', ctx.incoming);
  if (kind === 'call-turn') return tplCall('turn', ctx.said);
  if (kind === 'call-idle') return tplCall('idle');
  if (kind === 'call-bye') return tplCall('bye');
  if (kind === 'moment-comment') return tplPick('momentReply').slice(0, 1);
  if (kind === 'my-moment') return tplPick('myMoment').slice(0, 1);
  return [];
}
const fmtDur = s => `${pad(Math.floor((s || 0) / 60))}:${pad((s || 0) % 60)}`;

/* ---------- Ta的日记（2026-11-10）：每天睡前，她把这一天和你聊的写下来（界面在 js/ui/diary.js） ---------- */
/* 这一天的日记写到几点为止：她睡前 20 分钟。前一天的这个时间之后到这个时间之前的聊天，算这一天的 */
const diaryCut = date => herDay(new Date(date + 'T12:00').getTime()).bed - 20 * 60e3;
const prevDate = date => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() - 1); return dkey(d); };
/* 这一天的聊天记录，按「几点 谁：说了什么」排好，给写日记用 */
function dayLog(date, until = diaryCut(date), from = diaryCut(prevDate(date))) {
  const ta = pron(), who = myName() || ta;
  const lines = [];
  for (const m of M) {
    if (m.ts < from || m.ts >= until) continue;
    if (m.from === 'tip') { if (m.who === 'me' && m.kind === 'pat') lines.push(`${hm(m.ts)} ${who}拍了拍我`); continue; }
    if (m.from !== 'me' && m.from !== 'her') continue;
    let t = msgForAI(m);
    if (!t) continue;
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length > 200) t = t.slice(0, 200) + '…';
    lines.push(`${hm(m.ts)} ${m.from === 'me' ? who : '我'}：${t}`);
  }
  const MAX = 160;
  return lines.length > MAX ? [`（前面还有 ${lines.length - MAX} 条，略）`, ...lines.slice(-MAX)] : lines;
}
/* 这一天朋友圈里的事：谁发了什么、谁评论了谁 */
function dayMoments(date, until = diaryCut(date), from = diaryCut(prevDate(date))) {
  const who = myName() || pron(), name = a => a === 'her' ? '我' : who;
  const inDay = t => t >= from && t < until;
  const out = [];
  for (const p of POSTS) {
    const cs = (p.comments || []).filter(c => inDay(c.ts));
    if (!inDay(p.ts) && !cs.length) continue;
    const head = `${name(p.author)}${inDay(p.ts) ? '发' : '之前发'}的朋友圈「${(p.text || '').slice(0, 80) || '一张照片'}」${(p.imageIds || []).length ? '（配了照片）' : ''}`;
    const bits = cs.map(c => `${name(c.from)}${c.replyTo || (c.from === 'her' && c.to === 'me') ? '回复' : '评论'}：「${(c.text || '').slice(0, 80)}」`);
    if (p.author === 'her' && p.likes && p.likes.me && inDay(p.ts)) bits.unshift(`${who}点了赞`);
    if (p.author === 'me' && p.likes && p.likes.her && inDay(p.ts)) bits.unshift('我点了赞');
    out.push('- ' + head + (bits.length ? '；' + bits.join('；') : ''));
  }
  return out.slice(-8).join('\n');
}
/* 模型写的日记 → {title, mood, text}；不是 JSON 也尽量救回来 */
function parseDiary(t) {
  let s = String(t || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let o = null;
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) {}
  if (!o || typeof o !== 'object') o = { text: s };
  const clean = (v, n) => String(v || '').replace(/\\n/g, '\n').replace(/[#*]/g, '').trim().slice(0, n);
  return { title: clean(o.title, 20).replace(/\n/g, ' '), mood: clean(o.mood, 10).replace(/\n/g, ' '), text: clean(o.text, 1500).replace(/\n{3,}/g, '\n\n') };
}
/* 写某一天的日记。early：还没到她睡觉的时候，你让她先写（写到现在为止） */
async function writeDiary(date, { early = false } = {}) {
  const now = Date.now(), until = early ? now : diaryCut(date);
  const log = dayLog(date, until);
  if (!log.length) throw new Error('这一天你们没聊天，没什么可写的');
  const text = PROMPTS.diaryNow({ time: fmtFull(until), day: `${mdText(date)} 星期${WD[new Date(date + 'T12:00').getDay()]}`, early, log: log.join('\n'), moments: dayMoments(date, until) });
  const o = parseDiary(await callLLM(buildSystem(until, { diary: date }), [{ role: 'user', text }]));
  if (!o.text || o.text.length < 20) throw new Error('这次没写出来，过一会儿再试');
  if (DIARY.some(x => x.date === date)) return DIARY.find(x => x.date === date);   // 等的这会儿别的设备已经写了
  const e = { date, title: o.title, mood: o.mood, text: o.text, ts: until, at: Date.now() };
  if (early) e.early = true;
  DIARY.push(e); DIARY.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
  saveDiary();
  if (typeof diaryChanged === 'function') diaryChanged(e);
  return e;
}
/* 白天让她先写了的：睡前把后来聊的补几句 */
async function diaryMore(e) {
  const cut = diaryCut(e.date), log = dayLog(e.date, cut, e.ts);
  if (!log.length) return;
  const text = PROMPTS.diaryMore({ time: fmtFull(cut), written: hm(e.ts), before: e.text, log: log.join('\n'), moments: dayMoments(e.date, cut, e.ts) });
  const o = parseDiary(await callLLM(buildSystem(cut, { diary: e.date }), [{ role: 'user', text }]));
  if (!o.text || o.text.length < 10) throw new Error('这次没写出来');
  const cur = DIARY.find(x => x.date === e.date);
  if (!cur || cur.del || cur.more) return;
  Object.assign(cur, { text: cur.text + '\n\n' + o.text, more: true, at: Date.now() });
  saveDiary();
  if (typeof diaryChanged === 'function') diaryChanged(cur);
}
/* 每 20 秒看一眼：她睡前写当天的；前两天有聊天却没写的（那会儿网页没开）补上。只在 AI 回复方式下写 */
let diaryBusy = false;
const diaryFailAt = {};
function diaryTick(now = Date.now()) {
  if (diaryBusy || !ST.started || !usesAI()) return;
  if (performance.now() < 15e3 || (currentUser && !cloudReady)) return;   // 刚打开、还没和云端对上：先等等，别的设备可能已经写了
  for (const back of [2, 1, 0]) {
    const d = new Date(now); d.setDate(d.getDate() - back);
    const date = dkey(d);
    if (now < diaryCut(date) || now - (diaryFailAt[date] || 0) < 30 * 60e3) continue;
    const e = DIARY.find(x => x.date === date);
    if (e && !(e.early && !e.more && !e.del && dayLog(date, diaryCut(date), e.ts).length)) continue;
    if (!e && !dayLog(date).length) continue;
    diaryBusy = true;
    (e ? diaryMore(e) : writeDiary(date)).catch(e => { diaryFailAt[date] = Date.now(); console.warn('日记没写成', date, e); }).finally(() => { diaryBusy = false; });
    return;
  }
}
