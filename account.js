/*
 * 知己账户（照 iPhone 的「Apple 账户」做）：
 *   第一次打开：开屏后、解锁前，先是「你好」，再登录或注册（showWelcome）。以后不再弹。
 *   设置最上面的卡片 → 账户页：我的资料、邮箱和密码、云同步、数据与备份、退出登录。
 *   登录过期时：卡片和桌面上的「设置」出现红点，点进去重新登录。
 * 账号和同步的逻辑在 js/core/cloud.js。
 */
'use strict';

const CODE_WAIT = 60;   // 重新发送验证码要等的秒数

/* 设置里账户卡片下面那行小字 / 账户页的状态 */
function cloudStatusText() {
  const s = CLOUD.state;
  if (s === 'connecting') return '正在同步…';
  if (s === 'offline') return '暂时连不上';
  if (s === 'ok') return CLOUD.syncedAt ? `已同步 · ${relTime(CLOUD.syncedAt)}` : '已同步';
  return '';
}
const acctLabel = a => !a ? '' : isLegacyEmail(a.email) ? `账号 ${accountName(a)}` : (a.email || '');

/* 云端状态变了：刷新设置首页的卡片、账户页，桌面上「设置」的红点 */
let cloudBadge = false;
function onCloudChange() {
  const st = Nav.stacks.settings;
  if (st) for (const pg of st) if (pg.refresh && (pg === st[0] || pg.isAccount)) pg.refresh();
  if (cloudNeedsLogin() !== cloudBadge) { cloudBadge = cloudNeedsLogin(); if (typeof renderHome === 'function') renderHome(); }
}

