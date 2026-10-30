/*
 * 声音：按住说话录语音（顺便识别成文字）、把她的话念出来、语音通话。
 * 录音和识别要浏览器允许用麦克风；朗读用系统自带的中文语音。
 */
'use strict';

/* ---------- 朗读她的话 ---------- */
let zhVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^zh/i.test(v.lang));
  const pref = ['Tingting', 'Ting-Ting', 'Xiaoxiao', 'Xiaoyi', 'Lili', 'Yu-shu', 'Meijia', 'Google 普通话', 'Female'];
  zhVoice = vs.find(v => pref.some(p => v.name.includes(p)) && /CN/i.test(v.lang)) || vs.find(v => /CN/i.test(v.lang)) || vs[0] || null;
  return zhVoice;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', pickVoice); }
function speak(text, onend) {
  if (!('speechSynthesis' in window)) { setTimeout(() => onend && onend(), Math.min(4000, 300 + text.length * 180)); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; u.rate = 1.05; u.pitch = 1.15;
  if (zhVoice || pickVoice()) u.voice = zhVoice;
  let done = false; const fin = () => { if (!done) { done = true; onend && onend(); } };
  u.onend = fin; u.onerror = fin;
  setTimeout(fin, 1500 + text.length * 400); // 有的浏览器不触发 onend
  speechSynthesis.speak(u);
}
function stopSpeak() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

/* ---------- 识别你说的话 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function listen() {
  if (!SR) return null;
  const r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
  let text = '', ended = false, resolveEnd;
  const endP = new Promise(res => { resolveEnd = res; });
  r.onresult = e => { text = [...e.results].map(x => x[0].transcript).join(''); };
  r.onerror = () => {}; r.onend = () => { ended = true; resolveEnd(); };
  try { r.start(); } catch (e) { return null; }
  return { async stop() { try { r.stop(); } catch (e) {} await Promise.race([endP, sleep(1500)]); return text.trim(); }, abort() { try { r.abort(); } catch (e) {} } };
}

/* ---------- 按住说话 ---------- */
async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) throw new Error('这个浏览器不能录音');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream), chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  const ears = listen();
  const t0 = Date.now();
  rec.start();
  return {
    async stop(cancel) {
      try { rec.stop(); } catch (e) {}
      await stopped; stream.getTracks().forEach(t => t.stop());
      const transcript = ears ? (cancel ? (ears.abort(), '') : await ears.stop()) : '';
      if (cancel) return null;
      const dur = Math.round((Date.now() - t0) / 1000);
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const dataURL = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      return { dataURL, dur, transcript };
    }
  };
}

/* ---------- 播放语音消息 ---------- */
let playing = null;
async function playVoice(m, node) {
  if (playing) { playing.stop(); if (playing.id === m.id) { playing = null; return; } }
  node.classList.add('playing');
  const done = () => { node.classList.remove('playing'); if (playing && playing.id === m.id) playing = null; };
  if (m.from === 'her') {
    if (!m.played) { m.played = true; saveM(); const d = node.parentNode.querySelector('.wx-unplayed'); if (d) d.remove(); }
    playing = { id: m.id, stop: () => { stopSpeak(); done(); } };
    speak(m.text, done);
  } else {
    const src = await imgSrc(m.audioId);
    if (!src) { done(); toast('这段语音找不到了'); return; }
    const a = new Audio(src);
    playing = { id: m.id, stop: () => { a.pause(); done(); } };
    a.onended = done; a.onerror = done;
    a.play().catch(done);
  }
}

/* ---------- 简单的铃声（用不了也没关系） ---------- */
let ringCtx = null, ringT = null;
function ring(kind) {
  stopRing();
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      if (!ringCtx) return;
      const o = ringCtx.createOscillator(), g = ringCtx.createGain();
      o.frequency.value = kind === 'in' ? 880 : 440; o.connect(g); g.connect(ringCtx.destination);
      g.gain.setValueAtTime(.0001, ringCtx.currentTime); g.gain.exponentialRampToValueAtTime(.08, ringCtx.currentTime + .05);
      g.gain.exponentialRampToValueAtTime(.0001, ringCtx.currentTime + (kind === 'in' ? .5 : 1.2));
      o.start(); o.stop(ringCtx.currentTime + 1.3);
    };
    beep(); ringT = setInterval(beep, kind === 'in' ? 1100 : 3000);
  } catch (e) {}
}
function stopRing() { clearInterval(ringT); ringT = null; if (ringCtx) { try { ringCtx.close(); } catch (e) {} ringCtx = null; } }

