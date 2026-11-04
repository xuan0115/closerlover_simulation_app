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
const zxName = () => ((S.home.wx && (S.home.wx.label || '').trim()) || (isEN() ? 'chatwe' : APPS.wx.short) || appDef('wx').label);
const meName = () => myName() || L('我', 'Me');
const WX_TABS = [['chats', zxName, 'chat'], ['contacts', () => L('通讯录', 'Contacts'), 'contacts'], ['discover', () => L('发现', 'Discover'), 'compass'], ['me', () => L('我', 'Me'), 'person']];
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
const wxBack = app => el('button', { class: 'wx-back', 'aria-label': L('返回', 'Back'), onclick: () => Nav.pop(app) }, icon('back', 24, 2));
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
/* chatwe 里显示的名字：你给她写了备注就用备注（和真微信一样），没写就用她的名字。AI 那边用的还是她的名字 */
const wxName = () => ((S.zx.remark || '').trim() || herName());
const wxTags = () => (S.zx.tags || '').split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);
const wxBlank = (title, text) => pg => { pg.classList.add('wx'); pg.append(wxNav(title), el('div', { class: 'wx-scroll' }, el('p', { class: 'mo-empty' }, text || L('暂无内容', 'Nothing here yet')))); };

/* ---------- 首页：四个 tab ---------- */
function wxRoot(pg) {
  pg.classList.add('wx');
  const title = el('h1', { class: 'wx-title' });
  const plusBtn = el('button', { class: 'wx-navbtn r', 'aria-label': L('更多', 'More'), onclick: () => toggleMenu() }, icon('plusCircle', 25, 1.6));
  const nav = el('header', { class: 'wx-nav' }, el('span'), title, plusBtn);
  const body = el('div', { class: 'wx-scroll' });
  const tabs = el('nav', { class: 'wx-tabs' });
  const dots = {};
  let menu = null;
  function toggleMenu(force) {
    if (menu || force === false) { if (menu) menu.remove(); menu = null; return; }
    const item = (ic, label, fn) => el('button', { onclick: () => { toggleMenu(false); fn(); } }, icon(ic, 21, 1.7), label);
    menu = el('div', { class: 'wx-menu', role: 'menu' },
      item('chat', L('发起群聊', 'New group chat'), () => Nav.push('wx', wxBlank(L('发起群聊', 'New group chat'), L('你只有一个朋友，还建不了群。', 'You only have one friend, so no group yet.')))),
      item('personAdd', L('添加朋友', 'Add friends'), () => Nav.push('wx', wxAddFriend)),
      item('scan', L('扫一扫', 'Scan'), () => openApp('camera')));
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
    title.textContent = { chats: zxName(), contacts: L('通讯录', 'Contacts'), discover: L('发现', 'Discover') }[wxTab] || '';
    body.textContent = ''; body.scrollTop = 0;
    ({ chats: wxChats, contacts: wxContacts, discover: wxDiscover, me: wxMe })[wxTab](body);
    pg.updateBadges();
  }
  pg.refresh = render; render();
}
function wxChats(body) {
  body.append(el('button', { class: 'wx-search', onclick: () => Nav.push('wx', wxSearchPage) }, icon('search', 17, 2), L('搜索', 'Search')));
  const last = [...M].reverse().find(m => m.from !== 'sys');
  const n = unreadList().length;
  let pv = last ? previewOf(last) : L('打个招呼吧', 'Say hi');
  if (n > 1) pv = L(`[${n}条] `, `[${n}] `) + pv;
  const dot = !n ? '' : S.zx.mute ? el('i', { class: 'wx-dot tiny' }) : el('i', { class: 'wx-dot' }, n > 99 ? '99+' : String(n));
  body.append(el('div', { class: 'wx-group' }, el('button', { class: 'wx-row' + (S.zx.pin ? ' pinned' : ''), onclick: () => openThread() },
    el('span', { class: 'wx-av' }, herAv(), dot),
    el('div', { class: 'wx-row-main' },
      el('div', { class: 'wx-row-top' }, el('b', {}, wxName()), el('time', {}, last ? listTime(last.ts, isEN()) : '')),
      el('div', { class: 'wx-row-sub' }, el('p', {}, pv), S.zx.mute ? el('span', { class: 'wx-mute' }, icon('bellOff', 15, 1.8)) : '')))));
}
function wxContacts(body) {
  const top = (ic, color, label, page) => wxCell({ ic, color, label, chev: false, onclick: () => Nav.push('wx', page) });
  body.append(el('div', { class: 'wx-group' },
    top('personAdd', '#FA9D3B', L('新的朋友', 'New friends'), wxBlank(L('新的朋友', 'New friends'), L('没有新的朋友', 'No new friends'))),
    top('person', '#FA9D3B', L('仅聊天的朋友', 'Chats only'), wxBlank(L('仅聊天的朋友', 'Chats only'), L('没有仅聊天的朋友', 'Nobody here'))),
    top('contacts', '#07C160', L('群聊', 'Group chats'), wxBlank(L('群聊', 'Group chats'), L('你还没有保存群聊', 'No saved group chats'))),
    top('tag', '#2782D7', L('标签', 'Tags'), wxBlank(L('标签', 'Tags'), wxTags().length ? L(`${wxTags().join('、')}：${wxName()}`, `${wxTags().join(', ')}: ${wxName()}`) : L('暂无标签', 'No tags'))),
    top('star', '#2782D7', L('公众号', 'Official accounts'), wxBlank(L('公众号', 'Official accounts'), L('还没有关注公众号', 'Not following any accounts')))),
    el('div', { class: 'wx-section' }, L('星标朋友', 'Starred friends')),
    el('div', { class: 'wx-group' }, el('button', { class: 'wx-row slim', onclick: () => Nav.push('wx', wxProfilePage) },
      el('span', { class: 'wx-av' }, herAv()), el('div', { class: 'wx-row-main' }, el('div', { class: 'wx-row-top' }, el('b', {}, wxName()))))),
    el('p', { class: 'wx-hint', style: 'text-align:center;padding-top:18px' }, L('1 个朋友', '1 friend')));
}
function wxDiscover(body) {
  const np = newPostsCount();
  const thumb = POSTS.length ? el('span', { class: 'thumb' }, herAv(), np ? el('i', { class: 'wx-dot tiny' }) : '') : '';
  const blank = (ic, color, label) => wxCell({ ic, color, label, onclick: () => Nav.push('wx', wxBlank(label)) });
  body.append(
    el('div', { class: 'wx-group' }, wxCell({ ic: 'aperture', color: '#E8673D', label: L('朋友圈', 'Moments'), value: thumb, onclick: () => Nav.push('wx', wxMomentsPage) })),
    el('div', { class: 'wx-group' }, blank('play', '#FA9D3B', L('视频号', 'Channels')), blank('live', '#FA5151', L('直播', 'Live'))),
    el('div', { class: 'wx-group' }, wxCell({ ic: 'scan', color: '#2782D7', label: L('扫一扫', 'Scan'), onclick: () => openApp('camera') })),
    el('div', { class: 'wx-group' }, blank('music', '#FA5151', L('听一听', 'Listen')), blank('eye', '#F7C443', L('看一看', 'Top stories')), blank('search', '#FA5151', L('搜一搜', 'Search'))),
    el('div', { class: 'wx-group' }, blank('grid', '#7D53D1', L('小程序', 'Mini programs'))));
}
function wxMe(body) {
  body.append(el('div', { class: 'wx-me-head' }, myAv(),
    el('div', { style: 'flex:1;min-width:0' }, el('b', {}, meName()), el('small', {}, L(`${zxName()}号：`, `${zxName()} ID: `) + myZxId()),
      el('span', { class: 'wx-status' }, L('+ 状态', '+ Status')))));
  body.append(
    el('div', { class: 'wx-group' }, wxCell({ ic: 'service', color: '#07C160', label: L('服务', 'Services'), onclick: () => Nav.push('wx', wxBlank(L('服务', 'Services'), L('这里什么都没有。', 'Nothing here.'))) })),
    el('div', { class: 'wx-group' },
      wxCell({ ic: 'box', color: '#FA9D3B', label: L('收藏', 'Favorites'), onclick: () => Nav.push('wx', wxFavsPage) }),
      wxCell({ ic: 'aperture', color: '#2782D7', label: L('朋友圈', 'Moments'), onclick: () => Nav.push('wx', wxMomentsPage) }),
      wxCell({ ic: 'smile', color: '#F7C443', label: L('表情', 'Stickers'), onclick: () => Nav.push('wx', wxBlank(L('表情', 'Stickers'), L('暂时只有系统自带的表情。', 'Only the built-in emoji for now.'))) })),
    el('div', { class: 'wx-group' }, wxCell({ ic: 'gear', color: '#2782D7', label: L('设置', 'Settings'), onclick: () => Nav.push('wx', wxSettingsPage) })));
}
function wxAddFriend(pg) {
  pg.classList.add('wx');
  pg.append(wxNav(L('添加朋友', 'Add friends')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-search', style: 'justify-content:flex-start;padding-left:14px' }, icon('search', 17, 2), L(`${zxName()}号/手机号`, `${zxName()} ID / phone`)),
    el('p', { class: 'wx-hint', style: 'text-align:center' }, L(`我的${zxName()}号：`, `My ${zxName()} ID: `) + myZxId()),
    el('div', { class: 'wx-group' },
      wxCell({ ic: 'scan', color: '#2782D7', label: L('扫一扫', 'Scan'), onclick: () => openApp('camera') }),
      wxCell({ ic: 'contacts', color: '#07C160', label: L('手机联系人', 'Phone contacts'), onclick: () => Nav.push('wx', wxBlank(L('手机联系人', 'Phone contacts'), L('没有可以添加的联系人', 'No contacts to add'))) }))));
}

