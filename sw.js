/*
 * 知己的 Service Worker：锁屏通知（js/core/push.js、supabase/push-tick.ts），和把网页文件存在手机里。
 *
 * 存文件是为了打开快、不白屏（GitHub 在国内有时慢）：
 *   打开知己（index.html）：先上网拿最新的；2.5 秒还没拿到，就先用手机里存的那份，最新的在后台下载，下次打开就是新版。
 *   别的页面（隐私政策 privacy.html）：不经过这里，浏览器自己上网拿。
 *   带版本号的文件（js、css 后面的 ?v=1114）：手机里有这个版本就直接用；index.html 里版本号一改，就会下载新的。
 *   其他自己网站的文件（图标、清单）：先用存的，同时在后台更新。
 *   Supabase、DeepSeek、天气这些别的网站：不经过这里。
 */
'use strict';

const CACHE = 'zhiji-files-v1';
const PAGE = new URL('./', self.registration.scope).href;   // 知己的首页，不管地址后面带什么都存成这一份
const PAGE_WAIT = 2500;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(precache().catch(() => {}));   // 先把首页和它用到的文件存一份；失败也不影响
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

/* 首页和它引用的带版本号的文件 */
async function precache() {
  const c = await caches.open(CACHE);
  const res = await fetch(PAGE, { cache: 'no-cache' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await c.put(PAGE, res);
  const urls = [...html.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)].map(m => new URL(m[1], PAGE).href);
  for (const u of urls) {
    if (await c.match(u)) continue;
    try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (err) {}
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;              // 别的网站：不管
  if (url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {
    if (!isApp(url)) return;                                    // 隐私政策这类别的页面：不经过这里，浏览器自己去拿
    const net = fetch(req);
    keep(e, net, PAGE);
    e.respondWith(page(net).catch(() => fetch(req)));
    return;
  }
  if (/[?&]v=/.test(url.search)) { e.respondWith(versioned(req).catch(() => fetch(req))); return; }
  const net = fetch(req);
  keep(e, net, req);
  e.respondWith(fresh(req, net).catch(() => fetch(req)));
});

/* 是不是知己首页（不管后面带什么参数） */
const isApp = url => { const p = new URL(PAGE).pathname; return url.pathname === p || url.pathname === p + 'index.html'; };
/* 网上拿到了就存一份，下次用。waitUntil 要在收到请求时马上调用（iPhone 的 Safari 不接受晚一步再调用） */
function keep(e, net, key) {
  e.waitUntil(net.then(res => {
    if (!res.ok) return;
    const copy = res.clone();
    return caches.open(CACHE).then(c => c.put(key, copy));
  }).catch(() => {}));
}
/* 打开知己：先上网拿，2.5 秒拿不到（或者没网、GitHub 出错）就用存的 */
async function page(net) {
  const good = net.then(res => res.ok ? res : Promise.reject(new Error('HTTP ' + res.status)));
  const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), PAGE_WAIT));
  try { return await Promise.race([good, timer]); }
  catch (err) {
    const hit = await caches.match(PAGE);
    return hit || net;   // 手机里还没有（第一次打开）：只能等网络
  }
}
/* 带版本号的：有就用，没有就下载并存起来，同一个文件的旧版本删掉 */
async function versioned(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await c.put(req, res.clone());
    const path = new URL(req.url).pathname;
    for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === path && k.url !== req.url) await c.delete(k); }
  }
  return res;
}
/* 其他：先用存的，同时更新 */
async function fresh(req, net) {
  const hit = await caches.match(req);
  return hit || net;
}

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
