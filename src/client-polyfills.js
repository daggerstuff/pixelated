// Expose Buffer globally
import { Buffer } from 'buffer'

// Import polyfills
import 'buffer'
import 'stream-browserify'
import 'path-browserify'
import 'util'
import 'events'
import './process-polyfill.js'
window.Buffer = Buffer

// Expose process globally
import process from './process-polyfill.js'
window.process = process
