/*
 * 「照片」仿真版（电脑上点照片时打开；iPhone 上会跳到真的照片 App）：她发来的和你拍的照片。
 * 照片池（她「手机里」可以发给你的照片）在 设置 → 著信 → 照片池。
 */
'use strict';

function allPhotos() {
  return [...M.filter(m => m.type === 'image').map(m => ({ id: m.imageId, ts: m.ts, d: m.desc })),
    ...POSTS.filter(p => p.imageIds && p.imageIds[0]).map(p => ({ id: p.imageIds[0], ts: p.ts, d: p.text }))]
    .sort((a, b) => b.ts - a.ts);
}
function photosRoot(pg, app) {
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { flat: true }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    body.append(el('h1', { class: 'ios-large' }, appDef('photos').label));
    const ids = allPhotos();
    if (!ids.length) { body.append(el('p', { class: 'empty' }, `还没有照片。${TA()}发给你的、你拍给${TA()}的照片都会出现在这里。`)); return; }
    const g = el('div', { class: 'photo-grid' });
    for (const x of ids) { const im = el('img', { alt: x.d || '照片', loading: 'lazy' }); setImg(im, x.id); g.append(el('button', { 'aria-label': x.d || '照片', onclick: () => openViewer(x.id) }, im)); }
    body.append(g, el('p', { class: 'ios-foot', style: 'text-align:center;margin-top:12px' }, `${ids.length} 张照片`));
  }
}

/* 照片池：设置 → 著信 → 照片池 */
function poolPage(pg, app) {
  const addBtn = el('button', { class: 'ios-act', onclick: addPool }, '添加');
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { title: '照片池', back: appDef('wx').label, right: addBtn }), body);
  pg.refresh = render; render();
  function render() {
    body.textContent = '';
    if (!POOL.length) {
      body.append(el('p', { class: 'empty' }, `照片池是${TA()}「手机里的照片」。${TA()}要发照片时，会从这里挑一张发给你或发到朋友圈。每张写一句描述，${TA()}才知道照片里是什么（AI 模式会用到）。`),
        el('button', { class: 'btn primary wide', onclick: addPool }, '添加照片'));
      return;
    }
    const card = el('div', { class: 'ios-card', style: 'margin-top:14px' });
    for (const x of POOL) {
      const im = el('img', { alt: '' }); setImg(im, x.imageId);
      const inp = el('input', { placeholder: '这张照片是什么，比如：周末在咖啡店窗边', value: x.desc || '', 'aria-label': '照片描述' });
      inp.addEventListener('change', () => { x.desc = inp.value.trim(); savePool(); });
      card.append(el('div', { class: 'pool-item' },
        el('button', { onclick: () => openViewer(x.imageId), 'aria-label': '查看' }, im),
        el('div', {}, inp, el('small', {}, x.sent ? `发过 ${x.sent} 次` : '还没发过')),
        el('button', { class: 'del', onclick: () => removePool(x) }, '删除')));
    }
    body.append(card, el('p', { class: 'ios-foot' }, '照片只存在这个浏览器里，不会上传到任何地方。请只放你有权使用的照片。'));
  }
}
async function removePool(x) {
  if (!(await confirmSheet('删掉这张照片？', '已经发出去的不受影响。', '删除', true))) return;
  POOL = POOL.filter(y => y !== x); savePool();
  if (!M.some(m => m.imageId === x.imageId) && !POSTS.some(p => (p.imageIds || []).includes(x.imageId))) IDB.del(x.imageId).catch(() => {});
  refreshTop();
}
async function addPool() {
  const files = await pickFile('image/*', true);
  if (!files.length) return;
  toast('正在处理照片…');
  let n = 0;
  for (const f of files) {
    try {
      const data = await compress(await fileToDataURL(f), 1280, .86);
      const imageId = uid('img');
      await IDB.put(imageId, data); imgCache.set(imageId, data);
      POOL.push({ id: uid('p'), imageId, desc: '', sent: 0, lastSent: 0 }); n++;
    } catch (e) { toast('有一张照片读不出来'); }
  }
  savePool(); refreshTop();
  toast(`加了 ${n} 张，记得给每张写一句描述`);
}
