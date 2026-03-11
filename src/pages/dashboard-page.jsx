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
  saveStartBalance,
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
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isSavingBalance, setIsSavingBalance] = useState(false)
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

  const { totalPnL, balance, wins, winRate, streak, streakLabel, quickSizes } = useMemo(
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

  async function handleStartBalanceBlur() {
    try {
      setIsSavingBalance(true)
      setError("")
      await saveStartBalance(user.id, startBalance)
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save start balance.")
    } finally {
      setIsSavingBalance(false)
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
            <div className="mt-2 text-sm text-slate-400">{user.email}</div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
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

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-2 text-sm text-slate-400">Start balance</div>
              <input
                className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                value={startBalance}
                onChange={(event) => setStartBalance(Number(event.target.value) || 0)}
                onBlur={handleStartBalanceBlur}
                placeholder="Start balance"
              />
              <div className="mt-2 text-xs text-slate-500">
                {isSavingBalance ? "Saving..." : "Saved per worker account."}
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
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <SummaryCards
            balance={balance}
            startBalance={startBalance}
            totalPnL={totalPnL}
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
          <TradeForm onSubmit={handleAddTrade} />
          <TradeHistory trades={trades} onDelete={handleDeleteTrade} />
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
