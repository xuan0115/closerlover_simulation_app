// 知己 · 锁屏通知（Supabase Edge Function，名字叫 push-tick）
//
// 网页关着时替「她」按时发消息，并推到手机锁屏上（Web Push）。
//   · 网页每次切走前，把「接下来 36 小时她什么时候找你」和设定、最近的聊天存进 push_plans 表。
//   · 定时任务（pg_cron，见 push-setup.sql）每分钟叫一次这里：到点的那条，用 DeepSeek 当场写好，
//     存进 push_inbox，再推到这个人开了通知的每台手机上。下次打开网页，这些消息会出现在聊天里。
//   · 网页开着的时候不发（网页自己会发），免得重复。
//   · 她连着主动找你 3 次你都没回，就不再追发（你让她提醒的闹钟除外）。
//
// 部署：Supabase 后台 → Edge Functions → 新建 push-tick → 粘贴这整个文件 → Deploy，
//      然后在这个函数的设置里把「Verify JWT」关掉（定时任务不带登录凭证，这里自己检查）。
// 用到的 Secret：MY_SECRET_API_KEY（和 ai-proxy 共用，不用再加）。
// 推送用的密钥第一次运行时自动生成，存在 push_config 表里（只有服务器能读）。

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const MODEL = 'deepseek-v4-pro';    // 和 ai-proxy 一样
const MAX_TOKENS = 4000;
const DAILY_LIMIT = 200;            // 和 ai-proxy 共用每天的次数
const MAX_PRO = 3;                  // 主动找你几次没回就不再追发
const STALE = 30 * 60e3;            // 过了 30 分钟还没发出去的就不发了（下次打开网页时网页自己补）
const SUBJECT = 'mailto:push@zhiji.app';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- 小工具 ---------- */
const enc = (s: string) => new TextEncoder().encode(s);
const b64u = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string) => {
  const t = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource));
}
function ago(ms: number) {
  ms = Math.max(0, ms);
  const m = Math.round(ms / 60000);
  if (m < 60) return m + ' 分钟';
  const h = ms / 3600000;
  if (h < 48) return (h < 10 ? h.toFixed(1) : String(Math.round(h))) + ' 小时';
  return Math.round(h / 24) + ' 天';
}

/* ---------- Web Push（RFC 8291 加密 + RFC 8292 VAPID） ---------- */
type Vapid = { pub: string; key: CryptoKey };
type Sub = { id?: number; endpoint: string; p256dh: string; auth: string };

export async function encryptPayload(sub: Sub, payload: Uint8Array) {
  const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aes, concat(payload, new Uint8Array([2])) as BufferSource));
  const head = new Uint8Array(16 + 4 + 1 + asPub.length);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  head.set(asPub, 21);
  return concat(head, ct);
}
export async function vapidHeader(endpoint: string, v: Vapid) {
  const aud = new URL(endpoint).origin;
  const h = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.key, enc(`${h}.${c}`) as BufferSource));
  return `vapid t=${h}.${c}.${b64u(sig)}, k=${v.pub}`;
}
/* 只往浏览器厂商的推送服务发（苹果、谷歌、火狐、微软），别的地址一律不发 */
export let PUSH_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)(:\d+)?\//i;
export function setPushHosts(re: RegExp) { PUSH_HOSTS = re; }
export async function sendPush(sub: Sub, data: unknown, v: Vapid): Promise<number> {
  if (!PUSH_HOSTS.test(sub.endpoint)) { console.error('不认识的推送地址，跳过', sub.endpoint.slice(0, 60)); return 410; }
  try {
    const body = await encryptPayload(sub, enc(JSON.stringify(data)));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
        Authorization: await vapidHeader(sub.endpoint, v),
      },
      body: body as BodyInit,
    });
    await r.body?.cancel();
    return r.status;
  } catch (e) {
    console.error('推送失败', String(e));
    return 0;
  }
}
/* 推送密钥：第一次用时生成，存进 push_config（只有服务器能读） */
export async function vapidKeys(db: Db): Promise<Vapid> {
  let cfg = await db.config();
  if (!cfg) throw new Error('push_config 表里没有设置，先运行 push-setup.sql');
  if (!cfg.vapid_private) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer));
    await db.saveVapid(pub, JSON.stringify(jwk));
    cfg = await db.config();
  }
  const jwk = JSON.parse(cfg!.vapid_private!);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { pub: cfg!.vapid_public!, key };
}

