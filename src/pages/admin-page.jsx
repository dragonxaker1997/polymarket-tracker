import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { loadTeamDailyPnl, loadWorkerSummaries } from "@/lib/trade-service"
import { useAuth } from "@/providers/use-auth"

export function AdminPage() {
  const { user, signOut } = useAuth()
  const [workers, setWorkers] = useState([])
  const [calendarItems, setCalendarItems] = useState([])
  const [month, setMonth] = useState(getCurrentMonthValue())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setIsLoading(true)
      setError("")

      const { dateFrom, dateTo } = getMonthRange(month)

      try {
        const [summaries, dailyItems] = await Promise.all([
          loadWorkerSummaries(),
          loadTeamDailyPnl(dateFrom, dateTo),
        ])

        if (!active) return
        setWorkers(summaries)
        setCalendarItems(dailyItems)
      } catch (nextError) {
        if (!active) return
        setError(nextError.message ?? "Failed to load worker results.")
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [month])

  const teamTotalPnl = useMemo(
    () => workers.reduce((sum, worker) => sum + worker.total_pnl, 0),
    [workers]
  )
  const calendarDays = useMemo(() => buildCalendarDays(month, calendarItems), [calendarItems, month])

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Polymarket journal</div>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Admin Overview</h1>
            <div className="mt-2 text-sm text-slate-400">{user.email}</div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Link to="/">Back to dashboard</Link>
            </Button>
            <Button
              variant="outline"
              onClick={signOut}
              className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
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

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-sm font-normal text-slate-400">Team Total PnL</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pt-2 pb-5">
              <div className={`text-3xl font-bold ${teamTotalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {teamTotalPnl >= 0 ? "+" : ""}${teamTotalPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 lg:col-span-2">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-2 text-sm text-slate-400">Calendar month</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                  className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                >
                  Prev month
                </Button>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                />
                <Button
                  variant="outline"
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                  className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                >
                  Next month
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Worker Results</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pt-4 pb-2 md:pb-4">
            {isLoading ? (
              <div className="px-6 pb-6 text-slate-400">Loading worker results...</div>
            ) : workers.length === 0 ? (
              <div className="px-6 pb-6 text-slate-400">No workers found yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Worker</th>
                      <th className="px-6 py-3 font-medium">Start Balance</th>
                      <th className="px-6 py-3 font-medium">Total PnL</th>
                      <th className="px-6 py-3 font-medium">Streak</th>
                      <th className="px-6 py-3 font-medium">Win Rate</th>
                      <th className="px-6 py-3 font-medium">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => (
                      <tr key={worker.user_id} className="border-b border-slate-900/80">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">
                            {worker.display_name || worker.email}
                          </div>
                          {worker.display_name ? (
                            <div className="mt-1 text-xs text-slate-500">{worker.email}</div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-slate-300">${worker.start_balance.toFixed(2)}</td>
                        <td
                          className={`px-6 py-4 font-medium ${
                            worker.total_pnl >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {worker.total_pnl >= 0 ? "+" : ""}${worker.total_pnl.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {worker.streak_count}
                          {worker.streak_label}
                        </td>
                        <td className="px-6 py-4 text-slate-300">{worker.win_rate.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-slate-300">{worker.trades_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Team Daily PnL Calendar</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
              {calendarDays.map((day) => (
                <div key={day.date} className="rounded-xl border border-slate-800 bg-[#020617] p-3">
                  <div className="mb-3 text-sm font-semibold text-white">{day.label}</div>
                  <div className="space-y-2">
                    {day.items.length === 0 ? (
                      <div className="text-xs text-slate-500">No activity</div>
                    ) : (
                      day.items.map((item) => (
                        <div key={`${day.date}-${item.user_id}`} className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                          <div className="truncate text-xs text-slate-200">
                            {item.display_name || item.email}
                          </div>
                          <div className={`mt-1 text-xs font-semibold ${item.daily_pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {item.daily_pnl >= 0 ? "+" : ""}${item.daily_pnl.toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  return {
    dateFrom: formatDate(start),
    dateTo: formatDate(end),
  }
}

function buildCalendarDays(monthValue, items) {
  const [year, month] = monthValue.split("-").map(Number)
  const totalDays = new Date(year, month, 0).getDate()

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const date = formatDate(new Date(year, month - 1, day))

    return {
      date,
      label: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`,
      items: items.filter((item) => item.trade_date === date),
    }
  })
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

function shiftMonth(monthValue, offset) {
  const [year, month] = monthValue.split("-").map(Number)
  const date = new Date(year, month - 1 + offset, 1)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}
