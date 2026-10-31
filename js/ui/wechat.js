/*
 * 著信（照微信做的聊天 App）：
 * 聊天列表、聊天（长按菜单、引用、撤回、拍一拍、语音、礼物、语音通话）、通讯录、朋友资料、
 * 发现、朋友圈（点赞、评论、自己发）、我（收藏、设置）、聊天信息、搜索。
 * 她的人设不在这里，在手机的「设置 → 著信」里。
 */
'use strict';

let wxTab = 'chats';
let WXT = null;          // 当前打开的聊天页
let typingOn = false;
let quoteDraft = null;   // 正在引用的那条消息

/* App 里的标题、「聊我号」用短名字；改过桌面上的名字就跟着改过的 */
const zxName = () => ((S.home.wx && (S.home.wx.label || '').trim()) || APPS.wx.short || appDef('wx').label);
const WX_TABS = [['chats', zxName, 'chat'], ['contacts', () => '通讯录', 'contacts'], ['discover', () => '发现', 'compass'], ['me', () => '我', 'person']];
const EMOJI = ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤪', '😎', '🥹', '😭', '😤', '😡', '🥱', '😴', '🤔', '🙄', '😳', '🫠', '🙃', '😇', '🤗', '👍', '👌', '🙏', '💪', '👏', '❤️', '💔', '🌹', '☕️', '🍜', '🍰', '🌙', '☀️', '🎉', '✨', '🐱'];

const threadVisible = () => cur === 'wx' && !!WXT && Nav.top('wx') === WXT.pg;
const newPostsCount = () => POSTS.filter(p => p.author === 'her' && p.ts > (ST.seenPosts || 0)).length + (ST.momentNews || 0);
function markRead() {
  if (!threadVisible() || document.hidden) return;
  const last = M[M.length - 1];
  ST.lastRead = Math.max(Date.now(), last ? last.ts : 0); saveST(); updateBadges();
}
function openThread(instant) {
  if (!Nav.stacks.wx) Nav.reset('wx', wxRoot);
  if (threadVisible()) return;
  Nav.popToRoot('wx'); wxTab = 'chats'; Nav.refresh('wx');
  Nav.push('wx', wxThreadPage, { instant });
  markRead();
}

/* ---------- 小部件 ---------- */
const wxBack = app => el('button', { class: 'wx-back', 'aria-label': '返回', onclick: () => Nav.pop(app) }, icon('back', 24, 2));
function wxNav(title, right, cls = '') { return el('header', { class: 'wx-nav ' + cls }, wxBack('wx'), el('h1', { class: 'wx-title' }, title), right || el('span')); }
function wxCell({ ic, color, label, value, onclick, chev = true, cls = '', right }) {
  const v = value == null || value === '' ? '' : value instanceof Node ? value : el('span', { class: 'val' }, value);
  return el(onclick ? 'button' : 'div', { class: 'wx-cell' + (ic ? '' : ' noic') + (cls ? ' ' + cls : ''), onclick },
    ic ? el('span', { class: 'wx-cell-ic', style: `color:${color}` }, icon(ic, 24, 1.8)) : '',
    el('span', { class: 'lbl' }, label), v, right || '', chev && onclick ? el('span', { class: 'chev' }, icon('chevron', 16, 2)) : '');
}
function wxToggle(label, get, set) {
  const c = el('input', { type: 'checkbox', class: 'sw', 'aria-label': label }); c.checked = !!get();
  c.addEventListener('change', () => set(c.checked));
  return el('label', { class: 'wx-cell noic' }, el('span', { class: 'lbl' }, label), c);
}
const herAv = () => { const i = el('img', { alt: '' }); setAvatar(i); return i; };
const myAv = () => { const i = el('img', { alt: '' }); setMyAvatar(i); return i; };
/* 还没做的入口：一个空白页 */
const wxBlank = (title, text) => pg => { pg.classList.add('wx'); pg.append(wxNav(title), el('div', { class: 'wx-scroll' }, el('p', { class: 'mo-empty' }, text || '暂无内容'))); };

