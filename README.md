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
- [`src/lib/trade-utils.js`](./src/lib/trade-utils.js) содержит бизнес-логику и вычисления.
- [`src/lib/trade-service.js`](./src/lib/trade-service.js) работает с данными в Supabase.
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
```

4. Выполни SQL в Supabase SQL Editor:

```sql
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_balance numeric not null default 47
);

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
  result text not null,
  created_at timestamptz not null default now()
);

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
```

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
