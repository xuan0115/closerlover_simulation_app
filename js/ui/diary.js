/*
 * Ta的日记（2026-11-10）：桌面上的一个 App，两页——
 *   日记：她每天睡前写的，只写你们那天真聊过的事（怎么写在 js/ai/brain.js 的 writeDiary，写作要求在 js/data/prompts.js）
 *   她记得的事：聊天里她记下的关于你的事（S.memory），在这里看、改、删、加；「设置」里的那一页是同一份
 */
'use strict';

let diaryTab = 'diary';
const diaryList = () => DIARY.filter(x => !x.del && x.text).sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
/* 她现在该写哪一天的：过了半夜还没到她昨晚的睡前时间，还算昨天 */
function diaryDayOf(t = Date.now()) {
  const y = new Date(t); y.setDate(y.getDate() - 1);
  return t < diaryCut(dkey(y)) ? dkey(y) : dkey(t);
}
const diaryDateText = date => { const d = new Date(date + 'T12:00'); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WD[d.getDay()]}`; };
const diaryUnseen = () => diaryList().filter(x => (x.at || 0) > (ST.diarySeen || 0)).length;
function diaryBadges() {
  const n = diaryUnseen();
  $$('.dybadge').forEach(b => { b.hidden = !n; b.textContent = n; });
}
/* 写好一篇（js/ai/brain.js 调）：开着日记就刷新，没开就在图标上标个数 */
function diaryChanged() {
  if (cur === 'diary' && Nav.stacks.diary) { ST.diarySeen = Date.now(); saveST(); Nav.refresh('diary'); }
  diaryBadges();
}

function diaryRoot(pg, app) {
  pg.classList.add('diary-app');
  const seg = el('div', { class: 'seg dy-seg', role: 'tablist' });
  const body = el('div', { class: 'ios-body dy-body' });
  pg.append(iosNav(app, { title: `${herName()}的日记`, flat: true }), el('div', { class: 'dy-segwrap' }, seg), body);
  pg.refresh = render; render();
  function render() {
    ST.diarySeen = Date.now(); saveST(); diaryBadges();
    seg.textContent = '';
    for (const [k, t] of [['diary', '日记'], ['mem', `${TA()}记得的事`]])
      seg.append(el('button', { role: 'tab', 'aria-pressed': String(diaryTab === k), onclick: () => { if (diaryTab === k) return; diaryTab = k; body.scrollTop = 0; render(); } }, t));
    const y = body.scrollTop; body.textContent = '';
    if (diaryTab === 'diary') diaryListView(body, app, render); else memoryView(body, render);
    body.scrollTop = y;
  }
}

function diaryListView(body, app, rerender) {
  const nm = herName(), now = Date.now(), list = diaryList();
  const today = diaryDayOf(now);
  if (!usesAI()) {
    body.append(el('div', { class: 'dy-status' }, el('p', {}, `${TA()}用 AI 回复时才会写日记。现在是固定模板，可以在「设置 → 回复方式」里换。`)));
  } else if (!list.some(x => x.date === today)) {
    const chatted = dayLog(today, now).length > 0, cut = diaryCut(today), late = now >= cut;
    const text = late
      ? (diaryBusy ? `${nm}正在写今天的日记……` : chatted ? `${nm}马上就写今天的。` : `今天你们没聊天，${nm}就不写了。`)
      : (chatted ? `今晚 ${hm(cut)} 前后，${nm}睡前会把今天写下来。` : `今天还没聊天。聊过的日子，${nm}睡前会写日记。`);
    const box = el('div', { class: 'dy-status' }, el('p', {}, text));
    if (chatted && !late) {
      const btn = el('button', { class: 'dy-now' }, diaryBusy ? `${TA()}在写……` : `让${TA()}现在写今天的`);
      btn.disabled = diaryBusy;
      btn.onclick = async () => {
        if (diaryBusy) { toast(`${TA()}正在写`); return; }
        diaryBusy = true; btn.disabled = true; btn.textContent = `${TA()}在写……`;
        try {
          const e = await writeDiary(today, { early: true });
          rerender(); Nav.push(app, p => diaryEntryPage(p, app, e.date));
        } catch (err) { toast(err.message || '没写成，过一会儿再试', 5000); rerender(); }
        finally { diaryBusy = false; }
      };
      box.append(btn, el('small', {}, '先写到现在为止的；睡前会把后来聊的补上。'));
    }
    body.append(box);
  }
  if (!list.length) {
    body.append(el('p', { class: 'empty' }, `还没有日记。\n${nm}每天睡前会把这一天写下来，只写你们真聊过的事。`));
    return;
  }
  let month = '', card = null;
  for (const e of list) {
    const d = new Date(e.date + 'T12:00'), m = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    if (m !== month) { month = m; card = el('div', { class: 'ios-card dy-card' }); body.append(el('section', { class: 'ios-group' }, el('h3', {}, m), card)); }
    card.append(el('button', { class: 'dy-row', onclick: () => Nav.push(app, p => diaryEntryPage(p, app, e.date)) },
      el('span', { class: 'dy-day' }, el('b', {}, d.getDate()), el('small', {}, '周' + WD[d.getDay()])),
      el('span', { class: 'dy-main' },
        el('span', { class: 'dy-line' }, el('b', {}, e.title || '无题'), e.mood ? el('span', { class: 'dy-mood' }, e.mood) : ''),
        el('span', { class: 'dy-ex' }, e.text.replace(/\s+/g, ' ')))));
  }
}

function diaryEntryPage(pg, app, date) {
  pg.classList.add('diary-app');
  const body = el('div', { class: 'ios-body dy-paper' });
  const del = el('button', { class: 'ios-act', 'aria-label': '删除这篇日记', onclick: async () => {
    const e = DIARY.find(x => x.date === date); if (!e) return;
    if (!(await confirmSheet('删除这篇日记？', `删了之后，${TA()}不会再写这一天。`, '删除', true))) return;
    Object.assign(e, { del: true, title: '', mood: '', text: '', at: Date.now() });
    saveDiary(); Nav.pop(app); Nav.refresh(app);
  } }, icon('trash', 22, 1.8));
  pg.append(iosNav(app, { back: '日记', right: del }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    const e = DIARY.find(x => x.date === date && !x.del);
    if (!e) { body.append(el('p', { class: 'empty' }, '这篇日记已经删掉了。')); return; }
    const list = diaryList(), i = list.findIndex(x => x.date === date);
    const older = list[i + 1], newer = list[i - 1];
    const go = x => () => { date = x.date; render(); };
    body.append(el('article', { class: 'dy-page' },
      el('header', { class: 'dy-head' }, el('time', {}, diaryDateText(e.date)), e.mood ? el('span', { class: 'dy-mood' }, e.mood) : ''),
      el('h1', { class: 'dy-title' }, e.title || '无题'),
      ...e.text.split(/\n+/).filter(s => s.trim()).map(s => el('p', {}, s.trim())),
      el('footer', { class: 'dy-sign' }, `${herName()} · 写于 ${hm(e.ts)}`)),
      el('nav', { class: 'dy-pager' },
        older ? el('button', { onclick: go(older) }, icon('back', 18, 2.2), '前一篇') : el('span'),
        newer ? el('button', { onclick: go(newer) }, '后一篇', icon('chevron', 18, 2.2)) : el('span')));
    body.scrollTop = 0;
  }
}

/* 她记得的事：一条一行；点文字改，点右边删，最上面加 */
function memoryView(body, rerender) {
  body.append(el('p', { class: 'dy-intro' }, `你在聊天里说过的、值得记住的事，${TA()}会记在这里，以后聊天会想起来。记错了可以改，不想让${TA()}记着的可以删，也可以自己加。`));
  const rows = S.memory.map(x => el('div', { class: 'ios-row dy-mem' },
    el('button', { class: 'lbl', onclick: () => editMemory(x, rerender) }, x),
    el('button', { class: 'dy-del', 'aria-label': '删除这一条', onclick: async () => {
      if (!(await confirmSheet('删除这一条？', x, '删除', true))) return;
      const i = S.memory.indexOf(x); if (i >= 0) { S.memory.splice(i, 1); saveS(); }
      rerender();
    } }, icon('trash', 19, 1.8))));
  body.append(iosGroup('', [iosLink({ label: '添加一条', cls: 'blue', chevron: false, onclick: () => editMemory(null, rerender) }), ...rows],
    S.reply.mode === 'template' ? `固定模板模式用不上这些。换成 AI 模式后，${TA()}会参考这里。` : (S.memory.length ? `一共 ${S.memory.length} 条。` : `还没有。聊天里你提到的新情况，${TA()}会自动记下来。`)));
}
function editMemory(old, done) {
  openSheet((p, close) => {
    const t = el('textarea', { class: 'dy-edit', rows: '3', maxlength: '120', placeholder: '比如：最近在准备雅思，考试在 12 月', 'aria-label': '记得的事' });
    t.value = old || '';
    const save = () => {
      const v = t.value.replace(/\s+/g, ' ').trim();
      const i = old == null ? -1 : S.memory.indexOf(old);
      if (!v) { if (i >= 0) S.memory.splice(i, 1); }
      else if (i >= 0) S.memory[i] = v;
      else if (!S.memory.includes(v)) S.memory.push(v);
      S.memory = S.memory.slice(-80);
      saveS(); close(); done();
    };
    p.append(sheetHead(old == null ? '添加一条' : '修改', el('button', { onclick: close }, '取消'), el('button', { onclick: save }, '完成')),
      el('label', { class: 'ios-field dy-editbox' }, t),
      el('p', { class: 'sub' }, '写成一句短话。只写真的事，' + TA() + '会当真的。'));
    setTimeout(() => t.focus(), 250);
  });
}
