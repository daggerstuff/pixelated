import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { PixelatedAuthProvider } from './AuthProvider';

const AuthButtonsInner = () => {
    const {
        isAuthenticated,
        loginWithRedirect,
        logout,
        user,
        isLoading
    } = useAuth0();

    if (isLoading) {
        return <div className="text-slate-300 text-sm font-medium">Loading...</div>;
    }

    if (isAuthenticated) {
        return (
            <div className="flex items-center gap-4">
                <div className="hidden lg:block text-slate-300 text-sm font-medium">
                    {user?.picture ? (
                        <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full inline-block mr-2" />
                    ) : null}
                    {user?.name}
                </div>
                <button
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                    className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                >
                    Log out
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={() => loginWithRedirect()}
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
                Log in
            </button>
            <button
                onClick={() => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } })}
                className="bg-white text-slate-950 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
                Get Started
            </button>
        </div>
    );
};

export const AuthButtons = () => {
    return (
        <PixelatedAuthProvider>
            <AuthButtonsInner />
        </PixelatedAuthProvider>
    );
};
