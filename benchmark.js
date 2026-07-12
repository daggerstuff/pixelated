const { DreamScheduler } = require('./src/services/dream-scheduler')

async function run() {
  const scheduler = new DreamScheduler({
    consolidationUrl: 'http://localhost:5000',
    autoStart: false,
  })

  // Mock global fetch
  global.fetch = async (url, options) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: async () => ({ dream_id: 'test' })
        })
      }, 50)
    })
  }

  const start = Date.now()
  const result = await scheduler.runOnce(Array.from({length: 20}, (_, i) => `user-${i}`))
  const end = Date.now()

  console.log(`Time taken: ${end - start}ms`)
  console.log(result)
}

run()