/* ---------- 聊天 ---------- */
const aiNotice = () => S.reply.mode === 'template'
  ? L(`${herName()}的消息由预设模板自动生成，不是真人。`, `${herName()}'s messages come from preset templates. Not a real person.`)
  : L(`${herName()}的消息由 AI 生成，不是真人。`, `${herName()}'s messages are written by AI. Not a real person.`);
function previewOf(m) {
  if (m.from === 'tip') return m.text;
  switch (m.type) {
    case 'image': return L('[图片]', '[Photo]');
    case 'voice': return L('[语音] ', '[Voice] ') + `${m.dur}"`;
    case 'gift': return L('[礼物] ', '[Gift] ') + giftName(m.name);
    case 'call': return L('[语音通话]', '[Voice call]');
    default: return m.text;
  }
}

function wxThreadPage(pg) {
  pg.classList.add('wx', 'thread');
  const title = el('h1', { class: 'wx-title' }, wxName());
  const nav = el('header', { class: 'wx-nav line' }, wxBack('wx'), title,
    el('button', { class: 'wx-navbtn r', 'aria-label': L('聊天信息', 'Chat info'), onclick: () => Nav.push('wx', wxChatInfoPage) }, icon('more', 24)));
  const list = el('div', { class: 'wx-list' });
  const scroller = el('div', { class: 'wx-msgs' }, list);
  const compose = buildCompose();
  pg.append(nav, scroller, compose);
  WXT = { pg, list, scroller, title, compose };
  applyChatBg();
  scroller.addEventListener('scroll', closeMsgMenu);
  pg.addEventListener('pointerdown', e => { if (!e.target.closest('.wx-pop')) closeMsgMenu(); });
  pg.onclose = () => { if (WXT && WXT.pg === pg) WXT = null; };
  pg.refresh = () => { title.textContent = typingOn ? L('对方正在输入...', 'typing...') : wxName(); renderThread(); markRead(); };
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
  if (!prev || m.ts - prev.ts > 5 * 60e3) list.append(el('div', { class: 'wx-time' }, stampText(m.ts, isEN())));
  if (m.from === 'sys') {
    const row = el('div', { class: 'wx-sys' }, m.text);
    if (m.retry) row.append(el('button', { onclick: () => retry(m) }, L('重试', 'Retry')));
    list.append(row); return;
  }
  if (m.from === 'tip') {
    const row = el('div', { class: 'wx-tip', 'data-id': m.id }, m.text);
    if (m.edit) row.append(el('button', { onclick: () => { const ta = $('.wx-input', WXT.compose); setComposeMode('text'); ta.value = m.edit; ta.dispatchEvent(new Event('input')); ta.focus(); } }, L('重新编辑', 'Re-edit')));
    list.append(row); return;
  }
  const mine = m.from === 'me';
  const av = el('img', { class: 'av', alt: '' });
  if (mine) setMyAvatar(av); else { setAvatar(av); bindAvatarTaps(av); }
  const col = el('div', { class: 'wx-col' });
  let b;
  if (m.type === 'image') {
    b = el('button', { class: 'wx-pic', 'aria-label': L('查看图片', 'View photo') });
    const im = el('img', { alt: m.desc || L('图片', 'Photo') });
    im.addEventListener('load', () => scrollBottom());
    setImg(im, m.imageId); b.append(im);
    b.addEventListener('click', () => openViewer(m.imageId));
  } else if (m.type === 'voice') {
    const w = Math.min(210, 74 + (m.dur || 1) * 5);
    b = el('button', { class: 'wx-bubble voice', style: `width:${w}px`, 'aria-label': L(`语音 ${m.dur} 秒`, `Voice ${m.dur}s`) }, el('span', { class: 'wave' }, icon('wave', 20, 2)), el('span', {}, `${m.dur}"`));
    b.addEventListener('click', () => playVoice(m, b));
    col.append(b);
    if (!mine && !m.played) col.append(el('i', { class: 'wx-unplayed' }));
    if (m.showText) col.append(el('div', { class: 'wx-vtext' }, mine ? (m.transcript || L('没有识别出文字', 'No text recognized')) : m.text));
  } else if (m.type === 'gift') {
    b = el('div', { class: 'wx-gift' }, el('span', { class: 'em' }, m.emoji || '🎁'),
      el('div', {}, el('b', {}, m.note || (mine ? L(`送你${m.name}`, `A gift for you: ${giftName(m.name)}`) : L(`给你的${m.name}`, `For you: ${giftName(m.name)}`))), el('small', {}, giftName(m.name))),
      el('footer', {}, L(`${zxName()}礼物`, `${zxName()} gift`)));
  } else if (m.type === 'call') {
    const txt = m.status === 'done' ? L('通话时长 ', 'Duration ') + fmtDur(m.dur) : m.status === 'declined' ? L(mine ? '对方已拒绝' : '已拒绝', 'Declined') : m.status === 'cancel' ? L('已取消', 'Canceled') : (mine ? L('对方无应答', 'No answer') : L('未接听', 'Missed'));
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
  if (WXT) { WXT.title.textContent = on ? L('对方正在输入...', 'typing...') : wxName(); if (on) scrollBottom(); }
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
  addMsg({ id: uid('t'), from: 'tip', who: 'me', kind: 'pat', text: L(`我拍了拍「${wxName()}」`, `You nudged ${wxName()}`), ts: Date.now() });
  const row = WXT && WXT.list.lastElementChild; if (row) row.classList.add('shake');
  queueReply();
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
  if ((m.type === 'text' || m.type === 'checkin') && text) items.push(['copy', L('复制', 'Copy'), () => { copyText(text); }]);
  if (m.type === 'voice') items.push(['textT', m.showText ? L('取消转文字', 'Hide text') : L('转文字', 'To text'), () => { m.showText = !m.showText; saveM(); renderThread(); }]);
  if (['text', 'image', 'voice', 'checkin'].includes(m.type)) items.push(['quote', L('引用', 'Quote'), () => setQuote(m)]);
  if (['text', 'image', 'voice'].includes(m.type)) items.push(['box', L('收藏', 'Save'), () => { FAVS.push({ id: uid('f'), from: m.from, type: m.type, text: text || '', imageId: m.imageId || '', ts: Date.now(), src: m.ts }); saveFavs(); toast(L('已收藏', 'Saved to Favorites')); }]);
  if (mine && Date.now() - m.ts < 2 * 60e3 && m.type !== 'call') items.push(['recall', L('撤回', 'Recall'), () => recallMsg(m)]);
  items.push(['trash', L('删除', 'Delete'), () => { const i = M.indexOf(m); if (i >= 0) { M.splice(i, 1); saveM(); renderThread(); } }]);
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
  const done = () => toast(L('已复制', 'Copied'));
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
  else fallback();
  function fallback() { const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = t; document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
}
function recallMsg(m) {
  const i = M.indexOf(m); if (i < 0) return;
  M[i] = { id: m.id, from: 'tip', who: 'me', kind: 'recall', text: L('你撤回了一条消息', 'You recalled a message'), edit: m.type === 'text' ? m.text : null, ts: m.ts };
  saveM(); renderThread();
  if (Math.random() < .4) queueReply();
}
function setQuote(m) {
  const who = m.from === 'me' ? meName() : wxName();
  const text = m.type === 'image' ? L('[图片]', '[Photo]') : m.type === 'voice' ? (m.from === 'me' ? (m.transcript || L('[语音]', '[Voice]')) : m.text) : m.text;
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
  if (r.kind === 'event') { const ev = allEvents().find(e => e.id === r.id); if (ev) enqueue(() => runEvent(ev, { at: Date.now(), live: true })); }
  else enqueue(() => herTurn({ kind: 'reply', at: Date.now(), live: true, retry: { kind: 'reply' } }));
}

/* 我发消息：她过多久回、回几条，见 js/core/rhythm.js；连发几条会一起回 */
function sendMine(text, type = 'text', extra = {}) {
  if (!ST.started) { ST.started = true; ST.lastTick = Date.now(); saveST(); }
  const m = Object.assign({ id: uid('m'), from: 'me', type, text, ts: Date.now() }, extra);
  if (quoteDraft && (type === 'text' || type === 'voice')) { m.quote = quoteDraft; clearQuote(); }
  addMsg(m);
  queueReply();
}
/* 打卡：记一笔，再给她发一条消息 */
function doCheckin(id) {
  const t = taskById(id); if (!t) return;
  if (todayChecks()[id]) { toast(L(`今天${t.name}已经打过卡了`, `Already checked in for ${taskLabel(t)} today`)); return; }
  checkin(id, Date.now());
  sendMine(`${t.emoji || '✅'} ` + L(`开始${t.name}了`, `Starting ${taskLabel(t)} now`), 'checkin', { task: id });
}
function checkinSheet() {
  if (!S.tasks.length) { toast(L('督促清单是空的，去「设置 → 督促清单」加一项', 'Nothing to check in yet. Add one in 设置 → 督促清单.')); return; }
  const c = todayChecks();
  openSheet((p, close) => {
    p.append(sheetHead(L('打卡', 'Check in'), el('button', { onclick: close }, L('取消', 'Cancel'))),
      iosGroup('', S.tasks.map(t => el('button', { class: 'ios-row', disabled: !!c[t.id], onclick: () => { close(); doCheckin(t.id); } },
        el('span', { class: 'task-emoji' }, t.emoji || '✅'), el('span', { class: 'lbl' }, taskLabel(t), t.target ? el('small', {}, t.target) : ''),
        el('span', { class: 'val' }, c[t.id] ? L('已打卡 ', 'Done ') + hm(c[t.id]) : ''))), L(`打卡后会自动发消息告诉${herName()}。`, `${herName()} gets a message when you check in.`)));
  });
}
function giftSheet() {
  openSheet((p, close) => {
    let chosen = giftsFor()[0];
    const note = el('input', { placeholder: L('想说的话（可以不填）', 'Add a note (optional)'), 'aria-label': L('礼物附言', 'Gift note') });
    const grid = el('div', { class: 'gift-grid' });
    for (const g of giftsFor()) {
      const b = el('button', { 'aria-pressed': String(g === chosen), onclick: () => { chosen = g; $$('button', grid).forEach(x => x.setAttribute('aria-pressed', String(x === b))); } }, el('span', {}, g.emoji), giftName(g.name));
      grid.append(b);
    }
    p.append(sheetHead(L(`送${herName()}一份礼物`, `Send ${herName()} a gift`), el('button', { onclick: close }, L('取消', 'Cancel')),
      el('button', { onclick: () => { close(); sendMine('', 'gift', { name: chosen.name, emoji: chosen.emoji, note: note.value.trim() }); } }, L('送出', 'Send'))),
      grid, iosGroup('', [el('label', { class: 'ios-field' }, note)], L('礼物只是一张小卡片，不涉及钱。', 'A gift is just a little card. No money involved.')));
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
  const ta = el('textarea', { class: 'wx-input', rows: '1', enterkeyhint: 'send', 'aria-label': L('输入消息', 'Message') });
  const hold = el('button', { class: 'wx-hold' }, L('按住 说话', 'Hold to talk'));
  const send = el('button', { class: 'wx-send', hidden: true }, L('发送', 'Send'));
  const plus = el('button', { class: 'wx-cbtn', 'aria-label': L('更多功能', 'More') }, icon('plusCircle', 28, 1.5));
  const emo = el('button', { class: 'wx-cbtn', 'aria-label': L('表情', 'Emoji') }, icon('smile', 28, 1.5));
  const vk = el('button', { class: 'wx-cbtn vk', 'aria-label': L('切换语音和键盘', 'Voice or keyboard') }, icon('voice', 28, 1.5));
  const quoteBar = el('div', { class: 'wx-quote-bar', hidden: true }, el('span'), el('button', { 'aria-label': L('取消引用', 'Cancel quote'), onclick: clearQuote }, '✕'));
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
      g.append(t('photo', L('相册', 'Album'), pickFromFiles), t('camera', L('拍摄', 'Camera'), () => openApp('camera')), t('phone', FEATURES.voice ? L('语音通话', 'Voice call') : el('span', { class: 'soon-lbl' }, L('语音通话', 'Voice call'), el('small', {}, L('待开发', 'Coming soon'))), callOrSoon),
        t('gift', L('礼物', 'Gift'), giftSheet), t('checklist', L('打卡', 'Check in'), checkinSheet));
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
  vk.addEventListener('click', () => { if (!FEATURES.voice) { toast(L('语音消息（待开发）', 'Voice messages (coming soon)')); return; } if (mode) togglePanel(mode); setComposeMode(composeMode === 'voice' ? 'text' : 'voice'); if (composeMode === 'text') ta.focus(); });
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
const callOrSoon = () => FEATURES.voice ? startCall('out') : toast(L('语音通话（待开发）', 'Voice calls (coming soon)'));
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
  pg.append(wxNav(L('聊天信息', 'Chat Info')), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('div', { class: 'wx-members' },
      el('button', { onclick: () => Nav.push('wx', wxProfilePage) }, herAv(), wxName()),
      el('button', { class: 'add', 'aria-label': L('添加', 'Add'), onclick: () => Nav.push('wx', wxBlank(L('发起群聊', 'New group chat'), L('你只有一个朋友，还建不了群。', 'You only have one friend, so no group yet.'))) }, el('span', {}, icon('plus', 26, 1.5)), '')),
      el('div', { class: 'wx-group' }, wxCell({ label: L('查找聊天记录', 'Search chat history'), onclick: () => Nav.push('wx', wxSearchPage) })),
      el('div', { class: 'wx-group' },
        wxToggle(L('消息免打扰', 'Mute notifications'), () => S.zx.mute, v => { S.zx.mute = v; saveS(); updateBadges(); }),
        wxToggle(L('置顶聊天', 'Pin chat'), () => S.zx.pin, v => { S.zx.pin = v; saveS(); })),
      el('div', { class: 'wx-group' }, wxCell({ label: L('设置当前聊天背景', 'Set chat background'), onclick: () => Nav.push('wx', wxChatBgPage) })),
      el('div', { class: 'wx-group' }, el('button', { class: 'wx-cell danger', onclick: clearChat }, L('清空聊天记录', 'Clear chat history'))));
  }
}
function wxChatBgPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav(L('聊天背景', 'Chat Background')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' },
      wxCell({ label: L('从相册中选择', 'Choose from album'), onclick: async () => {
        const [f] = await pickFile('image/*'); if (!f) return;
        try { await IDB.put('chatbg', await compress(await fileToDataURL(f), 1280, .85)); imgCache.delete('chatbg'); S.zx.bg = true; saveS(); applyChatBg(); toast(L('已设置', 'Done')); } catch (e) { toast(e.message); }
      } }),
      wxCell({ label: L('恢复默认背景', 'Restore default'), onclick: () => { S.zx.bg = false; saveS(); IDB.del('chatbg').catch(() => {}); imgCache.delete('chatbg'); applyChatBg(); toast(L('已恢复', 'Restored')); } }))));
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
      el('b', {}, wxName(), el('span', { class: 'wx-gender ' + (S.her.gender === '男' ? 'm' : 'f'), 'aria-label': S.her.gender || '女' }, S.her.gender === '男' ? '♂' : '♀')),
      wxName() !== herName() ? el('small', {}, L('昵称：', 'Nickname: ') + herName()) : '',
      el('small', {}, L(`${zxName()}号：`, `${zxName()} ID: `) + zxId()),
      S.her.region ? el('small', {}, L('地区：', 'Region: ') + S.her.region) : '')));
    const thumbs = el('span', { class: 'wx-thumbs' });
    POSTS.filter(p => p.author === 'her' && p.imageIds && p.imageIds[0]).slice(-4).reverse().forEach(p => { const im = el('img', { alt: '' }); setImg(im, p.imageIds[0]); thumbs.append(im); });
    body.append(
      el('div', { class: 'wx-group' }, wxCell({ label: L('备注和标签', 'Remark and tags'), value: [(S.zx.remark || '').trim(), ...wxTags()].filter(Boolean).join('，'), onclick: () => Nav.push('wx', wxRemarkPage) }), wxCell({ label: L('朋友权限', 'Permissions'), onclick: () => Nav.push('wx', wxBlank(L('朋友权限', 'Permissions'), L('聊天、朋友圈都可见', 'Chats and Moments are visible'))) })),
      el('div', { class: 'wx-group' },
        wxCell({ label: L('朋友圈', 'Moments'), value: thumbs.childNodes.length ? thumbs : '', onclick: () => Nav.push('wx', wxMomentsPage) }),
        wxCell({ label: L('更多信息', 'More info'), onclick: () => Nav.push('wx', wxMoreInfoPage) })),
      el('div', { class: 'wx-group' },
        el('button', { class: 'wx-cell center', onclick: () => openThread() }, icon('chat', 22, 1.7), L('发消息', 'Message')),
        el('button', { class: 'wx-cell center', onclick: () => callOrSoon() }, icon('phone', 22, 1.7), FEATURES.voice ? L('语音通话', 'Voice call') : L('语音通话（待开发）', 'Voice call (coming soon)'))));
  }
}
/* 设置备注和标签：两行自己填。备注会替换 chatwe 里显示的名字；标签用逗号或空格分开 */
function wxRemarkPage(pg) {
  pg.classList.add('wx');
  const field = (key, label, ph) => {
    const inp = el('input', { class: 'wx-field', id: 'wx-' + key, type: 'text', maxlength: key === 'remark' ? '24' : '60', placeholder: ph, value: S.zx[key] || '', 'aria-label': label });
    inp.addEventListener('input', () => { S.zx[key] = inp.value; saveS(); });
    inp.addEventListener('change', () => { S.zx[key] = inp.value.trim(); saveS(); updateBadges(); });
    return el('label', { class: 'wx-cell noic' }, el('span', { class: 'lbl wx-flbl' }, label), inp);
  };
  pg.append(wxNav(L('设置备注和标签', 'Remark and tags')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-section' }, L('备注', 'Remark')),
    el('div', { class: 'wx-group' }, field('remark', L('备注', 'Remark'), herName())),
    el('div', { class: 'wx-section' }, L('标签', 'Tags')),
    el('div', { class: 'wx-group' }, field('tags', L('标签', 'Tags'), L('比如：家人、最重要的人', 'e.g. family, my person'))),
    el('p', { class: 'wx-hint' }, L(`备注只改你这边看到的名字：聊天列表、聊天标题、朋友圈都会显示备注。${TA()}还是叫「${herName()}」。多个标签用逗号或空格分开。`,
      `The remark only changes what you see in chatwe: chat list, chat title and Moments. ${herName()} still goes by ${herName()}. Separate tags with commas or spaces.`))));
}
function wxMoreInfoPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav(L('更多信息', 'More info')), el('div', { class: 'wx-scroll' }, el('div', { class: 'wx-group' },
    wxCell({ label: L('个性签名', 'Bio'), value: S.her.signature || L('未填写', 'None') }),
    wxCell({ label: L('星座', 'Zodiac'), value: zodiacName(S.her.zodiac) || L('未设定', 'Not set') }),
    wxCell({ label: L('来源', 'Source'), value: L(`通过搜索${zxName()}号添加`, `Added by searching ${zxName()} ID`) }))));
}

