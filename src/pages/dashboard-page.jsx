import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { SummaryCards } from "@/components/tracker/summary-cards"
import { TradeForm } from "@/components/tracker/trade-form"
import { TradeHistory } from "@/components/tracker/trade-history"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { isAdminUser } from "@/lib/admin"
import { DEFAULT_START_BALANCE, buildEquityData, createTrade, getTradeStats } from "@/lib/trade-utils"
import {
  insertTrade,
  loadDashboard,
  removeTrade,
  resetDashboard,
  saveWorkerProfile,
  updateTradeNote,
} from "@/lib/trade-service"
import { useAuth } from "@/providers/use-auth"

const BalanceChart = lazy(() =>
  import("@/components/tracker/balance-chart").then((module) => ({
    default: module.BalanceChart,
  }))
)

export function DashboardPage() {
  const { signOut, user } = useAuth()
  const [trades, setTrades] = useState([])
  const [startBalance, setStartBalance] = useState(DEFAULT_START_BALANCE)
  const [displayName, setDisplayName] = useState("")
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setIsBootstrapping(true)
      setError("")

      try {
        const dashboard = await loadDashboard(user.id, DEFAULT_START_BALANCE)

        if (!active) return
        setTrades(dashboard.trades)
        setStartBalance(dashboard.startBalance)
        setDisplayName(dashboard.displayName)
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
  }, [user.id])

  const {
    totalPnL,
    dailyPnL,
    balance,
    wins,
    winRate,
    streak,
    streakLabel,
    showBreakWarning,
    showDrawdownWarning,
    quickSizes,
  } = useMemo(
    () => getTradeStats(trades, startBalance),
    [trades, startBalance]
  )
  const equityData = useMemo(() => buildEquityData(trades, startBalance), [trades, startBalance])

  async function handleAddTrade(form) {
    const trade = createTrade(form)
    if (!trade) return false

    try {
      setError("")
      const savedTrade = await insertTrade(user.id, trade)
      setTrades((current) => [savedTrade, ...current])
      return true
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save trade.")
      return false
    }
  }

  async function handleDeleteTrade(tradeId) {
    try {
      setError("")
      await removeTrade(user.id, tradeId)
      setTrades((current) => current.filter((trade) => trade.id !== tradeId))
    } catch (nextError) {
      setError(nextError.message ?? "Failed to delete trade.")
    }
  }

  async function handleUpdateTradeNote(tradeId, note) {
    try {
      setError("")
      const updatedTrade = await updateTradeNote(user.id, tradeId, note)
      setTrades((current) =>
        current.map((trade) => (trade.id === tradeId ? updatedTrade : trade))
      )
      return updatedTrade
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save trade comment.")
      throw nextError
    }
  }

  async function handleResetAll() {
    try {
      setError("")
      await resetDashboard(user.id, DEFAULT_START_BALANCE)
      setTrades([])
      setStartBalance(DEFAULT_START_BALANCE)
    } catch (nextError) {
      setError(nextError.message ?? "Failed to reset dashboard.")
    }
  }

  async function handleProfileBlur() {
    try {
      setIsSavingProfile(true)
      setError("")
      await saveWorkerProfile(user.id, {
        startBalance,
        displayName,
      })
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save worker profile.")
    } finally {
      setIsSavingProfile(false)
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
    <div className="min-h-screen bg-[#020617] p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Polymarket journal</div>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Worker Dashboard</h1>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
            >
              <a
                href="https://polymarket.com/event/btc-updown-15m-1773242100"
                target="_blank"
                rel="noreferrer"
              >
                Polymarket 15M
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
            >
              <a
                href="https://www.tradingview.com/chart/w0q6KINR/"
                target="_blank"
                rel="noreferrer"
              >
                TradingView
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
            >
              <a
                href="https://terminal.polysigma.io/"
                target="_blank"
                rel="noreferrer"
              >
                Terminal
              </a>
            </Button>
            {isAdminUser(user.email) ? (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
              >
                <Link to="/admin">Admin overview</Link>
              </Button>
            ) : null}
            <Button
              variant="destructive"
              onClick={handleResetAll}
              className="w-full rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-500 md:w-auto"
            >
              Reset all
            </Button>
            <Button
              variant="outline"
              onClick={signOut}
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
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

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-2 text-sm text-slate-400">Worker name</div>
              <input
                className="mb-4 w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                onBlur={handleProfileBlur}
                placeholder="Enter your worker name"
              />
              <div className="mb-2 text-sm text-slate-400">Start balance</div>
              <input
                className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                value={startBalance}
                onChange={(event) => setStartBalance(Number(event.target.value) || 0)}
                onBlur={handleProfileBlur}
                placeholder="Start balance"
              />
              <div className="mt-2 text-xs text-slate-500">
                {isSavingProfile ? "Saving..." : "Saved per worker account."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-3 text-sm text-slate-400">Quick size guide from current balance</div>
              <div className="grid grid-cols-3 gap-3">
                <QuickSizeCard label="12%" value={quickSizes[0]} />
                <QuickSizeCard label="15%" value={quickSizes[1]} />
                <QuickSizeCard label="20%" value={quickSizes[2]} />
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-[#020617] p-4">
                <div className="text-sm font-medium text-slate-300">Stop loss guide</div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <RiskGuideCard label="12% size" sizeValue={quickSizes[0]} />
                  <RiskGuideCard label="15% size" sizeValue={quickSizes[1]} />
                  <RiskGuideCard label="20% size" sizeValue={quickSizes[2]} />
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-800 bg-[#020617] p-4">
                <div className="text-sm font-medium text-slate-300">Market sessions</div>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <div>
                    <span className="text-slate-200">05:00 UTC - 11:00 UTC</span>: good market
                  </div>
                  <div>
                    <span className="text-slate-200">11:00 UTC - 14:00 UTC</span>: high volatility
                  </div>
                  <div>
                    <span className="text-slate-200">14:00 UTC - 00:00 UTC</span>: dead market
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200">
                  On FRS meeting days, do not trade from 11:00 UTC at all.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <SummaryCards
            balance={balance}
            startBalance={startBalance}
            totalPnL={totalPnL}
            dailyPnL={dailyPnL}
            tradesCount={trades.length}
            streak={streak}
            streakLabel={streakLabel}
            winRate={winRate}
            wins={wins}
          />
        </div>

        <div className="mb-8">
          <Suspense fallback={<ChartFallback />}>
            <BalanceChart data={equityData} />
          </Suspense>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <TradeForm
            onSubmit={handleAddTrade}
            currentBalance={balance}
            requireDangerConfirm={showBreakWarning}
          />
          <TradeHistory
            trades={trades}
            onDelete={handleDeleteTrade}
            onUpdateNote={handleUpdateTradeNote}
          />
        </div>
      </div>
    </div>
  )
}

function QuickSizeCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 font-semibold text-slate-100">${value.toFixed(2)}</div>
    </div>
  )
}

function RiskGuideCard({ label, sizeValue }) {
  const stopLoss = sizeValue * 0.25

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">${stopLoss.toFixed(2)}</div>
      <div className="mt-1 text-xs text-slate-500">stop loss 25% of size</div>
    </div>
  )
}

function ChartFallback() {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
      <CardContent className="flex h-72 items-center justify-center px-5 py-5 text-slate-400 md:px-6 md:py-6">
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
