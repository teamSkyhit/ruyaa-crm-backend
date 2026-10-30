import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
dotenv.config();

// Fail fast on insecure JWT secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET missing or too short (min 32 chars). ' +
    'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import publicRoutes from './routes/public';
import customerRoutes from './routes/customer';
import errorHandler from './middleware/errorHandler';
import limiter from './middleware/rateLimiter';
import { publicApiKey } from './middleware/publicApiKey';
import { handleShiprocketWebhook } from './controllers/shiprocketWebhookController';
import { sanitizeInputs } from './middleware/sanitize';
import requestLogger from './middleware/requestLogger';
import { requestId } from './middleware/requestId';
import logger from './utils/logger';
import { bootstrapAdmin } from './bootstrapAdmin';
import { specs } from './config/swagger';

const app = express();

app.use(helmet());
// Trust a forwarded address only behind a real proxy. Left on for a direct
// process, a client can pick a new rate-limit bucket with X-Forwarded-For.
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
for (const origin of [process.env.WEBSITE_ORIGIN, 'https://ruyaaessentials.com', 'https://www.ruyaaessentials.com']) {
  if (origin && !allowedOrigins.includes(origin)) allowedOrigins.push(origin);
}

const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? (
          origin: string | undefined,
          callback: (err: Error | null, allow?: boolean) => void
        ) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        }
      : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(requestId);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(cookieParser());
app.use(sanitizeInputs);
app.use(limiter);
app.use(requestLogger);
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

if (process.env.NODE_ENV !== 'production') {
  const localhostOnly = (req: Request, res: Response, next: import('express').NextFunction) => {
    const ip = (req.ip ?? req.socket?.remoteAddress ?? '').replace(/^::ffff:/, '');
    if (ip === '127.0.0.1' || ip === '::1') return next();
    res.status(403).json({ success: false, error: 'Forbidden' });
  };
  app.use(
    '/api-docs',
    localhostOnly,
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Ruyaa Essentials API',
    })
  );
}

// Public storefront API — separate CORS, no credentials needed
const websiteOrigin = process.env.WEBSITE_ORIGIN;
app.use(
  '/api/public',
  cors({
    origin:
      process.env.NODE_ENV === 'production' && websiteOrigin ? websiteOrigin : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
    credentials: false,
  }),
  publicApiKey,
  publicRoutes
);

// Prevent browsers and proxies from caching auth token responses
app.use('/api/auth', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.post('/api/webhooks/shiprocket', handleShiprocketWebhook);
app.use('/api/customer', customerRoutes);
app.use('/api', routes);

app.get('/', (_req: Request, res: Response) =>
  res.json({ message: 'Ruyaa Essentials API', status: 'ok' })
);
app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);
app.get('/api/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

app.use(errorHandler);

const port = process.env.PORT || 8001;
bootstrapAdmin()
  .catch((error) => logger.error(`Admin bootstrap failed: ${error instanceof Error ? error.message : 'unknown'}`))
  .finally(() => {
    app.listen(port, () => {
      logger.info(`Ruyaa Essentials API started on port ${port}`);
    });
  });