/* ---------- 首页：四个 tab ---------- */
function wxRoot(pg) {
  pg.classList.add('wx');
  const title = el('h1', { class: 'wx-title' });
  const plusBtn = el('button', { class: 'wx-navbtn r', 'aria-label': '更多', onclick: () => toggleMenu() }, icon('plusCircle', 25, 1.6));
  const nav = el('header', { class: 'wx-nav' }, el('span'), title, plusBtn);
  const body = el('div', { class: 'wx-scroll' });
  const tabs = el('nav', { class: 'wx-tabs' });
  const dots = {};
  let menu = null;
  function toggleMenu(force) {
    if (menu || force === false) { if (menu) menu.remove(); menu = null; return; }
    const item = (ic, label, fn) => el('button', { onclick: () => { toggleMenu(false); fn(); } }, icon(ic, 21, 1.7), label);
    menu = el('div', { class: 'wx-menu', role: 'menu' },
      item('chat', '发起群聊', () => Nav.push('wx', wxBlank('发起群聊', '你只有一个朋友，还建不了群。'))),
      item('personAdd', '添加朋友', () => Nav.push('wx', wxAddFriend)),
      item('scan', '扫一扫', () => openApp('camera')));
    pg.append(menu);
  }
  pg.closeMenu = () => { if (menu) { toggleMenu(false); return true; } return false; };
  pg.addEventListener('pointerdown', e => { if (menu && !e.target.closest('.wx-menu') && !plusBtn.contains(e.target)) toggleMenu(false); });
  for (const [id, label, ic] of WX_TABS) {
    dots[id] = el('i', { class: 'wx-dot', hidden: true });
    tabs.append(el('button', { class: 'wx-tab', 'data-tab': id, onclick: () => { wxTab = id; render(); } },
      el('span', { class: 'ic' }, icon(ic, 27, 1.6), dots[id]), el('span', {}, label())));
  }
  pg.append(nav, body, tabs);
  pg.updateBadges = () => {
    const n = unreadList().length;
    dots.chats.hidden = !n; dots.chats.textContent = S.zx.mute ? '' : (n > 99 ? '99+' : n);
    dots.chats.classList.toggle('tiny', !!S.zx.mute);
    dots.discover.hidden = !newPostsCount(); dots.discover.classList.add('tiny');
    if (wxTab === 'chats') title.textContent = n && !S.zx.mute ? `${zxName()}(${n})` : zxName();
  };
  function render() {
    $$('.wx-tab', tabs).forEach(b => b.classList.toggle('on', b.dataset.tab === wxTab));
    nav.hidden = wxTab === 'me';
    plusBtn.style.visibility = wxTab === 'chats' ? '' : 'hidden';
    title.textContent = { chats: zxName(), contacts: '通讯录', discover: '发现' }[wxTab] || '';
    body.textContent = ''; body.scrollTop = 0;
    ({ chats: wxChats, contacts: wxContacts, discover: wxDiscover, me: wxMe })[wxTab](body);
    pg.updateBadges();
  }
  pg.refresh = render; render();
}
function wxChats(body) {
  body.append(el('button', { class: 'wx-search', onclick: () => Nav.push('wx', wxSearchPage) }, icon('search', 17, 2), '搜索'));
  const last = [...M].reverse().find(m => m.from !== 'sys');
  const n = unreadList().length;
  let pv = last ? previewOf(last) : '打个招呼吧';
  if (n > 1) pv = `[${n}条] ${pv}`;
  const dot = !n ? '' : S.zx.mute ? el('i', { class: 'wx-dot tiny' }) : el('i', { class: 'wx-dot' }, n > 99 ? '99+' : String(n));
  body.append(el('div', { class: 'wx-group' }, el('button', { class: 'wx-row' + (S.zx.pin ? ' pinned' : ''), onclick: () => openThread() },
    el('span', { class: 'wx-av' }, herAv(), dot),
    el('div', { class: 'wx-row-main' },
      el('div', { class: 'wx-row-top' }, el('b', {}, herName()), el('time', {}, last ? listTime(last.ts) : '')),
      el('div', { class: 'wx-row-sub' }, el('p', {}, pv), S.zx.mute ? el('span', { class: 'wx-mute' }, icon('bellOff', 15, 1.8)) : '')))));
}
function wxContacts(body) {
  const top = (ic, color, label, page) => wxCell({ ic, color, label, chev: false, onclick: () => Nav.push('wx', page) });
  body.append(el('div', { class: 'wx-group' },
    top('personAdd', '#FA9D3B', '新的朋友', wxBlank('新的朋友', '没有新的朋友')),
    top('person', '#FA9D3B', '仅聊天的朋友', wxBlank('仅聊天的朋友', '没有仅聊天的朋友')),
    top('contacts', '#07C160', '群聊', wxBlank('群聊', '你还没有保存群聊')),
    top('tag', '#2782D7', '标签', wxBlank('标签', '暂无标签')),
    top('star', '#2782D7', '公众号', wxBlank('公众号', '还没有关注公众号'))),
    el('div', { class: 'wx-section' }, '星标朋友'),
    el('div', { class: 'wx-group' }, el('button', { class: 'wx-row slim', onclick: () => Nav.push('wx', wxProfilePage) },
      el('span', { class: 'wx-av' }, herAv()), el('div', { class: 'wx-row-main' }, el('div', { class: 'wx-row-top' }, el('b', {}, herName()))))),
    el('p', { class: 'wx-hint', style: 'text-align:center;padding-top:18px' }, '1 个朋友'));
}
function wxDiscover(body) {
  const np = newPostsCount();
  const thumb = POSTS.length ? el('span', { class: 'thumb' }, herAv(), np ? el('i', { class: 'wx-dot tiny' }) : '') : '';
  const blank = (ic, color, label) => wxCell({ ic, color, label, onclick: () => Nav.push('wx', wxBlank(label)) });
  body.append(
    el('div', { class: 'wx-group' }, wxCell({ ic: 'aperture', color: '#E8673D', label: '朋友圈', value: thumb, onclick: () => Nav.push('wx', wxMomentsPage) })),
    el('div', { class: 'wx-group' }, blank('play', '#FA9D3B', '视频号'), blank('live', '#FA5151', '直播')),
    el('div', { class: 'wx-group' }, wxCell({ ic: 'scan', color: '#2782D7', label: '扫一扫', onclick: () => openApp('camera') })),
    el('div', { class: 'wx-group' }, blank('music', '#FA5151', '听一听'), blank('eye', '#F7C443', '看一看'), blank('search', '#FA5151', '搜一搜')),
    el('div', { class: 'wx-group' }, blank('grid', '#7D53D1', '小程序')));
}
function wxMe(body) {
  body.append(el('div', { class: 'wx-me-head' }, myAv(),
    el('div', { style: 'flex:1;min-width:0' }, el('b', {}, myName() || '我'), el('small', {}, `${zxName()}号：${myZxId()}`),
      el('span', { class: 'wx-status' }, '+ 状态'))));
  body.append(
    el('div', { class: 'wx-group' }, wxCell({ ic: 'service', color: '#07C160', label: '服务', onclick: () => Nav.push('wx', wxBlank('服务', '这里什么都没有。')) })),
    el('div', { class: 'wx-group' },
      wxCell({ ic: 'box', color: '#FA9D3B', label: '收藏', onclick: () => Nav.push('wx', wxFavsPage) }),
      wxCell({ ic: 'aperture', color: '#2782D7', label: '朋友圈', onclick: () => Nav.push('wx', wxMomentsPage) }),
      wxCell({ ic: 'smile', color: '#F7C443', label: '表情', onclick: () => Nav.push('wx', wxBlank('表情', '暂时只有系统自带的表情。')) })),
    el('div', { class: 'wx-group' }, wxCell({ ic: 'gear', color: '#2782D7', label: '设置', onclick: () => Nav.push('wx', wxSettingsPage) })));
}
function wxAddFriend(pg) {
  pg.classList.add('wx');
  pg.append(wxNav('添加朋友'), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-search', style: 'justify-content:flex-start;padding-left:14px' }, icon('search', 17, 2), `${zxName()}号/手机号`),
    el('p', { class: 'wx-hint', style: 'text-align:center' }, `我的${zxName()}号：${myZxId()}`),
    el('div', { class: 'wx-group' },
      wxCell({ ic: 'scan', color: '#2782D7', label: '扫一扫', onclick: () => openApp('camera') }),
      wxCell({ ic: 'contacts', color: '#07C160', label: '手机联系人', onclick: () => Nav.push('wx', wxBlank('手机联系人', '没有可以添加的联系人')) }))));
}

