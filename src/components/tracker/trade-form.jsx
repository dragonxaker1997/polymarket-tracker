import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getTradePreview } from "@/lib/trade-utils"

const EMPTY_FORM = {
  size: "",
  entry: "",
  exit: "",
  time: "",
  atr: "",
  rsi: "",
  macd: "",
  vwap: "",
}

const FIELDS = [
  ["size", "Size $"],
  ["time", "Time"],
  ["entry", "Entry price"],
  ["exit", "Exit price"],
  ["atr", "ATR"],
  ["rsi", "RSI"],
  ["macd", "MACD"],
  ["vwap", "VWAP"],
]

const CHECKLIST_ROWS = [
  ["RSI", "> 55", "< 45"],
  ["MACD", "Histogram green", "Histogram red"],
  ["VWAP", "BTC above VWAP", "BTC below VWAP"],
  ["EMA", "EMA 9 > EMA 21", "EMA 9 < EMA 21"],
  ["HL10", "Break HL10 High", "Break HL10 Low"],
]

export function TradeForm({ onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)

  const preview = useMemo(
    () => getTradePreview(form.size, form.entry, form.exit),
    [form.entry, form.exit, form.size]
  )

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function handleSubmit() {
    const created = onSubmit(form)

    if (created) {
      setForm(EMPTY_FORM)
    }
  }

  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 xl:col-span-1">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Add Trade</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map(([name, placeholder]) => (
            <Input
              key={name}
              placeholder={placeholder}
              value={form[name]}
              onChange={(event) => updateField(name, event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 py-2.5 text-white placeholder:text-slate-500"
            />
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4 text-sm text-slate-300">
          <div className="mt-3 text-slate-300">Preview Shares: {preview.previewShares.toFixed(2)}</div>
          <div className="mt-1 text-slate-300">
            Preview Total: ${preview.previewTotalExitValue.toFixed(2)}
          </div>
          <div
            className={`mt-2 font-semibold ${
              preview.previewPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            Preview PnL: {preview.previewPnl >= 0 ? "+" : ""}${preview.previewPnl.toFixed(2)}
          </div>
        </div>

        <Button onClick={handleSubmit} className="mt-4 h-11 w-full rounded-xl bg-green-600 text-white hover:bg-green-500">
          Add trade
        </Button>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-[#08112a]">
          <div className="border-b border-slate-800 bg-[linear-gradient(135deg,#45308c,#5a3ca0)] px-4 py-3 text-lg font-semibold text-white">
            30-second checklist before entry
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="border-b border-slate-800 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Indicator</th>
                  <th className="px-4 py-3 font-medium">UP Signal</th>
                  <th className="px-4 py-3 font-medium">DOWN Signal</th>
                </tr>
              </thead>
              <tbody>
                {CHECKLIST_ROWS.map(([indicator, upSignal, downSignal]) => (
                  <tr key={indicator} className="border-b border-slate-900/80">
                    <td className="px-4 py-3 font-medium text-white">{indicator}</td>
                    <td className="px-4 py-3">{upSignal}</td>
                    <td className="px-4 py-3">{downSignal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
