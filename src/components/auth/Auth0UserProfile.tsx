import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { PixelatedAuthProvider } from './AuthProvider';

const UserProfileInner = () => {
    const { user, isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

    if (isLoading) {
        return <div>Loading ...</div>;
    }

    if (!isAuthenticated) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl mb-4">You are not logged in.</h2>
                <button
                    onClick={() => loginWithRedirect()}
                    className="bg-white text-slate-950 px-6 py-3 rounded-full font-semibold hover:bg-slate-200 transition-colors"
                >
                    Log In to View Profile
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6">
                {user?.picture && <img src={user.picture} alt={user.name} className="w-20 h-20 rounded-full border-2 border-white/10" />}
                <div>
                    <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
                    <p className="text-slate-400">{user?.email}</p>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold mb-4 text-white">User Profile Data (Auth0 SDK)</h3>
                <pre className="text-xs text-slate-300 overflow-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(user, null, 2)}
                </pre>
            </div>
        </div>
    );
};

export const Auth0UserProfile = () => {
    return (
        <PixelatedAuthProvider>
            <UserProfileInner />
        </PixelatedAuthProvider>
    );
};
