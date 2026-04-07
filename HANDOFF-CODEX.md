# Handoff For Next Agent

Repo: `/Users/andry/polymarket-tracker`

## Project Context

Ignore all context from `perp-profit-calculator` and any perp / hedge / points / Supabase-for-Perp-Tools ideas.
Work only in `polymarket-tracker`.

This is a React 19 + Vite + Supabase app for Polymarket trade journaling.
Current product direction:
- one `user`
- many `accounts/subaccounts`
- default accounts per user:
  - `Main Account`
  - `Wallet 1` ... `Wallet 10`
- user can rename accounts
- data is isolated per account

## Important Product Rules Already Requested

- All account data is separated by `account_id`
- `Main Account` start balance is `47`
- all other default wallets start at `0`
- custom accounts also start at `0`
- admin analytics must exclude `Main Account` and only count wallets/custom accounts
- `README.md` was intentionally marked local-only via `git update-index --skip-worktree README.md`
  - do not rely on README status in git

## Current Code State

### Subaccounts / account model

Already implemented in app:
- `src/lib/account-service.js`
- `src/providers/account-provider.jsx`
- `src/providers/account-context.js`
- `src/providers/use-account.js`
- `src/main.jsx` wraps app in `AccountProvider`

Dashboard already uses account-aware loading and mutations:
- `src/pages/dashboard-page.jsx`
- `src/lib/trade-service.js`

### Admin filtering

Admin page now tries to exclude `Main Account`:
- frontend filter in `src/pages/admin-page.jsx`
- also expects `account_type` from RPC
- fallback filter by `account_name === "Main Account"` if RPC does not provide type

### Manual balance adjustment

Implemented as separate record type:
- `recordType: "adjustment"`
- affects:
  - balance
  - total PnL
  - daily PnL
- does NOT affect:
  - trades count
  - transactions count
  - volume
  - win rate
  - streak

Main files:
- `src/lib/trade-utils.js`
- `src/lib/trade-service.js`
- `src/components/tracker/trade-form.jsx`
- `src/components/tracker/trade-history.jsx`
- `src/pages/dashboard-page.jsx`

SQL side expects `balance_transactions.transaction_type` with values:
- `withdrawal`
- `adjustment`

### Cooldown system

Implemented on frontend only, per wallet, persisted in localStorage:
- file: `src/lib/trade-utils.js`
  - `TRADE_COOLDOWN_MS`
  - `getCooldownTrigger`
  - `getLocalDayKey`
  - `formatCountdown`
- file: `src/pages/dashboard-page.jsx`
  - stores cooldown per `user + account`
  - reload-safe via localStorage
  - resets on new day
  - blocks adding trades during active cooldown
- file: `src/components/tracker/trade-form.jsx`
  - overlay banner on top of Add Trade form

Cooldown rules requested and implemented:
- per wallet independently
- trading day resets at local midnight
- start balance of day = balance at time of first trade that day
- withdrawals / adjustments before first trade are included in day start balance
- triggers checked after every added trade:
  1. daily profit >= +13% of day start balance
  2. 3 losses in a row
  3. daily loss <= -20% of day start balance
- cooldown duration: 60 minutes
- overlay text in Russian:
  - `Нужно зачильться на этом кошельке и отдохнуть`
  - reason label
  - timer MM:SS

## SQL File

Canonical SQL file currently:
- `supabase/subaccounts-schema.sql`

It has been rewritten multiple times during the session.
It currently includes:
- `profiles`
- `accounts`
- `trades`
- `balance_transactions`
- default account bootstrap
- RLS
- `get_account_summaries()`
- `get_team_daily_pnl()`
- `transaction_type` support on `balance_transactions`

## Very Important Known Issue

Admin summary / team RPC behavior has been unstable.

Observed behavior:
- `Team Daily PnL Calendar` can show data
- `Worker Results` can still be empty if `get_account_summaries()` returns empty
- frontend now has a fallback in `src/pages/admin-page.jsx`:
  - if `loadWorkerSummaries()` gives no rows
  - it derives worker rows from calendar data

This means:
- admin page should not be blank anymore
- but SQL for `get_account_summaries()` may still need more cleanup if user reports inconsistencies

## Latest User Request Before Handoff

User said:
- memory limit
- wants compressed dialog state
- wants a file to continue with a new agent

## Things The Next Agent Should Verify First

1. Open `src/pages/admin-page.jsx`
   - verify `Main Account` is excluded everywhere in admin calculations
   - verify fallback worker aggregation is still safe

2. Open `supabase/subaccounts-schema.sql`
   - verify `get_account_summaries()` and `get_team_daily_pnl()` both expose `account_type`
   - verify both exclude or support exclusion of `type = 'main'`
   - if needed, move exclusion to SQL instead of frontend-only filtering

3. Open `src/pages/dashboard-page.jsx` and `src/components/tracker/trade-form.jsx`
   - verify cooldown UX actually behaves correctly in browser
   - especially around:
     - new day reset
     - page refresh during cooldown
     - adding adjustment/withdrawal during cooldown

4. Verify trade-form overlay behavior
   - user asked: Add Trade block should be fully overlaid and non-interactive
   - current implementation visually overlays whole card, not just submit button

## Suggested Next Improvements

If continuing from here, highest-value next tasks:
- move admin filtering of `Main Account` into SQL RPCs, not just frontend
- add debug / visibility block for cooldown metrics:
  - day start balance
  - day pnl %
  - current loss streak
- verify admin summary consistency after `adjustment` support

## Files Modified During This Session

- `src/lib/account-service.js`
- `src/providers/account-provider.jsx`
- `src/providers/account-context.js`
- `src/providers/use-account.js`
- `src/main.jsx`
- `src/lib/trade-service.js`
- `src/lib/trade-utils.js`
- `src/pages/dashboard-page.jsx`
- `src/pages/admin-page.jsx`
- `src/components/tracker/trade-form.jsx`
- `src/components/tracker/trade-history.jsx`
- `src/components/tracker/summary-cards.jsx`
- `supabase/subaccounts-schema.sql`
- `README.md` was modified earlier but then marked `skip-worktree`

## Validation Status At End Of Session

Last checks passed:
- `npm run lint`
- `npm run build`

## Note About README

`README.md` was intentionally hidden from normal git tracking locally:
- command used earlier: `git update-index --skip-worktree README.md`

If a future agent needs to edit and commit it again:
- run `git update-index --no-skip-worktree README.md`
