/*
 * 设置 → 督促清单：需要 TA 督促你完成的事。
 * 每一项：名称、图标（一个表情）、哪几天、目标、提醒时间（到点 TA 来提醒）、关键词（聊天里说到就自动打卡）。
 * 也用在「时钟 → 闹钟」里（点督促提醒那几行会打开这里的编辑页）。
 */
'use strict';

/* 选星期几：一排圆形按钮 */
function daysPicker(days, onchange) {
  const box = el('div', { class: 'days' });
  ['日', '一', '二', '三', '四', '五', '六'].forEach((w, d) => {
    const b = el('button', { type: 'button', 'aria-label': '星期' + w, 'aria-pressed': String(days.includes(d)), onclick: () => {
      const i = days.indexOf(d); if (i >= 0) days.splice(i, 1); else days.push(d);
      days.sort((a, b) => a - b); b.setAttribute('aria-pressed', String(days.includes(d))); onchange && onchange();
    } }, w);
    box.append(b);
  });
  return box;
}
const taskSub = t => [daysText(t.days), t.target, t.remindOn && t.remind ? `${t.remind} ${TA()}提醒` : ''].filter(Boolean).join(' · ');

function tasksPage(pg, app) {
  const add = el('button', { class: 'ios-act', 'aria-label': '添加', onclick: () => Nav.push(app, p => taskEditPage(p, app, null)) }, icon('plus', 24, 2.2));
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { title: '督促清单', back: app === 'settings' ? APPS.settings.label : '返回', right: add }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    const c = todayChecks();
    if (!S.tasks.length) body.append(el('p', { class: 'empty' }, `还没有要${TA()}督促的事。点右上角的 + 添加。`));
    else body.append(iosGroup('', S.tasks.map(t => el('button', { class: 'ios-row has-ic', onclick: () => Nav.push(app, p => taskEditPage(p, app, t)) },
      el('span', { class: 'task-emoji' }, t.emoji || '✅'),
      el('span', { class: 'lbl' }, t.name, el('small', {}, taskSub(t))),
      el('span', { class: 'val' }, c[t.id] ? '今天已打卡' : ''),
      el('span', { class: 'chev' }, icon('chevron', 18, 2.2))))));
    body.append(el('p', { class: 'ios-foot' }, `每一项都会出现在桌面的打卡小组件里，打卡时会自动发消息告诉${herName()}。设置了提醒时间的，到点${herName()}会在聊天里提醒你，这些提醒也会出现在「时钟 → 闹钟」里。想要只响铃、不用${herName()}提醒的闹钟，去「时钟」里加。`));
  }
}

function taskEditPage(pg, app, task) {
  const isNew = !task;
  const t = task ? clone(task) : { id: uid('t'), name: '', nameEn: '', emoji: '', days: [...EVERY_DAY], target: '', remind: '', remindOn: true, keywords: [] };
  const name = el('input', { value: t.name, placeholder: '比如：背单词、早睡、写论文', 'aria-label': '名称' });
  const nameEn = el('input', { value: t.nameEn || '', placeholder: '比如：vocab、reading（选填）', 'aria-label': '英文名' });
  const emoji = el('input', { value: t.emoji, placeholder: '✅', maxlength: '4', 'aria-label': '图标', class: 'emoji-in' });
  const target = el('input', { value: t.target, placeholder: '选填，比如：每天 30 分钟、每周 3 次', 'aria-label': '目标' });
  const time = el('input', { type: 'time', value: t.remind || '', 'aria-label': '提醒时间' });
  const on = el('input', { type: 'checkbox', class: 'sw', 'aria-label': `到点让${TA()}提醒我` }); on.checked = t.remindOn !== false;
  const kw = el('input', { value: (t.keywords || []).join('，'), placeholder: '用逗号隔开，比如：单词，背词', 'aria-label': '关键词' });
  const save = el('button', { class: 'ios-act bold', onclick: () => {
    t.name = name.value.trim(); if (!t.name) { toast('先写个名称'); name.focus(); return; }
    t.nameEn = nameEn.value.trim();
    t.emoji = emoji.value.trim(); t.target = target.value.trim(); t.remind = time.value; t.remindOn = on.checked && !!time.value;
    t.keywords = kw.value.split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean);
    if (!t.days.length) { toast('至少选一天'); return; }
    const i = S.tasks.findIndex(x => x.id === t.id);
    if (i >= 0) S.tasks[i] = t; else S.tasks.push(t);
    saveS(); renderHome(); Nav.pop(app);
  } }, isNew ? '添加' : '完成');
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { title: isNew ? '新的督促事项' : t.name, back: '督促清单', right: save }), body);
  body.append(
    iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '名称'), name), el('label', { class: 'ios-field' }, el('span', {}, '英文名（chatwe 英文模式用）'), nameEn), el('label', { class: 'ios-field' }, el('span', {}, '图标（一个表情，选填）'), emoji)]),
    iosGroup('哪几天', [el('div', { class: 'ios-field' }, daysPicker(t.days))]),
    iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '目标'), target)]),
    iosGroup('提醒', [el('label', { class: 'ios-field' }, el('span', {}, '提醒时间'), time),
      el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, `到点让${TA()}提醒我`), on)],
      `到点${herName()}会在聊天里提醒你，用${TA()}自己的语气。这个提醒也会出现在「时钟 → 闹钟」里。`),
    iosGroup('', [el('label', { class: 'ios-field' }, el('span', {}, '关键词'), kw)], `你在聊天里说到「${t.name || '名称'}」或这些词，就自动打卡。`));
  if (!isNew) body.append(el('button', { class: 'btn danger wide', style: 'margin-top:22px', onclick: async () => {
    if (!(await confirmSheet(`删除「${t.name}」？`, '以前的打卡记录还会留在日历里。', '删除', true))) return;
    S.tasks = S.tasks.filter(x => x.id !== t.id); saveS(); renderHome(); Nav.pop(app);
  } }, '删除这一项'));
}