/* ---------- 聊天 ---------- */
const aiNotice = () => S.reply.mode === 'template'
  ? `${herName()}的消息由预设模板自动生成，不是真人。`
  : `${herName()}的消息由 AI 生成，不是真人。`;
function previewOf(m) {
  if (m.from === 'tip') return m.text;
  switch (m.type) {
    case 'image': return '[图片]';
    case 'voice': return `[语音] ${m.dur}"`;
    case 'gift': return `[礼物] ${m.name}`;
    case 'call': return '[语音通话]';
    default: return m.text;
  }
}

function wxThreadPage(pg) {
  pg.classList.add('wx', 'thread');
  const title = el('h1', { class: 'wx-title' }, herName());
  const nav = el('header', { class: 'wx-nav line' }, wxBack('wx'), title,
    el('button', { class: 'wx-navbtn r', 'aria-label': '聊天信息', onclick: () => Nav.push('wx', wxChatInfoPage) }, icon('more', 24)));
  const list = el('div', { class: 'wx-list' });
  const scroller = el('div', { class: 'wx-msgs' }, list);
  const compose = buildCompose();
  pg.append(nav, scroller, compose);
  WXT = { pg, list, scroller, title, compose };
  applyChatBg();
  scroller.addEventListener('scroll', closeMsgMenu);
  pg.addEventListener('pointerdown', e => { if (!e.target.closest('.wx-pop')) closeMsgMenu(); });
  pg.onclose = () => { if (WXT && WXT.pg === pg) WXT = null; };
  pg.refresh = () => { title.textContent = typingOn ? '对方正在输入...' : herName(); renderThread(); markRead(); };
  pg.closeMenu = () => { if ($('.wx-pop', pg)) { closeMsgMenu(); return true; } return false; };
  renderThread();
}
function applyChatBg() {
  if (!WXT) return;
  if (S.zx.bg) imgSrc('chatbg').then(s => { if (s && WXT) WXT.scroller.style.background = `center/cover url("${s}")`; });
  else WXT.scroller.style.background = '';
}
function renderThread() {
  if (!WXT) return;
  const { list } = WXT; list.textContent = '';
  list.append(el('div', { class: 'wx-notice' }, aiNotice()));
  const start = Math.max(0, M.length - 300);
  for (let i = start; i < M.length; i++) appendMsg(M[i], i > start ? M[i - 1] : null);
  scrollBottom(true);
}
function appendMsg(m, prev) {
  if (!WXT) return;
  const { list } = WXT;
  if (!prev || m.ts - prev.ts > 5 * 60e3) list.append(el('div', { class: 'wx-time' }, stampText(m.ts)));
  if (m.from === 'sys') {
    const row = el('div', { class: 'wx-sys' }, m.text);
    if (m.retry) row.append(el('button', { onclick: () => retry(m) }, '重试'));
    list.append(row); return;
  }
  if (m.from === 'tip') {
    const row = el('div', { class: 'wx-tip', 'data-id': m.id }, m.text);
    if (m.edit) row.append(el('button', { onclick: () => { const ta = $('.wx-input', WXT.compose); setComposeMode('text'); ta.value = m.edit; ta.dispatchEvent(new Event('input')); ta.focus(); } }, '重新编辑'));
    list.append(row); return;
  }
  const mine = m.from === 'me';
  const av = el('img', { class: 'av', alt: '' });
  if (mine) setMyAvatar(av); else { setAvatar(av); bindAvatarTaps(av); }
  const col = el('div', { class: 'wx-col' });
  let b;
  if (m.type === 'image') {
    b = el('button', { class: 'wx-pic', 'aria-label': '查看图片' });
    const im = el('img', { alt: m.desc || '图片' });
    im.addEventListener('load', () => scrollBottom());
    setImg(im, m.imageId); b.append(im);
    b.addEventListener('click', () => openViewer(m.imageId));
  } else if (m.type === 'voice') {
    const w = Math.min(210, 74 + (m.dur || 1) * 5);
    b = el('button', { class: 'wx-bubble voice', style: `width:${w}px`, 'aria-label': `语音 ${m.dur} 秒` }, el('span', { class: 'wave' }, icon('wave', 20, 2)), el('span', {}, `${m.dur}"`));
    b.addEventListener('click', () => playVoice(m, b));
    col.append(b);
    if (!mine && !m.played) col.append(el('i', { class: 'wx-unplayed' }));
    if (m.showText) col.append(el('div', { class: 'wx-vtext' }, mine ? (m.transcript || '没有识别出文字') : m.text));
  } else if (m.type === 'gift') {
    b = el('div', { class: 'wx-gift' }, el('span', { class: 'em' }, m.emoji || '🎁'),
      el('div', {}, el('b', {}, m.note || (mine ? `送你${m.name}` : `给你的${m.name}`)), el('small', {}, `${m.name}`)),
      el('footer', {}, `${zxName()}礼物`));
  } else if (m.type === 'call') {
    const txt = m.status === 'done' ? `通话时长 ${fmtDur(m.dur)}` : m.status === 'declined' ? (mine ? '对方已拒绝' : '已拒绝') : m.status === 'cancel' ? '已取消' : (mine ? '对方无应答' : '未接听');
    b = el('div', { class: 'wx-bubble callrec', role: 'button', tabindex: '0', onclick: () => callOrSoon() }, icon('phone', 18, 1.8), txt);
  } else b = el('div', { class: 'wx-bubble' }, m.text);
  if (!col.contains(b)) col.prepend(b);
  if (m.quote) col.append(el('div', { class: 'wx-quote' }, `${m.quote.who}：${m.quote.text}`));
  attachPress(b, m);
  list.append(el('div', { class: 'wx-msg ' + (mine ? 'me' : 'her'), 'data-id': m.id }, av, col));
}
function scrollBottom(force) {
  if (!WXT) return;
  const box = WXT.scroller;
  if (force || box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
}
function setTyping(on) {
  typingOn = on;
  if (WXT) { WXT.title.textContent = on ? '对方正在输入...' : herName(); if (on) scrollBottom(); }
}

/* 她的头像：点一下看资料，连点两下拍一拍 */
function bindAvatarTaps(av) {
  let t = null;
  av.addEventListener('click', () => {
    if (t) { clearTimeout(t); t = null; patHer(); return; }
    t = setTimeout(() => { t = null; Nav.push('wx', wxProfilePage); }, 280);
  });
}
function patHer() {
  addMsg({ id: uid('t'), from: 'tip', who: 'me', kind: 'pat', text: `我拍了拍「${herName()}」`, ts: Date.now() });
  const row = WXT && WXT.list.lastElementChild; if (row) row.classList.add('shake');
  scheduleReply();
}

/* ---------- 长按 / 右键菜单 ---------- */
function attachPress(node, m) {
  let t = null, sx = 0, sy = 0;
  node.addEventListener('contextmenu', e => { e.preventDefault(); showMsgMenu(node, m); });
  node.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    sx = e.clientX; sy = e.clientY;
    t = setTimeout(() => { t = null; node._long = true; showMsgMenu(node, m); }, 480);
  });
  const cancel = () => { if (t) { clearTimeout(t); t = null; } };
  node.addEventListener('pointerup', cancel); node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); });
  node.addEventListener('click', e => { if (node._long) { e.stopImmediatePropagation(); e.preventDefault(); node._long = false; } }, true);
}
function closeMsgMenu() { $$('.wx-pop').forEach(p => p.remove()); }
function showMsgMenu(node, m) {
  if (!WXT) return;
  closeMsgMenu();
  const mine = m.from === 'me', items = [];
  const text = m.type === 'voice' ? (mine ? m.transcript : m.text) : m.text;
  if ((m.type === 'text' || m.type === 'checkin') && text) items.push(['copy', '复制', () => { copyText(text); }]);
  if (m.type === 'voice') items.push(['textT', m.showText ? '取消转文字' : '转文字', () => { m.showText = !m.showText; saveM(); renderThread(); }]);
  if (['text', 'image', 'voice', 'checkin'].includes(m.type)) items.push(['quote', '引用', () => setQuote(m)]);
  if (['text', 'image', 'voice'].includes(m.type)) items.push(['box', '收藏', () => { FAVS.push({ id: uid('f'), from: m.from, type: m.type, text: text || '', imageId: m.imageId || '', ts: Date.now(), src: m.ts }); saveFavs(); toast('已收藏'); }]);
  if (mine && Date.now() - m.ts < 2 * 60e3 && m.type !== 'call') items.push(['recall', '撤回', () => recallMsg(m)]);
  items.push(['trash', '删除', () => { const i = M.indexOf(m); if (i >= 0) { M.splice(i, 1); saveM(); renderThread(); } }]);
  const pop = el('div', { class: 'wx-pop', role: 'menu' });
  for (const [ic, label, fn] of items) pop.append(el('button', { role: 'menuitem', onclick: () => { closeMsgMenu(); fn(); } }, icon(ic, 22, 1.7), label));
  WXT.pg.append(pop);
  const k = zoomK(), pr = WXT.pg.getBoundingClientRect(), r = node.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight, pw = WXT.pg.offsetWidth;
  let left = ((r.left + r.width / 2 - pr.left) / k) - w / 2; left = Math.max(8, Math.min(pw - w - 8, left));
  let top = (r.top - pr.top) / k - h - 10;
  const below = top < 100;
  if (below) top = (r.bottom - pr.top) / k + 10;
  pop.style.left = left + 'px'; pop.style.top = top + 'px';
  pop.classList.toggle('below', below);
  pop.style.setProperty('--ax', (((r.left + r.width / 2 - pr.left) / k) - left) + 'px');
}
function copyText(t) {
  const done = () => toast('已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
}
function recallMsg(m) {
  const i = M.indexOf(m); if (i < 0) return;
  M[i] = { id: m.id, from: 'tip', who: 'me', kind: 'recall', text: '你撤回了一条消息', edit: m.type === 'text' ? m.text : null, ts: m.ts };
  saveM(); renderThread();
  if (Math.random() < .4) scheduleReply();
}
function setQuote(m) {
  const who = m.from === 'me' ? (myName() || '我') : herName();
  const text = m.type === 'image' ? '[图片]' : m.type === 'voice' ? (m.from === 'me' ? (m.transcript || '[语音]') : m.text) : m.text;
  quoteDraft = { who, text: String(text || '').slice(0, 60) };
  if (WXT) { const bar = $('.wx-quote-bar', WXT.compose); bar.hidden = false; $('span', bar).textContent = `${quoteDraft.who}：${quoteDraft.text}`; setComposeMode('text'); $('.wx-input', WXT.compose).focus(); }
}
function clearQuote() { quoteDraft = null; if (WXT) $('.wx-quote-bar', WXT.compose).hidden = true; }

/* ---------- 记消息 ---------- */
function addMsg(m) {
  const prev = M[M.length - 1];
  if (prev && m.ts <= prev.ts) m.ts = prev.ts + 1000;
  M.push(m); if (M.length > 3000) M.splice(0, M.length - 3000); saveM();
  if (WXT) { appendMsg(m, prev); scrollBottom(m.from === 'me'); }
  if (m.from === 'her') onHerMessage(m);
  else if (m.from === 'me') { ST.lastRead = m.ts; saveST(); }
  if (cur === 'home') renderHome();
}
function addSys(text, retryInfo) { addMsg({ id: uid('s'), from: 'sys', type: 'error', text, retry: retryInfo || null, ts: Date.now() }); }
function retry(m) {
  const i = M.indexOf(m); if (i >= 0) { M.splice(i, 1); saveM(); }
  renderThread();
  const r = m.retry || {};
  if (r.kind === 'event') { const ev = S.events.find(e => e.id === r.id); if (ev) enqueue(() => runEvent(ev, { at: Date.now(), live: true })); }
  else enqueue(() => herTurn({ kind: 'reply', at: Date.now(), live: true, retry: { kind: 'reply' } }));
}

/* 我发消息：停 2 秒再让她回，连发几条会一起回 */
let replyT = null, replyQueued = false;
function scheduleReply() {
  clearTimeout(replyT);
  replyT = setTimeout(() => {
    if (replyQueued || S.notify.airplane) return;
    replyQueued = true;
    enqueue(async () => { replyQueued = false; await herTurn({ kind: 'reply', at: Date.now(), live: true, retry: { kind: 'reply' } }); });
  }, 2000);
}
function sendMine(text, type = 'text', extra = {}) {
  if (!ST.started) { ST.started = true; ST.lastTick = Date.now(); saveST(); }
  const m = Object.assign({ id: uid('m'), from: 'me', type, text, ts: Date.now() }, extra);
  if (quoteDraft && (type === 'text' || type === 'voice')) { m.quote = quoteDraft; clearQuote(); }
  addMsg(m);
  scheduleReply();
}
function doCheckin(kind) {
  const label = kind === 'study' ? '学习' : '健身';
  if (todayChecks()[kind]) { toast(`今天${label}已经打过卡了`); return; }
  checkin(kind, Date.now());
  sendMine(kind === 'study' ? '📚 开始学习了' : '🏋️ 去健身了', 'checkin');
}
function giftSheet() {
  openSheet((p, close) => {
    let chosen = GIFTS[0];
    const note = el('input', { placeholder: '想说的话（可以不填）', 'aria-label': '礼物附言' });
    const grid = el('div', { class: 'gift-grid' });
    for (const g of GIFTS) {
      const b = el('button', { 'aria-pressed': String(g === chosen), onclick: () => { chosen = g; $$('button', grid).forEach(x => x.setAttribute('aria-pressed', String(x === b))); } }, el('span', {}, g.emoji), g.name);
      grid.append(b);
    }
    p.append(sheetHead(`送${herName()}一份礼物`, el('button', { onclick: close }, '取消'),
      el('button', { onclick: () => { close(); sendMine('', 'gift', { name: chosen.name, emoji: chosen.emoji, note: note.value.trim() }); } }, '送出')),
      grid, iosGroup('', [el('label', { class: 'ios-field' }, note)], '礼物只是一张小卡片，不涉及钱。'));
  });
}

/* ---------- 输入栏：文字 / 按住说话、表情、更多 ---------- */
let composeMode = 'text';
function setComposeMode(mode) {
  if (!WXT) return;
  composeMode = mode;
  const box = WXT.compose;
  box.classList.toggle('voice-mode', mode === 'voice');
  $('.wx-cbtn.vk', box).replaceChildren(icon(mode === 'voice' ? 'keyboard' : 'voice', 28, 1.5));
}
function buildCompose() {
  const ta = el('textarea', { class: 'wx-input', rows: '1', enterkeyhint: 'send', 'aria-label': '输入消息' });
  const hold = el('button', { class: 'wx-hold' }, '按住 说话');
  const send = el('button', { class: 'wx-send', hidden: true }, '发送');
  const plus = el('button', { class: 'wx-cbtn', 'aria-label': '更多功能' }, icon('plusCircle', 28, 1.5));
  const emo = el('button', { class: 'wx-cbtn', 'aria-label': '表情' }, icon('smile', 28, 1.5));
  const vk = el('button', { class: 'wx-cbtn vk', 'aria-label': '切换语音和键盘' }, icon('voice', 28, 1.5));
  const quoteBar = el('div', { class: 'wx-quote-bar', hidden: true }, el('span'), el('button', { 'aria-label': '取消引用', onclick: clearQuote }, '✕'));
  const panel = el('div', { class: 'wx-panel' });
  const box = el('div', { class: 'wx-compose' }, el('div', { class: 'wx-bar' }, vk, ta, hold, emo, plus, send), quoteBar, panel);
  let mode = '';
  function togglePanel(m) {
    mode = mode === m ? '' : m;
    box.classList.toggle('panel-on', !!mode);
    panel.textContent = '';
    if (mode === 'emoji') { const g = el('div', { class: 'wx-emoji' }); for (const e of EMOJI) g.append(el('button', { onclick: () => { ta.value += e; sync(); } }, e)); panel.append(g); }
    if (mode === 'more') {
      const g = el('div', { class: 'wx-more' });
      const t = (ic, label, fn) => el('button', { onclick: () => { togglePanel(''); fn(); } }, el('span', { class: 'tile' }, icon(ic, 28, 1.6)), label);
      g.append(t('photo', '相册', pickFromFiles), t('camera', '拍摄', () => openApp('camera')), t('phone', FEATURES.voice ? '语音通话' : el('span', { class: 'soon-lbl' }, '语音通话', el('small', {}, '待开发')), callOrSoon),
        t('gift', '礼物', giftSheet), t('book', '学习打卡', () => doCheckin('study')), t('dumbbell', '健身打卡', () => doCheckin('gym')));
      panel.append(g);
    }
    if (mode) { ta.blur(); if (composeMode === 'voice' && mode === 'emoji') setComposeMode('text'); }
    setTimeout(() => scrollBottom(true), 60);
  }
  function sync() {
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    const has = !!ta.value.trim(); send.hidden = !has; plus.hidden = has;
  }
  function submit() { const t = ta.value.trim(); if (!t) return; ta.value = ''; sync(); sendMine(t); }
  vk.addEventListener('click', () => { if (!FEATURES.voice) { toast('语音消息（待开发）'); return; } if (mode) togglePanel(mode); setComposeMode(composeMode === 'voice' ? 'text' : 'voice'); if (composeMode === 'text') ta.focus(); });
  plus.addEventListener('click', () => togglePanel('more'));
  emo.addEventListener('click', () => togglePanel('emoji'));
  send.addEventListener('click', submit);
  send.addEventListener('mousedown', e => e.preventDefault());
  ta.addEventListener('input', sync);
  ta.addEventListener('focus', () => { if (mode) togglePanel(mode); setTimeout(() => scrollBottom(true), 300); });
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); } });
  bindHoldToTalk(hold);
  return box;
}
const callOrSoon = () => FEATURES.voice ? startCall('out') : toast('语音通话（待开发）');
function bindHoldToTalk(hold) {
  let rec = null, starting = false, cancel = false, y0 = 0, hud = null, t0 = 0, tm = null;
  const showHud = () => {
    hud = el('div', { class: 'rec-hud' }, el('div', { class: 'rec-bars' }, el('i'), el('i'), el('i'), el('i'), el('i')), el('p', {}, '手指上滑，取消发送'), el('small', {}, '0"'));
    WXT.pg.append(hud);
    tm = setInterval(() => { if (hud) $('small', hud).textContent = Math.round((Date.now() - t0) / 1000) + '"'; }, 250);
  };
  const hideHud = () => { clearInterval(tm); if (hud) hud.remove(); hud = null; };
  hold.addEventListener('pointerdown', async e => {
    e.preventDefault(); hold.setPointerCapture(e.pointerId);
    if (starting || rec) return;
    starting = true; cancel = false; y0 = e.clientY; t0 = Date.now();
    hold.classList.add('down'); hold.textContent = '松开 发送';
    showHud();
    try { rec = await startRecording(); }
    catch (err) { hideHud(); hold.classList.remove('down'); hold.textContent = '按住 说话'; toast(err.name === 'NotAllowedError' ? '没有拿到麦克风权限，可以在浏览器里允许' : '没法录音：' + err.message, 4000); }
    starting = false;
    if (rec && !hold.classList.contains('down')) finish();
  });
  hold.addEventListener('pointermove', e => {
    if (!hud) return;
    cancel = y0 - e.clientY > 60;
    hud.classList.toggle('cancel', cancel);
    $('p', hud).textContent = cancel ? '松开手指，取消发送' : '手指上滑，取消发送';
  });
  const up = () => { if (!hold.classList.contains('down')) return; hold.classList.remove('down'); hold.textContent = '按住 说话'; if (rec) finish(); else if (!starting) hideHud(); };
  hold.addEventListener('pointerup', up); hold.addEventListener('pointercancel', () => { cancel = true; up(); });
  async function finish() {
    const r = rec; rec = null; hideHud();
    const res = await r.stop(cancel);
    if (!res) return;
    if (res.dur < 1) { toast('说话时间太短'); return; }
    const id = uid('a'); await IDB.put(id, res.dataURL); imgCache.set(id, res.dataURL);
    sendMine('', 'voice', { audioId: id, dur: Math.min(60, res.dur), transcript: res.transcript });
  }
}

