import { init as initServer } from "@sentry/astro";

import { initSentry, resolveSentryDsn, resolveSentryRelease } from "@/lib/sentry/config";

const serverConfig = initSentry({
  dsn: resolveSentryDsn(),
  release: resolveSentryRelease(),
});

initServer(serverConfig);
