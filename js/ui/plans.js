/*
 * 「她什么时候找你」（在 设置 → 著信 里，样子像闹钟列表）。默认值在 js/data/persona.js 的 DEFAULT_EVENTS。
 */
'use strict';

function daysText(ds) {
  const s = [...ds].sort().join('');
  if (s === '0123456') return '每天';
  if (s === '12345') return '工作日';
  if (s === '06') return '周末';
  if (!s) return '暂停中';
  return '每周' + [1, 2, 3, 4, 5, 6, 0].filter(d => ds.includes(d)).map(d => WD[d]).join('、');
}

function plansPage(pg, app) {
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { title: `${TA()}什么时候找你`, back: appDef('wx').label, right: el('button', { class: 'ios-act', 'aria-label': '添加', onclick: () => editEvent(null) }, icon('plus', 24, 2)) }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('div', { style: 'height:12px' }));
    const card = el('div', { class: 'ios-card' });
    const evs = [...S.events].sort((a, b) => a.time.localeCompare(b.time));
    for (const ev of evs) {
      const sw = el('input', { type: 'checkbox', class: 'sw', 'aria-label': ev.label + ' 开关' });
      sw.checked = !!ev.on;
      sw.addEventListener('click', e => e.stopPropagation());
      sw.addEventListener('change', () => { ev.on = sw.checked; saveS(); render(); });
      const where = ev.to === 'moments' ? (ev.label.includes('朋友圈') ? '' : '，发朋友圈') : ev.to === 'call' ? (ev.label.includes('电话') ? '' : '，打电话') : ev.photo ? '，带照片' : '';
      card.append(el('div', { class: 'alarm' + (ev.on ? '' : ' off'), role: 'button', tabindex: '0', onclick: () => editEvent(ev), onkeydown: e => { if (e.key === 'Enter') editEvent(ev); } },
        el('div', {}, el('time', {}, ev.time), el('div', { class: 'lbl' }, ev.label, el('small', {}, `，${daysText(ev.days)}${where}`))), sw));
    }
    if (!evs.length) card.append(el('p', { class: 'empty' }, `${TA()}现在不会主动找你。点右上角的 + 添加。`));
    body.append(card, el('p', { class: 'ios-foot' }, `网页开着时，${TA()}会在这些时间附近来找你；网页关着时，下次打开会补上最近错过的消息（最多 3 条）。实际时间每天在设定前后随机浮动，更像真人。`));
  }
}

function editEvent(ev) {
  const isNew = !ev;
  const d = ev ? clone(ev) : { id: uid('e'), label: '', time: '12:00', jitter: 20, days: [...EVERY_DAY], on: true, to: 'chat', photo: false, scene: 'chat', prompt: '' };
  openSheet((p, close) => {
    const label = el('input', { value: d.label, placeholder: '比如：午休问候' });
    const time = el('input', { type: 'time', value: d.time });
    const jit = el('input', { type: 'number', min: '0', max: '180', value: String(d.jitter || 0), inputmode: 'numeric' });
    const days = el('div', { class: 'days' });
    [1, 2, 3, 4, 5, 6, 0].forEach(n => {
      const bt = el('button', { type: 'button', 'aria-pressed': String(d.days.includes(n)), 'aria-label': '星期' + WD[n] }, WD[n]);
      bt.addEventListener('click', () => { d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : [...d.days, n]; bt.setAttribute('aria-pressed', String(d.days.includes(n))); });
      days.append(bt);
    });
    const to = el('select', {}, el('option', { value: 'chat' }, '私聊发给我'), el('option', { value: 'moments' }, '发朋友圈'), el('option', { value: 'call' }, '打语音电话给我'));
    to.value = d.to || 'chat';
    const scene = el('select', {}); for (const [k, v] of Object.entries(SCENES)) scene.append(el('option', { value: k }, v));
    scene.value = d.scene || 'chat';
    const pr = el('textarea', { rows: '3', placeholder: '比如：问TA午饭吃了什么，顺便说说你吃了什么' }); pr.value = d.prompt || '';
    const ph = el('input', { type: 'checkbox', class: 'sw' }); ph.checked = !!d.photo;
    const field = (lbl, input) => el('label', { class: 'ios-field' }, el('span', {}, lbl), input);

    const commit = () => {
      d.label = label.value.trim() || '找你聊天';
      d.time = time.value || '12:00';
      d.jitter = Math.max(0, Math.min(180, parseInt(jit.value, 10) || 0));
      d.to = to.value; d.scene = scene.value; d.prompt = pr.value.trim(); d.photo = ph.checked;
      if (isNew) S.events.push(d); else Object.assign(ev, d);
      saveS(); refreshTop();
      return isNew ? d : ev;
    };
    p.append(sheetHead(isNew ? '添加日程' : '编辑日程',
      el('button', { onclick: close }, '取消'),
      el('button', { onclick: () => { commit(); close(); } }, '存储')),
      iosGroup('', [field('名字', label), field('大概几点', time), field('前后随机浮动（分钟）', jit), el('div', { class: 'ios-field' }, el('span', {}, '哪几天'), days)]),
      iosGroup('', [field('发到哪里', to), el('label', { class: 'ios-row' }, el('span', { class: 'lbl' }, '一定带照片'), ph)]),
      iosGroup('', [field('模板模式：用哪组台词', scene)], '台词在 js/data/templates.js，按场景分组。'),
      iosGroup('', [field(`AI 模式：这次${TA()}要做什么`, pr)], `AI 或混合模式下，这段话会告诉${TA()}这次该说什么。TA 指你。`),
      el('div', { class: 'btnrow' }, el('button', { class: 'btn', onclick: () => { const e = commit(); close(); if (e.to === 'chat') { openApp('wx'); openThread(true); } else if (e.to === 'moments') toast(`${TA()}正在发朋友圈`); enqueue(() => runEvent(e, { at: Date.now(), live: true })); } }, `现在就让${TA()}发`)),
      isNew ? '' : el('div', { class: 'btnrow' }, el('button', { class: 'btn danger', onclick: () => { S.events = S.events.filter(x => x !== ev); saveS(); refreshTop(); close(); } }, '删除这条日程')));
  });
}
