import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  BALANCE_EVENT_TYPES,
  formatPreviewCurrency,
  getTradePreview,
  getTradeRiskState,
  validateTradeForm,
} from "@/lib/trade-utils"

const EMPTY_FORM = {
  size: "",
  entry: "",
  exit: "",
  time: "",
  atr: "",
  rsi: "",
  macd: "",
}

const MAIN_FIELDS = [
  ["size", "Size $"],
  ["entry", "Entry (¢)"],
  ["exit", "Exit (¢)"],
]

const ADVANCED_FIELDS = [
  ["time", "Time (15m minute)"],
  ["atr", "ATR"],
  ["rsi", "RSI"],
  ["macd", "MACD"],
]

export function TradeForm({
  onSubmit,
  onAddBalanceEvent,
  currentBalance,
  cooldown,
  tradeUsage,
  tradeLimit,
  trialLimitReached,
  requireDangerConfirm,
  onUpgrade,
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [touchedFields, setTouchedFields] = useState({})
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [balanceEventType, setBalanceEventType] = useState(BALANCE_EVENT_TYPES.DEPOSIT)
  const [balanceEventAmount, setBalanceEventAmount] = useState("")
  const [balanceEventNote, setBalanceEventNote] = useState("")
  const [balanceEventError, setBalanceEventError] = useState("")

  const preview = useMemo(
    () => getTradePreview(form.size, form.entry, form.exit),
    [form.entry, form.exit, form.size]
  )
  const validation = useMemo(() => validateTradeForm(form), [form])
  const riskState = useMemo(
    () => getTradeRiskState(form, currentBalance),
    [currentBalance, form]
  )

  const previewPnlTone =
    preview.isValid && Number.isFinite(preview.previewPnl)
      ? preview.previewPnl >= 0
        ? "text-green-400"
        : "text-red-400"
      : "text-slate-400"

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function markFieldTouched(name) {
    setTouchedFields((current) => ({
      ...current,
      [name]: true,
    }))
  }

  function getFieldError(name) {
    if (!touchedFields[name]) return ""

    return validation.errors[name]
  }

  async function handleSubmit(event) {
    event?.preventDefault()

    if (cooldown?.isActive || trialLimitReached) return

    if (!validation.isValid) {
      setTouchedFields({
        size: true,
        entry: true,
        exit: true,
      })
      return
    }

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

  async function handleAddBalanceEvent() {
    if (cooldown?.isActive) return
    const numericAmount = Number(balanceEventAmount)

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setBalanceEventError("Enter a positive amount greater than $0.")
      return
    }

    const created = await onAddBalanceEvent(balanceEventType, balanceEventAmount, balanceEventNote)

    if (created) {
      setBalanceEventAmount("")
      setBalanceEventNote("")
      setBalanceEventError("")
    } else {
      setBalanceEventError("Failed to add balance event.")
    }
  }

  const balanceEventHelperText =
    balanceEventType === BALANCE_EVENT_TYPES.DEPOSIT
      ? "Positive amount. Increases balance without affecting PnL metrics."
      : balanceEventType === BALANCE_EVENT_TYPES.WITHDRAWAL
        ? "Amount will be stored as negative balance impact."
        : "Fee will reduce both balance and PnL."

  return (
    <Card className="relative overflow-hidden border-slate-800 bg-[#0f172a] py-0 text-white ring-0 xl:col-span-1">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Add Trade</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MAIN_FIELDS.map(([name, placeholder]) => (
              <div key={name} className="min-w-0">
                <Input
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={(event) => updateField(name, event.target.value)}
                  onBlur={() => markFieldTouched(name)}
                  inputMode={name === "size" ? "decimal" : "numeric"}
                  aria-invalid={getFieldError(name) ? "true" : "false"}
                  className={`h-11 rounded-xl bg-[#020617] px-3 py-2.5 text-white placeholder:text-slate-500 ${
                    getFieldError(name)
                      ? "border-red-500/70 focus-visible:ring-red-500/60"
                      : "border-slate-800"
                  }`}
                />
                {getFieldError(name) ? (
                  <div className="mt-1 text-xs text-red-300">{getFieldError(name)}</div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Enter price in cents, e.g. 66 = $0.66
          </div>

          {preview.isValid ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] px-3 py-2 text-sm">
              <span className="text-slate-400">Expected PnL:</span>{" "}
              <span className={`font-semibold ${previewPnlTone}`}>
                {preview.previewPnl >= 0 ? "+" : ""}
                {formatPreviewCurrency(preview.previewPnl)}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsAdvancedOpen((current) => !current)}
            className="mt-4 text-sm font-medium text-slate-300 transition hover:text-white"
          >
            {isAdvancedOpen ? "Hide advanced ▲" : "Show advanced ▼"}
          </button>

          {isAdvancedOpen ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-[#08112a] p-4">
              <div className="mb-3 text-sm font-medium text-slate-300">Advanced</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {ADVANCED_FIELDS.map(([name, placeholder]) => (
                  <Input
                    key={name}
                    placeholder={placeholder}
                    value={form[name]}
                    onChange={(event) => updateField(name, event.target.value)}
                    className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 py-2.5 text-white placeholder:text-slate-500"
                  />
                ))}
              </div>
            </div>
          ) : null}

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

          {tradeLimit ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] px-4 py-3 text-sm">
              <div className="text-slate-400">Trade usage</div>
              <div className="mt-1 font-semibold text-white">
                {tradeUsage} / {tradeLimit} trades
              </div>
            </div>
          ) : null}

          {trialLimitReached ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <div className="font-medium text-white">
                You reached the free limit ({tradeLimit} trades). Upgrade to continue.
              </div>
              <Button
                type="button"
                onClick={onUpgrade}
                className="mt-3 h-10 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100"
              >
                Upgrade
              </Button>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={trialLimitReached || !validation.isValid}
            className="mt-4 h-11 w-full rounded-xl bg-green-600 text-white hover:bg-green-500"
          >
            Add trade
          </Button>
        </form>

        <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4">
          <div className="mb-2 text-sm font-medium text-slate-300">Balance event</div>
          <div className="mb-3 text-xs text-slate-500">{balanceEventHelperText}</div>
          <div className="grid grid-cols-1 gap-3">
            <select
              value={balanceEventType}
              onChange={(event) => setBalanceEventType(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-white outline-none focus:border-slate-600"
            >
              <option value={BALANCE_EVENT_TYPES.DEPOSIT}>Deposit</option>
              <option value={BALANCE_EVENT_TYPES.WITHDRAWAL}>Withdrawal</option>
              <option value={BALANCE_EVENT_TYPES.FEES}>Fees</option>
            </select>
            <Input
              placeholder="Amount $"
              value={balanceEventAmount}
              inputMode="decimal"
              onChange={(event) => {
                setBalanceEventAmount(event.target.value)
                setBalanceEventError("")
              }}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
            <Input
              placeholder="Note"
              value={balanceEventNote}
              onChange={(event) => setBalanceEventNote(event.target.value)}
              className="h-11 rounded-xl border-slate-800 bg-slate-950 px-3 text-white placeholder:text-slate-500"
            />
          </div>
          {balanceEventError ? (
            <div className="mt-2 text-xs text-red-300">{balanceEventError}</div>
          ) : null}
          <Button
            onClick={handleAddBalanceEvent}
            className="mt-3 h-11 w-full rounded-xl bg-slate-100 text-slate-950 hover:bg-white"
          >
            Add event
          </Button>
        </div>

      </CardContent>

      {cooldown?.isActive ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#020617]/88 px-6 text-center backdrop-blur-[2px]">
          <div className="max-w-sm rounded-2xl border border-slate-700 bg-slate-950/95 p-6 shadow-2xl">
            <div className="text-xl font-semibold text-white">
              Нужно зачильться на этом кошельке и отдохнуть
            </div>
            <div className="mt-3 text-sm text-amber-300">{cooldown.reasonLabel}</div>
            <div className="mt-4 text-4xl font-bold tracking-[0.08em] text-white">
              {cooldown.remainingLabel}
            </div>
            <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              Cooldown
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