/* ---------- 让她说话 ---------- */
type Item = { key: string; kind: 'event' | 'reply'; at: number; now?: string; instruction?: string; count?: number; exempt?: boolean; tpl?: string[]; tplDone?: string[] };
type Plan = {
  v?: number; title?: string; ta?: string; mode?: 'ai' | 'tpl'; fallback?: boolean; base?: string;
  history?: { role: string; text: string }[]; items?: Item[]; pro?: number; lastFrom?: string; lastTs?: number;
  unread?: number; quiet?: boolean; off?: boolean; gifts?: string[]; carryOn?: string;
  badge?: boolean; hidden?: string;   // 设置 → 通知：图标上要不要红色数字；「显示预览：从不」时通知上只写这句
};
type Out = { messages: string[]; remember: string[]; done: string[]; gift: string | null };
type Ready = { key: string; kind: string; ts: number; data: Out | null };

export function parseReply(t: string, gifts: string[] = []): Out {
  const s = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // deno-lint-ignore no-explicit-any
  let o: any = null;
  try { o = JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (m) { try { o = JSON.parse(m[0]); } catch { /* 救不回来 */ } } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) o = { messages: s.split(/\n+/) };
  if (typeof o.messages === 'string') o.messages = o.messages.split(/\n+/);
  const isAction = (x: string) => /^[（(\*【\[].*[）)\*】\]]$/.test(x);
  const messages = (Array.isArray(o.messages) ? o.messages : [])
    .map((x: unknown) => String(x && typeof x === 'object' ? ((x as Record<string, unknown>).text || (x as Record<string, unknown>).content || '') : x).trim())
    .filter((x: string) => x && !isAction(x)).slice(0, 6);
  const gift = typeof o.gift === 'string' && gifts.includes(o.gift.trim()) ? o.gift.trim() : null;
  const arr = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).trim()).filter(Boolean);
  return { messages, remember: arr(o.remember), done: arr(o.done), gift };
}

export function buildMessages(plan: Plan, it: Item, prior: Ready[], note: string) {
  const out: { role: string; text: string }[] = [];
  const push = (role: string, text: string) => {
    if (!text) return;
    const l = out[out.length - 1];
    if (l && l.role === role) l.text += '\n' + text; else out.push({ role, text });
  };
  for (const h of plan.history || []) push(h.role === 'user' ? 'user' : 'assistant', String(h.text || ''));
  for (const r of prior) for (const m of (r.data && r.data.messages) || []) push('assistant', m);
  if (it.kind === 'event') push('user', (it.instruction || '') + note);
  if (!out.length || out[out.length - 1].role !== 'user') push('user', plan.carryOn || '【系统提示】继续聊。');
  const chat = out.map((m) => ({ role: m.role, content: m.text }));
  if (chat[0] && chat[0].role === 'assistant') chat.unshift({ role: 'user', content: '【系统提示】聊天开始。' });
  return [{ role: 'system', content: String(plan.base || '').replace('{{NOW}}', it.now || '') }, ...chat];
}

