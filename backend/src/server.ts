import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { db } from './database/db';
import { seedDatabase } from './database/seed';

import authRoutes from './routes/authRoutes';
import studentRoutes from './routes/studentRoutes';
import academicRoutes from './routes/academicRoutes';
import uploadRoutes from './routes/uploadRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import settingsRoutes from './routes/settingsRoutes';
import templateRoutes from './routes/templateRoutes';
import webhookRoutes from './routes/webhookRoutes';
import whatsappSessionRoutes from './routes/whatsappSessionRoutes';

dotenv.config();

// CollegeSMS server instance

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads directory
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Health Check API
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'College Internal Marks Notification System API',
    version: '1.0.0'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/whatsapp-session', whatsappSessionRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Server Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, error: message });
});

// 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Endpoint '${req.method} ${req.originalUrl}' not found.` });
});

// Start Server and Initialize Database
async function startServer() {
  try {
    console.log('[Server] Initializing database...');
    await db.init();
    console.log('[Server] Database initialized successfully.');

    // Seed database if not yet populated
    const existingUsers = await db.query('SELECT id FROM users LIMIT 1');
    if (existingUsers.length === 0) {
      console.log('[Server] Database is empty. Seeding initial data...');
      await seedDatabase();
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 College Internal Marks Notification Server`);
      console.log(`📡 Listening on http://localhost:${PORT}`);
      console.log(`⚡ Mock Notifications Provider: ${process.env.MOCK_NOTIFICATION_PROVIDER || 'true'}`);
      console.log(`=======================================================`);
    });
  } catch (err: any) {
    console.error('[Server Startup Fatal Error]:', err);
    process.exit(1);
  }
}

startServer();
