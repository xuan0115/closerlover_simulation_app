/*
 * 模板引擎：不接 AI 时，按场景或关键词从 js/data/templates.js 里挑台词。
 * 输出和 AI 回复同一个格式：{messages, photo, voice, gift, remember, done, noPhoto, patBack}
 */
'use strict';

function tplSlots(extra = {}) {
  return Object.assign({
    称呼: (S.her.callMe || '').trim() || myName() || '你',
    名字: myName() || (S.her.callMe || '').trim() || '你',
    她: herName(),
    星座: S.her.zodiac || '',
    我的星座: S.me.zodiac || '',
    时段: partOfDay()
  }, extra);
}
function fillLine(s, slots) { return s.replace(/\{([^{}]+)\}/g, (_, k) => slots[k] != null ? slots[k] : ''); }
const variantOk = (v, slots) => v.every(line => [...line.matchAll(/\{([^{}]+)\}/g)].every(m => String(slots[m[1]] || '').trim()));

/* 某个场景的所有说法：她的性格类型里有就用，没有用通用的 */
function tplVariants(key) {
  const own = (TEMPLATES[S.her.type] || {})[key];
  return (own && own.length ? own : TEMPLATES.common[key]) || [];
}

/* 挑一个说法；最近用过的尽量不用 */
function tplPick(key, extra) {
  const slots = tplSlots(extra);
  const all = tplVariants(key).map((v, i) => ({ v, i })).filter(x => variantOk(x.v, slots));
  if (!all.length) return key === 'fallback' ? ['嗯'] : tplPick('fallback', extra);
  const rk = (S.her.type || '') + ':' + key;
  const recent = ST.recent[rk] || [];
  const fresh = all.filter(x => !recent.includes(x.i));
  const choice = pick(fresh.length ? fresh : all);
  ST.recent[rk] = [...recent, choice.i].slice(-Math.max(1, Math.floor(all.length / 2)));
  saveST();
  return choice.v.map(line => fillLine(line, slots));
}
const tplOut = (messages, more = {}) => Object.assign({ messages, photo: null, voice: false, gift: null, remember: [], done: [] }, more);

/* 她主动发：scene 见 SCENES */
function tplScene(scene, { photo = false, unreplied = false } = {}) {
  const c = todayChecks();
  let key = scene;
  if (scene === 'gym' && c.gym) key = 'gymDone';
  if (scene === 'study' && c.study) key = 'studyDone';
  if (scene === 'night' && c.study && c.gym) key = 'nightGood';
  const messages = [];
  if (unreplied) messages.push(...tplPick('unreplied'));
  messages.push(...tplPick(key));
  if (scene === 'morning' && S.her.zodiac && ZODIAC[S.her.zodiac] && Math.random() < .2) messages.push(...pick(ZODIAC[S.her.zodiac].lines));
  const wantsPhoto = photo || scene === 'photo' || scene === 'moments';
  /* 学习和健身都打卡了，晚安时送你一个小礼物 */
  const gift = key === 'nightGood' ? '小星星' : null;
  return tplOut(messages, { photo: wantsPhoto ? { auto: true } : null, gift, noPhoto: 'photoNone' });
}

/* 你最近没被她回应的那几条（消息和你的动作） */
function pendingMine() {
  const out = [];
  for (let i = M.length - 1; i >= 0; i--) {
    const m = M[i];
    if (m.from === 'her' || (m.from === 'tip' && m.who === 'her')) break;
    if (m.from === 'me' || (m.from === 'tip' && m.who === 'me')) out.unshift(m);
  }
  return out;
}

/* 回你 */
function tplReply() {
  const mine = pendingMine();
  const text = mine.map(m => m.type === 'voice' ? (m.transcript || '') : (m.from === 'me' ? m.text || '' : '')).join('\n').trim();
  const rule = REPLY_RULES.find(r => r.match.test(text));
  const has = t => mine.some(m => m.type === t || m.kind === t);
  let key, extra = {};
  if (rule && rule.reply === 'crisis') key = 'crisis';
  else if (has('gift')) { key = 'gotGift'; extra = { 礼物: (mine.filter(m => m.type === 'gift').pop() || {}).name || '礼物' }; }
  else if (rule) key = rule.reply;
  else if (has('voice') && !text) key = 'gotVoice';
  else if (has('image') && !text) key = 'gotPhoto';
  else if (has('pat') && !text) key = 'pat';
  else if (has('recall') && !text) key = 'recall';
  else if (partOfDay() === '深夜') key = 'late';
  else if (/[?？]\s*$|吗\s*$|呢\s*$/.test(text)) key = 'question';
  else key = 'fallback';

  let messages;
  if (key === 'zodiac' && S.her.zodiac && ZODIAC[S.her.zodiac] && Math.random() < .5) messages = pick(ZODIAC[S.her.zodiac].lines).slice();
  else messages = tplPick(key, extra);
  return tplOut(messages, {
    photo: rule && rule.photo ? { auto: true } : null,
    done: rule && rule.done ? [rule.done] : [],
    noPhoto: 'noPhoto',
    patBack: key === 'pat' && Math.random() < .35
  });
}

/* 电话里：开场、回你说的话、冷场、挂断 */
function tplCall(kind, said) {
  if (kind === 'start') return tplPick(said ? 'callMe' : 'callHello');
  if (kind === 'idle') return tplPick('callIdle');
  if (kind === 'bye') return tplPick('callBye');
  const rule = REPLY_RULES.find(r => r.match.test(said || ''));
  return tplPick(rule ? rule.reply : (said ? 'fallback' : 'callIdle')).slice(0, 2);
}

/* 设置页里的「预览一句」 */
function tplPreview(scene = 'morning') { return tplScene(scene).messages; }
