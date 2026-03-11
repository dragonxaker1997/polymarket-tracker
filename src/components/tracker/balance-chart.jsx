import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function BalanceChart({ data }) {
  return (
    <Card className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
      <CardHeader className="px-5 pt-5 pb-0 md:px-6 md:pt-6">
        <CardTitle className="text-xl font-semibold">Balance Growth</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pt-4 pb-5 md:px-6 md:pb-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />
              <Tooltip />
              <Line type="monotone" dataKey="balance" stroke="#38bdf8" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
