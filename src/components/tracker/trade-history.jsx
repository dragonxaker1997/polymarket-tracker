import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatDateKey,
  getAtrTone,
  getEntryTone,
  getRsiTone,
  getTimeTone,
} from "@/lib/trade-utils"

export function TradeHistory({ trades, onDelete, onUpdateNote }) {
  const [expandedTradeId, setExpandedTradeId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [page, setPage] = useState(1)

  const paginatedTrades = useMemo(() => trades.slice(0, 50), [trades])
  const totalPages = Math.max(1, Math.ceil(paginatedTrades.length / 5))
  const currentPage = Math.min(page, totalPages)
  const visibleTrades = useMemo(() => {
    const start = (currentPage - 1) * 5
    return paginatedTrades.slice(start, start + 5)
  }, [currentPage, paginatedTrades])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  function toggleNote(trade) {
    setExpandedTradeId((current) => (current === trade.id ? null : trade.id))
    setNoteDrafts((current) => ({
      ...current,
      [trade.id]: current[trade.id] ?? trade.note ?? "",
    }))
  }

  async function handleSaveNote(trade) {
    setIsSavingNote(true)

    try {
      const savedNote = (noteDrafts[trade.id] ?? "").trim()
      await onUpdateNote(trade, savedNote)
      setNoteDrafts((current) => ({
        ...current,
        [trade.id]: savedNote,
      }))
      setExpandedTradeId(null)
    } finally {
      setIsSavingNote(false)
    }
  }

  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 xl:col-span-2">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Trade History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <div className="space-y-3">
          {trades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              No trade history yet
            </div>
          ) : (
            visibleTrades.map((trade) => {
              const tradeDate = trade.createdAt ? formatDateKey(new Date(trade.createdAt)) : ""
              const visibleNote = noteDrafts[trade.id] ?? trade.note ?? ""
              const isTradeRecord = trade.recordType === "trade"
              const isWithdrawal = trade.recordType === "withdrawal"
              const isAdjustment = trade.recordType === "adjustment"
              const isDeposit = trade.recordType === "deposit"
              const isFees = trade.recordType === "fees"
              const title = isWithdrawal
                ? "WITHDRAWAL"
                : isAdjustment
                  ? "ADJUSTMENT"
                  : isDeposit
                    ? "DEPOSIT"
                    : isFees
                      ? "FEES"
                      : trade.result === "win"
                        ? "WIN"
                        : "LOSS"
              const amountText = isTradeRecord
                ? `size $${Number(trade.size).toFixed(2)}`
                : `amount $${Number(trade.amount || 0).toFixed(2)}`
              const impactValue = isTradeRecord
                ? Number(trade.pnl)
                : isDeposit
                  ? Number(trade.amount || 0)
                  : isWithdrawal || isFees
                    ? -Math.abs(Number(trade.amount || 0))
                    : Number(trade.balanceImpact ?? trade.pnl ?? 0)
              const impactLabel = `${impactValue >= 0 ? "+" : "-"}$${Math.abs(impactValue).toFixed(2)}`

              return (
                <article key={trade.id} className="rounded-xl border border-slate-800 bg-[#020617] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{title}</span>
                        <span className="text-sm text-slate-400">
                          {amountText}
                        </span>
                        {isTradeRecord ? (
                          <span className="text-sm text-slate-400">
                            shares {Number(trade.shares || 0).toFixed(2)}
                          </span>
                        ) : null}
                        {tradeDate ? <PlainBadge label={tradeDate} /> : null}
                      </div>

                      {isWithdrawal ? (
                        <div className="text-sm text-slate-300 md:text-base">
                          Withdrawal from balance history
                        </div>
                      ) : isAdjustment ? (
                        <div className="text-sm text-slate-300 md:text-base">
                          Manual balance adjustment
                        </div>
                      ) : isDeposit ? (
                        <div className="text-sm text-slate-300 md:text-base">
                          Deposit added to balance history
                        </div>
                      ) : isFees ? (
                        <div className="text-sm text-slate-300 md:text-base">
                          Fee expense recorded as PnL impact
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-slate-300 md:text-base">
                            Entry <span className={getValueClassName(getEntryTone(trade.entry))}>{(Number(trade.entry) * 100).toFixed(0)}¢</span> to Exit{" "}
                            <span className="text-white">{(Number(trade.exit) * 100).toFixed(0)}¢</span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <MetricBadge label="ATR" value={trade.atr} tone={getAtrTone(trade.atr)} />
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
                          </div>
                        </>
                      )}

                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={() => toggleNote(trade)}
                          className="rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                        >
                          {visibleNote ? "Edit comment" : "Add comment"}
                        </Button>
                      </div>

                      {visibleNote && expandedTradeId !== trade.id ? (
                        <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                          {visibleNote}
                        </div>
                      ) : null}

                      {expandedTradeId === trade.id ? (
                        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <textarea
                            value={noteDrafts[trade.id] ?? ""}
                            onChange={(event) =>
                              setNoteDrafts((current) => ({
                                ...current,
                                [trade.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-800 bg-[#020617] px-3 py-2 text-sm text-white outline-none"
                            placeholder="Comment about this trade"
                          />
                          <div className="mt-3 flex gap-2">
                            <Button
                              onClick={() => handleSaveNote(trade)}
                              disabled={isSavingNote}
                              className="rounded-lg bg-green-600 text-white hover:bg-green-500"
                            >
                              Save comment
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setExpandedTradeId(null)}
                              className="rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div
                          className={`text-xl font-bold ${
                            isWithdrawal || isFees
                              ? "text-red-400"
                              : impactValue >= 0
                                ? "text-green-400"
                                : "text-red-400"
                          }`}
                        >
                          {impactLabel}
                        </div>
                        {isTradeRecord ? (
                          <div className="mt-1 text-xs text-slate-400">
                            total ${Number(trade.totalExitValue || 0).toFixed(2)}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => onDelete(trade)}
                        className="rounded-lg border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>

        {trades.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
              {trades.length > 50 ? " · showing first 50 trades only" : ""}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
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

function getToneClassName(tone) {
  if (tone === "green") return "border-green-500/30 bg-green-500/10 text-green-300"
  if (tone === "yellow") return "border-amber-500/30 bg-amber-500/10 text-amber-300"

  return "border-red-500/30 bg-red-500/10 text-red-300"
}

function getValueClassName(tone) {
  if (tone === "green") return "text-green-400"
  if (tone === "yellow") return "text-amber-300"

  return "text-red-400"
}
