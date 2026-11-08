/*
 * 账号与云同步（Supabase）。账号页、第一次打开的「你好」、登录注册的界面在 js/ui/account.js。
 *
 * 登录是怎么保持的：登录后 Supabase 在这台手机里存两样东西 —— 短期通行证（1 小时）和换新通行证用的长期钥匙。
 * 隔一阵再打开，要先联网用钥匙换一张新通行证。
 *   钥匙还在 → 当作已登录，马上就能用；换通行证、同步存档都在后台做。连不上（网络慢、服务器在国外）就照常用，
 *              记录先存在手机里，连上了再悄悄同步。
 *   钥匙被服务器作废了（很少见）→ 设置最上面的「知己账户」出现红点，点进去重新登录。不会在聊天中途弹登录框。
 *   这台手机从没登录过 → 第一次打开时，在解锁前的「你好」页面登录或注册。
 *
 * 账号用邮箱：注册时给邮箱发一个验证码确认，之后用邮箱和密码登录；忘记密码也用验证码重设。
 * 以前只起了账号名的老账号，账号会拼成 账号@zhiji.app（这个域名不是我们的，收不到信），
 * 登录照样能用，在「知己账户 → 邮箱」里换成真实邮箱。
 *
 * 同步：改了设定、聊天、朋友圈……停 3 秒上传一份完整存档（不带 API Key；照片存在 IndexedDB 里，不上传）。
 * 打开时先只问云端那份的时间，比这台手机上的新才下载。
 *
 * 云端要先做好的设置（RLS、内置 AI 中转、发邮件）见 supabase/ 文件夹里的说明。
 */
'use strict';

const SUPABASE_URL = 'https://pqrrculvjdirycyafqht.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vcQqBuX7tOgiRlKW9oKsxA_aAzzXa_V';   // 公开钥匙：本来就放在网页里，靠 RLS 保护数据
const ACCOUNT_DOMAIN = 'zhiji.app';   // 只给老账号用（账号名 → 账号@zhiji.app）；新注册必须用真实邮箱

let sb = null;
try { if (window.supabase && SUPABASE_URL.startsWith('http')) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
catch (e) { console.warn('Supabase 初始化失败', e); }

let currentUser = null;
let cloudTimer = null;
let cloudReady = false;      // 和云端对过一次之前不上传，免得把还没合并的数据传上去

/*
 * 云端状态：
 *   none       这台手机没登录（从没登录过，或者自己退出了）
 *   connecting 有登录，正在连云端
 *   ok         已同步
 *   offline    有登录，暂时连不上；照常用，过一会儿再试
 *   relogin    登录过期了，要重新登录（这台手机上的记录都还在）
 */
const CLOUD = { state: 'none', syncedAt: Number(LS.get('cloudSyncedAt', 0)) || 0, connecting: null, retryT: null, afterSync: false, signingOut: false };
function setCloud(st) {
  if (CLOUD.state === st) return;
  CLOUD.state = st;
  if (typeof onCloudChange === 'function') onCloudChange();   // js/ui/account.js：刷新设置里的账户卡片和红点
}
const cloudNeedsLogin = () => CLOUD.state === 'relogin';

const isLegacyEmail = e => String(e || '').toLowerCase().endsWith('@' + ACCOUNT_DOMAIN);
const accountToEmail = a => { a = String(a || '').trim().toLowerCase(); return a.includes('@') ? a : `${a}@${ACCOUNT_DOMAIN}`; };
const accountName = u => { const e = (u && u.email) || ''; return isLegacyEmail(e) ? e.slice(0, -ACCOUNT_DOMAIN.length - 1) : e; };
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()) && !isLegacyEmail(e);

/* 这台手机上记着的登录（钥匙还在不在） */
function storedSession() {
  try {
    const k = (sb && sb.auth && sb.auth.storageKey) || 'sb-pqrrculvjdirycyafqht-auth-token';
    const s = JSON.parse(localStorage.getItem(k) || 'null');
    if (!s || !s.refresh_token) return null;
    const u = s.user || ((JSON.parse(localStorage.getItem(k + '-user') || 'null') || {}).user);
    return u && u.id ? { user: u } : null;
  } catch (e) { return null; }
}
/* 记住这台手机登录的是哪个账户：登录过期时还能显示是谁、提示重新登录 */
function rememberAcct(u) { if (u) LS.set('acct', { id: u.id, email: u.email || '' }); }
const rememberedAcct = () => LS.get('acct', null);

async function cloudToken() {
  if (!sb) return '';
  try { const { data } = await sb.auth.getSession(); return (data.session && data.session.access_token) || ''; } catch (e) { return ''; }
}

