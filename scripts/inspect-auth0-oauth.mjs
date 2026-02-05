import { AuthenticationClient } from 'auth0';

try {
    const client = new AuthenticationClient({
        domain: 'test.auth0.com',
        clientId: 'test',
        clientSecret: 'test'
    });

    console.log('--- Methods on client.oauth ---');
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client.oauth)));
} catch (e) {
    console.error(e);
}
