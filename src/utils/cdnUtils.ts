// In development, use local assets
export async function getAssetUrl(path: string): Promise<string> {
  if (process.env['NODE_ENV'] === 'development') {
    return path
  }

  // Try to import the asset map, fallback to empty object if not available
  let assetMap: Record<string, string> = {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    assetMap = await import('../cdn-asset-map.json').then(m => m.default) as Record<string, string>
  } catch {
    // Asset map not found, use fallback
  }

  // Ensure path starts with /public for mapping
  const normalizedPath = path.startsWith('/public')
    ? path
    : `/public${path.startsWith('/') ? '' : '/'}${path}`

  // Return CDN URL if available, fallback to original path
  return assetMap[normalizedPath] || path
}
