// Express.js Server Setup
// Main application entry point with middleware configuration

import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler, type Express, type NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { closeSentry, Sentry, sentryMiddleware } from "../../../../config/instrument.mjs";
import {
  connectMongoDB,
  connectPostgreSQL,
  connectRedis,
  disconnectMongoDB,
  disconnectPostgreSQL,
  disconnectRedis,
} from "../lib/db/connection";
import {
  getSentryExpressHandlers,
  hasSentryExpressErrorHandler,
  registerSentryExpressErrorHandler,
} from "../lib/sentry/express";
import { apiVersionResolver } from "./middleware/api-version";
import { authMiddleware } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { logger } from "../lib/logger";
import { requestLogger } from "./middleware/logger";
import { createTimeoutMiddleware } from "./middleware/query-timeout";
import { rateLimiter } from "./middleware/rate-limiter";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import healthRoutes from "./routes/health";
import integrationRoutes from "./routes/integrations";
import marketResearchRoutes from "./routes/market-research";
import projectRoutes from "./routes/projects";
import readinessRoutes from "./routes/readiness";
import salesOpportunitiesRoutes from "./routes/sales-opportunities";
import strategicPlanRoutes from "./routes/strategic-plans";
import userRoutes from "./routes/users";

// Load environment variables
dotenv.config();

const app: Express = express();
app.set("trust proxy", 1);
const PORT = parseInt(process.env["PORT"] ?? "5000", 10);
const NODE_ENV = process.env["NODE_ENV"] ?? "development";

const sentryHandlers = getSentryExpressHandlers(Sentry);
const hasSentryErrorHandler = hasSentryExpressErrorHandler(sentryHandlers);
const { captureException } = sentryHandlers;

app.use(sentryMiddleware);

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env["CORS_ORIGIN"]?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ============================================================================
// BODY PARSING & COMPRESSION
// ============================================================================

app.use(
  express.json({
    limit: "10mb",
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);
app.use(
  express.urlencoded({
    limit: "10mb",
    extended: true,
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);
app.use(compression());

// ============================================================================
// API VERSION NEGOTIATION
// ============================================================================

// Resolve API version from URL path (/api/v1/...) or Accept header
app.use(apiVersionResolver());

// ============================================================================
// QUERY TIMEOUT
// ============================================================================

// Apply timeout middleware in non-test environments
if (NODE_ENV !== "test") {
  app.use(createTimeoutMiddleware());
}

// ============================================================================
// LOGGING
// ============================================================================

// Morgan request logger
const morganFormat = NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat));

// Custom request logger
app.use(requestLogger);

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

// Health route must be before rate limiter to avoid being blocked by rate limiting
app.use("/api/health", healthRoutes);

// ============================================================================
// RATE LIMITING
// ============================================================================

app.use(rateLimiter);

// ============================================================================
// PUBLIC ROUTES CONTINUED (NO AUTH REQUIRED)
// ============================================================================

app.use("/api/auth", authRoutes);
app.use("/api/readiness", readinessRoutes);

// Integration routes must be mounted before authMiddleware — webhook endpoints
// receive server-to-server POSTs from external providers (Calendly, Zoom, Stripe,
// Twilio) that carry only webhook signature headers, and OAuth authorize/callback
// endpoints are accessed by the browser during the OAuth redirect flow.
app.use("/api/integrations", integrationRoutes);

// ============================================================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ============================================================================

// Apply auth middleware to all routes below this point
app.use(authMiddleware);

// API Routes
app.use("/api/documents", documentRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/strategic-plans", strategicPlanRoutes);
app.use("/api/market-research", marketResearchRoutes);
app.use("/api/sales-opportunities", salesOpportunitiesRoutes);
app.use("/api/users", userRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
registerSentryExpressErrorHandler(app, sentryHandlers);
app.use(notFoundHandler);

// Global error handler (must be last)
if (!hasSentryErrorHandler) {
  const sentryErrorHandler: ErrorRequestHandler = (
    error: Error,
    _req,
    _res,
    next: NextFunction,
  ) => {
    if (captureException) {
      captureException(error);
    }
    next(error);
  };
  app.use(sentryErrorHandler);
}
app.use(errorHandler);

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

type MongoConnection = Awaited<ReturnType<typeof connectMongoDB>>;
type PostgresConnection = Awaited<ReturnType<typeof connectPostgreSQL>>;
type RedisConnection = Awaited<ReturnType<typeof connectRedis>>;

let mongoConnection: MongoConnection | null = null;
let postgresConnection: PostgresConnection | null = null;
let redisConnection: RedisConnection | null = null;

async function initializeDatabases() {
  const isProduction = process.env["NODE_ENV"] === "production";

  // MongoDB — optional in dev, required in production
  try {
    mongoConnection = await connectMongoDB();
  } catch (error: unknown) {
    if (isProduction) {
      logger.error("MongoDB connection failed in production — aborting startup");
      throw error;
    }
    logger.warn("MongoDB connection failed — continuing without MongoDB (dev mode)");
  }

  // PostgreSQL — required in all environments
  try {
    postgresConnection = await connectPostgreSQL();
  } catch (error: unknown) {
    if (isProduction) {
      logger.error("PostgreSQL connection failed in production — aborting startup");
      throw error;
    }
    logger.warn("PostgreSQL connection failed — continuing without PostgreSQL (dev mode)");
  }

  // Redis — optional in dev, required in production
  try {
    redisConnection = await connectRedis();
  } catch (error: unknown) {
    if (isProduction) {
      logger.error("Redis connection failed in production — aborting startup");
      throw error;
    }
    logger.warn("Redis connection failed — continuing without Redis (dev mode)");
  }
}

// ============================================================================
// SERVER START
// ============================================================================

async function startServer() {
  try {
    // Initialize databases
    await initializeDatabases();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 CMS Business Strategy Server Started                 ║
╠═══════════════════════════════════════════════════════════╣
║  Environment: ${NODE_ENV.padEnd(42)}║
║  Port: ${String(PORT).padEnd(50)}║
║  URL: http://localhost:${String(PORT).padEnd(44)}║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error: unknown) {
    process.exit(1);
  }
}

// Global error handlers for unhandled rejections and exceptions
process.on("unhandledRejection", (reason: unknown) => {
  if (captureException) {
    captureException(reason instanceof Error ? reason : new Error(String(reason)));
  }
});

process.on("uncaughtException", (error: Error) => {
  if (captureException) {
    captureException(error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await closeSentry();
  if (mongoConnection) {
    await disconnectMongoDB();
  }
  if (postgresConnection) {
    await disconnectPostgreSQL();
  }
  if (redisConnection) {
    await disconnectRedis();
  }
  process.exit(0);
});

// Start the server
void startServer();

export default app;
