"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { matchVolume } from "@/lib/mock-data"

const chartConfig = {
  matched: {
    label: "Matched",
    color: "var(--chart-1)",
  },
  exceptions: {
    label: "Exceptions",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig

export function MatchVolumeChart() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Matching volume</CardTitle>
        <CardDescription>Matched vs. flagged transactions, last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart data={matchVolume}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="font-sans text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="matched" fill="var(--color-matched)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="exceptions" fill="var(--color-exceptions)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
