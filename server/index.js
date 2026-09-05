// 1. MUST BE FIRST: Load environment variables before any local modules
import './bootstrap.js';

import express from 'express';
import cors from 'cors';
import { seedDatabase } from './db/seed.js';

// Security Middleware
import { authRouter } from './security/auth.js';
import { generalApiLimiter } from './security/rateLimiter.js';

// Route imports
import webhooksRouter from './routes/webhooks.js';
import casesRouter from './routes/cases.js';
import policiesRouter from './routes/policies.js';
import auditRouter from './routes/audit.js';
import modelsRouter from './routes/models.js';
import metricsRouter from './routes/metrics.js';
import ingestionRouter from './routes/ingestion.js';
import secretsRouter from './routes/secrets.js';
import streamRouter from './routes/stream.js';

// Import pipeline to register event listeners
import './engines/pipeline.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Configurable CORS Policy
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(o => o.trim().toLowerCase())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server webhooks, curl, mobile apps)
    if (!origin) return callback(null, true);

    const lowerOrigin = origin.toLowerCase();
    const isExplicitlyAllowed = allowedOrigins.includes(lowerOrigin);
    const isDevLocalhost = process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    if (isExplicitlyAllowed || isDevLocalhost) {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-signature', 'x-demo-role', 'x-razorpay-event-id']
}));

// Raw Body Preservation for Razorpay Webhook Verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    // Preserve the exact raw bytes for cryptographic HMAC verification
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Apply General Rate Limiting to /api routes
app.use('/api', generalApiLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RecoverAI Enterprise Recovery Core',
    version: '2.2.0',
    mode: process.env.NODE_ENV || 'development',
    demoMode: process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === true,
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/cases', casesRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/models', modelsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/ingestion', ingestionRouter);
app.use('/api/secrets', secretsRouter);
app.use('/api/stream', streamRouter);

// Initialize DB seed
seedDatabase();

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` RecoverAI Engine running on port ${PORT}`);
  console.log(` Webhook Ingestion: POST http://localhost:${PORT}/api/webhooks/razorpay`);
  console.log(` Webhook Simulator: POST http://localhost:${PORT}/api/webhooks/simulate`);
  console.log(` Health Status:     GET  http://localhost:${PORT}/api/health`);
  console.log(` Mode:              ${process.env.NODE_ENV || 'development'} (DemoMode: ${process.env.DEMO_MODE || 'true'})`);
  console.log(`====================================================`);
});

export default app;
