// 知己 · 内置 AI 中转（Supabase Edge Function，名字叫 ai-proxy）
//
// 只给登录了知己账号的人用；每人每天有上限；把聊天请求转给 DeepSeek。
// DeepSeek 的 Key 放在 Supabase 的 Secrets 里（名字 MY_SECRET_API_KEY），不写在代码里。
// 用量记在 ai_usage 表里（先运行 supabase/setup.sql）。

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const DAILY_LIMIT = 200;              // 每人每天最多调用几次，按需要改
const MODEL = 'deepseek-v4-pro';      // 统一用的模型
const MAX_TOKENS = 4000;              // 每次回复最多多少 token（含思考）
const MAX_BODY = 200_000;             // 请求最大多少字节，防止有人塞超长内容

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// 管理员钥匙：新版是 SUPABASE_SECRET_KEYS（JSON），老项目用 SUPABASE_SERVICE_ROLE_KEY
const secretKey = (() => {
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default as string | undefined; } catch { return undefined; }
})() ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', secretKey, { auth: { persistSession: false } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, '只支持 POST');

  // 1. 必须是登录的用户：网页把登录凭证放在 Authorization 里
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, '请先登录知己');
  const { data: who, error: authError } = await admin.auth.getUser(token);
  if (authError || !who?.user) return reply(401, '登录过期了，请重新登录知己');

  // 2. 每人每天限量
  const { data: allowed, error: usageError } = await admin.rpc('bump_ai_usage', { p_user: who.user.id, p_limit: DAILY_LIMIT });
  if (usageError) return reply(500, '记录用量出错：' + usageError.message);
  if (!allowed) return reply(429, `今天的 AI 次数用完了（每天 ${DAILY_LIMIT} 次），明天再来`);

  // 3. 只转发需要的字段，模型和长度由这里决定
  const text = await req.text();
  if (text.length > MAX_BODY) return reply(413, '聊天记录太长了');
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(text); } catch { return reply(400, '请求格式不对'); }
  if (!Array.isArray(raw.messages)) return reply(400, '缺少 messages');
  const body: Record<string, unknown> = { model: MODEL, messages: raw.messages, max_tokens: MAX_TOKENS };
  if (raw.response_format) body.response_format = raw.response_format;
  if (raw.reasoning_effort) body.reasoning_effort = raw.reasoning_effort;

  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('MY_SECRET_API_KEY') ?? ''}` },
    body: JSON.stringify(body),
  });
  return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
});