/* ---------- 登录 / 注册 / 验证码 / 重设密码 的表单 ---------- */
/* onDone(kind)：登录成功（kind = login / signup / reset）。onOffline：连不上时显示「先离线使用」 */
function authFlow({ onDone, onOffline, prefill = '', compact = false } = {}) {
  const box = el('div', { class: 'auth' + (compact ? ' compact' : '') });
  const st = { step: 'login', email: prefill, type: 'signup', coolUntil: 0, busy: false };
  let coolT = null;
  const msg = el('p', { class: 'auth-msg', hidden: true });
  const say = (t, bad = true) => { msg.hidden = !t; msg.textContent = t || ''; msg.classList.toggle('bad', !!bad); };
  const offBtn = onOffline ? el('button', { class: 'btn wide', hidden: true, onclick: onOffline }, '先离线使用') : '';
  const fail = r => { say(r.error); if (offBtn) offBtn.hidden = r.error !== AUTH_OFFLINE; };

  const input = (label, attrs) => {
    const i = el('input', Object.assign({ spellcheck: 'false', autocapitalize: 'off', 'aria-label': label }, attrs));
    return [el('label', { class: 'ios-field' }, el('span', {}, label), i), i];
  };
  const link = (text, fn) => el('button', { type: 'button', onclick: fn }, text);
  const go = step => { st.step = step; say(''); if (offBtn) offBtn.hidden = true; render(); };
  async function busy(btn, fn) {
    if (st.busy) return;
    st.busy = true; const old = btn.textContent; btn.disabled = true; btn.textContent = old + '…';
    try { await fn(); } finally { st.busy = false; btn.disabled = false; btn.textContent = old; }
  }
  function cooldown(btn) {
    clearInterval(coolT);
    const tickBtn = () => {
      const left = Math.ceil((st.coolUntil - Date.now()) / 1000);
      if (!btn.isConnected) { clearInterval(coolT); return; }
      btn.disabled = left > 0; btn.textContent = left > 0 ? `重新发送（${left}）` : '重新发送';
      if (left <= 0) clearInterval(coolT);
    };
    tickBtn(); coolT = setInterval(tickBtn, 1000);
  }
  const head = (title, sub) => [el(compact ? 'h3' : 'h2', {}, title), sub ? el('p', { class: 'auth-sub' }, sub) : ''];
  const enter = (inputs, btn) => inputs.forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } }));

  function render() {
    box.textContent = '';
    const s = st.step;
    if (s === 'login') {
      const [fe, e] = input('邮箱', { type: 'email', inputmode: 'email', autocomplete: 'username', placeholder: '你的邮箱' });
      const [fp, p] = input('密码', { type: 'password', autocomplete: 'current-password', placeholder: '至少 6 位' });
      e.value = st.email;
      const btn = el('button', { class: 'btn primary wide', onclick: () => busy(btn, async () => {
        const a = e.value.trim(); st.email = a;
        if (!a) { say('先填邮箱'); e.focus(); return; }
        if (a.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)) { say('邮箱格式不对'); e.focus(); return; }
        if (p.value.length < 6) { say('密码至少 6 位'); p.focus(); return; }
        const r = await authSignIn(a, p.value);
        if (r.error === '这个邮箱还没验证') {      // 注册了没输验证码：再发一次，接着输
          st.type = 'signup'; const rs = await authResend(a, 'signup');
          go('code'); if (rs.error) say(rs.error); else say('这个邮箱还没验证，验证码重新发过去了', false);
          return;
        }
        if (r.error) { fail(r); return; }
        onDone && onDone('login');
      }) }, '登录');
      enter([e, p], btn);
      box.append(...head(compact ? '登录' : '登录知己账户', compact ? '' : '人设和聊天记录会存在云端，换手机登录也能接着聊。'),
        iosGroup('', [fe, fp]), msg, btn, offBtn,
        el('div', { class: 'auth-links' }, link('忘记密码？', () => { st.email = e.value.trim(); go('forgot'); }), link('注册新账户', () => { st.email = e.value.trim().includes('@') ? e.value.trim() : ''; go('signup'); })));
      return;
    }
    if (s === 'signup') {
      const [fe, e] = input('邮箱', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: '你的邮箱' });
      const [fp, p] = input('密码', { type: 'password', autocomplete: 'new-password', placeholder: '至少 6 位' });
      e.value = st.email;
      const btn = el('button', { class: 'btn primary wide', onclick: () => busy(btn, async () => {
        const a = e.value.trim().toLowerCase(); st.email = a;
        if (!validEmail(a)) { say(isLegacyEmail(a) ? '请用你自己的邮箱' : '邮箱格式不对'); e.focus(); return; }
        if (p.value.length < 6) { say('密码至少 6 位'); p.focus(); return; }
        if (!st.agreed) {                            // 没勾同意：问一句，点「同意并注册」就接着注册
          const yes = await iosAlert({ title: '请先阅读并同意', message: '注册前，请先阅读并同意《用户协议》和《隐私政策》。', buttons: [{ label: '取消', value: false }, { label: '同意并注册', bold: true, value: true }] });
          if (!yes) return;
          setAgree(true);
        }
        const r = await authSignUp(a, p.value);
        if (r.error) { fail(r); return; }
        if (r.need === 'code') { st.type = 'signup'; st.coolUntil = Date.now() + CODE_WAIT * 1000; go('code'); return; }
        onDone && onDone('signup');
      }) }, '注册');
      enter([e, p], btn);
      /* 「我已阅读并同意《用户协议》和《隐私政策》」：一行字，前面一个小圆圈，默认不勾 */
      const dot = el('span', { class: 'agree-dot', role: 'checkbox', 'aria-checked': 'false', 'aria-label': '同意用户协议和隐私政策' });
      const doc = (text, which) => el('a', { href: `privacy.html#${which}`, onclick: ev => { ev.preventDefault(); ev.stopPropagation(); policySheet(which); } }, text);
      const agree = el('div', { class: 'agree', onclick: () => setAgree(!st.agreed) }, dot,
        el('span', {}, '我已阅读并同意', doc('《用户协议》', 'terms'), '和', doc('《隐私政策》', 'privacy')));
      const setAgree = on => { st.agreed = on; agree.classList.toggle('on', on); dot.setAttribute('aria-checked', String(on)); };
      setAgree(!!st.agreed);
      box.append(...head('创建知己账户', '用邮箱注册，我们会给这个邮箱发一个验证码。'),
        iosGroup('', [fe, fp]), msg, btn, agree, offBtn,
        el('div', { class: 'auth-links' }, link('已有账户？登录', () => { st.email = e.value.trim(); go('login'); }), el('span')));
      return;
    }
    if (s === 'forgot') {
      const [fe, e] = input('邮箱', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: '注册时用的邮箱' });
      e.value = st.email.includes('@') ? st.email : '';
      const btn = el('button', { class: 'btn primary wide', onclick: () => busy(btn, async () => {
        const a = e.value.trim().toLowerCase(); st.email = a;
        if (!a.includes('@')) { say('填注册时用的邮箱。以前只起了账号名的老账户没有邮箱，没法这样找回'); e.focus(); return; }
        if (!validEmail(a)) { say('邮箱格式不对'); e.focus(); return; }
        const r = await authSendReset(a);
        if (r.error) { fail(r); return; }
        st.type = 'recovery'; st.coolUntil = Date.now() + CODE_WAIT * 1000; go('code');
      }) }, '发验证码');
      enter([e], btn);
      box.append(...head('重设密码', '输入注册时用的邮箱，我们发一个验证码过去，验证后设一个新密码。'),
        iosGroup('', [fe]), msg, btn, offBtn,
        el('div', { class: 'auth-links' }, link('返回登录', () => go('login')), el('span')));
      return;
    }
    /* code：输验证码（注册 / 重设密码） */
    const reset = st.type === 'recovery';
    const [fc, c] = input('验证码', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '10', placeholder: '邮件里的数字', class: 'code-input' });
    const rows = [fc];
    let p = null;
    if (reset) { const [fp, pp] = input('新密码', { type: 'password', autocomplete: 'new-password', placeholder: '至少 6 位' }); rows.push(fp); p = pp; }
    c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 10); });
    const again = el('button', { type: 'button', onclick: async () => {
      if (Date.now() < st.coolUntil) return;
      const r = await authResend(st.email, st.type);
      if (r.error) { fail(r); return; }
      say('又发了一次，看看邮箱', false);
      st.coolUntil = Date.now() + CODE_WAIT * 1000; cooldown(again);
    } }, '重新发送');
    const btn = el('button', { class: 'btn primary wide', onclick: () => busy(btn, async () => {
      const code = c.value.trim();
      if (code.length < 6) { say('验证码是邮件里的那串数字'); c.focus(); return; }
      if (reset && p.value.length < 6) { say('新密码至少 6 位'); p.focus(); return; }
      const r = reset ? await authReset(st.email, code, p.value) : await authVerify(st.email, code, 'signup');
      if (r.error) { fail(r); return; }
      if (r.warn) toast(r.warn, 5000);
      onDone && onDone(reset ? 'reset' : 'signup');
    }) }, reset ? '设好新密码' : '验证');
    enter(p ? [c, p] : [c], btn);
    box.append(...head('输入验证码', `验证码发到了 ${st.email}，10 分钟内有效。没收到的话，看看垃圾邮件。`),
      iosGroup('', rows), msg, btn, offBtn,
      el('div', { class: 'auth-links' }, link('换个邮箱', () => go(reset ? 'forgot' : 'signup')), again));
    cooldown(again);
    requestAnimationFrame(() => { if (box.isConnected) c.focus(); });
  }
  render();
  return box;
}

