/*
 * 不跳转、在网页里自己做的几个 App：
 *   天气      显示 TA 所在地的真实天气（Open-Meteo 的免费接口，不用 Key）
 *   语音备忘录 样子（录音待开发）
 *   第三方 App 一张自己的页面，上面有按钮可以打开手机里真的那个
 */
'use strict';

/* ---------- 天气 ---------- */
const WMO = { 0: ['晴', '☀️'], 1: ['大部晴朗', '🌤️'], 2: ['局部多云', '⛅'], 3: ['阴', '☁️'], 45: ['雾', '🌫️'], 48: ['雾', '🌫️'],
  51: ['小毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['毛毛雨', '🌧️'], 56: ['冻雨', '🌧️'], 57: ['冻雨', '🌧️'], 61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'], 67: ['冻雨', '🌧️'], 71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'], 80: ['阵雨', '🌦️'], 81: ['阵雨', '🌧️'],
  82: ['强阵雨', '🌧️'], 85: ['阵雪', '🌨️'], 86: ['阵雪', '❄️'], 95: ['雷阵雨', '⛈️'], 96: ['雷阵雨', '⛈️'], 99: ['雷阵雨', '⛈️'] };
const wmo = c => WMO[c] || ['—', '🌡️'];
let weatherCache = null;
const cityOf = () => { const r = String(S.her.region || '').trim().split(/\s+/).filter(Boolean); return r[r.length - 1] || ''; };
async function getWeather(city) {
  if (weatherCache && weatherCache.city === city && Date.now() - weatherCache.at < 30 * 60e3) return weatherCache.data;
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`)).json();
  const loc = g.results && g.results[0]; if (!loc) throw new Error('没找到这个地方');
  const q = `latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
  const f = await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json();
  const data = { name: loc.name, f };
  weatherCache = { city, at: Date.now(), data };
  return data;
}
function weatherRoot(pg, app) {
  pg.classList.add('weather', 'ink-light');
  const body = el('div', { class: 'ios-body wt-body' });
  pg.append(el('div', { class: 'wt-sky' }), iosNav(app, { flat: true }), body);
  pg.refresh = render; render();
  async function render() {
    const city = cityOf();
    body.textContent = '';
    if (!city) { body.append(el('p', { class: 'wt-msg' }, `先在「设置 → chatwe聊我 → ${TA()}的人设」里填上${TA()}的所在地。`)); return; }
    body.append(el('p', { class: 'wt-msg' }, '正在获取天气…'));
    let d;
    try { d = await getWeather(city); } catch (e) { body.textContent = ''; body.append(el('div', { class: 'wt-head' }, el('small', {}, `${herName()}所在地`), el('h1', {}, city)), el('p', { class: 'wt-msg' }, '暂时拿不到天气，检查一下网络。')); return; }
    const c = d.f.current, dl = d.f.daily, hr = d.f.hourly, [txt] = wmo(c.weather_code);
    pg.classList.toggle('night', !c.is_day);
    pg.classList.toggle('rainy', [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(c.weather_code));
    body.textContent = '';
    body.append(el('div', { class: 'wt-head' }, el('small', {}, `${herName()}所在地`), el('h1', {}, d.name),
      el('div', { class: 'wt-temp' }, Math.round(c.temperature_2m) + '°'), el('div', { class: 'wt-cond' }, txt),
      el('div', { class: 'wt-hl' }, `最高 ${Math.round(dl.temperature_2m_max[0])}°  最低 ${Math.round(dl.temperature_2m_min[0])}°`)));
    const now = Date.now(), start = hr.time.findIndex(t => new Date(t).getTime() > now - 3600e3);
    const hours = el('div', { class: 'wt-hours' });
    for (let i = Math.max(0, start); i < Math.max(0, start) + 24 && i < hr.time.length; i++) {
      hours.append(el('div', {}, el('small', {}, i === start ? '现在' : new Date(hr.time[i]).getHours() + '时'), el('span', {}, wmo(hr.weather_code[i])[1]), el('b', {}, Math.round(hr.temperature_2m[i]) + '°')));
    }
    const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max);
    const days = el('div', { class: 'wt-days' }, ...dl.time.map((t, i) => {
      const a = dl.temperature_2m_min[i], b = dl.temperature_2m_max[i];
      return el('div', { class: 'wt-day' }, el('span', {}, i ? '周' + WD[new Date(t).getDay()] : '今天'), el('span', { class: 'ic' }, wmo(dl.weather_code[i])[1]),
        el('span', { class: 'lo' }, Math.round(a) + '°'),
        el('span', { class: 'bar' }, el('i', { style: `left:${(a - lo) / (hi - lo || 1) * 100}%;right:${(hi - b) / (hi - lo || 1) * 100}%` })),
        el('span', { class: 'hi' }, Math.round(b) + '°'));
    }));
    body.append(el('section', { class: 'wt-card' }, el('h3', {}, '逐小时预报'), hours), el('section', { class: 'wt-card' }, el('h3', {}, '7 日预报'), days),
      el('p', { class: 'wt-src' }, '天气数据：Open-Meteo'));
  }
}

/* ---------- 语音备忘录（录音待开发） ---------- */
function voiceMemosRoot(pg, app) {
  const body = el('div', { class: 'ios-body' });
  pg.append(iosNav(app, { flat: true }), body,
    el('footer', { class: 'vm-bar' }, el('button', { class: 'vm-rec', 'aria-label': '录音', onclick: () => toast('录音（待开发）') }, el('i'))));
  body.append(el('h1', { class: 'ios-large' }, '所有录音'), el('div', { class: 'ios-searchbox' }, icon('search', 17, 2), '搜索'),
    el('p', { class: 'empty' }, '还没有录音。录音功能还在开发中。'));
}

/* ---------- 第三方 App：自己的页面 ---------- */
function thirdPartyPage(pg, id) {
  const d = appDef(id), open = (S.home[id] && S.home[id].ios) || APPS[id].open;
  pg.append(iosNav('shell', { flat: true }), el('div', { class: 'ios-body shell-body' }, appIcon(id, 92), el('h1', {}, d.label),
    STORE[id] ? el('p', { class: 'tp-cat' }, STORE[id]) : '',
    el('p', {}, '这是「知己」里的模拟 App。'),
    open ? el('button', { class: 'btn primary', onclick: () => isIOS() ? (location.href = open) : toast('只能在 iPhone 上打开') }, `打开手机里的「${d.label}」`) : '',
    open ? el('p', { class: 'hint' }, '要手机上装了这个 App 才能打开；没装的话 Safari 会提示「网址无效」。') : ''));
}
