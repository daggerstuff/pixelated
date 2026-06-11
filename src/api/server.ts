// Express.js Server Setup
// Main application entry point with middleware configuration

import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler, type Express, type NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { closeSentry, Sentry, sentryMiddleware } from "../../config/instrument.mjs";
import {
  connectMongoDB,
  connectPostgreSQL,
  connectRedis,
  disconnectMongoDB,
  disconnectPostgreSQL,
  disconnectRedis,
} from "../lib/database/connection";
import { authMiddleware } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/logger";
import { rateLimiter } from "./middleware/rate-limiter";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import healthRoutes from "./routes/health";
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

type SentryExpressErrorHandler = (app: express.Application) => void;
type SentryErrorHandler = (options?: Record<string, string>) => express.ErrorRequestHandler;
type SentryCaptureHandler = (error: unknown) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSentryExpressErrorHandler = (value: unknown): value is SentryExpressErrorHandler =>
  typeof value === "function";

const isSentryExpressErrorRequestHandler = (value: unknown): value is SentryErrorHandler =>
  typeof value === "function";

const isSentryCaptureHandler = (value: unknown): value is SentryCaptureHandler =>
  typeof value === "function";

const getSentryHandlers = (
  source: unknown,
): {
  setupExpressErrorHandler?: SentryExpressErrorHandler;
  expressErrorHandler?: SentryErrorHandler;
  captureException?: SentryCaptureHandler;
} => {
  if (!isRecord(source)) {
    return {};
  }

  const handlers: {
    setupExpressErrorHandler?: SentryExpressErrorHandler;
    expressErrorHandler?: SentryErrorHandler;
    captureException?: SentryCaptureHandler;
  } = {};

  if (isSentryExpressErrorHandler(source["setupExpressErrorHandler"])) {
    handlers.setupExpressErrorHandler = source["setupExpressErrorHandler"];
  }

  if (isSentryExpressErrorRequestHandler(source["expressErrorHandler"])) {
    handlers.expressErrorHandler = source["expressErrorHandler"];
  }

  if (isSentryCaptureHandler(source["captureException"])) {
    handlers.captureException = source["captureException"];
  }

  return handlers;
};

const { setupExpressErrorHandler, expressErrorHandler, captureException } =
  getSentryHandlers(Sentry);

const hasSentryErrorHandler = !!setupExpressErrorHandler || !!expressErrorHandler;

app.use(sentryMiddleware);
if (typeof setupExpressErrorHandler === "function") {
  setupExpressErrorHandler(app);
} else if (typeof expressErrorHandler === "function") {
  app.use(expressErrorHandler());
}

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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(compression());

// ============================================================================
// LOGGING
// ============================================================================

// Morgan request logger
const morganFormat = NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat));

// Custom request logger
app.use(requestLogger);

// ============================================================================
// RATE LIMITING
// ============================================================================

app.use(rateLimiter);

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/readiness", readinessRoutes);

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
  try {
    console.log("🔄 Connecting to MongoDB...");
    mongoConnection = await connectMongoDB();
    console.log("✅ MongoDB connected");
  } catch (error: unknown) {
    console.error("⚠️ MongoDB connection failed (continuing without it):", error);
  }

  try {
    console.log("🔄 Connecting to PostgreSQL...");
    postgresConnection = await connectPostgreSQL();
    console.log("✅ PostgreSQL connected");
  } catch (error: unknown) {
    console.error("⚠️ PostgreSQL connection failed (continuing without it):", error);
  }

  try {
    console.log("🔄 Connecting to Redis...");
    redisConnection = await connectRedis();
    console.log("✅ Redis connected");
  } catch (error: unknown) {
    console.error("⚠️ Redis connection failed (continuing without it):", error);
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
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
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
