
import type { APIRoute } from 'astro';
import { auth0SocialAuth } from '@/lib/auth/auth0-social-auth-service';

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect }) => {
    try {
        const returnTo = url.searchParams.get('returnTo') || '/dashboard';
        const connection = url.searchParams.get('connection');

        // Determine redirect URI based on environment
        // Must match what is in Auth0 Dashboard Allowed Callback URLs
        const callbackUri = import.meta.env.DEV
            ? 'http://localhost:4321/api/auth/auth0-callback'
            : `${import.meta.env.SITE}/api/auth/auth0-callback`;

        // Generate Auth0 Authorization URL
        const authorizationUrl = auth0SocialAuth.getAuthorizationUrl({
            connection: connection || undefined, // undefined lets Auth0 show the Lock widget
            redirectUri: callbackUri,
            state: returnTo, // Pass returnTo as state to persist it through the flow
            scope: 'openid profile email offline_access' // offline_access for refresh token
        });

        return redirect(authorizationUrl);
    } catch (error) {
        console.error('Failed to generate authorization URL:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};
