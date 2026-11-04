/*
 * 「设置」：照手机系统设置的样子做。系统那几栏大多是仿真；
 * 下面「App」里的「知己」进去，就是她的人设、你们的关系、日程、照片池、回复方式这些。
 * 每个子页面都是 (pg, app) => {}，在别的 App 里也能推进来。
 */
'use strict';

/* ---------- 表单小部件（直接读写 S 里的某个路径，比如 'her.name'） ---------- */
const getP = p => p.split('.').reduce((o, k) => o == null ? o : o[k], S);
function setP(p, v) { const ks = p.split('.'); let o = S; for (const k of ks.slice(0, -1)) o = o[k]; o[ks[ks.length - 1]] = v; saveSLater(); }
function grow(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

function fText(path, label, o = {}) {
  const i = el('input', { type: o.type || 'text', placeholder: o.ph || '', autocomplete: o.type === 'password' ? 'new-password' : 'off', spellcheck: 'false' });
  i.value = getP(path) || '';
  i.addEventListener('input', () => { setP(path, i.value); if (o.oninput) o.oninput(i.value); });
  return el('label', { class: 'ios-field' }, el('span', {}, label), o.btn ? el('div', { class: 'with-btn' }, i, o.btn) : i);
}
function fArea(path, label, ph) {
  const t = el('textarea', { rows: '1', placeholder: ph || '' });
  t.value = getP(path) || '';
  t.addEventListener('input', () => { setP(path, t.value); grow(t); });
  requestAnimationFrame(() => grow(t));
  return el('label', { class: 'ios-field' }, el('span', {}, label), t);
}
function fSelect(path, label, opts, onchange) {
  const s = el('select', {});
  for (const [v, t] of opts) { const o = el('option', { value: v }, t); if (String(getP(path) || '') === v) o.selected = true; s.append(o); }
  s.addEventListener('change', () => { setP(path, s.value); saveS(); if (onchange) onchange(s.value); });
  return el('label', { class: 'ios-field' }, el('span', {}, label), s);
}
function fToggle(path, label, onchange, ic, color) {
  const c = el('input', { type: 'checkbox', class: 'sw', 'aria-label': label });
  c.checked = !!getP(path);
  c.addEventListener('change', async () => {
    const ok = onchange ? await onchange(c.checked) : true;
    if (ok === false) { c.checked = !c.checked; return; }
    setP(path, c.checked); saveS(); syncStatusIcons();
  });
  return el('label', { class: 'ios-row' + (ic ? ' has-ic' : '') }, ic ? el('span', { class: 'ios-ic', style: `background:${color}` }, icon(ic, 19, 2)) : '', el('span', { class: 'lbl' }, label), c);
}
const miniBtn = (text, fn) => el('button', { class: 'mini', type: 'button', onclick: e => { e.preventDefault(); fn(e.currentTarget); } }, text);

/* 子页面骨架：顶栏 + 可重画的内容 */
function subPage(pg, app, title, build, back) {
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { title, back: back || (app === 'settings' ? APPS.settings.label : '返回') }), body);
  const render = () => { const y = body.scrollTop; body.textContent = ''; build(body, render); body.scrollTop = y; };
  pg.refresh = render; render();
}
function avatarRow(who, rerender) {
  const isHer = who === 'her';
  const av = el('img', { alt: '' }); isHer ? setAvatar(av) : setMyAvatar(av);
  const obj = isHer ? S.her : S.me;
  return el('div', { class: 'pic-row' }, av, el('div', { class: 'grow' }, '头像'), el('div', { class: 'acts' },
    miniBtn('换一张', async () => {
      const [f] = await pickFile('image/*'); if (!f) return;
      try { obj.avatar = await compress(await fileToDataURL(f), 240, .85, true); saveS(); rerender(); } catch (e) { toast(e.message); }
    }),
    obj.avatar ? miniBtn('用默认', () => { obj.avatar = ''; saveS(); rerender(); }) : ''));
}
const zodiacOpts = () => [['', '不设定'], ...ZODIAC_NAMES.map(n => [n, `${n}（${ZODIAC[n].dates}）`])];
const zx = () => appDef('wx').label;

/* 仿真的系统设置页：几行开关和说明 */
const decoPage = (title, rows, foot) => (pg, app) => subPage(pg, app, title, b => {
  b.append(iosGroup('', rows.map(r => typeof r === 'string'
    ? el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, r))
    : r[1] === 'toggle' ? (() => { const c = el('input', { type: 'checkbox', class: 'sw' }); c.checked = r[2] !== false; return el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, r[0]), c); })()
      : el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, r[0]), el('span', { class: 'val' }, r[1])))), foot);
});

