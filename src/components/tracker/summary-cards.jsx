import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SummaryCards({
  balance,
  startBalance,
  totalPnL,
  dailyPnL,
  tradesCount,
  transactionsCount,
  volume,
  streak,
  streakLabel,
  winRate,
  wins,
}) {
  const cards = [
    {
      label: "Balance",
      value: `$${balance.toFixed(2)}`,
      sub: `Start $${startBalance.toFixed(2)}`,
      valueClassName: "text-white",
    },
    {
      label: "Total PnL",
      value: `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`,
      sub: `${tradesCount} trades`,
      valueClassName: totalPnL >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Daily PnL",
      value: `${dailyPnL >= 0 ? "+" : ""}$${dailyPnL.toFixed(2)}`,
      sub: "today",
      valueClassName: dailyPnL >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "Transactions",
      value: String(transactionsCount),
      sub: `${tradesCount} journal records`,
      valueClassName: "text-white",
    },
    {
      label: "Volume",
      value: `$${volume.toFixed(2)}`,
      sub: "buy + sell turnover",
      valueClassName: "text-white",
    },
    {
      label: "Streak",
      value: `${streak}${streakLabel}`,
      sub: "current series",
      valueClassName: "text-white",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(1)}%`,
      sub: `${wins} wins`,
      valueClassName: "text-white",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
      {cards.map((card) => (
        <Card key={card.label} className="border-slate-800 bg-[#0f172a] py-0 text-white ring-0">
          <CardHeader className="gap-2 px-5 pt-5 pb-0">
            <CardTitle className="text-sm font-normal text-slate-400">{card.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pt-2 pb-5">
            <div className={`text-2xl font-bold md:text-3xl ${card.valueClassName}`}>{card.value}</div>
            <div className="mt-2 text-sm text-slate-500">{card.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
