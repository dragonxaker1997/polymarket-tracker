import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { loadTeamDailyPnl, loadWorkerSummaries } from "@/lib/trade-service"
import {
  createInvitationLink,
  inviteWorkspaceMemberByEmail,
  loadWorkspaceInvitations,
  loadWorkspaceMembers,
  revokeWorkspaceInvitation,
} from "@/lib/workspace-service"
import { useAccount } from "@/providers/use-account"
import { useAuth } from "@/providers/use-auth"

export function AdminPage() {
  const { user, signOut } = useAuth()
  const { workspace, refreshWorkspace } = useAccount()
  const [accountSummaries, setAccountSummaries] = useState([])
  const [calendarItems, setCalendarItems] = useState([])
  const [workspaceMembers, setWorkspaceMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [month, setMonth] = useState(getCurrentMonthValue())
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [copiedInvitationId, setCopiedInvitationId] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  const [revokingInvitationId, setRevokingInvitationId] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function bootstrap() {
      setIsLoading(true)
      setError("")

      const { dateFrom, dateTo } = getMonthRange(month)

      try {
        const [summaries, dailyItems, members, invites] = await Promise.all([
          loadWorkerSummaries(workspace?.id ?? null),
          loadTeamDailyPnl(dateFrom, dateTo, workspace?.id ?? null),
          loadWorkspaceMembers(workspace?.id ?? null),
          loadWorkspaceInvitations(workspace?.id ?? null),
        ])

        if (!active) return
        setAccountSummaries(summaries)
        setCalendarItems(dailyItems)
        setWorkspaceMembers(members)
        setInvitations(invites)
      } catch (nextError) {
        if (!active) return
        setError(nextError.message ?? "Failed to load team workspace.")
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [month, workspace?.id])

  const visibleAccountSummaries = useMemo(
    () => accountSummaries.filter((account) => isVisibleAdminAccount(account)),
    [accountSummaries]
  )
  const visibleCalendarItems = useMemo(
    () => calendarItems.filter((item) => isVisibleAdminAccount(item)),
    [calendarItems]
  )
  const workers = useMemo(() => {
    if (visibleAccountSummaries.length > 0) {
      return buildWorkerRows(visibleAccountSummaries)
    }

    return buildWorkerRowsFromCalendar(visibleCalendarItems)
  }, [visibleAccountSummaries, visibleCalendarItems])
  const memberRows = useMemo(
    () => buildMemberRows(workspaceMembers, workers),
    [workspaceMembers, workers]
  )
  const pendingInvitations = useMemo(
    () => invitations.filter((invite) => invite.status === "pending"),
    [invitations]
  )
  const totalWallets = useMemo(
    () => memberRows.reduce((sum, member) => sum + Number(member.accounts_count ?? 0), 0),
    [memberRows]
  )
  const maxMembers = workspace?.capabilities?.maxMembers ?? 1
  const maxWalletsPerUser = workspace?.capabilities?.maxWalletsPerUser ?? 1
  const currentMembers = memberRows.length
  const consumedSeats = currentMembers + pendingInvitations.length
  const seatsReached = consumedSeats >= maxMembers
  const shouldUpgradePlan =
    workspace?.plan === "team" ||
    seatsReached ||
    memberRows.some((member) => member.accounts_count >= maxWalletsPerUser)
  const teamTotalPnl = useMemo(
    () => memberRows.reduce((sum, member) => sum + Number(member.total_pnl ?? 0), 0),
    [memberRows]
  )
  const calendarDays = useMemo(
    () => buildCalendarDays(month, visibleCalendarItems),
    [month, visibleCalendarItems]
  )
  const isTeamMode = Boolean(workspace?.capabilities?.teamMode)

  async function refreshTeamData() {
    if (!workspace?.id) return

    const { dateFrom, dateTo } = getMonthRange(month)
    const [members, summaries, dailyItems, invites] = await Promise.all([
      loadWorkspaceMembers(workspace.id),
      loadWorkerSummaries(workspace.id),
      loadTeamDailyPnl(dateFrom, dateTo, workspace.id),
      loadWorkspaceInvitations(workspace.id),
      refreshWorkspace(),
    ])

    setWorkspaceMembers(members)
    setAccountSummaries(summaries)
    setCalendarItems(dailyItems)
    setInvitations(invites)
  }

  async function handleCreateInvitation() {
    if (!workspace?.id) return

    const normalizedEmail = inviteEmail.trim().toLowerCase()

    if (!normalizedEmail) {
      setError("Email is required to create an invitation.")
      return
    }

    try {
      setIsInviting(true)
      setError("")
      setCopiedInvitationId("")

      await inviteWorkspaceMemberByEmail(workspace.id, normalizedEmail, inviteRole)
      await refreshTeamData()
      setInviteEmail("")
      setInviteRole("member")
    } catch (nextError) {
      setError(nextError.message ?? "Failed to create invitation.")
    } finally {
      setIsInviting(false)
    }
  }

  async function handleRevokeInvitation(invitationId) {
    try {
      setRevokingInvitationId(invitationId)
      setError("")
      await revokeWorkspaceInvitation(invitationId)
      await refreshTeamData()
    } catch (nextError) {
      setError(nextError.message ?? "Failed to revoke invitation.")
    } finally {
      setRevokingInvitationId("")
    }
  }

  async function handleCopyInvitationLink(invite) {
    try {
      await navigator.clipboard.writeText(createInvitationLink(invite.token))
      setCopiedInvitationId(invite.id)
    } catch {
      setError("Failed to copy invitation link.")
    }
  }

  if (!isTeamMode) {
    return (
      <div className="min-h-screen bg-[#020617] p-6 text-white md:p-10">
        <div className="mx-auto max-w-5xl">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-6 py-8">
              <div className="text-sm uppercase tracking-[0.2em] text-slate-500">Team Workspace</div>
              <h1 className="mt-3 text-3xl font-bold">Team mode is not enabled</h1>
              <div className="mt-3 max-w-2xl text-sm text-slate-400">
                This workspace is currently in Solo mode. Upgrade to a Team plan to unlock members,
                invitations, and workspace-level management.
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                >
                  <Link to="/">Back to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Team workspace</div>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Team Dashboard</h1>
            <div className="mt-2 text-sm text-slate-400">
              {workspace?.name ?? "Workspace"} · {workspace?.plan ?? "team"} · {user.email}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Link to="/">Back to dashboard</Link>
            </Button>
            <Button
              variant="outline"
              onClick={signOut}
              className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              Sign out
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
          <StatCard
            title="Team Total PnL"
            value={`${teamTotalPnl >= 0 ? "+" : ""}$${teamTotalPnl.toFixed(2)}`}
            valueClassName={teamTotalPnl >= 0 ? "text-green-400" : "text-red-400"}
            description="Combined performance across accepted members."
          />
          <StatCard
            title="Members"
            value={`${currentMembers} / ${maxMembers}`}
            description="Accepted members currently active in this workspace."
          />
          <StatCard
            title="Pending invites"
            value={`${pendingInvitations.length}`}
            description={`Invites consume capacity. Total seats in use: ${consumedSeats} / ${maxMembers}.`}
          />
          <StatCard
            title="Wallet usage"
            value={String(totalWallets)}
            description={`Current plan allows up to ${maxWalletsPerUser} wallets per user.`}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0 lg:col-span-2">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-2 text-sm text-slate-400">Calendar month</div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                  className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                >
                  Prev month
                </Button>
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                />
                <Button
                  variant="outline"
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                  className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                >
                  Next month
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="mb-2 text-sm text-slate-400">Invite member</div>
              <div className="text-lg font-semibold text-white">Create a secure invitation link</div>
              <div className="mt-2 text-sm text-slate-500">
                Seats in use: {consumedSeats} / {maxMembers}. If the limit is reached, invites are blocked.
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="member@example.com"
                  className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
                  disabled={isInviting || seatsReached}
                />
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-800 bg-[#020617] px-3 text-white outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isInviting || seatsReached}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <Button
                  className="h-10 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                  onClick={handleCreateInvitation}
                  disabled={isInviting || seatsReached || !inviteEmail.trim()}
                >
                  {isInviting ? "Creating invite..." : "Create invitation"}
                </Button>
                <div className="text-xs text-slate-500">
                  Users do not join immediately. They must open the invitation link, log in, and accept.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {shouldUpgradePlan ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="text-sm uppercase tracking-[0.18em] text-amber-300">Upgrade recommended</div>
            <div className="mt-2 text-xl font-semibold text-white">
              {workspace?.plan === "team"
                ? "Move to Enterprise before you run into capacity issues."
                : "This workspace is close to its current limit."}
            </div>
            <div className="mt-2 text-sm text-amber-100/80">
              Upgrade when seat usage, pending invites, or wallet capacity per member gets too tight.
            </div>
          </div>
        ) : null}

        <Card className="mb-6 border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
            {isLoading ? (
              <div className="text-sm text-slate-400">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="text-sm text-slate-400">No invitations yet.</div>
            ) : (
              <div className="space-y-3">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-2xl border border-slate-800 bg-[#020617] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-white">{invite.email}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatRole(invite.role)} · {formatInvitationStatus(invite.status)} · expires{" "}
                          {formatDateTime(invite.expiresAt)}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          invited by {invite.invitedByEmail || "workspace admin"}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {invite.status === "pending" ? (
                          <Button
                            variant="outline"
                            className="rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                            onClick={() => handleCopyInvitationLink(invite)}
                          >
                            {copiedInvitationId === invite.id ? "Link copied" : "Copy invite link"}
                          </Button>
                        ) : null}
                        {invite.status === "pending" ? (
                          <Button
                            variant="outline"
                            className="rounded-xl border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                            onClick={() => handleRevokeInvitation(invite.id)}
                            disabled={revokingInvitationId === invite.id}
                          >
                            {revokingInvitationId === invite.id ? "Revoking..." : "Revoke"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Member roster</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
            {isLoading ? (
              <div className="text-sm text-slate-400">Loading team members...</div>
            ) : memberRows.length === 0 ? (
              <div className="text-sm text-slate-400">No members found yet.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {memberRows.map((member) => (
                  <div key={member.user_id} className="rounded-2xl border border-slate-800 bg-[#020617] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{member.display_name || member.email}</div>
                        <div className="mt-1 text-xs text-slate-500">{member.email}</div>
                      </div>
                      <div className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        {formatRole(member.role)}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <MemberMetric label="Wallets" value={`${member.accounts_count} / ${maxWalletsPerUser}`} />
                      <MemberMetric
                        label="PnL"
                        value={`${member.total_pnl >= 0 ? "+" : ""}$${member.total_pnl.toFixed(2)}`}
                      />
                      <MemberMetric label="Trades" value={String(member.trades_count)} />
                      <MemberMetric label="Win rate" value={`${member.win_rate.toFixed(1)}%`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Participants</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pt-4 pb-2 md:pb-4">
            {isLoading ? (
              <div className="px-6 pb-6 text-slate-400">Loading participant stats...</div>
            ) : memberRows.length === 0 ? (
              <div className="px-6 pb-6 text-slate-400">No participants found yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-medium">Member</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Wallets</th>
                      <th className="px-6 py-3 font-medium">Start Balance</th>
                      <th className="px-6 py-3 font-medium">Total PnL</th>
                      <th className="px-6 py-3 font-medium">Streak</th>
                      <th className="px-6 py-3 font-medium">Win Rate</th>
                      <th className="px-6 py-3 font-medium">Trades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((member) => (
                      <tr key={member.user_id} className="border-b border-slate-900/80">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{member.display_name || member.email}</div>
                          <div className="mt-1 text-xs text-slate-500">{member.email}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-300">{formatRole(member.role)}</td>
                        <td className="px-6 py-4 text-slate-300">
                          {member.accounts_count} / {maxWalletsPerUser}
                        </td>
                        <td className="px-6 py-4 text-slate-300">${member.start_balance.toFixed(2)}</td>
                        <td
                          className={`px-6 py-4 font-medium ${
                            member.total_pnl >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {member.total_pnl >= 0 ? "+" : ""}${member.total_pnl.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-slate-300">
                          {member.streak_count}
                          {member.streak_label}
                        </td>
                        <td className="px-6 py-4 text-slate-300">{member.win_rate.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-slate-300">{member.trades_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
            <CardTitle className="text-xl font-semibold">Team Daily PnL Calendar</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
              {calendarDays.map((day) => (
                <div key={day.date} className="rounded-xl border border-slate-800 bg-[#020617] p-3">
                  <div className="mb-3 text-sm font-semibold text-white">{day.label}</div>
                  <div className="space-y-2">
                    {day.items.length === 0 ? (
                      <div className="text-xs text-slate-500">No activity</div>
                    ) : (
                      day.items.map((item) => (
                        <div
                          key={`${day.date}-${item.user_id}-${item.account_id}`}
                          className="rounded-lg border border-slate-800 bg-slate-950 p-2"
                        >
                          <div className="truncate text-xs text-slate-200">{item.account_name}</div>
                          <div className="truncate text-[11px] text-slate-500">
                            {item.display_name || item.email}
                          </div>
                          <div
                            className={`mt-1 text-xs font-semibold ${
                              item.daily_pnl >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {item.daily_pnl >= 0 ? "+" : ""}${item.daily_pnl.toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function getCurrentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

function getMonthRange(monthValue) {
  const [year, month] = monthValue.split("-").map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)

  return {
    dateFrom: formatDate(start),
    dateTo: formatDate(end),
  }
}

function buildCalendarDays(monthValue, items) {
  const [year, month] = monthValue.split("-").map(Number)
  const totalDays = new Date(year, month, 0).getDate()

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const date = formatDate(new Date(year, month - 1, day))

    return {
      date,
      label: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`,
      items: items.filter((item) => item.trade_date === date),
    }
  })
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

function formatDateTime(dateLike) {
  const date = new Date(dateLike)

  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleString()
}

function shiftMonth(monthValue, offset) {
  const [year, month] = monthValue.split("-").map(Number)
  const date = new Date(year, month - 1 + offset, 1)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function buildWorkerRows(accountSummaries) {
  const workers = new Map()

  for (const account of accountSummaries) {
    const existing = workers.get(account.user_id) ?? {
      user_id: account.user_id,
      display_name: account.display_name ?? "",
      email: account.email ?? "",
      role: account.role ?? "member",
      start_balance: 0,
      total_pnl: 0,
      trades_count: 0,
      accounts_count: 0,
      weighted_wins: 0,
      streak_count: 0,
      streak_label: "-",
    }

    existing.display_name = existing.display_name || account.display_name || ""
    existing.email = existing.email || account.email || ""
    existing.role = account.role || existing.role || "member"
    existing.start_balance += Number(account.start_balance ?? 0)
    existing.total_pnl += Number(account.total_pnl ?? 0)
    existing.trades_count += Number(account.trades_count ?? 0)
    existing.accounts_count += 1
    existing.weighted_wins +=
      (Number(account.win_rate ?? 0) / 100) * Number(account.trades_count ?? 0)

    if (Number(account.streak_count ?? 0) > existing.streak_count) {
      existing.streak_count = Number(account.streak_count ?? 0)
      existing.streak_label = account.streak_label ?? "-"
    }

    workers.set(account.user_id, existing)
  }

  return Array.from(workers.values()).map((worker) => ({
    ...worker,
    win_rate: worker.trades_count > 0 ? (worker.weighted_wins / worker.trades_count) * 100 : 0,
  }))
}

function buildWorkerRowsFromCalendar(calendarItems) {
  const workers = new Map()

  for (const item of calendarItems) {
    const existing = workers.get(item.user_id) ?? {
      user_id: item.user_id,
      display_name: item.display_name ?? "",
      email: item.email ?? "",
      role: item.role ?? "member",
      start_balance: 0,
      total_pnl: 0,
      trades_count: 0,
      accounts_count: 0,
      weighted_wins: 0,
      win_rate: 0,
      streak_count: 0,
      streak_label: "-",
      seenAccounts: new Set(),
    }

    existing.display_name = existing.display_name || item.display_name || ""
    existing.email = existing.email || item.email || ""
    existing.role = item.role || existing.role || "member"
    existing.total_pnl += Number(item.daily_pnl ?? 0)

    if (item.account_id && !existing.seenAccounts.has(item.account_id)) {
      existing.seenAccounts.add(item.account_id)
      existing.accounts_count += 1
    }

    workers.set(item.user_id, existing)
  }

  return Array.from(workers.values()).map((worker) => {
    delete worker.seenAccounts
    return worker
  })
}

function buildMemberRows(workspaceMembers, workers) {
  const workerMap = new Map(workers.map((worker) => [worker.user_id, worker]))

  return [...workspaceMembers]
    .map((member) => {
      const stats = workerMap.get(member.userId)

      return {
        user_id: member.userId,
        display_name: member.displayName,
        email: member.email,
        role: member.role,
        accounts_count: Number(stats?.accounts_count ?? 0),
        start_balance: Number(stats?.start_balance ?? 0),
        total_pnl: Number(stats?.total_pnl ?? 0),
        trades_count: Number(stats?.trades_count ?? 0),
        streak_count: Number(stats?.streak_count ?? 0),
        streak_label: stats?.streak_label ?? "-",
        win_rate: Number(stats?.win_rate ?? 0),
      }
    })
    .sort((left, right) => {
      const leftWeight = getRoleWeight(left.role)
      const rightWeight = getRoleWeight(right.role)

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight
      }

      const leftName = (left.display_name || left.email || "").toLowerCase()
      const rightName = (right.display_name || right.email || "").toLowerCase()

      return leftName.localeCompare(rightName)
    })
}

function isVisibleAdminAccount(record) {
  if (record.account_type) {
    return record.account_type !== "main"
  }

  return (record.account_name ?? "").trim().toLowerCase() !== "main account"
}

function StatCard({ title, value, description, valueClassName = "text-white" }) {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle className="text-sm font-normal text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-2 pb-5">
        <div className={`text-3xl font-bold ${valueClassName}`}>{value}</div>
        <div className="mt-2 text-sm text-slate-500">{description}</div>
      </CardContent>
    </Card>
  )
}

function MemberMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-white">{value}</div>
    </div>
  )
}

function formatRole(role) {
  if (role === "owner") return "Owner"
  if (role === "admin") return "Admin"
  return "Member"
}

function formatInvitationStatus(status) {
  if (status === "pending") return "Pending"
  if (status === "accepted") return "Accepted"
  if (status === "revoked") return "Revoked"
  if (status === "expired") return "Expired"
  return status
}

function getRoleWeight(role) {
  if (role === "owner") return 0
  if (role === "admin") return 1
  return 2
}
