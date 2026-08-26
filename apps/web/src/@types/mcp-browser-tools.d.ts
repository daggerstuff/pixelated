interface McpBrowserToolsParams {
  random_string: string
}

interface Window {
  mcp_browser_tools_takeScreenshot(
    params: McpBrowserToolsParams,
  ): Promise<string>
  mcp_browser_tools_runAccessibilityAudit(
    params: McpBrowserToolsParams,
  ): Promise<unknown>
  mcp_browser_tools_getNetworkLogs(
    params: McpBrowserToolsParams,
  ): Promise<unknown>
  mcp_browser_tools_runPerformanceAudit(
    params: McpBrowserToolsParams,
  ): Promise<unknown>
  mcp_browser_tools_getConsoleErrors(
    params: McpBrowserToolsParams,
  ): Promise<unknown[]>
}