/* ---------- 聊天信息 ---------- */
function wxChatInfoPage(pg) {
  pg.classList.add('wx');
  const body = el('div', { class: 'wx-scroll' });
  pg.append(wxNav('聊天信息'), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('div', { class: 'wx-members' },
      el('button', { onclick: () => Nav.push('wx', wxProfilePage) }, herAv(), herName()),
      el('button', { class: 'add', 'aria-label': '添加', onclick: () => Nav.push('wx', wxBlank('发起群聊', '你只有一个朋友，还建不了群。')) }, el('span', {}, icon('plus', 26, 1.5)), '')),
      el('div', { class: 'wx-group' }, wxCell({ label: '查找聊天记录', onclick: () => Nav.push('wx', wxSearchPage) })),
      el('div', { class: 'wx-group' },
        wxToggle('消息免打扰', () => S.zx.mute, v => { S.zx.mute = v; saveS(); updateBadges(); }),
        wxToggle('置顶聊天', () => S.zx.pin, v => { S.zx.pin = v; saveS(); })),
      el('div', { class: 'wx-group' }, wxCell({ label: '设置当前聊天背景', onclick: () => Nav.push('wx', wxChatBgPage) })),
      el('div', { class: 'wx-group' }, el('button', { class: 'wx-cell danger', onclick: clearChat }, '清空聊天记录')));
  }
}
function wxChatBgPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav('聊天背景'), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' },
      wxCell({ label: '从相册中选择', onclick: async () => {
        const [f] = await pickFile('image/*'); if (!f) return;
        try { await IDB.put('chatbg', await compress(await fileToDataURL(f), 1280, .85)); imgCache.delete('chatbg'); S.zx.bg = true; saveS(); applyChatBg(); toast('已设置'); } catch (e) { toast(e.message); }
      } }),
      wxCell({ label: '恢复默认背景', onclick: () => { S.zx.bg = false; saveS(); IDB.del('chatbg').catch(() => {}); imgCache.delete('chatbg'); applyChatBg(); toast('已恢复'); } }))));
}

