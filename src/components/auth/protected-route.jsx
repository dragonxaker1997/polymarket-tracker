import { Navigate, Outlet } from "react-router-dom"

import { useAuth } from "@/providers/use-auth"

export function ProtectedRoute() {
  const { isLoading, isConfigured, user } = useAuth()

  if (isLoading) {
    return <CenteredState label="Checking session..." />
  }

  if (!isConfigured) {
    return <CenteredState label="Supabase is not configured. Add env vars to continue." />
  }

  if (!user) {
    return <Navigate to="/login" replace />
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
