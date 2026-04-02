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
  start_balance numeric not null default 47,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_user_id_name_idx
on public.accounts (user_id, lower(name));

create index if not exists accounts_user_id_sort_order_idx
on public.accounts (user_id, sort_order, created_at);

create or replace function public.ensure_default_accounts(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.accounts a
    where a.user_id = target_user_id
  ) then
    return;
  end if;

  insert into public.accounts (user_id, name, type, sort_order, start_balance)
  values
    (target_user_id, 'Main Account', 'main', 0, 47),
    (target_user_id, 'Wallet 1', 'wallet', 1, 47),
    (target_user_id, 'Wallet 2', 'wallet', 2, 47),
    (target_user_id, 'Wallet 3', 'wallet', 3, 47),
    (target_user_id, 'Wallet 4', 'wallet', 4, 47),
    (target_user_id, 'Wallet 5', 'wallet', 5, 47),
    (target_user_id, 'Wallet 6', 'wallet', 6, 47),
    (target_user_id, 'Wallet 7', 'wallet', 7, 47),
    (target_user_id, 'Wallet 8', 'wallet', 8, 47),
    (target_user_id, 'Wallet 9', 'wallet', 9, 47),
    (target_user_id, 'Wallet 10', 'wallet', 10, 47);
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
    set start_balance = p.start_balance
    from public.profiles p
    where a.user_id = p.user_id
      and a.type = 'main';
  end if;
end;
$$;

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

alter table public.trades
add column if not exists account_id uuid;

create table if not exists public.balance_transactions (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.balance_transactions
add column if not exists account_id uuid;

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trades_account_id_fkey'
  ) then
    alter table public.trades
    add constraint trades_account_id_fkey
    foreign key (account_id) references public.accounts(id) on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'balance_transactions_account_id_fkey'
  ) then
    alter table public.balance_transactions
    add constraint balance_transactions_account_id_fkey
    foreign key (account_id) references public.accounts(id) on delete cascade;
  end if;
end;
$$;

alter table public.trades
alter column account_id set not null;

alter table public.balance_transactions
alter column account_id set not null;

create index if not exists trades_user_id_account_id_created_at_idx
on public.trades (user_id, account_id, created_at desc);

create index if not exists balance_transactions_user_id_account_id_created_at_idx
on public.balance_transactions (user_id, account_id, created_at desc);

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

drop function if exists public.get_worker_summaries();

create or replace function public.get_account_summaries()
returns table (
  user_id uuid,
  account_id uuid,
  account_name text,
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
        partition by t.user_id, t.account_id
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
        partition by rt.user_id, rt.account_id
        order by rt.created_at desc, rt.id desc
        rows between unbounded preceding and current row
      ) as mismatch_group
    from ranked_trades rt
  ),
  streaks as (
    select
      user_id,
      account_id,
      count(*)::integer as streak_count,
      max(latest_result)::text as streak_label
    from streak_groups
    where mismatch_group = 0
    group by user_id, account_id
  ),
  summary as (
    select
      a.user_id,
      a.id as account_id,
      a.name as account_name,
      a.start_balance,
      u.email::text as email,
      coalesce(sum(t.pnl), 0) as total_pnl,
      count(t.id) as trades_count,
      coalesce(sum(case when t.result = 'win' then 1 else 0 end), 0) as wins
    from public.accounts a
    join auth.users u on u.id = a.user_id
    left join public.trades t on t.account_id = a.id
    group by a.user_id, a.id, a.name, a.start_balance, u.email
  )
  select
    s.user_id,
    s.account_id,
    s.account_name,
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
  left join streaks st on st.user_id = s.user_id and st.account_id = s.account_id
  where exists (select 1 from admin_check)
  order by s.email, s.account_name;
$$;

revoke all on function public.get_account_summaries() from public;
grant execute on function public.get_account_summaries() to authenticated;

drop function if exists public.get_team_daily_pnl(date, date);

create or replace function public.get_team_daily_pnl(date_from date, date_to date)
returns table (
  trade_date date,
  user_id uuid,
  account_name text,
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
    a.name as account_name,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    u.email::text as email,
    sum(t.pnl) as daily_pnl
  from public.trades t
  join public.accounts a on a.id = t.account_id
  join auth.users u on u.id = t.user_id
  left join public.profiles p on p.user_id = t.user_id
  where exists (select 1 from admin_check)
    and (t.created_at at time zone 'UTC')::date between date_from and date_to
  group by (t.created_at at time zone 'UTC')::date, t.user_id, a.name, p.display_name, u.email
  order by trade_date, email, account_name;
$$;

revoke all on function public.get_team_daily_pnl(date, date) from public;
grant execute on function public.get_team_daily_pnl(date, date) to authenticated;