/* ---------- 首页 ---------- */
function settingsRoot(pg, app) {
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { flat: true }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    const go = fn => () => Nav.push(app, p => fn(p, app));
    body.append(el('h1', { class: 'ios-large' }, APPS.settings.label),
      el('div', { class: 'ios-searchbox' }, icon('search', 17, 2), '搜索'));
    if (!ST.started) body.append(el('div', { class: 'intro' },
      el('p', {}, `先到下面的「${zx()}」里，设定${TA()}是谁、你们是什么关系。回复方式默认是知己内置 AI，登录后就能用，不用填 Key。`),
      el('button', { class: 'btn primary wide', onclick: start }, '设好了，开始')));
    const av = el('img', { alt: '' }); setMyAvatar(av);
    body.append(el('div', { class: 'ios-card', style: 'margin-top:14px' }, el('button', { class: 'profile-card', onclick: go(settingsMePage) }, av,
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, myName() || '我'), el('small', {}, '我的资料、性别与星座')),
      el('span', { style: 'color:var(--sys-ink3)' }, icon('chevron', 18, 2.2)))));
    body.append(iosGroup('', [iosLink({ ic: 'checklist', color: '#FF9500', label: '督促清单', value: S.tasks.length ? `${S.tasks.length} 项` : '', onclick: go(tasksPage) }),
      el('button', { class: 'ios-row has-ic', onclick: go(settingsZxPage) }, appIcon('wx', 30), el('span', { class: 'lbl' }, zx()),
        el('span', { class: 'val' }, herName()), el('span', { class: 'chev' }, icon('chevron', 18, 2.2)))]));
    body.append(iosGroup('', [
      fToggle('notify.airplane', '飞行模式', v => { if (!v) setTimeout(tick, 300); return true; }, 'plane', '#FF9500'),
      iosLink({ ic: 'wifi', color: '#007AFF', label: '无线局域网', value: S.look.wifi ? '家' : '关闭', onclick: go(settingsWifiPage) }),
      iosLink({ ic: 'bluetooth', color: '#007AFF', label: '蓝牙', value: '打开', onclick: go(decoPage('蓝牙', [['蓝牙', 'toggle']])) }),
      iosLink({ ic: 'antenna', color: '#34C759', label: '蜂窝网络', onclick: go(decoPage('蜂窝网络', [['蜂窝数据', 'toggle'], ['数据漫游', 'toggle', false]])) }),
      iosLink({ ic: 'link2', color: '#34C759', label: '个人热点', value: '关闭', onclick: go(decoPage('个人热点', [['允许其他人加入', 'toggle', false]])) })],
      S.notify.airplane ? `飞行模式下，${herName()}暂时联系不上你；关掉后，这段时间错过的消息会补上。` : ''));
    body.append(iosGroup('', [
      iosLink({ ic: 'bell', color: '#FF3B30', label: '通知', onclick: go(settingsNotifyPage) }),
      iosLink({ ic: 'sound', color: '#FF2D55', label: '声音与触感', onclick: go(decoPage('声音与触感', [['静音模式', 'toggle', false], ['键盘反馈', 'toggle']])) }),
      iosLink({ ic: 'moon', color: '#5E5CE6', label: '专注模式', value: S.notify.focus ? FOCUS_MODES[S.notify.focusMode].label : '', onclick: go(settingsFocusPage) }),
      iosLink({ ic: 'hourglass', color: '#5E5CE6', label: '屏幕使用时间', onclick: go(settingsScreenTimePage) })]));
    body.append(iosGroup('', [
      iosLink({ ic: 'gear', color: '#8E8E93', label: '通用', onclick: go(settingsGeneralPage) }),
      iosLink({ ic: 'sliders', color: '#8E8E93', label: '控制中心', onclick: go(decoPage('控制中心', ['手电筒', '相机', '计算器'], '这些开关只是样子。')) }),
      iosLink({ ic: 'sun', color: '#007AFF', label: '显示与亮度', onclick: go(decoPage('显示与亮度', [['自动', 'toggle'], ['文字大小', '标准']])) }),
      iosLink({ ic: 'apps', color: '#5856D6', label: '主屏幕与 App 资源库', onclick: go(settingsHomePage) }),
      iosLink({ ic: 'access', color: '#007AFF', label: '辅助功能', onclick: go(decoPage('辅助功能', [['旁白', '关闭'], ['缩放', '关闭']])) }),
      iosLink({ ic: 'wall', color: '#32ADE6', label: '墙纸', onclick: go(settingsWallPage) })]));
    body.append(iosGroup('', [
      iosLink({ ic: 'battery', color: '#34C759', label: '电池', onclick: go(settingsBatteryPage) }),
      iosLink({ ic: 'hand', color: '#007AFF', label: '隐私与安全性', onclick: go(settingsPrivacyPage) })]));
  }
}

/* ---------- App → 知己 ---------- */
function settingsZxPage(pg, app) {
  subPage(pg, app, zx(), b => {
    const go = fn => () => Nav.push(app, p => fn(p, app));
    const av = el('img', { alt: '' }); setAvatar(av);
    b.append(el('div', { class: 'ios-card', style: 'margin-top:14px' }, el('button', { class: 'profile-card', onclick: go(settingsHerPage) }, av,
      el('div', { style: 'flex:1;min-width:0' }, el('b', {}, herName()), el('small', {}, [S.her.gender, S.her.zodiac, (S.her.job || '').split(/[，,]/)[0]].filter(Boolean).join(' · ') || '基本人设、社会人设')),
      el('span', { style: 'color:var(--sys-ink3)' }, icon('chevron', 18, 2.2)))));
    b.append(iosGroup(`${TA()}`, [
      iosLink({ ic: 'heart', color: '#FF2D55', label: `${TA()}的人设`, onclick: go(settingsHerPage) }),
      iosLink({ ic: 'link', color: '#FF375F', label: '你们的关系', value: (REL_TYPES[S.her.relType] || REL_TYPES.lover).label + (S.her.callMe ? ` · 叫你「${S.her.callMe}」` : ''), onclick: go(settingsRelPage) }),
      iosLink({ ic: 'note', color: '#FF9F0A', label: `${TA()}记得的事`, value: S.memory.length ? `${S.memory.length} 条` : '', onclick: go(settingsMemoryPage) })]));
    b.append(iosGroup('互动', [
      iosLink({ ic: 'clock', color: '#30B0C7', label: `${TA()}什么时候找你`, value: `${S.events.filter(e => e.on).length} 条`, onclick: go(plansPage) }),
      fSelect('zx.speed', '回复速度', Object.entries(SPEEDS)),
      iosLink({ ic: 'calendar', color: '#FF3B30', label: '倒数日', value: S.countdown.title, onclick: () => editCountdown(() => Nav.refresh(app)) }),
      iosLink({ ic: 'photo', color: '#FF9500', label: '照片池', value: POOL.length ? `${POOL.length} 张` : '', onclick: go(poolPage) }),
      iosLink({ ic: 'sparkle', color: '#AF52DE', label: '回复方式', value: (REPLY_MODES[S.reply.mode] || REPLY_MODES.template).label, onclick: go(settingsReplyPage) }),
      iosLink({ ic: 'camera', color: '#8E8E93', label: 'AI 生成照片', value: { pool: '关闭', pool_then_gen: '照片池用完时', gen: '每次' }[S.photo.mode], onclick: go(settingsPhotoPage) })]));
    b.append(iosGroup('', [iosLink({ ic: 'globe', color: '#007AFF', label: '语言', value: isEN() ? 'English' : '中文', onclick: go(settingsLangPage) })]));
    b.append(iosGroup('', [iosLink({ ic: 'box', color: '#8E8E93', label: '数据与备份', onclick: go(settingsDataPage) })]));
  }, APPS.settings.label);
}

