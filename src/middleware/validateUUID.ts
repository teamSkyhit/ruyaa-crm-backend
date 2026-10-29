import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const param of params) {
      const value = req.params[param];
      if (value && !UUID_REGEX.test(value)) {
        res.status(400).json({ success: false, error: `Invalid ${param}: must be a valid UUID` });
        return;
      }
    }
    next();
  };
}
