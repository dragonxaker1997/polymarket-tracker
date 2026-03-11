import { useState } from "react"
import { Navigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/providers/use-auth"

export function LoginPage() {
  const { isConfigured, isLoading, user, signIn, signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isLoading && user) {
    return <Navigate to="/" replace />
  }

  async function handleAuth(action) {
    setError("")
    setIsSubmitting(true)

    try {
      await action(email, password)
    } catch (nextError) {
      setError(nextError.message ?? "Authentication failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
        <Card className="w-full max-w-md border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="px-6 pt-6 pb-0">
            <CardTitle className="text-3xl font-bold">Worker Login</CardTitle>
            <CardDescription className="text-slate-400">
              Каждый воркер входит под своим аккаунтом и видит только свой дашборд.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pt-6 pb-6">
            {!isConfigured ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Добавь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`, затем создай таблицы из README.
              </div>
            ) : null}

            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="worker@example.com"
              className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
            />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
            />

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button
              onClick={() => handleAuth(signIn)}
              disabled={!isConfigured || isSubmitting || !email || !password}
              className="h-11 w-full rounded-xl"
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAuth(signUp)}
              disabled={!isConfigured || isSubmitting || !email || !password}
              className="h-11 w-full rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              Create worker account
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