/* ---------- chatwe 的语言（规范第 12 节）：像 iPhone 给单个 App 设语言，只改 chatwe ---------- */
function settingsLangPage(pg, app) {
  subPage(pg, app, '语言', (b, re) => {
    const opt = (v, label) => el('button', { class: 'ios-row', onclick: () => {
      if (S.zx.lang === v) return;
      S.zx.lang = v; saveS(); re(); if (Nav.stacks.wx) Nav.refresh('wx'); if (WXT) renderThread(); renderHome();
    } }, el('span', { class: 'lbl' }, label), S.zx.lang === v ? el('span', { class: 'check' }, icon('check', 20, 2.4)) : '');
    b.append(iosGroup(`${zx()} 的语言`, [opt('zh', '中文'), opt('en', 'English')],
      `只改 ${zx()} 里的界面和${TA()}的消息，手机其他地方仍是中文。之前的聊天记录不会被翻译。`));
    if (!isEN()) return;
    b.append(iosGroup('练英语', [
      fSelect('zx.enLevel', '用词难度', [['edu', `按${TA()}的学历`], ['easy', '简单'], ['daily', '日常'], ['native', '地道（带俚语）']]),
      fToggle('zx.correct', '顺口纠正我的英文')],
      `顺口纠错只在 AI 回复方式下有：你写错时，${TA()}会像朋友一样顺口带出正确说法。选「按${TA()}的学历」时，用词跟着${TA()}的人设走。`),
      iosGroup('', [fText('her.callMeEn', `英文里${TA()}怎么叫你`, { ph: 'babe、honey，或你的英文名；留空就叫你的名字' })],
        '督促清单每一项的英文名，在「设置 → 督促清单」里填。'));
  });
}