/* 本机数据改动了：记下时间，3 秒后上传（store.js 的 saveS / saveM … 会调用） */
function cloudDirty() {
  LS.set('cloudLocalAt', Date.now());
  if (!sb || !currentUser || !cloudReady) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => pushCloud(true), 3000);
}

/* 打包上传：不带 API Key */
function cloudPayload() {
  const s = clone(S);
  s.api.key = ''; s.photo.key = '';
  return { app: 'zhiji', v: 1, at: Number(LS.get('cloudLocalAt', 0)) || Date.now(), settings: s, msgs: M, posts: POSTS, state: ST, pool: POOL, notes: NOTES, favs: FAVS };
}
function markSynced() { CLOUD.syncedAt = Date.now(); LS.set('cloudSyncedAt', CLOUD.syncedAt); if (typeof onCloudChange === 'function') onCloudChange(); }
/* force：登录时的首次合并才用。平时（自动上传、手动备份）只往「这台手机上的数据所属的账号」里传 */
async function pushCloud(silent = false, force = false) {
  if (!sb || !currentUser) return false;
  if (!force && (!cloudReady || LS.get('cloudUser', '') !== currentUser.id)) return false;
  clearTimeout(cloudTimer); cloudTimer = null;
  const payload = cloudPayload();
  let error = null;
  try {
    ({ error } = await sb.from('user_backups').upsert(
      { user_id: currentUser.id, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
  } catch (e) { error = e; }
  if (error) {
    if (!silent) toast('现在连不上云端，记录先存在这台手机上，连上后会自动同步', 4000);
    if (!force) cloudOffline();          // 平时传不上去：当作暂时连不上，过一会儿重新对一遍
    return false;
  }
  LS.set('cloudUser', currentUser.id);
  markSynced();
  if (!silent) toast('已同步到云端');
  return true;
}
/* 云端那份的时间（不下载内容） */
async function fetchCloudMeta() {
  const { data, error } = await sb.from('user_backups').select('at:data->at').eq('user_id', currentUser.id).maybeSingle();
  if (error) throw error;
  return data ? { at: Number(data.at != null ? data.at : data.data && data.data.at) || 0 } : null;
}
async function fetchCloud() {
  const { data, error } = await sb.from('user_backups').select('data, updated_at').eq('user_id', currentUser.id).maybeSingle();
  if (error) throw error;
  return data && data.data && data.data.settings ? data.data : null;
}
/* 用云端覆盖之前：这台手机上有云端那份没有的聊天，先存一份到本机（IndexedDB，最多留 3 份），
 * 在「数据与备份」里能找回。云端那份已经包含这台手机的全部聊天时不用存。 */
async function backupBeforeOverwrite(d) {
  try {
    const ids = new Set(((d && d.msgs) || []).map(m => m.id));
    const lost = M.filter(m => (m.from === 'me' || m.from === 'her') && !ids.has(m.id)).length;
    if (!lost) return;
    const at = Date.now(), snap = cloudPayload();
    snap.at = at;
    await IDB.put('bk:' + at, snap);
    const old = LS.get('backups', []);
    LS.set('backups', [{ at, lost, total: M.length }, ...old].slice(0, 3));
    for (const b of old.slice(2)) IDB.del('bk:' + b.at).catch(() => {});
  } catch (e) { console.warn('覆盖前的本机备份没存上', e); }
}
/* 用云端存档替换这台手机上的数据（API Key 用本机的） */
async function applyCloud(d) {
  await backupBeforeOverwrite(d);
  d = clone(d);
  const keys = { a: S.api.key, p: S.photo.key };
  S = migrate(d.settings, merge(DEFAULTS, d.settings || {}));
  if (keys.a) S.api.key = keys.a;
  if (keys.p) S.photo.key = keys.p;
  M = Array.isArray(d.msgs) ? d.msgs : [];
  POSTS = (Array.isArray(d.posts) ? d.posts : []).map(p => Object.assign({ author: 'her', comments: [], likes: { me: !!p.liked } }, p));
  POOL = Array.isArray(d.pool) ? d.pool : [];
  NOTES = Array.isArray(d.notes) ? d.notes : [];
  FAVS = Array.isArray(d.favs) ? d.favs : [];
  const resume = ST.resume;                                           // 解锁后回到哪：按这台手机上的
  ST = Object.assign(freshState(), d.state || {});
  ST.lastTick = Date.now(); delete ST.pending;
  if (resume) ST.resume = resume; else delete ST.resume;
  LS.set('settings', S); LS.set('msgs', M); LS.set('posts', POSTS); LS.set('state', ST);
  LS.set('pool', POOL); LS.set('notes', NOTES); LS.set('favs', FAVS);
  LS.set('cloudLocalAt', d.at || Date.now()); if (currentUser) LS.set('cloudUser', currentUser.id);
  const was = { app: cur, chat: cur === 'wx' && typeof threadVisible === 'function' && threadVisible() };
  for (const k of Object.keys(Nav.stacks)) delete Nav.stacks[k];   // 各个 App 的页面按新数据重画
  WXT = null;
  syncStatusIcons();
  if (was.app === 'lock') show('lock');
  else {                                                              // 打开着某个 App 时：按新数据重画，还停在原来的地方
    show('home');
    if (was.app !== 'home' && was.app !== 'camera' && APPS[was.app]) { openApp(was.app, null, true); if (was.chat) openThread(true); }
  }
  updateBadges();
}

/* 登录后、打开时：云端和本机比一比，用新的那份；拿不准时问你。
 * 返回 true = 对上了；连不上就当作暂时离线，过一会儿再试（这时不上传，免得用旧的盖掉别的手机上新的） */
async function syncOnLogin({ fresh = false } = {}) {
  cloudReady = false; clearTimeout(cloudTimer); cloudTimer = null;
  setCloud('connecting');
  let ok = false;
  try {
    if (fresh) { ok = await pushCloud(true, true); return ok; }        // 刚注册：把这台手机上的当作初始存档
    const localAt = Number(LS.get('cloudLocalAt', 0)) || 0;
    const sameOwner = LS.get('cloudUser', '') === currentUser.id;
    const hasLocal = M.some(m => m.from === 'me' || m.from === 'her');
    const meta = await fetchCloudMeta();
    if (!meta) { ok = await pushCloud(true, true); return ok; }        // 云端还没有：上传本机
    if (sameOwner && meta.at <= localAt) {                               // 这台手机上的不比云端旧：不用下载
      ok = meta.at < localAt ? await pushCloud(true, true) : true;
      return ok;
    }
    const d = await fetchCloud();
    if (!d) { ok = await pushCloud(true, true); return ok; }
    if (sameOwner || !hasLocal) { await applyCloud(d); if (!sameOwner) toast('已从云端恢复存档'); ok = true; return ok; }
    const useCloud = await chooseSheet('用哪一份记录？',
      `这台手机上有聊天记录，你的账户在云端也有一份存档（${fmtFull(d.at || Date.now())}）。用云端的，这台手机上的会被替换（替换前自动在本机备份一份，在「数据与备份」里能找回）；用这台手机的，云端那份会被覆盖。`,
      '用这台手机的', '用云端的');
    if (useCloud) { await applyCloud(d); toast('已从云端恢复存档'); ok = true; } else ok = await pushCloud(false, true);
    return ok;
  } catch (e) {
    console.warn('同步云端存档没成功，过一会儿再试', e);
    ok = false; return ok;
  } finally {
    if (ok) { cloudReady = true; LS.set('cloudUser', currentUser.id); markSynced(); setCloud('ok'); }
    else if (currentUser) cloudOffline();
    afterSync();
  }
}
/* 同步做完（或连不上）以后：锁屏通知取回网页关着时她发的消息（js/core/push.js）。连上了每次都取，没连上只取一次 */
function afterSync() {
  if (cloudReady || !CLOUD.afterSync) { CLOUD.afterSync = true; if (typeof pushAfterSync === 'function') pushAfterSync(); }
}

/* ---------- 连云端：换通行证 + 同步 ---------- */
/* again：网络刚回来、网页刚切回来、点了「立即同步」—— 不等 supabase-js 的 1 分钟冷却，马上再换一次通行证 */
function cloudConnect(again = false) {
  if (!sb || !storedSession()) return Promise.resolve(false);
  if (CLOUD.connecting) return CLOUD.connecting;
  clearTimeout(CLOUD.retryT);
  if (again) try { sb.auth.lastRefreshFailure = null; } catch (e) {}
  return CLOUD.connecting = (async () => {
    setCloud('connecting');
    let res = null;
    try { res = await sb.auth.getSession(); } catch (e) {}
    const s = res && res.data && res.data.session;
    if (s && s.user) { currentUser = s.user; rememberAcct(s.user); return await syncOnLogin(); }
    if (storedSession()) { cloudOffline(); return false; }   // 钥匙还在：只是网络不通，照常用
    lostSession(); return false;                              // 钥匙被服务器作废了
  })().finally(() => { CLOUD.connecting = null; });
}
function cloudOffline() {
  cloudReady = false;
  setCloud('offline');
  afterSync();
  clearTimeout(CLOUD.retryT);
  CLOUD.retryT = setTimeout(() => { if (CLOUD.state === 'offline') { if (document.hidden) cloudOffline(); else cloudConnect(true); } }, 65e3);
}
/* 登录失效了：记录都留在这台手机上，等你在「知己账户」里重新登录 */
function lostSession() {
  currentUser = null; cloudReady = false; clearTimeout(cloudTimer); cloudTimer = null; clearTimeout(CLOUD.retryT);
  setCloud(rememberedAcct() ? 'relogin' : 'none');
  afterSync();
}

/* ---------- 开机 ---------- */
async function cloudStart() {
  if (!sb) return;                       // 没配置或脚本没加载：照常离线使用
  sb.auth.onAuthStateChange((ev, s) => {
    if (s && s.user) { currentUser = s.user; return; }
    if (ev === 'SIGNED_OUT' && !CLOUD.signingOut && currentUser) lostSession();   // 后台换通行证时钥匙被作废了
  });
  const st = storedSession();
  if (st) { currentUser = st.user; rememberAcct(st.user); cloudConnect(); }        // 有登录：马上能用，同步在后台做
  else if (rememberedAcct()) lostSession();
  else { setCloud('none'); afterSync(); if (!LS.get('welcomed', false) && typeof showWelcome === 'function') setTimeout(showWelcome, 50); }   // 只有第一次：自己退出登录的，下次打开不再显示「你好」
  addEventListener('online', () => { if (CLOUD.state === 'offline') cloudConnect(true); });
  /* 切走、关网页时，把还没上传的改动赶紧传上去；回来时连不上的再试一次 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (cloudTimer) pushCloud(true); }
    else if (CLOUD.state === 'offline') cloudConnect(true);
  });
}

/* ---------- 登录 / 注册 / 验证码（界面在 js/ui/account.js） ---------- */
/* 把 Supabase 的英文报错翻成一句人话 */
function authMsg(e) {
  const m = String((e && (e.message || e)) || ''), c = (e && e.code) || '';
  if (c === 'invalid_credentials' || /Invalid login credentials/i.test(m)) return '邮箱或密码不对';
  if (c === 'email_not_confirmed' || /Email not confirmed/i.test(m)) return '这个邮箱还没验证';
  if (c === 'user_already_exists' || c === 'email_exists' || /already (been )?registered|already exists/i.test(m)) return '这个邮箱已经注册过了，直接登录就行';
  if (c === 'otp_expired' || /Token has expired or is invalid|otp/i.test(m)) return '验证码不对，或者已经过期了';
  if (c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit' || /rate limit|only request this after|security purposes/i.test(m)) return '发得太频繁了，等一分钟再试';
  if (c === 'weak_password' || /Password should be/i.test(m)) return '密码至少 6 位';
  if (c === 'same_password' || /should be different/i.test(m)) return '新密码不能和原来的一样';
  if (c === 'email_address_invalid' || c === 'validation_failed' || /invalid format|is invalid/i.test(m)) return '邮箱格式不对';
  if (/fetch|network|Failed|Load failed|NetworkError|timed out/i.test(m) || (e && e.name === 'AuthRetryableFetchError')) return '连不上服务器，检查一下网络';
  return '没成功：' + m;
}
const AUTH_OFFLINE = '连不上服务器，检查一下网络';
async function authCall(p) {
  try { const r = await p; if (r && r.error) return { error: authMsg(r.error), raw: r.error }; return { data: (r && r.data) || {} }; }
  catch (e) { return { error: authMsg(e), raw: e }; }
}
/* 登录成功以后：接着同步 */
async function signedIn(user, fresh) {
  currentUser = user; rememberAcct(user); LS.set('welcomed', true);
  CLOUD.afterSync = false;
  return syncOnLogin({ fresh });
}
async function authSignIn(account, pw) {
  const r = await authCall(sb.auth.signInWithPassword({ email: accountToEmail(account), password: pw }));
  if (r.error) return r;
  await signedIn(r.data.user, false);
  return { ok: true };
}
/* 注册：发验证码到邮箱。need = 'code' 要输验证码；Supabase 没开邮箱验证时直接登录 */
async function authSignUp(email, pw) {
  const r = await authCall(sb.auth.signUp({ email: email.trim().toLowerCase(), password: pw }));
  if (r.error) return r;
  const u = r.data.user;
  if (r.data.session) { await signedIn(u, true); return { ok: true }; }
  if (u && Array.isArray(u.identities) && !u.identities.length) return { error: '这个邮箱已经注册过了，直接登录就行' };
  return { need: 'code' };
}
/* 输验证码：type = signup（注册）/ recovery（重设密码）/ email_change（换邮箱） */
async function authVerify(email, code, type) {
  const r = await authCall(sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).trim(), type: type === 'signup' ? 'email' : type }));
  if (r.error) return r;
  if (type === 'signup') await signedIn(r.data.user || (r.data.session && r.data.session.user), true);
  if (type === 'email_change' && r.data.user) { currentUser = r.data.user; rememberAcct(r.data.user); if (typeof onCloudChange === 'function') onCloudChange(); }
  return { ok: true, data: r.data };
}
async function authResend(email, type) {
  email = email.trim().toLowerCase();
  if (type === 'recovery') return authCall(sb.auth.resetPasswordForEmail(email));
  return authCall(sb.auth.resend({ type: type === 'email_change' ? 'email_change' : 'signup', email }));
}
const authSendReset = email => authCall(sb.auth.resetPasswordForEmail(email.trim().toLowerCase()));
/* 忘记密码：验证码对了就登录，再设新密码 */
async function authReset(email, code, pw) {
  const v = await authCall(sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(code).trim(), type: 'recovery' }));
  if (v.error) return v;
  const u = await authCall(sb.auth.updateUser({ password: pw }));
  const user = (u.data && u.data.user) || v.data.user || (v.data.session && v.data.session.user);
  await signedIn(user, false);
  return u.error ? { ok: true, warn: '登录了，但新密码没设上：' + u.error } : { ok: true };
}
const authChangePassword = pw => authCall(sb.auth.updateUser({ password: pw }));
/* 换邮箱（老账号绑定真实邮箱也是这个）：验证码发到新邮箱 */
const authChangeEmail = email => authCall(sb.auth.updateUser({ email: email.trim().toLowerCase() }));
const withTimeout = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]);
async function authSignOut() {
  await withTimeout(pushCloud(true), 6000);                       // 退出前把改动传上去（连不上就算了，记录还在这台手机上）
  if (typeof pushSignOut === 'function') await withTimeout(pushSignOut(), 6000);
  CLOUD.signingOut = true;
  await withTimeout(sb.auth.signOut({ scope: 'local' }), 6000);   // 只退出这台手机，别的设备不受影响
  CLOUD.signingOut = false;
  try { localStorage.removeItem((sb.auth && sb.auth.storageKey) || 'sb-pqrrculvjdirycyafqht-auth-token'); } catch (e) {}   // 没联网时 signOut 删不掉，自己删
  currentUser = null; cloudReady = false; clearTimeout(cloudTimer); cloudTimer = null; clearTimeout(CLOUD.retryT);
  LS.set('acct', null);
  setCloud('none');
}

