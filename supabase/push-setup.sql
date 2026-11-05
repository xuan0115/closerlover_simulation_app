-- 知己 · 锁屏通知（网页推送）的设置
-- 在 Supabase 后台 → SQL Editor 里，整段粘贴运行一次。可以重复运行，不会出错。
-- 要先运行过 setup.sql（用到里面的 bump_ai_usage）。
--
-- 建 4 张表：
--   push_subs    每台开了通知的手机（推送地址），本人能读写自己的
--   push_plans   网页切走前存的「接下来她什么时候找你」，本人能读写自己的
--   push_inbox   网页关着时她发出的消息，等网页打开取走；本人只能读和删
--   push_config  推送密钥和定时任务的暗号，网页读不到，只有服务器能读
-- 再加一个每分钟运行的定时任务，去叫 push-tick 函数。

-- 0) 需要的两个扩展：定时任务、从数据库里发网络请求
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1) 开了通知的手机
create table if not exists public.push_subs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);

-- 2) 她接下来什么时候找你（每个账号一行）
create table if not exists public.push_plans (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  plan         jsonb not null,
  updated_at   timestamptz not null default now(),
  active_until timestamptz,                    -- 网页开着时一直往后推；过了这个时间才由服务器来发
  sent_pro     int not null default 0,         -- 网页关着这段时间，她主动找了你几次
  last_sent_at timestamptz,
  done         jsonb not null default '[]'::jsonb   -- 服务器已经处理过的（发了，或者因为你没回而不发）
);

-- 3) 网页关着时她发出的消息
create table if not exists public.push_inbox (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null,
  kind       text not null default 'event',
  ts         bigint not null,                  -- 毫秒时间戳
  state      text not null default 'claim',    -- claim = 正在写；ready = 写好了
  data       jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

-- 推送地址必须是 https；一份计划不能太大（正常只有几十 KB）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subs_https') then
    alter table public.push_subs add constraint push_subs_https check (endpoint like 'https://%' and length(endpoint) < 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'push_plans_size') then
    alter table public.push_plans add constraint push_plans_size check (pg_column_size(plan) < 600000);
  end if;
end $$;

-- 4) 服务器自己用的设置（一行）
create table if not exists public.push_config (
  id            int primary key default 1 check (id = 1),
  cron_secret   text not null,
  vapid_public  text,
  vapid_private text,
  created_at    timestamptz not null default now()
);
insert into public.push_config (id, cron_secret)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- 5) 行级安全：先删掉这几张表上已有的规则，再重新建
alter table public.push_subs   enable row level security;
alter table public.push_plans  enable row level security;
alter table public.push_inbox  enable row level security;
alter table public.push_config enable row level security;   -- 不建任何规则 = 网页读写不了
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('push_subs', 'push_plans', 'push_inbox', 'push_config') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "zhiji own select" on public.push_subs for select to authenticated using ((select auth.uid()) = user_id);
create policy "zhiji own insert" on public.push_subs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "zhiji own update" on public.push_subs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "zhiji own delete" on public.push_subs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "zhiji own select" on public.push_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "zhiji own insert" on public.push_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "zhiji own update" on public.push_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "zhiji own delete" on public.push_plans for delete to authenticated using ((select auth.uid()) = user_id);

create policy "zhiji own select" on public.push_inbox for select to authenticated using ((select auth.uid()) = user_id);
create policy "zhiji own delete" on public.push_inbox for delete to authenticated using ((select auth.uid()) = user_id);

-- 6) 每分钟叫一次 push-tick（同名的任务会被覆盖，不会重复）
select cron.schedule('zhiji-push-tick', '* * * * *', $job$
  select net.http_post(
    url := 'https://pqrrculvjdirycyafqht.supabase.co/functions/v1/push-tick',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select cron_secret from public.push_config where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
-- 定时任务的运行记录每天清一次，只留 3 天
select cron.schedule('zhiji-cron-cleanup', '17 4 * * *', $job$
  delete from cron.job_run_details where end_time < now() - interval '3 days';
$job$);

-- 7) 检查：应该看到 4 张表都是 rls_on = true，以及两个定时任务
select relname as table_name, relrowsecurity as rls_on from pg_class
where oid in ('public.push_subs'::regclass, 'public.push_plans'::regclass, 'public.push_inbox'::regclass, 'public.push_config'::regclass);
select jobname, schedule, active from cron.job where jobname like 'zhiji-%';
