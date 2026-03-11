import { supabase } from "@/lib/supabase"

const PROFILE_COLUMNS = "user_id, start_balance, display_name"
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
    displayName: profile?.display_name ?? "",
    trades: (trades ?? []).map(mapTradeFromRow),
  }
}

export async function saveWorkerProfile(userId, profile) {
  const client = requireSupabase()

  const { error } = await client.from("profiles").upsert(
    {
      user_id: userId,
      start_balance: profile.startBalance,
      display_name: profile.displayName?.trim() || null,
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

export async function updateTradeNote(userId, tradeId, note) {
  const client = requireSupabase()

  const { error: updateError } = await client
    .from("trades")
    .update({ note: note?.trim() || null })
    .eq("user_id", userId)
    .eq("id", tradeId)

  if (updateError) throw updateError

  const { data, error } = await client
    .from("trades")
    .select(TRADE_COLUMNS)
    .eq("user_id", userId)
    .eq("id", tradeId)
    .maybeSingle()

  if (error) throw error

  return mapTradeFromRow(data)
}

export async function resetDashboard(userId, startBalance) {
  const client = requireSupabase()

  const [{ error: tradesError }, { error: profileError }] = await Promise.all([
    client.from("trades").delete().eq("user_id", userId),
    client.from("profiles").upsert(
      {
        user_id: userId,
        start_balance: startBalance,
        display_name: null,
      },
      { onConflict: "user_id" }
    ),
  ])

  if (tradesError) throw tradesError
  if (profileError) throw profileError
}

export async function loadWorkerSummaries() {
  const client = requireSupabase()

  const { data, error } = await client.rpc("get_worker_summaries")

  if (error) throw error

  return (data ?? []).map((row) => ({
    user_id: row.user_id,
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
    display_name: row.display_name ?? "",
    email: row.email,
    daily_pnl: Number(row.daily_pnl ?? 0),
  }))
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
    note: trade.note || null,
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
    note: row.note ?? "",
    result: row.result,
    createdAt: row.created_at,
  }
}
