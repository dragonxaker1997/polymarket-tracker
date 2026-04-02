import { supabase } from "@/lib/supabase"

const PROFILE_COLUMNS = "user_id, display_name"
const TRANSACTION_COLUMNS = [
  "id",
  "user_id",
  "account_id",
  "transaction_type",
  "amount",
  "note",
  "created_at",
].join(", ")
const TRADE_COLUMNS = [
  "id",
  "user_id",
  "account_id",
  "size",
  "entry",
  "exit",
  "raw_entry",
  "raw_exit",
  "shares",
  "total_exit_value",
  "pnl",
  "time",
  "atr",
  "rsi",
  "macd",
  "note",
  "result",
  "created_at",
].join(", ")

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }

  return supabase
}

export async function loadDashboard(userId, accountId, fallbackStartBalance) {
  const client = requireSupabase()

  const [
    { data: profile, error: profileError },
    { data: trades, error: tradesError },
    { data: transactions, error: transactionsError },
  ] =
    await Promise.all([
      client.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle(),
      client
        .from("trades")
        .select(TRADE_COLUMNS)
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
      client
        .from("balance_transactions")
        .select(TRANSACTION_COLUMNS)
        .eq("user_id", userId)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false }),
    ])

  if (profileError) throw profileError
  if (tradesError) throw tradesError
  if (transactionsError) throw transactionsError

  return {
    startBalance: fallbackStartBalance,
    displayName: profile?.display_name ?? "",
    records: [...(trades ?? []).map(mapTradeFromRow), ...(transactions ?? []).map(mapTransactionFromRow)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  }
}

export async function saveWorkerProfile(userId, profile) {
  const client = requireSupabase()

  const { error } = await client.from("profiles").upsert(
    {
      user_id: userId,
      display_name: profile.displayName?.trim() || null,
    },
    { onConflict: "user_id" }
  )

  if (error) throw error
}

export async function insertTrade(userId, accountId, trade) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("trades")
    .insert(mapTradeToInsert(userId, accountId, trade))
    .select(TRADE_COLUMNS)
    .single()

  if (error) throw error

  return mapTradeFromRow(data)
}

export async function insertWithdrawal(userId, accountId, withdrawal) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("balance_transactions")
    .insert({
      id: withdrawal.id,
      user_id: userId,
      account_id: accountId,
      transaction_type: "withdrawal",
      amount: withdrawal.amount,
      note: withdrawal.note || null,
    })
    .select(TRANSACTION_COLUMNS)
    .single()

  if (error) throw error

  return mapTransactionFromRow(data)
}

export async function insertAdjustment(userId, accountId, adjustment) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("balance_transactions")
    .insert({
      id: adjustment.id,
      user_id: userId,
      account_id: accountId,
      transaction_type: "adjustment",
      amount: adjustment.amount,
      note: adjustment.note || null,
    })
    .select(TRANSACTION_COLUMNS)
    .single()

  if (error) throw error

  return mapTransactionFromRow(data)
}

export async function removeRecord(userId, accountId, record) {
  const client = requireSupabase()

  const { error } =
    record.recordType === "withdrawal" || record.recordType === "adjustment"
      ? await client
          .from("balance_transactions")
          .delete()
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)
      : await client
          .from("trades")
          .delete()
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)

  if (error) throw error
}

export async function updateRecordNote(userId, accountId, record, note) {
  const client = requireSupabase()

  const trimmedNote = note?.trim() || null
  const { error: updateError } =
    record.recordType === "withdrawal" || record.recordType === "adjustment"
      ? await client
          .from("balance_transactions")
          .update({ note: trimmedNote })
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)
      : await client
          .from("trades")
          .update({ note: trimmedNote })
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)

  if (updateError) throw updateError

  const { data, error } =
    record.recordType === "withdrawal" || record.recordType === "adjustment"
      ? await client
          .from("balance_transactions")
          .select(TRANSACTION_COLUMNS)
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)
          .maybeSingle()
      : await client
          .from("trades")
          .select(TRADE_COLUMNS)
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .eq("id", record.id)
          .maybeSingle()

  if (error) throw error

  return record.recordType === "trade" ? mapTradeFromRow(data) : mapTransactionFromRow(data)
}

