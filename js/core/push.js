/*
 * 锁屏通知（网页推送 Web Push）：网页关着时，她也能按时找你、回你，消息弹到手机锁屏上。
 *
 *   开启：设置 → 通知 → 「关掉网页也能收到消息」。iPhone 要先把知己「添加到主屏幕」，从主屏幕打开才能开。
 *   网页开着：每分钟告诉服务器「我在前台」，她的消息照旧由网页自己发；改了东西过几秒把最新的计划传上去。
 *   网页切走：把「接下来 36 小时她什么时候找你、你刚发的消息她什么时候回」连同设定、最近聊天传给服务器
 *            （push_plans 表）。服务器每分钟看一次，到点就替她写好、推到锁屏（supabase/push-tick.ts）。
 *   再打开：先取回服务器替她发的消息（push_inbox 表），放进聊天里，再照旧补发剩下错过的。
 * 云端要先做的设置见 supabase/push-setup.sql。
 */
'use strict';

const PUSH_FN = SUPABASE_URL + '/functions/v1/push-tick';
const PUSH_HORIZON = 36 * 3600e3;        // 提前算好多久的
const PUSH_MIN_GAP = 15e3;               // 网页开着时，最快多久传一次计划
const PUSH = {
  on: !!LS.get('pushOn', false),
  pulled: !LS.get('pushOn', false),      // 开着锁屏通知时，打开网页后要先取回服务器发的，才轮到网页自己补发
  timer: null, beat: null, sentAt: 0, dirty: true, busy: null, openChat: false
};

if (!sb) PUSH.pulled = true;   // 账号服务没加载：只能网页自己发

const isStandalone = () => !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true);
/* ok / need-home（iPhone 还没添加到主屏幕）/ no（浏览器不支持）/ no-cloud（没连上账号服务） */
function pushSupport() {
  if (!sb || location.protocol === 'file:') return 'no-cloud';
  if (isIOS() && !isStandalone()) return 'need-home';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ok' : 'no';
}
/* 网页自己先别发：锁屏通知开着，并且网页在后台（交给服务器），或刚打开还没把服务器发的取回来 */
const pushHold = () => PUSH.on && (!PUSH.pulled || (document.hidden && !!currentUser));

const b64uBytes = s => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
const isoIn = ms => new Date(Date.now() + ms).toISOString();

/* ---------- 服务器到点要说的话：提前算好 ---------- */
function buildPushPlan(now = Date.now()) {
  const ta = pron(), items = [];
  const recent = JSON.stringify(ST.recent || {});   // 先挑好的模板台词不算「用过」
  try {
    if (ST.started && !S.notify.airplane) {
      if (ST.pending) {   // 你发了消息、她还没回
        const p = ST.pending, waited = p.due - p.since, text = pendingText();
        const crisis = [...REPLY_RULES, ...REPLY_RULES_EN].some(r => r.reply === 'crisis' && r.match.test(text));
        const count = crisis ? 0 : drawCount(text);
        const note = [waited > 2 * 60e3 ? PROMPTS.waited({ ta, gap: ago(waited), doing: STATUS_WORDS[p.status] }) : '', count ? PROMPTS.count(count) : ''].filter(Boolean).join('\n');
        const t = templateFor({ kind: 'reply' });
        const back = waited > 3 * 60e3 && TPL_BACK[p.status] ? tplPick(TPL_BACK[p.status]) : [];
        items.push({ key: 'reply@' + p.since, kind: 'reply', at: Math.max(p.due, now), now: nowSection(p.due, note), count, tpl: [...back, ...t.messages], tplDone: t.done || [] });
      }
      for (const { ev, t } of dueBetween(now, now + PUSH_HORIZON)) {   // 她自己找你的
        if (ev.to === 'moments' || (ev.to === 'call' && FEATURES.voice)) continue;   // 发朋友圈、打电话：等打开网页再说
        const count = drawCount('');
        items.push({
          key: firedKey(ev, t), kind: 'event', at: t, now: nowSection(t, PROMPTS.count(count)), count, exempt: !!ev.alarm,
          instruction: PROMPTS.event({ time: fmtFull(t), prompt: ev.prompt || '', photo: false, note: '' }),
          tpl: templateFor({ kind: 'event', ev, unreplied: false }).messages
        });
        if (items.length >= 40) break;
      }
    }
  } finally { ST.recent = JSON.parse(recent); saveST(); }
  let last = null;
  for (let i = M.length - 1; i >= 0 && !last; i--) if (M[i].from === 'me' || M[i].from === 'her') last = M[i];
  const ai = usesAI() && S.api.provider === 'builtin';   // 用自己的 Key 时，服务器拿不到 Key：用模板
  return {
    v: 1, at: now, title: wxName(), ta, mode: ai ? 'ai' : 'tpl', fallback: S.reply.fallback !== false,
    base: ai ? buildSystem(now, '', { nowSlot: true, noPhoto: true }) : '', history: ai ? histCore() : [],
    items, pro: proTurns(), lastFrom: last ? last.from : '', lastTs: last ? last.ts : 0,
    unread: unreadList().length, quiet: !!(S.zx.mute || S.notify.focus), off: !!S.notify.airplane,
    gifts: giftsFor().map(g => g.name), carryOn: PROMPTS.carryOn
  };
}