/* ---------- 朋友资料 ---------- */
function wxProfilePage(pg) {
  pg.classList.add('wx');
  const body = el('div', { class: 'wx-scroll', style: 'background:var(--wx-bg)' });
  pg.append(el('header', { class: 'wx-nav', style: 'background:var(--wx-card)' }, wxBack('wx'), el('span'), el('span')), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('div', { class: 'wx-profile' }, herAv(), el('div', {},
      el('b', {}, herName(), el('span', { class: 'wx-gender ' + (S.her.gender === '男' ? 'm' : 'f'), 'aria-label': S.her.gender || '女' }, S.her.gender === '男' ? '♂' : '♀')),
      el('small', {}, `${zxName()}号：${zxId()}`),
      S.her.region ? el('small', {}, '地区：' + S.her.region) : '')));
    const thumbs = el('span', { class: 'wx-thumbs' });
    POSTS.filter(p => p.author === 'her' && p.imageIds && p.imageIds[0]).slice(-4).reverse().forEach(p => { const im = el('img', { alt: '' }); setImg(im, p.imageIds[0]); thumbs.append(im); });
    body.append(
      el('div', { class: 'wx-group' }, wxCell({ label: '备注和标签', onclick: () => Nav.push('wx', wxBlank('备注和标签', '暂无备注')) }), wxCell({ label: '朋友权限', onclick: () => Nav.push('wx', wxBlank('朋友权限', '聊天、朋友圈都可见')) })),
      el('div', { class: 'wx-group' },
        wxCell({ label: '朋友圈', value: thumbs.childNodes.length ? thumbs : '', onclick: () => Nav.push('wx', wxMomentsPage) }),
        wxCell({ label: '更多信息', onclick: () => Nav.push('wx', wxMoreInfoPage) })),
      el('div', { class: 'wx-group' },
        el('button', { class: 'wx-cell center', onclick: () => openThread() }, icon('chat', 22, 1.7), '发消息'),
        el('button', { class: 'wx-cell center', onclick: () => callOrSoon() }, icon('phone', 22, 1.7), FEATURES.voice ? '语音通话' : '语音通话（待开发）')));
  }
}
function wxMoreInfoPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav('更多信息'), el('div', { class: 'wx-scroll' }, el('div', { class: 'wx-group' },
    wxCell({ label: '个性签名', value: S.her.signature || '未填写' }),
    wxCell({ label: '星座', value: S.her.zodiac || '未设定' }),
    wxCell({ label: '来源', value: `通过搜索${zxName()}号添加` }))));
}

