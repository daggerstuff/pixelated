import { init as initClient } from '@sentry/astro';
import { initSentry } from '@/lib/sentry/config';

const clientConfig = initSentry({
    integrations: [],
});

initClient(clientConfig);
