// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      // attach validated data
      req.validated = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ success: false, error: err.errors });
        return;
      }
      res.status(400).json({ success: false, error: 'Validation failed' });
    }
  };
}

export default validate;
