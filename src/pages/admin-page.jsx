import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { loadWorkerSummaries } from "@/lib/trade-service"
import { useAuth } from "@/providers/use-auth"

export function AdminPage() {
  const { user, signOut } = useAuth()
  const [workers, setWorkers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setIsLoading(true)
      setError("")

      try {
        const summaries = await loadWorkerSummaries()

        if (!active) return
        setWorkers(summaries)
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
  }, [])

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

        <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
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
                        <td className="px-6 py-4 font-medium text-white">{worker.email}</td>
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
      </div>
    </div>
  )
}
