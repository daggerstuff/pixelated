// Import necessary polyfills
import { Buffer } from 'buffer'
import events from 'events'
import util from 'util'

import path from 'path-browserify'
import streamBrowserify from 'stream-browserify'

// Define process if it doesn't exist
if (typeof window.process === 'undefined') {
  window.process = {
    env: {},
    nextTick: function (fn) {
      setTimeout(fn, 0)
    },
    cwd: function () {
      return '/'
    },
    browser: true,
    platform: 'browser',
    versions: {
      node: '0.0.0',
    },
  }
}

// Expose Buffer to the window object
window.Buffer = window.Buffer || Buffer

// Expose stream to the window object
window.stream = window.stream || streamBrowserify

// Expose path to the window object
window.path = window.path || path

// Expose util to the window object
window.util = window.util || util

// Expose events to the window object
window.events = window.events || events

console.log('Node.js polyfills loaded in browser environment')
