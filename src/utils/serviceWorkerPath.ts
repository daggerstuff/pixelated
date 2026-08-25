export function normalizeBasePath(basePath = import.meta.env.BASE_URL): string {
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

export function getServiceWorkerScriptUrl(
  basePath = import.meta.env.BASE_URL,
): string {
  return `${normalizeBasePath(basePath)}sw.js`
}

export function getServiceWorkerScope(
  basePath = import.meta.env.BASE_URL,
): string {
  return normalizeBasePath(basePath)
}
