const fs = require('fs');

console.log(`<<<<<<< SEARCH
const SessionChart: FC<SessionChartProps> = ({ data, isLoading }) => {
  const maxSessions = useMemo(() => {
    return Math.max(...data.map((d) => d.sessions), 1)
  }, [data])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold">Session Activity</h3>
      <div className="flex h-48 items-end space-x-2">
        {data.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center">
            <div
              role='img'
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={\`\${day.sessions} sessions on \${new Date(day.date).toLocaleDateString()}\`}
              className='bg-blue-500 hover:bg-blue-600 focus:ring-blue-400 w-full rounded-t transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1'
              style={{
                height: \`\${(day.sessions / maxSessions) * 100}%\`,
                minHeight: '4px',
              }}
              title={\`\${day.sessions} sessions on \${new Date(day.date).toLocaleDateString()}\`}
            />
            <span className="text-gray-600 mt-2 text-xs">
              {new Date(day.date).toLocaleDateString('en-US', {
                weekday: 'short',
              })}
            </span>
            <span className="text-gray-500 text-xs">{day.sessions}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
=======
const SessionChart: FC<SessionChartProps> = ({ data, isLoading }) => {
  const chartData = useMemo(() => {
    const maxSessions = Math.max(...data.map((d) => d.sessions), 1)

    return data.map((day) => {
      const dateObj = new Date(day.date)
      return {
        ...day,
        dateString: dateObj.toLocaleDateString(),
        shortWeekday: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        heightPct: \`\${(day.sessions / maxSessions) * 100}%\`,
      }
    })
  }, [data])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold">Session Activity</h3>
      <div className="flex h-48 items-end space-x-2">
        {chartData.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center">
            <div
              role='img'
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={\`\${day.sessions} sessions on \${day.dateString}\`}
              className='bg-blue-500 hover:bg-blue-600 focus:ring-blue-400 w-full rounded-t transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1'
              style={{
                height: day.heightPct,
                minHeight: '4px',
              }}
              title={\`\${day.sessions} sessions on \${day.dateString}\`}
            />
            <span className="text-gray-600 mt-2 text-xs">
              {day.shortWeekday}
            </span>
            <span className="text-gray-500 text-xs">{day.sessions}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
>>>>>>> REPLACE`);