/* 用户协议和隐私政策：从底部弹出一张卡片，里面是 privacy.html 里那块屏幕的内容（不带 iPhone 4 外壳），点「完成」收起。
 * 填了一半的注册表单不受影响；完整的页面（带外壳和两边的大字）在 app.knowwo.com/privacy.html */
/* 卡片里放的是 privacy.html 手机屏幕里的那部分（标题栏 + 正文），直接拿来显示，不用 iframe：
 * iPhone 上 iframe 里的页面常常是空白的。装在 Shadow DOM 里，privacy.html 的样式只管它自己，不会影响知己。
 * 改 privacy.html 的文字、样式，这里自动跟着变。 */
let policyHTML = null;
const loadPolicy = () => policyHTML || (policyHTML = fetch('privacy.html').then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
  .catch(err => { policyHTML = null; throw err; }));
const POLICY_CSS = `:host{display:block;background:#fff;color:#111113;-webkit-text-size-adjust:100%;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif}
.screen-nav{position:sticky;top:0;z-index:5;padding:10px 16px;flex-wrap:wrap;gap:8px}
.tab-home{display:none!important}
.screen-content{overflow:visible;padding:18px 16px 40px}
.policy-wait{padding:48px 16px;text-align:center;color:#8e8e93;font-size:14px;line-height:1.6}`;
function policySheet(which) {
  openSheet((p, close) => {
    p.classList.add('tall');
    const box = el('div', { class: 'policy-box', role: 'document', 'aria-label': '用户协议与隐私政策' });
    p.append(sheetHead('', el('span'), el('button', { class: 'sheet-done', onclick: close }, '完成')), box);   // 标题就用页面里的「隐私政策与用户协议」
    const root = box.attachShadow ? box.attachShadow({ mode: 'open' }) : box;
    const wait = text => { root.innerHTML = ''; const s = document.createElement('style'); s.textContent = POLICY_CSS; root.append(s, el('div', { class: 'policy-wait' }, text)); };
    wait('正在打开…');
    loadPolicy().then(html => {
      if (!box.isConnected) return;
      const d = new DOMParser().parseFromString(html, 'text/html');
      const nav = d.querySelector('.screen-nav'), body = d.querySelector('.screen-content');
      if (!body) throw new Error('privacy.html 里没有 .screen-content');
      const css = document.createElement('style');
      css.textContent = [...d.querySelectorAll('style')].map(s => s.textContent).join('\n').replace(/:root\b/g, ':host') + '\n' + POLICY_CSS;
      root.innerHTML = '';
      root.append(css, ...[nav, body].filter(Boolean).map(n => document.importNode(n, true)));
      const q = id => root.querySelector('#' + id), tabs = [...root.querySelectorAll('.tab-btn[data-target]')];
      const navH = () => { const n = root.querySelector('.screen-nav'); return n ? n.offsetHeight : 0; };
      const jump = (id, smooth) => {
        const t = q(id); if (!t) return;
        const top = box.scrollTop + t.getBoundingClientRect().top - box.getBoundingClientRect().top - navH() - 6;
        box.scrollTo ? box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }) : (box.scrollTop = top);
      };
      const mark = () => {
        const terms = q('terms'); if (!terms || tabs.length < 2) return;
        const on = terms.getBoundingClientRect().top - box.getBoundingClientRect().top < 160;
        tabs.forEach(b => b.classList.toggle('active', (b.dataset.target === 'terms') === on));
      };
      root.addEventListener('click', ev => {   // 页面里的链接：#xxx 在卡片里跳；别的网址在新页面打开
        const a = ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
        const href = a.getAttribute('href');
        if (href.startsWith('#')) { ev.preventDefault(); jump(a.dataset.target || href.slice(1), true); }
        else if (/^https?:/i.test(href)) a.target = '_blank';
        else if (!/^mailto:/i.test(href)) ev.preventDefault();
      });
      box.addEventListener('scroll', mark, { passive: true });
      requestAnimationFrame(() => { jump(which, false); mark(); });
    }).catch(err => { console.warn('隐私政策没打开', err); if (box.isConnected) wait('暂时打不开，联网后再点一次试试。'); });
  });
}

