import { supabase } from "@/lib/supabase"

const PROFILE_COLUMNS = "user_id, start_balance"
const TRADE_COLUMNS = [
  "id",
  "user_id",
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
  "vwap",
  "result",
  "created_at",
].join(", ")

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }

  return supabase
}

export async function loadDashboard(userId, fallbackStartBalance) {
  const client = requireSupabase()

  const [{ data: profile, error: profileError }, { data: trades, error: tradesError }] =
    await Promise.all([
      client.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle(),
      client
        .from("trades")
        .select(TRADE_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ])

  if (profileError) throw profileError
  if (tradesError) throw tradesError

  return {
    startBalance: Number(profile?.start_balance ?? fallbackStartBalance),
    trades: (trades ?? []).map(mapTradeFromRow),
  }
}

export async function saveStartBalance(userId, startBalance) {
  const client = requireSupabase()

  const { error } = await client.from("profiles").upsert(
    {
      user_id: userId,
      start_balance: startBalance,
    },
    { onConflict: "user_id" }
  )

  if (error) throw error
}

export async function insertTrade(userId, trade) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("trades")
    .insert(mapTradeToInsert(userId, trade))
    .select(TRADE_COLUMNS)
    .single()

  if (error) throw error

  return mapTradeFromRow(data)
}

export async function removeTrade(userId, tradeId) {
  const client = requireSupabase()

  const { error } = await client.from("trades").delete().eq("user_id", userId).eq("id", tradeId)

  if (error) throw error
}

export async function resetDashboard(userId, startBalance) {
  const client = requireSupabase()

  const [{ error: tradesError }, { error: profileError }] = await Promise.all([
    client.from("trades").delete().eq("user_id", userId),
    client.from("profiles").upsert(
      {
        user_id: userId,
        start_balance: startBalance,
      },
      { onConflict: "user_id" }
    ),
  ])

  if (tradesError) throw tradesError
  if (profileError) throw profileError
}

function mapTradeToInsert(userId, trade) {
  return {
    id: trade.id,
    user_id: userId,
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
    vwap: trade.vwap || null,
    result: trade.result,
  }
}

function mapTradeFromRow(row) {
  return {
    id: row.id,
    size: Number(row.size),
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
    vwap: row.vwap ?? "",
    result: row.result,
    createdAt: row.created_at,
  }
}