/* ---------- 朋友圈 ---------- */
function wxMomentsPage(pg) {
  pg.classList.add('wx', 'moments', 'ink-light');
  ST.seenPosts = Date.now(); ST.momentNews = 0; saveST(); updateBadges();
  const scroll = el('div', { class: 'wx-scroll' });
  const bar = el('form', { class: 'mo-bar', hidden: true });
  const inp = el('input', { 'aria-label': '评论', placeholder: '评论' });
  bar.append(inp, el('button', { class: 'wx-send' }, '发送'));
  let target = null;
  bar.addEventListener('submit', e => { e.preventDefault(); const t = inp.value.trim(); if (!t || !target) return; inp.value = ''; bar.hidden = true; addComment(target, t); target = null; });
  pg.append(scroll, el('header', { class: 'wx-nav clear' }, wxBack('wx'), el('span'),
    el('button', { class: 'wx-navbtn r', 'aria-label': '发表', onclick: postMineSheet }, icon('camera', 24, 1.8))), bar);
  pg.refresh = render; render();
  pg.comment = p => { target = p; bar.hidden = false; inp.placeholder = '评论'; inp.focus(); };
  pg.closeMenu = () => { const pop = $('.mo-pop', pg); if (pop) { pop.remove(); return true; } if (!bar.hidden) { bar.hidden = true; return true; } return false; };
  pg.addEventListener('pointerdown', e => { if (!e.target.closest('.mo-pop,.mo-more')) $$('.mo-pop', pg).forEach(x => x.remove()); });
  function render() {
    const y = scroll.scrollTop;
    scroll.textContent = '';
    const cover = el('div', { class: 'mo-cover' });
    const pid = latestPhotoId();
    if (pid) imgSrc(pid).then(s => { if (s) cover.style.backgroundImage = `url("${s}")`; });
    cover.append(el('div', { class: 'mo-owner' }, el('b', {}, myName() || '我'), myAv()));
    scroll.append(cover);
    const posts = [...POSTS].sort((a, b) => b.ts - a.ts);
    if (!posts.length) scroll.append(el('p', { class: 'mo-empty' }, `还没有朋友圈。${herName()}会按日程发；你也可以点右上角发一条。`));
    for (const p of posts) scroll.append(momentPost(p, pg));
    scroll.scrollTop = y;
  }
}
function momentPost(p, pg) {
  const byMe = p.author === 'me';
  const name = byMe ? (myName() || '我') : herName();
  const main = el('div', { class: 'mo-main' }, el('b', {}, name), p.text ? el('p', {}, p.text) : '');
  if (p.imageIds && p.imageIds[0]) {
    const im = el('img', { alt: p.text || '照片' }); setImg(im, p.imageIds[0]);
    main.append(el('button', { class: 'mo-pic', onclick: () => openViewer(p.imageIds[0]) }, im));
  }
  const more = el('button', { class: 'mo-more', 'aria-label': '赞和评论' }, icon('more', 18));
  main.append(el('div', { class: 'mo-meta' }, el('span', {}, relTime(p.ts).replace('现在', '刚刚')), more));
  const likers = [p.likes && p.likes.her ? herName() : '', p.likes && p.likes.me ? (myName() || '我') : ''].filter(Boolean);
  const cm = p.comments || [];
  if (likers.length || cm.length) {
    const box = el('div', { class: 'mo-box' });
    if (likers.length) box.append(el('div', { class: 'mo-likes' }, icon('heart', 14, 2), likers.join('，')));
    for (const c of cm) {
      const who = c.from === 'me' ? (myName() || '我') : herName();
      const to = c.to ? (c.to === 'me' ? (myName() || '我') : herName()) : '';
      box.append(el('div', { class: 'mo-cm' }, el('b', {}, who), to ? [' 回复 ', el('b', {}, to)] : '', '：' + c.text));
    }
    main.append(box);
  }
  const node = el('div', { class: 'mo-post' }, byMe ? myAv() : herAv(), main);
  more.addEventListener('click', () => {
    $$('.mo-pop', pg).forEach(x => x.remove());
    const liked = p.likes && p.likes.me;
    const pop = el('div', { class: 'mo-pop' },
      el('button', { onclick: () => { p.likes = Object.assign({}, p.likes, { me: !liked }); savePosts(); pop.remove(); node.replaceWith(momentPost(p, pg)); } }, icon('heart', 17, 1.8), liked ? '取消' : '赞'),
      el('button', { onclick: () => { pop.remove(); pg.comment(p); } }, icon('chat', 17, 1.8), '评论'));
    more.parentNode.append(pop);
  });
  return node;
}
function addComment(p, text) {
  p.comments = p.comments || [];
  p.comments.push({ id: uid('c'), from: 'me', to: null, text, ts: Date.now() });
  savePosts(); Nav.refresh('wx');
  enqueue(async () => {
    await sleep(2500 + Math.random() * 4000);
    const lines = await herSays('moment-comment', { post: p.text, comment: text }).catch(() => tplPick('momentReply'));
    if (!lines[0]) return;
    p.comments.push({ id: uid('c'), from: 'her', to: 'me', text: lines[0], ts: Date.now() });
    savePosts(); momentNews();
  });
}
function momentNews() {
  const top = Nav.top('wx');
  if (cur === 'wx' && top && top.classList.contains('moments')) Nav.refresh('wx');
  else { ST.momentNews = (ST.momentNews || 0) + 1; saveST(); updateBadges(); if (cur === 'wx') Nav.refresh('wx'); }
}
function postMineSheet() {
  openSheet((p, close) => {
    const ta = el('textarea', { rows: '4', placeholder: '这一刻的想法…', 'aria-label': '朋友圈文字' });
    let imageId = null;
    const thumb = el('button', { class: 'mo-add', 'aria-label': '添加照片', onclick: async () => {
      const [f] = await pickFile('image/*'); if (!f) return;
      const d = await compress(await fileToDataURL(f), 1280, .86); imageId = uid('mp'); await IDB.put(imageId, d); imgCache.set(imageId, d);
      thumb.replaceChildren(el('img', { src: d, alt: '' }));
    } }, icon('plus', 30, 1.4));
    p.append(sheetHead('发表文字', el('button', { onclick: close }, '取消'), el('button', { onclick: () => {
      const text = ta.value.trim(); if (!text && !imageId) return;
      close();
      const post = { id: uid('p'), author: 'me', text, imageIds: imageId ? [imageId] : [], ts: Date.now(), likes: {}, comments: [] };
      POSTS.push(post); savePosts(); Nav.refresh('wx');
      enqueue(async () => {
        await sleep(4000 + Math.random() * 8000);
        post.likes = Object.assign({}, post.likes, { her: true });
        const lines = await herSays('my-moment', { post: text, photo: !!imageId }).catch(() => tplPick('myMoment'));
        if (lines[0]) post.comments.push({ id: uid('c'), from: 'her', text: lines[0], ts: Date.now() });
        savePosts(); momentNews();
      });
    } }, '发表')), iosGroup('', [el('label', { class: 'ios-field' }, ta), el('div', { class: 'pic-row' }, thumb)]));
  });
}
/* 她发的朋友圈 */
function addPost({ author = 'her', text, imageIds, ts }) {
  POSTS.push({ id: uid('p'), author, text: text || '', imageIds: imageIds || [], ts: ts || Date.now(), likes: {}, comments: [] });
  if (POSTS.length > 300) POSTS.splice(0, POSTS.length - 300);
  savePosts(); updateBadges();
  if (cur === 'wx') Nav.refresh('wx');
  if (cur === 'home') renderHome();
}

