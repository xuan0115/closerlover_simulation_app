/* 通用小工具：取元素、建元素、时间格式 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* el('div', {class:'x', onclick:fn}, '文字', 子元素…) —— 文本一律按纯文本插入，不会执行 HTML */
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const WD = '日一二三四五六';
const dkey = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtFull = t => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日 星期${WD[d.getDay()]} ${hm(t)}`; };
function ago(ms) {
  ms = Math.max(0, ms);
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' 分钟';
  const h = ms / 3600000;
  if (h < 48) return (h < 10 ? h.toFixed(1) : Math.round(h)) + ' 小时';
  return Math.round(h / 24) + ' 天';
}
function relTime(ts) {
  const d = Date.now() - ts;
  if (d < 60e3) return '现在';
  if (d < 3600e3) return Math.floor(d / 60e3) + ' 分钟前';
  if (dkey(ts) === dkey(Date.now())) return hm(ts);
  if (dkey(ts) === dkey(Date.now() - 864e5)) return '昨天 ' + hm(ts);
  const x = new Date(ts); return `${x.getMonth() + 1}月${x.getDate()}日`;
}
function stampText(ts) {
  const now = Date.now();
  if (dkey(ts) === dkey(now)) return hm(ts);
  if (dkey(ts) === dkey(now - 864e5)) return '昨天 ' + hm(ts);
  const d = new Date(ts); return `${d.getMonth() + 1}月${d.getDate()}日 ${hm(ts)}`;
}
/* 聊天列表右侧的时间：今天显示时刻，昨天、本周几、更早显示日期 */
function listTime(ts) {
  const now = Date.now();
  if (dkey(ts) === dkey(now)) return hm(ts);
  if (dkey(ts) === dkey(now - 864e5)) return '昨天';
  if (now - ts < 6 * 864e5) return '星期' + WD[new Date(ts).getDay()];
  const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`;
}
function partOfDay(t = Date.now()) {
  const h = new Date(t).getHours();
  return h < 5 ? '深夜' : h < 11 ? '早上' : h < 13 ? '中午' : h < 18 ? '下午' : h < 23 ? '晚上' : '深夜';
}
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const xmlEsc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
