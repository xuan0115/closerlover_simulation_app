/*
 * 账号与云同步（Supabase）。
 *
 *   打开网页 → 已登录：比较云端和这台手机哪份更新，用新的那份；没登录：弹出登录面板（关不掉）。
 *   账号是「账号 + 密码」：账号会自动拼成 账号@zhiji.app 交给 Supabase（Supabase 的「Confirm email」要关掉）。
 *   改了设定、聊天、朋友圈……停 3 秒自动上传一份完整存档；上传前去掉 API Key。照片（存在 IndexedDB 里的）不上传。
 *   Supabase 连不上（比如网络问题）时，登录面板里可以选「先离线使用」，数据只存在这台手机上。
 *
 * 云端要先做好的设置（RLS、内置 AI 中转）见 supabase/ 文件夹里的说明。
 */
'use strict';

const SUPABASE_URL = 'https://pqrrculvjdirycyafqht.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vcQqBuX7tOgiRlKW9oKsxA_aAzzXa_V';   // 公开钥匙：本来就放在网页里，靠 RLS 保护数据
const ACCOUNT_DOMAIN = 'zhiji.app';

let sb = null;
try { if (window.supabase && SUPABASE_URL.startsWith('http')) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
catch (e) { console.warn('Supabase 初始化失败', e); }

let currentUser = null;
let cloudTimer = null;
let cloudReady = false;      // 开机同步做完之前不上传，免得把还没合并的数据传上去

const accountToEmail = a => { a = String(a || '').trim().toLowerCase(); return a.includes('@') ? a : `${a}@${ACCOUNT_DOMAIN}`; };
const accountName = u => { const e = (u && u.email) || ''; return e.endsWith('@' + ACCOUNT_DOMAIN) ? e.slice(0, -ACCOUNT_DOMAIN.length - 1) : e; };
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
/* force：登录时的首次合并才用。平时（自动上传、手动备份）只往「这台手机上的数据所属的账号」里传 */
async function pushCloud(silent = false, force = false) {
  if (!sb || !currentUser) return false;
  if (!force && (!cloudReady || LS.get('cloudUser', '') !== currentUser.id)) return false;
  clearTimeout(cloudTimer); cloudTimer = null;
  const payload = cloudPayload();
  const { error } = await sb.from('user_backups').upsert(
    { user_id: currentUser.id, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) { if (!silent) toast('云同步失败：' + error.message, 5000); return false; }
  LS.set('cloudUser', currentUser.id);
  if (!silent) toast('已同步到云端');
  return true;
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
  ST = Object.assign(freshState(), d.state || {});
  ST.lastTick = Date.now(); delete ST.pending;
  LS.set('settings', S); LS.set('msgs', M); LS.set('posts', POSTS); LS.set('state', ST);
  LS.set('pool', POOL); LS.set('notes', NOTES); LS.set('favs', FAVS);
  LS.set('cloudLocalAt', d.at || Date.now()); if (currentUser) LS.set('cloudUser', currentUser.id);
  for (const k of Object.keys(Nav.stacks)) delete Nav.stacks[k];   // 各个 App 的页面按新数据重画
  WXT = null;
  syncStatusIcons(); show(cur === 'lock' ? 'lock' : 'home'); updateBadges();
}

/* 登录后：云端和本机比一比，用新的那份；拿不准时问你 */
async function syncOnLogin({ fresh = false } = {}) {
  cloudReady = false; clearTimeout(cloudTimer); cloudTimer = null;
  try {
    if (fresh) { await pushCloud(true, true); return; }                     // 刚注册：把这台手机上的当作初始存档
    const d = await fetchCloud();
    const localAt = Number(LS.get('cloudLocalAt', 0)) || 0;
    const sameOwner = LS.get('cloudUser', '') === currentUser.id;
    const hasLocal = M.some(m => m.from === 'me' || m.from === 'her');
    if (!d) { await pushCloud(true, true); return; }                    // 云端还没有：上传本机
    if (sameOwner) { if ((d.at || 0) > localAt) await applyCloud(d); else if (localAt > (d.at || 0)) await pushCloud(true, true); return; }
    if (!hasLocal) { await applyCloud(d); toast('已从云端恢复存档'); return; }   // 这台手机上没聊过：直接用云端的
    const useCloud = await chooseSheet('用哪一份记录？',
      `这台手机上有聊天记录，你的账号在云端也有一份存档（${fmtFull(d.at || Date.now())}）。用云端的，这台手机上的会被替换（替换前自动在本机备份一份，在「数据与备份」里能找回）；用这台手机的，云端那份会被覆盖。`,
      '用这台手机的', '用云端的');
    if (useCloud) { await applyCloud(d); toast('已从云端恢复存档'); } else await pushCloud(false, true);
  } catch (e) {
    toast('读取云端存档失败：' + (e.message || e), 5000);
  } finally {
    cloudReady = true;
    if (typeof pushAfterSync === 'function') pushAfterSync();   // 锁屏通知：取回网页关着时她发的消息（js/core/push.js）
  }
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

/* ---------- 开机 ---------- */
async function cloudStart() {
  if (!sb) return;                       // 没配置或脚本没加载：照常离线使用
  let session = null;
  try { session = (await sb.auth.getSession()).data.session; } catch (e) {}
  currentUser = session ? session.user : null;
  sb.auth.onAuthStateChange((_e, s) => { currentUser = s ? s.user : null; });
  if (currentUser) await syncOnLogin();
  else { setTimeout(showLoginModal, 400); if (typeof pushAfterSync === 'function') pushAfterSync(); }
  /* 切走、关网页时，把还没上传的改动赶紧传上去 */
  document.addEventListener('visibilitychange', () => { if (document.hidden && cloudTimer) pushCloud(true); });
}

/* ---------- 登录 / 注册 ---------- */
/* 账号表单：开机的登录面板和「数据与备份」共用。onDone 在登录或注册成功后调用 */
function accountForm(onDone, { offline } = {}) {
  const acc = el('input', { type: 'text', placeholder: '字母或数字，比如 xiaoming', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false', 'aria-label': '账号' });
  const pw = el('input', { type: 'password', placeholder: '至少 6 位', autocomplete: 'current-password', 'aria-label': '密码' });
  const msg = el('p', { class: 'sub acc-msg', hidden: true });
  const offBtn = offline ? el('button', { class: 'btn', hidden: true, onclick: offline }, '先离线使用') : '';
  let busy = false;
  const go = async signUp => {
    if (busy) return;
    const a = acc.value.trim();
    if (!/^[a-z0-9_.@-]{2,40}$/i.test(a)) { toast('账号用 2 位以上的字母、数字'); acc.focus(); return; }
    if (pw.value.length < 6) { toast('密码至少 6 位'); pw.focus(); return; }
    busy = true; msg.hidden = false; msg.textContent = signUp ? '正在注册…' : '正在登录…';
    try {
      const email = accountToEmail(a);
      const res = signUp ? await sb.auth.signUp({ email, password: pw.value }) : await sb.auth.signInWithPassword({ email, password: pw.value });
      if (res.error) throw res.error;
      if (!res.data.session) { msg.textContent = '注册好了，请点「登录」。'; return; }   // 万一开着邮箱验证
      currentUser = res.data.user;
      msg.hidden = true;
      await onDone(signUp);
    } catch (e) {
      const m = String(e.message || e);
      msg.textContent = /Invalid login credentials/i.test(m) ? '账号或密码不对' : /already registered|already exists/i.test(m) ? '这个账号已经有人用了，换一个，或者直接登录'
        : /fetch|network|Failed|Load failed/i.test(m) ? '连不上服务器，检查一下网络' : '没成功：' + m;
      if (offBtn && /连不上/.test(msg.textContent)) offBtn.hidden = false;
    } finally { busy = false; }
  };
  return {
    fields: [el('label', { class: 'ios-field' }, el('span', {}, '账号'), acc), el('label', { class: 'ios-field' }, el('span', {}, '密码'), pw)],
    buttons: el('div', { class: 'btnrow' }, el('button', { class: 'btn', onclick: () => go(true) }, '注册新账号'), el('button', { class: 'btn primary', onclick: () => go(false) }, '登录')),
    msg, offBtn
  };
}

/* 开机的登录面板：登录前关不掉 */
function showLoginModal() {
  if (!sb || currentUser) return;
  lockSheet(false); closeSheet();
  openSheet(p => {
    const f = accountForm(async signUp => {
      lockSheet(false); closeSheet();
      toast(signUp ? '注册好了' : '登录成功');
      await syncOnLogin({ fresh: signUp });
    }, { offline: () => { lockSheet(false); closeSheet(); toast('先离线使用：记录只存在这台手机上'); } });
    p.append(el('div', { class: 'sheet-title' }, `登录「${APP_TITLE}」`),
      el('p', { class: 'sub' }, '第一次用就点「注册新账号」，自己起一个账号和密码。登录后，人设和聊天记录会保存在知己的云端，换手机登录也能找回。'),
      iosGroup('', f.fields), f.msg, f.buttons, f.offBtn,
      el('p', { class: 'sub small' }, '用内置 AI 时，聊天内容会经过知己的服务器转给 DeepSeek。知己的开发者作为数据库管理员，技术上能看到云端存档。别在聊天里发证件号、银行卡号这类信息。详细说明在「设置 → 隐私与安全性」。'));
  });
  lockSheet(true);
}

/* 「数据与备份」里的账号一栏 */
function cloudAccountGroup(rerender) {
  if (!sb) return el('span');
  const backups = LS.get('backups', []);
  if (currentUser) return iosGroup('账号与云同步', [
    el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '当前账号'), el('span', { class: 'val' }, accountName(currentUser))),
    iosLink({ label: '立即备份到云端', onclick: () => pushCloud(false), chevron: false, cls: 'blue' }),
    iosLink({ label: '用云端存档覆盖这台手机', chevron: false, cls: 'blue', onclick: async () => {
      if (!(await confirmSheet('用云端存档覆盖这台手机？', '这台手机上还没上传的改动会被替换；云端没有的聊天会先在本机备份一份，在下面「找回被覆盖的记录」里能找回。', '覆盖'))) return;
      try { const d = await fetchCloud(); if (!d) { toast('云端还没有存档'); return; } await applyCloud(d); toast('已从云端恢复存档'); rerender(); } catch (e) { toast('读取失败：' + e.message, 5000); }
    } }),
    ...(backups.length ? [iosLink({ label: '找回被覆盖的记录', value: `${backups.length} 份`, onclick: () => backupSheet(rerender) })] : []),
    el('button', { class: 'ios-row danger', onclick: async () => {
      if (!(await confirmSheet('退出登录？', '退出前会先把改动传到云端。这台手机上的记录会留着，下次登录同一个账号会接着用。这台手机的锁屏通知会关掉。', '退出'))) return;
      await pushCloud(true);
      if (typeof pushSignOut === 'function') await pushSignOut();
      await sb.auth.signOut(); currentUser = null; cloudReady = false; clearTimeout(cloudTimer); cloudTimer = null; rerender(); showLoginModal();
    } }, '退出登录')],
    '登录后，设定、聊天记录、朋友圈、打卡会自动同步到云端；照片只存在这台手机上。');
  const f = accountForm(async signUp => { toast(signUp ? '注册好了' : '登录成功'); await syncOnLogin({ fresh: signUp }); rerender(); });
  return el('div', {}, iosGroup('登录后可以云同步', [...f.fields], '没登录时，记录只存在这台手机上。'), f.msg, f.buttons);
}
