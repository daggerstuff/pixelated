// Sentry Node.js Tracing Best-Practices Example (Express.js/ESM)
// Based on: https://docs.sentry.io/platforms/javascript/tracing/instrumentation/

import * as Sentry from "@sentry/node";
import { Integrations } from "@sentry/tracing";
import express from "express";

// Initialize Sentry before any business logic
Sentry.init({
  dsn: process.env.SENTRY_DSN, // Set via environment variable only
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 1.0, // Reduce to ~0.1 for production scale!
  integrations: [
    new Integrations.Http({ tracing: true }),
    // For Express, use Sentry's Express integration:
    new Sentry.Integrations.Express({ app: true }),
  ],
});

const app = express();

app.use(Sentry.Handlers.requestHandler());
// Enables automatic tracing for all incoming requests:
app.use(Sentry.Handlers.tracingHandler());

// Add your custom routes here:
app.get("/", function mainHandler(req, res) {
  res.end("Hello world!");
});

// The error handler must be before any other error middleware
app.use(Sentry.Handlers.errorHandler());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Notes:
// - Use process.env for all secrets/config.
// - Use Sentry.addBreadcrumb, Sentry.captureException, etc, as needed for business logic.
// - Adjust integrations for Koa, Fastify, etc. as described in the Sentry docs.