import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { prisma } from './database/prisma';
import { queueService } from './queue/queue.service';

// Modular Route Imports
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import batchesRoutes from './modules/batches/batches.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import templatesRoutes from './modules/templates/templates.routes';
import reportsRoutes from './modules/reports/reports.routes';
import webhookRoutes from './webhooks/webhook.routes';

const app = express();

// 1. Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// 2. CORS Configuration
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://markalert.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests
    if (!origin) return callback(null, true);

    // Check if origin matches allowed domains, local LAN IPs (Wi-Fi), or Capacitor mobile webviews
    const isLocalNetwork =
      /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
    const isCapacitor =
      origin === 'capacitor://localhost' || origin === 'https://localhost' || origin === 'http://localhost';
    const isAllowedDomain =
      allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');

    if (isLocalNetwork || isCapacitor || isAllowedDomain) {
      callback(null, true);
    } else {
      callback(new Error(`CORS error: Origin '${origin}' is not allowed.`));
    }
  },
  credentials: true,
}));

// 3. Request Parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 4. Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: { success: false, error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);

// Static uploads directory (for error report downloads or temporary files)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// 5. System Health Check
app.get('/api/v1/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'MarkAlert API',
    version: '2.0.0',
    mode: config.isMockMode ? 'MOCK_PROVIDERS' : 'LIVE_PRODUCTION',
    timestamp: new Date().toISOString(),
  });
});

// 6. Mount API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin/faculty', usersRoutes);
app.use('/api/v1/batches', batchesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 7. 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl}' not found.`,
  });
});

// 8. Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
});

// 9. Startup Sequence
async function startServer() {
  try {
    console.log('[Server] Connecting to database...');
    // Verify database connection if DATABASE_URL is set
    try {
      await prisma.$connect();
      console.log('[Server] Database connected successfully via Prisma.');
    } catch (dbErr: any) {
      console.warn('[Server] Database connection warning:', dbErr.message);
      console.warn('[Server] Note: If PostgreSQL is not yet running locally, configure DATABASE_URL in .env');
    }

    // Initialize async background queue
    await queueService.init();

    app.listen(config.port, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 MarkAlert v2 Server`);
      console.log(`📡 Listening on http://localhost:${config.port}/api/v1`);
      console.log(`⚡ Provider Mode: ${config.isMockMode ? 'MOCK (Safe local test)' : 'LIVE'}`);
      console.log(`=======================================================`);
    });
  } catch (err: any) {
    console.error('[Server Fatal Error]:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
