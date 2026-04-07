import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import polyjournalLogo from "@/assets/polyjournal-logo.svg"
import { TradeForm } from "@/components/tracker/trade-form"
import { TradeHistory } from "@/components/tracker/trade-history"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DEFAULT_START_BALANCE,
  TRADE_COOLDOWN_MS,
  buildEquityData,
  createBalanceEvent,
  createTrade,
  formatCountdown,
  getCooldownTrigger,
  getLocalDayKey,
  getTradeStats,
} from "@/lib/trade-utils"
import {
  insertBalanceEvent,
  insertTrade,
  loadDashboard,
  removeRecord,
  updateRecordNote,
} from "@/lib/trade-service"
import { useAccount } from "@/providers/use-account"
import { useAuth } from "@/providers/use-auth"

const BalanceChart = lazy(() =>
  import("@/components/tracker/balance-chart").then((module) => ({
    default: module.BalanceChart,
  }))
)

function getCooldownStorageKey(userId, accountId) {
  return `trade-cooldown:${userId}:${accountId}`
}

function getStoredCooldown(userId, accountId) {
  if (typeof window === "undefined" || !userId || !accountId) return null

  try {
    const raw = window.localStorage.getItem(getCooldownStorageKey(userId, accountId))
    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (!parsed?.expiresAt || !parsed?.dayKey || !parsed?.reasonLabel) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function clearStoredCooldown(userId, accountId) {
  if (typeof window === "undefined" || !userId || !accountId) return

  window.localStorage.removeItem(getCooldownStorageKey(userId, accountId))
}

function setStoredCooldown(userId, accountId, cooldown) {
  if (typeof window === "undefined" || !userId || !accountId) return

  window.localStorage.setItem(getCooldownStorageKey(userId, accountId), JSON.stringify(cooldown))
}

function isCooldownExpired(cooldown, nowTimestamp) {
  if (!cooldown) return true

  return cooldown.dayKey !== getLocalDayKey(new Date(nowTimestamp)) || cooldown.expiresAt <= nowTimestamp
}

export function DashboardPage() {
  const { signOut, user } = useAuth()
  const {
    accounts,
    activeAccountId,
    isLoading: isAccountsLoading,
    workspace,
    setActiveAccountId,
  } = useAccount()
  const [records, setRecords] = useState([])
  const startBalance = DEFAULT_START_BALANCE
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [cooldown, setCooldown] = useState(null)
  const [nowTimestamp, setNowTimestamp] = useState(Date.now())
  const [error, setError] = useState("")
  const cooldownEnabled = workspace?.rules?.cooldownEnabled ?? true

  useEffect(() => {
    if (!user?.id || !activeAccountId) {
      setCooldown(null)
      return
    }

    const storedCooldown = getStoredCooldown(user.id, activeAccountId)

    if (!storedCooldown || isCooldownExpired(storedCooldown, Date.now())) {
      clearStoredCooldown(user.id, activeAccountId)
      setCooldown(null)
      return
    }

    setCooldown(storedCooldown)
  }, [activeAccountId, user?.id])

  useEffect(() => {
    if (!cooldown || !cooldownEnabled) return undefined

    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [cooldown, cooldownEnabled])

  useEffect(() => {
    if (!cooldown || !user?.id || !activeAccountId || !cooldownEnabled) return

    if (isCooldownExpired(cooldown, nowTimestamp)) {
      clearStoredCooldown(user.id, activeAccountId)
      setCooldown(null)
    }
  }, [activeAccountId, cooldown, cooldownEnabled, nowTimestamp, user?.id])

  useEffect(() => {
    if (!activeAccountId) {
      setRecords([])
      setIsBootstrapping(isAccountsLoading)
      return
    }

    let active = true

    async function bootstrap() {
      setIsBootstrapping(true)
      setError("")

      try {
        const dashboard = await loadDashboard(
          user.id,
          activeAccountId,
          DEFAULT_START_BALANCE
        )

        if (!active) return
        setRecords(dashboard.records)
      } catch (nextError) {
        if (!active) return
        setError(nextError.message ?? "Failed to load dashboard.")
      } finally {
        if (active) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [activeAccountId, isAccountsLoading, user.id])

  const {
    totalPnL,
    dailyPnL,
    balance,
    winRate,
    tradeRecordsCount,
    transactionsCount,
    volume,
    streak,
    streakLabel,
    showBreakWarning,
    showDrawdownWarning,
    quickSizes,
  } = useMemo(
    () => getTradeStats(records, startBalance),
    [records, startBalance]
  )
  const equityData = useMemo(() => buildEquityData(records, startBalance), [records, startBalance])
  const selectorAccounts = useMemo(() => {
    const wallets = accounts.filter((account) => account.type === "wallet")

    return wallets.length ? wallets : accounts
  }, [accounts])
  const tradeLimit = workspace?.capabilities?.maxTradesPerUser ?? null
  const isTrialTradeLimitReached = tradeLimit !== null && tradeRecordsCount >= tradeLimit
  const activeCooldown = useMemo(() => {
    if (!cooldownEnabled) return null
    if (!cooldown) return null

    const remainingMs = Math.max(0, cooldown.expiresAt - nowTimestamp)

    return {
      ...cooldown,
      isActive: remainingMs > 0 && cooldown.dayKey === getLocalDayKey(new Date(nowTimestamp)),
      remainingMs,
      remainingLabel: formatCountdown(remainingMs),
    }
  }, [cooldown, cooldownEnabled, nowTimestamp])

  async function handleAddTrade(form) {
    if (activeCooldown?.isActive) {
      setError("Cooldown is active for this wallet.")
      return false
    }

    if (isTrialTradeLimitReached) {
      setError(`You reached the free limit (${tradeLimit} trades). Upgrade to continue.`)
      return false
    }

    const trade = createTrade(form)
    if (!trade) return false

    try {
      setError("")
      const savedTrade = await insertTrade(user.id, activeAccountId, trade)
      const nextRecords = [savedTrade, ...records]
      const trigger = cooldownEnabled
        ? getCooldownTrigger(nextRecords, startBalance, getLocalDayKey(savedTrade.createdAt))
        : null
      setRecords(nextRecords)

      if (trigger) {
        const triggerTime = new Date(savedTrade.createdAt || Date.now()).getTime()
        const nextCooldown = {
          reasonCode: trigger.code,
          reasonLabel: trigger.label,
          startedAt: triggerTime,
          expiresAt: triggerTime + TRADE_COOLDOWN_MS,
          dayKey: getLocalDayKey(savedTrade.createdAt || Date.now()),
        }

        setCooldown(nextCooldown)
        setStoredCooldown(user.id, activeAccountId, nextCooldown)
      }

      return true
    } catch (nextError) {
      const nextMessage =
        nextError.message === "trial_limit_reached"
          ? `You reached the free limit (${tradeLimit} trades). Upgrade to continue.`
          : nextError.message ?? "Failed to save trade."
      setError(nextMessage)
      return false
    }
  }

  async function handleAddBalanceEvent(type, amount, note) {
    const event = createBalanceEvent(type, amount, note)
    if (!event) return false

    try {
      setError("")
      const savedEvent = await insertBalanceEvent(user.id, activeAccountId, event)
      setRecords((current) => [savedEvent, ...current])
      return true
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save balance event.")
      return false
    }
  }

  async function handleDeleteRecord(record) {
    try {
      setError("")
      await removeRecord(user.id, activeAccountId, record)
      setRecords((current) => current.filter((item) => item.id !== record.id || item.recordType !== record.recordType))
    } catch (nextError) {
      setError(nextError.message ?? "Failed to delete history item.")
    }
  }

  async function handleUpdateRecordNote(record, note) {
    try {
      setError("")
      const updatedRecord = await updateRecordNote(user.id, activeAccountId, record, note)
      setRecords((current) =>
        current.map((item) =>
          item.id === record.id && item.recordType === record.recordType ? updatedRecord : item
        )
      )
      return updatedRecord
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save history comment.")
      throw nextError
    }
  }

  if (isBootstrapping) {
    return (
      <CenteredState
        title="Loading worker dashboard..."
        subtitle="Fetching private data for the current account."
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] p-4 text-white md:p-6 xl:p-7">
      <div className="mx-auto max-w-[1720px]">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={polyjournalLogo} alt="PolyJournal logo" className="h-8 w-8 md:h-9 md:w-9" />
              <h1 className="text-3xl font-bold md:text-4xl">PolyJournal</h1>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <select
              value={activeAccountId}
              onChange={(event) => setActiveAccountId(event.target.value)}
              className="h-10 min-w-44 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-slate-500"
            >
              {selectorAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Link to="/settings">Settings</Link>
            </Button>
            <Button
              asChild
              className="h-10 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
            >
              <Link to="/upgrade">Upgrade</Link>
            </Button>
            <Button
              variant="outline"
              onClick={signOut}
              className="h-10 rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              Sign out
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {showBreakWarning ? (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-sm font-medium text-red-200">
            Loss streak reached 5 or more. Take a break before the next trade.
          </div>
        ) : null}

        {showDrawdownWarning ? (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/15 p-4 text-sm font-medium text-red-200">
            Loss exceeds 20% of current balance. Stop trading and review the session.
          </div>
        ) : null}

        {isTrialTradeLimitReached ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="font-medium text-white">
              You reached the free limit ({tradeLimit} trades). Upgrade to continue.
            </div>
            <Button
              className="mt-3 h-10 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
              onClick={() =>
                window.alert("Upgrade CTA placeholder: move from base to a paid plan.")
              }
            >
              Upgrade
            </Button>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_440px]">
          <div className="space-y-4">
            <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
              <CardContent className="px-4 pt-4 pb-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Sizing guide</div>
                <div className="mt-3 space-y-2 text-sm">
                  <SizingRow label="12%" size={quickSizes[0]} />
                  <SizingRow label="15%" size={quickSizes[1]} />
                  <SizingRow label="20%" size={quickSizes[2]} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
              <CardContent className="px-4 pt-4 pb-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Key metrics</div>
                <div className="mt-3 space-y-2.5">
                  <MetricRow label="Balance" value={`$${balance.toFixed(2)}`} tone="text-white" />
                  <MetricRow
                    label="Total PnL"
                    value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`}
                    tone={totalPnL >= 0 ? "text-green-400" : "text-red-400"}
                  />
                  <MetricRow
                    label="Daily PnL"
                    value={`${dailyPnL >= 0 ? "+" : ""}$${dailyPnL.toFixed(2)}`}
                    tone={dailyPnL >= 0 ? "text-green-400" : "text-red-400"}
                  />
                  <MetricRow label="Transactions" value={String(transactionsCount)} tone="text-white" />
                  <MetricRow label="Volume" value={`$${volume.toFixed(2)}`} tone="text-white" />
                  <MetricRow label="Streak" value={`${streak}${streakLabel}`} tone="text-white" />
                  <MetricRow label="Win rate" value={`${winRate.toFixed(1)}%`} tone="text-white" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Suspense fallback={<ChartFallback compact />}>
              <BalanceChart data={equityData} chartHeightClass="h-[26rem] 2xl:h-[30rem]" />
            </Suspense>
          </div>

          <div className="xl:sticky xl:top-4 xl:self-start">
            <TradeForm
              onSubmit={handleAddTrade}
              onAddBalanceEvent={handleAddBalanceEvent}
              currentBalance={balance}
              cooldown={activeCooldown}
              tradeUsage={tradeRecordsCount}
              tradeLimit={tradeLimit}
              trialLimitReached={isTrialTradeLimitReached}
              requireDangerConfirm={showBreakWarning}
              onUpgrade={() =>
                window.alert("Upgrade CTA placeholder: move from base to a paid plan.")
              }
            />
          </div>
        </div>

        <div className="mb-6">
          <TradeHistory
            trades={records}
            onDelete={handleDeleteRecord}
            onUpdateNote={handleUpdateRecordNote}
          />
        </div>
      </div>
    </div>
  )
}

function SizingRow({ label, size }) {
  const stopLoss = size * 0.25

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#020617] px-3 py-2">
      <div className="font-medium text-slate-200">{label}</div>
      <div className="text-right text-slate-300">
        ${size.toFixed(2)} <span className="text-slate-500">(SL ${stopLoss.toFixed(2)})</span>
      </div>
    </div>
  )
}

function MetricRow({ label, value, tone = "text-white" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-slate-400">{label}</div>
      <div className={`font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function ChartFallback({ compact = false }) {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
      <CardContent
        className={`flex items-center justify-center px-5 py-5 text-slate-400 md:px-6 md:py-6 ${
          compact ? "h-[26rem]" : "h-72"
        }`}
      >
        Loading chart...
      </CardContent>
    </Card>
  )
}

function CenteredState({ title, subtitle }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <div className="max-w-md text-center">
        <div className="text-2xl font-semibold">{title}</div>
        <div className="mt-2 text-slate-400">{subtitle}</div>
      </div>
    </div>
  )
}
