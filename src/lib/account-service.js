import { DEFAULT_START_BALANCE } from "@/lib/trade-utils"
import { supabase } from "@/lib/supabase"

const ACCOUNT_COLUMNS = [
  "id",
  "workspace_id",
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

export async function ensureDefaultAccounts(userId, workspaceId = null) {
  const client = requireSupabase()

  const { error } = await client.rpc("ensure_default_accounts", {
    target_user_id: userId,
    target_workspace_id: workspaceId,
  })

  if (error) throw error
}

export async function loadAccounts(userId, workspaceId) {
  const client = requireSupabase()

  let query = client.from("accounts").select(ACCOUNT_COLUMNS).eq("user_id", userId)

  if (workspaceId) {
    query = query.eq("workspace_id", workspaceId)
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapAccountRow)
}

export async function createCustomAccount(workspaceId, name) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("create_workspace_account", {
    target_workspace_id: workspaceId,
    target_name: name.trim(),
    target_type: "custom",
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return mapAccountRow(row)
}

export async function createWalletAccount(workspaceId, name) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("create_workspace_account", {
    target_workspace_id: workspaceId,
    target_name: name.trim(),
    target_type: "wallet",
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return mapAccountRow(row)
}

export async function deleteAccount(accountId) {
  const client = requireSupabase()

  const { error } = await client.from("accounts").delete().eq("id", accountId)

  if (error) throw error
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
    workspaceId: row.workspace_id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    sortOrder: Number(row.sort_order ?? 0),
    startBalance: Number(row.start_balance ?? DEFAULT_START_BALANCE),
    createdAt: row.created_at,
  }
}
