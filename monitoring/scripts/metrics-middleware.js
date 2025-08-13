/**
 * Metrics Middleware for Pixelated Empathy
 * Collects application metrics for Prometheus
 */

const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'pixelated_empathy_',
});

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'pixelated_empathy_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'pixelated_empathy_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'pixelated_empathy_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

const databaseConnections = new promClient.Gauge({
  name: 'pixelated_empathy_database_connections',
  help: 'Number of active database connections',
  registers: [register],
});

const aiRequestsTotal = new promClient.Counter({
  name: 'pixelated_empathy_ai_requests_total',
  help: 'Total number of AI service requests',
  labelNames: ['service', 'model', 'status'],
  registers: [register],
});

const aiRequestDuration = new promClient.Histogram({
  name: 'pixelated_empathy_ai_request_duration_seconds',
  help: 'Duration of AI service requests in seconds',
  labelNames: ['service', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const userSessions = new promClient.Gauge({
  name: 'pixelated_empathy_user_sessions',
  help: 'Number of active user sessions',
  registers: [register],
});

const chatMessages = new promClient.Counter({
  name: 'pixelated_empathy_chat_messages_total',
  help: 'Total number of chat messages',
  labelNames: ['type', 'status'],
  registers: [register],
});

const errorRate = new promClient.Counter({
  name: 'pixelated_empathy_errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'severity'],
  registers: [register],
});

const memoryUsage = new promClient.Gauge({
  name: 'pixelated_empathy_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

// Middleware function
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Increment active connections
  activeConnections.inc();
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    
    // Decrement active connections
    activeConnections.dec();
    
    // Call original end
    originalEnd.apply(this, args);
  };
  
  next();
};

// Health check metrics
const updateHealthMetrics = (healthData) => {
  if (healthData.database) {
    databaseConnections.set(healthData.database.connections || 0);
  }
  
  if (healthData.sessions) {
    userSessions.set(healthData.sessions.active || 0);
  }
  
  if (healthData.memory) {
    memoryUsage.set({ type: 'heap_used' }, healthData.memory.heapUsed || 0);
    memoryUsage.set({ type: 'heap_total' }, healthData.memory.heapTotal || 0);
    memoryUsage.set({ type: 'external' }, healthData.memory.external || 0);
  }
};

// AI service metrics
const recordAIRequest = (service, model, duration, status = 'success') => {
  aiRequestsTotal.inc({ service, model, status });
  aiRequestDuration.observe({ service, model }, duration);
};

// Chat metrics
const recordChatMessage = (type = 'user', status = 'sent') => {
  chatMessages.inc({ type, status });
};

// Error metrics
const recordError = (type, severity = 'error') => {
  errorRate.inc({ type, severity });
};

// Metrics endpoint handler
const metricsHandler = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end(error.message);
  }
};

// Custom metrics collection
const collectCustomMetrics = () => {
  // Collect memory usage
  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'external' }, memUsage.external);
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
};

// Start collecting custom metrics every 10 seconds
setInterval(collectCustomMetrics, 10000);

module.exports = {
  metricsMiddleware,
  metricsHandler,
  updateHealthMetrics,
  recordAIRequest,
  recordChatMessage,
  recordError,
  register,
  metrics: {
    httpRequestsTotal,
    httpRequestDuration,
    activeConnections,
    databaseConnections,
    aiRequestsTotal,
    aiRequestDuration,
    userSessions,
    chatMessages,
    errorRate,
    memoryUsage,
  },
};
