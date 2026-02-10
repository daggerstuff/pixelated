import { AuthenticationClient } from 'auth0';

const client = new AuthenticationClient({ domain: 'x', clientId: 'x' });
console.log('getProfile:', typeof client.getProfile);
console.log('userInfo:', typeof client.userInfo);
console.log('oauth.userInfo:', client.oauth && typeof client.oauth.userInfo);
console.log('profile:', client.profile);
