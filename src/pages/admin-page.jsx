import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { loadTeamDailyPnl, loadWorkerSummaries } from "@/lib/trade-service"
import { useAuth } from "@/providers/use-auth"

export function AdminPage() {
  const { user, signOut } = useAuth()
  const [accountSummaries, setAccountSummaries] = useState([])
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
        setAccountSummaries(summaries)
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

  const visibleAccountSummaries = useMemo(
    () => accountSummaries.filter((account) => isVisibleAdminAccount(account)),
    [accountSummaries]
  )
  const visibleCalendarItems = useMemo(
    () => calendarItems.filter((item) => isVisibleAdminAccount(item)),
    [calendarItems]
  )
  const workers = useMemo(() => {
    if (visibleAccountSummaries.length > 0) {
      return buildWorkerRows(visibleAccountSummaries)
    }

    return buildWorkerRowsFromCalendar(visibleCalendarItems)
  }, [visibleAccountSummaries, visibleCalendarItems])
  const teamTotalPnl = useMemo(
    () =>
      visibleAccountSummaries.length > 0
        ? workers.reduce((sum, worker) => sum + worker.total_pnl, 0)
        : visibleCalendarItems.reduce((sum, item) => sum + Number(item.daily_pnl ?? 0), 0),
    [visibleAccountSummaries, visibleCalendarItems, workers]
  )
  const calendarDays = useMemo(
    () => buildCalendarDays(month, visibleCalendarItems),
    [month, visibleCalendarItems]
  )

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
                          <div className="font-medium text-white">{worker.display_name || worker.email}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {worker.email}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                            {worker.accounts_count} accounts
                          </div>
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
                        <div key={`${day.date}-${item.user_id}-${item.account_id}`} className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                          <div className="truncate text-xs text-slate-200">
                            {item.account_name}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">
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

function buildWorkerRows(accountSummaries) {
  const workers = new Map()

  for (const account of accountSummaries) {
    const existing = workers.get(account.user_id) ?? {
      user_id: account.user_id,
      display_name: account.display_name ?? "",
      email: account.email ?? "",
      start_balance: 0,
      total_pnl: 0,
      trades_count: 0,
      accounts_count: 0,
      weighted_wins: 0,
      streak_count: 0,
      streak_label: "-",
    }

    existing.display_name = existing.display_name || account.display_name || ""
    existing.email = existing.email || account.email || ""
    existing.start_balance += Number(account.start_balance ?? 0)
    existing.total_pnl += Number(account.total_pnl ?? 0)
    existing.trades_count += Number(account.trades_count ?? 0)
    existing.accounts_count += 1
    existing.weighted_wins +=
      (Number(account.win_rate ?? 0) / 100) * Number(account.trades_count ?? 0)

    if (Number(account.streak_count ?? 0) > existing.streak_count) {
      existing.streak_count = Number(account.streak_count ?? 0)
      existing.streak_label = account.streak_label ?? "-"
    }

    workers.set(account.user_id, existing)
  }

  return Array.from(workers.values())
    .map((worker) => ({
      ...worker,
      win_rate:
        worker.trades_count > 0 ? (worker.weighted_wins / worker.trades_count) * 100 : 0,
    }))
    .sort((left, right) => {
      const leftName = (left.display_name || left.email || "").toLowerCase()
      const rightName = (right.display_name || right.email || "").toLowerCase()

      return leftName.localeCompare(rightName)
    })
}

function buildWorkerRowsFromCalendar(calendarItems) {
  const workers = new Map()

  for (const item of calendarItems) {
    const existing = workers.get(item.user_id) ?? {
      user_id: item.user_id,
      display_name: item.display_name ?? "",
      email: item.email ?? "",
      start_balance: 0,
      total_pnl: 0,
      trades_count: 0,
      accounts_count: 0,
      weighted_wins: 0,
      win_rate: 0,
      streak_count: 0,
      streak_label: "-",
      seenAccounts: new Set(),
    }

    existing.display_name = existing.display_name || item.display_name || ""
    existing.email = existing.email || item.email || ""
    existing.total_pnl += Number(item.daily_pnl ?? 0)

    if (item.account_id && !existing.seenAccounts.has(item.account_id)) {
      existing.seenAccounts.add(item.account_id)
      existing.accounts_count += 1
    }

    workers.set(item.user_id, existing)
  }

  return Array.from(workers.values())
    .map((worker) => {
      delete worker.seenAccounts
      return worker
    })
    .sort((left, right) => {
      const leftName = (left.display_name || left.email || "").toLowerCase()
      const rightName = (right.display_name || right.email || "").toLowerCase()

      return leftName.localeCompare(rightName)
    })
}

function isVisibleAdminAccount(record) {
  if (record.account_type) {
    return record.account_type !== "main"
  }

  return (record.account_name ?? "").trim().toLowerCase() !== "main account"
}
