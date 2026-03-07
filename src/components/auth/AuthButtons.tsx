import React from 'react';
import { authClient } from '@/lib/auth-client';
// Remove AuthProvider wrapper dependency if possible, but keep structure for now if needed

const AuthButtonsInner = () => {
    const { data: session, isPending } = authClient.useSession();

    // Derived state
    const user = session?.user;
    const isAuthenticated = !!user;

    if (isPending) {
        return <div className="text-slate-300 text-sm font-medium">Loading...</div>;
    }

    if (isAuthenticated) {
        return (
            <div className="flex items-center gap-4">
                <div className="hidden lg:block text-slate-300 text-sm font-medium">
                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.fullName || user.email} className="w-8 h-8 rounded-full inline-block mr-2" />
                    ) : null}
                    {user?.fullName || user?.email}
                </div>
                <button
                    onClick={() => authClient.signOut()}
                    className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                >
                    Log out
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <a
                href="/api/auth/login"
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
                Log in
            </a>
            <a
                href="/api/auth/login?connection=google-oauth2"
                className="bg-white text-slate-950 px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
                Get Started
            </a>
        </div>
    );
};

export const AuthButtons = () => {
    return (
        <AuthButtonsInner />
    );
};
