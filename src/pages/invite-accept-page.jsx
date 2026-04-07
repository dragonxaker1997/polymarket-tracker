import { useEffect, useState } from "react"
import { Link, Navigate, useLocation, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { acceptWorkspaceInvitation } from "@/lib/workspace-service"
import { useAccount } from "@/providers/use-account"
import { useAuth } from "@/providers/use-auth"

export function InviteAcceptPage() {
  const { token } = useParams()
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const { refreshWorkspace } = useAccount()
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user || !token || status !== "idle") return

    let active = true

    async function acceptInvite() {
      setStatus("loading")
      setError("")

      try {
        await acceptWorkspaceInvitation(token, user.id)
        await refreshWorkspace()

        if (!active) return
        setStatus("success")
      } catch (nextError) {
        if (!active) return
        setStatus("error")
        setError(nextError.message ?? "Failed to accept invitation.")
      }
    }

    acceptInvite()

    return () => {
      active = false
    }
  }, [refreshWorkspace, status, token, user])

  if (!token) {
    return <Navigate to="/" replace />
  }

  if (!isLoading && !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (isLoading || status === "loading" || status === "idle") {
    return (
      <CenteredInviteState
        title="Checking invitation"
        subtitle="We are validating your invite and preparing workspace access."
      />
    )
  }

  if (status === "error") {
    return (
      <CenteredInviteState
        title="Invitation could not be accepted"
        subtitle={error}
        action={
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
          >
            <Link to="/">Back to dashboard</Link>
          </Button>
        }
      />
    )
  }

  return (
    <CenteredInviteState
      title="You joined workspace"
      subtitle="The invitation was accepted successfully. Your workspace access is now active."
      action={
        <Button asChild className="rounded-xl bg-white text-slate-950 hover:bg-slate-100">
          <Link to="/">Open dashboard</Link>
        </Button>
      }
    />
  )
}

function CenteredInviteState({ title, subtitle, action = null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <Card className="w-full max-w-xl border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
        <CardContent className="px-6 py-8 text-center">
          <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Workspace invitation</div>
          <div className="mt-3 text-3xl font-bold">{title}</div>
          <div className="mt-3 text-sm text-slate-400">{subtitle}</div>
          {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}
