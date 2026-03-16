# Polymarket Tracker

Многопользовательское приложение для ведения журнала сделок в Polymarket. Каждый воркер входит под своим аккаунтом и видит только свой дашборд.

## Стек

- React 19
- Vite 7
- Tailwind CSS 4
- shadcn/ui primitives
- Recharts
- React Router
- Supabase Auth + Postgres

## Что умеет

- считать `shares`, `total exit value` и `PnL` по Polymarket-логике;
- авторизовывать воркеров по email/password;
- хранить стартовый баланс и историю сделок по `user_id`;
- показывать баланс, общий результат, streak и win rate;
- строить equity curve по истории сделок;
- подсвечивать простые эвристики по `ATR`, `Time` и `Entry`.

## Структура

- [`src/App.jsx`](./src/App.jsx) собирает экран и связывает состояние.
- [`src/providers/auth-provider.jsx`](./src/providers/auth-provider.jsx) управляет сессией.
- [`src/pages/login-page.jsx`](./src/pages/login-page.jsx) содержит вход и создание воркер-аккаунтов.
- [`src/pages/dashboard-page.jsx`](./src/pages/dashboard-page.jsx) содержит дашборд воркера.
- [`src/pages/admin-page.jsx`](./src/pages/admin-page.jsx) содержит сводку по всем воркерам для главного аккаунта.
- [`src/lib/trade-utils.js`](./src/lib/trade-utils.js) содержит бизнес-логику и вычисления.
- [`src/lib/trade-service.js`](./src/lib/trade-service.js) работает с данными в Supabase.
- [`src/lib/admin.js`](./src/lib/admin.js) определяет, какой email считается админом.
- [`src/lib/supabase.js`](./src/lib/supabase.js) создает клиент Supabase.
- [`src/components/tracker`](./src/components/tracker) содержит основные части интерфейса трекера.
- [`src/components/ui`](./src/components/ui) содержит базовые UI-примитивы.

## Настройка Supabase

1. Создай проект в Supabase.
2. Включи `Email` provider в `Authentication`.
3. Создай файл `.env.local`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_EMAIL=your-admin-email@example.com
```

4. Выполни SQL в Supabase SQL Editor:

```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_balance numeric not null default 47,
  display_name text
);

alter table public.profiles
add column if not exists display_name text;

create table if not exists public.trades (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  size numeric not null,
  entry numeric not null,
  exit numeric not null,
  raw_entry text,
  raw_exit text,
  shares numeric not null,
  total_exit_value numeric not null,
  pnl numeric not null,
  time text,
  atr text,
  rsi text,
  macd text,
  vwap text,
  note text,
  result text not null,
  created_at timestamptz not null default now()
);

alter table public.trades
add column if not exists note text;