/* ---------- 她 ---------- */
function settingsHerPage(pg, app) {
  subPage(pg, app, `${TA()}的人设`, (b, re) => {
    const z = S.her.zodiac && ZODIAC[S.her.zodiac], edu = EDU_LEVELS[S.her.edu];
    const title = () => { const h = pg.querySelector('.ios-nav h2'); if (h) h.textContent = `${TA()}的人设`; };
    b.append(iosGroup('基本人设', [avatarRow('her', re), fText('her.name', '名字'),
      fSelect('her.gender', '性别', [['女', '女'], ['男', '男']], () => { title(); re(); }),
      fSelect('her.zodiac', '星座', zodiacOpts(), re),
      fText('her.region', '所在地', { ph: '比如：上海 杨浦' })],
      z ? `${S.her.zodiac}给人的印象：${z.traits}。AI 模式会参考，模板模式下${TA()}偶尔会聊到星座。` : `星座会出现在${TA()}的资料页，也会影响${TA()}偶尔说的话。`));
    const social = [fSelect('her.edu', '学历', [['', '不设定'], ...Object.entries(EDU_LEVELS).map(([k, v]) => [k, v.label])], re)];
    if (edu && edu.major) social.push(fText('her.major', '专业', { ph: '比如：计算机、社会学、临床医学' }));
    social.push(
      fText('her.job', '工作', { ph: '比如：程序员、在读博士生、调酒师' }),
      fSelect('her.siblings', '家庭情况', [['', '不设定'], ...Object.entries(SIBLINGS)]),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '收入状况'), el('span', { class: 'val locked' }, icon('lock', 15, 2), '系统生成')));
    b.append(iosGroup('社会人设', social, `AI 模式下，这些会写进${TA()}的设定，影响${TA()}聊的话题和生活细节。收入状况由系统根据学历、工作和所在地生成，你看不到，${TA()}也不会直接说出来。`));
    b.append(iosGroup('性格', [
      fSelect('her.type', '模板模式的语气', Object.entries(TEMPLATE_TYPES), re),
      fArea('her.personality', '性格（AI 用，自由描述）'),
      fArea('her.style', '说话方式（AI 用）', '口头禅、语气、爱不爱用表情')],
      '固定模板模式只认上面的「语气」，三种台词在 js/data/templates.js 里，可以自己改、自己加。'));
    b.append(iosGroup(`${TA()}的生活`, [
      fArea('her.identity', '补充说明', '年龄、一个人住还是和家人住、养了什么……'),
      fArea('her.routine', `${TA()}平时的一天`, `${TA()}每天大概在做什么，聊天时会用上`),
      fArea('her.looks', '外貌', '只在 AI 生成照片时用'),
      fText('her.signature', '个性签名')]));
  });
}
function settingsRelPage(pg, app) {
  subPage(pg, app, '你们的关系', (b, re) => {
    const locked = !!ST.started, cur = S.her.relType || 'lover';
    const seg = el('div', { class: 'seg' + (locked ? ' locked' : ''), role: 'group', 'aria-label': '关系类型' }, ...Object.entries(REL_TYPES).map(([k, v]) =>
      el('button', { 'aria-pressed': String(cur === k), disabled: locked && cur !== k, onclick: () => { if (!locked && k !== cur) { switchRelType(k); re(); } } }, v.label)));
    b.append(iosGroup('关系类型', [el('div', { class: 'ios-field' }, seg)], locked
      ? `开始聊天以后就不能换了，免得${TA()}的人设前后冲突。想换的话：设置 → 通用 → 数据与备份 → 全部恢复默认。`
      : `恋人会说想你、会撒娇；挚友不说情话，是损友式的关心。开始聊天以后就不能换了。`));
    b.append(iosGroup('', [fArea('her.relationship', '你们是什么关系', '认识多久、怎么认识的、平时怎么相处')], `AI 模式会按这段话决定${TA()}跟你说话的分寸。`),
      iosGroup('', [fText('her.callMe', `${TA()}平时怎么叫你`, { ph: cur === 'friend' ? '名字或外号，留空就叫你的名字' : '一个短称呼，比如：宝贝、小宝、亲爱的' })], '模板里的 {称呼} 就是它。'));
  });
}
/* 换关系类型（只在开始之前）：还是默认值的称呼、关系描述、倒数日跟着换 */
function switchRelType(k) {
  const from = REL_TYPES[S.her.relType || 'lover'], to = REL_TYPES[k];
  if (!to) return;
  if ((S.her.callMe || '') === from.callMe) S.her.callMe = to.callMe;
  if ((S.her.callMeEn || '') === from.callMeEn) S.her.callMeEn = to.callMeEn;
  if ((S.her.relationship || '') === from.relationship) S.her.relationship = to.relationship;
  if (S.countdown.title === from.countdown) S.countdown.title = to.countdown;
  S.her.relType = k; saveS(); renderHome();
}
function settingsMePage(pg, app) {
  subPage(pg, app, '我的资料', (b, re) => {
    const rows = [avatarRow('me', re), fText('me.name', '我的名字或昵称'), fSelect('me.gender', '性别', MY_GENDERS, re)];
    if (S.me.gender === '自己填写') rows.push(fText('me.genderText', '我的性别', { ph: '写你认同的说法' }));
    rows.push(fSelect('me.zodiac', '我的星座', zodiacOpts()), fText('me.identity', '身份（选填）', { ph: '比如：研一学生、插画师' }));
    b.append(iosGroup('', rows, `${herName()}提到你时会用「${pron()}」：女用「她」，男用「他」，其余用「TA」。`),
      iosGroup('', [fArea('me.about', '关于我', '在做什么、最近在忙什么、喜欢什么')], `AI 模式会参考这些。想让${herName()}督促你做的事，在「设置 → 督促清单」里加。`));
  });
}
function settingsMemoryPage(pg, app) {
  subPage(pg, app, `${TA()}记得的事`, b => {
    const t = el('textarea', { rows: '4', placeholder: '还没有。一行一条，比如：TA 最近在准备雅思' });
    t.value = S.memory.join('\n');
    t.addEventListener('input', () => { S.memory = t.value.split('\n').map(x => x.trim()).filter(Boolean); saveSLater(); grow(t); });
    requestAnimationFrame(() => grow(t));
    b.append(iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '一行一条，可以直接改'), t)],
      S.reply.mode === 'template' ? `固定模板模式用不上这些。换成 AI 模式后，${TA()}会参考这里，聊天里你提到的新情况也会自动记下来。` : `聊天里你提到的新情况，${TA()}会自动记下来。`));
  });
}

