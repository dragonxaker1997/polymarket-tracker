create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text
);

alter table public.profiles
add column if not exists display_name text;

insert into public.profiles (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('main', 'wallet', 'custom')),
  sort_order integer not null default 0,
  start_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_user_id_name_idx
on public.accounts (user_id, lower(name));

create index if not exists accounts_user_id_sort_order_idx
on public.accounts (user_id, sort_order, created_at);

create table if not exists public.trades (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
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
  note text,
  result text not null,
  created_at timestamptz not null default now()
);

alter table public.trades
add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.trades
add column if not exists note text;

alter table public.trades
drop column if exists vwap;

create table if not exists public.balance_transactions (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  transaction_type text not null default 'withdrawal',
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.balance_transactions
add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.balance_transactions
add column if not exists transaction_type text not null default 'withdrawal';

update public.balance_transactions
set transaction_type = 'withdrawal'
where transaction_type is null;

create or replace function public.ensure_default_accounts(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, sort_order, start_balance)
  values
    (target_user_id, 'Main Account', 'main', 0, 47),
    (target_user_id, 'Wallet 1', 'wallet', 1, 0),
    (target_user_id, 'Wallet 2', 'wallet', 2, 0),
    (target_user_id, 'Wallet 3', 'wallet', 3, 0),
    (target_user_id, 'Wallet 4', 'wallet', 4, 0),
    (target_user_id, 'Wallet 5', 'wallet', 5, 0),
    (target_user_id, 'Wallet 6', 'wallet', 6, 0),
    (target_user_id, 'Wallet 7', 'wallet', 7, 0),
    (target_user_id, 'Wallet 8', 'wallet', 8, 0),
    (target_user_id, 'Wallet 9', 'wallet', 9, 0),
    (target_user_id, 'Wallet 10', 'wallet', 10, 0)
  on conflict (user_id, lower(name)) do nothing;

  update public.accounts
  set type = 'main', sort_order = 0, start_balance = 47
  where user_id = target_user_id
    and lower(name) = lower('Main Account');

  update public.accounts
  set start_balance = 0
  where user_id = target_user_id
    and type <> 'main';
end;
$$;

create or replace function public.handle_new_user_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform public.ensure_default_accounts(new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_setup on auth.users;

create trigger on_auth_user_created_setup
after insert on auth.users
for each row
execute function public.handle_new_user_setup();

select public.ensure_default_accounts(u.id)
from auth.users u;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'start_balance'
  ) then
    update public.accounts a
    set start_balance = case when a.type = 'main' then coalesce(p.start_balance, 47) else 0 end
    from public.profiles p
    where a.user_id = p.user_id;
  end if;
end;
$$;

update public.accounts
set start_balance = 0
where type <> 'main';

update public.trades t
set account_id = a.id
from public.accounts a
where t.account_id is null
  and a.user_id = t.user_id
  and a.type = 'main';

update public.balance_transactions bt
set account_id = a.id
from public.accounts a
where bt.account_id is null
  and a.user_id = bt.user_id
  and a.type = 'main';

alter table public.trades
alter column account_id set not null;

alter table public.balance_transactions
alter column account_id set not null;

create index if not exists trades_user_id_account_id_created_at_idx
on public.trades (user_id, account_id, created_at desc);

create index if not exists balance_transactions_user_id_account_id_created_at_idx
on public.balance_transactions (user_id, account_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'start_balance'
  ) then
    alter table public.profiles
    drop column start_balance;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.balance_transactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own"
on public.accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own"
on public.accounts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
on public.accounts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own"
on public.accounts
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own"
on public.trades
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own"
on public.trades
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own"
on public.trades
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own"
on public.trades
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "balance_transactions_select_own" on public.balance_transactions;
create policy "balance_transactions_select_own"
on public.balance_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "balance_transactions_insert_own" on public.balance_transactions;
create policy "balance_transactions_insert_own"
on public.balance_transactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "balance_transactions_update_own" on public.balance_transactions;
create policy "balance_transactions_update_own"
on public.balance_transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.accounts a
    where a.id = account_id
      and a.user_id = auth.uid()
  )
);

drop policy if exists "balance_transactions_delete_own" on public.balance_transactions;
create policy "balance_transactions_delete_own"
on public.balance_transactions
for delete
to authenticated
using (auth.uid() = user_id);

drop function if exists public.get_worker_summaries();
drop function if exists public.get_account_summaries();

