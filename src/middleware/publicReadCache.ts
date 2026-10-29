import { NextFunction, Request, Response } from 'express';

type Entry = { status: number; body: unknown; expires: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 200;

export function clearPublicReadCache(): void {
  store.clear();
}

function ttlMs(): number {
  const parsed = Number(process.env.PUBLIC_READ_CACHE_MS ?? 10_000);
  return Number.isFinite(parsed) ? parsed : 10_000;
}

/**
 * Short cache for anonymous catalog GETs. Checkout and tracking stay uncached.
 * A CRM edit shows up after the TTL (10s by default).
 */
export function publicReadCache(req: Request, res: Response, next: NextFunction): void {
  const ttl = ttlMs();
  if (ttl <= 0 || req.method !== 'GET' || req.path.includes('/orders/track') || req.path.includes('/tickets/')) {
    next();
    return;
  }

  const key = req.originalUrl;
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', `public, max-age=${Math.ceil(ttl / 1000)}`);
    res.status(hit.status).json(hit.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode < 400) {
      if (store.size >= MAX_KEYS) {
        const oldest = store.keys().next().value;
        if (oldest) store.delete(oldest);
      }
      store.set(key, { status: res.statusCode || 200, body, expires: Date.now() + ttl });
    }
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', `public, max-age=${Math.ceil(ttl / 1000)}`);
    return originalJson(body);
  }) as Response['json'];

  next();
}