/* ---------- 隐私与安全性：用大白话说清楚数据存在哪、什么时候联网、点 App 时发生了什么 ---------- */
const AI_NOTICE = () => `开启后，${herName()}的每句话都由 AI 来写。为此，最近的聊天记录、${TA()}的人设、你填的资料和督促清单、${TA()}记得的事，会发给 AI 服务：用「知己内置 AI」时，经过知己的服务器转给 DeepSeek；用你自己的 Key 时，直接发给你选的服务。详细说明在「设置 → 隐私与安全性」。`;
function settingsPrivacyPage(pg, app) {
  subPage(pg, app, '隐私与安全性', b => {
    const go = fn => () => Nav.push(app, p => fn(p, app));
    const row = (label, value) => el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, label), el('span', { class: 'val' }, value));
    const text = (...ps) => el('div', { class: 'pv-text' }, ...ps.map(t => el('p', {}, t)));
    const ai = S.reply.mode === 'ai', builtin = S.api.provider === 'builtin', pv = builtin ? 'DeepSeek（经知己服务器）' : ((CHAT_PROVIDERS[S.api.provider] || {}).label || 'AI 服务');
    const cloud = typeof sb !== 'undefined' && !!sb;
    const photoAI = S.photo.mode !== 'pool';
    b.append(el('div', { class: 'pv-hero' }, el('span', { class: 'pv-ic' }, icon('hand', 30, 2)), el('h2', {}, '知己和你的隐私'),
      el('p', {}, cloud ? '知己用账号把你的存档保存在云端。下面说明数据存在哪、谁能看到、什么时候会联网，以及点 App 图标时发生了什么。' : '下面说明你的数据存在哪、什么时候会联网，以及点 App 图标时发生了什么。')));
    b.append(iosGroup('数据存在哪', [cloud ? text(
      `登录后，人设、聊天记录、朋友圈、打卡会同步到知己的云端数据库（Supabase），换手机登录也能找回；照片只存在这台手机上。`,
      `数据库设置成每个账号只能读写自己的存档。但知己的开发者作为数据库管理员，技术上能看到云端存档。别在聊天里发证件号、银行卡号、密码这类信息。`,
      `API Key 不会上传到云端。`) : text(
      `人设、聊天记录、照片、打卡这些，都只存在这台手机的这个浏览器里，开发者看不到。`,
      `删掉主屏幕上的知己，或者清除 Safari 的网站数据，这些会一起消失。记得常去「数据与备份」导出一份。`),
      iosLink({ label: '数据与备份', onclick: go(settingsDataPage) })]));
    b.append(iosGroup('什么时候会联网', [
      row('回复方式', ai ? `AI · 发给 ${pv}` : '固定模板 · 不发送'),
      row('云同步', cloud ? (currentUser ? `已登录 · ${accountName(currentUser)}` : '没登录 · 不上传') : '不使用'),
      row('AI 生成照片', photoAI && imgConf().key ? '开启' : '不使用'),
      row('天气', '只发送城市名'),
      text(`用 AI 回复时：最近的聊天记录、${TA()}的人设、你填的资料和督促清单、${TA()}记得的事，会发给 AI 服务，由它写出${TA()}的回复。`,
        `用「知己内置 AI」时，这些内容经过知己的服务器（Supabase 上的中转）转给 DeepSeek；中转只转发、不保存聊天内容，但会记下你每天用了几次，用来限量。用你自己的 Key 时，直接发给你选的服务，Key 只存在这台手机上。`,
        `AI 生成照片时：照片描述和参考形象图会发给生成照片的服务。`,
        `看天气时：只把${TA()}所在城市的名字发给 Open-Meteo，不用你的定位。`)]));
    b.append(iosGroup('App 壳子和跳转', [text(
      `第二页的小红书、美团这些第三方 App，还有「图书」「播客」，在 iPhone 上点了会打开你手机里真的那个。知己只是让 iPhone 打开一个地址（比如小红书是 xhsdiscover://），和点一个链接一样，不附带你的任何信息；跳过去以后你在那边做什么，知己看不到。`,
      `知己会看一下有没有跳过去，只用来决定要不要显示它的模拟页面，不记录、不上传。`,
      `照片、日历、备忘录这些系统 App 都是知己里的模拟页面，读不到你手机里真的照片和日历。`)]));
    b.append(iosGroup('权限', [row('定位', '不使用'), row('相机', '只在打开「相机」时使用'), row('照片', '只读取你自己选的'),
      row('麦克风', '暂不使用'), row('通知', '你打开后才会问')],
      '知己的网页文件放在 GitHub Pages 上，账号和云端存档在 Supabase 上。和所有网站一样，托管方能看到访问记录（比如 IP 地址）。'));
  });
}

/* ---------- 回复方式 ---------- */
function settingsReplyPage(pg, app) {
  subPage(pg, app, '回复方式', (b, re) => {
    const seg = el('div', { class: 'seg', role: 'group', style: 'margin-top:14px' });
    for (const [k, v] of Object.entries(REPLY_MODES)) seg.append(el('button', { 'aria-pressed': String(S.reply.mode === k), onclick: async () => {
      if (k === 'ai' && S.reply.mode !== 'ai' && !S.reply.aiOk) {   // 第一次开 AI：先说清楚聊天会发去哪里
        if (!(await confirmSheet('开启 AI 回复？', AI_NOTICE(), '知道了，开启'))) return;
        S.reply.aiOk = true;
      }
      S.reply.mode = k; saveS(); re(); if (WXT) renderThread();
    } }, v.label));
    b.append(seg, el('p', { class: 'ios-foot' }, (REPLY_MODES[S.reply.mode] || REPLY_MODES.template).desc.replace(/TA/g, TA())));

    const sample = el('p', { class: 'ios-foot', style: 'min-height:20px' });
    const tryScene = sc => { sample.textContent = tplPreview(sc).join(' / '); };
    b.append(iosGroup('预览模板台词', [
      el('div', { class: 'btnrow', style: 'padding:12px 16px' },
        el('button', { class: 'btn', onclick: () => tryScene('morning') }, '早安'),
        el('button', { class: 'btn', onclick: () => tryScene('task') }, '督促提醒'),
        el('button', { class: 'btn', onclick: () => tryScene('night') }, '晚安'))]), sample);

    if (S.reply.mode === 'template') return;
    const pv = S.api.provider, def = CHAT_PROVIDERS[pv] || {};
    const isBuiltin = pv === 'builtin';

    const rows = [
      fSelect('api.provider', '服务', Object.entries(CHAT_PROVIDERS).map(([k, v]) => [k, v.label]), re)
    ];
    // 只有不是「内置免填」时，才让用户填地址、Key 和模型
    if (!isBuiltin) {
      rows.push(
        fText('api.base', '接口地址', { ph: def.base || '比如 https://api.example.com/v1' }),
        fText('api.key', 'API Key', { type: 'password', ph: '只存在这个浏览器里' }),
        fText('api.model', '模型', { ph: def.model || '填模型名', btn: miniBtn('看看有哪些', btn => listModels('chat', btn)) }),
        fToggle('api.json', '要求模型按 JSON 回复')
      );
    }
    rows.push(fToggle('reply.fallback', 'AI 连不上时用模板顶上'));

    b.append(
      iosGroup('AI 接口', rows, isBuiltin
        ? '当前使用内置 AI 线路，无需填写任何 Key 即可直接聊天。如果你想换用自己的大模型 Key，可以在上方「服务」里切换。'
        : `${def.base ? '接口地址和模型留空就用灰字里的默认值。' : ''}Key 只存在这个浏览器里，不会写进网页文件，导出备份也不含 Key。`),
      el('div', { class: 'btnrow', style: 'margin-top:14px' }, el('button', { class: 'btn', onclick: e => testApi(e.currentTarget) }, '测试连接'))
    );
    if (ST.aiErr) b.append(el('p', { class: 'ios-foot ai-err' }, `最近一次聊天时出错（${fmtFull(ST.aiErr.at)}）：${ST.aiErr.msg}`));
  });
}

