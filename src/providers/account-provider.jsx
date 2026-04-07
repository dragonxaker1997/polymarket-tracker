import { useEffect, useMemo, useState } from "react"

import {
  createCustomAccount,
  createWalletAccount,
  deleteAccount,
  ensureDefaultAccounts,
  loadAccounts,
  updateAccount,
} from "@/lib/account-service"
import {
  ensurePersonalWorkspace,
  loadAccessibleWorkspaces,
  loadPrimaryWorkspace,
} from "@/lib/workspace-service"
import { AccountContext } from "@/providers/account-context"
import { useAuth } from "@/providers/use-auth"

function getStoredActiveAccountId(userId, workspaceId) {
  if (typeof window === "undefined" || !userId || !workspaceId) return ""

  return window.localStorage.getItem(`active-account:${userId}:${workspaceId}`) ?? ""
}

function setStoredActiveAccountId(userId, workspaceId, accountId) {
  if (typeof window === "undefined" || !userId || !workspaceId) return

  window.localStorage.setItem(`active-account:${userId}:${workspaceId}`, accountId)
}

export function AccountProvider({ children }) {
  const { user } = useAuth()
  const [workspace, setWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [accounts, setAccounts] = useState([])
  const [activeAccountId, setActiveAccountId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setWorkspace(null)
      setWorkspaces([])
      setAccounts([])
      setActiveAccountId("")
      setIsLoading(false)
      return
    }

    let active = true

    async function bootstrap() {
      setIsLoading(true)

      try {
        const workspaceId = await ensurePersonalWorkspace(user.id)
        await ensureDefaultAccounts(user.id, workspaceId)

        const [nextWorkspace, nextWorkspaces] = await Promise.all([
          loadPrimaryWorkspace(user.id),
          loadAccessibleWorkspaces(),
        ])
        const nextAccounts = await loadAccounts(user.id, nextWorkspace?.id)

        if (!active) return

        const storedAccountId = getStoredActiveAccountId(user.id, nextWorkspace?.id)
        const firstWallet = nextAccounts.find((account) => account.type === "wallet") ?? null
        const storedAccount = nextAccounts.find((account) => account.id === storedAccountId) ?? null
        const initialAccount =
          (storedAccount?.type === "wallet" ? storedAccount : null) ?? firstWallet ?? nextAccounts[0] ?? null

        setWorkspace(nextWorkspace)
        setWorkspaces(nextWorkspaces)
        setAccounts(nextAccounts)
        setActiveAccountId(initialAccount?.id ?? "")
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
  }, [user])

  useEffect(() => {
    if (user?.id && workspace?.id && activeAccountId) {
      setStoredActiveAccountId(user.id, workspace.id, activeAccountId)
    }
  }, [activeAccountId, user, workspace?.id])

  async function refreshAccounts() {
    if (!user || !workspace?.id) return []

    const nextAccounts = await loadAccounts(user.id, workspace.id)
    setAccounts(nextAccounts)

    if (!nextAccounts.some((account) => account.id === activeAccountId)) {
      const nextActive =
        nextAccounts.find((account) => account.type === "wallet") ?? nextAccounts[0] ?? null
      setActiveAccountId(nextActive?.id ?? "")
    }

    return nextAccounts
  }

  async function refreshWorkspace() {
    if (!user) return null

    const [nextWorkspace, nextWorkspaces] = await Promise.all([
      loadPrimaryWorkspace(user.id),
      loadAccessibleWorkspaces(),
    ])
    setWorkspace(nextWorkspace)
    setWorkspaces(nextWorkspaces)

    return nextWorkspace
  }

  async function addCustomAccount(name) {
    if (!user || !workspace?.id) {
      throw new Error("Workspace is not ready yet.")
    }

    const account = await createCustomAccount(workspace.id, name)
    const nextAccounts = [...accounts, account].sort((a, b) => a.sortOrder - b.sortOrder)
    setAccounts(nextAccounts)
    setActiveAccountId(account.id)

    return account
  }

  async function saveAccountUpdates(accountId, updates) {
    const updatedAccount = await updateAccount(accountId, updates)

    setAccounts((current) =>
      current.map((account) => (account.id === accountId ? updatedAccount : account))
    )

    return updatedAccount
  }

  async function addWalletAccount(name) {
    if (!workspace?.id) {
      throw new Error("Workspace is not ready yet.")
    }

    const account = await createWalletAccount(workspace.id, name)
    const nextAccounts = [...accounts, account].sort((a, b) => a.sortOrder - b.sortOrder)
    setAccounts(nextAccounts)

    return account
  }

  async function removeAccount(accountId) {
    await deleteAccount(accountId)
    setAccounts((current) => current.filter((account) => account.id !== accountId))
  }

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  )

  return (
    <AccountContext.Provider
      value={{
        accounts,
        workspace,
        workspaces,
        activeAccount,
        activeAccountId,
        isLoading,
        setActiveAccountId,
        addCustomAccount,
        addWalletAccount,
        removeAccount,
        saveAccountUpdates,
        refreshWorkspace,
        refreshAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}
