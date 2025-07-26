import assetMap from '../cdn-asset-map.json'

// In development, use local assets
export function getAssetUrl(path: string): string {
  if (process.env.NODE_ENV === 'development') {
    return path
  }

  // Ensure path starts with /public for mapping
  const normalizedPath = path.startsWith('/public')
    ? path
    : `/public${path.startsWith('/') ? '' : '/'}${path}`

  // Return CDN URL if available, fallback to original path
  return (assetMap as Record<string, string>)[normalizedPath] || path
}
