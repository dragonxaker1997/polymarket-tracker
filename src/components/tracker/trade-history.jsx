import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  formatDateKey,
  getAtrTone,
  getEntryTone,
  getRsiTone,
  getTimeTone,
  isSameDay,
  isWithinDateRange,
} from "@/lib/trade-utils"

export function TradeHistory({ trades, onDelete, onUpdateNote }) {
  const [selectedDate, setSelectedDate] = useState("")
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [expandedTradeId, setExpandedTradeId] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({})
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [page, setPage] = useState(1)

  const filteredTrades = useMemo(() => {
    if (!selectedDate) return trades

    return trades.filter((trade) => isSameDay(trade.createdAt, selectedDate))
  }, [selectedDate, trades])
  const paginatedTrades = useMemo(() => filteredTrades.slice(0, 50), [filteredTrades])
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

  async function handleSaveNote(tradeId) {
    setIsSavingNote(true)

    try {
      const savedNote = (noteDrafts[tradeId] ?? "").trim()
      await onUpdateNote(tradeId, savedNote)
      setNoteDrafts((current) => ({
        ...current,
        [tradeId]: savedNote,
      }))
      setExpandedTradeId(null)
    } finally {
      setIsSavingNote(false)
    }
  }

  function handleExportCsv() {
    const exportTrades = trades.filter((trade) => isWithinDateRange(trade.createdAt, exportFrom, exportTo))

    const rows = [
      [
        "created_at",
        "size",
        "entry_cents",
        "exit_cents",
        "pnl",
        "time",
        "atr",
        "rsi",
        "macd",
        "vwap",
        "result",
        "note",
      ],
      ...exportTrades.map((trade) => [
        trade.createdAt ?? "",
        trade.size,
        (Number(trade.entry) * 100).toFixed(0),
        (Number(trade.exit) * 100).toFixed(0),
        Number(trade.pnl).toFixed(2),
        trade.time ?? "",
        trade.atr ?? "",
        trade.rsi ?? "",
        trade.macd ?? "",
        trade.vwap ?? "",
        trade.result,
        trade.note ?? "",
      ]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `trades-${exportFrom || "all"}-${exportTo || "all"}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 xl:col-span-2">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Trade History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#020617] p-4">
            <div className="mb-3 text-sm text-slate-400">Filter by date</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value)
                  setPage(1)
                }}
                className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDate("")
                  setPage(1)
                }}
                className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#020617] p-4">
            <div className="mb-3 text-sm text-slate-400">Export CSV by period</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                type="date"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
                className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
              />
              <Input
                type="date"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
                className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
              />
              <Button
                onClick={handleExportCsv}
                className="rounded-xl bg-slate-100 text-slate-950 hover:bg-white"
              >
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredTrades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">
              No trades for the selected period
            </div>
          ) : (
            visibleTrades.map((trade) => {
              const tradeDate = trade.createdAt ? formatDateKey(new Date(trade.createdAt)) : ""
              const visibleNote = noteDrafts[trade.id] ?? trade.note ?? ""

              return (
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
                        {tradeDate ? <PlainBadge label={tradeDate} /> : null}
                      </div>

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
                        {trade.vwap ? <PlainBadge label={`VWAP: ${trade.vwap}`} /> : null}
                      </div>

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
                              onClick={() => handleSaveNote(trade.id)}
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
              )
            })
          )}
        </div>

        {filteredTrades.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
              {filteredTrades.length > 50 ? " · showing first 50 trades only" : ""}
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