/* ---------- 第一次打开：你好 → 登录知己账户（解锁前） ---------- */
const HELLOS = ['你好', 'Hello', 'Bonjour', 'こんにちは', '안녕하세요', 'Hola', 'Ciao', 'Hallo'];
const setupOpen = () => !!$('#setup');
function showWelcome() {
  if (setupOpen() || currentUser || !sb) return;
  const wrap = el('section', { class: 'setup', id: 'setup', 'aria-label': '欢迎使用知己' });
  const words = HELLOS.map(w => el('span', { class: 'hello-word' }, w));
  let i = 0, helloT = null;
  /* 用 div 不用 button：iPhone 的 Safari 里 button 不会被撑满整个屏幕，「你好」会缩在最上面、整页看着是白的 */
  const hello = el('div', { class: 'setup-hello', role: 'button', tabindex: '0', 'aria-label': '开始', onclick: () => toAuth(),
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toAuth(); } } }, ...words,
    el('span', { class: 'setup-go' }, '轻点以开始'));
  const cycle = () => { words.forEach((w, k) => w.classList.toggle('on', k === i)); i = (i + 1) % words.length; };
  cycle(); helloT = setInterval(cycle, 1800);
  const close = () => {
    clearInterval(helloT);
    wrap.classList.remove('on'); document.body.classList.remove('in-setup');
    setTimeout(() => wrap.remove(), 450);
  };
  function toAuth() {
    clearInterval(helloT);
    const mark = el('img', { class: 'app-mark', src: 'assets/icon-192.png', alt: '' });
    const flow = authFlow({
      onDone: kind => { close(); toast(kind === 'signup' ? '注册好了' : '登录成功'); },
      onOffline: () => { LS.set('welcomed', true); close(); toast('先离线使用：记录只存在这台手机上。以后在设置最上面登录'); }
    });
    const page = el('div', { class: 'setup-auth' }, mark, flow);   // 数据怎么处理写在《隐私政策》里，注册时那一行能点开
    hello.classList.add('out');
    wrap.append(page);
    requestAnimationFrame(() => page.classList.add('on'));
    setTimeout(() => hello.remove(), 500);
  }
  wrap.append(hello);
  $('#lock').after(wrap);
  document.body.classList.add('in-setup');
  requestAnimationFrame(() => wrap.classList.add('on'));
}