/* ---------- 收藏 ---------- */
function wxFavsPage(pg) {
  pg.classList.add('wx');
  const body = el('div', { class: 'wx-scroll' });
  pg.append(wxNav('收藏'), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    if (!FAVS.length) { body.append(el('p', { class: 'mo-empty' }, '长按聊天里的消息，可以收藏到这里。')); return; }
    for (const f of [...FAVS].reverse()) {
      const who = f.from === 'me' ? (myName() || '我') : herName();
      const content = f.type === 'image' ? (() => { const im = el('img', { alt: '' }); setImg(im, f.imageId); return el('button', { class: 'fav-pic', onclick: () => openViewer(f.imageId) }, im); })() : el('p', {}, f.type === 'voice' ? `[语音] ${f.text}` : f.text);
      body.append(el('div', { class: 'fav' }, content, el('small', {}, `${who}　${listTime(f.ts)}`,
        el('button', { onclick: () => { FAVS = FAVS.filter(x => x !== f); saveFavs(); render(); } }, '删除'))));
    }
  }
}

/* ---------- 我 → 设置 ---------- */
function wxSettingsPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav('设置'), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' }, wxCell({ label: '新消息通知', onclick: () => Nav.push('wx', wxNotifyPage) })),
    el('div', { class: 'wx-group' }, wxCell({ label: '聊天', onclick: () => Nav.push('wx', wxChatSettings) }), wxCell({ label: '通用', onclick: () => Nav.push('wx', wxBlank('通用', '这里什么都没有。')) })),
    el('div', { class: 'wx-group' }, wxCell({ label: `关于${appDef('wx').label}`, value: '版本 8.0', onclick: () => Nav.push('wx', wxBlank(`关于${appDef('wx').label}`, `${appDef('wx').label}是网页里模拟的聊天 App。${herName()}的消息由程序生成，不是真人。`)) })),
    el('p', { class: 'wx-hint' }, `${herName()}的人设、日程和回复方式，在手机桌面的「设置 → ${appDef('wx').label}」里改。`)));
}
function wxNotifyPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav('新消息通知'), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' },
      wxToggle('接收新消息通知（横幅）', () => S.notify.banner, v => { S.notify.banner = v; saveS(); }),
      wxToggle('网页在后台时弹系统通知', () => S.notify.system, async v => { if (v && !(await onNotifyToggle(true))) { S.notify.system = false; Nav.refresh('wx'); return; } S.notify.system = v; saveS(); })),
    el('p', { class: 'wx-hint' }, '系统通知只在网页还开着（哪怕切到后台）时有效。')));
}
function wxChatSettings(pg) {
  pg.classList.add('wx');
  const sel = el('select', { 'aria-label': `${TA()}发语音的频率` }, el('option', { value: 'never' }, '从不'), el('option', { value: 'sometimes' }, '偶尔'), el('option', { value: 'often' }, '经常'));
  sel.value = S.zx.voice; sel.addEventListener('change', () => { S.zx.voice = sel.value; saveS(); });
  if (!FEATURES.voice) { sel.disabled = true; sel.replaceChildren(el('option', {}, '待开发')); }
  pg.append(wxNav('聊天'), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' }, wxCell({ label: '聊天背景', onclick: () => Nav.push('wx', wxChatBgPage) })),
    el('div', { class: 'wx-group' }, el('label', { class: 'wx-cell noic' }, el('span', { class: 'lbl' }, `${herName()}发语音`), sel)),
    el('p', { class: 'wx-hint' }, `${TA()}的语音用手机自带的中文朗读声音播放；长按语音可以转文字。`)));
}

