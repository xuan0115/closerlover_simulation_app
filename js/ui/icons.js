/* 图标：都是简单的线条图形（24×24），不使用任何品牌标志 */
'use strict';

const ICONS = {
  back: '<path d="M15 4.5 7.5 12l7.5 7.5"/>',
  chevron: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  voice: '<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.8a3 3 0 0 1 0 4.4M12 7.6a6.3 6.3 0 0 1 0 8.8"/>',
  smile: '<circle cx="12" cy="12" r="9.5"/><path d="M8.2 14.2a4.6 4.6 0 0 0 7.6 0"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/>',
  plusCircle: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v9M7.5 12h9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M12 4.2c-4.8 0-8.6 3.2-8.6 7.1 0 2.2 1.2 4.2 3.2 5.5l-.6 3 3.3-1.7c.9.2 1.8.3 2.7.3 4.8 0 8.6-3.2 8.6-7.1S16.8 4.2 12 4.2z"/>',
  chatFill: '<path fill="currentColor" stroke="none" d="M12 4c-5 0-9 3.3-9 7.4 0 2.3 1.3 4.4 3.3 5.7l-.7 3.2 3.5-1.8c.9.2 1.9.3 2.9.3 5 0 9-3.3 9-7.4S17 4 12 4z"/>',
  contacts: '<rect x="4.5" y="3" width="15" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.8"/><path d="M8 17c.6-2 2.2-3 4-3s3.4 1 4 3"/>',
  compass: '<circle cx="12" cy="12" r="9.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  person: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.8-3.8 3.9-6.2 7.5-6.2s6.7 2.4 7.5 6.2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  heartFill: '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1L19 10.5l-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  photo: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.8h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>',
  wall: '<rect x="5.5" y="2.5" width="13" height="19" rx="3"/><path d="M5.5 15.5l4-3.5 3 2.5 3-2 3 2.5"/>',
  box: '<path d="M4.5 8.5h15V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19zM3 4.5h18v4H3zM10 12h4"/>',
  note: '<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M9 10.5h6M9 14h6M9 17.5h4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.5 2.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/><circle cx="12" cy="12" r="6.4"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.6"/>',
  book: '<path d="M4 5.5c2.5-1 5.5-1 8 .5 2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>',
  dumbbell: '<path d="M3.5 10v4M6.5 7.5v9M17.5 7.5v9M20.5 10v4M6.5 12h11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  star: '<path d="M12 4l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.7l-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>',
  personAdd: '<circle cx="10" cy="8.5" r="3.8"/><path d="M3.5 20c.7-3.6 3.3-5.8 6.5-5.8 1.3 0 2.5.3 3.5 1M18 13v6M15 16h6"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
  aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3l3 7.5M21 12l-7.5 2.5M15 20.5l-4.5-6.5M3.5 15l7-2.5M8 4l2.5 6"/>',
  play: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  live: '<circle cx="12" cy="12" r="3"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/>',
  music: '<path d="M9 18.5V6l10-2v12.5"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  grid: '<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>',
  service: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M8.5 6V4.5h7V6M3.5 11.5h17"/>',
  keyboard: '<circle cx="12" cy="12" r="9.5"/><path d="M7.5 10h.01M10.5 10h.01M13.5 10h.01M16.5 10h.01M8.5 14.5h7"/>',
  wave: '<path d="M6 12h.01M9.5 8.5a5 5 0 0 1 0 7M13.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10.5 5 7 4.5 7 6.5S10 8.5 12 8.5zM12 8.5C13.5 5 17 4.5 17 6.5S14 8.5 12 8.5z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  textT: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  quote: '<path d="M5 18v-5.5C5 9 7 7 10 6.5M14 18v-5.5C14 9 16 7 19 6.5"/><path d="M5 12.5h4v5.5H5zM14 12.5h4v5.5h-4z"/>',
  recall: '<path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10H11"/>',
  bellOff: '<path d="M6 16.5V11a6 6 0 0 1 9.5-4.9M18 11v5.5l1.5 1.8h-12M10 20.5a2.2 2.2 0 0 0 4 0M4 4l16 16"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  phoneDown: '<path d="M3 14.5c5-4.7 13-4.7 18 0l-1.5 2.8-4-1.3v-2.5a10 10 0 0 0-7 0V16l-4 1.3z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  checklist: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><circle cx="5.5" cy="6.5" r="1.4"/><circle cx="5.5" cy="12" r="1.4"/><circle cx="5.5" cy="17.5" r="1.4"/>',
  plane: '<path d="M10.5 3.5h3V9l7 4v2l-7-2v4.5l2.5 2v1.5L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4z"/>',
  battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M22 10.5v3"/><rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11.5V5a1.5 1.5 0 0 1 3 0v6.5M14 11.5V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7S5 18.5 4 16l-1.5-3.5a1.4 1.4 0 0 1 2.5-1.2L8 15"/>',
  bolt: '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M4.5 7.5h15M4.5 16.5h15"/>',
  alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M4 5l3-2.5M20 5l-3-2.5"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/>',
  timer: '<circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 12l4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  wifi: '<path d="M4 9.5a11.5 11.5 0 0 1 16 0M7 12.5a7.2 7.2 0 0 1 10 0M10 15.5a3 3 0 0 1 4 0"/><circle cx="12" cy="18.5" r=".9" fill="currentColor"/>',
  bluetooth: '<path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9"/>',
  antenna: '<path d="M12 10v10M8.5 7a5 5 0 0 1 7 0M6 4.5a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="9.5" r="1.4"/>',
  link2: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/>',
  moon: '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/>',
  hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  access: '<circle cx="12" cy="5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v4.5l-3 6M12 14.5l3 6"/>',
  sliders: '<path d="M5 7h14M5 17h14"/><circle cx="9" cy="7" r="2.4"/><circle cx="15" cy="17" r="2.4"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8"/><circle cx="8.5" cy="11.5" r=".8" fill="currentColor"/><circle cx="12" cy="11.5" r=".8" fill="currentColor"/><circle cx="15.5" cy="11.5" r=".8" fill="currentColor"/><circle cx="8.5" cy="15" r=".8" fill="currentColor"/><circle cx="12" cy="15" r=".8" fill="currentColor"/><circle cx="8.5" cy="18" r=".8" fill="currentColor"/><circle cx="12" cy="18" r=".8" fill="currentColor"/><path d="M15.5 14.5v4"/>',
  lines: '<path d="M6 7h12M6 11h12M6 15h12M6 19h7"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  compose: '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5l3 3L12 15l-4 1 1-4z"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>'
};