/* ---------- 上传计划 ---------- */
async function restUpsert(table, row, keepalive) {
  const tok = await cloudToken();
  if (!tok) return false;
  const body = JSON.stringify(row);
  const req = ka => fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=user_id`, {
    method: 'POST', keepalive: ka, body,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  let r;
  try { r = await req(keepalive && body.length < 60000); } catch (e) { r = await req(false); }   // keepalive 有大小限制
  return r.ok;
}
async function pushUpload({ hidden = false } = {}) {
  if (!PUSH.on || !sb || !currentUser || !PUSH.pulled || !cloudReady) return;
  clearTimeout(PUSH.timer); PUSH.timer = null; PUSH.dirty = false;
  const row = {
    user_id: currentUser.id, plan: buildPushPlan(), updated_at: new Date().toISOString(),
    active_until: isoIn(hidden || document.hidden ? 0 : 150e3), sent_pro: 0, last_sent_at: null, done: []
  };
  PUSH.sentAt = Date.now();
  let ok = false;
  try { ok = await restUpsert('push_plans', row, hidden); } catch (e) { console.warn('锁屏通知：计划没传上去', e); }
  if (!ok) PUSH.dirty = true;
}
/* 有改动：过一会儿传（网页开着时最快 15 秒一次；urgent = 你刚发了消息，尽快） */
function pushDirty(urgent) {
  if (!PUSH.on) return;
  PUSH.dirty = true;
  if (document.hidden || !PUSH.pulled) return;
  const wait = Math.max(urgent ? 1500 : 3000, PUSH_MIN_GAP - (Date.now() - PUSH.sentAt));
  clearTimeout(PUSH.timer);
  PUSH.timer = setTimeout(() => pushUpload(), urgent ? Math.min(wait, 3000) : wait);
}
async function setActive(ms) {
  if (!sb || !currentUser) return;
  await sb.from('push_plans').update({ active_until: isoIn(ms) }).eq('user_id', currentUser.id);
}

/* ---------- 取回网页关着时她发的消息 ---------- */
function applyInbox(r) {
  const o = r.data || {}, msgs = (o.messages || []).map(String).filter(Boolean);
  if (r.kind === 'reply') {
    if (!ST.pending || 'reply@' + ST.pending.since !== r.key) return;   // 网页自己已经回过了
    delete ST.pending; armReply();
  } else {
    if (ST.fired[r.key]) return;
    ST.fired[r.key] = 1;
  }
  absorbTurn(o);
  const pro = r.kind === 'event' ? r.key : '';
  msgs.forEach((text, i) => addMsg(Object.assign({ id: uid('m'), from: 'her', type: 'text', text, ts: r.ts + i * 3000 }, pro ? { pro } : {})));
  const g = o.gift && GIFTS.find(x => x.name === o.gift);
  if (g) addMsg(Object.assign({ id: uid('m'), from: 'her', type: 'gift', name: g.name, emoji: g.emoji, note: '', ts: r.ts + msgs.length * 3000 }, pro ? { pro } : {}));
}
async function pushPull() {
  if (!sb || !currentUser) return 0;
  const me = currentUser.id;
  const [inbox, plan] = await Promise.all([
    sb.from('push_inbox').select('id, key, kind, ts, data').eq('user_id', me).eq('state', 'ready').order('ts'),
    sb.from('push_plans').select('done').eq('user_id', me).maybeSingle()]);
  if (inbox.error) throw inbox.error;
  const rows = inbox.data || [];
  for (const r of rows) applyInbox(r);
  for (const k of (plan.data && plan.data.done) || []) if (!String(k).startsWith('reply@')) ST.fired[k] = 1;   // 你没回、服务器就没发的那几次
  saveST();
  if (rows.length) await sb.from('push_inbox').delete().in('id', rows.map(r => r.id));
  return rows.length;
}

/* ---------- 网页切走 / 回来 ---------- */
function pushOnHidden() {
  if (!PUSH.on || !sb || !currentUser) return;
  stopBeat();
  if (PUSH.pulled) pushUpload({ hidden: true });   // 最新的计划，同时告诉服务器「网页不在前台了」
  PUSH.pulled = false;                             // 从现在起服务器可能替她发，下次回来先取回
}
function pushOnVisible() {
  if (!PUSH.on || !sb || !currentUser) { PUSH.pulled = true; return Promise.resolve(); }
  if (PUSH.busy) return PUSH.busy;
  PUSH.busy = (async () => {
    try { await setActive(150e3); await pushPull(); }
    catch (e) { console.warn('锁屏通知：取回消息失败', e); }
    finally { PUSH.pulled = true; PUSH.busy = null; startBeat(); pushDirty(); updateBadges(); }
  })();
  return PUSH.busy;
}
function startBeat() {
  stopBeat();
  if (!PUSH.on) return;
  PUSH.beat = setInterval(() => {
    if (document.hidden || !currentUser || !PUSH.pulled) return;
    if (PUSH.dirty || Date.now() - PUSH.sentAt > 30 * 60e3) pushUpload(); else setActive(150e3).catch(() => {});
    pushPull().catch(() => {});
  }, 60e3);
}
function stopBeat() { clearInterval(PUSH.beat); PUSH.beat = null; }

/* 登录同步做完以后（js/core/cloud.js 调用）：取回服务器发的，再让网页补发剩下的 */
async function pushAfterSync() {
  if (PUSH.on && currentUser && 'serviceWorker' in navigator) {   // 这台手机的订阅还在不在
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (!sub || Notification.permission !== 'granted') { PUSH.on = false; LS.set('pushOn', false); }
    } catch (e) {}
  }
  if (document.hidden) { PUSH.pulled = true; pushOnHidden(); return; }
  await pushOnVisible();
  tick();
  if (PUSH.openChat) { PUSH.openChat = false; pushOpenChat(); }
}

/* ---------- 开 / 关 ---------- */
async function pushEnable() {
  const sup = pushSupport();
  if (sup === 'need-home') { pushHowSheet(); return false; }
  if (sup !== 'ok') { toast('这个浏览器收不了锁屏通知'); return false; }
  if (!currentUser) { toast('先登录知己账号（设置 → chatwe聊我 → 数据与备份）'); return false; }
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();   // 要在点按钮的那一下里问
  if (perm !== 'granted') {
    toast(perm === 'denied' ? '通知被关掉了：到手机的「设置 → 通知 → 知己」里打开，再回来开' : '没有允许通知', 6000);
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const r = await fetch(PUSH_FN + '?pk', { headers: { apikey: SUPABASE_KEY } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.publicKey) throw new Error((j.error && j.error.message) || `服务器没准备好（${r.status}），先按 supabase/push-setup.sql 设置`);
    const key = b64uBytes(j.publicKey);
    let sub = await reg.pushManager.getSubscription();
    const cur = sub && sub.options && sub.options.applicationServerKey && new Uint8Array(sub.options.applicationServerKey);
    if (sub && !(cur && cur.length === key.length && cur.every((b, i) => b === key[i]))) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const s = sub.toJSON();
    const { error } = await sb.from('push_subs').upsert({ user_id: currentUser.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, ua: navigator.userAgent.slice(0, 160) }, { onConflict: 'endpoint' });
    if (error) throw new Error(error.message);
    PUSH.on = true; PUSH.pulled = true; LS.set('pushOn', true);
    await pushUpload();
    startBeat();
    toast('开好了：网页关着时，她的消息也会弹到锁屏上');
    return true;
  } catch (e) {
    toast('没开成：' + (e.message || e), 7000);
    return false;
  }
}
async function pushDisable() {
  stopBeat(); clearTimeout(PUSH.timer);
  PUSH.on = false; PUSH.pulled = true; LS.set('pushOn', false);
  try {
    const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      const ep = sub.endpoint;
      await sub.unsubscribe();
      if (sb && currentUser) await sb.from('push_subs').delete().eq('endpoint', ep);
    }
    if (sb && currentUser) {   // 别的手机也都没开了：服务器就不用再替她发
      const { count } = await sb.from('push_subs').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id);
      if (!count) await sb.from('push_plans').delete().eq('user_id', currentUser.id);
    }
  } catch (e) { console.warn('锁屏通知：关闭时出错', e); }
  return true;
}
/* 退出登录前：这台手机不再收这个账号的通知 */
async function pushSignOut() { if (PUSH.on) await pushDisable(); }

async function pushTest() {
  const tok = await cloudToken();
  const r = await fetch(PUSH_FN, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{"test":true}' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || '服务器返回 ' + r.status);
  toast(j.sent ? '发出去了：回到主屏幕或锁屏看看' : '没找到开了通知的手机，把开关关掉再打开试试', 5000);
}

/* ---------- 点通知打开：直接进聊天 ---------- */
function pushOpenChat() {
  if (!ST.started || sheetLock) return;
  show('home'); openApp('wx'); openThread(true);
}
if (new URLSearchParams(location.search).get('open') === 'chat') {
  PUSH.openChat = true;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker 没注册上', e));
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'open-chat') pushOpenChat(); });
}
setTimeout(() => { if (!PUSH.pulled) { PUSH.pulled = true; tick(); } }, 15000);   // 万一账号服务一直连不上：别让她一直不说话

/* ---------- 设置 → 通知 ---------- */
function pushHowSheet() {
  openSheet((p, close) => p.append(
    el('div', { class: 'sheet-title' }, '在 iPhone 上开启锁屏通知'),
    el('ol', { class: 'steps' },
      el('li', {}, '用 Safari 打开知己（就是现在这个网址）。'),
      el('li', {}, '点「分享」按钮（方框加向上的箭头；新版 iOS 在地址栏旁边的「…」里）。'),
      el('li', {}, '往下找到「添加到主屏幕」。如果看到「作为网页 App 打开」，保持打开，再点「添加」。'),
      el('li', {}, '回到主屏幕，点新出现的「知己」图标打开，登录你的账号。主屏幕上的知己和 Safari 里的是分开存的，登录后选「用云端的」。'),
      el('li', {}, '到「设置 → 通知」打开「关掉网页也能收到消息」，在弹出的窗口里点「允许」。')),
    el('p', { class: 'sub' }, '需要 iOS 16.4 或更新的系统。声音和震动在 iPhone 的「设置 → 通知 → 知己」里调。'),
    el('div', { class: 'btnrow' }, el('button', { class: 'btn primary', onclick: close }, '知道了'))));
}
function pushSettingsGroup(re) {
  const T = '锁屏通知', sup = pushSupport();
  if (sup === 'no-cloud') return el('span');
  if (sup === 'need-home') return iosGroup(T, [iosLink({ label: '怎么开启', onclick: pushHowSheet })],
    `iPhone 上要先把知己「添加到主屏幕」，从主屏幕打开才能开启。开启后网页关着，${herName()}的消息也会弹到锁屏上。`);
  if (sup === 'no') return iosGroup(T, [el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '这个浏览器收不了'))],
    '可以用 iPhone 的 Safari（先添加到主屏幕），或者电脑上的 Safari、Chrome。');
  if (!currentUser) return iosGroup(T, [el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '先登录账号'))], '登录知己账号以后才能开：设置 → chatwe聊我 → 数据与备份。');
  const on = PUSH.on && Notification.permission === 'granted';
  const c = el('input', { type: 'checkbox', class: 'sw', 'aria-label': '关掉网页也能收到消息' }); c.checked = on;
  c.addEventListener('change', async () => {
    c.disabled = true;
    const ok = c.checked ? await pushEnable() : await pushDisable();
    c.disabled = false;
    if (!ok) c.checked = !c.checked;
    re();
  });
  const rows = [el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, '关掉网页也能收到消息'), c)];
  if (on) rows.push(iosLink({ label: '发一条测试通知', chevron: false, cls: 'blue', onclick: () => pushTest().catch(e => toast('没发出去：' + e.message, 6000)) }));
  const own = usesAI() && S.api.provider !== 'builtin' ? `你用的是自己的 Key，服务器拿不到：网页关着的这段时间，${TA()}用固定模板说话。` : '';
  return iosGroup(T, rows, on
    ? `开着：网页关掉以后，${herName()}按作息找你、回你的消息，会像别的聊天软件一样弹到锁屏上，图标上有红色数字。${TA()}连着找你 3 次你都没回，就不再追发。每台手机要分别开启。${own}`
    : `打开后，网页关着${herName()}也能找你、回你，消息弹到锁屏上。${own}`);
}
