/*
 * 存储 —— 全部存在当前浏览器里：
 *   localStorage：设定、聊天记录、朋友圈、运行状态、照片池清单（键名都以 zaoan.v1. 开头）
 *   IndexedDB（zaoan-v1）：照片本身
 * 键名沿用了项目早期的名字 zaoan，改掉会让已经存的内容读不到，所以保留。
 */
'use strict';

const NS = 'zaoan.v1.';
const LS = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { toast('浏览器存储空间不够了：' + e.message); } }
};

const IDB = (() => {
  let p;
  const db = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('zaoan-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function run(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('img', mode);
      const r = fn(t.objectStore('img'));
      t.oncomplete = () => res(r ? r.result : undefined);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  return {
    get: k => run('readonly', s => s.get(k)),
    put: (k, v) => run('readwrite', s => s.put(v, k)),
    del: k => run('readwrite', s => s.delete(k)),
    keys: () => run('readonly', s => s.getAllKeys()),
    clear: () => run('readwrite', s => s.clear())
  };
})();

/* 默认值 = js/data/ 里的文件 */
const DEFAULTS = {
  her: DEFAULT_HER,
  me: DEFAULT_ME,
  memory: [],
  reply: { mode: 'template', fallback: true },
  api: { provider: 'openai', base: '', key: '', model: '', json: true },
  photo: { mode: 'pool_then_gen', provider: 'openai', key: '', base: '', model: '' },
  notify: { system: false, banner: true, relock: true, breakReminder: true, focus: false, focusMode: 'personal', airplane: false },
  // 外观：锁屏墙纸、主屏幕墙纸、图标大小（large 大图标不显示名字）、状态栏（无线局域网 / 5G、低电量模式）
  look: { v: 3, wall: 'bamboo', lockColor: '#2F4A2A', home: 'same', homeColor: '#2F4A2A', icons: 'small', wifi: false, lowPower: false },
  countdown: { title: '下次见面', date: '' },                          // 桌面上的倒数日小组件
  zx: { voice: 'sometimes', mute: false, pin: true, bg: false },   // 著信：她发语音的频率、免打扰、置顶、聊天背景
  home: {},                                                        // 每个桌面图标的自定义：{ id: { label, icon, ios } }
  layout: null,                                                    // 桌面排布（编辑过才有）：{ pages, dock, folders }；null = 用 js/data/ui.js 的默认
  events: DEFAULT_EVENTS
};
const clone = x => JSON.parse(JSON.stringify(x));
function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : clone(def);
  if (def && typeof def === 'object') {
    const o = {};
    for (const k of Object.keys(def)) o[k] = merge(def[k], val && typeof val === 'object' ? val[k] : undefined);
    return o;
  }
  return val === undefined || val === null ? def : val;
}
const freshState = () => ({ started: false, lastTick: 0, lastRead: 0, fired: {}, checkins: {}, seenPosts: 0, recent: {}, usage: { active: 0, last: 0 } });

