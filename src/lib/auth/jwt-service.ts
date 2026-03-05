/**
 * JWT Service entry point.
 * Re-exports from auth0-jwt-service for backward compatibility.
 */

export * from './auth0-jwt-service';

// Add legacy name aliases if needed
export { validateToken as verifyToken } from './auth0-jwt-service';
