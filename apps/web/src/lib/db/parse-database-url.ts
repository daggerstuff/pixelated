/**
 * Parse a postgres:// or postgresql:// connection string into the
 * DatabaseConfig shape accepted by initializeDatabase().
 */
export function parseDatabaseUrl(url: string): {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean | object
} {
  const parsed = new URL(url)
  const sslMode = parsed.searchParams.get('sslmode')
  // Match the app's server.ts behavior: enable TLS (without cert validation,
  // intentionally mirroring server.ts) for production and for remote hosts,
  // unless sslmode explicitly disables it.
  const isRemoteHost =
    parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1'
  const enableSsl =
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    sslMode === 'no-verify' ||
    (sslMode !== 'disable' &&
      sslMode !== 'prefer' &&
      (process.env['NODE_ENV'] === 'production' || isRemoteHost))
  const ssl: boolean | object = enableSsl
    ? { rejectUnauthorized: false }
    : false
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl,
  }
}
