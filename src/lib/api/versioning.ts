/**
 * API Versioning Strategy for Pixelated Empathy
 * Implements semantic versioning and backward compatibility
 */

export interface ApiVersion {
  major: number
  minor: number
  patch: number
}

export interface VersionedEndpoint {
  path: string
  version: ApiVersion
  deprecated?: boolean
  sunsetDate?: Date
  migrationGuide?: string
}

export interface VersionConfig {
  currentVersion: ApiVersion
  supportedVersions: ApiVersion[]
  deprecationPolicy: {
    minorVersions: number // How many minor versions to support
    patchVersions: number // How many patch versions to support
    deprecationNoticeDays: number // Days before deprecation
  }
  breakingChanges: {
    major: string[] // List of breaking changes in current version
    migration: Record<string, string> // Migration paths
  }
}

/**
 * API Version Manager
 */
class ApiVersionManager {
  private config: VersionConfig
  private endpoints = new Map<string, VersionedEndpoint[]>()

  constructor() {
    this.config = {
      currentVersion: { major: 2, minor: 0, patch: 0 },
      supportedVersions: [
        { major: 2, minor: 0, patch: 0 },
        { major: 1, minor: 5, patch: 0 },
        { major: 1, minor: 4, patch: 3 },
      ],
      deprecationPolicy: {
        minorVersions: 3,
        patchVersions: 5,
        deprecationNoticeDays: 90,
      },
      breakingChanges: {
        major: [
          'Authentication scheme updated to OAuth 2.0',
          'Response format standardized across all endpoints',
          'Error codes consolidated and improved',
        ],
        migration: {
          'v1/*': 'v2/*',
          'auth/basic': 'auth/oauth2',
          'responses/xml': 'responses/json',
        },
      },
    }
  }

  /**
   * Register a versioned endpoint
   */
  registerEndpoint(endpoint: VersionedEndpoint): void {
    const existing = this.endpoints.get(endpoint.path) || []
    existing.push(endpoint)
    this.endpoints.set(endpoint.path, existing)
  }

  /**
   * Get all versions of an endpoint
   */
  getEndpointVersions(path: string): VersionedEndpoint[] {
    return this.endpoints.get(path) || []
  }

  /**
   * Check if a version is supported
   */
  isVersionSupported(version: ApiVersion): boolean {
    return this.config.supportedVersions.some(
      (v) =>
        v.major === version.major &&
        v.minor === version.minor &&
        v.patch >= version.patch,
    )
  }

  /**
   * Get version header for responses
   */
  getVersionHeaders(): Record<string, string> {
    return {
      'X-API-Version': `${this.config.currentVersion.major}.${this.config.currentVersion.minor}.${this.config.currentVersion.patch}`,
      'X-API-Supported-Versions': this.config.supportedVersions
        .map((v) => `${v.major}.${v.minor}.${v.patch}`)
        .join(', '),
      'X-API-Deprecation-Policy': JSON.stringify(this.config.deprecationPolicy),
    }
  }

  /**
   * Parse version from request
   */
  parseVersionFromRequest(request: Request): ApiVersion | null {
    const versionHeader =
      request.headers.get('X-API-Version') ||
      request.headers.get('API-Version') ||
      request.url
        .match(/\/v(\d+)\/(\d+)\/(\d+)\//)
        ?.slice(1)
        .map(Number)

    if (versionHeader) {
      if (Array.isArray(versionHeader)) {
        const [major, minor, patch] = versionHeader
        return { major, minor, patch }
      } else {
        const [major, minor, patch] = versionHeader.split('.').map(Number)
        return { major, minor, patch }
      }
    }

    // Default to current version if not specified
    return { ...this.config.currentVersion }
  }

  /**
   * Check if endpoint version is deprecated
   */
  isDeprecated(endpoint: VersionedEndpoint): boolean {
    if (!endpoint.deprecated) return false

    const version = endpoint.version
    const current = this.config.currentVersion

    // Check if version is too old based on deprecation policy
    if (version.major < current.major) return true
    if (
      version.major === current.major &&
      version.minor <
        current.minor - this.config.deprecationPolicy.minorVersions
    ) {
      return true
    }

    return false
  }

  /**
   * Get deprecation notice for endpoint
   */
  getDeprecationNotice(endpoint: VersionedEndpoint): string | null {
    if (!this.isDeprecated(endpoint)) return null

    const sunsetDate =
      endpoint.sunsetDate || this.calculateSunsetDate(endpoint.version)

    return `This API version (${endpoint.version.major}.${endpoint.version.minor}.${endpoint.version.patch}) is deprecated and will be removed on ${sunsetDate.toISOString().split('T')[0]}. Please migrate to v${this.config.currentVersion.major}.${this.config.currentVersion.minor}.${this.config.currentVersion.patch}.`
  }

  private calculateSunsetDate(version: ApiVersion): Date {
    const current = this.config.currentVersion
    const monthsToAdd =
      version.major < current.major
        ? 6
        : version.minor <
            current.minor - this.config.deprecationPolicy.minorVersions
          ? 3
          : 1

    const sunsetDate = new Date()
    sunsetDate.setMonth(sunsetDate.getMonth() + monthsToAdd)
    return sunsetDate
  }

  /**
   * Get migration guide for version
   */
  getMigrationGuide(fromVersion: ApiVersion): string[] {
    const guides: string[] = []

    if (fromVersion.major < this.config.currentVersion.major) {
      guides.push(
        `Major version upgrade required: ${fromVersion.major} → ${this.config.currentVersion.major}`,
      )
      guides.push('Review breaking changes documentation')
      guides.push('Update authentication mechanism')
      guides.push('Modify response handling')
    }

    return guides
  }
}

// Export singleton instance
export const apiVersionManager = new ApiVersionManager()

// Export class for custom instances
export { ApiVersionManager }
export default apiVersionManager
