// Import polyfills
import 'buffer'
import 'stream-browserify'
import 'path-browserify'
import 'util'
import 'events'
import './process-polyfill.js'

// Expose Buffer globally
import { Buffer } from 'buffer'
window.Buffer = Buffer

// Expose process globally
import process from './process-polyfill.js'
window.process = process
