import fs from 'node:fs'
/**
 * Auth0 Central Configuration Utility
 * Handles secrets from both environment variables and Docker secrets files.
 */

export interface Auth0Config {
    domain: string
    clientId: string
    clientSecret: string
    audience: string
    managementClientId: string
    managementClientSecret: string
    publicDomain: string
    publicClientId: string
}

function getSecret(envVar: string, fileEnvVar: string): string {
    // Priority 1: Direct environment variable
    const directValue = process.env[envVar]
    if (directValue) return directValue

    // Priority 2: From file (Docker Secret)
    const filePath = process.env[fileEnvVar]
    if (filePath && fs.existsSync(filePath)) {
        try {
            return fs.readFileSync(filePath, 'utf8').trim()
        } catch (error) {
            console.error(`[Auth0Config] Failed to read secret from ${filePath}:`, error)
        }
    }

    return ''
}

export const auth0Config: Auth0Config = {
    domain: getSecret('AUTH0_DOMAIN', 'AUTH0_DOMAIN_FILE'),
    clientId: getSecret('AUTH0_CLIENT_ID', 'AUTH0_CLIENT_ID_FILE'),
    clientSecret: getSecret('AUTH0_CLIENT_SECRET', 'AUTH0_CLIENT_SECRET_FILE'),
    audience: getSecret('AUTH0_AUDIENCE', 'AUTH0_AUDIENCE_FILE'),
    managementClientId: getSecret('AUTH0_MANAGEMENT_CLIENT_ID', 'AUTH0_MANAGEMENT_CLIENT_ID_FILE'),
    managementClientSecret: getSecret('AUTH0_MANAGEMENT_CLIENT_SECRET', 'AUTH0_MANAGEMENT_CLIENT_SECRET_FILE'),
    publicDomain: process.env.PUBLIC_AUTH0_DOMAIN || process.env.AUTH0_DOMAIN || '',
    publicClientId: process.env.PUBLIC_AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID || '',
}

/**
 * Check if the minimum required configuration for standard auth is present
 */
export function isAuth0Configured(): boolean {
    return !!(auth0Config.domain && auth0Config.clientId && auth0Config.clientSecret)
}

/**
 * Check if the configuration for Management API is present
 */
export function isAuth0ManagementConfigured(): boolean {
    return !!(auth0Config.domain && auth0Config.managementClientId && auth0Config.managementClientSecret)
}

/**
 * Log status of Auth0 configuration (safely)
 */
export function logAuth0Status(): void {
    const status = {
        domain: !!auth0Config.domain,
        clientId: !!auth0Config.clientId,
        clientSecret: !!auth0Config.clientSecret,
        managementClientId: !!auth0Config.managementClientId,
        managementClientSecret: !!auth0Config.managementClientSecret,
    }

    console.log('[Auth0Config] Status:', status)

    if (!isAuth0Configured()) {
        console.warn('[Auth0Config] Standard authentication features may not work due to missing config.')
    }

    if (!isAuth0ManagementConfigured()) {
        console.warn('[Auth0Config] Management API features (RBAC, user management) may not work due to missing config.')
    }
}

// Run status check immediately on module load
logAuth0Status()
