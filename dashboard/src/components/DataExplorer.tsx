import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { query } from '@/lib/api'
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'

const VIEWS = {
  recent: {
    name: 'Recent Validations',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob6 as tld,
      blob1 as decision,
      double1 as risk_score,
      blob7 as pattern_type,
      blob8 as pattern_family,
      blob9 as is_disposable,
      blob10 as is_free_provider,
      blob13 as is_gibberish,
      blob19 as markov_detected,
      double9 as markov_confidence,
      blob3 as country,
      double5 as latency
    FROM ANALYTICS ORDER BY timestamp DESC LIMIT {limit}`
  },
  'high-risk': {
    name: 'High Risk (>0.6)',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob1 as decision,
      double1 as risk_score,
      blob2 as block_reason,
      blob7 as pattern_type,
      blob8 as pattern_family,
      blob9 as is_disposable,
      blob13 as is_gibberish,
      blob12 as has_keyboard_walk,
      blob19 as markov_detected,
      double9 as markov_confidence,
      double3 as bot_score,
      blob3 as country
    FROM ANALYTICS WHERE double1 > 0.6 ORDER BY double1 DESC, timestamp DESC LIMIT {limit}`
  },
  blocked: {
    name: 'Blocked Emails',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      double1 as risk_score,
      blob2 as block_reason,
      blob7 as pattern_type,
      blob8 as pattern_family,
      blob9 as is_disposable,
      blob13 as is_gibberish,
      blob12 as has_keyboard_walk,
      blob19 as markov_detected,
      double9 as markov_confidence,
      double3 as bot_score,
      blob3 as country,
      blob15 as client_ip
    FROM ANALYTICS WHERE blob1 = 'block' ORDER BY timestamp DESC LIMIT {limit}`
  },
  patterns: {
    name: 'Pattern Detections',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob1 as decision,
      double1 as risk_score,
      blob7 as pattern_type,
      blob8 as pattern_family,
      double8 as pattern_confidence,
      blob12 as has_keyboard_walk,
      blob13 as is_gibberish,
      blob9 as is_disposable,
      blob19 as markov_detected
    FROM ANALYTICS WHERE blob7 != 'none' ORDER BY timestamp DESC LIMIT {limit}`
  },
  disposable: {
    name: 'Disposable Domains',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob1 as decision,
      double1 as risk_score,
      blob7 as pattern_type,
      blob10 as is_free_provider,
      double7 as domain_reputation_score,
      blob3 as country,
      blob15 as client_ip
    FROM ANALYTICS WHERE blob9 = 'disposable' ORDER BY timestamp DESC LIMIT {limit}`
  },
  markov: {
    name: 'Markov Detections',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob1 as decision,
      double1 as risk_score,
      blob19 as markov_detected,
      double9 as markov_confidence,
      double10 as markov_cross_entropy_legit,
      double11 as markov_cross_entropy_fraud,
      blob7 as pattern_type,
      blob13 as is_gibberish,
      blob3 as country
    FROM ANALYTICS WHERE blob19 = 'yes' ORDER BY timestamp DESC LIMIT {limit}`
  },
  gibberish: {
    name: 'Gibberish Patterns',
    sql: `SELECT
      timestamp,
      blob14 as email_local_part,
      blob5 as domain,
      blob1 as decision,
      double1 as risk_score,
      blob13 as is_gibberish,
      double2 as entropy_score,
      blob7 as pattern_type,
      blob19 as markov_detected,
      double9 as markov_confidence,
      blob3 as country
    FROM ANALYTICS WHERE blob13 = 'yes' ORDER BY timestamp DESC LIMIT {limit}`
  },
  comprehensive: {
    name: 'Comprehensive View (All Columns)',
    sql: `SELECT
      timestamp,
      blob1 as decision,
      blob2 as block_reason,
      blob3 as country,
      blob4 as risk_bucket,
      blob5 as domain,
      blob6 as tld,
      blob7 as pattern_type,
      blob8 as pattern_family,
      blob9 as is_disposable,
      blob10 as is_free_provider,
      blob11 as has_plus_addressing,
      blob12 as has_keyboard_walk,
      blob13 as is_gibberish,
      blob14 as email_local_part,
      blob15 as client_ip,
      blob16 as user_agent,
      blob17 as variant,
      blob18 as exclude_from_training,
      blob19 as markov_detected,
      blob20 as experiment_id,
      double1 as risk_score,
      double2 as entropy_score,
      double3 as bot_score,
      double4 as asn,
      double5 as latency,
      double6 as tld_risk_score,
      double7 as domain_reputation_score,
      double8 as pattern_confidence,
      double9 as markov_confidence,
      double10 as markov_cross_entropy_legit,
      double11 as markov_cross_entropy_fraud,
      double12 as ip_reputation_score,
      double13 as bucket,
      index1 as fingerprint_hash,
      _sample_interval
    FROM ANALYTICS ORDER BY timestamp DESC LIMIT {limit}`
  }
}

