import { useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"

import polyjournalLogo from "@/assets/polyjournal-logo.svg"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/providers/use-auth"

export function LoginPage() {
  const { isConfigured, isLoading, user, signIn, signUp } = useAuth()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const nextPath = searchParams.get("next") || "/"

  if (!isLoading && user) {
    return <Navigate to={nextPath} replace />
  }

  async function handleSignIn() {
    setError("")
    setSuccess("")
    setIsSubmitting(true)

    try {
      await signIn(email.trim(), password)
    } catch (nextError) {
      setError(nextError.message ?? "Authentication failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignUp() {
    setError("")
    setSuccess("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const result = await signUp(email.trim(), password)

      if (result?.needsEmailConfirmation) {
        setSuccess(
          "Account created. Check your email and confirm registration before signing in."
        )
      } else {
        setSuccess("Account created successfully. You can now continue into the app.")
      }
    } catch (nextError) {
      setError(nextError.message ?? "Registration failed.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError("")
    setSuccess("")
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <header className="border-b border-slate-800/70 px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={polyjournalLogo} alt="PolyJournal logo" className="h-8 w-8" />
            <span className="text-xl font-semibold tracking-tight">PolyJournal</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => switchMode("signin")}
              className="h-9 rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              Login
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-lg border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
            >
              <Link to="/upgrade">Pricing</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
          <section>
            <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
              Track your trades.
              <br />
              Control your edge.
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
              Private trading journal for Polymarket. Track PnL, control risk, and stay consistent.
            </p>

            <Card className="mt-7 border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
              <CardContent className="px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-300">PolyJournal Preview</div>
                  <div className="text-xs text-slate-500">Sample workspace</div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MiniMetric label="Balance" value="$184.22" tone="text-white" />
                  <MiniMetric label="Daily PnL" value="+$12.40" tone="text-green-400" />
                  <MiniMetric label="Streak" value="4W" tone="text-white" />
                </div>
                <div className="mt-4 rounded-xl border border-slate-800 bg-[#020617] p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Balance growth</div>
                  <div className="mt-3 flex h-24 items-end gap-2">
                    {[28, 35, 31, 45, 52, 49, 60, 68, 64, 73].map((value, index) => (
                      <div
                        key={index}
                        className="w-full rounded-sm bg-blue-500/80"
                        style={{ height: `${value}%` }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="login">
            <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <CardTitle className="text-2xl font-bold">
                  {mode === "signin" ? "Login" : "Create account"}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {mode === "signin"
                    ? "Access your private trading workspace."
                    : "Create your account and start tracking."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pt-6 pb-6">
                {!isConfigured ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to continue.
                  </div>
                ) : null}

                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
                />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
                />
                {mode === "signup" ? (
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    className="h-11 rounded-xl border-slate-800 bg-[#020617] px-3 text-white placeholder:text-slate-500"
                  />
                ) : null}

                {error ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
                    {success}
                  </div>
                ) : null}

                {mode === "signin" ? (
                  <Button
                    onClick={handleSignIn}
                    disabled={!isConfigured || isSubmitting || !email.trim() || !password}
                    className="h-11 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                  >
                    {isSubmitting ? "Signing in..." : "Login"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleSignUp}
                    disabled={
                      !isConfigured ||
                      isSubmitting ||
                      !email.trim() ||
                      !password ||
                      !confirmPassword
                    }
                    className="h-11 w-full rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                  >
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </Button>
                )}

                <div className="text-sm text-slate-400">
                  {mode === "signin" ? "No account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                    className="font-medium text-white hover:text-slate-300"
                  >
                    {mode === "signin" ? "Create one" : "Login"}
                  </button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        <section className="mx-auto mt-10 w-full max-w-6xl">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdvantageCard
              title="Real PnL tracking"
              description="See your real performance, not guesses."
            />
            <AdvantageCard
              title="Risk control"
              description="Track losses, streaks, and behavior."
            />
            <AdvantageCard
              title="Built for Polymarket"
              description="Designed for prediction market workflows."
            />
            <AdvantageCard
              title="Private workspace"
              description="Keep your trades and strategy structured."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/70 px-4 py-4 text-sm text-slate-400 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>PolyJournal © {new Date().getFullYear()}</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-300">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function MiniMetric({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#020617] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function AdvantageCard({ title, description }) {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
      <CardContent className="px-4 py-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{description}</div>
      </CardContent>
    </Card>
  )
}