export async function resetDashboard(userId, accountId) {
  const client = requireSupabase()

  const [{ error: tradesError }, { error: transactionsError }] = await Promise.all([
    client.from("trades").delete().eq("user_id", userId).eq("account_id", accountId),
    client.from("balance_transactions").delete().eq("user_id", userId).eq("account_id", accountId),
  ])

  if (tradesError) throw tradesError
  if (transactionsError) throw transactionsError
}

export async function loadWorkerSummaries() {
  const client = requireSupabase()

  const { data, error } = await client.rpc("get_account_summaries")

  if (error) throw error

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    account_id: row.account_id,
    account_name: row.account_name ?? "",
    display_name: row.display_name ?? "",
    email: row.email,
    start_balance: Number(row.start_balance ?? 0),
    total_pnl: Number(row.total_pnl ?? 0),
    streak_count: Number(row.streak_count ?? 0),
    streak_label: row.streak_label ?? "-",
    win_rate: Number(row.win_rate ?? 0),
    trades_count: Number(row.trades_count ?? 0),
  }))
}

export async function loadTeamDailyPnl(dateFrom, dateTo) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("get_team_daily_pnl", {
    date_from: dateFrom,
    date_to: dateTo,
  })

  if (error) throw error

  return (data ?? []).map((row) => ({
    trade_date: row.trade_date,
    user_id: row.user_id,
    account_id: row.account_id,
    account_name: row.account_name ?? "",
    display_name: row.display_name ?? "",
    email: row.email,
    daily_pnl: Number(row.daily_pnl ?? 0),
  }))
}

function mapTradeToInsert(userId, accountId, trade) {
  return {
    id: trade.id,
    user_id: userId,
    account_id: accountId,
    size: trade.size,
    entry: trade.entry,
    exit: trade.exit,
    raw_entry: trade.rawEntry,
    raw_exit: trade.rawExit,
    shares: trade.shares,
    total_exit_value: trade.totalExitValue,
    pnl: trade.pnl,
    time: trade.time || null,
    atr: trade.atr || null,
    rsi: trade.rsi || null,
    macd: trade.macd || null,
    note: trade.note || null,
    result: trade.result,
  }
}

function mapTradeFromRow(row) {
  return {
    id: row.id,
    recordType: "trade",
    accountId: row.account_id,
    size: Number(row.size),
    amount: Number(row.size),
    entry: Number(row.entry),
    exit: Number(row.exit),
    rawEntry: row.raw_entry ?? "",
    rawExit: row.raw_exit ?? "",
    shares: Number(row.shares),
    totalExitValue: Number(row.total_exit_value),
    pnl: Number(row.pnl),
    time: row.time ?? "",
    atr: row.atr ?? "",
    rsi: row.rsi ?? "",
    macd: row.macd ?? "",
    note: row.note ?? "",
    result: row.result,
    balanceImpact: Number(row.pnl),
    createdAt: row.created_at,
  }
}

function mapTransactionFromRow(row) {
  const transactionType = row.transaction_type ?? "withdrawal"
  const amount = Number(row.amount)

  if (transactionType === "adjustment") {
    return {
      id: row.id,
      recordType: "adjustment",
      accountId: row.account_id,
      amount,
      pnl: amount,
      balanceImpact: amount,
      note: row.note ?? "",
      result: "adjustment",
      createdAt: row.created_at,
    }
  }

  return {
    id: row.id,
    recordType: "withdrawal",
    accountId: row.account_id,
    amount,
    pnl: 0,
    balanceImpact: -amount,
    note: row.note ?? "",
    result: "withdrawal",
    createdAt: row.created_at,
  }
}
