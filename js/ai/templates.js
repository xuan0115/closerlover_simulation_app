/*
 * 模板引擎：不接 AI 时，按场景或关键词从 js/data/templates.js 里挑台词。
 * 输出和 AI 回复同一个格式：{messages, photo, voice, gift, remember, done, noPhoto, patBack}
 */
'use strict';

function tplSlots(extra = {}) {
  if (isEN()) return Object.assign({
    称呼: (S.her.callMeEn || '').trim() || myName() || 'you',
    名字: myName() || 'you',
    她: herName(),
    星座: zodiacName(S.her.zodiac || ''),
    我的星座: zodiacName(S.me.zodiac || ''),
    时段: PART_EN[partOfDay()] || 'day'
  }, extra);
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
  const friend = S.her.relType === 'friend', t = S.her.type;
  const layers = isEN()   // 英文模式先找英文的；挚友先看挚友的台词
    ? [friend && TEMPLATES_EN_FRIEND[t], friend && TEMPLATES_EN_FRIEND.common, TEMPLATES_EN[t], TEMPLATES_EN.common]
    : [friend && TEMPLATES_FRIEND[t], friend && TEMPLATES_FRIEND.common, TEMPLATES[t], TEMPLATES.common];
  for (const layer of layers) { const v = (layer || {})[key]; if (v && v.length) return v; }
  return [];
}
const replyRules = () => isEN() ? REPLY_RULES_EN : REPLY_RULES;

/* 挑一个说法；最近用过的尽量不用 */
function tplPick(key, extra) {
  const slots = tplSlots(extra);
  const all = tplVariants(key).map((v, i) => ({ v, i })).filter(x => variantOk(x.v, slots));
  if (!all.length) return key === 'fallback' ? [L('嗯', 'mm')] : tplPick('fallback', extra);
  const rk = (isEN() ? 'en' : '') + (S.her.relType || '') + (S.her.type || '') + ':' + key;
  const recent = ST.recent[rk] || [];
  const fresh = all.filter(x => !recent.includes(x.i));
  const choice = pick(fresh.length ? fresh : all);
  ST.recent[rk] = [...recent, choice.i].slice(-Math.max(1, Math.floor(all.length / 2)));
  saveST();
  return choice.v.map(line => fillLine(line, slots));
}
const tplOut = (messages, more = {}) => Object.assign({ messages, photo: null, voice: false, gift: null, remember: [], done: [] }, more);

/* 她主动发：scene 见 SCENES */
function tplScene(scene, { photo = false, unreplied = false, task = null, alarm = null } = {}) {
  const c = todayChecks(), today = tasksOn();
  let key = scene, extra = {};
  if (scene === 'task' && task) { key = c[task.id] ? 'taskDone' : 'taskRemind'; extra = { 事项: taskLabel(task) }; }
  if (scene === 'alarm' && alarm) { key = 'alarmRemind'; extra = { 内容: alarm.label || '闹钟' }; }
  if (scene === 'night' && today.length && today.every(t => c[t.id])) key = 'nightGood';
  const messages = [];
  if (unreplied) messages.push(...tplPick('unreplied'));
  messages.push(...tplPick(key, extra));
  if (scene === 'morning' && !isEN() && S.her.zodiac && ZODIAC[S.her.zodiac] && Math.random() < .2) messages.push(...pick(ZODIAC[S.her.zodiac].lines));
  const wantsPhoto = photo || scene === 'photo' || scene === 'moments';
  /* 今天督促清单上的事都打卡了，晚安时送你一个小礼物 */
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
/* 你最近没被回应的那几条消息的文字 */
const pendingText = () => pendingMine().map(m => m.type === 'voice' ? (m.transcript || '') : (m.from === 'me' ? m.text || '' : '')).join('\n').trim();
/* 隔了好一阵才回你时，先说的那句「刚在……」用哪组台词 */
const TPL_BACK = { busy: 'backBusy', run: 'backRun', sleep: 'backSleep' };

function tplReply() {
  const mine = pendingMine();
  const text = pendingText();
  let rule = replyRules().find(r => r.match.test(text));
  /* 说到督促清单里某一项的名字或关键词：回应一下，并自动打卡 */
  const task = !(rule && rule.reply === 'crisis') && text && S.tasks.find(t => taskWords(t).some(w => text.includes(w)));
  if (task) rule = { reply: 'taskAck', done: task.id };
  const has = t => mine.some(m => m.type === t || m.kind === t);
  let key, extra = task ? { 事项: taskLabel(task) } : {};
  if (rule && rule.reply === 'crisis') key = 'crisis';
  else if (has('gift')) { key = 'gotGift'; extra = { 礼物: giftName((mine.filter(m => m.type === 'gift').pop() || {}).name) || L('礼物', 'gift') }; }
  else if (rule) key = rule.reply;
  else if (has('voice') && !text) key = 'gotVoice';
  else if (has('image') && !text) key = 'gotPhoto';
  else if (has('pat') && !text) key = 'pat';
  else if (has('recall') && !text) key = 'recall';
  else if (partOfDay() === '深夜') key = 'late';
  else if (/[?？]\s*$|吗\s*$|呢\s*$/.test(text)) key = 'question';
  else key = 'fallback';

  let messages;
  if (key === 'zodiac' && !isEN() && S.her.zodiac && ZODIAC[S.her.zodiac] && Math.random() < .5) messages = pick(ZODIAC[S.her.zodiac].lines).slice();
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
  const rule = replyRules().find(r => r.match.test(said || ''));
  return tplPick(rule ? rule.reply : (said ? 'fallback' : 'callIdle')).slice(0, 2);
}

/* 设置页里的「预览一句」 */
function tplPreview(scene = 'morning') { return tplScene(scene, scene === 'task' ? { task: S.tasks[0] || { id: '_', name: '阅读' } } : {}).messages; }
