# Project Handoff

## 1. Architecture

- App stack: `React 19 + Vite + react-router-dom + Supabase`
- Product type: Polymarket trade journal/dashboard evolving into SaaS workspace model
- Core domain:
  - `workspaces`
  - `workspace_members`
  - `workspace_invitations`
  - `accounts`
  - `trades`
  - `balance_transactions`
- Main pages:
  - `src/pages/login-page.jsx` - sign in / sign up
  - `src/pages/dashboard-page.jsx` - solo/team personal trading dashboard
  - `src/pages/admin-page.jsx` - team workspace dashboard
  - `src/pages/invite-accept-page.jsx` - accept invitation by token

## 2. Current Features

- Supabase auth
- Personal workspace bootstrap for each user
- Accounts per workspace/user
- Trades, withdrawals, adjustments
- Dashboard stats:
  - balance
  - total pnl
  - daily pnl
  - win rate
  - streak
  - volume
- Frontend cooldown logic
- Team workspace foundation:
  - members
  - invitations
  - team analytics
  - team daily pnl calendar
- Trial logic on `plan = base`
- Wallet limits per user
- Invite flow:
  - create invite
  - pending invites list
  - copy invite link
  - revoke invite
  - accept invite at `/invite/:token`

## 3. Recent Changes

- Added workspace architecture and workspace-aware client bootstrap
- Added `workspace_invitations` and production-style invitation flow
- Replaced direct-add team UI with invite-based flow
- Added trial logic using `plan = base`
  - `max_wallets_per_user = 1`
  - `max_trades_per_user = 3`
- Added server-side enforcement of trade limit in SQL
- Simplified Add Trade form:
  - only `size`, `entry`, `exit` in main form
  - advanced block hidden by default
  - Enter submit
- Fixed price-unit bug:
  - prices are now always entered in cents
  - `66 = $0.66`
  - `2 = $0.02`
  - ambiguous normalization removed

## 4. Current Limits

- `base`
  - `max_members = 1`
  - `max_wallets_per_user = 1`
  - `max_trades_per_user = 3`
  - `team_mode = false`
- `pro`
  - `max_members = 1`
  - `max_wallets_per_user = 30`
  - `max_trades_per_user = null`
- `team`
  - `max_members = 5`
  - `max_wallets_per_user = 30`
  - `max_trades_per_user = null`
- `enterprise`
  - `max_members = 20`
  - `max_wallets_per_user = 100`
  - `max_trades_per_user = null`

Notes:
- Trial trade limit is enforced on the server
- Wallet/member limits are also server-side
- Pending invites consume seat capacity

## 5. Risk Areas / Tech Debt

- Still a `Vite SPA`, not `Next.js App Router`
- No full multi-workspace selector UI yet
- Upgrade CTA is UI-only, no real billing flow
- Team analytics depend on SQL RPC shape
- Build currently warns about large chunks
- Cooldown is frontend/localStorage only
- No automated tests yet for invite flow / preview / trial limits

## 6. Key Files

- `supabase/subaccounts-schema.sql`
  - full DB schema, RLS, RPC, limits, invites, trade enforcement
- `src/lib/workspace-service.js`
  - workspace and invitation client RPC layer
- `src/lib/account-service.js`
  - accounts CRUD
- `src/lib/trade-service.js`
  - dashboard data, trade CRUD, analytics RPC
- `src/lib/trade-utils.js`
  - price normalization, trade creation, preview, stats, cooldown helpers
- `src/lib/plan-capabilities.js`
  - frontend plan capability mirror
- `src/providers/auth-provider.jsx`
  - auth session state
- `src/providers/account-provider.jsx`
  - current workspace/accounts bootstrap and refresh
- `src/components/tracker/trade-form.jsx`
  - simplified Add Trade form
- `src/pages/dashboard-page.jsx`
  - main user dashboard
- `src/pages/admin-page.jsx`
  - team workspace UI
- `src/pages/invite-accept-page.jsx`
  - invitation accept flow

## 7. Next Step

Recommended next step:
- add automated tests for:
  - `normalizePrice`
  - `getTradePreview`
  - `createTrade`
  - trial trade limit
  - invitation flow states

After that:
- build multi-workspace selector
- replace upgrade placeholders with real billing flow
- optionally start runtime migration to `Next.js`

## Important

- New backend features only work if the latest SQL from `supabase/subaccounts-schema.sql` is applied in Supabase
- Last local checks passed:
  - `npm run lint`
  - `npm run build`
