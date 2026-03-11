import { Navigate, Outlet } from "react-router-dom"

import { isAdminUser } from "@/lib/admin"
import { useAuth } from "@/providers/use-auth"

export function AdminRoute() {
  const { isLoading, user } = useAuth()

  if (isLoading) {
    return <CenteredState label="Checking admin access..." />
  }

  if (!user || !isAdminUser(user.email)) {
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
