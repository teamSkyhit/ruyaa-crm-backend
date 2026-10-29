// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface CustomError extends Error {
  status?: number;
}

function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const status = err.status || 500;

  // Always log the real error internally
  logger.error(err.stack || err.message, {
    url: req.url,
    method: req.method,
    status,
  });

  // Never expose internal error details to clients in production
  const isDev = process.env.NODE_ENV !== 'production';
  const clientMessage =
    status < 500
      ? (err.message || 'Request error')
      : isDev
      ? (err.message || 'Internal server error')
      : 'Internal server error';

  res.status(status).json({ success: false, error: clientMessage });
}

export default errorHandler;
