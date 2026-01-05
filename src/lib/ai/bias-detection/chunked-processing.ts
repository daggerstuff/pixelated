// Chunked processing utility for memory-efficient large dataset analysis

/**
 * Processes an array in chunks to minimize memory usage.
 * @param items The array of items to process
 * @param chunkSize The number of items per chunk
 * @param processChunk Async function to process each chunk
 */
export async function processInChunks<T, R>(
  items: T[],
  chunkSize: number,
  processChunk: (chunk: T[], chunkIndex: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    // Process and immediately release memory for the chunk
    const result = await processChunk(chunk, i / chunkSize)
    results.push(result)
  }
  return results
}

// Example usage:
// await processInChunks(sessions, 100, async (chunk) => await engine.batchAnalyzeSessions(chunk))
