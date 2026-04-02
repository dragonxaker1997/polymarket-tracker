export const DEFAULT_START_BALANCE = 47

export function normalizePrice(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return null

  const normalizedValue = numericValue > 1 ? numericValue / 100 : numericValue

  if (normalizedValue < 0 || normalizedValue > 1) return null

  return normalizedValue
}

export function createTrade(form) {
  const numericSize = Number(form.size)
  const entry = normalizePrice(form.entry)
  const exit = normalizePrice(form.exit)

  if (!Number.isFinite(numericSize) || numericSize <= 0) return null
  if (entry === null || exit === null) return null
  if (entry <= 0) return null

  const shares = numericSize / entry
  const totalExitValue = shares * exit
  const pnl = totalExitValue - numericSize

  return {
    id: Date.now(),
    recordType: "trade",
    size: numericSize,
    amount: numericSize,
    entry,
    exit,
    rawEntry: form.entry,
    rawExit: form.exit,
    shares,
    totalExitValue,
    pnl,
    time: form.time,
    atr: form.atr,
    rsi: form.rsi,
    macd: form.macd,
    note: form.note ?? "",
    result: pnl >= 0 ? "win" : "loss",
    balanceImpact: pnl,
  }
}

export function createWithdrawal(amount, note = "") {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null

  return {
    id: Date.now(),
    recordType: "withdrawal",
    amount: numericAmount,
    pnl: 0,
    balanceImpact: -numericAmount,
    note,
    result: "withdrawal",
  }
}

export function getTradePreview(size, entry, exit) {
  const previewSize = Number(size) || 0
  const previewEntry = normalizePrice(entry)
  const previewExit = normalizePrice(exit)
  const previewShares = previewEntry && previewEntry > 0 ? previewSize / previewEntry : 0
  const previewTotalExitValue = previewShares * (previewExit ?? 0)
  const previewPnl = previewTotalExitValue - previewSize

  return {
    previewShares,
    previewTotalExitValue,
    previewPnl,
  }
}

export function getTradeStats(trades, startBalance) {
  const tradeRecords = trades.filter((trade) => trade.recordType !== "withdrawal")
  const transactionsCount = tradeRecords.length * 2
  const volume = tradeRecords.reduce(
    (sum, trade) => sum + Number(trade.size ?? 0) + Number(trade.totalExitValue ?? 0),
    0
  )
  const totalPnL = tradeRecords.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)
  const totalBalanceImpact = trades.reduce(
    (sum, trade) => sum + Number(trade.balanceImpact ?? trade.pnl ?? 0),
    0
  )
  const balance = startBalance + totalBalanceImpact
  const wins = tradeRecords.filter((trade) => trade.result === "win").length
  const winRate = tradeRecords.length ? (wins / tradeRecords.length) * 100 : 0
  const dailyPnL = tradeRecords.reduce((sum, trade) => {
    if (!isTradeFromToday(trade.createdAt)) return sum

    return sum + (Number(trade.pnl) || 0)
  }, 0)

  let streak = 0
  let streakLabel = "-"

  if (tradeRecords.length) {
    const currentType = tradeRecords[0].result
    streakLabel = currentType === "win" ? "W" : "L"

    for (const trade of tradeRecords) {
      if (trade.result !== currentType) break
      streak += 1
    }
  }

  return {
    totalPnL,
    balance,
    wins,
    winRate,
    dailyPnL,
    tradeRecordsCount: tradeRecords.length,
    transactionsCount,
    volume,
    streak,
    streakLabel,
    showBreakWarning: streakLabel === "L" && streak >= 5,
    showDrawdownWarning: balance > 0 && totalPnL < 0 && Math.abs(totalPnL) >= balance * 0.2,
    quickSizes: [0.12, 0.15, 0.2].map((ratio) => balance * ratio),
  }
}

export function getQuickSizes(balance) {
  return [0.12, 0.15, 0.2].map((ratio) => balance * ratio)
}

export function getAtrTone(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return "red"

  return numericValue >= 40 ? "green" : "red"
}

export function getTimeTone(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return "red"
  if (numericValue >= 5 && numericValue <= 10) return "green"
  if (numericValue >= 11 && numericValue <= 15) return "yellow"
  if (numericValue >= 1 && numericValue < 5) return "red"

  return "red"
}

export function getEntryTone(value) {
  const cents = Number(value) * 100

  if (!Number.isFinite(cents)) return "red"

  return cents >= 60 && cents <= 72 ? "green" : "red"
}

export function getRsiTone(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) return "red"

  return numericValue >= 40 && numericValue <= 60 ? "green" : "red"
}

export function getTradeRiskState(form, balance) {
  const numericSize = Number(form.size)
  const quickSizes = getQuickSizes(balance)
  const maxRecommendedSize = Math.max(...quickSizes)

  const signals = [
    { key: "time", tone: form.time ? getTimeTone(form.time) : null },
    { key: "entry", tone: form.entry ? getEntryTone(normalizePrice(form.entry) ?? form.entry) : null },
    { key: "atr", tone: form.atr ? getAtrTone(form.atr) : null },
    { key: "rsi", tone: form.rsi ? getRsiTone(form.rsi) : null },
  ]

  const redSignals = signals.filter((signal) => signal.tone === "red")

  return {
    quickSizes,
    showSizeWarning:
      Number.isFinite(numericSize) && numericSize > 0 && numericSize > maxRecommendedSize,
    showRektRisk: redSignals.length >= 2,
    redSignals,
  }
}

export function buildEquityData(trades, startBalance) {
  const chronologicalTrades = [...trades].reverse()

  return chronologicalTrades.reduce(
    (points, trade, index) => {
      const previousBalance = points[points.length - 1].balance
      const nextBalance = Number(
        (previousBalance + Number(trade.balanceImpact ?? trade.pnl ?? 0)).toFixed(2)
      )

      points.push({
        name: String(index + 1),
        balance: nextBalance,
      })

      return points
    },
    [{ name: "Start", balance: Number(startBalance.toFixed(2)) }]
  )
}

export function isTimeValueOk(value) {
  return getTimeTone(value) === "green"
}

export function isEntryOk(value) {
  return getEntryTone(value) === "green"
}

export function isSameDay(createdAt, dateValue) {
  if (!createdAt || !dateValue) return false

  const tradeDate = new Date(createdAt)

  if (Number.isNaN(tradeDate.getTime())) return false

  return formatDateKey(tradeDate) === dateValue
}

export function isWithinDateRange(createdAt, dateFrom, dateTo) {
  if (!createdAt) return false

  const tradeDate = new Date(createdAt)

  if (Number.isNaN(tradeDate.getTime())) return false

  const tradeKey = formatDateKey(tradeDate)

  if (dateFrom && tradeKey < dateFrom) return false
  if (dateTo && tradeKey > dateTo) return false

  return true
}

export function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function isTradeFromToday(createdAt) {
  if (!createdAt) return false

  const tradeDate = new Date(createdAt)

  if (Number.isNaN(tradeDate.getTime())) return false

  return formatDateKey(tradeDate) === formatDateKey(new Date())
}
