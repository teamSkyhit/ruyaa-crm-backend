// src/utils/logger.ts
import { createLogger, format, transports } from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';

// Custom format for structured logging
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
  format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const metaStr = JSON.stringify(metadata, null, isDevelopment ? 2 : 0);
      msg += ` ${metaStr}`;
    }
    
    return msg;
  })
);

// Console format for development (more readable)
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(metadata).length > 0 && isDevelopment) {
      msg += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    
    return msg;
  })
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: logFormat,
  defaultMeta: {
    service: 'ruyaa-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport (colored in development)
    new transports.Console({
      format: isDevelopment ? consoleFormat : logFormat,
    }),
    // Error log file
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: 'logs/rejections.log' }),
  ],
});

const SENSITIVE_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'token', 'refreshToken', 'secret', 'apiKey', 'api_key', 'authorization']);

function sanitizeBody(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : sanitizeBody(v, depth + 1);
  }
  return result;
}

// Helper methods for structured logging
export const logRequest = (req: any, res: any, responseTime?: number) => {
  const logData: any = {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    statusCode: res.statusCode,
  };

  if (responseTime) {
    logData.responseTime = `${responseTime}ms`;
  }

  if (req.user) {
    logData.userId = req.user.userId;
    logData.userRole = req.user.role;
  }

  if (isDevelopment && req.body && Object.keys(req.body).length > 0) {
    logData.body = sanitizeBody(req.body);
  }

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

export const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logSecurityEvent = (event: string, details: any) => {
  logger.warn('Security Event', {
    event,
    ...details,
  });
};

export const logDatabaseQuery = (query: string, duration?: number) => {
  if (isDevelopment) {
    logger.debug('Database Query', {
      query,
      duration: duration ? `${duration}ms` : undefined,
    });
  }
};

export default logger;
