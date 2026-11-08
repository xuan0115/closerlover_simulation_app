/*
 * 跟模型服务打交道：聊天、生成照片、列出模型。
 * 浏览器直接请求接口，Key 只存在本机浏览器里。
 */
'use strict';

const trimBase = s => String(s || '').trim().replace(/\/+$/, '');

function chatConf() {
  const a = S.api, d = CHAT_PROVIDERS[a.provider] || {};
  // 内置 AI 不用 Key：调用时用登录凭证（见 callLLM）
  const key = a.provider === 'builtin' ? '' : String(a.key || '').trim();
  return {
    provider: a.provider,
    base: trimBase(a.base || d.base),
    key: key,
    model: String(a.model || d.model || '').trim().replace(/^models\//, ''),
    json: a.json !== false
  };
}

function imgConf() {
  const p = S.photo, d = IMAGE_PROVIDERS[p.provider] || IMAGE_PROVIDERS.openai;
  const reuse = S.api.provider === p.provider ? S.api.key : ''; // 同一家服务时沿用聊天的 Key
  return {
    provider: p.provider,
    base: trimBase(p.base || d.base),
    key: String(p.key || reuse || '').trim(),
    model: String(p.model || d.model).trim().replace(/^models\//, '')
  };
}

const netError = e => new Error('连不上接口（' + e.message + '）。检查网络或代理；如果用的是其他兼容接口，它可能不允许浏览器直接访问。');
/* 等太久就放弃（默认 90 秒），免得一直显示「对方正在输入」 */
async function post(url, body, headers, ms = 90e3) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac && setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body), signal: ac ? ac.signal : undefined }); }
  catch (e) { throw ac && ac.signal.aborted ? new Error(`等了 ${Math.round(ms / 1000)} 秒还没回复，可能网络慢或模型太忙，稍后再试`) : netError(e); }
  finally { if (timer) clearTimeout(timer); }
}
const isDeepSeek = c => /(^|\.)deepseek\.com/i.test((String(c.base).match(/^https?:\/\/([^/]+)/i) || [])[1] || '');
async function getJSON(url, headers) {
  let r;
  try { r = await fetch(url, { headers }); } catch (e) { throw netError(e); }
  if (!r.ok) throw await apiError(r);
  return r.json();
}
async function apiError(r) {
  let t = '';
  try { t = await r.text(); const j = JSON.parse(t); t = (j.error && (j.error.message || j.error)) || j.message || t; } catch (e) {}
  t = String(t).slice(0, 220);
  const hint = { 400: '请求格式或参数不被接受', 401: 'Key 不对，或者还没登录', 403: 'Key 没有权限，或所在地区不可用', 404: '接口地址或模型名不对', 429: '请求太频繁或额度用完' }[r.status] || '';
  return new Error(`接口返回 ${r.status}${hint ? '（' + hint + '）' : ''}：${t}`);
}

/* system：设定和规则；msgs：[{role:'user'|'assistant', text}]。返回模型原文。 */
async function callLLM(system, msgs) {
  const c = chatConf();
  const builtin = c.provider === 'builtin';
  if (builtin) {   // 知己内置 AI：拿登录凭证去调 Supabase 上的中转，中转再转给 DeepSeek
    if (!sb) throw new Error('内置 AI 连不上账号服务，检查网络，或者在「设置 → 回复方式」换成自己的 Key');
    c.key = await cloudToken();
    if (!c.key) throw new Error('先登录知己账户才能用内置 AI（设置 → 最上面的知己账户）');
  }
  if (!c.key) throw new Error('还没填 API Key，去「设置 → 回复方式」填一下，或者改用固定模板');
  if (!c.base) throw new Error('还没填接口地址');
  if (!c.model) throw new Error('还没填模型名');

  if (c.provider === 'gemini') {
    const contents = msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
    if (contents[0] && contents[0].role === 'model') contents.unshift({ role: 'user', parts: [{ text: '【系统提示】聊天开始。' }] });
    const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 1 } };
    if (c.json) body.generationConfig.responseMimeType = 'application/json';
    const url = `${c.base}/models/${c.model}:generateContent`;
    let r = await post(url, body, { 'x-goog-api-key': c.key });
    if (r.status === 400 && body.generationConfig.responseMimeType) { delete body.generationConfig.responseMimeType; r = await post(url, body, { 'x-goog-api-key': c.key }); }
    if (!r.ok) throw await apiError(r);
    const j = await r.json(); const cand = j.candidates && j.candidates[0];
    const text = ((cand && cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
    if (!text) throw new Error('模型没有返回内容' + (j.promptFeedback && j.promptFeedback.blockReason ? '（被拦截：' + j.promptFeedback.blockReason + '）' : cand && cand.finishReason ? '（' + cand.finishReason + '）' : ''));
    return text;
  }

  // OpenAI 及兼容接口
  const chat = msgs.map(m => ({ role: m.role, content: m.text }));
  if (chat[0] && chat[0].role === 'assistant') chat.unshift({ role: 'user', content: '【系统提示】聊天开始。' }); // 有的接口要求第一条是用户说的
  const body = { model: c.model, messages: [{ role: 'system', content: system }, ...chat] };
  if (c.json) body.response_format = { type: 'json_object' };
  if (c.provider === 'openai' && /^gpt-5/.test(c.model)) body.reasoning_effort = 'minimal'; // 聊天不需要长思考，回得更快
  if (isDeepSeek(c) || builtin) body.reasoning_effort = 'low';  // DeepSeek：低强度深度思考，想的时间藏在回复节奏的等待里（规范 Q8）
  const h = builtin ? { Authorization: 'Bearer ' + c.key, apikey: SUPABASE_KEY } : { Authorization: 'Bearer ' + c.key };
  const url = c.base + '/chat/completions';
  let r = await post(url, body, h);
  if (r.status === 400 && body.response_format) { delete body.response_format; r = await post(url, body, h); }   // 有的接口不认这些参数：一个个去掉再试
  if (r.status === 400 && body.reasoning_effort) { delete body.reasoning_effort; r = await post(url, body, h); }
  if (!r.ok) throw await apiError(r);
  const read = j => { const ch = j.choices && j.choices[0]; return { text: String((ch && ch.message && ch.message.content) || ''), why: ch && ch.finish_reason }; };
  let out = read(await r.json());
  if (!out.text.trim() && body.response_format) { // JSON 模式偶尔会返回一串空格：不要求 JSON 再要一次
    delete body.response_format;
    r = await post(url, body, h);
    if (!r.ok) throw await apiError(r);
    out = read(await r.json());
  }
  if (!out.text.trim()) throw new Error('模型返回了空白内容' + (out.why ? '（' + out.why + '）' : '') + '，再发一条试试');
  return out.text;
}

