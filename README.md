# Polymarket Tracker

Многопользовательское приложение для ведения журнала сделок в Polymarket. Каждый воркер входит под своим пользователем, переключается между субаккаунтами и видит только свои данные.

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
- хранить стартовый баланс и историю сделок по `account/subaccount`;
- показывать баланс, общий результат, streak и win rate;
- строить equity curve по истории сделок;
- подсвечивать простые эвристики по `ATR`, `Time` и `Entry`;
- автоматически создавать дефолтные аккаунты `Main Account` и `Wallet 1` ... `Wallet 10`.

## Структура

- [`src/App.jsx`](./src/App.jsx) собирает экран и связывает состояние.
- [`src/providers/auth-provider.jsx`](./src/providers/auth-provider.jsx) управляет сессией.
- [`src/providers/account-provider.jsx`](./src/providers/account-provider.jsx) управляет списком аккаунтов и активным субаккаунтом.
- [`src/pages/login-page.jsx`](./src/pages/login-page.jsx) содержит вход и создание воркер-аккаунтов.
- [`src/pages/dashboard-page.jsx`](./src/pages/dashboard-page.jsx) содержит дашборд воркера.
- [`src/pages/admin-page.jsx`](./src/pages/admin-page.jsx) содержит сводку по всем воркерам для главного аккаунта.
- [`src/lib/account-service.js`](./src/lib/account-service.js) работает с таблицей `accounts`.
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

4. Выполни SQL из файла [`supabase/subaccounts-schema.sql`](./supabase/subaccounts-schema.sql) в Supabase SQL Editor.

Этот SQL:

- создаёт таблицу `accounts` с `type`, `sort_order` и `start_balance`;
- автоматически создаёт `Main Account` и `Wallet 1` ... `Wallet 10` при новом signup;
- мигрирует существующие `trades` и `balance_transactions` на `account_id`;
- переносит старый `profiles.start_balance` в `Main Account`, если колонка существовала;
- обновляет RLS и админские RPC до account-level модели.

5. Для админ-страницы:

- в `.env.local` и в Vercel добавь `VITE_ADMIN_EMAIL` с твоим email;
- в [`supabase/subaccounts-schema.sql`](./supabase/subaccounts-schema.sql) замени `YOUR_ADMIN_EMAIL` на тот же email;
- после изменения env на Vercel нажми `Redeploy`.
- воркер может сам заполнить `Worker name` на своем дашборде, и в админке будет показываться оно вместо email;
- админка теперь агрегирует результаты по аккаунтам, а не только по пользователям.

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
