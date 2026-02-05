import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

export const PixelatedAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN || "dev-f3vkhvb6n52y7fre.us.auth0.com";
    const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID || "SqKS5SumZiRoFEVhjw80gr10KkYbZuLn";

    const onRedirectCallback = (appState: any) => {
        window.history.replaceState(
            {},
            document.title,
            appState?.returnTo || window.location.pathname
        );
    };

    // Ensure config is valid even during SSR, though this component should be client-only
    // Use explicit callback URL to ensure correct redirect after Auth0 authentication
    const redirectUri = typeof window !== 'undefined'
        ? `${window.location.origin}/api/auth/auth0-callback`
        : '';

    if (!domain || !clientId) {
        return null;
    }

    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: redirectUri,
                audience: import.meta.env.PUBLIC_AUTH0_AUDIENCE || undefined,
            }}
            onRedirectCallback={onRedirectCallback}
        >
            {children}
        </Auth0Provider>
    );
};