export let AI_URL = 'https://api.deepseek.com/chat/completions';
export function setAiUrl(u: string) { AI_URL = u; }
async function callAI(messages: unknown[]) {
  const body: Record<string, unknown> = { model: MODEL, messages, max_tokens: MAX_TOKENS, response_format: { type: 'json_object' }, reasoning_effort: 'low' };
  const go = async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 90e3);
    try {
      return await fetch(AI_URL, {
        method: 'POST', signal: ac.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('MY_SECRET_API_KEY') ?? ''}` },
        body: JSON.stringify(body),
      });
    } finally { clearTimeout(t); }
  };
  let r = await go();
  if (r.status === 400) { await r.body?.cancel(); delete body.response_format; r = await go(); }
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = String(j?.choices?.[0]?.message?.content || '');
  if (!text.trim()) throw new Error('DeepSeek 返回了空白内容');
  return text;
}

/* ---------- 数据库（换成测试用的假数据库也能跑） ---------- */
export type PlanRow = { user_id: string; plan: Plan; sent_pro: number | null; done: string[] | null; updated_at: string };
export type Db = {
  plans(now: number): Promise<PlanRow[]>;
  claim(uid: string, key: string, kind: string, ts: number): Promise<boolean>;
  unclaim(uid: string, key: string): Promise<void>;
  ready(uid: string): Promise<Ready[]>;
  finish(uid: string, key: string, ts: number, data: Out & { by: string }): Promise<void>;
  markPlan(uid: string, updatedAt: string, patch: Record<string, unknown>): Promise<void>;
  subs(uid: string): Promise<Sub[]>;
  dropSub(id: number): Promise<void>;
  bumpUsage(uid: string): Promise<boolean>;
  config(): Promise<{ cron_secret: string | null; vapid_public: string | null; vapid_private: string | null } | null>;
  saveVapid(pub: string, priv: string): Promise<void>;
  userId(token: string): Promise<string | null>;
  cleanup(now: number): Promise<void>;
};

function supabaseDb(): Db {
  const secret = (() => {
    try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default as string | undefined; } catch { return undefined; }
  })() ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const a = createClient(Deno.env.get('SUPABASE_URL') ?? '', secret, { auth: { persistSession: false } });
  const iso = (t: number) => new Date(t).toISOString();
  const must = <T>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    async plans(now) {
      return must(await a.from('push_plans').select('user_id, plan, sent_pro, done, updated_at')
        .or(`active_until.is.null,active_until.lt."${iso(now)}"`).gt('updated_at', iso(now - 3 * 864e5))) as PlanRow[];
    },
    async claim(uid, key, kind, ts) {
      const r = await a.from('push_inbox').insert({ user_id: uid, key, kind, ts, state: 'claim' });
      if (r.error) { if (r.error.code === '23505') return false; throw new Error(r.error.message); }
      return true;
    },
    async unclaim(uid, key) { must(await a.from('push_inbox').delete().eq('user_id', uid).eq('key', key).eq('state', 'claim')); },
    async ready(uid) { return must(await a.from('push_inbox').select('key, kind, ts, data').eq('user_id', uid).eq('state', 'ready').order('ts')) as Ready[]; },
    async finish(uid, key, ts, data) { must(await a.from('push_inbox').update({ state: 'ready', ts, data }).eq('user_id', uid).eq('key', key)); },
    async markPlan(uid, updatedAt, patch) { must(await a.from('push_plans').update(patch).eq('user_id', uid).eq('updated_at', updatedAt)); },
    async subs(uid) { return must(await a.from('push_subs').select('id, endpoint, p256dh, auth').eq('user_id', uid)) as Sub[]; },
    async dropSub(id) { must(await a.from('push_subs').delete().eq('id', id)); },
    async bumpUsage(uid) { return !!must(await a.rpc('bump_ai_usage', { p_user: uid, p_limit: DAILY_LIMIT })); },
    async config() { return must(await a.from('push_config').select('cron_secret, vapid_public, vapid_private').eq('id', 1).maybeSingle()); },
    async saveVapid(pub, priv) { must(await a.from('push_config').update({ vapid_public: pub, vapid_private: priv }).eq('id', 1).is('vapid_private', null)); },
    async userId(token) { const { data, error } = await a.auth.getUser(token); return error || !data?.user ? null : data.user.id; },
    async cleanup(now) { must(await a.from('push_inbox').delete().lt('created_at', iso(now - 7 * 864e5))); },
  };
}

/* ---------- 每分钟一次：到点的消息 ---------- */
export async function tickUser(db: Db, row: PlanRow, now: number, getVapid: () => Promise<Vapid>) {
  const plan = row.plan || {}, uid = row.user_id;
  if (!plan.v || plan.off) return;
  const done = new Set(row.done || []);
  const due = (plan.items || []).filter((it) => it && it.key && it.at <= now && now - it.at <= STALE && !done.has(it.key)).sort((x, y) => x.at - y.at);
  const it = due[0];
  if (!it) return;
  const mark = (patch: Record<string, unknown>) => db.markPlan(uid, row.updated_at, { done: [...done], ...patch });

  if (!(await db.claim(uid, it.key, it.kind, it.at))) { done.add(it.key); await mark({}); return; }   // 别的运行已经在发这条
  const sentPro = row.sent_pro || 0;
  if (it.kind === 'event' && !it.exempt && (plan.pro || 0) + sentPro >= MAX_PRO) {                  // 上三次你都没回：不再追发
    await db.unclaim(uid, it.key); done.add(it.key); await mark({}); return;
  }
  const prior = await db.ready(uid);   // 网页关着这段时间她已经发过的
  let lastFrom = plan.lastFrom, lastTs = plan.lastTs || 0;
  const lp = prior[prior.length - 1];
  if (lp && lp.ts >= lastTs) { lastFrom = 'her'; lastTs = lp.ts; }
  const note = it.kind === 'event' && lastFrom === 'her' && it.at - lastTs > 2 * 3600e3
    ? `（${plan.ta || 'TA'}还没回你上一条消息，已经过了 ${ago(it.at - lastTs)}。）` : '';

  let out: Out | null = null, by = 'tpl';
  if (plan.mode === 'ai' && (await db.bumpUsage(uid))) {
    try {
      const o = parseReply(await callAI(buildMessages(plan, it, prior, note)), plan.gifts || []);
      if (it.count && o.messages.length > it.count) o.messages = o.messages.slice(0, it.count);
      if (o.messages.length) { out = o; by = 'ai'; }
    } catch (e) { console.error('AI 出错', uid, String(e)); }
  }
  const canTpl = plan.mode !== 'ai' || plan.fallback !== false;
  if (!out && canTpl && Array.isArray(it.tpl) && it.tpl.length) {
    out = { messages: it.tpl.slice(0, 6).map(String), remember: [], done: Array.isArray(it.tplDone) ? it.tplDone.map(String) : [], gift: null };
  }
  if (!out) { await db.unclaim(uid, it.key); return; }   // 下一分钟再试（30 分钟内）

  const ts = Math.max(now, lastTs + 1000);
  await db.finish(uid, it.key, ts, { ...out, by });
  done.add(it.key);
  await mark({ sent_pro: sentPro + (it.kind === 'event' ? 1 : 0), last_sent_at: new Date(ts).toISOString() });

  if (plan.quiet) return;   // 免打扰、专注模式：消息照发，不弹通知
  const subs = await db.subs(uid);
  if (!subs.length) return;
  const v = await getVapid();
  let bubbles = [...out.messages];
  if (out.gift) bubbles.push(`[礼物] ${out.gift}`);
  if (plan.hidden) bubbles = [plan.hidden];   // 不显示内容：一轮只弹一条「发来一条消息」
  let unread = (plan.unread || 0) + prior.reduce((n, r) => n + ((r.data && r.data.messages) || []).length, 0);
  for (let i = 0; i < bubbles.length; i++) {
    if (i) await sleep(Math.min(4000, 1200 + bubbles[i].length * 120));   // 一条一条来，像在打字
    unread++;
    for (const s of subs) {
      const st = await sendPush(s, { title: plan.title || '知己', body: bubbles[i], tag: `${it.key}#${i}`, badge: plan.badge === false ? undefined : unread, ts: ts + i * 1000, url: './?open=chat' }, v);
      if ((st === 404 || st === 410) && s.id != null) await db.dropSub(s.id);   // 这台手机关掉了通知
    }
  }
}

