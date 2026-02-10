import { AuthenticationClient } from 'auth0';

try {
    const client = new AuthenticationClient({
        domain: 'test.auth0.com',
        clientId: 'test',
        clientSecret: 'test'
    });

    console.log('--- Methods on client instance ---');
    console.log(Object.keys(client));

    console.log('--- Methods on prototype ---');
    let proto = Object.getPrototypeOf(client);
    while (proto && proto !== Object.prototype) {
        console.log(Object.getOwnPropertyNames(proto));
        proto = Object.getPrototypeOf(proto);
    }
} catch (e) {
    console.error(e);
}