/* ---------- 照片 ---------- */
function settingsPhotoPage(pg, app) {
  subPage(pg, app, 'AI 生成照片', (b, re) => {
    b.append(iosGroup('', [fSelect('photo.mode', `${TA()}发照片时`, [['pool', '只从照片池里挑'], ['pool_then_gen', '先用照片池，没有了再 AI 生成'], ['gen', '每次都 AI 生成新照片']], re)]));
    if (S.photo.mode === 'pool') return;
    const ip = IMAGE_PROVIDERS[S.photo.provider] || IMAGE_PROVIDERS.openai;
    const ref = el('img', { class: 'sq', alt: '' });
    IDB.get('ref').then(s => { if (s) ref.src = s; }).catch(() => {});
    b.append(iosGroup('AI 生成', [
      fSelect('photo.provider', '服务', Object.entries(IMAGE_PROVIDERS).map(([k, v]) => [k, v.label]), re),
      fText('photo.key', 'Key', { type: 'password', ph: S.api.provider === S.photo.provider ? '留空就用回复方式里那个 Key' : '填这个服务的 Key' }),
      fText('photo.base', '接口地址', { ph: ip.base }),
      fText('photo.model', '模型', { ph: ip.model, btn: miniBtn('看看有哪些', btn => listModels('img', btn)) }),
      el('div', { class: 'pic-row' }, ref, el('div', { class: 'grow' }, '参考形象图（可选），让生成的照片长得一致'), el('div', { class: 'acts' },
        miniBtn('上传', async () => { const [f] = await pickFile('image/*'); if (!f) return; const d = await compress(await fileToDataURL(f), 1024, .88); await IDB.put('ref', d); ref.src = d; }),
        miniBtn('移除', async () => { await IDB.del('ref'); ref.removeAttribute('src'); })))],
      `每张要几十秒，按次收费${imgConf().key ? '' : '；现在还没有可用的 Key'}。参考图请用虚构形象或你有权使用的图片，不要拿真人照片去生成新图。`));
  });
}

/* ---------- 通知 / 屏幕使用时间 ---------- */
function settingsNotifyPage(pg, app) {
  subPage(pg, app, '通知', b => {
    b.append(iosGroup('', [fToggle('notify.banner', '横幅通知')], `在别的 App 里时，${herName()}的消息从屏幕顶上弹出来。专注模式打开时不弹。`),
      iosGroup('', [fToggle('notify.system', '网页在后台时弹系统通知', onNotifyToggle)], '只在网页还开着（哪怕切到后台）时有效。网页完全关掉后，下次打开会补上错过的消息。'),
      iosGroup('', [fToggle('notify.relock', '离开 3 分钟后回到锁屏')], `像重新拿起手机，锁屏上能看到${TA()}这段时间发来的消息。`));
  });
}
function settingsScreenTimePage(pg, app) {
  subPage(pg, app, '屏幕使用时间', b => {
    const mins = Math.round(((ST.usage && ST.usage.active) || 0) / 60000);
    b.append(iosGroup('', [el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '这次连续使用'), el('span', { class: 'val' }, `${mins} 分钟`))]),
      iosGroup('', [fToggle('notify.breakReminder', '连续使用 2 小时提醒休息')], `到时间会弹窗提醒你歇一会儿，并说明${TA()}的消息是程序生成的。`));
  });
}
async function onNotifyToggle(on) {
  if (!on) return true;
  if (!('Notification' in window)) { toast('这个浏览器不支持系统通知'); return false; }
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') { toast('浏览器没有允许通知'); return false; }
  return true;
}

/* ---------- 通用 ---------- */
function settingsGeneralPage(pg, app) {
  subPage(pg, app, '通用', b => {
    const go = fn => () => Nav.push(app, p => fn(p, app));
    b.append(iosGroup('', [
      iosLink({ label: '关于本机', onclick: go(settingsAboutPage) }),
      iosLink({ label: '数据与备份', onclick: go(settingsDataPage) })]));
  });
}
function settingsAboutPage(pg, app) {
  subPage(pg, app, '关于本机', b => {
    const n = (x) => el('span', { class: 'val' }, x);
    b.append(iosGroup('', [
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '名称'), n(APP_TITLE)),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '聊天记录'), n(`${M.filter(m => m.from === 'me' || m.from === 'her').length} 条`)),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '朋友圈'), n(`${POSTS.length} 条`)),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '照片池'), n(`${POOL.length} 张`))],
      '这是网页里模拟的一台手机。没登录时所有内容只存在当前浏览器里；登录后，聊天记录和设定会备份到云端。'));
  });
}