function icon(name, size = 24, sw = 1.8) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', sw); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}

/* ---------- 桌面上的 App 图标 ----------
 * 每个图标 = 一个背景（CSS）+ 一张 100×100 的 SVG 图案。图案都是通用的（齿轮、信封、音符……）。
 * 想换成自己的图片：网页里「设置 → 主屏幕与 App 资源库 → 某个 App → 换成图片」。
 */
const FONT = `-apple-system,'SF Pro Display','PingFang SC','Helvetica Neue',sans-serif`;
const T = (x, y, size, fill, txt, w = 600) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="middle" font-family="${FONT}">${txt}</text>`;
function gearPath(cx, cy, ro, ri, n, hole) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, w = Math.PI / n * .55;
    const pts = [[a - w * 1.25, ri], [a - w * .7, ro], [a + w * .7, ro], [a + w * 1.25, ri], [a + Math.PI / n, ri]];
    for (const [ang, r] of pts) d += (d ? 'L' : 'M') + (cx + Math.cos(ang) * r).toFixed(2) + ' ' + (cy + Math.sin(ang) * r).toFixed(2);
  }
  d += 'Z';
  d += `M${cx + hole} ${cy}A${hole} ${hole} 0 1 0 ${cx - hole} ${cy}A${hole} ${hole} 0 1 0 ${cx + hole} ${cy}Z`;
  return d;
}
function clockArt() {
  const d = new Date(), h = d.getHours() % 12 + d.getMinutes() / 60, m = d.getMinutes() + d.getSeconds() / 60;
  const hand = (deg, len, w, col, back = 6) => { const a = (deg - 90) * Math.PI / 180; return `<line x1="${50 - Math.cos(a) * back}" y1="${50 - Math.sin(a) * back}" x2="${50 + Math.cos(a) * len}" y2="${50 + Math.sin(a) * len}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * Math.PI / 180, big = i % 5 === 0, r1 = big ? 36 : 38.5, r2 = 41;
    ticks += `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * r2}" y2="${50 - Math.cos(a) * r2}" stroke="#1c1c1e" stroke-width="${big ? 1.8 : .7}"/>`;
  }
  return ticks + T(50, 25, 11, '#1c1c1e', '12', 500) + T(80, 54, 11, '#1c1c1e', '3', 500) + T(50, 84, 11, '#1c1c1e', '6', 500) + T(20, 54, 11, '#1c1c1e', '9', 500) +
    hand(h * 30, 20, 4, '#1c1c1e') + hand(m * 6, 31, 2.8, '#1c1c1e') + hand(d.getSeconds() * 6, 33, 1.2, '#FF9500', 9) + '<circle cx="50" cy="50" r="2.6" fill="#FF9500"/>';
}
function calendarArt() {
  const d = new Date();
  return T(50, 31, 17, '#FF3B30', '周' + WD[d.getDay()], 500) + T(50, 81, 52, '#1c1c1e', d.getDate(), 300);
}
const APP_ART = {
  wx:        { bg: 'linear-gradient(180deg,#5EE07F 0%,#12B84E 100%)',   // 一个笑脸泡泡
               svg: '<path d="M50 19c-19.5 0-35 13-35 29.5 0 9.4 5 17.7 12.8 23.1L24.5 82l12-6.2c4.2 1.4 8.7 2.1 13.5 2.1 19.5 0 35-13 35-29.4S69.5 19 50 19z" fill="#fff"/><circle cx="38.5" cy="44" r="4.6" fill="#12B84E"/><circle cx="61.5" cy="44" r="4.6" fill="#12B84E"/><path d="M37 55.5c3.4 5.2 8 7.8 13 7.8s9.6-2.6 13-7.8" stroke="#12B84E" stroke-width="4.4" fill="none" stroke-linecap="round"/>' },
  messages:  { bg: 'linear-gradient(180deg,#6BF08A 0%,#17C445 100%)',
               svg: '<path d="M50 20c-20 0-36 13-36 29 0 9 5 17 13 22-1 5-4 9-8 12 7 0 13-3 17-6 4 1 9 2 14 2 20 0 36-13 36-30S70 20 50 20z" fill="#fff"/>' },
  photos:    { bg: '#fff', light: true,
               svg: '<rect x="16" y="22" width="68" height="56" rx="10" fill="#9BD7FF"/><circle cx="66" cy="38" r="8" fill="#FFC23D"/><path d="M16 70l20-24 14 16 9-9 25 25v0a10 10 0 0 1-10 0H26a10 10 0 0 1-10-8z" fill="#3DBE6A"/><path d="M16 78V66l20-20 22 32z" fill="#2B9E55"/>' },
  camera:    { bg: 'linear-gradient(180deg,#E6E6EB 0%,#B4B4BC 100%)', light: true,
               svg: '<circle cx="50" cy="50" r="31" fill="#2a2a2e"/><circle cx="50" cy="50" r="26" fill="#0d0d10"/><circle cx="50" cy="50" r="18" fill="#1b2445"/><circle cx="50" cy="50" r="10" fill="#070a16"/><ellipse cx="42" cy="41" rx="6" ry="3.4" fill="#fff" opacity=".75" transform="rotate(-35 42 41)"/><circle cx="58" cy="58" r="3" fill="#7d86ff" opacity=".8"/>' },
  calendar:  { bg: '#fff', light: true, svg: calendarArt },
  notes:     { bg: '#fff', light: true,
               svg: '<rect width="100" height="27" fill="#FFD52E"/><rect y="27" width="100" height="2" fill="#E8B800" opacity=".5"/><rect x="14" y="45" width="72" height="2.4" rx="1.2" fill="#D1D1D6"/><rect x="14" y="61" width="72" height="2.4" rx="1.2" fill="#D1D1D6"/><rect x="14" y="77" width="72" height="2.4" rx="1.2" fill="#D1D1D6"/>' },
  reminders: { bg: '#fff', light: true,
               svg: '<circle cx="25" cy="30" r="7" fill="#007AFF"/><circle cx="25" cy="50" r="7" fill="#FF3B30"/><circle cx="25" cy="70" r="7" fill="#FF9500"/><rect x="38" y="28" width="46" height="4" rx="2" fill="#D1D1D6"/><rect x="38" y="48" width="46" height="4" rx="2" fill="#D1D1D6"/><rect x="38" y="68" width="46" height="4" rx="2" fill="#D1D1D6"/>' },
  clock:     { bg: 'linear-gradient(180deg,#FFFFFF 0%,#EDEDF1 100%)', light: true, svg: clockArt },
  weather:   { bg: 'linear-gradient(180deg,#4796EC 0%,#1E5FC8 100%)',
               svg: '<circle cx="62" cy="40" r="16" fill="#FFCD3C"/><g fill="#fff"><circle cx="38" cy="60" r="13"/><circle cx="53" cy="54" r="16"/><circle cx="67" cy="63" r="11"/><rect x="25" y="60" width="54" height="14" rx="7"/></g>' },
  maps:      { bg: '#EAF2E3', light: true,
               svg: '<rect x="0" y="0" width="44" height="40" fill="#BFE3A8"/><rect x="58" y="56" width="42" height="44" fill="#F6E9C6"/><path d="M0 50h100M50 0v100" stroke="#fff" stroke-width="8"/><path d="M0 82L100 18" stroke="#FFD66B" stroke-width="7"/><path d="M22 92C30 66 56 74 62 46" stroke="#1E88FF" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M62 18c-8 0-13 6-13 12 0 9 13 20 13 20s13-11 13-20c0-6-5-12-13-12z" fill="#FF3B30"/><circle cx="62" cy="30" r="4.5" fill="#fff"/>' },
  mail:      { bg: 'linear-gradient(180deg,#4DB3FF 0%,#1474F0 100%)',
               svg: '<rect x="18" y="30" width="64" height="42" rx="6" fill="#fff"/><path d="M21 34l29 21 29-21" stroke="#2d86f5" stroke-width="3.2" fill="none" stroke-linejoin="round"/>' },
  music:     { bg: 'linear-gradient(180deg,#FF6A84 0%,#F42F55 100%)',
               svg: '<path d="M40 30l32-8v40" stroke="#fff" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M40 30v40" stroke="#fff" stroke-width="5"/><ellipse cx="33" cy="71" rx="9" ry="7" fill="#fff" transform="rotate(-20 33 71)"/><ellipse cx="65" cy="63" rx="9" ry="7" fill="#fff" transform="rotate(-20 65 63)"/>' },
  health:    { bg: '#fff', light: true,
               svg: '<path d="M50 78S20 60 20 40c0-10 8-17 16-17 6 0 11 3 14 8 3-5 8-8 14-8 8 0 16 7 16 17 0 20-30 38-30 38z" fill="#FF2D55"/>' },
  files:     { bg: 'linear-gradient(180deg,#5AC8FA 0%,#1C8CF0 100%)',
               svg: '<path d="M18 32c0-3 2-5 5-5h17l6 6h31c3 0 5 2 5 5v31c0 3-2 5-5 5H23c-3 0-5-2-5-5z" fill="#fff"/><rect x="18" y="40" width="64" height="2.5" fill="#bfe3ff"/>' },
  safari:    { bg: 'linear-gradient(180deg,#5BB8FF 0%,#1A6FE8 100%)',
               svg: '<g fill="none" stroke="#fff" stroke-width="3.6"><circle cx="50" cy="50" r="28"/><ellipse cx="50" cy="50" rx="12" ry="28"/><path d="M22 50h56M26 36h48M26 64h48"/></g>' },
  appstore:  { bg: 'linear-gradient(180deg,#3DB4FF 0%,#1366F0 100%)',
               svg: '<path d="M38 38v-4a12 12 0 0 1 24 0v4" stroke="#fff" stroke-width="4.5" fill="none"/><path d="M26 38h48l-4 38H30z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' },
  books:     { bg: 'linear-gradient(180deg,#FFAE3D 0%,#F27A1A 100%)',
               svg: '<path d="M50 32c-8-6-20-7-30-5v44c10-2 22-1 30 5 8-6 20-7 30-5V27c-10-2-22-1-30 5z" fill="#fff"/><path d="M50 32v44" stroke="#F59A2E" stroke-width="2.5"/>' },
  podcasts:  { bg: 'linear-gradient(180deg,#C36BF5 0%,#8E32D9 100%)',
               svg: '<rect x="42" y="24" width="16" height="30" rx="8" fill="#fff"/><path d="M34 46a16 16 0 0 0 32 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 62v14M42 76h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M24 34a30 30 0 0 0 0 26M76 34a30 30 0 0 1 0 26" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>' },
  tv:        { bg: 'linear-gradient(180deg,#2E2E33 0%,#0E0E10 100%)',
               svg: '<rect x="20" y="28" width="60" height="38" rx="6" fill="none" stroke="#fff" stroke-width="4"/><path d="M38 76h24" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M45 39l14 8-14 8z" fill="#fff"/>' },
  facetime:  { bg: 'linear-gradient(180deg,#5FEA7E 0%,#1BC24A 100%)',
               svg: '<rect x="18" y="34" width="42" height="32" rx="8" fill="#fff"/><path d="M64 46l16-10v28L64 54z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' },
  findmy:    { bg: 'linear-gradient(180deg,#45D483 0%,#13A353 100%)',
               svg: '<g fill="none" stroke="#fff"><circle cx="50" cy="50" r="30" stroke-width="2.5" opacity=".45"/><circle cx="50" cy="50" r="20" stroke-width="2.5" opacity=".7"/></g><circle cx="50" cy="50" r="9" fill="#fff"/><circle cx="50" cy="50" r="4" fill="#1E88FF"/>' },
  wallet:    { bg: 'linear-gradient(180deg,#3A3A3F 0%,#1C1C1E 100%)',
               svg: '<rect x="18" y="30" width="64" height="44" rx="9" fill="#F2C14E"/><rect x="18" y="30" width="64" height="12" rx="6" fill="#F7D57E"/><rect x="56" y="46" width="28" height="18" rx="6" fill="#DFA42A"/><circle cx="66" cy="55" r="3.5" fill="#fff"/>' },
  shortcuts: { bg: 'linear-gradient(135deg,#FF5E8A 0%,#8A5CFF 55%,#33A0FF 100%)',
               svg: '<path d="M56 18L28 56h20l-6 26 30-40H52z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' },
  voicememos:{ bg: 'linear-gradient(180deg,#2A2A2E 0%,#0F0F11 100%)',
               svg: [10, 22, 34, 16, 42, 28, 12, 30, 20, 8].map((h, i) => `<rect x="${21 + i * 6.4}" y="${50 - h / 2}" width="3.6" height="${h}" rx="1.8" fill="${i === 5 ? '#FF453A' : '#fff'}"/>`).join('') },
  stocks:    { bg: 'linear-gradient(180deg,#232327 0%,#0B0B0D 100%)',
               svg: '<path d="M18 34h64M18 50h64M18 66h64" stroke="#3a3a3e" stroke-width="1.5"/><path d="M18 70l14-12 12 6 14-20 10 8 14-18" stroke="#34C759" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  calc:      { bg: 'linear-gradient(180deg,#3A3A3E 0%,#1C1C1E 100%)',
               svg: '<circle cx="34" cy="34" r="13" fill="#5c5c60"/><circle cx="66" cy="34" r="13" fill="#FF9F0A"/><circle cx="34" cy="66" r="13" fill="#5c5c60"/><circle cx="66" cy="66" r="13" fill="#FF9F0A"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M28 34h12M60 34h12M66 28v12M28 66h12M60 62h12M60 70h12"/></g>' },
  settings:  { bg: 'linear-gradient(180deg,#B8B8BE 0%,#6E6E76 100%)',
               svg: () => `<path d="${gearPath(50, 50, 38, 32, 18, 0)}" fill="#3d3d42"/><circle cx="50" cy="50" r="29" fill="#d9d9de"/><circle cx="50" cy="50" r="24" fill="#8e8e93"/><path d="${gearPath(50, 50, 22, 18, 10, 7)}" fill="#ececef" fill-rule="evenodd"/>` },
  /* 第三方 App：都是通用图案，不是它们的标志 */
  xhs:       { bg: 'linear-gradient(180deg,#FF6B7A 0%,#F2334D 100%)',
               svg: '<rect x="27" y="22" width="46" height="58" rx="7" fill="#fff"/><path d="M36 38h28M36 49h28M36 60h17" stroke="#F2334D" stroke-width="4" stroke-linecap="round"/><path d="M66 58l3.2 6.5 7.2 1-5.2 5 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.2-5 7.2-1z" fill="#FFC93C" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>' },
  meituan:   { bg: 'linear-gradient(180deg,#FFD84D 0%,#FFB800 100%)',
               svg: '<path d="M22 50h56a28 28 0 0 1-56 0z" fill="#fff"/><path d="M30 46c2-14 38-14 40 0" fill="#fff" opacity=".55"/><path d="M60 22l-10 22M68 24L56 45" stroke="#7A4B00" stroke-width="3.5" stroke-linecap="round"/><path d="M40 60h20" stroke="#FFB800" stroke-width="3.5" stroke-linecap="round"/>' },
  netease:   { bg: 'linear-gradient(180deg,#F04A4A 0%,#C9161D 100%)',
               svg: '<circle cx="50" cy="50" r="28" fill="#1d1d1f"/><circle cx="50" cy="50" r="21" fill="none" stroke="#3a3a3e" stroke-width="1.5"/><circle cx="50" cy="50" r="14" fill="none" stroke="#3a3a3e" stroke-width="1.5"/><circle cx="50" cy="50" r="9" fill="#fff"/><circle cx="50" cy="50" r="2.6" fill="#C9161D"/>' },
  douban:    { bg: 'linear-gradient(180deg,#4CCB6A 0%,#1F9E47 100%)',
               svg: '<rect x="20" y="30" width="60" height="40" rx="6" fill="#fff"/><path d="M20 40h60M20 60h60" stroke="#1F9E47" stroke-width="2.5"/><g fill="#1F9E47"><rect x="25" y="32.5" width="5" height="5" rx="1"/><rect x="38" y="32.5" width="5" height="5" rx="1"/><rect x="51" y="32.5" width="5" height="5" rx="1"/><rect x="64" y="32.5" width="5" height="5" rx="1"/><rect x="25" y="62.5" width="5" height="5" rx="1"/><rect x="38" y="62.5" width="5" height="5" rx="1"/><rect x="51" y="62.5" width="5" height="5" rx="1"/><rect x="64" y="62.5" width="5" height="5" rx="1"/></g><path d="M46 44l9 6-9 6z" fill="#1F9E47"/>' },
  weread:    { bg: 'linear-gradient(180deg,#3FA9F5 0%,#1677D9 100%)',
               svg: '<path d="M50 30c-8-5-19-6-28-4v44c9-2 20-1 28 4 8-5 19-6 28-4V26c-9-2-20-1-28 4z" fill="#fff"/><path d="M50 30v44" stroke="#1677D9" stroke-width="2.5"/><path d="M62 24v18l5-4 5 4V24" fill="#FFC93C"/>' },
  duolingo:  { bg: 'linear-gradient(180deg,#6BD83A 0%,#3FAE15 100%)',
               svg: '<rect x="16" y="24" width="40" height="32" rx="8" fill="#fff"/><path d="M26 56l-4 9 11-9z" fill="#fff"/>' + T(36, 48, 20, '#3FAE15', '文', 700) + '<rect x="46" y="44" width="38" height="30" rx="8" fill="#235E0A"/><path d="M74 74l4 8-11-8z" fill="#235E0A"/>' + T(65, 66, 19, '#fff', 'A', 700) },
  xiaoyuzhou:{ bg: 'linear-gradient(160deg,#2B2F6B 0%,#111432 100%)',
               svg: '<path d="M30 54a20 20 0 0 1 40 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="25" y="52" width="10" height="17" rx="4" fill="#fff"/><rect x="65" y="52" width="10" height="17" rx="4" fill="#fff"/><circle cx="70" cy="27" r="3" fill="#FFD84D"/><circle cx="28" cy="31" r="2" fill="#9fa8ff"/><circle cx="80" cy="44" r="1.6" fill="#fff"/>' },
  wxwork:    { bg: 'linear-gradient(180deg,#3E8BF0 0%,#1E5FD1 100%)',
               svg: '<rect x="20" y="36" width="60" height="40" rx="7" fill="#fff"/><path d="M40 36v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" stroke="#fff" stroke-width="4.5" fill="none"/><path d="M20 52h60" stroke="#1E5FD1" stroke-width="3"/><rect x="45" y="48" width="10" height="9" rx="2" fill="#1E5FD1"/>' },
  folder:    { bg: 'rgba(255,255,255,.32)', svg: '' }
};
const APP_STYLE = APP_ART; // 旧名字
/* size 不填时由 CSS 决定大小（桌面图标），填了就是固定像素 */
function appIcon(id, size) {
  const a = APP_ART[id] || { bg: 'linear-gradient(180deg,#B0B0B8,#77777F)', svg: '' };
  const sq = el('span', { class: 'squircle' + (a.light ? ' light' : '') });
  if (size) sq.style.fontSize = size + 'px';
  const custom = appDef(id).icon;
  if (custom) { sq.style.background = `center/cover url("${custom}")`; sq.classList.add('custom'); return sq; }
  sq.style.background = a.bg;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('class', 'art'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = typeof a.svg === 'function' ? a.svg() : (a.svg || ICONS.apps && `<g transform="translate(22 22) scale(2.3)" fill="none" stroke="#fff" stroke-width="1.8">${ICONS.apps}</g>`);
  sq.append(s);
  return sq;
}
