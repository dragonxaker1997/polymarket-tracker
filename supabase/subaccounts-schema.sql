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

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text,
  type text not null default 'personal' check (type in ('personal', 'team')),
  plan text not null default 'base' check (plan in ('base', 'pro', 'team', 'enterprise')),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspaces_personal_owner_idx
on public.workspaces (owner_user_id)
where type = 'personal';

create unique index if not exists workspaces_slug_idx
on public.workspaces (lower(slug))
where slug is not null;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
on public.workspace_members (user_id, created_at desc);

create index if not exists workspace_members_workspace_role_idx
on public.workspace_members (workspace_id, role, status);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists workspace_invitations_email_idx
on public.workspace_invitations (lower(email));

create unique index if not exists workspace_invitations_token_idx
on public.workspace_invitations (token);

create index if not exists workspace_invitations_workspace_idx
on public.workspace_invitations (workspace_id, status, created_at desc);

create unique index if not exists workspace_invitations_pending_email_idx
on public.workspace_invitations (workspace_id, lower(email))
where status = 'pending';

create table if not exists public.workspace_rules (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, flag_key)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row
execute function public.set_updated_at();


drop trigger if exists workspace_rules_set_updated_at on public.workspace_rules;
create trigger workspace_rules_set_updated_at
before update on public.workspace_rules
for each row
execute function public.set_updated_at();

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row
execute function public.set_updated_at();

drop function if exists public.get_plan_capabilities(text);
create or replace function public.get_plan_capabilities(target_plan text)
returns table (
  max_members integer,
  max_wallets_per_user integer,
  max_trades_per_user integer,
  can_create_wallets boolean,
  team_mode boolean
)
language sql
immutable
as $$
  select
    case target_plan
      when 'base' then 1
      when 'pro' then 1
      when 'team' then 5
      when 'enterprise' then 20
      else 1
    end as max_members,
    case target_plan
      when 'base' then 1
      when 'pro' then 10
      when 'team' then 30
      when 'enterprise' then 100
      else 1
    end as max_wallets_per_user,
    case target_plan
      when 'base' then 3
      else null
    end as max_trades_per_user,
    case target_plan
      when 'base' then false
      else true
    end as can_create_wallets,
    case target_plan
      when 'team' then true
      when 'enterprise' then true
      else false
    end as team_mode;
$$;

create or replace function public.ensure_personal_workspace(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_workspace_id uuid;
  next_workspace_id uuid;
  next_name text;
begin
  select w.id
  into existing_workspace_id
  from public.workspaces w
  where w.owner_user_id = target_user_id
    and w.type = 'personal'
  limit 1;

  if existing_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (existing_workspace_id, target_user_id, 'owner', 'active')
    on conflict (workspace_id, user_id) do update
      set role = 'owner',
          status = 'active',
          updated_at = now();

    insert into public.workspace_rules (workspace_id)
    values (existing_workspace_id)
    on conflict (workspace_id) do nothing;

    return existing_workspace_id;
  end if;

  select
    coalesce(
      nullif(trim(p.display_name), ''),
      split_part(coalesce(u.email::text, ''), '@', 1),
      'Personal'
    ) || ' Workspace'
  into next_name
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = target_user_id;

  insert into public.workspaces (name, type, plan, owner_user_id)
  values (coalesce(next_name, 'Personal Workspace'), 'personal', 'base', target_user_id)
  returning id into next_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (next_workspace_id, target_user_id, 'owner', 'active')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.workspace_rules (workspace_id)
  values (next_workspace_id)
  on conflict (workspace_id) do nothing;

  return next_workspace_id;
end;
$$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('main', 'wallet', 'custom')),
  sort_order integer not null default 0,
  start_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.accounts
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

create unique index if not exists accounts_workspace_user_name_idx
on public.accounts (workspace_id, user_id, lower(name));

create index if not exists accounts_workspace_user_sort_idx
on public.accounts (workspace_id, user_id, sort_order, created_at);

drop index if exists accounts_user_id_name_idx;
drop index if exists accounts_user_id_sort_order_idx;

