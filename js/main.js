/* 启动 */
'use strict';

/* 离开网页一会儿再回来 → 回到锁屏，像重新拿起手机 */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); stopCamera(); return; }
  if (cur === 'camera') startCamera();
  if (S.notify.relock && hiddenAt && Date.now() - hiddenAt > 3 * 60e3 && cur !== 'lock') show('lock');
  markRead(); tick(); updateBadges();
});

/* 连续使用 2 小时提醒休息（中间离开超过 10 分钟就重新计时） */
function trackUsage() {
  const now = Date.now(), u = ST.usage || (ST.usage = { active: 0, last: 0 });
  if (document.hidden || cur === 'lock') return;
  if (!u.last || now - u.last > 10 * 60e3) u.active = 0;
  else u.active += now - u.last;
  u.last = now;
  if (S.notify.breakReminder && u.active >= 2 * 3600e3) {
    u.active = 0;
    openSheet((p, close) => p.append(
      el('div', { class: 'sheet-title' }, '已经连续用了 2 小时'),
      el('p', { class: 'sub' }, `起来走走、喝口水吧。${herName()}的消息是程序${S.reply.mode === 'template' ? '按预设模板' : '由 AI'}生成的，不是真人。`),
      el('div', { class: 'btnrow' }, el('button', { class: 'btn primary', onclick: () => { close(); show('lock'); } }, '好，休息一下'), el('button', { class: 'btn', onclick: close }, '知道了'))));
  }
  saveST();
}

/* 手机框本身不该被滚动（聚焦输入框时浏览器会试图把它往上推） */
$('#phone').addEventListener('scroll', e => { e.target.scrollTop = 0; e.target.scrollLeft = 0; });

document.title = APP_TITLE;
for (const k of Object.keys(APPS)) { const el_ = $('#app-' + k); if (el_) el_.setAttribute('aria-label', appDef(k).label); }
fitPhone();
syncStatusIcons();
tickClock(); setInterval(tickClock, 1000);
show('lock');
tick();                     // 补上错过的消息
setInterval(tick, 20000);   // 之后每 20 秒看一眼日程
setInterval(trackUsage, 30000);
