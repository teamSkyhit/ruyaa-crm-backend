// src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { logRequest } from '../utils/logger';

/**
 * Request/Response logging middleware
 * Logs all HTTP requests with timing information
 */
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    const result = originalEnd(chunk, encoding, cb);
    setImmediate(() => logRequest(req, res, responseTime));
    return result;
  };

  next();
}

export default requestLogger;


