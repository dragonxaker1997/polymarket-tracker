export const DEFAULT_START_BALANCE = 0
export const TRADE_COOLDOWN_MS = 60 * 60 * 1000
export const BALANCE_EVENT_TYPES = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  FEES: "fees",
}
export const TRADE_INPUT_LIMITS = {
  size: {
    min: 0.01,
    max: 100000,
  },
  priceCents: {
    min: 1,
    max: 99,
  },
}

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
})

const STANDARD_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
})

const COMPACT_CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
})

const STANDARD_CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

function getTrimmedValue(value) {
  if (typeof value === "string") return value.trim()
  if (value === null || value === undefined) return ""

  return String(value).trim()
}

function validateSize(value) {
  const normalizedValue = getTrimmedValue(value)

  if (!normalizedValue) {
    return {
      isValid: false,
      error: "Enter a trade size.",
      value: null,
    }
  }

  if (!/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
    return {
      isValid: false,
      error: "Use a positive dollar amount with up to 2 decimals.",
      value: null,
    }
  }

  const numericValue = Number(normalizedValue)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return {
      isValid: false,
      error: "Trade size must be greater than $0.",
      value: null,
    }
  }

  if (numericValue > TRADE_INPUT_LIMITS.size.max) {
    return {
      isValid: false,
      error: `Trade size must be $${TRADE_INPUT_LIMITS.size.max.toLocaleString()} or less.`,
      value: null,
    }
  }

  return {
    isValid: true,
    error: "",
    value: numericValue,
  }
}

function validatePriceCents(value, label) {
  const normalizedValue = getTrimmedValue(value)

  if (!normalizedValue) {
    return {
      isValid: false,
      error: `Enter ${label.toLowerCase()} in cents.`,
      value: null,
    }
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return {
      isValid: false,
      error: `${label} must be a whole number of cents.`,
      value: null,
    }
  }

  const numericValue = Number(normalizedValue)

  if (!Number.isInteger(numericValue)) {
    return {
      isValid: false,
      error: `${label} must be a whole number of cents.`,
      value: null,
    }
  }

  if (numericValue < TRADE_INPUT_LIMITS.priceCents.min) {
    return {
      isValid: false,
      error: `${label} must be at least ${TRADE_INPUT_LIMITS.priceCents.min}¢.`,
      value: null,
    }
  }

  if (numericValue > TRADE_INPUT_LIMITS.priceCents.max) {
    return {
      isValid: false,
      error: `${label} must be ${TRADE_INPUT_LIMITS.priceCents.max}¢ or less.`,
      value: null,
    }
  }

  return {
    isValid: true,
    error: "",
    value: numericValue,
  }
}

export function validateTradeForm(form) {
  const size = validateSize(form?.size)
  const entry = validatePriceCents(form?.entry, "Entry")
  const exit = validatePriceCents(form?.exit, "Exit")

  return {
    isValid: size.isValid && entry.isValid && exit.isValid,
    fields: {
      size,
      entry,
      exit,
    },
    errors: {
      size: size.error,
      entry: entry.error,
      exit: exit.error,
    },
  }
}

export function formatPreviewNumber(value) {
  if (!Number.isFinite(value)) return "—"

  return Math.abs(value) >= 1000
    ? COMPACT_NUMBER_FORMATTER.format(value)
    : STANDARD_NUMBER_FORMATTER.format(value)
}

export function formatPreviewCurrency(value) {
  if (!Number.isFinite(value)) return "—"

  return Math.abs(value) >= 1000
    ? COMPACT_CURRENCY_FORMATTER.format(value)
    : STANDARD_CURRENCY_FORMATTER.format(value)
}

export function normalizePrice(value) {
  if (value === "" || value === null || value === undefined) return 0

  const numericValue = Number.parseFloat(value)

  if (!Number.isFinite(numericValue)) return null
  if (numericValue < 0) return null

  const normalizedValue = numericValue / 100

  if (normalizedValue < 0 || normalizedValue > 1) return null

  return normalizedValue
}

