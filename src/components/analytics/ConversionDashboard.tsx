import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnalyticsService } from '@/lib/analytics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { IconRefresh, IconDownload, IconFilter } from '@/components/ui/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Types
interface ConversionEvent {
  conversionId: string
  value?: number
  timestamp: number
  path?: string
  source?: string
  // Additional optional properties for conversion events
  category?: string
  userId?: string
  metadata?: Record<string, string | number | boolean>
  tags?: string[]
  deviceInfo?: {
    type: string
    browser: string
    os: string
  }
}

export function ConversionDashboard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [filter, setFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [conversionEvents, setConversionEvents] = useState<ConversionEvent[]>(
    [],
  )
  const [activeTab, setActiveTab] = useState('overview')

  const analytics = AnalyticsService.getInstance()

  // Define loadConversionData function
  const loadConversionData = useCallback(async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch from an API
      // Here we're getting data from the AnalyticsService
      const events = analytics
        .getEvents()
        .filter((event) => event.eventType === 'conversion_event')

      // Transform to our expected format
      const conversions = events.map((event) => ({
        conversionId: event.data['conversionId'],
        value: event.data['value'],
        timestamp: event.timestamp,
        path: event.data['path'],
        source: event.data['source'],
        ...event.data,
      }))

      // Apply filter if needed
      const filtered =
        filter === 'all'
          ? conversions
          : conversions.filter((c) => String(c.conversionId) === filter)

      setConversionEvents(filtered as ConversionEvent[])
    } catch (error) {
      console.error('Failed to load conversion data', error)
    } finally {
      setIsLoading(false)
    }
  }, [analytics, filter])

  // Load conversion data
  useEffect(() => {
    loadConversionData()
  }, [period, filter, loadConversionData])

  // Calculate summary metrics
  const summaryData = useMemo(() => {
    // Group by conversion ID
    const conversionTypes = {} as Record<string, ConversionEvent[]>
    conversionEvents.forEach((event) => {
      if (!conversionTypes[event.conversionId]) {
        conversionTypes[event.conversionId] = []
      }
      conversionTypes[event.conversionId]!.push(event)
    })

    // Generate summary for each conversion type
    return Object.entries(conversionTypes).map(([id, events]) => {
      const totalValue = events.reduce(
        (sum, event) => sum + (event.value || 0),
        0,
      )

      // Calculate trend (last 7 days)
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const trend = Array(7)
        .fill(0)
        .map((_, i) => {
          const dayStart = now - (6 - i) * oneDay
          const dayEnd = dayStart + oneDay
          return events.filter(
            (e) => e.timestamp >= dayStart && e.timestamp < dayEnd,
          ).length
        })

      return {
        id,
        count: events.length,
        totalValue,
        conversionRate: (events.length / 1000) * 100, // Mockup rate based on 1000 page views
        trend,
      }
    })
  }, [conversionEvents])

  // Calculate sources breakdown
  const sourceData = useMemo(() => {
    const sources = {} as Record<string, { count: number; value: number }>

    conversionEvents.forEach((event) => {
      const source = event.source || 'direct'
      if (!sources[source]) {
        sources[source] = { count: 0, value: 0 }
      }
      sources[source].count++
      sources[source].value += event.value || 0
    })

    const totalCount = conversionEvents.length

    return Object.entries(sources).map(([source, data]) => ({
      source,
      count: data.count,
      value: data.value,
      percentage: (data.count / totalCount) * 100,
    }))
  }, [conversionEvents])

  // Calculate pages breakdown
  const pageData = useMemo(() => {
    const pages = {} as Record<string, { count: number; value: number }>

    conversionEvents.forEach((event) => {
      const path = event.path || '(not set)'
      if (!pages[path]) {
        pages[path] = { count: 0, value: 0 }
      }
      pages[path].count++
      pages[path].value += event.value || 0
    })

    // Page views would come from analytics in a real implementation
    const pageViews = {
      '/': 300,
      '/about': 120,
      '/products': 200,
      '/contact': 80,
      '/login': 150,
      '/signup': 100,
      '/checkout': 50,
      '(not set)': 50,
    }

    return Object.entries(pages).map(([path, data]) => ({
      path,
      count: data.count,
      value: data.value,
      conversionRate:
        (data.count / (pageViews[path as keyof typeof pageViews] || 1)) * 100,
    }))
  }, [conversionEvents])

  // Chart data for conversions over time
  const timeChartData = useMemo(() => {
    let labels: string[] = []

    // Generate labels based on selected period
    const now = new Date()
    if (period === 'daily') {
      // Last 7 days
      labels = Array(7)
        .fill(0)
        .map((_, i) => {
          const date = new Date()
          date.setDate(now.getDate() - (6 - i))
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        })
    } else if (period === 'weekly') {
      // Last 6 weeks
      labels = Array(6)
        .fill(0)
        .map((_, i) => {
          const date = new Date()
          date.setDate(now.getDate() - (5 - i) * 7)
          return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        })
    } else {
      // Last 6 months
      labels = Array(6)
        .fill(0)
        .map((_, i) => {
          const date = new Date()
          date.setMonth(now.getMonth() - (5 - i))
          return date.toLocaleDateString('en-US', { month: 'short' })
        })
    }

    // Generate dataset - in a real implementation this would use actual data
    // Here we're using mock data that would come from an analytics API
    return {
      labels,
      datasets: [
        {
          label: 'Conversions',
          data: [12, 19, 15, 22, 24, 28],
          backgroundColor: 'rgba(99, 102, 241, 0.5)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1,
        },
      ],
    }
  }, [period])

  // Chart data for conversion types
  const typeChartData = useMemo(() => {
    return {
      labels: summaryData.map((item) => item.id),
      datasets: [
        {
          label: 'Count',
          data: summaryData.map((item) => item.count),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    }
  }, [summaryData])

  // Export data as CSV
  const exportToCsv = () => {
    if (conversionEvents.length === 0) {
      return
    }

    // Create CSV content
    const headers = ['Conversion ID', 'Value', 'Timestamp', 'Source', 'Path']
    const csvRows = [
      headers.join(','),
      ...conversionEvents.map((event) =>
        [
          event.conversionId,
          event.value || 0,
          new Date(event.timestamp).toISOString(),
          event.source || 'direct',
          event.path || '(not set)',
        ].join(','),
      ),
    ]

    // Create and download file
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `conversions-${new Date().toISOString()}.csv`)
    link.click()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-xl font-bold">
              Conversion Tracking
            </CardTitle>
            <CardDescription>
              Track and analyze conversion events across your application
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadConversionData}
              disabled={isLoading}
            >
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCsv}
              disabled={isLoading || conversionEvents.length === 0}
            >
              <IconDownload className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <IconFilter className="h-4 w-4 text-gray-500" />

                <span className="text-sm text-gray-500">Filter:</span>
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Conversions</SelectItem>
                  <SelectItem value="signup">Signup</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex space-x-2">
              <Button
                variant={period === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('daily')}
              >
                Daily
              </Button>
              <Button
                variant={period === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('weekly')}
              >
                Weekly
              </Button>
              <Button
                variant={period === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Tabs
              defaultValue="overview"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sources">Traffic Sources</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="events">Event Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {summaryData.length > 0 ? (
                    summaryData.map((summary) => (
                      <Card key={summary.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg capitalize">
                            {summary.id}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">
                                Count:
                              </span>
                              <span className="font-semibold">
                                {summary.count}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">
                                Value:
                              </span>
                              <span className="font-semibold">
                                ${summary.totalValue.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">
                                Conversion Rate:
                              </span>
                              <span className="font-semibold">
                                {summary.conversionRate.toFixed(2)}%
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="text-sm text-gray-500 mb-1">
                                Last 7 days:
                              </div>
                              <div className="flex items-end space-x-1 h-8">
                                {summary.trend.map((value, i) => (
                                  <div
                                    key={`trend-${summary.id}-${i}-${value}`}
                                    className="bg-primary rounded-sm w-full"
                                    style={{
                                      height: `${Math.max(20, (value / Math.max(...summary.trend)) * 100)}%`,
                                      minHeight: '4px',
                                    }}
                                  ></div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="col-span-3">
                      <CardContent className="py-6">
                        <p className="text-center text-gray-500">
                          No conversion data available for the selected filters.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversions Over Time</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      [Chart Component Would Render Here with{' '}
                      {timeChartData.labels.join(', ')}]
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Types Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      [Pie Chart Would Render Here with{' '}
                      {typeChartData.labels.join(', ')}]
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sources" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Traffic Sources</CardTitle>
                    <CardDescription>
                      Conversion breakdown by traffic source
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sourceData.length > 0 ? (
                      <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                              <th scope="col" className="px-6 py-3">
                                Source
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Conversions
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Value
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Percentage
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sourceData.map((source) => (
                              <tr
                                key={source.source}
                                className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                              >
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                  {source.source}
                                </td>
                                <td className="px-6 py-4">{source.count}</td>
                                <td className="px-6 py-4">
                                  ${source.value.toFixed(2)}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    <span className="mr-2">
                                      {source.percentage.toFixed(1)}%
                                    </span>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                      <div
                                        className="bg-primary h-2.5 rounded-full"
                                        style={{
                                          width: `${source.percentage}%`,
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No source data available for the selected filters.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pages" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Page Performance</CardTitle>
                    <CardDescription>
                      Conversion metrics by page
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pageData.length > 0 ? (
                      <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                              <th scope="col" className="px-6 py-3">
                                Page
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Conversions
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Value
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Conversion Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageData.map((page) => (
                              <tr
                                key={page.path}
                                className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                              >
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                  {page.path}
                                </td>
                                <td className="px-6 py-4">{page.count}</td>
                                <td className="px-6 py-4">
                                  ${page.value.toFixed(2)}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    <span className="mr-2">
                                      {page.conversionRate.toFixed(1)}%
                                    </span>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                      <div
                                        className="bg-primary h-2.5 rounded-full"
                                        style={{
                                          width: `${Math.min(page.conversionRate * 2, 100)}%`,
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No page data available for the selected filters.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Event Log</CardTitle>
                    <CardDescription>
                      Detailed log of conversion events
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {conversionEvents.length > 0 ? (
                      <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                              <th scope="col" className="px-6 py-3">
                                Timestamp
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Type
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Value
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Source
                              </th>
                              <th scope="col" className="px-6 py-3">
                                Page
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {conversionEvents.map((event) => (
                              <tr
                                key={`event-${event.conversionId}-${event.timestamp}`}
                                className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                              >
                                <td className="px-6 py-4">
                                  {new Date(event.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  {event.conversionId}
                                </td>
                                <td className="px-6 py-4">
                                  {event.value
                                    ? `$${event.value.toFixed(2)}`
                                    : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  {event.source || 'direct'}
                                </td>
                                <td className="px-6 py-4">
                                  {event.path || '(not set)'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-4">
                        No events available for the selected filters.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