create or replace function public.get_account_summaries()
returns table (
  user_id uuid,
  account_id uuid,
  account_name text,
  account_type text,
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
  account_trade_summary as (
    select
      a.user_id,
      a.id as account_id,
      a.name as account_name,
      a.start_balance,
      u.email::text as email,
      coalesce(trades.total_pnl, 0) + coalesce(adjustments.total_adjustment_pnl, 0) as total_pnl,
      coalesce(trades.trades_count, 0) as trades_count,
      coalesce(trades.wins, 0) as wins
    from public.accounts a
    join auth.users u on u.id = a.user_id
    left join (
      select
        t.account_id,
        coalesce(sum(t.pnl), 0) as total_pnl,
        count(t.id) as trades_count,
        coalesce(sum(case when t.result = 'win' then 1 else 0 end), 0) as wins
      from public.trades t
      group by t.account_id
    ) trades on trades.account_id = a.id
    left join (
      select
        bt.account_id,
        coalesce(sum(bt.amount), 0) as total_adjustment_pnl
      from public.balance_transactions bt
      where bt.transaction_type = 'adjustment'
      group by bt.account_id
    ) adjustments on adjustments.account_id = a.id
  ),
  latest_trade_result as (
    select distinct on (t.user_id, t.account_id)
      t.user_id,
      t.account_id,
      t.result
    from public.trades t
    order by t.user_id, t.account_id, t.created_at desc, t.id desc
  ),
  streaks as (
    select
      x.user_id,
      x.account_id,
      count(*)::integer as streak_count
    from public.trades x
    join latest_trade_result ltr
      on ltr.user_id = x.user_id
     and ltr.account_id = x.account_id
     and ltr.result = x.result
    where not exists (
      select 1
      from public.trades newer
      where newer.user_id = x.user_id
        and newer.account_id = x.account_id
        and (
          newer.created_at > x.created_at
          or (newer.created_at = x.created_at and newer.id > x.id)
        )
        and newer.result <> ltr.result
    )
    group by x.user_id, x.account_id
  )
  select
    ats.user_id,
    ats.account_id,
    ats.account_name,
    a.type as account_type,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    ats.email,
    ats.start_balance,
    ats.total_pnl,
    coalesce(s.streak_count, 0) as streak_count,
    case
      when ltr.result = 'win' then 'W'
      when ltr.result = 'loss' then 'L'
      else '-'
    end as streak_label,
    case
      when ats.trades_count = 0 then 0
      else (ats.wins::numeric / ats.trades_count::numeric) * 100
    end as win_rate,
    ats.trades_count
  from account_trade_summary ats
  join public.accounts a on a.id = ats.account_id
  left join public.profiles p on p.user_id = ats.user_id
  left join latest_trade_result ltr
    on ltr.user_id = ats.user_id
   and ltr.account_id = ats.account_id
  left join streaks s
    on s.user_id = ats.user_id
   and s.account_id = ats.account_id
  where exists (select 1 from admin_check)
  order by ats.email, ats.account_name, ats.account_id;
$$;

revoke all on function public.get_account_summaries() from public;
grant execute on function public.get_account_summaries() to authenticated;

drop function if exists public.get_team_daily_pnl(date, date);

create or replace function public.get_team_daily_pnl(date_from date, date_to date)
returns table (
  trade_date date,
  user_id uuid,
  account_id uuid,
  account_name text,
  account_type text,
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
    (entry.created_at at time zone 'UTC')::date as trade_date,
    entry.user_id,
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    u.email::text as email,
    sum(entry.daily_pnl) as daily_pnl
  from (
    select
      t.created_at,
      t.user_id,
      t.account_id,
      t.pnl as daily_pnl
    from public.trades t
    union all
    select
      bt.created_at,
      bt.user_id,
      bt.account_id,
      bt.amount as daily_pnl
    from public.balance_transactions bt
    where bt.transaction_type = 'adjustment'
  ) entry
  join public.accounts a on a.id = entry.account_id
  join auth.users u on u.id = entry.user_id
  left join public.profiles p on p.user_id = entry.user_id
  where exists (select 1 from admin_check)
    and (entry.created_at at time zone 'UTC')::date between date_from and date_to
  group by (entry.created_at at time zone 'UTC')::date, entry.user_id, a.id, a.name, p.display_name, u.email
  order by trade_date, email, account_name, account_id;
$$;

revoke all on function public.get_team_daily_pnl(date, date) from public;
grant execute on function public.get_team_daily_pnl(date, date) to authenticated;