export async function tickAll(db: Db, now = Date.now()) {
  let vapid: Promise<Vapid> | null = null;
  const getVapid = () => (vapid ??= vapidKeys(db));
  const rows = await db.plans(now);
  for (const row of rows) {
    try { await tickUser(db, row, now, getVapid); } catch (e) { console.error('处理出错', row.user_id, String(e)); }
  }
  if (new Date(now).getUTCMinutes() === 7) await db.cleanup(now).catch(() => {});   // 每小时清一次 7 天前的旧记录
}

export async function handle(req: Request, db: Db): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.has('pk')) {   // 网页开通知时要的公开钥匙
      try { return json(200, { publicKey: (await vapidKeys(db)).pub }); } catch (e) { return json(500, { error: { message: String((e as Error).message || e) } }); }
    }
    return json(404, { error: { message: '没有这个地址' } });
  }
  if (req.method !== 'POST') return json(405, { error: { message: '只支持 POST' } });

  const cron = req.headers.get('x-cron-secret');
  if (cron) {   // 定时任务
    const cfg = await db.config();
    if (!cfg || !cfg.cron_secret || cron !== cfg.cron_secret) return json(401, { error: { message: '定时任务的暗号不对' } });
    const job = tickAll(db).catch((e) => console.error('tick 出错', String(e)));
    // deno-lint-ignore no-explicit-any
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === 'function') er.waitUntil(job); else await job;
    return json(200, { ok: true });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: { message: '请先登录知己' } });
  const uid = await db.userId(token);
  if (!uid) return json(401, { error: { message: '登录过期了，请重新登录知己' } });
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { /* 空的 */ }
  if (body && body.test) {   // 「发一条测试通知」
    const subs = await db.subs(uid);
    if (!subs.length) return json(200, { sent: 0, failed: 0 });
    const v = await vapidKeys(db);
    let sent = 0, failed = 0;
    for (const s of subs) {
      const st = await sendPush(s, { title: '知己', body: '通知开好了。网页关着的时候，她的消息也会这样弹出来。', tag: 'test', badge: 0, url: './' }, v);
      if (st >= 200 && st < 300) sent++; else { failed++; if ((st === 404 || st === 410) && s.id != null) await db.dropSub(s.id); }
    }
    return json(200, { sent, failed });
  }
  return json(400, { error: { message: '不认识的请求' } });
}

if (!Deno.env.get('ZHIJI_TEST')) {
  const db = supabaseDb();
  Deno.serve((req: Request) => handle(req, db));
}
