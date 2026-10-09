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
  connectionTimeoutMillis?: number
} {
  const parsed = new URL(url)
  const sslMode = parsed.searchParams.get('sslmode')
  const isRemoteHost =
    parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1'

  // Map sslmode to node-postgres TLS options. Certificate verification is
  // kept ON unless the URL explicitly opts out with sslmode=no-verify.
  //   disable                         -> no TLS
  //   no-verify                       -> TLS, certificate not verified
  //   prefer | allow | require        -> TLS, certificate verified
  //   verify-ca | verify-full         -> TLS, certificate verified
  //   (unset)                         -> TLS + verification for production
  //                                      or remote hosts, otherwise no TLS
  const verifyingModes = [
    'prefer',
    'allow',
    'require',
    'verify-ca',
    'verify-full',
  ]
  let ssl: boolean | object
  if (sslMode === 'disable') {
    ssl = false
  } else if (sslMode === 'no-verify') {
    ssl = { rejectUnauthorized: false }
  } else if (sslMode !== null && verifyingModes.includes(sslMode)) {
    ssl = { rejectUnauthorized: true }
  } else {
    ssl =
      process.env['NODE_ENV'] === 'production' || isRemoteHost
        ? { rejectUnauthorized: true }
        : false
  }

  const connectTimeoutSec = parsed.searchParams.get('connect_timeout')
  const parsedTimeout = connectTimeoutSec
    ? parseInt(connectTimeoutSec, 10)
    : NaN
  const connectionTimeoutMillis =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout * 1000
      : undefined

  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl,
    ...(connectionTimeoutMillis !== undefined
      ? { connectionTimeoutMillis }
      : {}),
  }
}