export function createTrade(form) {
  const validation = validateTradeForm(form)

  if (!validation.isValid) return null

  const numericSize = validation.fields.size.value
  const entry = normalizePrice(validation.fields.entry.value)
  const exit = normalizePrice(validation.fields.exit.value)

  if (entry === null || exit === null) return null
  if (entry <= 0) return null
  if (!Number.isFinite(exit) || exit < 0) return null

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

export function createAdjustment(amount, note = "") {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount) || numericAmount === 0) return null

  return {
    id: Date.now(),
    recordType: "adjustment",
    amount: numericAmount,
    pnl: numericAmount,
    balanceImpact: numericAmount,
    note,
    result: "adjustment",
  }
}

export function createBalanceEvent(type, amount, note = "") {
  const numericAmount = Number(amount)

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null

  const normalizedType = String(type ?? "").toLowerCase()
  const absoluteAmount = Math.abs(numericAmount)

  if (normalizedType === BALANCE_EVENT_TYPES.DEPOSIT) {
    return {
      id: Date.now(),
      recordType: BALANCE_EVENT_TYPES.DEPOSIT,
      transactionType: BALANCE_EVENT_TYPES.DEPOSIT,
      amount: absoluteAmount,
      pnl: 0,
      balanceImpact: absoluteAmount,
      note,
      result: BALANCE_EVENT_TYPES.DEPOSIT,
    }
  }

  if (normalizedType === BALANCE_EVENT_TYPES.WITHDRAWAL) {
    return {
      id: Date.now(),
      recordType: BALANCE_EVENT_TYPES.WITHDRAWAL,
      transactionType: BALANCE_EVENT_TYPES.WITHDRAWAL,
      amount: absoluteAmount,
      pnl: 0,
      balanceImpact: -absoluteAmount,
      note,
      result: BALANCE_EVENT_TYPES.WITHDRAWAL,
    }
  }

  if (normalizedType === BALANCE_EVENT_TYPES.FEES) {
    return {
      id: Date.now(),
      recordType: BALANCE_EVENT_TYPES.FEES,
      transactionType: BALANCE_EVENT_TYPES.FEES,
      amount: absoluteAmount,
      pnl: -absoluteAmount,
      balanceImpact: -absoluteAmount,
      note,
      result: BALANCE_EVENT_TYPES.FEES,
    }
  }

  return null
}

export function getTradePreview(size, entry, exit) {
  const validation = validateTradeForm({ size, entry, exit })

  if (!validation.isValid) {
    return {
      isValid: false,
      previewShares: null,
      previewTotalExitValue: null,
      previewPnl: null,
    }
  }

  const previewSize = validation.fields.size.value
  const previewEntry = normalizePrice(validation.fields.entry.value)
  const previewExit = normalizePrice(validation.fields.exit.value)

  if (!previewEntry || !previewExit) {
    return {
      isValid: false,
      previewShares: null,
      previewTotalExitValue: null,
      previewPnl: null,
    }
  }

  const previewShares = previewSize / previewEntry
  const previewTotalExitValue = previewShares * previewExit
  const previewPnl = previewTotalExitValue - previewSize

  return {
    isValid: true,
    previewShares: Number.isFinite(previewShares) ? previewShares : null,
    previewTotalExitValue: Number.isFinite(previewTotalExitValue) ? previewTotalExitValue : null,
    previewPnl: Number.isFinite(previewPnl) ? previewPnl : null,
  }
}

