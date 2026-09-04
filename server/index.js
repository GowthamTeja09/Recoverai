import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { seedDatabase } from './db/seed.js';

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-signature', 'x-demo-role']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'RecoverAI Enterprise Recovery Core',
    version: '2.1.0',
    timestamp: new Date().toISOString()
  });
});

// Register API Routes
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
  console.log(`====================================================`);
});

export default app;