create table if not exists public.trades (
  id bigint primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
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
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.trades
add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.trades
add column if not exists note text;

alter table public.trades
drop column if exists vwap;

create table if not exists public.balance_transactions (
  id bigint primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete cascade,
  transaction_type text not null default 'withdrawal',
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.balance_transactions
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.balance_transactions
add column if not exists account_id uuid references public.accounts(id) on delete cascade;

alter table public.balance_transactions
add column if not exists transaction_type text not null default 'withdrawal';

update public.balance_transactions
set transaction_type = 'withdrawal'
where transaction_type is null;

create or replace view public.balance_events as
select
  id,
  workspace_id,
  user_id,
  account_id,
  transaction_type as event_type,
  amount,
  note,
  created_at
from public.balance_transactions;

create or replace function public.get_workspace_role(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = target_user_id
    and wm.status = 'active'
  limit 1;
$$;

create or replace function public.is_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  required_roles text[],
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.status = 'active'
      and wm.role = any(required_roles)
  );
$$;

create or replace function public.can_manage_user_accounts(
  target_workspace_id uuid,
  target_user_id uuid,
  acting_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_workspace_member(target_workspace_id, acting_user_id)
    and (
      target_user_id = acting_user_id
      or public.has_workspace_role(target_workspace_id, array['owner', 'admin'], acting_user_id)
    );
$$;

create or replace function public.can_create_wallet_for_user(
  target_workspace_id uuid,
  target_user_id uuid,
  target_account_type text default 'custom',
  acting_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  workspace_plan text;
  capabilities record;
  current_wallets integer;
begin
  if not public.can_manage_user_accounts(target_workspace_id, target_user_id, acting_user_id) then
    return false;
  end if;

  if target_account_type = 'main' then
    return true;
  end if;

  select w.plan
  into workspace_plan
  from public.workspaces w
  where w.id = target_workspace_id;

  select *
  into capabilities
  from public.get_plan_capabilities(workspace_plan);

  if capabilities.team_mode = false and target_user_id <> acting_user_id then
    return false;
  end if;

  select count(*)::integer
  into current_wallets
  from public.accounts a
  where a.workspace_id = target_workspace_id
    and a.user_id = target_user_id
    and a.type <> 'main';

  if capabilities.can_create_wallets = false then
    return false;
  end if;

  return current_wallets < capabilities.max_wallets_per_user;
end;
$$;

create or replace function public.can_add_workspace_member(
  target_workspace_id uuid,
  acting_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  workspace_plan text;
  capabilities record;
  current_members integer;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'admin'], acting_user_id) then
    return false;
  end if;

  select w.plan
  into workspace_plan
  from public.workspaces w
  where w.id = target_workspace_id;

  select *
  into capabilities
  from public.get_plan_capabilities(workspace_plan);

  if capabilities.team_mode = false then
    return false;
  end if;

  select count(*)::integer
  into current_members
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.status = 'active';

  return current_members < capabilities.max_members;
end;
$$;

create or replace function public.can_create_trade_for_user(
  target_workspace_id uuid,
  target_user_id uuid,
  acting_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  workspace_plan text;
  capabilities record;
  current_trade_count integer;
begin
  if not public.can_manage_user_accounts(target_workspace_id, target_user_id, acting_user_id) then
    return false;
  end if;

  select w.plan
  into workspace_plan
  from public.workspaces w
  where w.id = target_workspace_id;

  select *
  into capabilities
  from public.get_plan_capabilities(workspace_plan);

  if capabilities.max_trades_per_user is null then
    return true;
  end if;

  select count(*)::integer
  into current_trade_count
  from public.trades t
  where t.workspace_id = target_workspace_id
    and t.user_id = target_user_id;

  return current_trade_count < capabilities.max_trades_per_user;
end;
$$;

create or replace function public.is_workspace_cooldown_enabled(
  target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case
          when jsonb_typeof(wr.rules -> 'cooldown_enabled') = 'boolean'
            then (wr.rules ->> 'cooldown_enabled')::boolean
          else true
        end
      from public.workspace_rules wr
      where wr.workspace_id = target_workspace_id
    ),
    true
  );
$$;

create or replace function public.can_access_account(
  target_account_id uuid,
  acting_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.accounts a
    where a.id = target_account_id
      and public.is_workspace_member(a.workspace_id, acting_user_id)
      and (
        a.user_id = acting_user_id
        or public.has_workspace_role(a.workspace_id, array['owner', 'admin'], acting_user_id)
      )
  );
$$;

create or replace function public.can_access_trade(
  target_trade_id bigint,
  acting_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trades t
    where t.id = target_trade_id
      and public.is_workspace_member(t.workspace_id, acting_user_id)
      and (
        t.user_id = acting_user_id
        or public.has_workspace_role(t.workspace_id, array['owner', 'admin'], acting_user_id)
      )
  );
$$;

create or replace function public.assign_account_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_workspace_id uuid;
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;

  if new.workspace_id is null then
    fallback_workspace_id = public.ensure_personal_workspace(new.user_id);
    new.workspace_id = fallback_workspace_id;
  end if;

  if new.sort_order is null or new.sort_order <= 0 then
    select coalesce(max(a.sort_order), 0) + 1
    into new.sort_order
    from public.accounts a
    where a.workspace_id = new.workspace_id
      and a.user_id = new.user_id;
  end if;

  if new.type = 'main' then
    new.sort_order = 0;
    new.start_balance = coalesce(new.start_balance, 0);
  else
    new.start_balance = coalesce(new.start_balance, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists accounts_assign_scope on public.accounts;
create trigger accounts_assign_scope
before insert or update on public.accounts
for each row
execute function public.assign_account_scope();

create or replace function public.sync_record_scope_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_row public.accounts%rowtype;
begin
  select *
  into account_row
  from public.accounts a
  where a.id = new.account_id;

  if account_row.id is null then
    raise exception 'Account % not found', new.account_id;
  end if;

  new.user_id = account_row.user_id;
  new.workspace_id = account_row.workspace_id;

  if tg_table_name = 'trades' and tg_op = 'INSERT' then
    if not public.can_create_trade_for_user(new.workspace_id, new.user_id, auth.uid()) then
      raise exception 'trial_limit_reached';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trades_sync_scope on public.trades;
create trigger trades_sync_scope
before insert or update on public.trades
for each row
execute function public.sync_record_scope_from_account();

drop trigger if exists balance_transactions_sync_scope on public.balance_transactions;
create trigger balance_transactions_sync_scope
before insert or update on public.balance_transactions
for each row
execute function public.sync_record_scope_from_account();

create or replace function public.ensure_default_accounts(
  target_user_id uuid,
  target_workspace_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_workspace_id uuid;
  workspace_plan text;
  capabilities record;
  wallet_count integer;
begin
  resolved_workspace_id = coalesce(target_workspace_id, public.ensure_personal_workspace(target_user_id));

  select w.plan
  into workspace_plan
  from public.workspaces w
  where w.id = resolved_workspace_id;

  select *
  into capabilities
  from public.get_plan_capabilities(workspace_plan);

  wallet_count = 1;

  insert into public.accounts (workspace_id, user_id, name, type, sort_order, start_balance)
  values (resolved_workspace_id, target_user_id, 'Main Account', 'main', 0, 0)
  on conflict do nothing;

  insert into public.accounts (workspace_id, user_id, name, type, sort_order, start_balance)
  select
    resolved_workspace_id,
    target_user_id,
    'Wallet ' || wallet_number,
    'wallet',
    wallet_number,
    0
  from generate_series(1, wallet_count) as wallet_number
  on conflict do nothing;

  update public.accounts
  set type = 'main',
      sort_order = 0,
      start_balance = 0
  where workspace_id = resolved_workspace_id
    and user_id = target_user_id
    and lower(name) = lower('Main Account');

  update public.accounts
  set start_balance = 0
  where workspace_id = resolved_workspace_id
    and user_id = target_user_id
    and type <> 'main';
end;
$$;

drop function if exists public.get_primary_workspace(uuid);
create or replace function public.get_primary_workspace(target_user_id uuid default auth.uid())
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_type text,
  plan text,
  role text,
  max_members integer,
  max_wallets_per_user integer,
  max_trades_per_user integer,
  can_create_wallets boolean,
  team_mode boolean,
  active_members integer,
  current_user_wallets integer,
  cooldown_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with chosen_workspace as (
    select
      w.id,
      w.name,
      w.type,
      w.plan,
      wm.role
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.user_id = target_user_id
      and wm.status = 'active'
    order by
      case when w.type = 'personal' and w.owner_user_id = target_user_id then 0 else 1 end,
      case wm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
      w.created_at
    limit 1
  ),
  capabilities as (
    select
      cw.id as workspace_id,
      cw.name as workspace_name,
      cw.type as workspace_type,
      cw.plan,
      cw.role,
      cap.max_members,
      cap.max_wallets_per_user,
      cap.max_trades_per_user,
      cap.can_create_wallets,
      cap.team_mode
    from chosen_workspace cw
    cross join lateral public.get_plan_capabilities(cw.plan) cap
  )
  select
    c.workspace_id,
    c.workspace_name,
    c.workspace_type,
    c.plan,
    c.role,
    c.max_members,
    c.max_wallets_per_user,
    c.max_trades_per_user,
    c.can_create_wallets,
    c.team_mode,
    (
      select count(*)::integer
      from public.workspace_members wm
      where wm.workspace_id = c.workspace_id
        and wm.status = 'active'
    ) as active_members,
    (
      select count(*)::integer
      from public.accounts a
      where a.workspace_id = c.workspace_id
        and a.user_id = target_user_id
        and a.type <> 'main'
    ) as current_user_wallets,
    public.is_workspace_cooldown_enabled(c.workspace_id) as cooldown_enabled
  from capabilities c;
$$;

create or replace function public.set_workspace_cooldown_enabled(
  target_workspace_id uuid,
  target_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_rules jsonb;
  next_rules jsonb;
begin
  if not public.has_workspace_role(target_workspace_id, array['owner', 'admin']) then
    raise exception 'not_allowed';
  end if;

  select coalesce(wr.rules, '{}'::jsonb)
  into existing_rules
  from public.workspace_rules wr
  where wr.workspace_id = target_workspace_id;

  next_rules = jsonb_set(
    coalesce(existing_rules, '{}'::jsonb),
    '{cooldown_enabled}',
    to_jsonb(coalesce(target_enabled, true)),
    true
  );

  insert into public.workspace_rules (workspace_id, rules)
  values (target_workspace_id, next_rules)
  on conflict (workspace_id) do update
    set rules = excluded.rules,
        updated_at = now();

  return coalesce(target_enabled, true);
end;
$$;

create or replace function public.create_workspace_account(
  target_workspace_id uuid,
  target_name text,
  target_type text default 'custom'
)
returns public.accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_account public.accounts;
  next_sort_order integer;
begin
  if target_name is null or btrim(target_name) = '' then
    raise exception 'Account name is required';
  end if;

  if not public.can_create_wallet_for_user(target_workspace_id, auth.uid(), target_type, auth.uid()) then
    raise exception 'Plan limit reached for wallets in this workspace';
  end if;

  select coalesce(max(a.sort_order), 0) + 1
  into next_sort_order
  from public.accounts a
  where a.workspace_id = target_workspace_id
    and a.user_id = auth.uid();

  insert into public.accounts (workspace_id, user_id, name, type, sort_order, start_balance)
  values (target_workspace_id, auth.uid(), btrim(target_name), target_type, next_sort_order, 0)
  returning * into inserted_account;

  return inserted_account;
end;
$$;

create or replace function public.add_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid,
  target_role text default 'member'
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_member public.workspace_members;
begin
  if target_role not in ('admin', 'member') then
    raise exception 'Invalid member role';
  end if;

  if not public.can_add_workspace_member(target_workspace_id, auth.uid()) then
    raise exception 'Plan limit reached for workspace members';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (target_workspace_id, target_user_id, target_role, 'active')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
  returning * into inserted_member;

  return inserted_member;
end;
$$;

create or replace function public.create_invitation(
  target_workspace_id uuid,
  target_email text,
  target_role text default 'member'
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text;
  pending_invitation public.workspace_invitations%rowtype;
  created_invitation public.workspace_invitations%rowtype;
  active_member_count integer;
  pending_invite_count integer;
begin
  normalized_email = lower(btrim(coalesce(target_email, '')));

  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  if target_role not in ('admin', 'member') then
    raise exception 'Invalid invitation role';
  end if;

  if not public.has_workspace_role(target_workspace_id, array['owner', 'admin'], auth.uid()) then
    raise exception 'You do not have permission to create invitations';
  end if;

  if exists (
    select 1
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
    where wm.workspace_id = target_workspace_id
      and wm.status = 'active'
      and lower(u.email::text) = normalized_email
  ) then
    raise exception 'User with this email is already a workspace member';
  end if;

  select wi.*
  into pending_invitation
  from public.workspace_invitations wi
  where wi.workspace_id = target_workspace_id
    and lower(wi.email) = normalized_email
    and wi.status = 'pending'
  order by wi.created_at desc
  limit 1;

  if pending_invitation.id is not null then
    if pending_invitation.expires_at <= now() then
      update public.workspace_invitations
      set status = 'expired'
      where id = pending_invitation.id;
    else
      raise exception 'A pending invitation already exists for this email';
    end if;
  end if;

  select count(*)::integer
  into active_member_count
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.status = 'active';

  select count(*)::integer
  into pending_invite_count
  from public.workspace_invitations wi
  where wi.workspace_id = target_workspace_id
    and wi.status = 'pending'
    and wi.expires_at > now();

  if active_member_count + pending_invite_count >= (
    select cap.max_members
    from public.workspaces w
    cross join lateral public.get_plan_capabilities(w.plan) cap
    where w.id = target_workspace_id
  ) then
    raise exception 'Plan limit reached for workspace members';
  end if;

  insert into public.workspace_invitations (
    workspace_id,
    email,
    role,
    status,
    token,
    invited_by,
    expires_at
  )
  values (
    target_workspace_id,
    normalized_email,
    target_role,
    'pending',
    encode(gen_random_bytes(24), 'hex'),
    auth.uid(),
    now() + interval '48 hours'
  )
  returning * into created_invitation;

  return created_invitation;
end;
$$;

create or replace function public.accept_invitation(
  target_token text,
  target_user_id uuid default auth.uid()
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitation_row public.workspace_invitations%rowtype;
  accepting_email text;
  accepted_member public.workspace_members%rowtype;
  active_member_count integer;
  pending_invite_count integer;
begin
  select wi.*
  into invitation_row
  from public.workspace_invitations wi
  where wi.token = target_token
  limit 1;

  if invitation_row.id is null then
    raise exception 'Invitation not found';
  end if;

  if invitation_row.status <> 'pending' then
    raise exception 'Invitation is no longer available';
  end if;

  if invitation_row.expires_at <= now() then
    update public.workspace_invitations
    set status = 'expired'
    where id = invitation_row.id;

    raise exception 'Invitation has expired';
  end if;

  select lower(u.email::text)
  into accepting_email
  from auth.users u
  where u.id = target_user_id;

  if accepting_email is null then
    raise exception 'Authenticated user not found';
  end if;

  if accepting_email <> lower(invitation_row.email) then
    raise exception 'This invitation belongs to a different email';
  end if;

  if exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = invitation_row.workspace_id
      and wm.user_id = target_user_id
      and wm.status = 'active'
  ) then
    update public.workspace_invitations
    set status = 'accepted',
        accepted_at = coalesce(accepted_at, now())
    where id = invitation_row.id;

    select wm.*
    into accepted_member
    from public.workspace_members wm
    where wm.workspace_id = invitation_row.workspace_id
      and wm.user_id = target_user_id
    limit 1;

    return accepted_member;
  end if;

  select count(*)::integer
  into active_member_count
  from public.workspace_members wm
  where wm.workspace_id = invitation_row.workspace_id
    and wm.status = 'active';

  select count(*)::integer
  into pending_invite_count
  from public.workspace_invitations wi
  where wi.workspace_id = invitation_row.workspace_id
    and wi.status = 'pending'
    and wi.expires_at > now()
    and wi.id <> invitation_row.id;

  if active_member_count + pending_invite_count >= (
    select cap.max_members
    from public.workspaces w
    cross join lateral public.get_plan_capabilities(w.plan) cap
    where w.id = invitation_row.workspace_id
  ) then
    raise exception 'Plan limit reached for workspace members';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (invitation_row.workspace_id, target_user_id, invitation_row.role, 'active')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
  returning * into accepted_member;

  update public.workspace_invitations
  set status = 'accepted',
      accepted_at = now()
  where id = invitation_row.id;

  return accepted_member;
end;
$$;

create or replace function public.revoke_invitation(target_invitation_id uuid)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_row public.workspace_invitations%rowtype;
begin
  select wi.*
  into invitation_row
  from public.workspace_invitations wi
  where wi.id = target_invitation_id
  limit 1;

  if invitation_row.id is null then
    raise exception 'Invitation not found';
  end if;

  if not public.has_workspace_role(invitation_row.workspace_id, array['owner', 'admin'], auth.uid()) then
    raise exception 'You do not have permission to revoke this invitation';
  end if;

  if invitation_row.status <> 'pending' then
    raise exception 'Only pending invitations can be revoked';
  end if;

  update public.workspace_invitations
  set status = 'revoked'
  where id = invitation_row.id
  returning * into invitation_row;

  return invitation_row;
end;
$$;

create or replace function public.get_workspace_invitations(target_workspace_id uuid default null)
returns table (
  id uuid,
  workspace_id uuid,
  email text,
  role text,
  status text,
  token text,
  invited_by uuid,
  invited_by_email text,
  expires_at timestamptz,
  created_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with resolved_workspace as (
    select coalesce(
      target_workspace_id,
      (select gpw.workspace_id from public.get_primary_workspace(auth.uid()) gpw limit 1)
    ) as workspace_id
  ),
  access_check as (
    select rw.workspace_id
    from resolved_workspace rw
    where public.has_workspace_role(rw.workspace_id, array['owner', 'admin'])
  ),
  expired_rows as (
    update public.workspace_invitations wi
    set status = 'expired'
    where wi.status = 'pending'
      and wi.expires_at <= now()
      and wi.workspace_id in (select workspace_id from access_check)
    returning wi.id
  )
  select
    wi.id,
    wi.workspace_id,
    wi.email,
    wi.role,
    wi.status,
    wi.token,
    wi.invited_by,
    inviter.email::text as invited_by_email,
    wi.expires_at,
    wi.created_at,
    wi.accepted_at
  from public.workspace_invitations wi
  join access_check ac on ac.workspace_id = wi.workspace_id
  join auth.users inviter on inviter.id = wi.invited_by
  order by
    case wi.status when 'pending' then 0 when 'expired' then 1 when 'revoked' then 2 else 3 end,
    wi.created_at desc;
$$;

create or replace function public.get_workspace_members(target_workspace_id uuid default null)
returns table (
  workspace_id uuid,
  user_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with resolved_workspace as (
    select coalesce(
      target_workspace_id,
      (select gpw.workspace_id from public.get_primary_workspace(auth.uid()) gpw limit 1)
    ) as workspace_id
  ),
  access_check as (
    select rw.workspace_id
    from resolved_workspace rw
    where public.has_workspace_role(rw.workspace_id, array['owner', 'admin'])
  )
  select
    wm.workspace_id,
    wm.user_id,
    u.email::text as email,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    wm.role,
    wm.status,
    wm.created_at
  from public.workspace_members wm
  join access_check ac on ac.workspace_id = wm.workspace_id
  join auth.users u on u.id = wm.user_id
  left join public.profiles p on p.user_id = wm.user_id
  where wm.status = 'active'
  order by
    case wm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    coalesce(nullif(trim(p.display_name), ''), u.email::text);
$$;

create or replace function public.handle_new_user_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  personal_workspace_id uuid;
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  personal_workspace_id = public.ensure_personal_workspace(new.id);
  perform public.ensure_default_accounts(new.id, personal_workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_setup on auth.users;
create trigger on_auth_user_created_setup
after insert on auth.users
for each row
execute function public.handle_new_user_setup();

select public.ensure_personal_workspace(u.id)
from auth.users u;

insert into public.workspace_members (workspace_id, user_id, role, status)
select w.id, w.owner_user_id, 'owner', 'active'
from public.workspaces w
on conflict (workspace_id, user_id) do update
  set role = 'owner',
      status = 'active',
      updated_at = now();

insert into public.workspace_rules (workspace_id)
select w.id
from public.workspaces w
on conflict (workspace_id) do nothing;

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
    set start_balance = case when a.type = 'main' then coalesce(p.start_balance, 0) else 0 end
    from public.profiles p
    where a.user_id = p.user_id;
  end if;
end;
$$;

update public.accounts a
set workspace_id = w.id
from public.workspaces w
where a.workspace_id is null
  and w.owner_user_id = a.user_id
  and w.type = 'personal';

select public.ensure_default_accounts(u.id, w.id)
from auth.users u
join public.workspaces w
  on w.owner_user_id = u.id
 and w.type = 'personal';

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

update public.trades t
set workspace_id = a.workspace_id,
    user_id = a.user_id
from public.accounts a
where t.account_id = a.id
  and (t.workspace_id is distinct from a.workspace_id or t.user_id is distinct from a.user_id);

update public.balance_transactions bt
set workspace_id = a.workspace_id,
    user_id = a.user_id
from public.accounts a
where bt.account_id = a.id
  and (bt.workspace_id is distinct from a.workspace_id or bt.user_id is distinct from a.user_id);

alter table public.accounts
alter column workspace_id set not null;

alter table public.trades
alter column account_id set not null;

alter table public.trades
alter column workspace_id set not null;

alter table public.balance_transactions
alter column account_id set not null;

alter table public.balance_transactions
alter column workspace_id set not null;

create index if not exists trades_workspace_account_created_at_idx
on public.trades (workspace_id, account_id, created_at desc);

create index if not exists trades_workspace_user_created_at_idx
on public.trades (workspace_id, user_id, created_at desc);

create index if not exists balance_transactions_workspace_account_created_at_idx
on public.balance_transactions (workspace_id, account_id, created_at desc);

create index if not exists balance_transactions_workspace_user_created_at_idx
on public.balance_transactions (workspace_id, user_id, created_at desc);

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
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_rules enable row level security;
alter table public.feature_flags enable row level security;
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

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_owner" on public.workspaces;
create policy "workspaces_insert_owner"
on public.workspaces
for insert
to authenticated
with check (auth.uid() = owner_user_id);

drop policy if exists "workspaces_update_owner_admin" on public.workspaces;
create policy "workspaces_update_owner_admin"
on public.workspaces
for update
to authenticated
using (public.has_workspace_role(id, array['owner', 'admin']))
with check (public.has_workspace_role(id, array['owner', 'admin']));

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_owner_admin" on public.workspace_members;
create policy "workspace_members_insert_owner_admin"
on public.workspace_members
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'admin'])
  and (
    user_id = auth.uid()
    or public.can_add_workspace_member(workspace_id, auth.uid())
  )
);

drop policy if exists "workspace_members_update_owner_admin" on public.workspace_members;
create policy "workspace_members_update_owner_admin"
on public.workspace_members
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "workspace_invitations_select_owner_admin" on public.workspace_invitations;
create policy "workspace_invitations_select_owner_admin"
on public.workspace_invitations
for select
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "workspace_invitations_insert_owner_admin" on public.workspace_invitations;
create policy "workspace_invitations_insert_owner_admin"
on public.workspace_invitations
for insert
to authenticated
with check (
  public.has_workspace_role(workspace_id, array['owner', 'admin'])
  and invited_by = auth.uid()
);

drop policy if exists "workspace_invitations_update_owner_admin" on public.workspace_invitations;
create policy "workspace_invitations_update_owner_admin"
on public.workspace_invitations
for update
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "workspace_rules_select_member" on public.workspace_rules;
create policy "workspace_rules_select_member"
on public.workspace_rules
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_rules_write_owner_admin" on public.workspace_rules;
create policy "workspace_rules_write_owner_admin"
on public.workspace_rules
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "feature_flags_select_member" on public.feature_flags;
create policy "feature_flags_select_member"
on public.feature_flags
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "feature_flags_write_owner_admin" on public.feature_flags;
create policy "feature_flags_write_owner_admin"
on public.feature_flags
for all
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

drop policy if exists "accounts_select_workspace_scope" on public.accounts;
create policy "accounts_select_workspace_scope"
on public.accounts
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop policy if exists "accounts_insert_workspace_scope" on public.accounts;
create policy "accounts_insert_workspace_scope"
on public.accounts
for insert
to authenticated
with check (
  public.can_manage_user_accounts(workspace_id, user_id)
  and public.can_create_wallet_for_user(workspace_id, user_id, type, auth.uid())
);

drop policy if exists "accounts_update_workspace_scope" on public.accounts;
create policy "accounts_update_workspace_scope"
on public.accounts
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
)
with check (
  public.can_manage_user_accounts(workspace_id, user_id)
);

drop policy if exists "accounts_delete_workspace_scope" on public.accounts;
create policy "accounts_delete_workspace_scope"
on public.accounts
for delete
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop policy if exists "trades_select_workspace_scope" on public.trades;
create policy "trades_select_workspace_scope"
on public.trades
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop policy if exists "trades_insert_workspace_scope" on public.trades;
create policy "trades_insert_workspace_scope"
on public.trades
for insert
to authenticated
with check (
  public.can_access_account(account_id)
  and public.can_manage_user_accounts(workspace_id, user_id)
);

drop policy if exists "trades_update_workspace_scope" on public.trades;
create policy "trades_update_workspace_scope"
on public.trades
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
)
with check (
  public.can_access_account(account_id)
  and public.can_manage_user_accounts(workspace_id, user_id)
);

drop policy if exists "trades_delete_workspace_scope" on public.trades;
create policy "trades_delete_workspace_scope"
on public.trades
for delete
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop policy if exists "balance_transactions_select_workspace_scope" on public.balance_transactions;
create policy "balance_transactions_select_workspace_scope"
on public.balance_transactions
for select
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop policy if exists "balance_transactions_insert_workspace_scope" on public.balance_transactions;
create policy "balance_transactions_insert_workspace_scope"
on public.balance_transactions
for insert
to authenticated
with check (
  public.can_access_account(account_id)
  and public.can_manage_user_accounts(workspace_id, user_id)
);

drop policy if exists "balance_transactions_update_workspace_scope" on public.balance_transactions;
create policy "balance_transactions_update_workspace_scope"
on public.balance_transactions
for update
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
)
with check (
  public.can_access_account(account_id)
  and public.can_manage_user_accounts(workspace_id, user_id)
);

drop policy if exists "balance_transactions_delete_workspace_scope" on public.balance_transactions;
create policy "balance_transactions_delete_workspace_scope"
on public.balance_transactions
for delete
to authenticated
using (
  public.is_workspace_member(workspace_id)
  and (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, array['owner', 'admin'])
  )
);

drop function if exists public.get_worker_summaries();
drop function if exists public.get_account_summaries();

create or replace function public.get_account_summaries(target_workspace_id uuid default null)
returns table (
  workspace_id uuid,
  user_id uuid,
  account_id uuid,
  account_name text,
  account_type text,
  display_name text,
  email text,
  role text,
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
  with resolved_workspace as (
    select coalesce(
      target_workspace_id,
      (select gpw.workspace_id from public.get_primary_workspace(auth.uid()) gpw limit 1)
    ) as workspace_id
  ),
  access_check as (
    select rw.workspace_id
    from resolved_workspace rw
    where public.has_workspace_role(rw.workspace_id, array['owner', 'admin'])
  ),
  account_trade_summary as (
    select
      a.workspace_id,
      a.user_id,
      a.id as account_id,
      a.name as account_name,
      a.type as account_type,
      a.start_balance,
      wm.role,
      u.email::text as email,
      coalesce(trades.total_pnl, 0) + coalesce(balance_events.total_balance_event_pnl, 0) as total_pnl,
      coalesce(trades.trades_count, 0) as trades_count,
      coalesce(trades.wins, 0) as wins
    from public.accounts a
    join access_check ac on ac.workspace_id = a.workspace_id
    join auth.users u on u.id = a.user_id
    left join public.workspace_members wm
      on wm.workspace_id = a.workspace_id
     and wm.user_id = a.user_id
     and wm.status = 'active'
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
        coalesce(sum(
          case
            when bt.transaction_type = 'fees' then -abs(bt.amount)
            when bt.transaction_type = 'adjustment' then bt.amount
            else 0
          end
        ), 0) as total_balance_event_pnl
      from public.balance_transactions bt
      where bt.transaction_type in ('fees', 'adjustment')
      group by bt.account_id
    ) balance_events on balance_events.account_id = a.id
    where a.type <> 'main'
  ),
  latest_trade_result as (
    select distinct on (t.workspace_id, t.user_id, t.account_id)
      t.workspace_id,
      t.user_id,
      t.account_id,
      t.result
    from public.trades t
    join access_check ac on ac.workspace_id = t.workspace_id
    order by t.workspace_id, t.user_id, t.account_id, t.created_at desc, t.id desc
  ),
  streaks as (
    select
      x.workspace_id,
      x.user_id,
      x.account_id,
      count(*)::integer as streak_count
    from public.trades x
    join latest_trade_result ltr
      on ltr.workspace_id = x.workspace_id
     and ltr.user_id = x.user_id
     and ltr.account_id = x.account_id
     and ltr.result = x.result
    where not exists (
      select 1
      from public.trades newer
      where newer.workspace_id = x.workspace_id
        and newer.user_id = x.user_id
        and newer.account_id = x.account_id
        and (
          newer.created_at > x.created_at
          or (newer.created_at = x.created_at and newer.id > x.id)
        )
        and newer.result <> ltr.result
    )
    group by x.workspace_id, x.user_id, x.account_id
  )
  select
    ats.workspace_id,
    ats.user_id,
    ats.account_id,
    ats.account_name,
    ats.account_type,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    ats.email,
    ats.role,
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
  left join public.profiles p on p.user_id = ats.user_id
  left join latest_trade_result ltr
    on ltr.workspace_id = ats.workspace_id
   and ltr.user_id = ats.user_id
   and ltr.account_id = ats.account_id
  left join streaks s
    on s.workspace_id = ats.workspace_id
   and s.user_id = ats.user_id
   and s.account_id = ats.account_id
  order by ats.email, ats.account_name, ats.account_id;
$$;

revoke all on function public.get_account_summaries(uuid) from public;
grant execute on function public.get_account_summaries(uuid) to authenticated;

revoke all on function public.create_invitation(uuid, text, text) from public;
grant execute on function public.create_invitation(uuid, text, text) to authenticated;

revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to authenticated;

revoke all on function public.revoke_invitation(uuid) from public;
grant execute on function public.revoke_invitation(uuid) to authenticated;

revoke all on function public.get_workspace_invitations(uuid) from public;
grant execute on function public.get_workspace_invitations(uuid) to authenticated;

revoke all on function public.get_workspace_members(uuid) from public;
grant execute on function public.get_workspace_members(uuid) to authenticated;

drop function if exists public.get_team_daily_pnl(date, date);
drop function if exists public.get_team_daily_pnl(uuid, date, date);

create or replace function public.get_team_daily_pnl(
  target_workspace_id uuid default null,
  date_from date default null,
  date_to date default null
)
returns table (
  workspace_id uuid,
  trade_date date,
  user_id uuid,
  account_id uuid,
  account_name text,
  account_type text,
  display_name text,
  email text,
  role text,
  daily_pnl numeric
)
language sql
security definer
set search_path = public, auth
as $$
  with resolved_workspace as (
    select coalesce(
      target_workspace_id,
      (select gpw.workspace_id from public.get_primary_workspace(auth.uid()) gpw limit 1)
    ) as workspace_id
  ),
  access_check as (
    select rw.workspace_id
    from resolved_workspace rw
    where public.has_workspace_role(rw.workspace_id, array['owner', 'admin'])
  )
  select
    a.workspace_id,
    (entry.created_at at time zone 'UTC')::date as trade_date,
    entry.user_id,
    a.id as account_id,
    a.name as account_name,
    a.type as account_type,
    coalesce(nullif(trim(p.display_name), ''), null) as display_name,
    u.email::text as email,
    wm.role,
    sum(entry.daily_pnl) as daily_pnl
  from (
    select
      t.created_at,
      t.user_id,
      t.account_id,
      t.pnl as daily_pnl
    from public.trades t
    join access_check ac on ac.workspace_id = t.workspace_id
    union all
    select
      bt.created_at,
      bt.user_id,
      bt.account_id,
      case
        when bt.transaction_type = 'fees' then -abs(bt.amount)
        when bt.transaction_type = 'adjustment' then bt.amount
        else 0
      end as daily_pnl
    from public.balance_transactions bt
    join access_check ac on ac.workspace_id = bt.workspace_id
    where bt.transaction_type in ('fees', 'adjustment')
  ) entry
  join public.accounts a on a.id = entry.account_id
  join auth.users u on u.id = entry.user_id
  left join public.profiles p on p.user_id = entry.user_id
  left join public.workspace_members wm
    on wm.workspace_id = a.workspace_id
   and wm.user_id = entry.user_id
   and wm.status = 'active'
  where a.type <> 'main'
    and (date_from is null or (entry.created_at at time zone 'UTC')::date >= date_from)
    and (date_to is null or (entry.created_at at time zone 'UTC')::date <= date_to)
  group by a.workspace_id, (entry.created_at at time zone 'UTC')::date, entry.user_id, a.id, a.name, a.type, p.display_name, u.email, wm.role
  order by trade_date, email, account_name, account_id;
$$;

revoke all on function public.get_team_daily_pnl(uuid, date, date) from public;
grant execute on function public.get_team_daily_pnl(uuid, date, date) to authenticated;
