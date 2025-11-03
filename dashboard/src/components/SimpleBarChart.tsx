import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react'

interface SimpleBarChartProps {
  title: string
  description?: string
  data: Array<Record<string, string | number>>
  dataKey: string
  nameKey: string
  color?: string
  loading?: boolean
  onRefresh?: () => void
}

export function SimpleBarChart({
  title,
  description,
  data,
  dataKey,
  nameKey,
  color = 'hsl(var(--chart-1))',
  loading = false,
  onRefresh
}: SimpleBarChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hasData = data && data.length > 0

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <Card className={isFullscreen ? "fixed inset-4 z-50 overflow-auto" : undefined}>
      <CardHeader
        actions={
          <>
            {onRefresh && (
              <Button
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </>
        }
      >
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className={`${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[300px]'} flex items-center justify-center`}>
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasData ? (
          <ChartContainer
            config={{
              [dataKey]: { label: 'Count', color },
            }}
            className={isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[300px]'}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey={nameKey} className="text-xs" angle={-45} textAnchor="end" height={80} />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className={`${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[300px]'} flex items-center justify-center text-muted-foreground text-sm`}>
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
