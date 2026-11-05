/*
 * 知己的 Service Worker：只负责锁屏通知（js/core/push.js、supabase/push-tick.ts）。
 * 不缓存任何文件，网页更新照旧马上生效。
 */
'use strict';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* 服务器推来一条：弹通知，更新图标上的红色数字 */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const jobs = [self.registration.showNotification(d.title || '知己', {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    timestamp: d.ts || Date.now(),
    data: { url: d.url || './' }
  })];
  if (typeof d.badge === 'number' && self.navigator && self.navigator.setAppBadge) jobs.push(self.navigator.setAppBadge(d.badge).catch(() => {}));
  e.waitUntil(Promise.all(jobs));
});

/* 点通知：网页开着就切过去，直接进聊天；没开就打开 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.postMessage({ type: 'open-chat' }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
