import { Navigate, Outlet } from "react-router-dom"

import { isAdminUser } from "@/lib/admin"
import { useAccount } from "@/providers/use-account"
import { useAuth } from "@/providers/use-auth"

export function AdminRoute() {
  const { isLoading, user } = useAuth()
  const { workspace, isLoading: isWorkspaceLoading } = useAccount()

  if (isLoading || isWorkspaceLoading) {
    return <CenteredState label="Checking workspace access..." />
  }

  const hasTeamAccess = Boolean(workspace?.capabilities?.teamMode || isAdminUser(user?.email))

  if (!user || !hasTeamAccess) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

function CenteredState({ label }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-slate-300">
      {label}
    </div>
  )
}