/* ---------- 搜索聊天记录 ---------- */
function wxSearchPage(pg) {
  pg.classList.add('wx');
  const input = el('input', { type: 'search', placeholder: '搜索聊天记录', 'aria-label': '搜索聊天记录' });
  const res = el('div', { class: 'wx-scroll' });
  pg.append(el('div', { class: 'wx-search-bar' }, el('label', {}, icon('search', 17, 2), input), el('button', { onclick: () => Nav.pop('wx') }, '取消')), res);
  input.addEventListener('input', () => {
    const q = input.value.trim(); res.textContent = '';
    if (!q) return;
    const hits = M.filter(m => (m.from === 'me' || m.from === 'her') && (m.type === 'text' || m.type === 'checkin') && (m.text || '').includes(q)).slice(-50).reverse();
    if (!hits.length) { res.append(el('p', { class: 'mo-empty' }, '没有找到相关的聊天记录')); return; }
    const grp = el('div', { class: 'wx-group' });
    for (const m of hits) {
      const i = m.text.indexOf(q), s = Math.max(0, i - 12);
      grp.append(el('button', { class: 'wx-hit', onclick: () => jumpTo(m.id) }, m.from === 'me' ? myAv() : herAv(),
        el('div', { style: 'flex:1;min-width:0' },
          el('b', {}, el('span', {}, m.from === 'me' ? (myName() || '我') : herName()), el('time', {}, listTime(m.ts))),
          el('p', {}, (s > 0 ? '…' : '') + m.text.slice(s, i), el('mark', {}, q), m.text.slice(i + q.length)))));
    }
    res.append(grp);
  });
  setTimeout(() => input.focus(), 380);
}
function jumpTo(id) {
  openThread(true);
  requestAnimationFrame(() => {
    const row = WXT && WXT.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!row) { toast('这条消息太早了，没有加载出来'); return; }
    row.scrollIntoView({ block: 'center' });
    row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1500);
  });
}