create table if not exists public.balance_transactions (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.balance_transactions enable row level security;

alter table public.profiles enable row level security;
alter table public.trades enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "profiles_upsert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "trades_select_own"
on public.trades
for select
to authenticated
using (auth.uid() = user_id);

create policy "trades_insert_own"
on public.trades
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "trades_delete_own"
on public.trades
for delete
to authenticated
using (auth.uid() = user_id);

create policy "balance_transactions_select_own"
on public.balance_transactions
for select
to authenticated
using (auth.uid() = user_id);

create policy "balance_transactions_insert_own"
on public.balance_transactions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "balance_transactions_update_own"
on public.balance_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "balance_transactions_delete_own"
on public.balance_transactions
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.get_worker_summaries()
returns table (
  user_id uuid,
  display_name text,
  email text,
  start_balance numeric,
  total_pnl numeric,
  streak_count integer,
  streak_label text,
  win_rate numeric,
  trades_count bigint
)
language sql
security definer
set search_path = public, auth
as $$
  with admin_check as (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = lower('YOUR_ADMIN_EMAIL')
  ),
  ranked_trades as (
    select
      t.*,
      first_value(t.result) over (
        partition by t.user_id
        order by t.created_at desc, t.id desc
      ) as latest_result
    from public.trades t
  ),
  streak_groups as (
    select
      rt.*,
      sum(
        case
          when rt.result = rt.latest_result then 0
          else 1
        end
      ) over (
        partition by rt.user_id
        order by rt.created_at desc, rt.id desc
        rows between unbounded preceding and current row
      ) as mismatch_group
    from ranked_trades rt
  ),
  streaks as (
    select
      user_id,
      count(*)::integer as streak_count,
      max(latest_result)::text as streak_label
    from streak_groups
    where mismatch_group = 0
    group by user_id
  ),
  summary as (
    select
      u.id as user_id,
      u.email::text as email,
      coalesce(p.start_balance, 47) as start_balance,
      coalesce(sum(t.pnl), 0) as total_pnl,
      count(t.id) as trades_count,
      coalesce(sum(case when t.result = 'win' then 1 else 0 end), 0) as wins
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.trades t on t.user_id = u.id
    group by u.id, u.email, p.start_balance
  )
  select
    s.user_id,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    s.email,
    s.start_balance,
    s.total_pnl,
    coalesce(st.streak_count, 0) as streak_count,
    case
      when coalesce(st.streak_label, '-') = 'win' then 'W'
      when coalesce(st.streak_label, '-') = 'loss' then 'L'
      else '-'
    end as streak_label,
    case
      when s.trades_count = 0 then 0
      else (s.wins::numeric / s.trades_count::numeric) * 100
    end as win_rate,
    s.trades_count
  from summary s
  left join public.profiles p on p.user_id = s.user_id
  left join streaks st on st.user_id = s.user_id
  where exists (select 1 from admin_check)
  order by s.email;
$$;

revoke all on function public.get_worker_summaries() from public;
grant execute on function public.get_worker_summaries() to authenticated;

drop function if exists public.get_team_daily_pnl(date, date);

create or replace function public.get_team_daily_pnl(date_from date, date_to date)
returns table (
  trade_date date,
  user_id uuid,
  display_name text,
  email text,
  daily_pnl numeric
)
language sql
security definer
set search_path = public, auth
as $$
  with admin_check as (
    select 1
    from auth.users
    where id = auth.uid()
      and lower(email) = lower('YOUR_ADMIN_EMAIL')
  )
  select
    (t.created_at at time zone 'UTC')::date as trade_date,
    t.user_id,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    u.email::text as email,
    sum(t.pnl) as daily_pnl
  from public.trades t
  join auth.users u on u.id = t.user_id
  left join public.profiles p on p.user_id = t.user_id
  where exists (select 1 from admin_check)
    and (t.created_at at time zone 'UTC')::date between date_from and date_to
  group by (t.created_at at time zone 'UTC')::date, t.user_id, p.display_name, u.email
  order by trade_date, email;
$$;

revoke all on function public.get_team_daily_pnl(date, date) from public;
grant execute on function public.get_team_daily_pnl(date, date) to authenticated;
```

5. Для админ-страницы:

- в `.env.local` и в Vercel добавь `VITE_ADMIN_EMAIL` с твоим email;
- в SQL выше замени `YOUR_ADMIN_EMAIL` на тот же email;
- после изменения env на Vercel нажми `Redeploy`.
- воркер может сам заполнить `Worker name` на своем дашборде, и в админке будет показываться оно вместо email.

## Запуск

```bash
npm install
npm run dev
```

## Проверка

```bash
npm run lint
npm run build
```

## Дальше по развитию

- добавить экспорт/импорт истории сделок;
- перейти на TypeScript и схему валидации формы;
- покрыть вычисления тестами;
- добавить страницу администратора для создания/блокировки воркеров;
- вынести пользовательские эвристики в настраиваемый конфиг;
- добавить фильтрацию и аналитику по сетапам.
