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
    size: numericSize,
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
    vwap: form.vwap,
    result: pnl >= 0 ? "win" : "loss",
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
  const totalPnL = trades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)
  const balance = startBalance + totalPnL
  const wins = trades.filter((trade) => trade.result === "win").length
  const winRate = trades.length ? (wins / trades.length) * 100 : 0
  const dailyPnL = trades.reduce((sum, trade) => {
    if (!isTradeFromToday(trade.createdAt)) return sum

    return sum + (Number(trade.pnl) || 0)
  }, 0)

  let streak = 0
  let streakLabel = "-"

  if (trades.length) {
    const currentType = trades[0].result
    streakLabel = currentType === "win" ? "W" : "L"

    for (const trade of trades) {
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
    streak,
    streakLabel,
    showBreakWarning: streakLabel === "L" && streak >= 5,
    showDrawdownWarning: balance > 0 && totalPnL < 0 && Math.abs(totalPnL) >= balance * 0.2,
    quickSizes: [0.12, 0.15, 0.2].map((ratio) => balance * ratio),
  }
}

export function buildEquityData(trades, startBalance) {
  const chronologicalTrades = [...trades].reverse()

  return chronologicalTrades.reduce(
    (points, trade, index) => {
      const previousBalance = points[points.length - 1].balance
      const nextBalance = Number((previousBalance + (Number(trade.pnl) || 0)).toFixed(2))

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
  const numericValue = Number(value)

  return Number.isFinite(numericValue) && numericValue >= 5 && numericValue <= 10
}

export function isEntryOk(value) {
  const cents = Number(value) * 100

  return Number.isFinite(cents) && cents >= 50 && cents <= 72
}

function isTradeFromToday(createdAt) {
  if (!createdAt) return false

  const tradeDate = new Date(createdAt)
  const now = new Date()

  if (Number.isNaN(tradeDate.getTime())) return false

  return (
    tradeDate.getFullYear() === now.getFullYear() &&
    tradeDate.getMonth() === now.getMonth() &&
    tradeDate.getDate() === now.getDate()
  )
}