/* ---------- 主屏幕：改每个图标的名字、图片、跳转地址 ---------- */
function settingsHomePage(pg, app) {
  subPage(pg, app, '主屏幕与 App 资源库', (b, re) => {
    const seg = el('div', { class: 'seg' }, ...[['small', '小'], ['large', '大']].map(([v, t]) =>
      el('button', { 'aria-pressed': String((S.look.icons || 'large') === v), onclick: () => { S.look.icons = v; saveS(); syncStatusIcons(); renderHome(); re(); } }, t)));
    b.append(iosGroup('图标', [el('div', { class: 'ios-field' }, seg)], '「大」和 iOS 26 一样，图标更大、不显示名字；「小」会在图标下面显示名字。'));
    b.append(iosGroup('App', Object.keys(APPS).map(id => {
      const d = appDef(id);
      return el('button', { class: 'ios-row has-ic', onclick: () => Nav.push(app, p => settingsHomeAppPage(p, app, id)) }, appIcon(id, 30),
        el('span', { class: 'lbl' }, d.label), el('span', { class: 'val' }, id === 'wx' || id === 'settings' ? '本网页' : d.ios ? '跳转' : '仿真'),
        el('span', { class: 'chev' }, icon('chevron', 18, 2.2)));
    }), '在 iPhone 上点「跳转」的图标，会打开手机里真的那个 App（系统可能会先问一句要不要打开）；「仿真」的是知己里自己做的页面。每个图标都可以换名字、换成你自己的图片。'));
    b.append(iosGroup('', [iosLink({ label: '恢复默认的桌面排布', chevron: false, cls: 'blue', onclick: async () => { if (!(await confirmSheet('恢复默认的桌面排布？', '删掉的 App 会装回来，自己挪过的位置会复原。', '恢复'))) return; S.layout = null; saveS(); renderHome(); toast('已恢复'); } })],
      '在桌面上长按可以进入编辑：拖动换位置、删掉不要的 App、加回小组件。删掉的 App 可以在 App Store 里重新下载。'));
  });
}
function settingsHomeAppPage(pg, app, id) {
  subPage(pg, app, appDef(id).label, (b, re) => {
    S.home[id] = S.home[id] || {};
    const o = S.home[id], base = APPS[id] || {};
    const ic = el('div', { class: 'pic-row' }, appIcon(id, 60), el('div', { class: 'grow' }, '图标'), el('div', { class: 'acts' },
      miniBtn('换成图片', async () => { const [f] = await pickFile('image/*'); if (!f) return; o.icon = await compress(await fileToDataURL(f), 180, .9, true); saveS(); re(); renderHome(); }),
      o.icon ? miniBtn('恢复默认', () => { o.icon = ''; saveS(); re(); renderHome(); }) : ''));
    const rows = [ic, fText(`home.${id}.label`, '名字', { ph: base.label, oninput: () => renderHome() })];
    if (id !== 'wx' && id !== 'settings') rows.push(fText(`home.${id}.ios`, 'iPhone 上点它跳转到', { ph: base.ios || base.open || '留空 = 打开仿真版' }));
    b.append(iosGroup('', rows, id === 'wx' ? `${appDef('wx').label}就是这个网页里的聊天 App。` : '跳转地址是 App 的 URL scheme（App 在 iPhone 里登记的「门牌号」），比如小红书是 xhsdiscover://。'));
  });
}

/* ---------- 无线局域网 / 专注模式 / 电池 ---------- */
function settingsWifiPage(pg, app) {
  subPage(pg, app, '无线局域网', (b, re) => {
    const rows = [fToggle('look.wifi', '无线局域网', v => { setTimeout(re, 0); return true; })];
    if (S.look.wifi) rows.push(el('div', { class: 'ios-row' }, el('span', { class: 'check' }, icon('check', 20, 2.4)), el('span', { class: 'lbl' }, '家'), el('span', { class: 'sb-wifi-ic' }, icon('wifi', 18, 2))));
    b.append(iosGroup('', rows, S.look.wifi ? '' : '关掉时状态栏显示 5G。'));
  });
}
function settingsFocusPage(pg, app) {
  subPage(pg, app, '专注模式', (b, re) => {
    b.append(iosGroup('', Object.entries(FOCUS_MODES).map(([k, f]) => {
      const on = S.notify.focus && S.notify.focusMode === k;
      return el('button', { class: 'ios-row has-ic', onclick: () => {
        if (on) S.notify.focus = false; else { S.notify.focus = true; S.notify.focusMode = k; }
        saveS(); syncStatusIcons(); re();
      } }, el('span', { class: 'ios-ic', style: `background:${f.color}` }, focusGlyph(k, 18)), el('span', { class: 'lbl' }, f.label), el('span', { class: 'val' }, on ? '打开' : ''), el('span', { class: 'chev' }, icon('chevron', 18, 2.2)));
    }), `专注模式打开时，状态栏会显示对应的小图标，${herName()}的消息不会弹横幅，但还是会照常收到。点一下打开，再点一下关闭。`));
  });
}
function settingsBatteryPage(pg, app) {
  subPage(pg, app, '电池', b => {
    b.append(iosGroup('', [
      fToggle('look.lowPower', '低电量模式', () => { setTimeout(syncStatusIcons, 0); return true; }),
      el('div', { class: 'ios-row' }, el('span', { class: 'lbl' }, '电池百分比'), el('span', { class: 'val' }, '显示'))],
      '低电量模式打开时，状态栏的电池会变成黄色。在电脑上的 Chrome 里，电量和充电状态是真实的。'));
  });
}

/* ---------- 数据与备份 ---------- */
function settingsDataPage(pg, app) {
  subPage(pg, app, '数据与备份', (b, re) => {
    /* ---- 账号与云同步（js/core/cloud.js） ---- */
    b.append(cloudAccountGroup(re));

    /* ---- 原有的本地文件导入导出 ---- */
    b.append(iosGroup('本地文件备份', [
      iosLink({ label: '导出备份文件', onclick: exportData, chevron: false, cls: 'blue' }),
      iosLink({ label: '导入备份文件', onclick: importData, chevron: false, cls: 'blue' })],
      '也可以把记录下载成一个文件存在手机里（文件里不含 API Key）。'),
      iosGroup('', [
        el('button', { class: 'ios-row danger', onclick: clearChat }, '清空聊天记录'),
        el('button', { class: 'ios-row danger', onclick: clearPosts }, '清空朋友圈'),
        el('button', { class: 'ios-row danger', onclick: resetAll }, '全部恢复默认')]));
  });
}

