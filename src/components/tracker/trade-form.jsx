import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getTradePreview, getTradeRiskState } from "@/lib/trade-utils"

const EMPTY_FORM = {
  size: "",
  entry: "",
  exit: "",
  time: "",
  atr: "",
  rsi: "",
  macd: "",
}

const FIELDS = [
  ["size", "Size $"],
  ["time", "Time"],
  ["entry", "Entry price"],
  ["exit", "Exit price"],
  ["atr", "ATR"],
  ["rsi", "RSI"],
  ["macd", "MACD"],
]

const CHECKLIST_ROWS = [
  ["RSI", "> 55", "< 45"],
  ["MACD", "Histogram green", "Histogram red"],
  ["EMA", "EMA 9 > EMA 21", "EMA 9 < EMA 21"],
  ["HL10", "Break HL10 High", "Break HL10 Low"],
]

export function TradeForm({
  onSubmit,
  onAddWithdrawal,
  onAddAdjustment,
  currentBalance,
  requireDangerConfirm,
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [withdrawalAmount, setWithdrawalAmount] = useState("")
  const [withdrawalNote, setWithdrawalNote] = useState("")
  const [adjustmentAmount, setAdjustmentAmount] = useState("")
  const [adjustmentNote, setAdjustmentNote] = useState("")

  const preview = useMemo(
    () => getTradePreview(form.size, form.entry, form.exit),
    [form.entry, form.exit, form.size]
  )
  const riskState = useMemo(
    () => getTradeRiskState(form, currentBalance),
    [currentBalance, form]
  )

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit() {
    if (requireDangerConfirm) {
      const confirmed = window.confirm(
        "Loss streak is already 5 or more. Confirm this risky trade before continuing."
      )

      if (!confirmed) return
    }

    const created = onSubmit(form)

    if (await created) {
      setForm(EMPTY_FORM)
    }
  }

  async function handleAddWithdrawal() {
    const created = await onAddWithdrawal(withdrawalAmount, withdrawalNote)

    if (created) {
      setWithdrawalAmount("")
      setWithdrawalNote("")
    }
  }

  async function handleAddAdjustment() {
    const created = await onAddAdjustment(adjustmentAmount, adjustmentNote)

    if (created) {
      setAdjustmentAmount("")
      setAdjustmentNote("")
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

        {riskState.showSizeWarning ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Recommended trade size exceeded. Use one of the standard sizes: 12%, 15%, or 20% of current balance.
          </div>
        ) : null}

        {riskState.showRektRisk ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-200">
            REKT RISK: two or more key signals are red.
          </div>
        ) : null}

        <Button onClick={handleSubmit} className="mt-4 h-11 w-full rounded-xl bg-green-600 text-white hover:bg-green-500">
          Add trade
        </Button>

        <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4">
          <div className="mb-3 text-sm font-medium text-slate-300">Add withdrawal</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Withdrawal amount $"
              value={withdrawalAmount}
              onChange={(event) => setWithdrawalAmount(event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
            <Input
              placeholder="Withdrawal note"
              value={withdrawalNote}
              onChange={(event) => setWithdrawalNote(event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
          </div>
          <Button
            onClick={handleAddWithdrawal}
            className="mt-3 h-11 w-full rounded-xl bg-slate-100 text-slate-950 hover:bg-white"
          >
            Add withdrawal
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4">
          <div className="mb-2 text-sm font-medium text-slate-300">Balance adjustment</div>
          <div className="mb-3 text-xs text-slate-500">
            Use negative value for hidden fee, positive value for manual correction.
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Adjustment amount $"
              value={adjustmentAmount}
              onChange={(event) => setAdjustmentAmount(event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
            <Input
              placeholder="Adjustment note"
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
          </div>
          <Button
            onClick={handleAddAdjustment}
            className="mt-3 h-11 w-full rounded-xl bg-amber-200 text-slate-950 hover:bg-amber-100"
          >
            Add adjustment
          </Button>
        </div>

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