/* 找回被云端覆盖前的本机记录 */
function backupSheet(rerender) {
  const list = LS.get('backups', []);
  openSheet((p, close) => {
    p.append(sheetHead('找回被覆盖的记录', el('button', { onclick: close }, '取消')),
      iosGroup('', list.map(b => el('button', { class: 'ios-row', onclick: async () => {
        close();
        if (!(await confirmSheet(`恢复 ${fmtFull(b.at)} 的备份？`, '这台手机上现在的记录会被替换（替换前也会先备份），恢复后会同步到云端。', '恢复'))) return;
        try {
          const d = await IDB.get('bk:' + b.at);
          if (!d) { toast('这份备份找不到了'); return; }
          await applyCloud(d);
          LS.set('cloudLocalAt', Date.now()); cloudDirty();
          toast('已恢复'); if (rerender) rerender();
        } catch (e) { toast('恢复失败：' + e.message, 5000); }
      } }, el('span', { class: 'lbl' }, fmtFull(b.at), el('small', {}, `当时有 ${b.lost} 条聊天云端没有，一共 ${b.total} 条`))))),
      el('p', { class: 'sub small' }, '用云端存档覆盖这台手机之前，这台手机上云端没有的聊天会自动存一份在这里，最多留 3 份。只存在这台手机上。'));
  });
}

/* 两个选项的面板：返回 true = 选了右边那个 */
function chooseSheet(title, sub, left, right) {
  if (sheetLock) return Promise.resolve(false);
  return new Promise(res => openSheet((p, close) => p.append(el('div', { class: 'sheet-title' }, title), el('p', { class: 'sub' }, sub),
    el('div', { class: 'btnrow' }, el('button', { class: 'btn', onclick: () => { close(); res(false); } }, left), el('button', { class: 'btn primary', onclick: () => { close(); res(true); } }, right)))));
}