/* ---------- 朋友圈 ---------- */
function wxMomentsPage(pg) {
  pg.classList.add('wx', 'moments', 'ink-light');
  ST.seenPosts = Date.now(); ST.momentNews = 0; saveST(); updateBadges();
  const scroll = el('div', { class: 'wx-scroll' });
  const bar = el('form', { class: 'mo-bar', hidden: true });
  const inp = el('input', { 'aria-label': L('评论', 'Comment'), placeholder: L('评论', 'Comment') });
  bar.append(inp, el('button', { class: 'wx-send' }, L('发送', 'Send')));
  let target = null;
  bar.addEventListener('submit', e => { e.preventDefault(); const t = inp.value.trim(); if (!t || !target) return; inp.value = ''; bar.hidden = true; addComment(target, t); target = null; });
  pg.append(scroll, el('header', { class: 'wx-nav clear' }, wxBack('wx'), el('span'),
    el('button', { class: 'wx-navbtn r', 'aria-label': L('发表', 'Post'), onclick: postMineSheet }, icon('camera', 24, 1.8))), bar);
  pg.refresh = render; render();
  pg.comment = p => { target = p; bar.hidden = false; inp.placeholder = L('评论', 'Comment'); inp.focus(); };
  pg.closeMenu = () => { const pop = $('.mo-pop', pg); if (pop) { pop.remove(); return true; } if (!bar.hidden) { bar.hidden = true; return true; } return false; };
  pg.addEventListener('pointerdown', e => { if (!e.target.closest('.mo-pop,.mo-more')) $$('.mo-pop', pg).forEach(x => x.remove()); });
  function render() {
    const y = scroll.scrollTop;
    scroll.textContent = '';
    const cover = el('div', { class: 'mo-cover' });
    const pid = latestPhotoId();
    if (pid) imgSrc(pid).then(s => { if (s) cover.style.backgroundImage = `url("${s}")`; });
    cover.append(el('div', { class: 'mo-owner' }, el('b', {}, meName()), myAv()));
    scroll.append(cover);
    const posts = [...POSTS].sort((a, b) => b.ts - a.ts);
    if (!posts.length) scroll.append(el('p', { class: 'mo-empty' }, L(`还没有朋友圈。${herName()}会按日程发；你也可以点右上角发一条。`, `No Moments yet. ${herName()} posts from time to time, and you can post one from the top right.`)));
    for (const p of posts) scroll.append(momentPost(p, pg));
    scroll.scrollTop = y;
  }
}
function momentPost(p, pg) {
  const byMe = p.author === 'me';
  const name = byMe ? meName() : wxName();
  const main = el('div', { class: 'mo-main' }, el('b', {}, name), p.text ? el('p', {}, p.text) : '');
  if (p.imageIds && p.imageIds[0]) {
    const im = el('img', { alt: p.text || L('照片', 'Photo') }); setImg(im, p.imageIds[0]);
    main.append(el('button', { class: 'mo-pic', onclick: () => openViewer(p.imageIds[0]) }, im));
  }
  const more = el('button', { class: 'mo-more', 'aria-label': L('赞和评论', 'Like and comment') }, icon('more', 18));
  main.append(el('div', { class: 'mo-meta' }, el('span', {}, relTime(p.ts, isEN()).replace('现在', '刚刚')), more));
  const likers = [p.likes && p.likes.her ? wxName() : '', p.likes && p.likes.me ? meName() : ''].filter(Boolean);
  const cm = p.comments || [];
  if (likers.length || cm.length) {
    const box = el('div', { class: 'mo-box' });
    if (likers.length) box.append(el('div', { class: 'mo-likes' }, icon('heart', 14, 2), likers.join(L('，', ', '))));
    for (const c of cm) {
      const who = c.from === 'me' ? meName() : wxName();
      const to = c.to ? (c.to === 'me' ? meName() : wxName()) : '';
      box.append(el('div', { class: 'mo-cm' }, el('b', {}, who), to ? [L(' 回复 ', ' → '), el('b', {}, to)] : '', L('：', ': ') + c.text));
    }
    main.append(box);
  }
  const node = el('div', { class: 'mo-post' }, byMe ? myAv() : herAv(), main);
  more.addEventListener('click', () => {
    $$('.mo-pop', pg).forEach(x => x.remove());
    const liked = p.likes && p.likes.me;
    const pop = el('div', { class: 'mo-pop' },
      el('button', { onclick: () => { p.likes = Object.assign({}, p.likes, { me: !liked }); savePosts(); pop.remove(); node.replaceWith(momentPost(p, pg)); } }, icon('heart', 17, 1.8), liked ? L('取消', 'Unlike') : L('赞', 'Like')),
      el('button', { onclick: () => { pop.remove(); pg.comment(p); } }, icon('chat', 17, 1.8), L('评论', 'Comment')));
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
    const ta = el('textarea', { rows: '4', placeholder: L('这一刻的想法…', "What's on your mind…"), 'aria-label': L('朋友圈文字', 'Post text') });
    let imageId = null;
    const thumb = el('button', { class: 'mo-add', 'aria-label': L('添加照片', 'Add photo'), onclick: async () => {
      const [f] = await pickFile('image/*'); if (!f) return;
      const d = await compress(await fileToDataURL(f), 1280, .86); imageId = uid('mp'); await IDB.put(imageId, d); imgCache.set(imageId, d);
      thumb.replaceChildren(el('img', { src: d, alt: '' }));
    } }, icon('plus', 30, 1.4));
    p.append(sheetHead(L('发表文字', 'New post'), el('button', { onclick: close }, L('取消', 'Cancel')), el('button', { onclick: () => {
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
    } }, L('发表', 'Post'))), iosGroup('', [el('label', { class: 'ios-field' }, ta), el('div', { class: 'pic-row' }, thumb)]));
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
  pg.append(wxNav(L('收藏', 'Favorites')), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    if (!FAVS.length) { body.append(el('p', { class: 'mo-empty' }, L('长按聊天里的消息，可以收藏到这里。', 'Long-press a message in a chat to save it here.'))); return; }
    for (const f of [...FAVS].reverse()) {
      const who = f.from === 'me' ? meName() : wxName();
      const content = f.type === 'image' ? (() => { const im = el('img', { alt: '' }); setImg(im, f.imageId); return el('button', { class: 'fav-pic', onclick: () => openViewer(f.imageId) }, im); })() : el('p', {}, f.type === 'voice' ? L('[语音] ', '[Voice] ') + f.text : f.text);
      body.append(el('div', { class: 'fav' }, content, el('small', {}, `${who}　${listTime(f.ts, isEN())}`,
        el('button', { onclick: () => { FAVS = FAVS.filter(x => x !== f); saveFavs(); render(); } }, L('删除', 'Delete')))));
    }
  }
}

/* ---------- 我 → 设置 ---------- */
function wxSettingsPage(pg) {
  pg.classList.add('wx');
  const app = appDef('wx').label;
  pg.append(wxNav(L('设置', 'Settings')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' }, wxCell({ label: L('新消息通知', 'Notifications'), onclick: () => Nav.push('wx', wxNotifyPage) })),
    el('div', { class: 'wx-group' }, wxCell({ label: L('聊天', 'Chats'), onclick: () => Nav.push('wx', wxChatSettings) }), wxCell({ label: L('通用', 'General'), onclick: () => Nav.push('wx', wxBlank(L('通用', 'General'), L('这里什么都没有。', 'Nothing here.'))) })),
    el('div', { class: 'wx-group' }, wxCell({ label: L(`关于${app}`, `About ${app}`), value: L('版本 8.0', 'Version 8.0'), onclick: () => Nav.push('wx', wxBlank(L(`关于${app}`, `About ${app}`), L(`${app}是网页里模拟的聊天 App。${herName()}的消息由程序生成，不是真人。`, `${app} is a simulated chat app on a web page. ${herName()}'s messages are generated by a program, not a real person.`))) })),
    el('p', { class: 'wx-hint' }, L(`${herName()}的人设、日程和回复方式，在手机桌面的「设置 → ${app}」里改。`, `${herName()}'s profile, schedule, reply mode and language are in the phone's 设置 → ${app}.`))));
}
function wxNotifyPage(pg) {
  pg.classList.add('wx');
  pg.append(wxNav(L('新消息通知', 'Notifications')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' },
      wxToggle(L('接收新消息通知（横幅）', 'Show banners'), () => S.notify.banner, v => { S.notify.banner = v; saveS(); }),
      wxToggle(L('网页在后台时弹系统通知', 'System notifications in background'), () => S.notify.system, async v => { if (v && !(await onNotifyToggle(true))) { S.notify.system = false; Nav.refresh('wx'); return; } S.notify.system = v; saveS(); })),
    el('p', { class: 'wx-hint' }, L('系统通知只在网页还开着（哪怕切到后台）时有效。', 'System notifications only work while the page is still open, even in the background.'))));
}
function wxChatSettings(pg) {
  pg.classList.add('wx');
  const sel = el('select', { 'aria-label': L(`${TA()}发语音的频率`, 'Voice message frequency') }, el('option', { value: 'never' }, L('从不', 'Never')), el('option', { value: 'sometimes' }, L('偶尔', 'Sometimes')), el('option', { value: 'often' }, L('经常', 'Often')));
  sel.value = S.zx.voice; sel.addEventListener('change', () => { S.zx.voice = sel.value; saveS(); });
  if (!FEATURES.voice) { sel.disabled = true; sel.replaceChildren(el('option', {}, L('待开发', 'Coming soon'))); }
  pg.append(wxNav(L('聊天', 'Chats')), el('div', { class: 'wx-scroll' },
    el('div', { class: 'wx-group' }, wxCell({ label: L('聊天背景', 'Chat Background'), onclick: () => Nav.push('wx', wxChatBgPage) })),
    el('div', { class: 'wx-group' }, el('label', { class: 'wx-cell noic' }, el('span', { class: 'lbl' }, L(`${herName()}发语音`, `Voice messages from ${herName()}`)), sel)),
    el('p', { class: 'wx-hint' }, L(`${TA()}的语音用手机自带的中文朗读声音播放；长按语音可以转文字。`, 'Voice messages play with the phone\'s built-in voice. Long-press one to see it as text.'))));
}

/* ---------- 搜索聊天记录 ---------- */
function wxSearchPage(pg) {
  pg.classList.add('wx');
  const input = el('input', { type: 'search', placeholder: L('搜索聊天记录', 'Search chat history'), 'aria-label': L('搜索聊天记录', 'Search chat history') });
  const res = el('div', { class: 'wx-scroll' });
  pg.append(el('div', { class: 'wx-search-bar' }, el('label', {}, icon('search', 17, 2), input), el('button', { onclick: () => Nav.pop('wx') }, L('取消', 'Cancel'))), res);
  input.addEventListener('input', () => {
    const q = input.value.trim(); res.textContent = '';
    if (!q) return;
    const hits = M.filter(m => (m.from === 'me' || m.from === 'her') && (m.type === 'text' || m.type === 'checkin') && (m.text || '').includes(q)).slice(-50).reverse();
    if (!hits.length) { res.append(el('p', { class: 'mo-empty' }, L('没有找到相关的聊天记录', 'No results'))); return; }
    const grp = el('div', { class: 'wx-group' });
    for (const m of hits) {
      const i = m.text.indexOf(q), s = Math.max(0, i - 12);
      grp.append(el('button', { class: 'wx-hit', onclick: () => jumpTo(m.id) }, m.from === 'me' ? myAv() : herAv(),
        el('div', { style: 'flex:1;min-width:0' },
          el('b', {}, el('span', {}, m.from === 'me' ? meName() : wxName()), el('time', {}, listTime(m.ts, isEN()))),
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
    if (!row) { toast(L('这条消息太早了，没有加载出来', 'That message is too old to load')); return; }
    row.scrollIntoView({ block: 'center' });
    row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1500);
  });
}