export function getTradeStats(trades, startBalance) {
  const tradeRecords = trades.filter((trade) => trade.recordType === "trade")
  const pnlRecords = trades.filter(
    (trade) =>
      trade.recordType === "trade" ||
      trade.recordType === BALANCE_EVENT_TYPES.FEES ||
      trade.recordType === "adjustment"
  )
  const transactionsCount = tradeRecords.length * 2
  const volume = tradeRecords.reduce(
    (sum, trade) => sum + Number(trade.size ?? 0) + Number(trade.totalExitValue ?? 0),
    0
  )
  const totalPnL = pnlRecords.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0)
  const totalBalanceImpact = trades.reduce(
    (sum, trade) => sum + Number(trade.balanceImpact ?? trade.pnl ?? 0),
    0
  )
  const balance = startBalance + totalBalanceImpact
  const wins = tradeRecords.filter((trade) => trade.result === "win").length
  const winRate = tradeRecords.length ? (wins / tradeRecords.length) * 100 : 0
  const dailyPnL = pnlRecords.reduce((sum, trade) => {
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

export function getCooldownTrigger(records, startBalance, dayKey = getLocalDayKey(new Date())) {
  const metrics = getDailyTradingMetrics(records, startBalance, dayKey)

  if (!metrics) return null

  if (metrics.startBalanceOfDay > 0 && metrics.dailyPnL >= metrics.startBalanceOfDay * 0.13) {
    return {
      code: "daily_profit",
      label: "Достигнут дневной профит",
      metrics,
    }
  }

  if (metrics.lossStreak >= 3) {
    return {
      code: "loss_streak",
      label: "3 убыточные сделки подряд",
      metrics,
    }
  }

  if (metrics.startBalanceOfDay > 0 && metrics.dailyPnL <= metrics.startBalanceOfDay * -0.2) {
    return {
      code: "daily_loss",
      label: "Достигнут лимит убытка",
      metrics,
    }
  }

  return null
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
  const sizeValidation = validateSize(form.size)
  const numericSize = sizeValidation.isValid ? sizeValidation.value : null
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
  const chronologicalRecords = [...trades].reverse()
  const points = [{ name: "Start", balance: Number(startBalance.toFixed(2)) }]
  let tradeIndex = 0

  for (const record of chronologicalRecords) {
    const previousBalance = points[points.length - 1].balance
    const nextBalance = Number(
      (previousBalance + Number(record.balanceImpact ?? record.pnl ?? 0)).toFixed(2)
    )

    if (record.recordType === "trade") {
      tradeIndex += 1
      points.push({
        name: String(tradeIndex),
        balance: nextBalance,
      })
      continue
    }

    const lastPoint = points[points.length - 1]
    points[points.length - 1] = {
      ...lastPoint,
      balance: nextBalance,
    }
  }

  return points
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

export function getLocalDayKey(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)

  if (Number.isNaN(date.getTime())) {
    return formatDateKey(new Date())
  }

  return formatDateKey(date)
}

export function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function getDailyTradingMetrics(records, startBalance, dayKey) {
  const chronologicalRecords = [...records]
    .filter((record) => record.createdAt)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())

  const firstTradeIndex = chronologicalRecords.findIndex(
    (record) => record.recordType === "trade" && getLocalDayKey(record.createdAt) === dayKey
  )

  if (firstTradeIndex === -1) {
    return null
  }

  const startBalanceOfDay = chronologicalRecords
    .slice(0, firstTradeIndex)
    .reduce(
      (sum, record) => sum + Number(record.balanceImpact ?? record.pnl ?? 0),
      Number(startBalance)
    )

  const dayRecords = chronologicalRecords.filter((record) => getLocalDayKey(record.createdAt) === dayKey)
  const dayTradeRecords = dayRecords.filter((record) => record.recordType === "trade")
  const dayPnlRecords = dayRecords.filter(
    (record) =>
      record.recordType === "trade" ||
      record.recordType === BALANCE_EVENT_TYPES.FEES ||
      record.recordType === "adjustment"
  )

  let lossStreak = 0

  for (let index = dayTradeRecords.length - 1; index >= 0; index -= 1) {
    if (dayTradeRecords[index].result !== "loss") break
    lossStreak += 1
  }

  return {
    startBalanceOfDay,
    dailyPnL: dayPnlRecords.reduce((sum, record) => sum + Number(record.pnl ?? 0), 0),
    lossStreak,
  }
}

function isTradeFromToday(createdAt) {
  if (!createdAt) return false

  const tradeDate = new Date(createdAt)

  if (Number.isNaN(tradeDate.getTime())) return false

  return getLocalDayKey(tradeDate) === getLocalDayKey(new Date())
}
