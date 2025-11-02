import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'
import { loadDecisions } from '@/lib/api'

const COLORS = {
  allow: 'hsl(142 76% 36%)',
  warn: 'hsl(48 96% 53%)',
  block: 'hsl(0 84% 60%)',
}

function App() {
  const [decisions, setDecisions] = useState<Array<{ decision: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await loadDecisions(24)
        setDecisions(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>Failed to load analytics data</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Make sure the API key is set in .env and the Worker is running
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Fraud Detection Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Real-time insights from your fraud detection system
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Decision Breakdown</CardTitle>
            <CardDescription>Distribution of validation decisions (Last 24 hours)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                allow: {
                  label: 'Allow',
                  color: COLORS.allow,
                },
                warn: {
                  label: 'Warn',
                  color: COLORS.warn,
                },
                block: {
                  label: 'Block',
                  color: COLORS.block,
                },
              }}
              className="h-[400px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={decisions}
                    dataKey="count"
                    nameKey="decision"
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    paddingAngle={2}
                  >
                    {decisions.map((entry) => (
                      <Cell
                        key={entry.decision}
                        fill={COLORS[entry.decision as keyof typeof COLORS] || 'hsl(var(--chart-1))'}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
