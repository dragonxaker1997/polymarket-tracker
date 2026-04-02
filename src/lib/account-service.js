import { DEFAULT_START_BALANCE } from "@/lib/trade-utils"
import { supabase } from "@/lib/supabase"

const ACCOUNT_COLUMNS = [
  "id",
  "user_id",
  "name",
  "type",
  "sort_order",
  "start_balance",
  "created_at",
].join(", ")

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }

  return supabase
}

export async function ensureDefaultAccounts(userId) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .limit(1)

  if (error) throw error
  if ((data ?? []).length > 0) return

  const defaultAccounts = [
    {
      user_id: userId,
      name: "Main Account",
      type: "main",
      sort_order: 0,
      start_balance: DEFAULT_START_BALANCE,
    },
    ...Array.from({ length: 10 }, (_, index) => ({
      user_id: userId,
      name: `Wallet ${index + 1}`,
      type: "wallet",
      sort_order: index + 1,
      start_balance: 0,
    })),
  ]

  const { error: insertError } = await client.from("accounts").insert(defaultAccounts)

  if (insertError) throw insertError
}

export async function loadAccounts(userId) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapAccountRow)
}

export async function createCustomAccount(userId, name, sortOrder) {
  const client = requireSupabase()

  const { data, error } = await client
    .from("accounts")
    .insert({
      user_id: userId,
      name: name.trim(),
      type: "custom",
      sort_order: sortOrder,
      start_balance: 0,
    })
    .select(ACCOUNT_COLUMNS)
    .single()

  if (error) throw error

  return mapAccountRow(data)
}

export async function updateAccount(accountId, updates) {
  const client = requireSupabase()

  const payload = {}

  if (updates.name !== undefined) {
    payload.name = updates.name?.trim() || null
  }

  if (updates.startBalance !== undefined) {
    payload.start_balance = updates.startBalance
  }

  const { data, error } = await client
    .from("accounts")
    .update(payload)
    .eq("id", accountId)
    .select(ACCOUNT_COLUMNS)
    .single()

  if (error) throw error

  return mapAccountRow(data)
}

function mapAccountRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    sortOrder: Number(row.sort_order ?? 0),
    startBalance: Number(row.start_balance ?? DEFAULT_START_BALANCE),
    createdAt: row.created_at,
  }
}
