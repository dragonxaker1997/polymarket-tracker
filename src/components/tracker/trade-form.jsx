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
          <div>Polymarket logic: Shares = Size / Entry</div>
          <div className="mt-2 text-slate-400">Total Exit Value = Shares × Exit</div>
          <div className="mt-2 text-slate-400">PnL = Total Exit Value − Size</div>
          <div className="mt-2 text-slate-400">
            Можно вводить цену как 0.66 / 0.96 или как 66 / 96, сайт воспримет это как центы.
          </div>
          <div className="mt-2 text-slate-400">
            Для полного лося можно ставить `Exit price = 0`.
          </div>
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
      </CardContent>
    </Card>
  )
}
