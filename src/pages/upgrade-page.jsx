import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function UpgradePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center">
        <div className="text-3xl font-bold">Upgrade</div>
        <div className="mt-3 text-slate-300">Upgrade plans will be available soon</div>
        <Button
          asChild
          variant="outline"
          className="mt-6 rounded-xl border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
        >
          <Link to="/">Back to PolyJournal</Link>
        </Button>
      </div>
    </div>
  )
}
