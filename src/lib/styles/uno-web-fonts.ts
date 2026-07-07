export function shouldDisableRemoteWebFonts(
  env: NodeJS.ProcessEnv,
): boolean {
  return (
    env['CI'] === 'true' ||
    env['NODE_ENV'] === 'test' ||
    env['VERCEL'] === '1' ||
    typeof env['VERCEL_ENV'] === 'string'
  )
}