/* 生成一张照片，返回 data URL（或图片地址） */
async function generateImage(scene) {
  const c = imgConf();
  if (!c.key) throw new Error('生成照片需要 API Key');
  const ref = await IDB.get('ref').catch(() => null);
  const prompt = PROMPTS.image({ looks: S.her.looks, scene, hasRef: !!ref });

  if (c.provider === 'gemini') {
    const parts = [{ text: prompt }];
    if (ref) parts.push({ inline_data: { mime_type: (ref.match(/data:([^;]+)/) || [])[1] || 'image/jpeg', data: ref.split(',')[1] } });
    const body = { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } } };
    const url = `${c.base}/models/${c.model}:generateContent`;
    let r = await post(url, body, { 'x-goog-api-key': c.key });
    if (r.status === 400) { delete body.generationConfig.imageConfig; r = await post(url, body, { 'x-goog-api-key': c.key }); }
    if (!r.ok) throw await apiError(r);
    const j = await r.json(); const cand = j.candidates && j.candidates[0];
    const part = ((cand && cand.content && cand.content.parts) || []).find(p => p.inlineData || p.inline_data);
    const d = part && (part.inlineData || part.inline_data);
    if (!d) throw new Error('这次没生成出图片' + (cand && cand.finishReason ? '（' + cand.finishReason + '）' : ''));
    return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
  }

  let r;
  if (ref) { // 有参考图：用 edits，人物更一致
    const fd = new FormData();
    fd.append('model', c.model); fd.append('prompt', prompt); fd.append('size', '1024x1536');
    fd.append('image[]', dataURLtoBlob(ref), 'ref.jpg');
    try { r = await fetch(c.base + '/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + c.key }, body: fd }); }
    catch (e) { throw netError(e); }
  } else {
    r = await post(c.base + '/images/generations', { model: c.model, prompt, size: '1024x1536', n: 1 }, { Authorization: 'Bearer ' + c.key });
  }
  if (!r.ok) throw await apiError(r);
  const j = await r.json(); const d = j.data && j.data[0];
  if (d && d.b64_json) return 'data:image/png;base64,' + d.b64_json;
  if (d && d.url) return d.url;
  throw new Error('接口没有返回图片');
}

/* 列出这个 Key 能用的模型。kind：'chat' 或 'img' */
async function fetchModelIds(kind) {
  const c = kind === 'img' ? imgConf() : chatConf();
  if (!c.key) throw new Error('先填 API Key');
  if (!c.base) throw new Error('先填接口地址');
  let ids = [];
  if (c.provider === 'gemini') {
    const r = await getJSON(c.base + '/models?pageSize=1000', { 'x-goog-api-key': c.key });
    ids = (r.models || []).filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
  } else {
    const r = await getJSON(c.base + '/models', { Authorization: 'Bearer ' + c.key });
    ids = (r.data || []).map(m => m.id);
  }
  const f = kind === 'img'
    ? ids.filter(x => /image/i.test(x))
    : ids.filter(x => !/image|embed|tts|whisper|dall|audio|realtime|moderation|transcribe|veo|imagen|search|computer/i.test(x));
  return (f.length ? f : ids).sort();
}