export function DataExplorer() {
  const [view, setView] = useState<keyof typeof VIEWS>('recent')
  const [timeMinutes, setTimeMinutes] = useState('60')
  const [limit, setLimit] = useState('100')
  const [result, setResult] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState('30')
  const intervalRef = useRef<number | null>(null)

  const explore = async () => {
    try {
      setLoading(true)
      setError(null)

      const hours = Math.ceil(parseInt(timeMinutes) / 60)
      const selectedView = VIEWS[view]
      let sql = selectedView.sql.replace('{limit}', limit)

      // Add time filter if not in comprehensive view
      if (view !== 'comprehensive') {
        // Check if query already has WHERE clause
        if (sql.includes('WHERE')) {
          sql = sql.replace('WHERE', `WHERE timestamp >= NOW() - INTERVAL '${hours}' HOUR AND`)
        } else {
          sql = sql.replace('FROM ANALYTICS', `FROM ANALYTICS WHERE timestamp >= NOW() - INTERVAL '${hours}' HOUR`)
        }
      }

      const response = await query(sql, hours)
      setResult(response.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to explore data')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && result.length > 0) {
      const seconds = parseInt(refreshInterval)
      intervalRef.current = window.setInterval(() => {
        explore()
      }, seconds * 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, result.length])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const exportToCSV = () => {
    if (!result.length) return

    const headers = Object.keys(result[0])
    const csv = [
      headers.join(','),
      ...result.map(row =>
        headers.map(h => {
          const val = row[h]
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `explorer-${view}-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToJSON = () => {
    if (!result.length) return

    const json = JSON.stringify(result, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `explorer-${view}-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortedResult = [...result].sort((a, b) => {
    if (!sortColumn) return 0

    const aVal = a[sortColumn]
    const bVal = b[sortColumn]

    // Handle null/undefined
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    // Numeric comparison for numbers
    const aNum = parseFloat(aVal)
    const bNum = parseFloat(bVal)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    }

    // String comparison
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (sortDirection === 'asc') {
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
    } else {
      return bStr < aStr ? -1 : bStr > aStr ? 1 : 0
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Explorer</CardTitle>
        <CardDescription>
          Browse analytics data with pre-built views
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={view} onValueChange={(v) => setView(v as keyof typeof VIEWS)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VIEWS).map(([key, { name }]) => (
                <SelectItem key={key} value={key}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeMinutes} onValueChange={setTimeMinutes}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Last 15 minutes</SelectItem>
              <SelectItem value="60">Last 1 hour</SelectItem>
              <SelectItem value="360">Last 6 hours</SelectItem>
              <SelectItem value="1440">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>

          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="500">500 rows</SelectItem>
              <SelectItem value="1000">1000 rows</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={explore} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Exploring...' : 'Explore'}
          </Button>

          {result.length > 0 && (
            <>
              <Button variant="outline" onClick={explore} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={exportToJSON}>
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </>
          )}
        </div>

        {result.length > 0 && (
          <div className="flex gap-3 items-center p-3 bg-muted/30 rounded-md border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-sm font-medium">Auto-refresh</span>
            </label>
            {autoRefresh && (
              <Select value={refreshInterval} onValueChange={setRefreshInterval}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">Every 10 sec</SelectItem>
                  <SelectItem value="30">Every 30 sec</SelectItem>
                  <SelectItem value="60">Every 1 min</SelectItem>
                  <SelectItem value="300">Every 5 min</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 border border-destructive rounded-md bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {result.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-sm min-w-max">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {Object.keys(result[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-2 text-left font-medium whitespace-nowrap cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 select-none bg-gray-100 dark:bg-gray-900 border-b border-border opacity-100"
                        onClick={() => handleSort(key)}
                      >
                        <div className="flex items-center gap-1">
                          {key}
                          {sortColumn === key ? (
                            sortDirection === 'asc' ?
                              <ArrowUp className="h-3 w-3" /> :
                              <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedResult.map((row, i) => (
                    <tr key={i} className={`border-t hover:bg-muted/50 ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                      {Object.entries(row).map(([key, val], j) => {
                        // Color coding for risk_score
                        if (key === 'risk_score') {
                          const score = parseFloat(String(val))
                          let colorClass = ''
                          if (score >= 0.7) colorClass = 'text-red-600 dark:text-red-400 font-semibold'
                          else if (score >= 0.4) colorClass = 'text-orange-600 dark:text-orange-400 font-semibold'
                          else if (score >= 0.2) colorClass = 'text-yellow-600 dark:text-yellow-400 font-medium'
                          else colorClass = 'text-green-600 dark:text-green-400'

                          return (
                            <td key={j} className={`px-4 py-2 whitespace-nowrap ${colorClass}`}>
                              {String(val)}
                            </td>
                          )
                        }

                        // Color coding for decision
                        if (key === 'decision') {
                          let bgClass = ''
                          let textClass = ''
                          if (val === 'block') {
                            bgClass = 'bg-red-100 dark:bg-red-950'
                            textClass = 'text-red-700 dark:text-red-300 font-semibold'
                          } else if (val === 'warn') {
                            bgClass = 'bg-yellow-100 dark:bg-yellow-950'
                            textClass = 'text-yellow-700 dark:text-yellow-300 font-medium'
                          } else if (val === 'allow') {
                            bgClass = 'bg-green-100 dark:bg-green-950'
                            textClass = 'text-green-700 dark:text-green-300'
                          }

                          return (
                            <td key={j} className="px-4 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-xs ${bgClass} ${textClass}`}>
                                {String(val)}
                              </span>
                            </td>
                          )
                        }

                        // Color coding for confidence scores
                        if (key === 'markov_confidence' || key === 'pattern_confidence' || key === 'bot_score') {
                          const score = parseFloat(String(val))
                          if (!isNaN(score)) {
                            let colorClass = ''
                            if (score >= 0.8) colorClass = 'text-red-600 dark:text-red-400 font-semibold'
                            else if (score >= 0.6) colorClass = 'text-orange-600 dark:text-orange-400 font-medium'
                            else if (score >= 0.4) colorClass = 'text-yellow-600 dark:text-yellow-400'
                            else colorClass = 'text-muted-foreground'

                            return (
                              <td key={j} className={`px-4 py-2 whitespace-nowrap ${colorClass}`}>
                                {String(val)}
                              </td>
                            )
                          }
                        }

                        // Color coding for entropy score (higher = more random)
                        if (key === 'entropy_score') {
                          const score = parseFloat(String(val))
                          if (!isNaN(score)) {
                            let colorClass = ''
                            if (score >= 4.0) colorClass = 'text-red-600 dark:text-red-400 font-semibold'
                            else if (score >= 3.5) colorClass = 'text-orange-600 dark:text-orange-400 font-medium'
                            else if (score >= 3.0) colorClass = 'text-yellow-600 dark:text-yellow-400'
                            else colorClass = 'text-muted-foreground'

                            return (
                              <td key={j} className={`px-4 py-2 whitespace-nowrap ${colorClass}`}>
                                {String(val)}
                              </td>
                            )
                          }
                        }

                        // Color coding for pattern types
                        if (key === 'pattern_type' && val !== 'none') {
                          let bgClass = 'bg-purple-100 dark:bg-purple-950'
                          let textClass = 'text-purple-700 dark:text-purple-300'

                          if (String(val).includes('keyboard')) {
                            bgClass = 'bg-orange-100 dark:bg-orange-950'
                            textClass = 'text-orange-700 dark:text-orange-300'
                          } else if (String(val).includes('repeat')) {
                            bgClass = 'bg-pink-100 dark:bg-pink-950'
                            textClass = 'text-pink-700 dark:text-pink-300'
                          }

                          return (
                            <td key={j} className="px-4 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-xs ${bgClass} ${textClass}`}>
                                {String(val)}
                              </span>
                            </td>
                          )
                        }

                        // Color coding for block reasons
                        if (key === 'block_reason' && val) {
                          return (
                            <td key={j} className="px-4 py-2 whitespace-nowrap text-red-600 dark:text-red-400 font-medium">
                              {String(val)}
                            </td>
                          )
                        }

                        // Color coding for boolean flags
                        if (key === 'is_disposable' || key === 'is_gibberish' || key === 'markov_detected' || key === 'has_keyboard_walk' || key === 'is_free_provider') {
                          if (val === 'yes' || val === 'disposable' || val === 'true') {
                            return (
                              <td key={j} className="px-4 py-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-xs bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium">
                                  {String(val)}
                                </span>
                              </td>
                            )
                          }
                        }

                        return (
                          <td key={j} className="px-4 py-2 whitespace-nowrap">
                            {String(val)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-muted text-sm text-muted-foreground">
              {result.length} row{result.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {result.length === 0 && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            Select options and click Explore to view data
          </div>
        )}
      </CardContent>
    </Card>
  )
}
