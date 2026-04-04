/**
 * Utility to execute a list of tasks in parallel batches with a concurrency limit.
 */
export async function runInParallelBatches<T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
  concurrencyLimit: number = 5
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit)
    const batchResults = await Promise.all(batch.map(task))
    results.push(...batchResults)
  }
  
  return results
}
