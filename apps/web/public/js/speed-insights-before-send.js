// Speed Insights before send hook.
// Vercel's Speed Insights script resolves this hook by name on the global
// object, so it is assigned explicitly instead of being left as a bare
// top-level declaration that reads as unused.
window.speedInsightsBeforeSend = function speedInsightsBeforeSend(data) {
  console.log('Speed Insights before send', data)
  return data
}
