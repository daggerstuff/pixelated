#!/usr/bin/env ts-node
import { DreamScheduler } from '../src/services/dream-scheduler'

const envConsolidationUrl = process.env.CONSOLIDATION_URL
const consolidationUrl =
  envConsolidationUrl && envConsolidationUrl.length > 0
    ? envConsolidationUrl
    : 'http://localhost:5000'

async function run() {
  const scheduler = new DreamScheduler({
    consolidationUrl,
    autoStart: false,
  })

  // Mock global fetch
  global.fetch = async (url, options) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ dream_id: 'test' }),
        })
      }, 50)
    })
  }

  const start = Date.now()
  const result = await scheduler.runOnce(
    Array.from({ length: 20 }, (_, i) => `user-${i}`),
  )
  const end = Date.now()

  console.log(`Time taken: ${end - start}ms`)
  console.log(result)
}

void run()