/* ---------- 设置首页最上面的卡片 ---------- */
function accountCard(go) {
  const av = el('img', { alt: '' }); setMyAvatar(av);
  const st = CLOUD.state, signed = !!sb && st !== 'none';
  const sub = !sb ? '我的资料、数据与备份' : st === 'relogin' ? '登录已过期，点这里重新登录' : signed ? '知己账户、云同步、数据与备份' : '云同步，换手机也不丢记录';
  return el('div', { class: 'ios-card', style: 'margin-top:14px' }, el('button', { class: 'profile-card', onclick: go(settingsAccountPage) }, av,
    el('div', { style: 'flex:1;min-width:0' }, el('b', {}, signed || !sb ? (myName() || '我') : '登录知己账户'), el('small', { class: st === 'relogin' ? 'bad' : '' }, sub)),
    st === 'relogin' ? el('span', { class: 'dot-badge' }, '1') : '',
    el('span', { style: 'color:var(--sys-ink3)' }, icon('chevron', 18, 2.2))));
}

/* ---------- 知己账户页 ---------- */
function settingsAccountPage(pg, app) {
  let flow = null;   // 登录表单只建一次：页面重画时不清掉正在输的内容
  pg.isAccount = true;
  subPage(pg, app, '知己账户', (b, re) => {
    const go = fn => () => Nav.push(app, p => fn(p, app));
    const st = CLOUD.state, u = currentUser, acct = u || rememberedAcct();
    const av = el('img', { alt: '' }); setMyAvatar(av);
    b.append(el('div', { class: 'acct-head' }, av, el('b', {}, myName() || '我'),
      el('small', {}, !sb ? '没有连接云端' : u ? acctLabel(u) : st === 'relogin' ? acctLabel(acct) : '还没登录')));
    if (sb && !u) {
      if (st === 'relogin') b.append(el('p', { class: 'acct-warn' }, '登录已过期，重新登录后会接着同步。这台手机上的记录都还在。'));
      const pre = acct ? (isLegacyEmail(acct.email) ? accountName(acct) : acct.email) : '';
      flow = flow || authFlow({ compact: true, prefill: pre, onDone: kind => { flow = null; toast(kind === 'signup' ? '注册好了' : '登录成功'); re(); } });
      b.append(el('div', { class: 'ios-group' }, el('div', { class: 'acct-login' }, flow)));
    }
    b.append(iosGroup('', [iosLink({ ic: 'person', color: '#8E8E93', label: '我的资料', value: myName(), onclick: go(settingsMePage) })], '名字、头像、性别、星座、关于我'));
    if (u) {
      const legacy = isLegacyEmail(u.email);
      b.append(iosGroup('账户', [
        el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '邮箱'), el('span', { class: 'val' }, legacy ? '没有（老账户）' : u.email)),   // 只显示，不能改
        iosLink({ label: '修改密码', onclick: passwordSheet })],
        legacy ? `这是以前用账号名「${accountName(u)}」注册的老账户，没有邮箱。想换成邮箱登录：先退出登录，再用邮箱注册新账户，这台手机上的记录会带到新账户里。` : ''));
      const backups = LS.get('backups', []);
      b.append(iosGroup('云同步', [
        el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '状态'), el('span', { class: 'val' + (st === 'offline' ? ' warn' : '') }, cloudStatusText())),
        iosLink({ label: '立即同步', chevron: false, cls: 'blue', onclick: async () => {
          if (CLOUD.state === 'ok') await pushCloud(false);
          else { toast('正在连云端…'); toast((await cloudConnect(true)) ? '已同步到云端' : '现在连不上，过一会儿会自动再试', 3500); }
          re();
        } }),
        iosLink({ label: '用云端存档覆盖这台手机', chevron: false, cls: 'blue', onclick: async () => {
          if (!(await confirmSheet('用云端存档覆盖这台手机？', '这台手机上还没上传的改动会被替换；云端没有的聊天会先在本机备份一份，在下面「找回被覆盖的记录」里能找回。', '覆盖'))) return;
          try { const d = await fetchCloud(); if (!d) { toast('云端还没有存档'); return; } await applyCloud(d); markSynced(); toast('已从云端恢复存档'); re(); }
          catch (e) { toast('现在连不上云端，过一会儿再试', 4000); }
        } }),
        ...(backups.length ? [iosLink({ label: '找回被覆盖的记录', value: `${backups.length} 份`, onclick: () => backupSheet(re) })] : [])],
        st === 'offline' ? '现在连不上云端（网络不好，或者服务器暂时没响应）。这段时间的记录先存在这台手机上，连上后自动同步。'
          : '设定、聊天记录、朋友圈、打卡会自动同步到云端；照片只存在这台手机上。'));
    }
    b.append(iosGroup('', [iosLink({ ic: 'box', color: '#8E8E93', label: '数据与备份', onclick: go(settingsDataPage) })], '导出、导入备份文件，清空记录'));
    if (u) b.append(iosGroup('', [el('button', { class: 'ios-row danger', onclick: async () => {
      if (!(await confirmSheet('退出登录？', '退出前会先把改动传到云端。这台手机上的记录会留着，下次登录同一个账户会接着用。这台手机的锁屏通知会关掉。', '退出', true))) return;
      await authSignOut(); toast('已退出登录'); re();
    } }, '退出登录')]));
  });
}

function passwordSheet() {
  openSheet((p, close) => {
    const a = el('input', { type: 'password', autocomplete: 'new-password', placeholder: '至少 6 位', 'aria-label': '新密码' });
    const b2 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: '再输一次', 'aria-label': '确认新密码' });
    const msg = el('p', { class: 'sub acc-msg bad', hidden: true });
    const say = t => { msg.hidden = !t; msg.textContent = t; };
    const btn = el('button', { class: 'btn primary', onclick: async () => {
      if (a.value.length < 6) { say('新密码至少 6 位'); return; }
      if (a.value !== b2.value) { say('两次输的不一样'); return; }
      btn.disabled = true;
      const r = await authChangePassword(a.value);
      btn.disabled = false;
      if (r.error) { say(r.error); return; }
      close(); toast('密码改好了');
    } }, '修改');
    p.append(sheetHead('修改密码', el('button', { onclick: close }, '取消')),
      iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '新密码'), a), el('label', { class: 'ios-field' }, el('span', {}, '确认新密码'), b2)]),
      msg, el('div', { class: 'btnrow' }, btn));
    setTimeout(() => a.focus(), 300);
  });
}
