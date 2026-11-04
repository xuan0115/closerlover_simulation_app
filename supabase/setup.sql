-- 知己 · Supabase 设置（在 Supabase 后台 → SQL Editor 里，整段粘贴运行一次）
-- 可以重复运行，不会出错。只动 user_backups 和 ai_usage 两张表。

-- 1) 存档表：每个账号一行（user_id 唯一）
create table if not exists public.user_backups (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 以前的版本建的表可能缺列：补上（已经有就跳过）
alter table public.user_backups add column if not exists data jsonb;
alter table public.user_backups add column if not exists updated_at timestamptz default now();

-- 万一以前存出了同一个账号的多行：只留最新的一行，再加上「user_id 唯一」
delete from public.user_backups t
  using (select ctid, row_number() over (partition by user_id order by updated_at desc nulls last) as rn
         from public.user_backups) d
  where t.ctid = d.ctid and d.rn > 1;
create unique index if not exists user_backups_user_id_key on public.user_backups (user_id);

-- 2) 行级安全（RLS）：先删掉这张表上已有的所有规则，再只允许「本人读写本人那一行」
alter table public.user_backups enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_backups' loop
    execute format('drop policy %I on public.user_backups', p.policyname);
  end loop;
end $$;
create policy "zhiji own select" on public.user_backups for select to authenticated using ((select auth.uid())::text = user_id::text);
create policy "zhiji own insert" on public.user_backups for insert to authenticated with check ((select auth.uid())::text = user_id::text);
create policy "zhiji own update" on public.user_backups for update to authenticated using ((select auth.uid())::text = user_id::text) with check ((select auth.uid())::text = user_id::text);
create policy "zhiji own delete" on public.user_backups for delete to authenticated using ((select auth.uid())::text = user_id::text);

-- 3) 内置 AI 的用量：每人每天调用了几次（网页读不到，只有 ai-proxy 中转能写）
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;   -- 不建任何规则 = 网页一律读写不了

create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'Asia/Shanghai')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n <= p_limit;
end $$;
revoke execute on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;

-- 4) 检查：下面应该显示 rls_on = true，以及 4 条 zhiji own … 规则
select relrowsecurity as rls_on from pg_class where oid = 'public.user_backups'::regclass;
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'user_backups';
