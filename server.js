/* jshint esversion: 6 */
/* eslint-env node */
/* global window, self */
import express from 'express'

const app = express()
const PORT = process.env.PORT || 4321

app.get('/health', (_req, res) => res.status(200).send('OK'))

app.get('/', (_req, res) => res.send('Pixelated Empathy Home'))

app.listen(PORT, () => console.log(`pixelated-app listening on port ${PORT}`))
  ; (() => {
    try {
      let e
      if (typeof window !== 'undefined') {
        e = window
      } else if (typeof global !== 'undefined') {
        e = global
      } else if (typeof globalThis !== 'undefined') {
        e = globalThis
      } else if (typeof self !== 'undefined') {
        e = self
      } else {
        e = {}
      }
      const errorInstance = new e.Error()
      const n = errorInstance.stack
      if (n) {
        e._sentryDebugIds = e._sentryDebugIds || {}
        e._sentryDebugIds[n] = '93104627-6895-5eb0-96a4-0c009e1915b5'
      }
    } catch (err) {
      console.error('Sentry debug ID assignment failed:', err)
    }
  })()
