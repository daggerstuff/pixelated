import { resolveInternalMemoryServiceConfig } from './internal-memory-service-auth'
import { InternalMemoryServiceClient } from './internal-memory-service-client'
import { McpMemoryTransport } from './mcp-memory-transport'

export type InternalMemoryServiceClientLike = Pick<
  InternalMemoryServiceClient,
  | 'addMemory'
  | 'listMemories'
  | 'searchMemories'
  | 'updateMemory'
  | 'getMemory'
  | 'deleteMemory'
  | 'getMemoryStats'
>

/**
 * Factory function to create the appropriate memory service transport
 * based on the MEMORY_SERVICE_TRANSPORT environment variable.
 *
 * Valid values:
 * - 'mcp': Use MCP transport to foresight-mcp server
 * - 'http-loopback': Use HTTP self-loopback (default)
 */
export function createMemoryTransport(): InternalMemoryServiceClientLike {
  const transportType =
    process.env['MEMORY_SERVICE_TRANSPORT'] ?? 'http-loopback'

  switch (transportType) {
    case 'mcp': {
      const launcherPath =
        process.env['FORESIGHT_MCP_LAUNCHER'] ??
        'scripts/memory/foresight-mcp-server.sh'
      const timeoutMs = Number(process.env['MEMORY_SERVICE_TIMEOUT_MS'] ?? 5000)
      return new McpMemoryTransport({ launcherPath, timeoutMs })
    }
    case 'http-loopback': {
      return new InternalMemoryServiceClient(
        resolveInternalMemoryServiceConfig(),
      )
    }
    default: {
      throw new Error(
        `Unknown memory service transport: ${transportType}. ` +
          "Valid values are 'mcp' or 'http-loopback'.",
      )
    }
  }
}
