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
function buildSystem(at) {
  const h = S.her, me = S.me, ta = pron(), nm = herName(), T = PROMPTS.sections;
  const today = todayChecks(at);
  const lastMine = [...M].reverse().find(m => m.from === 'me');
  const L = [];
  const sec = (title, v) => { v = String(v || '').trim(); if (v) L.push(`【${title}】\n${v}`); };

  L.push(PROMPTS.intro({ nm, me: myName(), ta }));
  const z = h.zodiac && ZODIAC[h.zodiac];
  const edu = EDU_LEVELS[h.edu];
  sec(T.identity, [
    PROMPTS.social({ gender: h.gender, edu: edu && edu.label, major: edu && edu.major && h.major, job: h.job, siblings: SIBLINGS[h.siblings] }),
    h.region && `所在地：${h.region}`, h.identity, h.signature && `个性签名：${h.signature}`,
    PROMPTS.income(INCOME_TIERS[herIncome()]),
    z && PROMPTS.zodiac({ sign: h.zodiac, traits: z.traits })].filter(Boolean).join('\n'));
  sec(T.personality, h.personality);
  sec(T.style, h.style);
  sec(T.routine, h.routine);
  sec(T.relationship, h.relationship);
  sec(T.callMe(ta), h.callMe && `「${h.callMe}」`);
  sec(T.aboutMe(ta), [myName() && `名字/昵称：${myName()}`, me.zodiac && PROMPTS.myZodiac({ ta, sign: me.zodiac }), me.about, me.goals && `${ta}给自己定的目标：${me.goals}`].filter(Boolean).join('\n'));
  if (S.memory.length) sec(T.memory, S.memory.map(x => '- ' + x).join('\n'));
  sec(T.now, PROMPTS.now({
    time: fmtFull(at), ta,
    study: today.study && `已完成（${hm(today.study)}）`,
    gym: today.gym && `已完成（${hm(today.gym)}）`,
    lastMineAgo: lastMine && ago(at - lastMine.ts)
  }));

  const { pool, gen } = photoOptions();
  const P = [];
  if (pool.length) {
    P.push(PROMPTS.photoPoolHead);
    pool.slice(0, 15).forEach(x => P.push(PROMPTS.photoPoolItem(x.id, (x.desc || '').trim(), x.sent)));
    P.push(PROMPTS.photoPoolHow);
  }
  if (gen) P.push(PROMPTS.photoGenHow);
  P.push(!pool.length && !gen ? PROMPTS.photoNone : PROMPTS.photoLimit(ta));
  sec(T.photo, P.join('\n'));

  L.push(PROMPTS.rules({ nm, ta }));
  L.push(PROMPTS.format({ ta }));
  return L.join('\n\n');
}

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

/* 最近 40 条聊天整理成模型能读的对话；extra 是电话里的话之类 */
function buildHistory(instruction, extra = []) {
  const src = M.filter(m => m.from !== 'sys').slice(-40);
  const out = [];
  const push = (role, text) => { if (!text) return; const l = out[out.length - 1]; if (l && l.role === role) l.text += '\n' + text; else out.push({ role, text }); };
  let prev = null;
  for (const m of src) {
    if (prev && m.ts - prev > 3 * 3600e3) push('user', PROMPTS.gap({ gap: ago(m.ts - prev), time: fmtFull(m.ts) }));
    prev = m.ts;
    const mine = m.from === 'me' || (m.from === 'tip' && m.who === 'me');
    push(mine ? 'user' : 'assistant', msgForAI(m));
  }
  if (instruction) push('user', instruction);
  for (const x of extra) push(x.role, x.text);
  if (!out.length || out[out.length - 1].role !== 'user') push('user', PROMPTS.carryOn);
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
  o.gift = typeof o.gift === 'string' && GIFTS.some(g => g.name === o.gift.trim()) ? o.gift.trim() : null;
  o.remember = Array.isArray(o.remember) ? o.remember.map(x => String(x).trim()).filter(Boolean) : [];
  o.done = (Array.isArray(o.done) ? o.done : o.done ? [o.done] : []).map(String);
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
const usesAI = kind => S.reply.mode === 'ai' || (S.reply.mode === 'hybrid' && kind === 'reply');

function templateFor({ kind, ev, unreplied }) {
  if (kind === 'reply') return tplReply();
  if (kind === 'opening') return tplScene('opening');
  return tplScene(ev.scene || 'chat', { photo: !!ev.photo, unreplied });
}

async function compose({ kind, ev, at, unreplied, note }) {
  if (!usesAI(kind)) return Object.assign(templateFor({ kind, ev, unreplied }), { by: 'template' });
  let instruction = '';
  if (kind === 'opening') instruction = PROMPTS.opening({ time: fmtFull(at), ta: pron() });
  if (kind === 'event') instruction = ev.to === 'moments'
    ? PROMPTS.moments({ time: fmtFull(at), prompt: ev.prompt, ta: pron() })
    : PROMPTS.event({ time: fmtFull(at), prompt: ev.prompt || '', photo: ev.photo, note });
  try {
    const o = parseReply(await callLLM(buildSystem(at), buildHistory(instruction)));
    if (ev && ev.photo && !o.photo) o.photo = { auto: true };
    if (!o.messages.length) throw new Error('模型返回为空');
    return Object.assign(o, { by: 'ai', noPhoto: kind === 'reply' ? 'noPhoto' : 'photoNone' });
  } catch (e) {
    if (!S.reply.fallback) throw e;
    toast('AI 没连上，这次用了模板：' + e.message, 5000);
    return Object.assign(templateFor({ kind, ev, unreplied }), { by: 'template' });
  }
}

/* 这一轮要不要用语音发 */
function wantVoice(o) {
  const f = S.zx.voice;
  if (f === 'never' || !o.messages.length) return false;
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
async function herTurn({ kind, ev = null, at = Date.now(), live = true, unreplied = false, note = '', retry = null }) {
  const toMoments = ev && ev.to === 'moments';
  if (live && !toMoments) setTyping(true);
  try {
    const o = await compose({ kind, ev, at, unreplied, note });

    for (const r of o.remember) { const s = r.slice(0, 80); if (!S.memory.includes(s)) S.memory.push(s); }
    if (S.memory.length > 80) S.memory = S.memory.slice(-80);
    for (const d of o.done) if ((d === 'study' || d === 'gym') && !todayChecks()[d]) checkin(d, Date.now());
    saveS(); saveST();

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
    if (o.patBack) items.push({ from: 'tip', who: 'her', kind: 'pat', text: `「${herName()}」拍了拍我` });
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
      if (live && it.from !== 'tip') { // 按字数估一个打字时间
        setTyping(true);
        const d = it.type === 'image' || it.type === 'gift' ? 1300 : it.type === 'voice' ? 900 + it.dur * 250 : Math.min(3200, Math.max(700, 450 + it.text.length * 85));
        await sleep(i === 0 ? Math.min(d, 1100) : d);
      }
      addMsg(Object.assign({ id: uid('m'), from: 'her', ts: live ? Date.now() : at + i * 20000 }, it));
    }
  } catch (e) {
    addSys((live ? `${TA()}的消息没收到：` : `${hm(at)} 那条消息没收到：`) + e.message, retry);
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
      if (kind === 'moment-comment') instruction = PROMPTS.momentComment({ ta, post: ctx.post, comment: ctx.comment });
      if (kind === 'my-moment') instruction = PROMPTS.myMoment({ ta, post: ctx.post, photo: ctx.photo });
      const o = parseReply(await callLLM(buildSystem(at), buildHistory(instruction, extra)));
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
