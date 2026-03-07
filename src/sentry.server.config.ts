import { init as initServer } from '@sentry/astro';
import { initSentry } from '@/lib/sentry/config';

const serverConfig = initSentry();

initServer(serverConfig);
