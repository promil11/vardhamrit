import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import cartRoutes from './routes/cartRoutes';
import addressRoutes from './routes/addressRoutes';
import couponRoutes from './routes/couponRoutes';
import orderRoutes from './routes/orderRoutes';
import paymentRoutes from './routes/paymentRoutes';
import reviewRoutes from './routes/reviewRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './routes/notificationRoutes';
import v1Router from './routes/v1';
import categoriesRoutes from './routes/v1/categoriesRoutes';
import contentRoutes from './routes/v1/contentRoutes';
import wishlistRoutes from './routes/v1/wishlistRoutes';
import userRoutes from './routes/v1/userRoutes';
import { errorHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/response';
import { testConnection } from './config/db';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected to Socket.io: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: '*', // Adjust or restrict in production as needed
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
  })
);

// Preserving raw body for Razorpay Webhooks
app.use(
  express.json({
    limit: '15mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: '15mb', extended: true }));

const isDev = process.env.NODE_ENV !== 'production';

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // 10,000 requests per 15 mins per IP
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Specific Rate Limiter for Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // 10,000 auth requests per 15 mins per IP
  skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'),
  message: { success: false, error: 'Too many auth attempts, please try again later.' },
});
app.use('/auth', authLimiter);

// Static uploads & invoices
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(__dirname, '../uploads'))
);
app.use(
  '/invoices',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(__dirname, '../invoices'))
);

// Health Check
app.get('/health', async (_req, res) => {
  const dbHealthy = await testConnection();
  return sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Vardhamrit Chai E-Commerce API',
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// API v1 Primary Router (Production Standard)
app.use('/api/v1', v1Router);

// Backward Compatibility Direct Endpoints
app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);
app.use('/content', contentRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/addresses', addressRoutes);
app.use('/coupons', couponRoutes);
app.use('/orders', orderRoutes);
app.use('/payments', paymentRoutes);
app.use('/reviews', reviewRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/user', userRoutes);
app.use('/notifications', notificationRoutes);
// Helper to locate static builds for Admin and Visitor App
function findDistDir(folder: string): string | null {
  const possiblePaths = [
    path.resolve(__dirname, `../../${folder}/dist`),
    path.resolve(__dirname, `../${folder}/dist`),
    path.resolve(process.cwd(), `${folder}/dist`),
    path.resolve(process.cwd(), `../${folder}/dist`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const adminDist = findDistDir('admin');
const appDist = findDistDir('app');
console.log(`📦 Frontends detected: Admin: ${adminDist ? 'FOUND' : 'NOT FOUND'} (${adminDist}), App: ${appDist ? 'FOUND' : 'NOT FOUND'} (${appDist})`);

// 1. Admin UI & Admin API Handling
app.use('/admin', (req, res, next) => {
  // If it's an API request with an authorization header, JSON accept, or mutation method
  const isApi =
    Boolean(req.headers.authorization) ||
    Boolean(req.headers.accept?.includes('application/json')) ||
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (isApi) {
    return adminRoutes(req, res, next);
  }
  next();
});

if (adminDist) {
  app.use('/admin', express.static(adminDist));
  app.get(['/admin', '/admin/*'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(adminDist, 'index.html'));
  });
} else {
  app.use('/admin', adminRoutes);
}

// 2. Visitor Storefront UI (Catch-all for all customer routes)
if (appDist) {
  app.use(express.static(appDist));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/invoices') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/admin')
    ) {
      return next();
    }
    res.sendFile(path.join(appDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      message: '🍵 Vardhamrit Chai E-Commerce API is running!',
      health: '/health',
      docs: '/api/v1',
    });
  });
}

// Error Handling Middleware
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

if (require.main === module) {
  server.listen(PORT, async () => {
    console.log(`🚀 Vardhamrit API running on http://localhost:${PORT}`);
    const dbOk = await testConnection();
    console.log(`📦 Database status: ${dbOk ? 'CONNECTED' : 'FAILED'}`);
  });
}

export { app, server };