/* 早期版本存下来的设定，补上新字段 */
const OLD_IDENTITY = '25 岁，插画师，在杭州一家小工作室上班，一个人住，养了一只叫年糕的橘猫。';
function migrate(raw, s) {
  if (raw && raw.api && raw.api.provider === 'demo') { s.api.provider = 'openai'; s.reply.mode = 'template'; }
  else if (raw && raw.api && raw.api.provider && !raw.reply) s.reply.mode = 'ai';
  const cm = String(s.her.callMe || '');
  if (cm.length > 8) { const m = cm.match(/「([^」]{1,8})」/); s.her.callMe = m ? m[1] : ''; }
  const byId = Object.fromEntries(DEFAULT_EVENTS.map(e => [e.id, e]));
  for (const ev of s.events) {
    if (!ev.to) ev.to = 'chat';
    if (!ev.scene) ev.scene = (byId[ev.id] && byId[ev.id].scene) || (ev.photo ? 'photo' : 'chat');
  }
  if (raw && raw.look && !raw.look.v) { s.look.wall = raw.look.wall === 'photo' ? 'her' : 'bamboo'; s.look.v = 2; } // 旧版默认的夜色换成新的竹林
  if (s.look.v < 3) { s.look.icons = 'small'; s.look.v = 3; }                      // 图标默认改回带名字的正常大小
  if (!WALLPAPERS[s.look.wall] && !['her', 'custom', 'color'].includes(s.look.wall)) s.look.wall = 'bamboo';
  if (!['same', 'blur', 'color', 'custom'].includes(s.look.home)) s.look.home = 'same';
  if (!s.countdown.date) { const d = new Date(Date.now() + 46 * 864e5); s.countdown.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  if (!TEMPLATE_TYPES[s.her.type]) s.her.type = Object.keys(TEMPLATE_TYPES)[0];
  if (raw && raw.her && raw.her.gender === undefined) {                 // 旧版的人设：新加的社会人设先空着，免得和原来写的冲突
    s.her.gender = '女';
    if (raw.her.identity && raw.her.identity !== OLD_IDENTITY) { s.her.edu = ''; s.her.major = ''; s.her.job = ''; s.her.siblings = ''; }
    else s.her.identity = DEFAULT_HER.identity;
  }
  if (s.her.edu && !EDU_LEVELS[s.her.edu]) s.her.edu = '';
  if (!s.events.some(e => e.id === 'e_call') && RAW && RAW.events) s.events.push(clone(DEFAULT_EVENTS.find(e => e.id === 'e_call')));
  return s;
}

const RAW = LS.get('settings', null);
let S = migrate(RAW, merge(DEFAULTS, RAW || {}));             // 设定
let M = LS.get('msgs', []);                                     // 聊天记录
let POSTS = LS.get('posts', []).map(p => Object.assign({ author: 'her', comments: [], likes: { me: !!p.liked, her: false } }, p)); // 朋友圈
let ST = Object.assign(freshState(), LS.get('state', {}));     // 运行状态
let POOL = LS.get('pool', []);                                  // 照片池清单
let NOTES = LS.get('notes', []);                                // 备忘录
let FAVS = LS.get('favs', []);                                  // 著信「收藏」

let sTimer;
const saveS = () => { clearTimeout(sTimer); LS.set('settings', S); };
const saveSLater = () => { clearTimeout(sTimer); sTimer = setTimeout(() => LS.set('settings', S), 300); };
const saveM = () => LS.set('msgs', M);
const savePosts = () => LS.set('posts', POSTS);
const saveST = () => LS.set('state', ST);
const savePool = () => LS.set('pool', POOL);
const saveNotes = () => LS.set('notes', NOTES);
const saveFavs = () => LS.set('favs', FAVS);

const pron = () => S.me.pronoun || 'TA';
const TA = () => S.her.gender === '男' ? '他' : '她';            // 界面上指代人物：她 / 他
const herName = () => (S.her.name || TA()).trim();

/*
 * 收入状况：程序生成，界面上不显示，只在 AI 模式下作为人物的生活背景。
 * 现在是占位规则：按学历定一个基数，所在城市是一线 / 新一线的加一点，再加一点随机；
 * 同样的学历、工作、所在地、名字，算出来的结果不变。具体怎么算之后再定。
 */
const INCOME_TIERS = ['手头偏紧', '普通', '中等', '宽裕', '富足'];
function herIncome() {
  const h = S.her, key = [h.edu, h.job, h.region, h.name].join('|');
  if (h.income && h.income.key === key) return h.income.tier;
  const base = { junior: 1.4, senior: 1.8, vocational: 1.9, college: 2.3, bachelor: 2.8, bachelor_key: 3.3, master: 3.5, phd: 3.7 }[h.edu] || 2.6;
  const city = /北京|上海|深圳|广州|杭州|成都|南京|苏州/.test(h.region || '') ? .4 : 0;
  let seed = [...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const tier = Math.max(0, Math.min(4, Math.round(base + city - 1 + (rnd() + rnd() + rnd() - 1.5) * 1.1)));
  h.income = { key, tier }; saveSLater();
  return tier;
}
const myName = () => (S.me.name || '').trim();

/* ---------- 照片 ---------- */
const imgCache = new Map();
async function imgSrc(id) {
  if (!id) return '';
  if (imgCache.has(id)) return imgCache.get(id);
  try { const v = await IDB.get(id); if (v) imgCache.set(id, v); return v || ''; } catch (e) { return ''; }
}
function setImg(img, id) { imgSrc(id).then(s => { if (s) img.src = s; }); }

const fileToDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('图片读不出来')); i.src = src; });

/* 缩到最长边 max，转成 JPEG；square=true 时居中裁成正方形（头像用） */
async function compress(src, max = 1280, q = .86, square = false) {
  const im = await loadImage(src);
  let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
  if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
  const s = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * s); c.height = Math.round(sh * s);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
function dataURLtoBlob(u) {
  const [h, b] = u.split(',');
  const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}
function pickFile(accept, multiple) {
  return new Promise(res => {
    const i = $('#anyfile');
    i.accept = accept || ''; i.multiple = !!multiple; i.value = '';
    i.onchange = () => res([...i.files]);
    i.click();
  });
}
function letterAvatar(ch, from, to) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="80" height="80" fill="url(#g)"/><text x="40" y="53" font-size="34" text-anchor="middle" fill="#fff" font-family="PingFang SC,Noto Sans SC,sans-serif">${xmlEsc(ch)}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const avatarURL = () => S.her.avatar || letterAvatar(herName().slice(0, 1) || TA(), '#7B6BB5', '#F4B183');
const myAvatarURL = () => S.me.avatar || letterAvatar(myName().slice(0, 1) || '我', '#4F8FD6', '#7FD1C2');
function setAvatar(img) { img.src = avatarURL(); }
function setMyAvatar(img) { img.src = myAvatarURL(); }

/* 打卡 */
function checkin(kind, ts) {
  const k = dkey(ts);
  ST.checkins[k] = Object.assign({}, ST.checkins[k], { [kind]: ts });
  saveST();
}
const todayChecks = (t = Date.now()) => ST.checkins[dkey(t)] || {};

/* 桌面图标：data/ui.js 的默认值 + 设置里改过的 */
function appDef(id) {
  const base = APPS[id] || { label: id };
  const o = (S.home || {})[id] || {};
  return { id, label: (o.label || '').trim() || base.label, icon: o.icon || '', ios: o.ios != null && o.ios !== '' ? o.ios : (base.ios || '') };
}
const zxId = () => 'zx_' + (Math.abs([...herName()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1e8).toString(36);
const myZxId = () => 'zx_' + (Math.abs([...(myName() || 'me')].reduce((h, c) => (h * 37 + c.charCodeAt(0)) | 0, 11)) % 1e8).toString(36);
