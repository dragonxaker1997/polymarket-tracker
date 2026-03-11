import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function TradeHistory({ trades, onDelete }) {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 xl:col-span-2">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Trade History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pt-4 pb-5 md:px-6 md:pb-6">
        {trades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
            No trades yet
          </div>
        ) : (
          trades.map((trade) => (
            <article key={trade.id} className="rounded-xl border border-slate-800 bg-[#020617] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">
                      {trade.result === "win" ? "WIN" : "LOSS"}
                    </span>
                    <span className="text-sm text-slate-400">size ${Number(trade.size).toFixed(2)}</span>
                    <span className="text-sm text-slate-400">
                      shares {Number(trade.shares || 0).toFixed(2)}
                    </span>
                    {trade.time ? <PlainBadge label={`Time: ${trade.time}`} /> : null}
                  </div>

                  <div className="text-sm text-slate-300 md:text-base">
                    Entry <span className="text-white">{(Number(trade.entry) * 100).toFixed(0)}¢</span> to Exit{" "}
                    <span className="text-white">{(Number(trade.exit) * 100).toFixed(0)}¢</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <MetricBadge label="ATR" value={trade.atr} tone={Number(trade.atr) >= 40 ? "green" : "red"} />
                    <MetricBadge label="Time" value={trade.time} tone={getTimeTone(trade.time)} />
                    <MetricBadge
                      label="Entry"
                      value={`${(Number(trade.entry) * 100).toFixed(0)}¢`}
                      tone={getEntryTone(trade.entry)}
                    />
                    {trade.rsi ? (
                      <MetricBadge label="RSI" value={trade.rsi} tone={getRsiTone(trade.rsi)} />
                    ) : null}
                    {trade.macd ? <PlainBadge label={`MACD: ${trade.macd}`} /> : null}
                    {trade.vwap ? <PlainBadge label={`VWAP: ${trade.vwap}`} /> : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`text-xl font-bold ${
                        trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {trade.pnl >= 0 ? "+" : ""}${Number(trade.pnl).toFixed(2)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      total ${Number(trade.totalExitValue || 0).toFixed(2)}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => onDelete(trade.id)}
                    className="rounded-lg border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function PlainBadge({ label }) {
  return (
    <Badge variant="outline" className="rounded-full border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
      {label}
    </Badge>
  )
}

function MetricBadge({ label, value, tone = "red" }) {
  return (
    <Badge
      variant="outline"
      className={`rounded-full px-3 py-1 text-xs ${getToneClassName(tone)}`}
    >
      {label}: {value}
    </Badge>
  )
}

function getEntryTone(value) {
  const cents = Number(value) * 100

  if (!Number.isFinite(cents)) return "red"

  return cents >= 60 && cents <= 72 ? "green" : "red"
}

function getTimeTone(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return "red"
  if (numericValue >= 5 && numericValue <= 10) return "green"
  if (numericValue >= 11 && numericValue <= 15) return "yellow"
  if (numericValue >= 1 && numericValue < 5) return "red"

  return "red"
}

function getRsiTone(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return "red"

  return numericValue >= 40 && numericValue <= 60 ? "green" : "red"
}

function getToneClassName(tone) {
  if (tone === "green") return "border-green-500/30 bg-green-500/10 text-green-300"
  if (tone === "yellow") return "border-amber-500/30 bg-amber-500/10 text-amber-300"

  return "border-red-500/30 bg-red-500/10 text-red-300"
}