/* ---------- 语音通话 ---------- */
const Call = { on: false };
function startCall(dir, ev) {
  if (Call.on) return;
  if (!ST.started) { ST.started = true; ST.lastTick = Date.now(); saveST(); }
  Object.assign(Call, { on: true, dir, state: dir === 'in' ? 'ringing' : 'dialing', t0: 0, log: [], timer: null, idleT: null, busy: false, ears: null, ev });
  const box = el('div', { class: 'call overlay', id: 'call' });
  const bg = el('div', { class: 'call-bg' }); bg.style.backgroundImage = `url("${avatarURL()}")`;
  const av = el('img', { class: 'call-av', alt: '' }); setAvatar(av);
  const status = el('div', { class: 'call-status' });
  const cap = el('div', { class: 'call-cap' });
  const btns = el('div', { class: 'call-btns' });
  box.append(bg, el('div', { class: 'call-top' }, av, el('div', { class: 'call-name' }, herName()), status), cap, btns);
  $('#phone').append(box);
  Call.box = box; Call.status = status; Call.cap = cap; Call.btns = btns;
  requestAnimationFrame(() => box.classList.add('on'));
  if (dir === 'in') {
    status.textContent = '邀请你语音通话…';
    btns.append(callBtn('拒绝', 'hang', () => endCall('declined')), callBtn('接听', 'ok', () => connectCall()));
    ring('in');
    Call.missT = setTimeout(() => { if (Call.state === 'ringing') endCall('missed'); }, 30000);
  } else {
    status.textContent = '正在等待对方接受邀请…';
    btns.append(callBtn('取消', 'hang', () => endCall('cancel')));
    ring('out');
    Call.missT = setTimeout(() => { if (Call.state === 'dialing') connectCall(); }, 2500 + Math.random() * 3000);
  }
}
function callBtn(label, kind, fn) { return el('button', { class: 'call-btn ' + kind, onclick: fn }, el('span', {}, icon(kind === 'ok' ? 'phone' : kind === 'mic' ? 'mic' : kind === 'spk' ? 'speaker' : 'phoneDown', 30, 1.8)), label); }
async function connectCall() {
  clearTimeout(Call.missT); stopRing();
  Call.state = 'active'; Call.t0 = Date.now();
  const tick = () => { Call.status.textContent = fmtDur(Math.round((Date.now() - Call.t0) / 1000)); };
  tick(); Call.timer = setInterval(tick, 1000);
  Call.btns.textContent = '';
  const talk = SR ? callBtn('按住说话', 'mic', () => {}) : null;
  if (talk) {
    talk.classList.add('talk');
    talk.addEventListener('pointerdown', e => { e.preventDefault(); if (Call.busy) return; stopSpeak(); Call.ears = listen(); talk.classList.add('down'); });
    const up = async () => {
      if (!Call.ears) return; talk.classList.remove('down');
      const said = await Call.ears.stop(); Call.ears = null;
      if (said) herCallTurn(said); else toast('没听清，再说一遍');
    };
    talk.addEventListener('pointerup', up); talk.addEventListener('pointerleave', up);
  }
  const typeIn = !SR ? el('form', { class: 'call-type', onsubmit: e => { e.preventDefault(); const v = inp.value.trim(); if (v) { inp.value = ''; herCallTurn(v); } } }) : null;
  const inp = el('input', { placeholder: '浏览器不能识别语音，打字说给她听', 'aria-label': '说给她听' });
  if (typeIn) typeIn.append(inp, el('button', {}, '说'));
  Call.btns.append(...[talk, callBtn('挂断', 'hang', () => endCall('done'))].filter(Boolean));
  if (typeIn) Call.btns.before(typeIn);
  await herCallSay(await herSays('call-start', { incoming: Call.dir === 'in' }));
  armIdle();
}
function armIdle() {
  clearTimeout(Call.idleT);
  Call.idleT = setTimeout(async () => { if (Call.state === 'active' && !Call.busy) { await herCallSay(await herSays('call-idle', { log: Call.log, incoming: Call.dir === 'in' })); } }, 20000);
}
async function herCallTurn(said) {
  if (Call.state !== 'active') return;
  Call.log.push({ who: 'me', text: said });
  Call.cap.textContent = '你：' + said;
  Call.busy = true;
  const lines = await herSays('call-turn', { log: Call.log, said, incoming: Call.dir === 'in' }).catch(() => tplCall('turn', said));
  Call.busy = false;
  await herCallSay(lines);
  armIdle();
}
function herCallSay(lines) {
  return new Promise(res => {
    const next = i => {
      if (Call.state !== 'active' || i >= lines.length) return res();
      Call.log.push({ who: 'her', text: lines[i] });
      Call.cap.textContent = lines[i];
      speak(lines[i], () => next(i + 1));
    };
    next(0);
  });
}
async function endCall(how) {
  if (!Call.on) return;
  const st = Call.state;
  clearTimeout(Call.missT); clearTimeout(Call.idleT); clearInterval(Call.timer); stopRing();
  if (Call.ears) Call.ears.abort();
  Call.on = false; Call.state = null;
  if (how === 'done' && st === 'active') {
    stopSpeak();
    const bye = await herSays('call-bye');
    Call.cap.textContent = bye[0] || '';
  }
  stopSpeak();
  Call.box.classList.remove('on'); setTimeout(() => Call.box.remove(), 350);
  const dur = st === 'active' ? Math.round((Date.now() - Call.t0) / 1000) : 0;
  const from = Call.dir === 'out' ? 'me' : 'her';
  const status = st === 'active' ? 'done' : how === 'declined' ? 'declined' : how === 'cancel' ? 'cancel' : 'missed';
  addMsg({ id: uid('m'), from, type: 'call', status, dur, ts: Date.now() });
  if (Call.dir === 'in' && st !== 'active') enqueue(async () => { await sleep(1500); for (const t of tplPick('callMissed')) { addMsg({ id: uid('m'), from: 'her', type: 'text', text: t, ts: Date.now() }); await sleep(900); } });
}