/* ---------- 动作 ---------- */
async function testApi(btn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = '连接中…';
  try {
    // 用和真正聊天一样的设定来测，测通了聊天也就能用
    const o = parseReply(await callLLM(buildSystem(Date.now()), [{ role: 'user', text: '（这是一次连接测试）随便回我一句' }]));
    if (!o.messages.length) throw new Error('连上了，但模型的回复格式不对，聊天时可能用不了');
    if (ST.aiErr) { delete ST.aiErr; saveST(); }
    toast('连上了：' + o.messages[0], 3500);
  } catch (e) { toast(e.message, 7000); }
  finally { btn.disabled = false; btn.textContent = old; }
}
async function listModels(kind, btn) {
  btn.disabled = true;
  try {
    const list = await fetchModelIds(kind);
    if (!list.length) { toast('没列出模型，直接手填模型名也可以'); return; }
    openSheet((p, close) => {
      p.append(sheetHead('选一个模型', el('button', { onclick: close }, '取消')), el('p', { class: 'sub' }, '这是这个 Key 能用的模型。'));
      const box = el('div', { class: 'act-list' });
      for (const id of list) box.append(el('button', { class: 'act', onclick: () => { setP(kind === 'img' ? 'photo.model' : 'api.model', id); saveS(); close(); refreshTop(); toast('已选 ' + id); } }, id));
      p.append(box);
    });
  } catch (e) { toast(e.message, 7000); }
  finally { btn.disabled = false; }
}
function refreshTop() { if (APPS[cur] && Nav.stacks[cur]) Nav.refresh(cur); }
async function exportData() {
  const imgs = {};
  try { for (const k of await IDB.keys()) imgs[k] = await IDB.get(k); } catch (e) {}
  const s = clone(S); s.api.key = ''; s.photo.key = '';
  const blob = new Blob([JSON.stringify({ app: 'zaoan', v: 3, at: Date.now(), settings: s, msgs: M, posts: POSTS, state: ST, pool: POOL, notes: NOTES, favs: FAVS, images: imgs })], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${APP_TITLE}备份-${dkey(Date.now())}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('备份已下载（不含 API Key）');
}
async function importData() {
  const [f] = await pickFile('application/json,.json'); if (!f) return;
  let d; try { d = JSON.parse(await f.text()); } catch (e) { toast('这个文件读不出来'); return; }
  if (!d || d.app !== 'zaoan') { toast('这不是这个 App 的备份文件'); return; }
  if (!(await confirmSheet('用这个备份覆盖现在的内容？', '现在的聊天、朋友圈、设定和照片会被替换，API Key 保留。', '覆盖', true))) return;
  const keys = { a: S.api.key, p: S.photo.key };
  S = migrate(d.settings, merge(DEFAULTS, d.settings || {}));
  if (!S.api.key) S.api.key = keys.a;
  if (!S.photo.key) S.photo.key = keys.p;
  M = Array.isArray(d.msgs) ? d.msgs : [];
  POSTS = (Array.isArray(d.posts) ? d.posts : []).map(p => Object.assign({ author: 'her', comments: [], likes: { me: !!p.liked } }, p));
  POOL = Array.isArray(d.pool) ? d.pool : [];
  NOTES = Array.isArray(d.notes) ? d.notes : [];
  FAVS = Array.isArray(d.favs) ? d.favs : [];
  ST = Object.assign(freshState(), { started: true }, d.state || {}); ST.lastTick = Date.now();
  try { await IDB.clear(); for (const [k, v] of Object.entries(d.images || {})) await IDB.put(k, v); } catch (e) { toast('有些照片没导入成功'); }
  imgCache.clear(); saveS(); saveM(); savePosts(); saveST(); savePool(); saveNotes(); saveFavs();
  for (const k of Object.keys(Nav.stacks)) delete Nav.stacks[k];
  WXT = null; show('home'); toast('导入好了');
}
async function clearChat() {
  if (!(await confirmSheet('清空所有聊天记录？', `聊天里的照片和语音也会删掉。朋友圈、照片池、设定和${TA()}记得的事都保留。`, '清空', true))) return;
  const keep = new Set([...POOL.map(x => x.imageId), ...POSTS.flatMap(p => p.imageIds || [])]);
  for (const m of M) { if (m.imageId && !keep.has(m.imageId)) IDB.del(m.imageId).catch(() => {}); if (m.audioId) IDB.del(m.audioId).catch(() => {}); }
  M = []; ST.lastRead = 0; saveM(); saveST();
  renderThread(); refreshTop(); updateBadges();
  toast('聊天记录清空了');
}
async function clearPosts() {
  if (!(await confirmSheet('清空朋友圈？', '照片池和聊天记录都保留。', '清空', true))) return;
  const keep = new Set([...POOL.map(x => x.imageId), ...M.filter(m => m.imageId).map(m => m.imageId)]);
  for (const p of POSTS) for (const id of p.imageIds || []) if (!keep.has(id)) IDB.del(id).catch(() => {});
  POSTS = []; savePosts(); updateBadges();
  toast('朋友圈清空了');
}
async function resetAll() {
  if (!(await confirmSheet('全部恢复默认？', '聊天、朋友圈、设定、照片池、Key 全部删除，回到第一次打开的样子。', '全部删除', true))) return;
  Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k));
  try { await IDB.clear(); } catch (e) {}
  location.reload();
}
