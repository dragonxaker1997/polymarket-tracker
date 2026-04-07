import { getPlanCapabilities } from "@/lib/plan-capabilities"
import { supabase } from "@/lib/supabase"

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }

  return supabase
}

function mapWorkspaceRow(row) {
  if (!row) return null

  const fallbackCapabilities = getPlanCapabilities(row.plan)

  return {
    id: row.workspace_id,
    name: row.workspace_name ?? "Workspace",
    type: row.workspace_type ?? "personal",
    plan: row.plan ?? "base",
    role: row.role ?? "member",
    activeMembers: Number(row.active_members ?? 0),
    currentUserWallets: Number(row.current_user_wallets ?? 0),
    capabilities: {
      maxMembers: Number(row.max_members ?? fallbackCapabilities.maxMembers),
      maxWalletsPerUser: Number(
        row.max_wallets_per_user ?? fallbackCapabilities.maxWalletsPerUser
      ),
      maxTradesPerUser:
        row.max_trades_per_user === null || row.max_trades_per_user === undefined
          ? fallbackCapabilities.maxTradesPerUser
          : Number(row.max_trades_per_user),
      canCreateWallets:
        row.can_create_wallets ?? fallbackCapabilities.canCreateWallets,
      teamMode: row.team_mode ?? fallbackCapabilities.teamMode,
    },
    rules: {
      cooldownEnabled: row.cooldown_enabled ?? true,
    },
  }
}

export function createInvitationLink(token) {
  if (typeof window === "undefined") {
    return `/invite/${token}`
  }

  return `${window.location.origin}/invite/${token}`
}

function mapAccessibleWorkspaceRow(row) {
  if (!row) return null

  const capabilities = getPlanCapabilities(row.plan)

  return {
    id: row.id,
    name: row.name ?? "Workspace",
    type: row.type ?? "personal",
    plan: row.plan ?? "base",
    ownerUserId: row.owner_user_id ?? null,
    capabilities,
  }
}

export async function ensurePersonalWorkspace(userId) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("ensure_personal_workspace", {
    target_user_id: userId,
  })

  if (error) throw error

  return data ?? null
}

export async function loadPrimaryWorkspace(userId) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("get_primary_workspace", {
    target_user_id: userId,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return mapWorkspaceRow(row)
}

export async function setWorkspaceCooldownEnabled(workspaceId, isEnabled) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("set_workspace_cooldown_enabled", {
    target_workspace_id: workspaceId,
    target_enabled: isEnabled,
  })

  if (error) throw error

  return Boolean(data)
}

export async function loadAccessibleWorkspaces() {
  const client = requireSupabase()

  const { data, error } = await client
    .from("workspaces")
    .select("id, name, type, plan, owner_user_id")
    .order("created_at", { ascending: true })

  if (error) throw error

  return (data ?? []).map(mapAccessibleWorkspaceRow)
}

export async function loadWorkspaceMembers(workspaceId = null) {
  const client = requireSupabase()

  const args = workspaceId ? { target_workspace_id: workspaceId } : {}
  const { data, error } = await client.rpc("get_workspace_members", args)

  if (error) throw error

  return (data ?? []).map((row) => ({
    workspaceId: row.workspace_id,
    userId: row.user_id,
    email: row.email ?? "",
    displayName: row.display_name ?? "",
    role: row.role ?? "member",
    status: row.status ?? "active",
    createdAt: row.created_at,
  }))
}

export async function inviteWorkspaceMemberByEmail(workspaceId, email, role) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("create_invitation", {
    target_workspace_id: workspaceId,
    target_email: email,
    target_role: role,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email ?? "",
    role: row.role ?? "member",
    status: row.status ?? "pending",
    token: row.token ?? "",
    invitedBy: row.invited_by ?? null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
  }
}

export async function loadWorkspaceInvitations(workspaceId = null) {
  const client = requireSupabase()

  const args = workspaceId ? { target_workspace_id: workspaceId } : {}
  const { data, error } = await client.rpc("get_workspace_invitations", args)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email ?? "",
    role: row.role ?? "member",
    status: row.status ?? "pending",
    token: row.token ?? "",
    invitedBy: row.invited_by ?? null,
    invitedByEmail: row.invited_by_email ?? "",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
  }))
}

export async function revokeWorkspaceInvitation(invitationId) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("revoke_invitation", {
    target_invitation_id: invitationId,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email ?? "",
    role: row.role ?? "member",
    status: row.status ?? "pending",
    token: row.token ?? "",
    invitedBy: row.invited_by ?? null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at ?? null,
  }
}

export async function acceptWorkspaceInvitation(token, userId) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("accept_invitation", {
    target_token: token,
    target_user_id: userId,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data

  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role ?? "member",
    status: row.status ?? "active",
    createdAt: row.created_at,
  }
}
