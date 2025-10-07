/** @type {import('@astrojs/language-server').AstroConfig} */
export default {
  languageServer: {
    // Increase memory limit for the language server
    memoryLimit: 4096,
    // Increase timeout for language server operations
    timeout: 60000,
  },
  typescript: {
    // Use the project's TypeScript version
    preferProjectVersion: true,
  },
  // Disable telemetry
  telemetry: false,
}
