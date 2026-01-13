import "dotenv/config";
import express from 'express'
import { createServer } from 'http'
import Redis from 'ioredis'
import { EventEmitter } from "events";
import { Pool } from 'pg'
import cors from 'cors'
import { SocketService } from "./services/socketService";


const app = express()
const server = createServer(app)

// Environment variables
const PORT = process.env.WS_PORT || 3001
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/pixelated'

// Database connection
const db = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

// Redis connection
const redisOptions = REDIS_URL.startsWith("rediss://")
  ? {
      tls: {
        rejectUnauthorized: false,
      },
      lazyConnect: true,
    }
  : { lazyConnect: true };

let redis = new Redis(REDIS_URL, redisOptions);

// Prevent unhandled error events during connection attempts
redis.on("error", (err) => {
  // We handle connection errors in the connect().catch() block below
  // This listener prevents the "Unhandled error event" warning
  console.debug("Redis connection error (handled):", err.message);
});

// Attempt connection with fallback for development
redis.connect().catch((err) => {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "Failed to connect to Redis in development, using mock:",
      err.message,
    );
    // Create a simple mock compatible with ioredis interface
    redis = new EventEmitter() as any;
    Object.assign(redis, {
      status: "ready",
      quit: async () => "OK",
      get: async () => null,
      set: async () => "OK",
      del: async () => 1,
      on: (event: string, cb: any) => {
        if (event === "connect" || event === "ready") cb();
        return redis;
      },
      // Add other necessary methods as no-ops
    });
  } else {
    console.error("Failed to connect to Redis:", err);
  }
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
)
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Create Socket.IO service
const socketService = new SocketService(server, redis, db)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')

  await redis.quit()
  await db.end()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Start server
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
  console.log(`Health check available at http://localhost:${PORT}/health`)
})

export { socketService, db, redis }
