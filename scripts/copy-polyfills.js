/**
 * copy-polyfills.js
 *
 * This script copies polyfill files from node_modules to the public directory
 * so they can be loaded by the client-side polyfill loader.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Define source and destination paths
const rootDir = path.resolve(__dirname, '..')
const nodeModulesDir = path.join(rootDir, 'node_modules')
const polyfillsDestDir = path.join(rootDir, 'public', 'polyfills')

// Ensure the destination directory exists
if (!fs.existsSync(polyfillsDestDir)) {
  fs.mkdirSync(polyfillsDestDir, { recursive: true })
}

// List of polyfills to copy
const polyfills = [
  // Core polyfills
  {
    src: path.join(
      nodeModulesDir,
      'promise-polyfill',
      'dist',
      'polyfill.min.js',
    ),
    dest: path.join(polyfillsDestDir, 'promise-polyfill.min.js'),
  },
  {
    src: path.join(nodeModulesDir, 'whatwg-fetch', 'dist', 'fetch.umd.js'),
    dest: path.join(polyfillsDestDir, 'fetch.umd.js'),
  },
  {
    src: path.join(
      nodeModulesDir,
      'intersection-observer',
      'intersection-observer.js',
    ),
    dest: path.join(polyfillsDestDir, 'intersection-observer.js'),
  },
  {
    src: path.join(
      nodeModulesDir,
      'resize-observer-polyfill',
      'dist',
      'ResizeObserver.js',
    ),
    dest: path.join(polyfillsDestDir, 'resize-observer-polyfill.js'),
  },
  {
    src: path.join(
      nodeModulesDir,
      '@webcomponents',
      'custom-elements',
      'custom-elements.min.js',
    ),
    dest: path.join(polyfillsDestDir, 'custom-elements.min.js'),
  },
  // Enhancement polyfills
  {
    src: path.join(
      nodeModulesDir,
      'web-animations-js',
      'web-animations.min.js',
    ),
    dest: path.join(polyfillsDestDir, 'web-animations.min.js'),
  },
  {
    src: path.join(nodeModulesDir, 'url-polyfill', 'url-polyfill.min.js'),
    dest: path.join(polyfillsDestDir, 'url-polyfill.min.js'),
  },
]

// Add our custom Buffer polyfill to be copied
const customPolyfills = [
  {
    src: './src/buffer-polyfill.js',
    dest: './public/polyfills/buffer-polyfill.js',
  },
  {
    src: './src/client-entry.js',
    dest: './public/polyfills/client-entry.js',
  },
]

// Create minimal polyfills for features not available as standalone packages
const minimalPolyfills = [
  {
    name: 'object-fromentries.js',
    content: `// Object.fromEntries polyfill
if (!Object.fromEntries) {
  Object.fromEntries = function fromEntries(entries) {
    if (!entries || !entries[Symbol.iterator]) {
      throw new Error('Object.fromEntries requires a single iterable argument');
    }
    const obj = {};
    for (const [key, value] of entries) {
      obj[key] = value;
    }
    return obj;
  };
}
`,
  },
  {
    name: 'array-findlast.js',
    content: `// Array.prototype.findLast polyfill
if (!Array.prototype.findLast) {
  Array.prototype.findLast = function(callback, thisArg) {
    if (this == null) {
      throw new TypeError('Array.prototype.findLast called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('callback must be a function');
    }

    const array = Object(this);
    const len = array.length >>> 0;

    for (let i = len - 1; i >= 0; i--) {
      const value = array[i];
      if (callback.call(thisArg, value, i, array)) {
        return value;
      }
    }

    return undefined;
  };
}
`,
  },
  {
    name: 'string-replaceall.js',
    content: `// String.prototype.replaceAll polyfill
if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function(search, replacement) {
    return this.split(search).join(replacement);
  };
}
`,
  },
  {
    name: 'buffer-polyfill.js',
    content: `// Buffer polyfill for browsers
(function() {
  // Only create Buffer polyfill if it doesn't already exist
  if (typeof window !== 'undefined' && typeof Buffer === 'undefined') {
    window.Buffer = {
      from: function(data, encoding) {
        if (typeof data === 'string') {
          if (encoding === 'base64') {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          } else {
            // Default to utf8
            return new TextEncoder().encode(data);
          }
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          return new Uint8Array(data);
        } else {
          throw new Error('Buffer.from: Unsupported data type');
        }
      },
      alloc: function(size, fill = 0) {
        const buffer = new Uint8Array(size);
        if (fill !== 0) {
          buffer.fill(fill);
        }
        return buffer;
      },
      isBuffer: function(obj) {
        return obj instanceof Uint8Array;
      }
    };

    // Add toString method for compatibility
    window.Buffer.prototype = {
      toString: function(encoding) {
        if (this instanceof Uint8Array) {
          if (encoding === 'base64') {
            let binary = '';
            const bytes = new Uint8Array(this);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          } else {
            // Default to utf8
            return new TextDecoder().decode(this);
          }
        }
        return '';
      }
    };
  }
})();
`,
  },
]

// Copy the polyfill files
console.log('\n📦 Copying polyfill files to public/polyfills...')

// Track results
const results = {
  copied: 0,
  created: 0,
  failed: 0,
}

// Copy from node_modules
polyfills.forEach(({ src, dest }) => {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      results.copied++
    } else {
      console.error(`❌ Source file not found: ${src}`)
      results.failed++
    }
  } catch (err) {
    console.error(`❌ Error copying ${src}: ${err.message}`)
    results.failed++
  }
})

// Create minimal polyfills
minimalPolyfills.forEach(({ name, content }) => {
  try {
    const dest = path.join(polyfillsDestDir, name)
    fs.writeFileSync(dest, content)
    results.created++
  } catch (err) {
    console.error(`❌ Error creating ${name}: ${err.message}`)
    results.failed++
  }
})

// Show a concise summary with colors and box border
const colors = {
  success: '\x1b[32m', // Green
  error: '\x1b[31m', // Red
  info: '\x1b[36m', // Cyan
  reset: '\x1b[0m', // Reset
  bold: '\x1b[1m', // Bold
}

// Create a boxed summary with thinner lines
const boxWidth = 50
const topBorder =
  colors.info + '┌' + '─'.repeat(boxWidth - 2) + '┐' + colors.reset
const bottomBorder =
  colors.info + '└' + '─'.repeat(boxWidth - 2) + '┘' + colors.reset
const midBorder =
  colors.info + '├' + '─'.repeat(boxWidth - 2) + '┤' + colors.reset
const createLine = (text) => {
  const contentWidth = boxWidth - 4 // Account for borders and padding
  return (
    colors.info +
    '│' +
    colors.reset +
    ' ' +
    text.padEnd(contentWidth) +
    ' ' +
    colors.info +
    '│' +
    colors.reset
  )
}

console.log('\n' + topBorder)
console.log(
  createLine(colors.bold + '✅ Polyfill Packaging Complete' + colors.reset),
)
console.log(midBorder)
console.log(
  createLine(
    `Copied: ${colors.success}${results.copied}${colors.reset} files from node_modules`,
  ),
)
console.log(
  createLine(
    `Created: ${colors.success}${results.created}${colors.reset} custom polyfills`,
  ),
)
if (results.failed > 0) {
  console.log(
    createLine(
      `Failed: ${colors.error}${results.failed}${colors.reset} operations`,
    ),
  )
}
console.log(
  createLine(
    `Total: ${colors.bold}${results.copied + results.created}${colors.reset} files processed`,
  ),
)
console.log(bottomBorder)
