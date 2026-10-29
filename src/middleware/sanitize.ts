import { Request, Response, NextFunction } from 'express';

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

function sanitizeObject(obj: any, htmlKeys: Set<string> | null, key?: string): any {
  if (typeof obj === 'string') {
    return htmlKeys?.has(key || '') ? obj : stripHtml(obj);
  }
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item, htmlKeys));
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const childKey of Object.keys(obj)) {
      result[childKey] = sanitizeObject(obj[childKey], htmlKeys, childKey);
    }
    return result;
  }
  return obj;
}

export const sanitizeInputs = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    const htmlKeys = req.path.startsWith('/api/blogs') ? new Set(['body']) : null;
    req.body = sanitizeObject(req.body, htmlKeys);
  }
  next();
};
