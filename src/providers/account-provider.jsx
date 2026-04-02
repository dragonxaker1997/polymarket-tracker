import { useEffect, useMemo, useState } from "react"

import {
  createCustomAccount,
  ensureDefaultAccounts,
  loadAccounts,
  updateAccount,
} from "@/lib/account-service"
import { AccountContext } from "@/providers/account-context"
import { useAuth } from "@/providers/use-auth"

function getStoredActiveAccountId(userId) {
  if (typeof window === "undefined" || !userId) return ""

  return window.localStorage.getItem(`active-account:${userId}`) ?? ""
}

function setStoredActiveAccountId(userId, accountId) {
  if (typeof window === "undefined" || !userId) return

  window.localStorage.setItem(`active-account:${userId}`, accountId)
}

export function AccountProvider({ children }) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [activeAccountId, setActiveAccountId] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setAccounts([])
      setActiveAccountId("")
      setIsLoading(false)
      return
    }

    let active = true

    async function bootstrap() {
      setIsLoading(true)

      try {
        await ensureDefaultAccounts(user.id)
        const nextAccounts = await loadAccounts(user.id)

        if (!active) return

        const storedAccountId = getStoredActiveAccountId(user.id)
        const initialAccount =
          nextAccounts.find((account) => account.id === storedAccountId) ?? nextAccounts[0] ?? null

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
    if (user?.id && activeAccountId) {
      setStoredActiveAccountId(user.id, activeAccountId)
    }
  }, [activeAccountId, user])

  async function refreshAccounts() {
    if (!user) return []

    const nextAccounts = await loadAccounts(user.id)
    setAccounts(nextAccounts)

    if (!nextAccounts.some((account) => account.id === activeAccountId)) {
      setActiveAccountId(nextAccounts[0]?.id ?? "")
    }

    return nextAccounts
  }

  async function addCustomAccount(name) {
    if (!user) throw new Error("User is not authenticated.")

    const nextSortOrder =
      accounts.reduce((maxSortOrder, account) => Math.max(maxSortOrder, account.sortOrder), 0) + 1

    const account = await createCustomAccount(user.id, name, nextSortOrder)
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

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  )

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccount,
        activeAccountId,
        isLoading,
        setActiveAccountId,
        addCustomAccount,
        saveAccountUpdates,
        refreshAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}
