import { Link } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isAdminUser } from "@/lib/admin"
import { getPlanCapabilities } from "@/lib/plan-capabilities"
import { DEFAULT_START_BALANCE, isWithinDateRange } from "@/lib/trade-utils"
import { saveWorkerProfile, loadDashboard, resetDashboard } from "@/lib/trade-service"
import { setWorkspaceCooldownEnabled } from "@/lib/workspace-service"
import { useAccount } from "@/providers/use-account"
import { useAuth } from "@/providers/use-auth"

export function SettingsPage() {
  const { signOut, user } = useAuth()
  const {
    accounts,
    activeAccount,
    activeAccountId,
    workspace,
    setActiveAccountId,
    saveAccountUpdates,
    addWalletAccount,
    removeAccount,
    refreshWorkspace,
    refreshAccounts,
  } = useAccount()
  const [displayName, setDisplayName] = useState("")
  const [accountNameDraft, setAccountNameDraft] = useState("")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingAccountName, setIsSavingAccountName] = useState(false)
  const [isSavingCooldownSetting, setIsSavingCooldownSetting] = useState(false)
  const [isSavingWalletCount, setIsSavingWalletCount] = useState(false)
  const [isDeletingWalletId, setIsDeletingWalletId] = useState("")
  const [isResettingAccount, setIsResettingAccount] = useState(false)
  const [records, setRecords] = useState([])
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [walletCountInput, setWalletCountInput] = useState("1")
  const [error, setError] = useState("")
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const cooldownEnabled = workspace?.rules?.cooldownEnabled ?? true
  const canManageWorkspaceRules = workspace?.role === "owner" || workspace?.role === "admin"
  const walletUsage = useMemo(
    () => accounts.filter((account) => account.type !== "main").length,
    [accounts]
  )
  const walletAccounts = useMemo(
    () => accounts.filter((account) => account.type === "wallet"),
    [accounts]
  )
  const frontendPlanWalletLimit = getPlanCapabilities(workspace?.plan ?? "base").maxWalletsPerUser
  const walletLimit = workspace?.capabilities?.maxWalletsPerUser ?? 0
  const tradeLimit = workspace?.capabilities?.maxTradesPerUser ?? null
  const maxWalletCount = 30
  const effectiveWalletLimit =
    walletLimit > 0
      ? Math.min(walletLimit, frontendPlanWalletLimit, maxWalletCount)
      : Math.min(frontendPlanWalletLimit, maxWalletCount)
  const walletCountValue = Number(walletCountInput)
  const isWalletCountReducing =
    Number.isFinite(walletCountValue) && Number.isInteger(walletCountValue)
      ? walletCountValue < walletAccounts.length
      : false
  const isWalletLimitReached = walletAccounts.length >= effectiveWalletLimit

  useEffect(() => {
    setAccountNameDraft(activeAccount?.name ?? "")
  }, [activeAccount])

  useEffect(() => {
    setWalletCountInput(String(walletAccounts.length || 1))
  }, [walletAccounts.length])

  useEffect(() => {
    if (!activeAccountId || !user?.id) {
      setDisplayName("")
      setIsBootstrapping(false)
      return
    }

    let active = true

    async function bootstrapProfile() {
      setIsBootstrapping(true)
      setError("")

      try {
        const dashboard = await loadDashboard(
          user.id,
          activeAccountId,
          DEFAULT_START_BALANCE
        )

        if (!active) return
        setDisplayName(dashboard.displayName ?? "")
        setRecords(dashboard.records ?? [])
      } catch (nextError) {
        if (!active) return
        setError(nextError.message ?? "Failed to load settings.")
      } finally {
        if (active) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrapProfile()

    return () => {
      active = false
    }
  }, [activeAccountId, user?.id])

  async function handleProfileBlur() {
    try {
      setIsSavingProfile(true)
      setError("")
      await Promise.all([
        saveWorkerProfile(user.id, {
          displayName,
        }),
      ])
    } catch (nextError) {
      setError(nextError.message ?? "Failed to save settings.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  function handleExportCsv() {
    const exportTrades = records.filter((trade) => isWithinDateRange(trade.createdAt, exportFrom, exportTo))

    const rows = [
      [
        "created_at",
        "size",
        "entry_cents",
        "exit_cents",
        "pnl",
        "time",
        "atr",
        "rsi",
        "macd",
        "result",
        "note",
      ],
      ...exportTrades.map((trade) => [
        trade.createdAt ?? "",
        trade.recordType === "trade" ? trade.size : trade.amount,
        trade.recordType === "trade" ? (Number(trade.entry) * 100).toFixed(0) : "",
        trade.recordType === "trade" ? (Number(trade.exit) * 100).toFixed(0) : "",
        Number(trade.pnl).toFixed(2),
        trade.time ?? "",
        trade.atr ?? "",
        trade.rsi ?? "",
        trade.macd ?? "",
        trade.recordType,
        trade.note ?? "",
      ]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `trades-${exportFrom || "all"}-${exportTo || "all"}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleAccountNameBlur() {
    if (!activeAccount) return

    const trimmedName = accountNameDraft.trim()

    if (!trimmedName || trimmedName === activeAccount.name) {
      setAccountNameDraft(activeAccount.name)
      return
    }

    try {
      setIsSavingAccountName(true)
      setError("")
      await saveAccountUpdates(activeAccount.id, { name: trimmedName })
      await refreshAccounts()
    } catch (nextError) {
      setAccountNameDraft(activeAccount.name)
      setError(nextError.message ?? "Failed to rename account.")
    } finally {
      setIsSavingAccountName(false)
    }
  }

  async function handleCooldownToggle(nextEnabled) {
    if (!workspace?.id || !canManageWorkspaceRules) return

    try {
      setIsSavingCooldownSetting(true)
      setError("")
      await setWorkspaceCooldownEnabled(workspace.id, nextEnabled)
      await refreshWorkspace()
    } catch (nextError) {
      setError(nextError.message ?? "Failed to update cooldown setting.")
    } finally {
      setIsSavingCooldownSetting(false)
    }
  }

  async function handleResetActiveAccount() {
    if (!user?.id || !activeAccountId) return

    const confirmed = window.confirm(
      "Reset active account? This will permanently delete trades and balance events for this account."
    )

    if (!confirmed) return

    try {
      setIsResettingAccount(true)
      setError("")
      await resetDashboard(user.id, activeAccountId)
      setRecords([])
    } catch (nextError) {
      setError(nextError.message ?? "Failed to reset active account.")
    } finally {
      setIsResettingAccount(false)
    }
  }

  async function handleWalletCountApply() {
    const nextCount = Number(walletCountInput)

    if (!Number.isInteger(nextCount) || nextCount < 1 || nextCount > effectiveWalletLimit) {
      setError(`Wallet count must be between 1 and ${effectiveWalletLimit}.`)
      return
    }

    try {
      setIsSavingWalletCount(true)
      setError("")
      const currentWallets = [...walletAccounts].sort((a, b) => a.sortOrder - b.sortOrder)

      if (nextCount < currentWallets.length) {
        setError("Delete wallets manually before reducing wallet count.")
        return
      }

      if (nextCount > currentWallets.length) {
        if (currentWallets.length >= effectiveWalletLimit) {
          setError("Wallet limit reached. Delete wallets or upgrade your plan.")
          return
        }

        let nextIndex =
          currentWallets.reduce((max, wallet) => {
            const match = /^Wallet\s+(\d+)$/i.exec(wallet.name ?? "")
            return match ? Math.max(max, Number(match[1])) : max
          }, 0) + 1

        for (let index = currentWallets.length; index < nextCount; index += 1) {
          if (index >= effectiveWalletLimit) {
            setError("Wallet limit reached. Delete wallets or upgrade your plan.")
            break
          }
          await addWalletAccount(`Wallet ${nextIndex}`)
          nextIndex += 1
        }
      }

      await refreshAccounts()
    } catch (nextError) {
      const isLimitError =
        (nextError.message ?? "").toLowerCase().includes("limit") ||
        (nextError.message ?? "").toLowerCase().includes("plan")
      setError(
        isLimitError
          ? "Wallet limit reached. Delete wallets or upgrade your plan."
          : nextError.message ?? "Failed to update wallet count."
      )
    } finally {
      setIsSavingWalletCount(false)
    }
  }

  async function handleDeleteWallet(wallet) {
    if (!wallet?.id) return
    if (walletAccounts.length <= 1) {
      setError("At least one wallet is required.")
      return
    }

    const confirmed = window.confirm(`Delete ${wallet.name}? This action cannot be undone.`)

    if (!confirmed) return

    try {
      setIsDeletingWalletId(wallet.id)
      setError("")
      await removeAccount(wallet.id)
      await refreshAccounts()
    } catch (nextError) {
      setError(nextError.message ?? "Failed to delete wallet.")
    } finally {
      setIsDeletingWalletId("")
    }
  }

  if (isBootstrapping) {
    return (
      <CenteredState
        title="Loading settings..."
        subtitle="Preparing account and discipline configuration."
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] p-6 text-white md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Polymarket journal</div>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Settings</h1>
            <div className="mt-2 text-sm text-slate-400">
              Account profile, discipline controls, and workspace-level options.
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
            >
              <Link to="/">Back to dashboard</Link>
            </Button>
            {workspace?.capabilities?.teamMode || isAdminUser(user?.email) ? (
              <Button
                asChild
                variant="outline"
                className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
              >
                <Link to="/admin">
                  {workspace?.capabilities?.teamMode ? "Team workspace" : "Admin overview"}
                </Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={signOut}
              className="w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800 md:w-auto"
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

        <div className="mb-6 rounded-xl border border-slate-800 bg-[#0f172a] p-5">
          <div className="mb-2 text-sm text-slate-400">Active wallet</div>
          <select
            value={activeAccountId}
            onChange={(event) => setActiveAccountId(event.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-3 outline-none focus:border-slate-600"
          >
            {(walletAccounts.length ? walletAccounts : accounts).map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-slate-500">Account</div>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 text-sm text-slate-400">Account name</div>
                  <input
                    className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    value={accountNameDraft}
                    onChange={(event) => setAccountNameDraft(event.target.value)}
                    onBlur={handleAccountNameBlur}
                    placeholder="Account name"
                    disabled={!activeAccount || isSavingAccountName}
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm text-slate-400">Worker name</div>
                  <input
                    className="w-full rounded-xl border border-slate-800 bg-[#020617] px-3 py-2.5 outline-none focus:border-slate-600"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onBlur={handleProfileBlur}
                    placeholder="Enter your worker name"
                  />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {isSavingProfile ? "Saving account settings..." : "Values are saved per active account."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-slate-500">Wallets</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  type="number"
                  min={1}
                  max={effectiveWalletLimit}
                  value={walletCountInput}
                  onChange={(event) => setWalletCountInput(event.target.value)}
                  className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
                />
                <Button
                  onClick={handleWalletCountApply}
                  disabled={isSavingWalletCount || isWalletCountReducing}
                  className="h-10 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                >
                  {isSavingWalletCount ? "Saving..." : "Apply"}
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Set wallet count (max {effectiveWalletLimit} for your plan).
              </div>
              {isWalletCountReducing ? (
                <div className="mt-2 text-xs text-amber-300">
                  To reduce wallet count, delete wallets manually first.
                </div>
              ) : null}
              {isWalletLimitReached ? (
                <div className="mt-2 text-xs text-amber-300">
                  Wallet limit reached. Delete wallets or upgrade your plan.
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {walletAccounts.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#020617] px-3 py-2"
                  >
                    <div className="text-sm text-slate-200">{wallet.name}</div>
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteWallet(wallet)}
                      disabled={walletAccounts.length <= 1 || isDeletingWalletId === wallet.id}
                      className="h-8 rounded-lg border-slate-700 bg-slate-900 px-3 text-xs text-white hover:bg-slate-800"
                    >
                      {isDeletingWalletId === wallet.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-slate-500">Discipline</div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">Enable cooldown protection</div>
                  <div className="mt-1 text-xs text-slate-400">
                    When disabled, loss/profit cooldown rules will not block trading
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cooldownEnabled}
                  disabled={!canManageWorkspaceRules || isSavingCooldownSetting}
                  onClick={() => handleCooldownToggle(!cooldownEnabled)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                    cooldownEnabled ? "bg-green-500" : "bg-slate-700"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      cooldownEnabled ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {!canManageWorkspaceRules
                  ? "Only owner/admin can change discipline rules."
                  : isSavingCooldownSetting
                    ? "Saving cooldown setting..."
                    : cooldownEnabled
                      ? "Cooldown protection is enabled."
                      : "Cooldown protection is disabled for this workspace."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-slate-500">Workspace</div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4">
                <div className="text-sm text-slate-400">Limits</div>
                <div className="mt-2 text-sm text-slate-200">
                  Wallets: {walletUsage}/{effectiveWalletLimit}
                  {" • "}
                  Trades: {tradeLimit === null ? "Unlimited" : tradeLimit}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-4">
                <div className="text-sm text-slate-400">Upgrade</div>
                <div className="mt-2 text-sm text-slate-300">
                  Upgrade when you need more wallets, seats, or team-scale capacity.
                </div>
                <Button
                  className="mt-3 h-10 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                  onClick={() =>
                    window.alert("Upgrade CTA placeholder: move from current plan to higher tier.")
                  }
                >
                  Upgrade plan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-slate-500">Export</div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input
                  type="date"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                  className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
                />
                <Input
                  type="date"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                  className="h-10 rounded-xl border-slate-800 bg-slate-950 text-white"
                />
                <Button
                  onClick={handleExportCsv}
                  className="h-10 rounded-xl bg-slate-100 text-slate-950 hover:bg-white"
                >
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/40 bg-[#1a1117] py-0 text-white ring-0">
            <CardContent className="px-5 pt-5 pb-5">
              <div className="text-sm uppercase tracking-[0.16em] text-red-300">Danger zone</div>
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="text-sm font-medium text-white">Reset active account</div>
                <div className="mt-1 text-xs text-red-200/90">
                  Deletes all trades and balance events for the currently selected account.
                </div>
                <Button
                  onClick={handleResetActiveAccount}
                  disabled={isResettingAccount || !activeAccountId}
                  className="mt-3 h-10 rounded-xl bg-red-600 text-white hover:bg-red-500"
                >
                  {isResettingAccount ? "Resetting..." : "Reset active account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CenteredState({ title, subtitle }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <div className="max-w-md text-center">
        <div className="text-2xl font-semibold">{title}</div>
        <div className="mt-2 text-slate-400">{subtitle}</div>
      </div>
    </div>
  )
}
